// Dev tool: run the full hardware-PDF extraction pipeline against a local PDF
// without starting the Next.js app.
//
//   npx tsx scripts/test-hardware-pdf-extraction.ts [path/to/file.pdf]
//
// Uses OPENROUTER_API_KEY from .env.local. Set NODE_ENV=development to also
// get the service's debug files under debug-extractions/pdf-extraction/.
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { extractHardwareSetsFromPdf } from '../services/hardwarePdfServiceV2';

async function main() {
  const pdfArg = process.argv[2] ?? 'docs/material/New-Type-Matrix-Format-PDF.pdf';
  const buffer = fs.readFileSync(path.resolve(process.cwd(), pdfArg));
  const result = await extractHardwareSetsFromPdf(buffer, path.basename(pdfArg), 'local-test');
  console.log('\n========== RESULT ==========');
  console.log(`tier=${result.tier} sets=${result.setCount} items=${result.itemCount} durationMs=${result.durationMs}`);
  if (result.warnings.length) console.log('warnings:', result.warnings);
  const out = 'debug-extractions/extraction-test-result.json';
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(result.sets, null, 2), 'utf-8');
  console.log(`full sets written to ${out}`);
  for (const s of result.sets) {
    console.log(`\nSET ${s.setName}${s.notes ? `  [${s.notes}]` : ''}`);
    for (const it of s.hardwareItems) {
      console.log(`  ${it.qty} × ${it.item}${it.manufacturer ? ` | ${it.manufacturer}` : ''}${it.description ? ` | ${it.description}` : ''}${it.finish ? ` | ${it.finish}` : ''}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
