/**
 * Server-side hardware prep generation service.
 *
 * Produces a function string per hardware set in the format
 * "Hinge + Lever + Elec Strike" (industry-standard Function column).
 *
 * Two entry points:
 *   generatePrepForAllSets  — batch (one AI call for all sets, used in pipeline)
 *   generatePrepForOneSet   — single set (button fallback)
 */

import OpenAI from 'openai';
import type { ExtractedHardwareSet } from '@/lib/db/hardware';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY ?? '',
  defaultHeaders: {
    'HTTP-Referer': 'https://planckoff.com',
    'X-Title': 'PlanckOff Hardware',
  },
});

const MODEL = 'google/gemini-2.5-flash';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function setItemLines(set: ExtractedHardwareSet): string {
  return set.hardwareItems
    .map(i =>
      `  - ${i.qty}× ${i.item}${i.description ? `: ${i.description}` : ''}` +
      `${i.manufacturer ? ` (${i.manufacturer})` : ''}${i.finish ? `, Finish: ${i.finish}` : ''}`,
    )
    .join('\n');
}

const FUNCTION_INSTRUCTIONS = `
FUNCTION STRING RULES — read carefully:
- The "function" field is a short summary of the hardware functions present in the set.
- Format: short labels joined by " + " (e.g., "Hinge + Lever + Elec Strike").
- Use ONLY these recognised labels (abbreviate as shown):
    Hinge, Continuous Hinge, Pivot, Lever, Deadbolt, Elec Strike, Elec Latch,
    Flush Bolt, OH Stop, Door Closer, Floor Closer, Exit Device, Panic Hardware,
    Roller Latch, Viewer, Door Position Switch, Coordinator, Power Transfer,
    Kickplate, Push Plate, Pull, Flush Pull, Bypass Door Kit, Pocket Door Track,
    Passage Set, Privacy Lock, Bifold Knob, Auto Operator, Card Reader, Key Pad,
    Magnetic Hold-Open, Overhead Holder, Wall Stop, Floor Stop, Bumper
- Pick only what is truly in the set — do not add items not in the hardware list.
- Order: mounting hardware first (hinges), then locking, then electrified, then closers, then accessories.
- Example outputs: "Hinge + Lever + Elec Strike", "Hinge + Lever + Door Closer",
  "Hinge + Flush Bolt + Lever + OH Stop", "Roller Latch + Lever + Stop",
  "Bypass Door Kit + Flush Pull"`;

// ---------------------------------------------------------------------------
// Batch generation — one AI call for all sets (pipeline)
// ---------------------------------------------------------------------------

const BATCH_SCHEMA = {
  type: 'object',
  required: ['preps'],
  properties: {
    preps: {
      type: 'array',
      items: {
        type: 'object',
        required: ['setName', 'function'],
        properties: {
          setName:  { type: 'string' },
          function: { type: 'string' },
        },
      },
    },
  },
};

export async function generatePrepForAllSets(
  sets: ExtractedHardwareSet[],
): Promise<Record<string, string>> {
  if (sets.length === 0) return {};

  const setsDescription = sets
    .map(set => `## Set: ${set.setName}${set.notes ? `  (Notes: ${set.notes})` : ''}\n${setItemLines(set)}`)
    .join('\n\n');

  const prompt = `You are a certified architectural hardware consultant with expertise in Division 08 door hardware.

For EVERY hardware set listed below, produce a "function" summary string.

${FUNCTION_INSTRUCTIONS}

Return ONLY valid JSON. Include EVERY set — do not skip any.

---
${setsDescription}`;

  try {
    console.log(`[hardwarePrepService] Calling ${MODEL} for ${sets.length} sets…`);
    const response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: 'You are a construction hardware expert. Return ONLY valid JSON.' },
        { role: 'user', content: prompt },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: { name: 'hardware_prep_batch', strict: false, schema: BATCH_SCHEMA },
      },
      temperature: 0.1,
    });

    const raw = response.choices[0]?.message?.content ?? '';
    console.log(`[hardwarePrepService] Raw response (first 500 chars): ${raw.slice(0, 500)}`);

    const parsed = JSON.parse(raw) as { preps: Array<{ setName: string; function: string }> };
    console.log(`[hardwarePrepService] Parsed ${parsed.preps?.length ?? 0} entries`);

    const result: Record<string, string> = {};

    for (const entry of parsed.preps ?? []) {
      if (!entry.setName || !entry.function) {
        console.warn('[hardwarePrepService] Skipping entry missing setName or function:', entry);
        continue;
      }
      result[entry.setName] = entry.function;
    }

    console.log(`[hardwarePrepService] Final result keys: ${JSON.stringify(Object.keys(result))}`);
    return result;
  } catch (err) {
    console.error('[hardwarePrepService] Batch generation failed:', err);
    return {};
  }
}

// ---------------------------------------------------------------------------
// Single-set generation — button fallback
// ---------------------------------------------------------------------------

const SINGLE_SCHEMA = {
  type: 'object',
  required: ['function'],
  properties: {
    function: { type: 'string' },
  },
};

export async function generatePrepForOneSet(
  set: ExtractedHardwareSet,
): Promise<string> {
  const prompt = `You are a certified architectural hardware consultant with expertise in Division 08 door hardware.

Analyze the hardware set below and produce a "function" summary string.

${FUNCTION_INSTRUCTIONS}

Return ONLY valid JSON.

---
## Set: ${set.setName}${set.notes ? `  (Notes: ${set.notes})` : ''}
${setItemLines(set)}`;

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: 'You are a construction hardware expert. Return ONLY valid JSON.' },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'hardware_prep_single', strict: false, schema: SINGLE_SCHEMA },
    },
    temperature: 0.1,
  });

  const raw = response.choices[0]?.message?.content ?? '';
  const parsed = JSON.parse(raw) as { function: string };
  return parsed.function ?? '';
}
