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
    console.error(`${prefix} JSON.parse failed: ${e instanceof Error ? e.message : e}. First 500 chars: ${text.slice(0, 500)}`);
    return { sets: [], parseWarning: 'AI response was not valid JSON. No sets extracted.' };
  }
}
