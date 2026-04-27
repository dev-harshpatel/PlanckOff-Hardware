# Door Schedule Report — Multi-Level Grouping Filter

## What I Understood

The Door Schedule Report already lets users pick **which columns** to display via the 4-box checkbox panel (Basic Information, Doors, Frame, Hardware).

The new feature adds a second step: **Grouping**. After choosing columns, the user picks one or more "group-by" fields. The report then splits all 193 doors into **separate tables**, one per unique combination of grouped values — like a nested drill-down.

The 11 allowed grouping fields are:

| Field | Source Section |
|---|---|
| BUILDING TAG | basic_information |
| BUILDING LOCATION | basic_information |
| DOOR OPERATION | basic_information |
| FIRE RATING | basic_information |
| DOOR MATERIAL | door |
| DOOR ELEVATION TYPE | door |
| DOOR CORE | door |
| FRAME MATERIAL | frame |
| FRAME ELEVATION TYPE | frame |
| FRAME ASSEMBLY | frame |
| PREHUNG | frame |

---

## Concrete Example Using `02e905be_...parsed.json` (193 doors)

### Step 1 — User selects columns
User checks: `DOOR TAG`, `WIDTH`, `HEIGHT`, `FIRE RATING`, `DOOR MATERIAL`, `FRAME MATERIAL`, `FRAME ASSEMBLY`, `HARDWARE SET`

### Step 2 — User adds grouping levels
User drags/selects these in order:
1. **BUILDING LOCATION**
2. **DOOR MATERIAL**
3. **FRAME ASSEMBLY**

### What the report renders

The distinct values in this dataset are:
- BUILDING LOCATION: `FIRST FLOOR`, `SECOND FLOOR`, `THIRD FLOOR`, `FOURTH FLOOR`
- DOOR MATERIAL: `STEEL`, `GLAZED`, `SWC`, `WOOD`
- FRAME ASSEMBLY: `WELDED`, `-`

Every unique **combination** that actually exists in the data becomes one table:

```
─────────────────────────────────────────────────────────
 Table 1 of 12
 FIRST FLOOR  ›  STEEL  ›  WELDED                (15 doors)
─────────────────────────────────────────────────────────
 DOOR TAG | WIDTH  | HEIGHT | FIRE RATING | DOOR MATERIAL | FRAME MATERIAL | FRAME ASSEMBLY | HW SET
 115B1    | 3'-0"  | 6'-8"  | 3/4 HR      | STEEL         | STEEL          | WELDED         | 3
 105B1    | 3'-0"  | 6'-8"  | 3/4 HR      | STEEL         | STEEL          | WELDED         | 2
 … 13 more rows

─────────────────────────────────────────────────────────
 Table 2 of 12
 FIRST FLOOR  ›  SWC  ›  WELDED                  (6 doors)
─────────────────────────────────────────────────────────
 DOOR TAG | WIDTH  | HEIGHT | FIRE RATING | DOOR MATERIAL | …
 212C1    | 3'-4"  | 7'-0"  | 0 HR        | SWC           | …

─────────────────────────────────────────────────────────
 Table 3 of 12
 FIRST FLOOR  ›  WOOD  ›  WELDED                 (2 doors)
─────────────────────────────────────────────────────────
 …

─────────────────────────────────────────────────────────
 Table 4 of 12
 FIRST FLOOR  ›  WOOD  ›  -                      (8 doors)
─────────────────────────────────────────────────────────
 …

─────────────────────────────────────────────────────────
 Table 5 of 12
 SECOND FLOOR  ›  STEEL  ›  WELDED               (3 doors)
─────────────────────────────────────────────────────────
 …

… and so on for every unique combination
```

If the user removes level 3 (FRAME ASSEMBLY), the tables collapse:
```
 FIRST FLOOR  ›  STEEL    (15 doors)
 FIRST FLOOR  ›  SWC      (6 doors)
 FIRST FLOOR  ›  WOOD     (10 doors)
 SECOND FLOOR  ›  STEEL   (3 doors)
 …
```

If the user removes level 2 (DOOR MATERIAL) too, only 4 tables remain (one per floor).

---

## UI Design

```
┌─────────────────────────────────────────────────────┐
│  Step 1 — Columns  (existing 4-box checkbox panel)  │
└─────────────────────────────────────────────────────┘
                        ↓ (user clicks "Add Grouping")
┌─────────────────────────────────────────────────────┐
│  Step 2 — Group By                                  │
│                                                     │
│  Level 1:  [ BUILDING LOCATION ▾ ]   [ × ]         │
│  Level 2:  [ DOOR MATERIAL     ▾ ]   [ × ]         │
│  Level 3:  [ FRAME ASSEMBLY    ▾ ]   [ × ]         │
│                                                     │
│  [ + Add Group Level ]                              │
└─────────────────────────────────────────────────────┘
                        ↓ (preview auto-updates)
┌─────────────────────────────────────────────────────┐
│  FIRST FLOOR › STEEL › WELDED          15 doors     │
│  ┌──────────┬───────┬────────┬─────────┐            │
│  │ DOOR TAG │ WIDTH │ HEIGHT │ HW SET  │            │
│  ├──────────┼───────┼────────┼─────────┤            │
│  │ 115B1    │ 3'-0" │ 6'-8"  │ 3       │            │
│  │ 105B1    │ 3'-0" │ 6'-8"  │ 2       │            │
│  └──────────┴───────┴────────┴─────────┘            │
│                                                     │
│  FIRST FLOOR › SWC › WELDED            6 doors     │
│  ┌──────────┬───────┬────────┬─────────┐            │
│  │ …                                   │            │
└─────────────────────────────────────────────────────┘
```

