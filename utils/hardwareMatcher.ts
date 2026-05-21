/**
 * Client-safe hardware set matching.
 *
 * Matching order (first match wins):
 *   1. Exact case-insensitive   "CA01" === "ca01"
 *   2. Numeric equivalence      "7"    === "007"
 */

import type { HardwareSet } from '../types';

function normalize(code: string): string {
  return code.trim().toLowerCase();
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

  const setIndex = new Map<string, HardwareSet>(
    hardwareSets.map((s) => [normalize(s.name), s]),
  );

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

  // 3. Starts-with separator — PDF set names often have trailing descriptions,
  //    e.g. "P200 – Elevator Lobby". Match "P200" against it by checking that
  //    the next character after the code is a separator, not another alphanumeric.
  const normCode = normalize(providedName);
  const startsWithMatches: HardwareSet[] = [];
  for (const [normKey, set] of setIndex) {
    if (normKey.startsWith(normCode) && normKey.length > normCode.length) {
      const next = normKey[normCode.length];
      if (/[\s\-–—_]/.test(next)) startsWithMatches.push(set);
    }
  }
  if (startsWithMatches.length === 1) {
    return { set: startsWithMatches[0], confidence: 'high', reason: 'Prefix Match' };
  }

  return null;
}
