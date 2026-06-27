import fs from 'fs';
import { renderPdfToImages, renderEmbeddedImageCloseups } from '@/lib/ai/pdfTextExtractor';

async function main() {
  const pdfPath = 'docs/material/PDF - WAXAHACHIE INDUSTRIAL - DH.pdf';
  const buffer = fs.readFileSync(pdfPath);
  console.log(`PDF size: ${(buffer.length/1024).toFixed(0)} KB`);

  const pages = await renderPdfToImages(buffer);
  console.log(`Page renders: ${pages.length}`);
  pages.forEach((b64, i) => {
    const out = `/tmp/wax_page_${i+1}.png`;
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`Saved ${out}`);
  });

  const closeups = await renderEmbeddedImageCloseups(buffer);
  console.log(`Closeup renders: ${closeups.length}`);
  closeups.forEach((b64, i) => {
    const out = `/tmp/wax_closeup_${i+1}.png`;
    fs.writeFileSync(out, Buffer.from(b64, 'base64'));
    console.log(`Saved ${out}`);
  });
}

main().catch(console.error);
