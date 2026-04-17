/**
 * Standalone merge test — no server needed.
 * Run: npx tsx scripts/test-merge.ts
 *
 * Loads the parsed.json from the latest PDF extraction debug file,
 * loads the Excel parsed.json from debug-extractions (if available),
 * otherwise loads from Supabase directly.
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';

// Load .env.local
const envLocalPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const lines = fs.readFileSync(envLocalPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

process.env.NODE_ENV = 'development';

async function main() {
  const pdfDir   = path.join(process.cwd(), 'debug-extractions', 'pdf-extraction');
  const excelDir = path.join(process.cwd(), 'debug-extractions', 'excel-extraction');

  // Find latest PDF parsed.json
  const pdfFile = fs.existsSync(pdfDir)
    ? fs.readdirSync(pdfDir).filter(f => f.endsWith('_parsed.json')).sort().at(-1)
    : undefined;

  if (!pdfFile) {
    console.error('No PDF parsed.json found in debug-extractions/pdf-extraction/. Run test-pdf-extraction.ts first.');
    process.exit(1);
  }

  const pdfSets = JSON.parse(fs.readFileSync(path.join(pdfDir, pdfFile), 'utf-8'));
  console.log(`\nPDF sets loaded from: pdf-extraction/${pdfFile} (${pdfSets.length} sets)`);

  // Find latest Excel parsed.json
  const excelFile = fs.existsSync(excelDir)
    ? fs.readdirSync(excelDir).filter(f => f.endsWith('_parsed.json')).sort().at(-1)
    : undefined;

  let doorRows;
  if (excelFile) {
    doorRows = JSON.parse(fs.readFileSync(path.join(excelDir, excelFile), 'utf-8'));
    console.log(`Door rows loaded from: excel-extraction/${excelFile} (${doorRows.length} rows)`);
  } else {
    // Fall back to loading from Supabase
    console.log('No Excel debug file found — loading from Supabase...');
    const { createSupabaseAdminClient } = await import('../lib/supabase/admin');
    const db = createSupabaseAdminClient();
    const { data } = await db
      .from('door_schedule_imports')
      .select('schedule_json')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    doorRows = data?.schedule_json ?? [];
    console.log(`Door rows loaded from Supabase (${doorRows.length} rows)`);
  }

  const { mergeHardwareData } = await import('../services/mergeService');

  const result = mergeHardwareData(pdfSets, doorRows, 'test-00000000');

  console.log('\n=== MERGE RESULT ===');
  console.log(`Sets:                 ${result.setCount}`);
  console.log(`Matched doors:        ${result.matchedDoorCount}`);
  console.log(`Unmatched door codes: ${result.unmatchedDoorCount}`);
  if (result.unmatchedDoorCodes.length > 0) {
    console.log(`  → ${result.unmatchedDoorCodes.join(', ')}`);
  }
  if (result.pdfSetsWithNoDoors.length > 0) {
    console.log(`PDF sets with no doors: ${result.pdfSetsWithNoDoors.join(', ')}`);
  }

  console.log('\n=== PER-SET SUMMARY ===');
  result.sets.forEach(s => {
    const doorList = s.doors.map(d => d.doorTag).join(', ') || 'none';
    console.log(`  ${s.setName.padEnd(12)} ${s.hardwareItems.length} items  ${s.doors.length} doors  [${doorList}]`);
  });

  if (result.warnings.length > 0) {
    console.log('\n=== WARNINGS ===');
    result.warnings.forEach(w => console.log(`  ⚠ ${w}`));
  }

  console.log('\n=== DEBUG FILES ===');
  console.log('Check debug-extractions/final-extraction/*_final.json for the full merged output.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
