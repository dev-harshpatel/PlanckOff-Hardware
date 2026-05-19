/**
 * Dimension resolution for hardware items.
 *
 * Maps item type names (including all common aliases) to the dimension
 * formula defined in prompt.txt, then computes the result from door
 * width / height (stored as inches in the Door type).
 *
 * Pure TypeScript — no React, no side effects, no imports beyond types.
 */

import type { Door } from '@/types';

// ---------------------------------------------------------------------------
// Public result type
// ---------------------------------------------------------------------------

export interface DimensionResult {
  /** Formatted dimension string, e.g. "17 LF", "3'-4\" × 10\"", "6'-11\"" */
  value: string;
  /** Human-readable rule for tooltip, e.g. "(2 × H) + W" */
  rule: string;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Convert raw inches to X'-Y" format, e.g. 83 → 6'-11" */
function inchesToFeetInches(inches: number): string {
  const feet = Math.floor(inches / 12);
  const remaining = Math.round(inches % 12);
  return remaining === 0 ? `${feet}'-0"` : `${feet}'-${remaining}"`;
}

/** Convert raw inches to nearest whole linear foot, e.g. 204 → 17 LF */
function inchesToLinearFeet(inches: number): string {
  return `${Math.round(inches / 12)} LF`;
}

// ---------------------------------------------------------------------------
// Name normalizer
// ---------------------------------------------------------------------------

function normalize(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '');
}

// ---------------------------------------------------------------------------
// Alias map  →  canonical rule key
//
// Every alias from prompt.txt plus reasonable field variants.
// Extend this list whenever a new alias surfaces in real PDF data.
// ---------------------------------------------------------------------------

const ALIAS_MAP: Record<string, string> = {
  // Continuous Hinge
  'continuous hinge':   'continuous_hinge',
  'cont. hinge':        'continuous_hinge',
  'cont hinge':         'continuous_hinge',
  'cont. hinges':       'continuous_hinge',
  'continuous hinges':  'continuous_hinge',
  'full-surface hinge': 'continuous_hinge',
  'full surface hinge': 'continuous_hinge',

  // Kick Plate / Armor Plate / Mop Plate
  'kick plate':         'kick_plate',
  'kick plates':        'kick_plate',
  'kickplate':          'kick_plate',
  'armor plate':        'kick_plate',
  'armour plate':       'kick_plate',
  'mop plate':          'kick_plate',
  'push plate':         'kick_plate',

  // Sweep
  'sweep':              'sweep',
  'door sweep':         'sweep',
  'door sweeps':        'sweep',

  // Door Bottom
  'door bottom':              'door_bottom',
  'automatic door bottom':    'door_bottom',
  'auto door bottom':         'door_bottom',
  'auto. door bottom':        'door_bottom',
  'automatic bottom':         'door_bottom',

  // Threshold
  'threshold':    'threshold',
  'sill':         'threshold',
  'saddle':       'threshold',
  'thresholds':   'threshold',

  // Weatherstrip / Gasketing (same formula)
  'weatherstrip':       'weatherstrip',
  'weatherstripping':   'weatherstrip',
  'weather strip':      'weatherstrip',
  'weather stripping':  'weatherstrip',
  'gasketing':          'weatherstrip',
  'gasket':             'weatherstrip',
  'gaskets':            'weatherstrip',
  'perimeter gask':     'weatherstrip',
  'perimeter gasket':   'weatherstrip',
  'perimeter gasketing':'weatherstrip',
  'perimeter seal':     'weatherstrip',
  'smoke seal':         'weatherstrip',
  'smoke gasketing':    'weatherstrip',
  'smoke seals':        'weatherstrip',
  'door seal':          'weatherstrip',
  'door seals':         'weatherstrip',

  // Meeting Stile
  'meeting stile':      'meeting_stile',
  'meeting stiles':     'meeting_stile',
  'mtg. stile':         'meeting_stile',
  'mtg stile':          'meeting_stile',
  'mtg. stiles':        'meeting_stile',
  'pr. mtg. stile':     'meeting_stile',
  '1 pr. meeting stile':'meeting_stile',
  '1 set mtg. stile':   'meeting_stile',
  '1 set meeting stile':'meeting_stile',

  // Sensor
  'sensor':             'sensor',
  'motion sensor':      'sensor',
  'presence sensor':    'sensor',
  'activation sensor':  'sensor',
  'auto. sensor':       'sensor',
};

// ---------------------------------------------------------------------------
// Rule functions  →  DimensionResult
// ---------------------------------------------------------------------------

type RuleFn = (door: Door, isPair: boolean) => DimensionResult;

const RULES: Record<string, RuleFn> = {
  continuous_hinge: (door) => ({
    value: inchesToFeetInches(door.height - 1),
    rule: 'H − 1"',
  }),

  kick_plate: (door, isPair) => {
    const w = isPair ? door.width - 1 : door.width - 2;
    return {
      value: `${inchesToFeetInches(w)} × 10"`,
      rule: isPair ? 'W − 1" per leaf (pair) × 10"' : 'W − 2" × 10"',
    };
  },

  sweep: (door) => ({
    value: inchesToFeetInches(door.width),
    rule: 'W',
  }),

  door_bottom: (door) => ({
    value: inchesToFeetInches(door.width),
    rule: 'W',
  }),

  threshold: (door) => ({
    value: inchesToFeetInches(door.width),
    rule: 'W',
  }),

  weatherstrip: (door, isPair) => {
    // For a pair door, door.width is the per-leaf width.
    // The full perimeter wraps the total opening, so double it.
    const totalWidth = isPair ? door.width * 2 : door.width;
    return {
      value: inchesToLinearFeet(2 * door.height + totalWidth),
      rule: isPair ? '(2 × H) + (2 × W) [pair]' : '(2 × H) + W',
    };
  },

  meeting_stile: (door) => ({
    value: inchesToFeetInches(door.height),
    rule: 'H',
  }),

  sensor: (door, isPair) => {
    const openingWidth = isPair ? door.width * 2 : door.width;
    return {
      value: inchesToFeetInches(openingWidth),
      rule: isPair ? '2 × W (pair opening)' : 'W (opening width)',
    };
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve the dimension for a hardware item given a door.
 *
 * Returns null if:
 *  - the item name does not match any known rule
 *  - the door is missing width or height
 */
export function resolveDimension(
  itemName: string,
  door: Door,
  isPair = false,
): DimensionResult | null {
  if (!door.width || !door.height) return null;

  const ruleKey = ALIAS_MAP[normalize(itemName)];
  if (!ruleKey) return null;

  const fn = RULES[ruleKey];
  return fn ? fn(door, isPair) : null;
}

/**
 * Replace dimension placeholder tokens in a description string.
 *
 * Tokens: "x width", "x height", "x length", "x 2-height"
 * If no tokens are found the original string is returned unchanged.
 */
export function resolveDescriptionPlaceholders(
  description: string,
  itemName: string,
  door: Door,
  isPair = false,
): string {
  if (!door.width || !door.height) return description;

  const w   = inchesToFeetInches(door.width);
  const h   = inchesToFeetInches(door.height);
  const h2  = inchesToFeetInches(2 * door.height);
  const dim = resolveDimension(itemName, door, isPair);

  return description
    .replace(/x\s*2-height/gi, h2)
    .replace(/x\s*height/gi,   h)
    .replace(/x\s*width/gi,    w)
    .replace(/x\s*length/gi,   dim?.value ?? 'x length');
}
