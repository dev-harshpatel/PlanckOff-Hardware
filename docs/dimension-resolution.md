# Dimension Resolution — Feature Spec

**Status:** Draft
**Feature:** Hardware item dimension calculation and display
**Scope:** Display-time only (no stored data changes in v1)

---

## Problem Statement

Hardware items like Gasketing, Kick Plate, Continuous Hinge, and Threshold require a physical dimension (length, width, or linear footage) in their description. That dimension is always **door-specific** — it's derived from the door's width and height, which come from the door schedule.

The current state: descriptions either contain unresolved placeholder tokens (`x length`, `x width`) from PDF extraction, or no dimension at all.

The door schedule already stores `width` and `height` (in inches) on every `Door` object. The hardware items already have a normalized `name` field (the category). What's missing is the bridge between the two.

---

## Fundamental Constraint

A `HardwareSet` is **shared across multiple doors**. Door 101 might be 3'-0" × 7'-0" and Door 102 might be 3'-6" × 8'-0" — same set, different dimensions. This means:

- Dimensions **cannot be stored inside the shared `HardwareSet`**
- Resolution must happen either at **display time** (computed per door, ephemeral) or as a **per-door enrichment** (stored in a door-specific override, persisted)
- v1 will be display-time only — no schema changes

---

## Dimension Rules (from prompt.txt)

All rules are deterministic math. Inputs are always `doorWidth` (inches) and `doorHeight` (inches).

| Item Type (canonical) | Aliases | Formula | Output Format |
|---|---|---|---|
| Continuous Hinge | Cont. Hinge, CH | `H − 1"` | `6'-11"` |
| Kick Plate | Armor Plate | Single: `W − 2"` / Pair: `W − 1" per leaf` | `3'-4" × 10"` |
| Sweep | — | `W` | `3'-0"` |
| Door Bottom | — | `W` | `3'-0"` |
| Threshold | — | `W` | `3'-0"` |
| Weatherstrip | Perimeter Seal, Weather Strip | `(2 × H) + W` | `17 LF` |
| Gasketing | Gasket, Smoke Seal, Perimeter Gask. | `(2 × H) + W` | `17 LF` |
| Meeting Stile | Mtg. Stile, Mtg Stile | `H` | `7'-0"` |
| Sensor | — | Opening Width (`= W` single, `= 2W` pair) | `3'-0"` |

**Formatting rules:**
- Feet-and-inches: `X'-Y"` (e.g. `3'-6"`, `7'-0"`)
- Linear foot totals: `X LF` (round to nearest whole foot)
- Kick Plate: `[width] × 10"` (height is always 10" unless explicitly stated)

---

## Architecture — Three Layers

### Layer 1 — `utils/dimensionRules.ts` (new file)

Pure TypeScript. No imports, no side effects. Two exports:

```ts
resolveDimension(itemName: string, door: Door, isPair?: boolean): string | null
// Returns the calculated dimension string, or null if no rule matches.

resolveDescriptionPlaceholders(description: string, itemName: string, door: Door, isPair?: boolean): string
// Replaces "x width", "x height", "x length", "x 2-height" tokens in a description string.
// Returns the original string unchanged if no tokens are found.
```

Internally maintains a `DIMENSION_RULES` map keyed by normalized item name variants.
Normalization = lowercase + trim + collapse whitespace + strip trailing punctuation.

### Layer 2 — Display component `DimensionBadge` (new)

A small read-only React component:

```tsx
<DimensionBadge itemName={item.name} door={door} isPair={isPair} />
```

- Calls `resolveDimension()` internally
- If result is non-null: renders a subtle badge, e.g. `[17 LF]` in muted text beside the description
- If null: renders nothing (invisible, zero layout cost)

### Layer 3 — LLM enrichment (post-v1, only if needed)

Triggered manually or post-assignment. Inputs: `[item name, current description, door width, door height]` + the prompt rules. Output: resolved description string. Stored as a per-door override.

**Not in scope for v1.** Added only if real-world PDFs generate item names that cannot be matched by the alias table.

---

## Where to Show Dimensions (UI Surfaces)

| View | Context | Show? |
|---|---|---|
| Hardware set expanded row (set-level, no door) | No door in context | No — cannot calculate |
| Door row expanded → assigned hardware items | Single door in context | **Yes — primary surface** |
| Hardware Schedule export (Excel/PDF) | Per-door breakdown | Yes — v2, export layer |
| Hardware set modal (editing a set) | No door in context | No |

The primary display surface for v1 is the **door row's assigned hardware item list** — wherever a door's hardware items are rendered, `door.width`, `door.height`, and `item.name` are all simultaneously available.

---

## Description Placeholder Handling

When `resolveDescriptionPlaceholders()` runs on a description string:

| Token found | Replacement |
|---|---|
| `x width` | Door Width formatted (e.g. `3'-0"`) |
| `x height` | Door Height formatted (e.g. `7'-0"`) |
| `x length` | Calculated per item rule (left as-is if no rule matches) |
| `x 2-height` | `2 × Door Height` formatted |

If the description has **no placeholder token** but the item matches a rule (e.g. description is just `"FM-HD1-SER12"` for a Continuous Hinge), the dimension is shown via the `DimensionBadge` beside the description — **not appended to the description string itself.** This avoids double-applying on re-renders.

---

## Display Decision — Badge vs Inline Replace

**v1: Badge approach**

Show the dimension as a read-only `[17 LF]` annotation next to the description. The stored description is never mutated.

Reasons:
1. A hardware set is shared — mutating the description would be wrong for other doors
2. No risk of double-apply on re-render
3. Dimensions update automatically if door dimensions are edited
4. Clean rollback — remove the badge component and nothing else changes

**v2 (future): Inline replace for exports**

When generating Excel/PDF exports of a door's hardware, call `resolveDescriptionPlaceholders()` to produce a clean resolved string for the exported document.

---

## Implementation Plan

| Step | File | Work |
|---|---|---|
| 1 | `utils/dimensionRules.ts` | Build alias map + `resolveDimension()` + `resolveDescriptionPlaceholders()` + formatters |
| 2 | `components/hardware/DimensionBadge.tsx` | Small display-only component, calls Layer 1 |
| 3 | Door hardware item render location | Wire `DimensionBadge` in wherever `item.name` and `door` are both in scope |
| 4 | Manual test with real PDF data | Verify alias table covers actual extracted item names; log any misses |
| 5 | (If misses found) Expand alias table | No LLM needed unless miss rate is significant |

---

## Out of Scope (v1)

- Storing resolved dimensions (no DB/schema changes)
- LLM enrichment for non-standard item names
- Export-time dimension injection
- Opening width for sensors on pair doors (requires pair detection)
- Editing or overriding the calculated dimension per door
