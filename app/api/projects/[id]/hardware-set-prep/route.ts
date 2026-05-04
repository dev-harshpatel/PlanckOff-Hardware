/**
 * POST /api/projects/[id]/hardware-set-prep
 *
 * Fallback: generates hardware prep for a single set when the pipeline failed to
 * do so. Updates both the extracted JSON and the final JSON so the prep persists
 * on reload. Called by the "Generate Hardware Prep" button in the UI.
 *
 * Body: { setName: string }
 * Response: { prep: string }
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { generatePrepForOneSet } from '@/services/hardwarePrepService';
import {
  getHardwarePdfExtraction,
  upsertHardwarePdfExtraction,
  getProjectHardwareFinal,
  updateProjectHardwareFinal,
} from '@/lib/db/hardware';
import type { ExtractedHardwareSet } from '@/lib/db/hardware';

export const maxDuration = 60;

export const POST = withAuth(
  async (req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let body: { setName?: string };
    try {
      body = (await req.json()) as { setName?: string };
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    const { setName } = body;
    if (!setName || typeof setName !== 'string') {
      return NextResponse.json({ error: 'setName is required.' }, { status: 400 });
    }

    // Fetch the current extracted JSON
    const { data: hwData, error: hwErr } = await getHardwarePdfExtraction(projectId);
    if (hwErr || !hwData) {
      return NextResponse.json(
        { error: hwErr?.message ?? 'No PDF extraction found for this project.' },
        { status: 404 },
      );
    }

    const targetSetFromPdf = hwData?.extractedJson.find(s => s.setName === setName) ?? null;

    // Fetch finalJson now — needed both for manual-entry fallback and for the patch step
    const { data: finalData } = await getProjectHardwareFinal(projectId);

    let targetSet: ExtractedHardwareSet | null = targetSetFromPdf;

    if (!targetSet) {
      // Set was manually added — it won't be in extractedJson. Look it up in finalJson instead.
      const mergedSet = finalData?.finalJson.find(s => s.setName === setName) ?? null;
      if (!mergedSet) {
        return NextResponse.json(
          { error: `Set "${setName}" not found. It may have been deleted.` },
          { status: 404 },
        );
      }
      targetSet = {
        setName: mergedSet.setName,
        hardwareItems: mergedSet.hardwareItems,
        notes: mergedSet.notes || undefined,
        isManualEntry: true,
      };
    }

    // Generate prep for this set
    let prep: string;
    try {
      prep = await generatePrepForOneSet(targetSet);
    } catch (err) {
      return NextResponse.json(
        { error: `Prep generation failed: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    if (targetSetFromPdf) {
      // Patch extracted JSON — update only this set's prep field
      const updatedExtractedJson = hwData!.extractedJson.map(s =>
        s.setName === setName ? { ...s, prep } : s,
      );
      await upsertHardwarePdfExtraction(projectId, {
        extractedJson: updatedExtractedJson,
      });
    }

    // Patch final JSON if it exists — update only this set's prep field
    if (finalData?.finalJson) {
      const updatedFinalJson = finalData.finalJson.map(s =>
        s.setName === setName ? { ...s, prep } : s,
      );
      await updateProjectHardwareFinal(projectId, updatedFinalJson, finalData.trashJson ?? []);
    }

    return NextResponse.json({ prep });
  },
);
