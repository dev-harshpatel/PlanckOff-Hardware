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

/** Express raw inches as a plain inch value, e.g. 83 → 83" */
function formatInches(inches: number): string {
  return `${Math.round(inches)}"`;
}

/** Convert raw inches to nearest whole linear foot, e.g. 252 → 21 LF */
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
    .replace(/\s*\([^)]*\)/g, '') // strip qualifiers like "(Brush)", "(Interlock)", "(8" x 1/2" Rise)"
    .replace(/-/g, ' ')            // Weather-Strip → weather strip
    .replace(/\s+/g, ' ')
    .trim()
    // strip common per-leaf/per-door quantifier suffixes before alias lookup
    .replace(/[,\s]+(each\s+leaf\s*set|each\s+leafset|each\s+leaf|per\s+leaf|per\s+door|each\s+door|each\s+opening)[^]*$/i, '')
    .trim()
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
  'kick plate':              'kick_plate',
  'kick plates':             'kick_plate',
  'kickplate':               'kick_plate',
  'kickplates':              'kick_plate',
  'kick plate, each leaf':   'kick_plate',
  'kick plate each leaf':    'kick_plate',
  'armor plate':             'kick_plate',
  'armour plate':            'kick_plate',
  'mop plate':               'kick_plate',

  // Sweep
  'sweep':              'sweep',
  'sweeps':             'sweep',
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
  'astragal':           'astragal',
  'astragals':          'astragal',
  'meeting stile seal': 'weatherstrip',

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
    value: formatInches(door.height - 1),
    rule: 'H − 1"',
  }),

  kick_plate: (door, isPair) => {
    const w = isPair ? door.width - 1 : door.width - 2;
    return {
      value: `${formatInches(w)} × 10"`,
      rule: isPair ? 'W − 1" per leaf (pair) × 10"' : 'W − 2" × 10"',
    };
  },

  sweep: (door) => ({
    value: formatInches(door.width),
    rule: 'W',
  }),

  door_bottom: (door) => ({
    value: formatInches(door.width),
    rule: 'W',
  }),

  threshold: (door) => ({
    value: formatInches(door.width),
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

  astragal: (door) => ({
    value: formatInches(door.height),
    rule: 'H',
  }),

  meeting_stile: (door) => ({
    value: formatInches(door.height),
    rule: 'H',
  }),

  sensor: (door, isPair) => {
    const openingWidth = isPair ? door.width * 2 : door.width;
    return {
      value: formatInches(openingWidth),
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
 * Append the calculated dimension value to the description.
 * Never modifies the original description text — only appends "[value]" at the end.
 * Returns the description unchanged if the item has no matching rule or door dimensions are missing.
 */
export function resolveDescriptionPlaceholders(
  description: string,
  itemName: string,
  door: Door,
  isPair = false,
): string {
  if (!door.width || !door.height) return description;
  const dim = resolveDimension(itemName, door, isPair);
  if (!dim) return description;
  return `${description} [${dim.value}]`;
}
