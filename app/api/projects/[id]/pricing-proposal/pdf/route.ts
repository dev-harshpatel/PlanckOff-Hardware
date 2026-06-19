import { NextRequest, NextResponse } from 'next/server';
import { withProjectAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { getProjectById } from '@/lib/db/projects';
import { buildExportFilename } from '@/utils/exportFilename';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export const GET = withProjectAuth(
  async (request: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    const projectResult = await getProjectById(projectId);
    if (projectResult.error || !projectResult.data) {
      return NextResponse.json(
        { error: projectResult.error?.message ?? 'Project not found.' },
        { status: projectResult.error ? 500 : 404 },
      );
    }

    // Forward hidden-table flags from the caller to the print page URL
    const { searchParams } = request.nextUrl;
    const hideDoors    = searchParams.get('hideDoors')    === '1' ? '1' : '0';
    const hideFrames   = searchParams.get('hideFrames')   === '1' ? '1' : '0';
    const hideHardware = searchParams.get('hideHardware') === '1' ? '1' : '0';

    let browser: Awaited<ReturnType<typeof import('playwright-core')['chromium']['launch']>> | null = null;
    let context: Awaited<ReturnType<NonNullable<typeof browser>['newContext']>> | null = null;

    try {
      const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;

      let executablePath: string | undefined;
      let launchArgs = ['--no-sandbox', '--disable-dev-shm-usage'];
      let chromiumModule: typeof import('playwright-core')['chromium'];

      if (isServerless) {
        const sparticuzChromium = (await import('@sparticuz/chromium')).default;
        executablePath = await sparticuzChromium.executablePath();
        launchArgs = sparticuzChromium.args;
        chromiumModule = (await import('playwright-core')).chromium;
      } else {
        chromiumModule = (await import('playwright')).chromium;
      }

      browser = await chromiumModule.launch({
        headless: true,
        args: launchArgs,
        executablePath,
      });

      const origin = request.nextUrl.origin;
      const cookie = request.headers.get('cookie') ?? '';
      context = await browser.newContext({
        extraHTTPHeaders: cookie ? { cookie } : undefined,
      });
      const page = await context.newPage();

      const printUrl =
        `${origin}/project/${encodeURIComponent(projectId)}/pricing/proposal/print` +
        `?print=1&hideDoors=${hideDoors}&hideFrames=${hideFrames}&hideHardware=${hideHardware}`;

      await page.goto(printUrl, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForSelector('.proposal-print-root', { timeout: 45_000 });
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(async () => { await document.fonts.ready; });

      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '18mm', right: '12mm', bottom: '18mm', left: '12mm' },
      });

      const filename = buildExportFilename(projectResult.data.name, 'Proposal', 'pdf');
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.error('[pricing-proposal:pdf] Failed to generate PDF:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to generate PDF.' },
        { status: 500 },
      );
    } finally {
      await context?.close().catch(() => {});
      await browser?.close().catch(() => {});
    }
  },
);
