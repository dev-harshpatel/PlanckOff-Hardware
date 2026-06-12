/**
 * Deterministic extractor for per-door mark-grid door schedules (Format G).
 *
 * Layout family: a door schedule table where each DOOR is a ROW and hardware
 * items are INDICATOR COLUMNS, marked per door either as
 *   - text values "YES" / "-" in the cell (text-layer readable), or
 *   - graphical checkboxes / filled marks (pixels only — invisible to text).
 *
 * Vision models fail on these the same way they fail on Format F matrices:
 * they cannot keep row/column alignment over 30+ columns × 100+ rows and
 * fabricate plausible-looking per-door items. But the structure is fully
 * recoverable without AI:
 *   - door numbers      → text layer (exact x/y positions)
 *   - column headers    → text layer
 *   - column boundaries → vertical ruling lines (rendered pixels)
 *   - cell marks        → text values, or dark-fill sampling (rendered pixels)
 *
 * Everything here is deterministic; there are no model calls. Returns null
 * when the document does not contain such a table — callers fall through to
 * the normal tiers unchanged.
 *
 * Server-side only. Never import from client components.
 */

import type { ExtractedHardwareSet } from '@/lib/db/hardware';
import { extractPositionedText } from './pdfTextExtractor';
import type { PositionedPage, PositionedTextItem } from './pdfTextExtractor';

// ---------------------------------------------------------------------------
// Tuning constants
// ---------------------------------------------------------------------------

// P201a, D005A, 101a, EX211, D001-2, EX-D4 — short alnum token with ≥1 digit,
// optionally hyphenated
const DOOR_TOKEN_RE = /^(?=.*\d)[A-Z0-9]{1,6}(?:-[A-Z0-9]{1,4})?$/i;
const MIN_DOOR_ROWS = 8;            // fewer rows → not a schedule worth this path
const MIN_ITEM_COLUMNS = 3;         // fewer hardware columns → not a mark grid
const DOOR_X_CLUSTER_TOLERANCE = 6; // pt — door numbers in one column align within this
const MIN_UNIQUE_RATIO = 0.6;       // door numbers are mostly unique; data columns repeat
const RENDER_SCALE = 2;             // page render scale for pixel mark sampling
const RENDER_MAX_LONG_SIDE = 5200;  // cap render long side — large sheets at full scale waste hundreds of MB
const V_LINE_MIN_BAND_FRACTION = 0.40; // vertical rule spans much of the table band (sectioned tables interrupt rules; text columns stay ≤ ~0.30)
const COLUMN_GAP_SPLIT_FACTOR = 3;  // column-line gap > 3× median AND empty → separate table
const MARK_DARK_THRESHOLD = 0.30;   // dark fraction in cell center → mark present (unchecked outline ≈ 0.11–0.19, checked fill ≈ 0.44+)
const HEADER_BAND_MAX_ROWS = 14;    // header text searched up to this many row-heights above

// Yes/no style cell values (text-encoded marks)
const YES_VALUES = new Set(['YES', 'Y', 'X', '✓', '•']);
const NO_VALUES = new Set(['NO', 'N', '-', '—', '–', '']);

// A yes/checkbox column only becomes a hardware item when its header matches
// hardware vocabulary — keeps GLAZING / FIRE RATING / BARRIER-FREE ACCESS
// compliance flags out of the sets.
const HARDWARE_HEADER_RE = new RegExp(
  [
    'CLOSER', 'HINGE', 'LOCK', 'LEVER', 'KICK', 'STOP', 'SEAL', 'THRESHOLD',
    'WEATHER', 'SWEEP', 'ASTRAGAL', 'CARD', 'READER', 'PANIC', 'EXIT DEVICE',
    'FIRE EXIT', 'STRIKE', 'HOLD OPEN', 'OPERATOR', 'ACTUATOR', 'CONTACT',
    'INDICATOR', 'ELECTROMAGNETIC', 'RELEASE', 'BELL', 'BOLT', 'SILENCER',
    'GASKET', 'ACCESS CONTROL', 'AUTO\\b', 'ADO\\b', 'PULL', 'PUSH', 'LATCH',
  ].join('|'),
  'i',
);

