/**
 * Deterministic checkbox-grid analyzer for matrix-format hardware schedules.
 *
 * Matrix schedules (door numbers as columns, item names as rows, checkboxes
 * in the grid body) cannot be transcribed reliably by vision models — they
 * lose column alignment across 20+ columns and start inferring patterns
 * instead of reading them. But these grids are machine-generated and
 * perfectly regular, so the checkbox STATES can be read deterministically
 * from pixels: detect the table's grid lines, then measure the gray-fill
 * fraction at the center of each cell.
 *
 * The AI transcription remains responsible for everything that needs OCR
 * (door numbers, row labels, lockset codes, product legend); this module
 * only answers "which cells are checked" with pixel-level certainty.
 *
 * Server-side only. Never import from client components.
 */

export type MatrixCellState = 'checked' | 'unchecked' | 'text' | 'none';

export interface MatrixGridRow {
  /** 'value' = cells hold printed text (e.g. lockset codes); 'checkbox' = cells are checkboxes */
  type: 'value' | 'checkbox' | 'unknown';
  /** One state per door column, left to right */
  cells: MatrixCellState[];
}

export interface MatrixGridAnalysis {
  doorColumnCount: number;
  rows: MatrixGridRow[];
  /**
   * Pixel geometry of the analyzed image — lets callers crop row strips
   * (e.g. a value row plus the door-number header) for focused re-reading.
   */
  geometry: {
    imageWidth: number;
    imageHeight: number;
    /** y-range of the column-header band (door numbers) above the first item row */
    headerBand: { y0: number; y1: number };
    /** y-range of each item row, same order as `rows` */
    rowBands: Array<{ y0: number; y1: number }>;
  };
}

// ---------------------------------------------------------------------------
// Tuning constants
//
// Fractions are scale-free (measured per sampled pixel), so the analyzer is
// independent of render resolution. Calibrated against real matrix sheets:
//   checked cell  → gray-fill fraction ≈ 1.00 (shaded box fills the cell)
//   unchecked box → gray-fill fraction ≈ 0.22 (outline only), dark ≈ 0.00
//   value text    → dark fraction ≈ 0.12 (printed code), gray ≈ 0.10
//   empty/none    → both fractions ≈ 0
// ---------------------------------------------------------------------------

const H_LINE_MIN_DARK_FRACTION = 0.4;   // fraction of a pixel row that must be dark to count as a horizontal rule
const V_LINE_MIN_DARK_FRACTION = 0.25;  // vertical rules are shorter relative to image height
const LINE_MERGE_GAP_PX = 3;            // dark rows/cols closer than this are one rule
const DARK_LUMINANCE = 128;             // rule detection threshold
const CELL_GRAY_MIN = 100;              // gray-fill band (shaded checkbox interior)
const CELL_GRAY_MAX = 240;
const CELL_DARK_MAX = 100;              // printed text / check glyph
const CHECKED_MIN_GRAY_FRACTION = 0.5;
const TEXT_MIN_DARK_FRACTION = 0.05;
const UNCHECKED_MIN_GRAY_FRACTION = 0.07; // box outline only — a truly empty cell measures ≈ 0
const MIN_DOOR_COLUMNS = 4;             // below this it is not a matrix schedule
const MIN_ITEM_ROWS = 5;
const MIN_CHECKBOX_ROWS = 3;
const UNIFORM_TOLERANCE = 0.25;         // gap uniformity tolerance (fraction of median)

// ---------------------------------------------------------------------------
// Line detection helpers
// ---------------------------------------------------------------------------

