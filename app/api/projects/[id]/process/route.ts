/**
 * POST /api/projects/[id]/process
 *
 * Combined upload endpoint: accepts both an Excel door schedule (.xlsx) and a
 * hardware PDF in one request, processes them sequentially, merges the result,
 * and persists the final JSON to project_hardware_finals.
 *
 * Form fields:
 *   - excel  — .xlsx file (door schedule)
 *   - pdf    — .pdf file  (hardware spec)
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { parseDoorSchedule } from '@/services/doorScheduleService';
import type { DoorScheduleResult } from '@/services/doorScheduleService';
import { extractDoorScheduleFromPdf } from '@/services/doorSchedulePdfService';
import { extractHardwareSetsFromPdf } from '@/services/hardwarePdfServiceV2';
import {
  upsertDoorScheduleImport,
  upsertHardwarePdfExtraction,
  upsertProjectHardwareFinal,
} from '@/lib/db/hardware';
import { mergeHardwareData } from '@/services/mergeService';
import { queueItemsForApproval } from '@/lib/db/masterHardware';

export const maxDuration = 120;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

function saveExcelDebugFiles(projectId: string, filename: string, result: DoorScheduleResult): void {
  if (process.env.NODE_ENV !== 'development') return;
  try {
    const debugDir = path.join(process.cwd(), 'debug-extractions', 'excel-extraction');
    fs.mkdirSync(debugDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const prefix = `${projectId.slice(0, 8)}_${timestamp}`;
    fs.writeFileSync(
      path.join(debugDir, `${prefix}_parsed.json`),
      JSON.stringify(result.rows, null, 2),
      'utf-8',
    );
    fs.writeFileSync(
      path.join(debugDir, `${prefix}_meta.json`),
      JSON.stringify({ fileName: filename, rowCount: result.rowCount, warnings: result.warnings }, null, 2),
      'utf-8',
    );
    console.log(`[process] Excel debug files → debug-extractions/excel-extraction/${prefix}_*`);
  } catch (err) {
    console.error('[process] Excel debug write FAILED — path:', path.join(process.cwd(), 'debug-extractions', 'excel-extraction'), '— error:', err);
  }
}

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    // ── Parse multipart form ───────────────────────────────────────────────
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
    }

    const scheduleField = formData.get('excel');
    const pdfField = formData.get('pdf');

    if (!(scheduleField instanceof File)) {
      return NextResponse.json(
        { error: 'Missing "excel" field. Send the door schedule as a multipart field named "excel".' },
        { status: 400 },
      );
    }
    if (!(pdfField instanceof File)) {
      return NextResponse.json(
        { error: 'Missing "pdf" field. Send the hardware PDF as a multipart field named "pdf".' },
        { status: 400 },
      );
    }

    if (scheduleField.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Door schedule file too large. Maximum size is 20 MB.' }, { status: 413 });
    }
    if (pdfField.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Hardware PDF too large. Maximum size is 20 MB.' }, { status: 413 });
    }

    // ── Step 1: Parse door schedule (Excel OR PDF) ────────────────────────
    const scheduleBuffer = Buffer.from(await scheduleField.arrayBuffer());
    const scheduleExt = (scheduleField.name.split('.').pop() ?? '').toLowerCase();
    const scheduleIsPdf = scheduleExt === 'pdf';

    let scheduleResult;
    try {
      if (scheduleIsPdf) {
        console.log(`[process] Door schedule is a PDF — using AI extraction (file="${scheduleField.name}")`);
        scheduleResult = await extractDoorScheduleFromPdf(scheduleBuffer, scheduleField.name, projectId);
      } else {
        scheduleResult = parseDoorSchedule(scheduleBuffer, scheduleField.name);
      }
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse door schedule: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    // Always save debug files — even on 0 rows so format mismatches are visible.
    if (!scheduleIsPdf) saveExcelDebugFiles(projectId, scheduleField.name, scheduleResult);

    if (scheduleResult.rowCount === 0) {
      return NextResponse.json(
        { error: scheduleIsPdf
            ? 'No door rows found in the PDF. Verify this is a door schedule document with a Door Tag column.'
            : 'No door rows found in the Excel file. Check that the sheet has a "DOOR TAG" column.' },
        { status: 422 },
      );
    }

    // ── Step 2: Persist door schedule ─────────────────────────────────────
    const { data: scheduleData, error: scheduleError } = await upsertDoorScheduleImport(projectId, {
      scheduleJson: scheduleResult.rows,
      fileName: scheduleField.name,
      uploadedBy: ctx.user.id,
    });

    if (scheduleError) {
      return NextResponse.json({ error: scheduleError.message }, { status: 500 });
    }

    // ── Step 3: Extract hardware sets from PDF ────────────────────────────
    const pdfBuffer = Buffer.from(await pdfField.arrayBuffer());
    let pdfResult;
    try {
      pdfResult = await extractHardwareSetsFromPdf(pdfBuffer, pdfField.name, projectId);
    } catch (err) {
      return NextResponse.json(
        { error: `PDF processing failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    if (pdfResult.setCount === 0) {
      return NextResponse.json(
        { error: 'No hardware sets were found in the PDF. Check that this is a Division 08 hardware schedule PDF.' },
        { status: 422 },
      );
    }

    // ── Step 4: Persist PDF extraction ────────────────────────────────────
    const { data: pdfData, error: pdfError } = await upsertHardwarePdfExtraction(projectId, {
      extractedJson: pdfResult.sets,
      fileName: pdfField.name,
      uploadedBy: ctx.user.id,
    });

    if (pdfError) {
      return NextResponse.json({ error: pdfError.message }, { status: 500 });
    }

    // ── Step 4b: Queue new unique items for master hardware DB approval ───
    console.log(`[process:master] PDF extracted sets=${pdfResult.sets.length}  items=${pdfResult.itemCount}`);
    const candidateItems = pdfResult.sets
      .flatMap(set =>
        (set.hardwareItems ?? []).map(item => ({
          name: (item.item ?? '').trim(),
          manufacturer: (item.manufacturer ?? '').trim(),
          description: (item.description ?? '').trim(),
          finish: (item.finish ?? '').trim(),
        })),
      )
      .filter(item => item.name.length > 0);

    console.log(`[process:master] Candidate items after filter: ${candidateItems.length}`);

    let masterQueueWarning: string | null = null;
    if (candidateItems.length > 0) {
      const queueResult = await queueItemsForApproval(
        candidateItems,
        projectId,
        pdfField.name,
        ctx.user.id,
      );
      if (queueResult.data) {
        console.log(`[process:master] Queued ${queueResult.data.queued} new items, skipped ${queueResult.data.skipped} duplicates.`);
      } else {
        masterQueueWarning = queueResult.error?.message ?? 'Unknown queue error';
        console.error('[process:master] queueItemsForApproval error:', masterQueueWarning);
      }
    } else {
      masterQueueWarning = 'No queue candidates were generated from the extracted hardware items.';
      console.warn('[process:master] No candidate items — check that hardwareItems[].item field is populated.');
    }

    // ── Step 5: Merge ─────────────────────────────────────────────────────
    const mergeResult = mergeHardwareData(pdfResult.sets, scheduleResult.rows, projectId);

    // ── Step 6: Persist merged final JSON ─────────────────────────────────
    const { error: finalError } = await upsertProjectHardwareFinal(projectId, {
      finalJson: mergeResult.sets,
      pdfExtractionId: pdfData!.id,
      doorScheduleId: scheduleData!.id,
      generatedBy: ctx.user.id,
    });

    if (finalError) {
      return NextResponse.json({ error: finalError.message }, { status: 500 });
    }

    // ── Step 7: Return stats ───────────────────────────────────────────────
    return NextResponse.json({
      data: {
        setCount: mergeResult.setCount,
        matchedDoorCount: mergeResult.matchedDoorCount,
        unmatchedDoorCount: mergeResult.unmatchedDoorCount,
        unmatchedDoorCodes: mergeResult.unmatchedDoorCodes,
        pdfSetsWithNoDoors: mergeResult.pdfSetsWithNoDoors,
        masterQueueWarning,
        warnings: [...scheduleResult.warnings, ...pdfResult.warnings, ...mergeResult.warnings],
        rowCount: scheduleResult.rowCount,
        itemCount: pdfResult.itemCount,
      },
    });
  },
);
