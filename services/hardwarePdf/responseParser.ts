/**
 * Normalizers and parser for the AI's hardware-set responses.
 */

import type { ExtractedHardwareSet, HardwareItem } from '@/lib/db/hardware';
import { sanitizeText } from '@/lib/db/masterHardware';

function normalizeItem(raw: unknown): HardwareItem {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    qty: typeof r.qty === 'number' ? Math.round(r.qty) : parseInt(String(r.qty ?? '1'), 10) || 1,
    item: sanitizeText(String(r.item ?? '')),
    manufacturer: sanitizeText(String(r.manufacturer ?? '')),
    description: sanitizeText(String(r.description ?? '')),
    finish: sanitizeText(String(r.finish ?? '')),
  };
}

function normalizeSet(raw: Record<string, unknown>): ExtractedHardwareSet {
  let setName = String(raw.setName ?? '').trim();
  // Strip column-header prefixes the AI may include when reading "SET | DOOR TYPE" tables.
  // e.g. "SET DOOR TYPE 1" → "1", "SET 2" → "2"
  setName = setName.replace(/^SET\s+DOOR\s+TYPE\s+/i, '').replace(/^SET\s+/i, '').trim();
  // PDF text extraction splits "H-1A" into "H - 1A" (separate glyphs with spacing).
  // Normalize back: collapse word-char SPACE-HYPHEN-SPACE word-char → word-char-HYPHEN-word-char.
  setName = setName.replace(/(\w)\s+-\s+(\w)/g, '$1-$2');
  return {
    setName,
    notes: String(raw.notes ?? '').trim(),
    hardwareItems: Array.isArray(raw.hardwareItems)
      ? raw.hardwareItems.map(normalizeItem)
      : [],
  };
}

function isValidSet(item: unknown): item is Record<string, unknown> {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).setName === 'string' &&
    String((item as Record<string, unknown>).setName).trim() !== ''
  );
}

/**
 * Walk a JSON string character-by-character and collect every complete top-level
 * object from inside a `"sets": [...]` array, stopping when the array ends or
 * the string is truncated. Used as a fallback when the full JSON.parse fails
 * because the AI response was cut off mid-stream at the max_tokens limit.
 *
 * Returns an array of parsed set objects (may be empty), or null if the string
 * doesn't have the expected `{ "sets": [` structure at all.
 */
function recoverPartialSets(text: string): unknown[] | null {
  // Locate the sets array opening bracket
  const setsKeyIdx = text.search(/"sets"\s*:/);
  if (setsKeyIdx === -1) return null;
  const arrStart = text.indexOf('[', setsKeyIdx);
  if (arrStart === -1) return null;

  const recovered: unknown[] = [];
  let i = arrStart + 1;

  while (i < text.length) {
    // Skip whitespace and commas between objects
    while (i < text.length && /[\s,]/.test(text[i])) i++;
    if (i >= text.length || text[i] === ']') break;
    if (text[i] !== '{') break;

    // Walk forward counting brace depth to find the end of this object
    let depth = 0;
    let inStr = false;
    let esc = false;
    let j = i;

    for (; j < text.length; j++) {
      const ch = text[j];
      if (esc)          { esc = false; continue; }
      if (ch === '\\' && inStr) { esc = true; continue; }
      if (ch === '"')   { inStr = !inStr; continue; }
      if (inStr)        continue;
      if (ch === '{' || ch === '[') depth++;
      if (ch === '}' || ch === ']') {
        depth--;
        if (depth === 0) {
          // This object is complete — try to parse it
          try {
            recovered.push(JSON.parse(text.slice(i, j + 1)));
          } catch {
            // Malformed individual object — skip it
          }
          i = j + 1;
          break;
        }
      }
    }

    // j reached the end of the string without closing the object → truncated
    if (j >= text.length) break;
  }

  return recovered;
}

export function parseResponse(raw: string, label = ''): { sets: ExtractedHardwareSet[]; parseWarning?: string } {
  let text = raw.trim();
  const prefix = label ? `[hardwarePdf:parse${label}]` : '[hardwarePdf:parse]';

  console.log(`${prefix} raw length=${raw.length} chars, first 200: ${raw.slice(0, 200).replace(/\n/g, '\\n')}`);

  // Strip markdown fences if model ignored the json_schema instruction
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    console.log(`${prefix} stripped markdown fence`);
    text = fenceMatch[1].trim();
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    // Unwrap { sets: [...] } envelope (expected shape)
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as Record<string, unknown>).sets)
    ) {
      const sets = ((parsed as Record<string, unknown>).sets as unknown[])
        .filter(isValidSet)
        .map(normalizeSet);
      console.log(`${prefix} parsed OK — ${sets.length} sets`);
      return { sets };
    }

    // Fallback: model returned a bare array
    if (Array.isArray(parsed)) {
      const sets = (parsed as unknown[]).filter(isValidSet).map(normalizeSet);
      console.log(`${prefix} bare array fallback — ${sets.length} sets`);
      return { sets, parseWarning: 'Model returned bare array instead of { sets: [] } — still parsed.' };
    }

    console.warn(`${prefix} unexpected structure — keys: ${Object.keys(parsed as object).join(', ')}`);
    return { sets: [], parseWarning: 'AI response was valid JSON but had unexpected structure.' };
  } catch (e) {
    const errMsg = e instanceof Error ? e.message : String(e);
    console.error(`${prefix} JSON.parse failed: ${errMsg}. First 500 chars: ${text.slice(0, 500)}`);

    // The response is likely truncated at the max_tokens limit. Walk the partial
    // JSON to recover all complete set objects before the cut-off point.
    const partial = recoverPartialSets(text);
    if (partial !== null && partial.length > 0) {
      const sets = partial.filter(isValidSet).map(normalizeSet);
      if (sets.length > 0) {
        console.warn(`${prefix} recovered ${sets.length} complete set(s) from truncated response`);
        return { sets, parseWarning: `AI response was truncated (token limit). Recovered ${sets.length} complete set(s).` };
      }
    }

    return { sets: [], parseWarning: 'AI response was not valid JSON and could not be recovered. No sets extracted.' };
  }
}