---

## How We'll Build It

### Data model

```typescript
// A single group-by level
interface GroupLevel {
  id: string;           // unique id for React key
  field: string;        // e.g. "BUILDING LOCATION"
  sectionKey: 'basic_information' | 'door' | 'frame' | 'hardware';
}

// Resolved group of doors after applying all active levels
interface DoorGroup {
  breadcrumb: string[];   // e.g. ["FIRST FLOOR", "STEEL", "WELDED"]
  doors: Door[];
}
```

### Algorithm (pure function, no loops within loops)

```typescript
function groupDoors(doors: Door[], levels: GroupLevel[]): DoorGroup[] {
  if (levels.length === 0) return [{ breadcrumb: [], doors }];

  function recurse(subset: Door[], remainingLevels: GroupLevel[], breadcrumb: string[]): DoorGroup[] {
    if (remainingLevels.length === 0) return [{ breadcrumb, doors: subset }];

    const [current, ...rest] = remainingLevels;
    // Collect distinct values for this level in this subset
    const valueMap = new Map<string, Door[]>();
    for (const door of subset) {
      const val = getSectionValue(door, current.sectionKey, current.field) || '(blank)';
      if (!valueMap.has(val)) valueMap.set(val, []);
      valueMap.get(val)!.push(door);
    }
    // Recurse into each distinct value
    return Array.from(valueMap.entries()).flatMap(([val, subDoors]) =>
      recurse(subDoors, rest, [...breadcrumb, val])
    );
  }

  return recurse(doors, levels, []);
}
```

Running this with levels = [BUILDING LOCATION, DOOR MATERIAL, FRAME ASSEMBLY] on 193 doors produces ~12 `DoorGroup` objects, each with its own `breadcrumb` and `doors` array.

### Component structure

```
DoorScheduleConfig
  ├── ColumnPanel          (existing 4-box checkboxes — Step 1)
  ├── GroupingPanel        (new — Step 2)
  │     ├── GroupLevelRow  (dropdown + remove button, per level)
  │     └── AddLevelButton
  └── ReportPreview        (renders one GroupedTable per DoorGroup)
        └── GroupedTable   (breadcrumb header + data rows)
```

### State in DoorScheduleConfig

```typescript
const [groupLevels, setGroupLevels] = useState<GroupLevel[]>([]);
const groups = useMemo(() => groupDoors(doors, groupLevels), [doors, groupLevels]);
```

### The 11 grouping field definitions (static config)

```typescript
const GROUPING_FIELDS: { field: string; sectionKey: SectionKey; label: string }[] = [
  { field: 'BUILDING TAG',        sectionKey: 'basic_information', label: 'Building Tag'        },
  { field: 'BUILDING LOCATION',   sectionKey: 'basic_information', label: 'Building Location'   },
  { field: 'DOOR OPERATION',      sectionKey: 'basic_information', label: 'Door Operation'      },
  { field: 'FIRE RATING',         sectionKey: 'basic_information', label: 'Fire Rating'         },
  { field: 'DOOR MATERIAL',       sectionKey: 'door',              label: 'Door Material'       },
  { field: 'DOOR ELEVATION TYPE', sectionKey: 'door',              label: 'Door Elevation Type' },
  { field: 'DOOR CORE',           sectionKey: 'door',              label: 'Door Core'           },
  { field: 'FRAME MATERIAL',      sectionKey: 'frame',             label: 'Frame Material'      },
  { field: 'FRAME ELEVATION TYPE',sectionKey: 'frame',             label: 'Frame Elevation Type'},
  { field: 'FRAME ASSEMBLY',      sectionKey: 'frame',             label: 'Frame Assembly'      },
  { field: 'PREHUNG',             sectionKey: 'frame',             label: 'Prehung'             },
];
```

---

## What the Export Will Look Like

When the user clicks **Export Excel**, the file will have one **worksheet per group** (named e.g. `FF_STEEL_WELDED`) with the same columns and rows as the on-screen table. For PDF, each group gets its own page section with the breadcrumb as a heading.

---

## Summary of Steps to Build

1. Add `GroupingPanel` UI (dropdowns + add/remove buttons) below the existing column picker
2. Write `groupDoors()` pure function (uses `getSectionValue` already in the file)
3. Render grouped tables in preview (one `<GroupedTable>` per `DoorGroup`)
4. Wire export to sheet-per-group (Excel) / section-per-group (PDF) — later pass

**No new files needed.** All changes are inside `DoorScheduleConfig.tsx` with one new helper function.
