// Debug script to inspect column-gap vote counts
import fs from 'fs';
import path from 'path';

async function main() {
  const pdfPath = path.join(process.cwd(), 'docs/material/PDF - LOT 63 MARKET COMMON - DH.pdf');
  const buffer = fs.readFileSync(pdfPath);

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);
  const { pathToFileURL } = await import('url');
  const workerSrc = pathToFileURL(
    path.resolve(process.cwd(), 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs'),
  ).href;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

  const uint8 = new Uint8Array(buffer);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdf = await (pdfjsLib as any).getDocument({
    data: uint8, useWorkerFetch: false, isEvalSupported: false, disableAutoFetch: true,
  }).promise;

  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (content.items as any[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .filter((item: any) => typeof item.str === 'string' && item.str.trim())
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .map((item: any) => {
      const [vx, vy] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
      return { vx: vx as number, vy: vy as number, str: item.str as string };
    });

  items.sort((a, b) => a.vy - b.vy);
  const rows: typeof items[] = [];
  let cur = [items[0]];
  for (let i = 1; i < items.length; i++) {
    if (Math.abs(items[i].vy - cur[0].vy) <= 4) cur.push(items[i]);
    else { rows.push(cur); cur = [items[i]]; }
  }
  rows.push(cur);

  console.log(`Total rows: ${rows.length}`);
  console.log(`All vx range: ${Math.min(...items.map(i => i.vx)).toFixed(0)} – ${Math.max(...items.map(i => i.vx)).toFixed(0)}\n`);

  const BIN = 120, MIN_VOTE = 80;
  const voteCounts = new Map<number, number>();
  const voteMaxGap = new Map<number, number>();
  const voteExample = new Map<number, string>();

  for (const row of rows) {
    if (row.length < 2) continue;
    const sorted = [...row].sort((a, b) => a.vx - b.vx);
    let rowMaxGap = 0, rowMaxCenter = 0;
    for (let i = 0; i < sorted.length - 1; i++) {
      const gap = sorted[i + 1].vx - sorted[i].vx;
      if (gap > rowMaxGap) { rowMaxGap = gap; rowMaxCenter = (sorted[i].vx + sorted[i + 1].vx) / 2; }
    }
    if (rowMaxGap < MIN_VOTE) continue;
    const bin = Math.floor(rowMaxCenter / BIN) * BIN;
    voteCounts.set(bin, (voteCounts.get(bin) ?? 0) + 1);
    voteMaxGap.set(bin, Math.max(voteMaxGap.get(bin) ?? 0, rowMaxGap));
    if (!voteExample.has(bin)) {
      voteExample.set(bin, `gap=${rowMaxGap.toFixed(0)}@${rowMaxCenter.toFixed(0)}: "${sorted.map(i => i.str.trim()).slice(0, 5).join(' ')}"`);
    }
  }

  console.log('All bins by vote count (≥1 vote):');
  const sortedBins = [...voteCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [bin, votes] of sortedBins) {
    const mark = (voteMaxGap.get(bin) ?? 0) >= 150 && votes >= 4 ? ' ✓ QUALIFIES' : '';
    console.log(`  bin=${bin} votes=${votes} maxGap=${voteMaxGap.get(bin)?.toFixed(0)}${mark}  ${voteExample.get(bin)}`);
  }
}

main().catch(console.error);
