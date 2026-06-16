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

    let browser: Awaited<ReturnType<typeof import('playwright-core')['chromium']['launch']>> | null = null;
    let context: Awaited<ReturnType<NonNullable<typeof browser>['newContext']>> | null = null;

    try {
      // Vercel's serverless runtime has no system Chromium, and the full `playwright`
      // package's bundled browser binary doesn't run there. On Vercel we use
      // `playwright-core` (no bundled browser) paired with `@sparticuz/chromium`,
      // a Chromium build packaged specifically to run inside the Lambda sandbox.
      // Locally, fall back to the full `playwright` package's own downloaded browser.
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
      const printUrl = `${origin}/project/${encodeURIComponent(projectId)}/reports/submittal-package?print=1`;

      await page.goto(printUrl, { waitUntil: 'networkidle', timeout: 45_000 });
      await page.waitForSelector('.submittal-root .spage', { timeout: 45_000 });
      await page.emulateMedia({ media: 'print' });
      await page.evaluate(async () => {
        await document.fonts.ready;
      });

      const pdf = await page.pdf({
        printBackground: true,
        preferCSSPageSize: true,
        margin: { top: '0', right: '0', bottom: '0', left: '0' },
      });

      const filename = buildExportFilename(projectResult.data.name, 'Submittal Package', 'pdf');
      return new NextResponse(pdf, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      });
    } catch (err) {
      console.error('[submittal-package:pdf] Failed to generate PDF:', err);
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
