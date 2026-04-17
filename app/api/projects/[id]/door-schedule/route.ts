import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { withAuth } from '@/lib/auth/api-helpers';
import type { AuthContext, RouteParams } from '@/lib/auth/api-helpers';
import { parseDoorSchedule, type DoorScheduleResult } from '@/services/doorScheduleService';
import { upsertDoorScheduleImport, getDoorScheduleImport } from '@/lib/db/hardware';

// ---------------------------------------------------------------------------
// Debug output (DEV only)
// ---------------------------------------------------------------------------

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
    console.log(`[door-schedule] Debug files → debug-extractions/excel-extraction/${prefix}_*`);
  } catch (err) {
    console.warn('[door-schedule] Could not write debug files:', err);
  }
}

export const GET = withAuth(
  async (_req: NextRequest, _ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;
    const { data, error } = await getDoorScheduleImport(projectId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ data });
  },
);

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

export const POST = withAuth(
  async (req: NextRequest, ctx: AuthContext, params?: RouteParams) => {
    const projectId = params?.id as string;

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data.' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided. Send a multipart field named "file".' }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum size is 20 MB.` }, { status: 413 });
    }

    const filename = file.name;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext ?? '')) {
      return NextResponse.json(
        { error: 'Unsupported file type. Please upload an .xlsx, .xls, or .csv file.' },
        { status: 415 },
      );
    }

    // Parse the file
    const buffer = Buffer.from(await file.arrayBuffer());
    let result;
    try {
      result = parseDoorSchedule(buffer, filename);
    } catch (err) {
      return NextResponse.json(
        { error: `Failed to parse file: ${err instanceof Error ? err.message : String(err)}` },
        { status: 422 },
      );
    }

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'No door rows found in the file. Check that the sheet has a "DOOR TAG" column.' },
        { status: 422 },
      );
    }

    // Save debug files before persisting
    saveExcelDebugFiles(projectId, filename, result);

    // Persist to DB
    const { data, error } = await upsertDoorScheduleImport(projectId, {
      scheduleJson: result.rows,
      fileName: filename,
      uploadedBy: ctx.user.id,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log(
      `[door-schedule] Saved → project=${projectId}  file="${filename}"  ` +
      `rows=${result.rowCount}  db_id=${data!.id}`,
    );

    return NextResponse.json({
      data: {
        id: data!.id,
        rowCount: result.rowCount,
        warnings: result.warnings,
      },
    });
  },
);
