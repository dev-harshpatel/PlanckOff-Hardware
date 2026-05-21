# Processed Description — Architecture Spec

**Status:** Draft — awaiting approval before implementation

---

## Goal

Persist dimension-resolved hardware item descriptions so they flow through the entire application — UI, exports, proposals, and reports — without re-computing on every render.

---

## Why the "Shared-Set" Problem Does Not Apply Here

The previous concern was: a hardware set is shared across doors with different W×H, so a single stored dimension could be wrong for some doors.

This concern is already solved by `autoCreateVariants` (`utils/autoVariantUtils.ts`).

`getDoorProfileKey()` groups doors by **W × H, Leaf Count, Fire Rating, Door Material, Door Operation, Frame Material, and Int/Ext**. After auto-variant creation runs:

- Set `001` → only doors that share the same full profile (same W×H, same leaf count, etc.)
- Set `001.W` → the remaining group of doors — again all sharing the same profile

**After `autoCreateVariants` runs, every set and every variant is guaranteed to have doors with identical W×H.** Any door in `assignedDoors` gives the exact right dimensions. There is no approximation.

---

## The Change: `processedDescription` field

Add one optional field to `HardwareItem`:

```ts
interface HardwareItem {
  // existing — never mutated after extraction
  description: string;

  // new — resolved from any assigned door's dimensions
  processedDescription?: string;
}
```

**What it contains:**

The description string with all placeholder tokens replaced using the assigned doors' dimensions (which are all identical after variant creation).

```
Before:  "FM-HD1-SER12 x length"
After:   "FM-HD1-SER12 83\""

Before:  "S88BL x width x 2-height"
After:   "S88BL 42\" 168\""

Before:  "Pemko 420ASL x width"
After:   "Pemko 420ASL 42\""
```

If the description has no placeholder tokens AND the item name has no matching dimension rule, `processedDescription` is left `undefined` — display falls back to `description`.

---

## Updated JSON Format

```json
{
  "setName": "AD01b",
  "doors": [...],
  "hardwareItems": [
    {
      "qty": 2,
      "item": "Continuous Hinge",
      "manufacturer": "McKinney",
      "description": "FM-HD1-SER12 x length",
      "processedDescription": "FM-HD1-SER12 83\"",
      "finish": "CA"
    },
    {
      "qty": 1,
      "item": "Gasketing",
      "manufacturer": "Pemko",
      "description": "S88BL x width x 2-height",
      "processedDescription": "S88BL 42\" 168\"",
      "finish": ""
    },
    {
      "qty": 1,
      "item": "Exit Device",
      "manufacturer": "Sargent",
      "description": "56-NB-PE8613",
      "finish": "626"
    }
  ],
  "notes": {
    "hardwareNotes": ""
  }
}
```

`processedDescription` is omitted when no resolution was possible (no tokens, no rule, no assigned door).

---

## Display Priority (everywhere in the app)

```ts
item.processedDescription ?? item.description
```

One rule. Applied at every render site — Components tab, schedule view, modal editor, exports, proposals. No special cases.

---

## When `processedDescription` Gets Populated

**Trigger: after `autoCreateVariants` runs.**

This is the earliest moment where:
1. Door assignments are finalised
2. Each set is guaranteed to have homogeneous door dimensions
3. Any door from `assignedDoors[0]` gives the correct W×H for the whole set

**Concrete trigger points:**
- After the hardware PDF import pipeline completes (sets assigned + variants created)
- When a door is manually re-assigned to a different set
- When door dimensions are edited (re-run resolver for all sets that door belongs to)

---

## Data Flow

```
PDF Upload
    ↓
Extract raw descriptions  →  description = "FM-HD1-SER12 x length"
                              processedDescription = undefined
    ↓
Door schedule already loaded → autoCreateVariants runs
    ↓
All sets now have homogeneous door profiles
    ↓
resolveDescriptionPlaceholders(description, itemName, assignedDoors[0], isPair)
    ↓
processedDescription = "FM-HD1-SER12 83\""  ← stored
    ↓
UI / Export reads:  processedDescription ?? description
```

---

## Where It Is Stored

| Layer | Change |
|---|---|
| `types.ts` | Add `processedDescription?: string` to `HardwareItem` |
| Supabase `hardware_items` | New nullable column `processed_description` |
| In-memory state | Field already travels with the `HardwareItem` object everywhere |
| JSON format | `processedDescription` key alongside `description` |

---

## New Utility: `utils/descriptionResolver.ts`

A thin, pure function that takes a set + its assigned doors and returns the set with all items resolved:

```ts
function resolveSetDescriptions(
  set: HardwareSet,
  assignedDoors: Door[],
): HardwareSet
```

Internally calls `resolveDescriptionPlaceholders()` from `dimensionRules.ts` for each item.
Returns a new set object — no mutation.
If `assignedDoors` is empty, returns the set unchanged.

---

## Implementation Plan

| Step | File | Work |
|---|---|---|
| 1 | `types.ts` | Add `processedDescription?: string` to `HardwareItem` |
| 2 | Supabase migration | Add nullable `processed_description` column to `hardware_items` table |
| 3 | `utils/descriptionResolver.ts` | New pure utility — `resolveSetDescriptions(set, doors)` |
| 4 | Import pipeline | Call `resolveSetDescriptions` for each set after `autoCreateVariants` completes; persist result |
| 5 | Manual re-assignment | Re-run resolver when a door is moved to a different set |
| 6 | Dimension edit | Re-run resolver for affected sets when door W×H is changed |
| 7 | Display layer | Replace `item.description` with `item.processedDescription ?? item.description` at all render sites |
| 8 | Export layer | Exports read `processedDescription ?? description` — no per-door re-computation needed since the stored value is already exact |
| 9 | `DimensionBadge` | Hide badge when `processedDescription` is already set — avoids showing both the resolved description and a badge |

---

## Edge Cases

| Situation | Behaviour |
|---|---|
| No doors assigned yet | `processedDescription` stays `undefined`; `description` shown; `DimensionBadge` still fires if item matches a rule |
| Door has no width/height | `processedDescription` stays `undefined`; `description` shown |
| Description has no tokens and item has no rule | `processedDescription` stays `undefined`; `description` shown |
| Door dimensions edited after resolution | Resolver re-runs for all sets that door belongs to; `processedDescription` overwritten |
| Variant created from a set | New variant inherits items (including `processedDescription` from parent); re-runs resolver with its own assigned doors to get exact value for its door group |

---

## What Does NOT Change

- `description` is read-only from the moment of PDF extraction. Never overwritten.
- `dimensionRules.ts` and `DimensionBadge.tsx` remain unchanged — they handle display for sets that have no `processedDescription` yet (e.g. newly uploaded before the resolver has run).
- `autoCreateVariants` logic is unchanged — it already solves the dimension-homogeneity problem.
- No LLM involved anywhere in this pipeline. Everything is deterministic code.
