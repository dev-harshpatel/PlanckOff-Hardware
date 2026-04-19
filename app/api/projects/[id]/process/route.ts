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
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { parseDoorSchedule } from '@/services/doorScheduleService';
import { extractHardwareSetsFromPdf } from '@/services/hardwarePdfServiceV2';
import {
  upsertDoorScheduleImport,
  upsertHardwarePdfExtraction,
  upsertProjectHardwareFinal,
} from '@/lib/db/hardware';
import { mergeHardwareData } from '@/services/mergeService';

export const maxDuration = 120;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

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

    const excelField = formData.get('excel');
    const pdfField = formData.get('pdf');

    if (!(excelField instanceof File)) {
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

    if (excelField.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Excel file too large. Maximum size is 20 MB.' }, { status: 413 });
    }
    if (pdfField.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'PDF file too large. Maximum size is 20 MB.' }, { status: 413 });
    }

    // ── Step 1: Parse Excel door schedule ─────────────────────────────────
    const excelBuffer = Buffer.from(await excelField.arrayBuffer());
    let scheduleResult;
    try {
      scheduleResult = parseDoorSchedule(excelBuffer, excelField.name);
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse Excel file: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    if (scheduleResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'No door rows found in the Excel file. Check that the sheet has a "DOOR TAG" column.' },
        { status: 422 },
      );
    }

    // ── Step 2: Persist door schedule ─────────────────────────────────────
    const { data: scheduleData, error: scheduleError } = await upsertDoorScheduleImport(projectId, {
      scheduleJson: scheduleResult.rows,
      fileName: excelField.name,
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
        warnings: [...scheduleResult.warnings, ...pdfResult.warnings, ...mergeResult.warnings],
        rowCount: scheduleResult.rowCount,
        itemCount: pdfResult.itemCount,
      },
    });
  },
);
