/**
 * POST /api/projects/[id]/hardware-merge
 *
 * Fetches the project's PDF extraction and Excel door schedule from Supabase,
 * runs the merge, and upserts the result to project_hardware_finals.
 *
 * GET /api/projects/[id]/hardware-merge
 *
 * Returns the current merged final JSON for the project.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import {
  getHardwarePdfExtraction,
  getDoorScheduleImport,
  upsertProjectHardwareFinal,
  getProjectHardwareFinal,
} from '@/lib/db/hardware';
import { mergeHardwareData } from '@/services/mergeService';

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getProjectHardwareFinal(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

export const POST = withAuth(
  async (_req: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    // Fetch both source datasets from Supabase
    const [pdfResult, scheduleResult] = await Promise.all([
      getHardwarePdfExtraction(projectId),
      getDoorScheduleImport(projectId),
    ]);

    if (pdfResult.error) {
      return NextResponse.json(
        { error: `Could not load PDF extraction: ${pdfResult.error.message}` },
        { status: 500 },
      );
    }
    if (scheduleResult.error) {
      return NextResponse.json(
        { error: `Could not load door schedule: ${scheduleResult.error.message}` },
        { status: 500 },
      );
    }

    if (!pdfResult.data) {
      return NextResponse.json(
        { error: 'No hardware PDF extraction found for this project. Upload the hardware PDF first.' },
        { status: 422 },
      );
    }
    if (!scheduleResult.data) {
      return NextResponse.json(
        { error: 'No door schedule found for this project. Upload the Excel door schedule first.' },
        { status: 422 },
      );
    }

    // Run the merge
    const mergeResult = mergeHardwareData(
      pdfResult.data.extractedJson,
      scheduleResult.data.scheduleJson,
      projectId,
    );

    // Persist to project_hardware_finals
    const { data, error } = await upsertProjectHardwareFinal(projectId, {
      finalJson: mergeResult.sets,
      pdfExtractionId: pdfResult.data.id,
      doorScheduleId: scheduleResult.data.id,
      generatedBy: ctx.user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      data: {
        id: data!.id,
        setCount: mergeResult.setCount,
        matchedDoorCount: mergeResult.matchedDoorCount,
        unmatchedDoorCount: mergeResult.unmatchedDoorCount,
        unmatchedDoorCodes: mergeResult.unmatchedDoorCodes,
        pdfSetsWithNoDoors: mergeResult.pdfSetsWithNoDoors,
        warnings: mergeResult.warnings,
      },
    });
  },
);
