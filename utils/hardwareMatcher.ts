/**
 * Client-safe hardware set matching.
 *
 * Matching order (first match wins):
 *   1. Exact case-insensitive
 *   2. Numeric equivalence      "7"    === "007"
 *   3. Starts-with separator    "P200" matches "P200 – Elevator Lobby"
 *      — when ambiguous (multiple sets share the prefix), pick the shortest name
 *   4. Reverse token match      "S2"   matches set named "S2, S4, S5 and S6"
 */

import type { HardwareSet } from '../types';

function normalize(code: string): string {
  return code.trim().toLowerCase();
}

/** Split a name that may be a comma/and-separated list of codes. */
function splitMultiCode(name: string): string[] {
  return name.split(/,|\band\b/i).map(s => s.trim()).filter(s => s.length > 0);
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

  // Build reverse token index for multi-value set names like "S2, S4, S5 and S6"
  const tokenIndex = new Map<string, HardwareSet>();
  for (const set of hardwareSets) {
    if (/,|\band\b/i.test(set.name)) {
      const tokens = splitMultiCode(set.name);
      if (tokens.every(t => /^[A-Za-z0-9._-]{1,10}$/.test(t))) {
        for (const token of tokens) {
          if (!tokenIndex.has(normalize(token))) tokenIndex.set(normalize(token), set);
        }
      }
    }
  }

  // 1. Exact case-insensitive
  const exact = setIndex.get(normalize(providedName));
  if (exact) return { set: exact, confidence: 'high', reason: 'Exact Match' };

  // 1.5. Comma-space-normalized match — "S2,S4,S5 and S6" matches "S2, S4, S5 and S6"
  const normComma = providedName.replace(/\s*,\s*/g, ',').trim().toLowerCase();
  for (const [, set] of setIndex) {
    if (set.name.replace(/\s*,\s*/g, ',').trim().toLowerCase() === normComma) {
      return { set, confidence: 'high', reason: 'Comma-Normalized Match' };
    }
  }

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
  //    When multiple sets match, pick the shortest name (most general) at medium confidence.
  const normCode = normalize(providedName);
  const startsWithMatches: HardwareSet[] = [];
  for (const [normKey, set] of setIndex) {
    if (normKey.startsWith(normCode) && normKey.length > normCode.length) {
      const next = normKey[normCode.length];
      if (/[\s\-–—_,]/.test(next)) startsWithMatches.push(set);
    }
  }
  if (startsWithMatches.length === 1) {
    return { set: startsWithMatches[0], confidence: 'high', reason: 'Prefix Match' };
  }
  if (startsWithMatches.length > 1) {
    const best = startsWithMatches.reduce((a, b) => a.name.length <= b.name.length ? a : b);
    return { set: best, confidence: 'medium', reason: `Ambiguous Prefix Match (${startsWithMatches.length} candidates — picked shortest)` };
  }

  // 4. Reverse token match — set name is itself a list, e.g. "S2" matches "S2, S4, S5 and S6"
  const tokenSet = tokenIndex.get(normalize(providedName));
  if (tokenSet) return { set: tokenSet, confidence: 'high', reason: 'Multi-Value Set Match' };

  return null;
}
