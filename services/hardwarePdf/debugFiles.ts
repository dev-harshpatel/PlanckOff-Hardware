/**
 * DEV-only debug file writer.
 *
 * Output:
 *   debug-extractions/pdf-extraction/{projectId}_{timestamp}_raw.txt     ← raw AI response
 *   debug-extractions/pdf-extraction/{projectId}_{timestamp}_parsed.json ← normalized sets
 *   debug-extractions/pdf-extraction/{projectId}_{timestamp}_meta.json   ← run metadata
 */

import fs from 'fs';
import path from 'path';
import type { ExtractedHardwareSet } from '@/lib/db/hardware';
import { MODEL } from './config';

export function saveDebugFiles(
  projectId: string,
  fileName: string,
  rawResponse: string,
  parsed: ExtractedHardwareSet[],
  meta: Record<string, unknown>,
): void {
  if (process.env.NODE_ENV !== 'development') return;

  try {
    const debugDir = path.join(process.cwd(), 'debug-extractions', 'pdf-extraction');
    fs.mkdirSync(debugDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeProjectId = projectId.slice(0, 8);
    const prefix = `${safeProjectId}_${timestamp}`;

    fs.writeFileSync(path.join(debugDir, `${prefix}_raw.txt`), rawResponse, 'utf-8');
    fs.writeFileSync(path.join(debugDir, `${prefix}_parsed.json`), JSON.stringify(parsed, null, 2), 'utf-8');
    fs.writeFileSync(path.join(debugDir, `${prefix}_meta.json`), JSON.stringify({ fileName, model: MODEL, ...meta }, null, 2), 'utf-8');

    console.log(`[hardwarePdfServiceV2] Debug files → debug-extractions/pdf-extraction/${prefix}_*`);
  } catch (err) {
    // Never crash the main flow because of debug output
    console.warn('[hardwarePdfServiceV2] Could not write debug files:', err);
  }
}
