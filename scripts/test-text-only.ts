// Quick dry test: just extract text from PDF without AI
// npx tsx scripts/test-text-only.ts [path/to/file.pdf]
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
import { extractPdfText } from '../lib/ai/pdfTextExtractor';

async function main() {
  const pdfArg = process.argv[2] ?? 'docs/material/PDF - LOT 63 MARKET COMMON - DH.pdf';
  const buffer = fs.readFileSync(path.resolve(process.cwd(), pdfArg));
  const { pages } = await extractPdfText(buffer);
  for (const page of pages) {
    console.log(`\n========== PAGE ${page.pageNumber} ==========`);
    console.log(page.text);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
