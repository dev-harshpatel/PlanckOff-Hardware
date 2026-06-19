import { NextRequest, NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getProjectById } from '@/lib/db/projects';
import {
  getProjectHardwareFinal,
  getHardwarePdfExtraction,
  getDoorScheduleImport,
} from '@/lib/db/hardware';
import {
  getProjectPricing,
  getProposalProfit,
  getProposalExpenses,
  getTaxRows,
} from '@/lib/db/pricing';
import { getCompanySettings } from '@/lib/db/companySettings';

export const GET = withProjectAuth(
  async (_req: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const userId = ctx.user.id;

    const [projectRes, mergeRes, pricingRes, proposalRes, expensesRes, taxRes, settingsRes] =
      await Promise.all([
        getProjectById(projectId),
        getProjectHardwareFinal(projectId),
        getProjectPricing(projectId),
        getProposalProfit(projectId),
        getProposalExpenses(projectId),
        getTaxRows(projectId),
        getCompanySettings(userId),
      ]);

    if (projectRes.error || !projectRes.data) {
      return NextResponse.json(
        { error: projectRes.error?.message ?? 'Project not found.' },
        { status: 404 },
      );
    }

    let finalJson = mergeRes.data?.finalJson ?? null;
    let doorScheduleJson = null;
    let hardwareExtracted = null;

    if (!finalJson || finalJson.length === 0) {
      const [hwPdfRes, dsRes] = await Promise.all([
        getHardwarePdfExtraction(projectId),
        getDoorScheduleImport(projectId),
      ]);
      hardwareExtracted = hwPdfRes.data?.extractedJson ?? null;
      doorScheduleJson = dsRes.data?.scheduleJson ?? null;
    }

    const proj = projectRes.data as unknown as Record<string, unknown>;

    return NextResponse.json({
      data: {
        projectName:     proj.name ?? '',
        elevationTypes:  (proj.elevationTypes ?? []) as unknown[],
        companySettings: settingsRes.data ?? null,
        finalJson,
        doorScheduleJson,
        hardwareExtracted,
        pricingRows:     pricingRes.data ?? [],
        proposalProfit:  proposalRes.data ?? {
          profit_door: 0, profit_frame: 0, profit_hardware: 0,
          allocate_expenses: false, remarks: '',
        },
        extraExpenses: expensesRes.data ?? [],
        taxRows:       taxRes.data ?? [],
      },
    });
  },
);
