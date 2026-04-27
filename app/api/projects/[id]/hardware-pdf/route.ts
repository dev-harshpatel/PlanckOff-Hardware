import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { extractHardwareSetsFromPdf } from '@/services/hardwarePdfServiceV2';
import { upsertHardwarePdfExtraction, getHardwarePdfExtraction } from '@/lib/db/hardware';
import { queueItemsForApproval } from '@/lib/db/masterHardware';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getHardwarePdfExtraction(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

// Gemini native PDF processing can take time for large files
export const maxDuration = 120;

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    // Accepts multipart/form-data with a single field named "file" (PDF).
    // The raw PDF buffer is sent directly to OpenRouter — no client-side
    // text extraction needed.
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided. Send a multipart field named "file".' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 20 MB.' },
        { status: 413 },
      );
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf') {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload a PDF file.' },
        { status: 415 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let result;
    try {
      result = await extractHardwareSetsFromPdf(buffer, filename, projectId);
    } catch (err) {
      return NextResponse.json(
        { error: `PDF processing failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    if (result.setCount === 0) {
      return NextResponse.json(
        { error: 'No hardware sets were found. Check that this is a Division 08 hardware schedule PDF.' },
        { status: 422 },
      );
    }

    const { data, error } = await upsertHardwarePdfExtraction(projectId, {
      extractedJson: result.sets,
      fileName: filename,
      uploadedBy: ctx.user.id,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Queue new unique items into the master hardware pending table.
    // Must be awaited — serverless functions terminate once the response is sent,
    // so fire-and-forget (.then()) would be silently dropped.
    console.log(`[hw-pdf:master] Starting queue step — sets=${result.sets.length}  totalItems=${result.itemCount}`);

    // Log the raw shape of the first set so we can verify field names
    if (result.sets.length > 0) {
      const firstSet = result.sets[0];
      console.log('[hw-pdf:master] First set sample:', JSON.stringify({
        setName: firstSet.setName,
        itemCount: firstSet.hardwareItems?.length ?? 0,
        firstItem: firstSet.hardwareItems?.[0] ?? null,
      }));
    }

    const candidateItems = result.sets
      .flatMap(set =>
        (set.hardwareItems ?? []).map(item => ({
          name: (item.item ?? '').trim(),
          manufacturer: (item.manufacturer ?? '').trim(),
          description: (item.description ?? '').trim(),
          finish: (item.finish ?? '').trim(),
        })),
      )
      .filter(item => item.name.length > 0); // skip blank item names

    console.log(`[hw-pdf:master] Candidates after flattening and filtering blanks: ${candidateItems.length}`);

    let queuedCount = 0;
    let skippedCount = 0;
    let queueWarning: string | null = null;
    if (candidateItems.length > 0) {
      const queueResult = await queueItemsForApproval(
        candidateItems,
        projectId,
        filename,
        ctx.user.id,
      );
      if (queueResult.data) {
        queuedCount = queueResult.data.queued;
        skippedCount = queueResult.data.skipped;
      } else {
        queueWarning = queueResult.error?.message ?? 'Unknown queue error';
        console.error('[hw-pdf:master] queueItemsForApproval returned error:', queueWarning);
      }
    } else {
      queueWarning = 'No queue candidates were generated from the extracted hardware items.';
      console.warn('[hw-pdf:master] candidateItems is empty — nothing queued. Check that hardwareItems[].item field is non-blank.');
    }

    console.log(
      `[hardware-pdf] Saved → project=${projectId}  file="${filename}"  ` +
      `sets=${result.setCount}  items=${result.itemCount}  tier=${result.tier}  ` +
      `db_id=${data!.id}  duration=${result.durationMs}ms  ` +
      `master-queued=${queuedCount}  master-skipped=${skippedCount}`,
    );

    return NextResponse.json({
      data: {
        id: data!.id,
        setCount: result.setCount,
        itemCount: result.itemCount,
        durationMs: result.durationMs,
        tier: result.tier,
        warnings: result.warnings,
        masterQueued: queuedCount,
        masterSkipped: skippedCount,
        masterQueueWarning: queueWarning,
      },
    });
  },
);