// Columns whose text values are hardware codes/functions (e.g. "STRM, ADO, WS"
// or "Storeroom") — each value becomes an item.
const FUNCTION_HEADER_RE = /HARDWARE\s*FUNCTION|FUNCTION\s*\/?\s*LOCK|LOCK\s*FUNCTION/i;

// Columns whose text goes into the set's notes field.
const NOTES_HEADER_RE = /COMMENT|REMARK|NOTE/i;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ColumnBand {
  x0: number;
  x1: number;
  header: string;
  kind: 'yesno' | 'checkbox' | 'function' | 'notes' | 'data';
}

export interface DoorScheduleGridResult {
  sets: ExtractedHardwareSet[];
  tableCount: number;
  /** per-table diagnostics for logging */
  tables: Array<{ doorCount: number; itemColumns: string[]; page: number }>;
}

// ---------------------------------------------------------------------------
// Page rendering for pixel sampling (lazy, one render per page, cached)
// ---------------------------------------------------------------------------

interface PagePixels {
  width: number;
  height: number;
  scale: number;
  data: Uint8ClampedArray;
}

async function renderPagePixels(buffer: Buffer, pageNumber: number): Promise<PagePixels> {
  const { createCanvas, Path2D } = await import('@napi-rs/canvas');
  (globalThis as Record<string, unknown>).Path2D = Path2D;

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs' as string);
  const WORKER_SUBPATH = 'pdfjs-dist/legacy/build/pdf.worker.min.mjs';
  let workerSrc: string;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (typeof (import.meta as any).resolve === 'function') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      workerSrc = (import.meta as any).resolve(WORKER_SUBPATH);
    } else {
      throw new Error('import.meta.resolve unavailable');
    }
  } catch {
    const { pathToFileURL } = await import('url');
    const { resolve } = await import('path');
    workerSrc = pathToFileURL(resolve(process.cwd(), 'node_modules', ...WORKER_SUBPATH.split('/'))).href;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pdfjsLib as any).GlobalWorkerOptions.workerSrc = workerSrc;

  const pdf = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
    disableAutoFetch: true,
  }).promise;

  const page = await pdf.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(RENDER_SCALE, RENDER_MAX_LONG_SIDE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctx = canvas.getContext('2d') as any;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  page.cleanup();
  return { width: canvas.width, height: canvas.height, scale, data: img.data };
}

function darkFraction(px: PagePixels, x0: number, y0: number, x1: number, y1: number): number {
  // Coordinates are viewport-scale-1 — convert to render pixels
  const sx0 = Math.max(0, Math.round(x0 * px.scale));
  const sy0 = Math.max(0, Math.round(y0 * px.scale));
  const sx1 = Math.min(px.width - 1, Math.round(x1 * px.scale));
  const sy1 = Math.min(px.height - 1, Math.round(y1 * px.scale));
  let dark = 0;
  let n = 0;
  for (let y = sy0; y <= sy1; y += 2) {
    for (let x = sx0; x <= sx1; x += 2) {
      const i = (y * px.width + x) * 4;
      const lum = 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
      if (lum < 160) dark++;
      n++;
    }
  }
  return n === 0 ? 0 : dark / n;
}

// ---------------------------------------------------------------------------
// Structure detection helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
}

/** Cluster door-number-shaped text items into vertical columns. */
function findDoorColumns(items: PositionedTextItem[]): PositionedTextItem[][] {
  const doorish = items
    .filter(it => DOOR_TOKEN_RE.test(it.str.trim()))
    .sort((a, b) => a.x - b.x);

  const clusters: PositionedTextItem[][] = [];
  for (const it of doorish) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(it.x - last[last.length - 1].x) <= DOOR_X_CLUSTER_TOLERANCE) {
      last.push(it);
    } else {
      clusters.push([it]);
    }
  }

  return clusters.filter(cluster => {
    if (cluster.length < MIN_DOOR_ROWS) return false;
    // Door numbers are mostly unique — data columns ("45", "45", …) repeat
    const values = cluster.map(i => i.str.trim());
    const uniqueRatio = new Set(values).size / values.length;
    if (uniqueRatio < MIN_UNIQUE_RATIO) return false;
    // Must be vertically distributed, one item per row
    const ys = cluster.map(i => i.y).sort((a, b) => a - b);
    return ys[ys.length - 1] - ys[0] > cluster.length * 4;
  });
}