/** Centers of maximal runs of consecutive dark rows/columns. */
function detectLines(darkFractions: number[], minFraction: number): number[] {
  const lines: Array<{ start: number; end: number }> = [];
  for (let i = 0; i < darkFractions.length; i++) {
    if (darkFractions[i] < minFraction) continue;
    const last = lines[lines.length - 1];
    if (last && i - last.end <= LINE_MERGE_GAP_PX) last.end = i;
    else lines.push({ start: i, end: i });
  }
  return lines.map(l => Math.round((l.start + l.end) / 2));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Longest run of consecutive lines whose gaps are uniform (within tolerance
 * of the overall median gap). Returns the line positions of that run.
 */
function longestUniformRun(lines: number[]): number[] {
  if (lines.length < 2) return [];
  const gaps = lines.slice(1).map((v, i) => v - lines[i]);
  const med = median(gaps);
  let best: { start: number; end: number } = { start: 0, end: 0 };
  let runStart = 0;
  for (let i = 0; i <= gaps.length; i++) {
    const uniform = i < gaps.length && Math.abs(gaps[i] - med) <= UNIFORM_TOLERANCE * med;
    if (!uniform) {
      if (i - runStart > best.end - best.start) best = { start: runStart, end: i };
      runStart = i + 1;
    }
  }
  return lines.slice(best.start, best.end + 1);
}

/**
 * Repair missing rules: a gap that is ~2× or ~3× the median gap gets
 * intermediate lines inserted (drawing programs sometimes skip a rule where
 * other graphics overlap it).
 */
function interpolateMissingLines(lines: number[]): number[] {
  if (lines.length < 3) return lines;
  const gaps = lines.slice(1).map((v, i) => v - lines[i]);
  const med = median(gaps);
  const repaired: number[] = [lines[0]];
  for (let i = 1; i < lines.length; i++) {
    const gap = lines[i] - lines[i - 1];
    for (const k of [2, 3]) {
      if (Math.abs(gap - k * med) <= UNIFORM_TOLERANCE * med) {
        for (let j = 1; j < k; j++) {
          repaired.push(Math.round(lines[i - 1] + (gap * j) / k));
        }
        break;
      }
    }
    repaired.push(lines[i]);
  }
  return repaired;
}

// ---------------------------------------------------------------------------
// Row-strip cropper
// ---------------------------------------------------------------------------

/**
 * Crop one item row out of the matrix image, stacked under the door-number
 * header band, as a standalone PNG. Reading a single row paired with its
 * column headers is a far easier task for a vision model than keeping
 * alignment inside the full grid.
 *
 * @returns Base64-encoded PNG strip (header band + the requested row).
 */
export async function cropRowStrip(
  pngBase64: string,
  geometry: MatrixGridAnalysis['geometry'],
  rowIndex: number,
): Promise<string> {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');

  const band = geometry.rowBands[rowIndex];
  if (!band) throw new Error(`Row index ${rowIndex} out of range (${geometry.rowBands.length} rows).`);

  const img = await loadImage(Buffer.from(pngBase64, 'base64'));
  const W = geometry.imageWidth;
  const headerH = geometry.headerBand.y1 - geometry.headerBand.y0;
  const rowH = band.y1 - band.y0;

  const canvas = createCanvas(W, headerH + rowH);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, geometry.headerBand.y0, W, headerH, 0, 0, W, headerH);
  ctx.drawImage(img, 0, band.y0, W, rowH, 0, headerH, W, rowH);
  return canvas.toBuffer('image/png').toString('base64');
}

// ---------------------------------------------------------------------------
// Main analyzer
// ---------------------------------------------------------------------------

/**
 * Analyze a rendered table image for a checkbox matrix grid.
 *
 * @param pngBase64  Base64-encoded PNG (e.g. a close-up from
 *                   renderEmbeddedImageCloseups)
 * @returns          Cell states per item row × door column, or null when the
 *                   image does not contain a recognizable checkbox matrix.
 */
