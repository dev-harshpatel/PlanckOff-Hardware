/**
 * Client-safe hardware set matching — mirrors the strategy in services/mergeService.ts.
 *
 * Matching order (first match wins):
 *   1. Exact case-insensitive         "CA01"  === "ca01"
 *   2. Numeric equivalence            "7"     === "007"
 *   3. Prefix (strip trailing chars)  "AD05e" → "AD05"  (only if unambiguous)
 */

import type { HardwareSet } from '../types';

function normalize(code: string): string {
  return code.trim().toLowerCase();
}

function baseName(code: string): string {
  return normalize(code).split('.')[0];
}

function prefixName(code: string): string {
  return baseName(code).replace(/[a-z]+$/, '');
}

export interface MatchResult {
  set: HardwareSet;
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

/**
 * Match a single provided set name against the available hardware sets.
 * Returns null if no match is found.
 */
export function matchHardwareSet(
  providedName: string,
  hardwareSets: HardwareSet[],
): MatchResult | null {
  if (!providedName?.trim()) return null;

  // Build lookup indexes once
  const setIndex = new Map<string, HardwareSet>(
    hardwareSets.map((s) => [normalize(s.name), s]),
  );

  const prefixIndex = new Map<string, HardwareSet[]>();
  for (const s of hardwareSets) {
    const p = prefixName(s.name);
    if (!prefixIndex.has(p)) prefixIndex.set(p, []);
    prefixIndex.get(p)!.push(s);
  }

  // 1. Exact case-insensitive
  const exact = setIndex.get(normalize(providedName));
  if (exact) return { set: exact, confidence: 'high', reason: 'Exact Match' };

  // 2. Numeric equivalence ("7" matches "007")
  const n = parseInt(providedName.trim(), 10);
  if (!isNaN(n)) {
    for (const [normKey, set] of setIndex) {
      if (parseInt(normKey, 10) === n) {
        return { set, confidence: 'high', reason: 'Numeric Match' };
      }
    }
  }

  // 3. Prefix match — only if exactly one set matches (avoids ambiguity)
  const prefix = prefixIndex.get(prefixName(providedName));
  if (prefix && prefix.length === 1) {
    return { set: prefix[0], confidence: 'medium', reason: 'Prefix Match' };
  }

  return null;
}