/** Vertical ruling lines (x centers) within a y-band of the rendered page. */
function verticalLinesInBand(px: PagePixels, yTop: number, yBottom: number, minFraction: number): number[] {
  const sy0 = Math.max(0, Math.round(yTop * px.scale));
  const sy1 = Math.min(px.height - 1, Math.round(yBottom * px.scale));
  const bandH = Math.max(1, Math.floor((sy1 - sy0) / 2));

  // Ruling lines may be light gray and thin — use a lenient luminance cutoff.
  const lines: Array<{ start: number; end: number }> = [];
  for (let x = 0; x < px.width; x++) {
    let dark = 0;
    for (let y = sy0; y <= sy1; y += 2) {
      const i = (y * px.width + x) * 4;
      const lum = 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
      if (lum < 215) dark++;
    }
    if (dark / bandH >= minFraction) {
      const last = lines[lines.length - 1];
      if (last && x - last.end <= 3) last.end = x;
      else lines.push({ start: x, end: x });
    }
  }
  // Convert back to viewport scale-1 coordinates
  return lines.map(l => (l.start + l.end) / 2 / px.scale);
}

/**
 * Horizontal ruling lines (y centers) spanning most of an x-range. Used to
 * find the table's outer top border so sheet titles above the table do not
 * leak into column headers.
 */
function horizontalLinesInRange(px: PagePixels, xLeft: number, xRight: number, yTop: number, yBottom: number): number[] {
  const sx0 = Math.max(0, Math.round(xLeft * px.scale));
  const sx1 = Math.min(px.width - 1, Math.round(xRight * px.scale));
  const sy0 = Math.max(0, Math.round(yTop * px.scale));
  const sy1 = Math.min(px.height - 1, Math.round(yBottom * px.scale));
  const spanW = Math.max(1, Math.floor((sx1 - sx0) / 2));

  const lines: Array<{ start: number; end: number }> = [];
  for (let y = sy0; y <= sy1; y++) {
    let dark = 0;
    for (let x = sx0; x <= sx1; x += 2) {
      const i = (y * px.width + x) * 4;
      const lum = 0.299 * px.data[i] + 0.587 * px.data[i + 1] + 0.114 * px.data[i + 2];
      if (lum < 160) dark++;
    }
    if (dark / spanW >= 0.7) {
      const last = lines[lines.length - 1];
      if (last && y - last.end <= 3) last.end = y;
      else lines.push({ start: y, end: y });
    }
  }
  return lines.map(l => (l.start + l.end) / 2 / px.scale);
}

/**
 * Split a sorted line sequence into groups at unusually large gaps — but only
 * when the gap region is empty whitespace. A wide COMMENTS column also makes
 * a large line gap, yet it contains text; the dead zone between two
 * side-by-side tables contains nothing.
 */
function splitLineGroups(
  lines: number[],
  bodyItems: PositionedTextItem[],
  yTop: number,
  yBottom: number,
): number[][] {
  if (lines.length < 2) return [lines];
  const gaps = lines.slice(1).map((v, i) => v - lines[i]);
  const med = median(gaps);
  const groups: number[][] = [[lines[0]]];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i] - lines[i - 1];
    if (gap > COLUMN_GAP_SPLIT_FACTOR * med) {
      const gapHasText = bodyItems.some(it =>
        it.y >= yTop && it.y <= yBottom &&
        it.x + it.width / 2 > lines[i - 1] + 2 &&
        it.x + it.width / 2 < lines[i] - 2,
      );
      if (!gapHasText) groups.push([]);
    }
    groups[groups.length - 1].push(lines[i]);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Table extraction
// ---------------------------------------------------------------------------

interface TableExtraction {
  sets: ExtractedHardwareSet[];
  itemColumns: string[];
  /** table extent in viewport coordinates — used to suppress nested false door columns */
  extent: { x0: number; x1: number; y0: number; y1: number };
}

