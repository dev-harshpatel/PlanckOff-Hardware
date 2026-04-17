/**
 * Server-side PDF hardware extraction service.
 * Extracts text from the PDF, sends batches to AI, merges results.
 * Never import from client components.
 */

import { generateText, type GenerateOptions } from '@/lib/ai/generate';
import type { ExtractedHardwareSet, HardwareItem } from '@/lib/db/hardware';

// Page texts are extracted client-side (pdfjs runs in the browser).
// This service receives those texts and runs AI extraction server-side.

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a precise construction document parser specializing in Division 08 door hardware schedules. Your only job is to extract structured hardware set data from architectural hardware specification PDFs.

OUTPUT RULES (strictly follow these):
- Respond ONLY with a valid JSON array. No explanation, no markdown, no code fences, no preamble.
- If a field is not present, use an empty string "".
- Preserve finish codes exactly as written (e.g. 626, 628, 630, 689, CA, C).
- If "By Others" appears in the description, keep it in the description field as-is.
- Do not merge or split hardware sets — one object per hardware set, exactly as it appears.
- qty must always be a number (integer). If not explicitly stated, use 1.
- Capture ALL hardware items in every set, including items marked "By Others".

JSON SCHEMA TO OUTPUT:
[
  {
    "setName": "AD01b",
    "hardwareItems": [
      {
        "qty": 2,
        "item": "Continuous Hinge",
        "manufacturer": "McKinney",
        "description": "FM-HD1-SER12 x length",
        "finish": "CA"
      }
    ],
    "notes": ""
  }
]

PARSING RULES:
1. Each hardware set starts with "Hardware Set XXXX" — treat this as the setName.
2. Each line within a set follows the pattern: [qty] Ea. [item] [manufacturer] [description] [finish]
3. The finish code is the LAST token on the line IF it is a standard hardware finish code. Known finish codes: CA, C, 626, 628, 630, 652, 683, 689, 627. If the last token is not a finish code, set finish to "".
4. The item name is the category label (e.g. "Cont. Hinge", "Exit Device", "Cylinder", "Lock Set", "Closer", "Kick Plate", "Gasket", "Actuator", "Card Reader", "DPS", "Power Supply", "Battery", "Operator", "Sensor", "Connector", "Keyswitch", "Pushbutton", "Wave Plate", "Threshold", "Door Bottom", "Armor Plate", "Passage Set", "Flush Bolt", "Hanger", "Track", "Stop", "Floor Guide", "Channel", "Fascia", "End Cap", "Wall Strike", "Annunciator", "Key Switch", "Ball Contact", "Trans. Cable", "Controller", "Latch. Relay", "Smoke Seal", "Thermal Pin", "Rdr./Keypad", "Rem. Release", "Meeting Stile", "Mtg. Stile", "Door Edge", "Stretch. Plate", "W/F Stop", "Hinges", "T/F Hinge", "Mort. Cyl.", "Push/Pull", "Ind. Lock Set").
5. Notes sections (lines starting with "Note:") are NOT hardware items — capture the full note text (all continuation lines) into the "notes" field of the current hardware set. If multiple notes exist, join them with a space.
6. Lines with "NOTE#1" or "NOTE#2" in the Door Index table are door assignments, not hardware items — ignore them entirely. Also ignore the entire Door Index table at the top of the document.
7. "Pr." means pair — treat it the same as "Ea." and use the numeric qty.
8. "Len" or "Length" means a single length — treat as qty 1 unless a number precedes it.
9. "1 Set" = qty 1.
10. For items in any of these forms: "Pr. Mtg. Stile", "1 Pr. Meeting Stile", "1 Set Mtg. Stile", "1 Set Meeting Stile" — parse as: qty=1, item="Meeting Stile", use manufacturer and description from the same line.
11. Lines that say only "Hinges Existing", "Lock Set Existing", "Cylinder Existing" should be parsed as: qty=1, item=[the item type], manufacturer="", description="Existing", finish="".
12. If a line has NO qty prefix and the second token is "Existing" (e.g. "    Hinges    Existing"), parse as: qty=1, item=[first token], manufacturer="", description="Existing", finish="".
13. If a description appears to be cut off at the end of a line and the next line begins with a continuation of that description (no qty, no item keyword at the start), join the continuation to the previous item's description.