export async function analyzeCheckboxGrid(pngBase64: string): Promise<MatrixGridAnalysis | null> {
  const { loadImage, createCanvas } = await import('@napi-rs/canvas');

  const img = await loadImage(Buffer.from(pngBase64, 'base64'));
  const W = img.width;
  const H = img.height;
  if (W < 100 || H < 100) return null;

  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, W, H);

  const luminance = (x: number, y: number): number => {
    const i = (y * W + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  // ── Grid line detection via projection profiles ──────────────────────────
  const rowDarkFraction = new Array<number>(H);
  for (let y = 0; y < H; y++) {
    let dark = 0;
    let n = 0;
    for (let x = 0; x < W; x += 2) {
      if (luminance(x, y) < DARK_LUMINANCE) dark++;
      n++;
    }
    rowDarkFraction[y] = dark / n;
  }
  const colDarkFraction = new Array<number>(W);
  for (let x = 0; x < W; x++) {
    let dark = 0;
    let n = 0;
    for (let y = 0; y < H; y += 2) {
      if (luminance(x, y) < DARK_LUMINANCE) dark++;
      n++;
    }
    colDarkFraction[x] = dark / n;
  }

  const hLines = interpolateMissingLines(detectLines(rowDarkFraction, H_LINE_MIN_DARK_FRACTION));
  const vLines = detectLines(colDarkFraction, V_LINE_MIN_DARK_FRACTION);

  // ── Identify door columns and item rows as uniform-spacing runs ──────────
  // Door columns: many equal-width narrow columns (the wide label column on
  // the left falls outside the uniform run). Item rows: many equal-height
  // rows (title and header rows above are taller and fall outside).
  const doorColLines = longestUniformRun(vLines);
  const itemRowLines = longestUniformRun(hLines);

  if (doorColLines.length - 1 < MIN_DOOR_COLUMNS) return null;
  if (itemRowLines.length - 1 < MIN_ITEM_ROWS) return null;

  // ── Classify each cell by its central pixel statistics ───────────────────
  const classifyCell = (xc: number, yc: number, cw: number, ch: number): MatrixCellState => {
    // Central 50% of the cell — wide enough to cover the checkbox glyph,
    // tight enough that its outline is not diluted by surrounding whitespace.
    const rx = Math.max(2, Math.round(cw * 0.25));
    const ry = Math.max(2, Math.round(ch * 0.25));
    const step = Math.max(1, Math.floor(Math.min(cw, ch) / 25));
    let gray = 0;
    let dark = 0;
    let n = 0;
    for (let dy = -ry; dy <= ry; dy += step) {
      for (let dx = -rx; dx <= rx; dx += step) {
        const x = Math.min(W - 1, Math.max(0, xc + dx));
        const y = Math.min(H - 1, Math.max(0, yc + dy));
        const l = luminance(x, y);
        if (l <= CELL_DARK_MAX) dark++;
        else if (l > CELL_GRAY_MIN && l < CELL_GRAY_MAX) gray++;
        n++;
      }
    }
    const grayFraction = gray / n;
    const darkFraction = dark / n;
    if (grayFraction > CHECKED_MIN_GRAY_FRACTION) return 'checked';
    if (darkFraction > TEXT_MIN_DARK_FRACTION) return 'text';
    if (grayFraction > UNCHECKED_MIN_GRAY_FRACTION) return 'unchecked';
    return 'none';
  };

  const rows: MatrixGridRow[] = [];
  for (let r = 0; r < itemRowLines.length - 1; r++) {
    const yc = Math.round((itemRowLines[r] + itemRowLines[r + 1]) / 2);
    const ch = itemRowLines[r + 1] - itemRowLines[r];
    const cells: MatrixCellState[] = [];
    for (let c = 0; c < doorColLines.length - 1; c++) {
      const xc = Math.round((doorColLines[c] + doorColLines[c + 1]) / 2);
      const cw = doorColLines[c + 1] - doorColLines[c];
      cells.push(classifyCell(xc, yc, cw, ch));
    }

    const textCount = cells.filter(s => s === 'text').length;
    const boxCount = cells.filter(s => s === 'checked' || s === 'unchecked').length;
    let type: MatrixGridRow['type'] = 'unknown';
    if (textCount >= cells.length * 0.3) type = 'value';
    else if (boxCount >= cells.length * 0.5) type = 'checkbox';
    rows.push({ type, cells });
  }

  // A real matrix schedule has several checkbox rows — otherwise this image
  // is some other kind of table and the caller should ignore the analysis.
  const checkboxRowCount = rows.filter(r => r.type === 'checkbox').length;
  if (checkboxRowCount < MIN_CHECKBOX_ROWS) return null;

  // Header band: the region holding the door-number column headers, i.e.
  // from the nearest substantial rule above the first item row. Rules closer
  // than ~80% of a row height are double-line artifacts — skip those.
  const rowHeight = median(itemRowLines.slice(1).map((v, i) => v - itemRowLines[i]));
  const headerY1 = itemRowLines[0];
  let headerY0 = Math.max(0, Math.round(headerY1 - 2 * rowHeight));
  for (const y of hLines) {
    if (y <= headerY1 - 0.8 * rowHeight && y > headerY0) headerY0 = y;
  }

  return {
    doorColumnCount: doorColLines.length - 1,
    rows,
    geometry: {
      imageWidth: W,
      imageHeight: H,
      headerBand: { y0: headerY0, y1: headerY1 },
      rowBands: rows.map((_, r) => ({ y0: itemRowLines[r], y1: itemRowLines[r + 1] })),
    },
  };
}