function extractTable(
  page: PositionedPage,
  px: PagePixels,
  doorColumn: PositionedTextItem[],
  xBoundLeft: number,
  xBoundRight: number,
): TableExtraction | null {
  // Dedupe double-printed door numbers (same value at nearly the same y)
  const doors = [...doorColumn]
    .sort((a, b) => a.y - b.y)
    .filter((d, i, arr) => i === 0 || d.str.trim() !== arr[i - 1].str.trim() || Math.abs(d.y - arr[i - 1].y) > 3);
  if (doors.length < MIN_DOOR_ROWS) return null;

  const rowGaps = doors.slice(1).map((d, i) => d.y - doors[i].y);
  const rowH = median(rowGaps.filter(g => g > 2)) || 12;

  // Row bands: boundaries midway between consecutive door baselines, so a
  // cell never captures the neighbouring row's text or marks.
  const rowBounds = doors.map((d, i) => {
    const prevMid = i === 0 ? d.y - rowH * 0.7 : (doors[i - 1].y + d.y) / 2;
    const nextMid = i === doors.length - 1 ? d.y + rowH * 0.4 : (d.y + doors[i + 1].y) / 2;
    // Clamp to one row height — section-break gaps must not widen the band
    return {
      y0: Math.max(prevMid, d.y - rowH * 0.7),
      y1: Math.min(nextMid, d.y + rowH * 0.4),
    };
  });
  const rowBand = (i: number) => rowBounds[i];

  const tableTop = doors[0].y - doors[0].height;
  const tableBottom = doors[doors.length - 1].y + 2;

  // Column boundaries from vertical ruling lines spanning the door rows,
  // limited to the line group that contains the door column, and clipped to
  // the x-range this table owns (bounded by neighbouring door columns).
  // Tall tables: sectioned rules span ~50% of the band, while text columns
  // stay ≤ ~30% — a lenient fraction works. Short tables: text columns can
  // reach 40%+ of a small band, so require a stricter span.
  const lineFraction = doors.length >= 30 ? V_LINE_MIN_BAND_FRACTION : 0.6;
  const allLines = verticalLinesInBand(px, tableTop, tableBottom, lineFraction)
    .filter(x => x >= xBoundLeft && x <= xBoundRight);
  const groups = splitLineGroups(allLines, page.items, tableTop, tableBottom);
  let group = groups.find(
    g => g.length >= 2 && doors[0].x >= g[0] - 30 && doors[0].x <= g[g.length - 1],
  );
  if (group) {
    // The door column is the table's first data column. Anything more than a
    // couple of columns to its left belongs to a side-by-side table whose
    // rules leaked into this band — trim it away.
    let doorRuleIdx = 0;
    for (let i = 0; i < group.length; i++) if (group[i] <= doors[0].x) doorRuleIdx = i;
    group = group.slice(Math.max(0, doorRuleIdx - 2));
  }
  console.log(`[hardwarePdf:doorGrid] Door column "${doors[0].str.trim()}"… (${doors.length} rows): ${allLines.length} rules → ${groups.length} group(s), matched group has ${group?.length ?? 0} rules`);
  if (!group || group.length < MIN_ITEM_COLUMNS + 2) return null;

  const bodyItems = page.items.filter(it => it.y >= tableTop && it.y <= tableBottom + rowH);

  // Some tables leave a stretch of several columns unruled. Recover virtual
  // column boundaries there by clustering body-text x-starts: distinct data
  // columns anchor at distinct x positions, while wrapped free text (e.g. a
  // COMMENTS column) is left-aligned into a single cluster and stays whole.
  const medianColWidth = median(group.slice(1).map((v, i) => v - group[i]));
  const refined: number[] = [group[0]];
  for (let c = 1; c < group.length; c++) {
    const x0 = group[c - 1];
    const x1 = group[c];
    if (x1 - x0 > 3.5 * medianColWidth) {
      const inside = bodyItems
        .filter(it => it.x >= x0 + 2 && it.x + it.width <= x1 - 2)
        .sort((a, b) => a.x - b.x);
      const clusters: Array<{ minStart: number; maxEnd: number }> = [];
      for (const it of inside) {
        const last = clusters[clusters.length - 1];
        if (last && it.x - last.minStart <= 15) {
          last.maxEnd = Math.max(last.maxEnd, it.x + it.width);
        } else {
          clusters.push({ minStart: it.x, maxEnd: it.x + it.width });
        }
      }
      for (let k = 1; k < clusters.length; k++) {
        if (clusters[k].minStart > clusters[k - 1].maxEnd + 4) {
          refined.push((clusters[k - 1].maxEnd + clusters[k].minStart) / 2);
        }
      }
    }
    refined.push(x1);
  }
  group = refined.sort((a, b) => a - b);

  // Header text: items above the first door row, inside the table x-extent.
  // pdfjs may merge several adjacent column headers into ONE text item
  // ("THRESHOLD KICKPLATE WEATHERSTRIP") — explode items into words with
  // char-proportional x interpolation so each word lands in its own column.
  const xLeft = group[0];
  const xRight = group[group.length - 1];
  // Header band: from the table's outer top border (the topmost full-width
  // horizontal rule above the first door row) down to the first door row.
  let headerTop = tableTop - HEADER_BAND_MAX_ROWS * rowH;
  const topRules = horizontalLinesInRange(px, xLeft, xRight, headerTop, tableTop - 2);
  if (topRules.length > 0) headerTop = topRules[0] - 1;
  const headerWords: Array<{ str: string; xCenter: number; y: number }> = [];
  for (const it of page.items) {
    if (it.y >= tableTop - 1 || it.y <= headerTop || it.x < xLeft - 2 || it.x > xRight) continue;
    const totalChars = it.str.length || 1;
    let offset = 0;
    for (const word of it.str.split(/\s+/)) {
      if (word === '') { offset += 1; continue; }
      const start = it.str.indexOf(word, offset);
      const center = it.x + ((start + word.length / 2) / totalChars) * it.width;
      headerWords.push({ str: word, xCenter: center, y: it.y });
      offset = start + word.length;
    }
  }

  const columns: ColumnBand[] = [];
  for (let c = 0; c < group.length - 1; c++) {
    const x0 = group[c];
    const x1 = group[c + 1];
    const headerText = headerWords
      .filter(w => w.xCenter >= x0 && w.xCenter < x1)
      .sort((a, b) => a.y - b.y || a.xCenter - b.xCenter)
      .map(w => w.str)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Gather body cell values for column classification
    const values: string[] = [];
    let cellsWithText = 0;
    for (let r = 0; r < doors.length; r++) {
      const band = rowBand(r);
      const cellText = bodyItems
        .filter(it => it.x + it.width / 2 >= x0 && it.x + it.width / 2 < x1 && it.y >= band.y0 && it.y <= band.y1)
        .sort((a, b) => a.x - b.x)
        .map(it => it.str.trim())
        .join(' ')
        .trim();
      values.push(cellText);
      if (cellText !== '') cellsWithText++;
    }

    let kind: ColumnBand['kind'] = 'data';
    const nonEmpty = values.filter(v => v !== '');
    const medianValueLen = nonEmpty.length ? median(nonEmpty.map(v => v.length)) : 0;
    if (NOTES_HEADER_RE.test(headerText)) {
      kind = 'notes';
    } else if (FUNCTION_HEADER_RE.test(headerText) && medianValueLen <= 25) {
      // Length guard: an unruled stretch of several merged columns can carry
      // "FUNCTION" in its combined header — its long row texts are not codes.
      kind = 'function';
    } else {
      const yesNoCount = values.filter(v => YES_VALUES.has(v.toUpperCase()) || NO_VALUES.has(v.toUpperCase())).length;
      const hasYes = values.some(v => YES_VALUES.has(v.toUpperCase()));
      if (cellsWithText > 0 && yesNoCount / values.length >= 0.8 && hasYes) {
        kind = 'yesno';
      } else if (cellsWithText / values.length < 0.1 && headerText !== '') {
        // No text in cells — candidate graphical checkbox column. Confirm by
        // finding at least one cell with a dark mark.
        const anyMark = doors.some((_, r) => {
          const band = rowBand(r);
          const cx0 = x0 + (x1 - x0) * 0.25;
          const cx1 = x1 - (x1 - x0) * 0.25;
          return darkFraction(px, cx0, band.y0, cx1, band.y1) >= MARK_DARK_THRESHOLD;
        });
        if (anyMark) kind = 'checkbox';
      }
    }

    columns.push({ x0, x1, header: headerText, kind });
  }

  if (process.env.DOORGRID_DEBUG) {
    console.log(`[doorGrid:debug] table "${doors[0].str.trim()}" doors: ${doors.slice(0, 12).map((d, r) => `${d.str.trim()}@y${Math.round(d.y)}[${Math.round(rowBand(r).y0)}-${Math.round(rowBand(r).y1)}]`).join(' ')}`);
    const cbCols = columns.filter(c => c.kind === 'checkbox');
    for (const d of doors.slice(0, 6).map((_, r) => r)) {
      const band = rowBand(d);
      const fracs = cbCols.map(c => {
        const cx0 = c.x0 + (c.x1 - c.x0) * 0.25;
        const cx1 = c.x1 - (c.x1 - c.x0) * 0.25;
        return darkFraction(px, cx0, band.y0, cx1, band.y1).toFixed(2);
      });
      console.log(`    ${doors[d].str.trim()}: ${fracs.join(' ')}`);
    }
    console.log(`[doorGrid:debug] table "${doors[0].str.trim()}" columns:`);
    columns.forEach((c, i) => {
      const samples = doors.slice(0, 8).map((_, r) => {
        const band = rowBand(r);
        return bodyItems
          .filter(it => it.x + it.width / 2 >= c.x0 && it.x + it.width / 2 < c.x1 && it.y >= band.y0 && it.y <= band.y1)
          .map(it => it.str.trim()).join(' ').trim() || '·';
      });
      console.log(`    ${i}: [${c.kind}] "${c.header.slice(0, 40)}" x ${Math.round(c.x0)}-${Math.round(c.x1)} vals: ${samples.join(',')}`);
    });
  }

  // Hardware item columns: yes/no or checkbox columns with hardware-vocabulary headers
  const itemColumns = columns.filter(
    col => (col.kind === 'yesno' || col.kind === 'checkbox') && HARDWARE_HEADER_RE.test(col.header),
  );
  const skipped = columns.filter(
    col => (col.kind === 'yesno' || col.kind === 'checkbox') && !HARDWARE_HEADER_RE.test(col.header),
  );
  if (skipped.length > 0) {
    console.log(`[hardwarePdf:doorGrid] Skipping non-hardware indicator column(s): ${skipped.map(c => `"${c.header}"`).join(', ')}`);
  }
  if (itemColumns.length < MIN_ITEM_COLUMNS) return null;

  const functionColumns = columns.filter(col => col.kind === 'function');
  const notesColumns = columns.filter(col => col.kind === 'notes');

  // Build one set per door row
  const sets: ExtractedHardwareSet[] = [];
  for (let r = 0; r < doors.length; r++) {
    const d = doors[r];
    const band = rowBand(r);
    const items: ExtractedHardwareSet['hardwareItems'] = [];

    const cellText = (col: ColumnBand) => bodyItems
      .filter(it => it.x + it.width / 2 >= col.x0 && it.x + it.width / 2 < col.x1 && it.y >= band.y0 && it.y <= band.y1)
      .sort((a, b) => a.x - b.x)
      .map(it => it.str.trim())
      .join(' ')
      .trim();

    // Function/lock codes — each comma-separated value is an item
    for (const col of functionColumns) {
      for (const code of cellText(col).split(/[,/]+/).map(s => s.trim()).filter(Boolean)) {
        if (NO_VALUES.has(code.toUpperCase())) continue;
        items.push({ qty: 1, item: code, manufacturer: '', description: col.header, finish: '' });
      }
    }

    // Indicator columns
    for (const col of itemColumns) {
      let included = false;
      if (col.kind === 'yesno') {
        included = YES_VALUES.has(cellText(col).toUpperCase());
      } else {
        const cx0 = col.x0 + (col.x1 - col.x0) * 0.25;
        const cx1 = col.x1 - (col.x1 - col.x0) * 0.25;
        included = darkFraction(px, cx0, band.y0, cx1, band.y1) >= MARK_DARK_THRESHOLD;
      }
      if (included) {
        items.push({ qty: 1, item: col.header, manufacturer: '', description: '', finish: '' });
      }
    }

    const notes = notesColumns.map(cellText).filter(Boolean).join(' | ');

    sets.push({ setName: d.str.trim(), notes, hardwareItems: items });
  }

  return {
    sets,
    itemColumns: itemColumns.map(c => c.header),
    extent: { x0: xLeft, x1: xRight, y0: tableTop, y1: tableBottom },
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Attempt deterministic extraction of per-door mark-grid schedules.
 *
 * @returns null when no qualifying table exists in the document — the caller
 *          proceeds with the normal extraction tiers.
 */
export async function extractDoorScheduleGrid(buffer: Buffer): Promise<DoorScheduleGridResult | null> {
  const pages = await extractPositionedText(buffer);

  const allSets = new Map<string, ExtractedHardwareSet>();
  const tables: DoorScheduleGridResult['tables'] = [];

  for (const page of pages) {
    const doorColumns = findDoorColumns(page.items);
    if (doorColumns.length === 0) continue;

    // Render the page once, lazily, shared by all tables on it
    let px: PagePixels | null = null;
    const extractedExtents: Array<{ x0: number; x1: number; y0: number; y1: number }> = [];

    const clusterSpan = (c: PositionedTextItem[]) => {
      const ys = c.map(i => i.y);
      return { y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    const yOverlaps = (a: { y0: number; y1: number }, b: { y0: number; y1: number }) =>
      Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0) > 0.3 * Math.min(a.y1 - a.y0, b.y1 - b.y0);

    for (const doorColumn of doorColumns) {
      const x = doorColumn[0].x;
      const span = clusterSpan(doorColumn);

      // A column nested inside an already-extracted table (e.g. a ROOM-number
      // column that also looks door-numberish) is not a new table.
      if (extractedExtents.some(e => x > e.x0 + 1 && x < e.x1 - 1 && yOverlaps(span, e))) {
        continue;
      }

      if (!px) px = await renderPagePixels(buffer, page.pageNumber);

      // A table's x-range is bounded by the neighbouring door columns: a
      // side-by-side table's region must never be read as this table's cells.
      // Only clusters that overlap vertically count — a type legend elsewhere
      // on the sheet is not a border. Clusters within the same table (e.g. a
      // section-label column right next to the door column) are not borders.
      const NEIGHBOR_MIN_DISTANCE = 150;
      const neighborXs = doorColumns
        .filter(c => c !== doorColumn && yOverlaps(clusterSpan(c), span))
        .map(c => c[0].x);
      const leftNeighbors = neighborXs.filter(v => v < x - NEIGHBOR_MIN_DISTANCE);
      const rightNeighbors = neighborXs.filter(v => v > x + NEIGHBOR_MIN_DISTANCE);
      const xBoundLeft = leftNeighbors.length ? Math.max(...leftNeighbors) + 1 : 0;
      const xBoundRight = rightNeighbors.length ? Math.min(...rightNeighbors) - 2 : page.pageWidth;

      let extraction: TableExtraction | null = null;
      try {
        extraction = extractTable(page, px, doorColumn, xBoundLeft, xBoundRight);
      } catch (err) {
        console.warn('[hardwarePdf:doorGrid] Table extraction failed (continuing):', err);
      }
      if (!extraction) continue;
      extractedExtents.push(extraction.extent);

      tables.push({ doorCount: extraction.sets.length, itemColumns: extraction.itemColumns, page: page.pageNumber });
      for (const set of extraction.sets) {
        const key = set.setName.toLowerCase();
        const existing = allSets.get(key);
        if (existing) {
          existing.hardwareItems.push(...set.hardwareItems);
          if (set.notes && !existing.notes) existing.notes = set.notes;
        } else {
          allSets.set(key, set);
        }
      }
    }
  }

  if (tables.length === 0) return null;

  const sets = Array.from(allSets.values());
  const itemCount = sets.reduce((sum, s) => sum + s.hardwareItems.length, 0);
  if (sets.length < MIN_DOOR_ROWS || itemCount === 0) return null;

  return { sets, tableCount: tables.length, tables };
}