EXTRACT ALL hardware sets found in the document. Do not skip any.`;

const USER_PROMPT = `Parse all hardware sets from the following door hardware schedule text. Return only the JSON array as described. Do not include any explanation or text outside the JSON.\n\n`;

// ---------------------------------------------------------------------------
// Batch page texts into groups for AI processing
// ---------------------------------------------------------------------------

interface PageBatch {
  text: string;
  startPage: number;
  endPage: number;
  totalPages: number;
}

function batchPageTexts(pages: string[], batchSize = 10): PageBatch[] {
  const batches: PageBatch[] = [];
  for (let i = 0; i < pages.length; i += batchSize) {
    const slice = pages.slice(i, i + batchSize);
    batches.push({
      text: slice.join('\n\n'),
      startPage: i + 1,
      endPage: Math.min(i + batchSize, pages.length),
      totalPages: pages.length,
    });
  }
  return batches;
}

// ---------------------------------------------------------------------------
// JSON parsing — handles AI responses that may include markdown fences
// ---------------------------------------------------------------------------

function parseAIResponse(raw: string): ExtractedHardwareSet[] {
  let text = raw.trim();

  // Strip markdown code fences if present
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) text = fenceMatch[1].trim();

  // Find the JSON array boundaries
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) return [];

  text = text.slice(start, end + 1);

  try {
    const parsed = JSON.parse(text) as unknown[];
    return parsed.filter(isValidHardwareSet).map(normaliseSet);
  } catch {
    return [];
  }
}

function isValidHardwareSet(item: unknown): item is Record<string, unknown> {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).setName === 'string' &&
    (item as Record<string, unknown>).setName !== ''
  );
}

function normaliseSet(raw: Record<string, unknown>): ExtractedHardwareSet {
  return {
    setName: String(raw.setName ?? '').trim(),
    notes: String(raw.notes ?? '').trim(),
    hardwareItems: Array.isArray(raw.hardwareItems)
      ? raw.hardwareItems.map(normaliseItem)
      : [],
  };
}

function normaliseItem(raw: unknown): HardwareItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    qty: typeof r.qty === 'number' ? r.qty : parseInt(String(r.qty ?? '1'), 10) || 1,
    item: String(r.item ?? '').trim(),
    manufacturer: String(r.manufacturer ?? '').trim(),
    description: String(r.description ?? '').trim(),
    finish: String(r.finish ?? '').trim(),
  };
}

// ---------------------------------------------------------------------------
// Merge results across batches
// Sets split across batch boundaries are merged by setName.
// ---------------------------------------------------------------------------

function mergeBatchResults(batches: ExtractedHardwareSet[][]): ExtractedHardwareSet[] {
  const setMap = new Map<string, ExtractedHardwareSet>();

  for (const batch of batches) {
    for (const set of batch) {
      const key = set.setName.toLowerCase();
      const existing = setMap.get(key);
      if (existing) {
        // Merge items — a set can span two page batches
        existing.hardwareItems.push(...set.hardwareItems);
        if (set.notes && !existing.notes) existing.notes = set.notes;
      } else {
        setMap.set(key, { ...set, hardwareItems: [...set.hardwareItems] });
      }
    }
  }

  return Array.from(setMap.values());
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface HardwarePdfResult {
  sets: ExtractedHardwareSet[];
  pageCount: number;
  setCount: number;
  itemCount: number;
  warnings: string[];
}

/**
 * Extract hardware sets from pre-extracted page texts.
 * @param pages  Array of text strings, one per PDF page (extracted client-side with pdfjs).
 */
export async function extractHardwareSetsFromPdf(
  pages: string[],
  aiOptions?: GenerateOptions,
): Promise<HardwarePdfResult> {
  const warnings: string[] = [];

  if (pages.length === 0) {
    throw new Error('No page text provided.');
  }

  const pageCount = pages.length;
  const batches = batchPageTexts(pages);

  // 2. Send each batch to AI and collect structured results
  const batchResults: ExtractedHardwareSet[][] = [];

  for (const batch of batches) {
    if (!batch.text.trim()) continue;

    try {
      const raw = await generateText(
        SYSTEM_PROMPT,
        USER_PROMPT + batch.text,
        { provider: 'openrouter', model: 'google/gemini-2.5-flash', temperature: 0.1, ...aiOptions },
      );
      const parsed = parseAIResponse(raw);
      if (parsed.length > 0) batchResults.push(parsed);
    } catch (err) {
      warnings.push(
        `Pages ${batch.startPage}–${batch.endPage}: AI extraction failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // 3. Merge across batches
  const sets = mergeBatchResults(batchResults);
  const itemCount = sets.reduce((sum, s) => sum + s.hardwareItems.length, 0);

  return { sets, pageCount, setCount: sets.length, itemCount, warnings };
}
