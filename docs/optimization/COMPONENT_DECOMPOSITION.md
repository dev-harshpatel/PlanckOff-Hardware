# Component Decomposition & Code Optimization Plan

> **Branch:** `optimization`
> **Scope:** Frontend only — views, components, hooks, utils
> **Rule:** Zero logic changes. Identical behaviour before and after every task.
> **Rule:** Each task is independently completable and testable in isolation.

---

## File Size Overview (problem areas only)

| File | Lines | Priority |
|---|---|---|
| `views/ProjectView.tsx` | 2104 | P0 |
| `components/PricingReportConfig.tsx` | 2061 | P0 |
| `components/DoorScheduleManager.tsx` | 1591 | P0 |
| `components/DoorScheduleConfig.tsx` | 1461 | P0 |
| `views/Dashboard.tsx` | 933 | P1 |
| `components/HardwareSetsManager.tsx` | 943 | P1 |
| `components/EnhancedDoorEditModal.tsx` | 805 | P1 |
| `components/HardwareSetConfig.tsx` | 801 | P1 |
| `components/ElevationManager.tsx` | 539 | P2 |
| `components/PriceBookManager.tsx` | 490 | P2 |
| `views/PricingView.tsx` | 458 | P2 |
| `views/DatabaseView.tsx` | 459 | P2 |
| `components/ExportConfigModal.tsx` | 467 | P2 |
| `components/HardwareSetModal.tsx` | 455 | P2 |
| `components/ProjectNotesPanel.tsx` | 432 | P2 |
| `components/NewProjectModal.tsx` | 382 | P2 |

---

## Proposed Folder Structure

```
components/
  dashboard/           ← extracted from views/Dashboard.tsx
  doors/               ← extracted from DoorScheduleManager + DoorScheduleConfig
  hardware/            ← extracted from HardwareSetsManager + HardwareSetConfig
  pricing/             ← extracted from PricingReportConfig + PricingView
  forms/               ← shared form field sub-components
  ui/                  ← existing primitives (untouched)
  skeletons/           ← existing (untouched)

hooks/
  useModalState.ts     ← new
  useFetchMutation.ts  ← new
  useTableFilters.ts   ← new
  useInlineEditor.ts   ← new
  useSyncRef.ts        ← new

utils/
  doorUtils.ts         ← new (quantity parsing, section extraction)
  elevationUtils.ts    ← new (type resolution, label formatting)
  imageUtils.ts        ← new (dataURL conversion, image dimensions)
  hierarchyUtils.ts    ← new (tree building, flattening)
```

---

## Phase 1 — Shared Utilities (extract duplicate logic first) ✅ DONE

Extract pure functions that are duplicated across 3+ files into single source of truth utility modules. **No component changes in this phase.** After extracting, replace the inline copies with imports from the new util file.

---

### Task 1.1 — `utils/doorUtils.ts`

**Duplicate logic found in:** `ProjectView.tsx`, `DoorScheduleManager.tsx`, `DoorScheduleConfig.tsx`

Functions to extract:

| Function | Currently in | Description |
|---|---|---|
| `parseDoorQuantity(value)` | ProjectView line 47, DoorScheduleConfig line ~205 | Parse raw quantity string/number → number |
| `getDoorQuantity(door)` | DoorScheduleManager implicit, DoorScheduleConfig line ~215 | Extract door quantity from sections with fallback |
| `sumDoorQuantities(doors)` | DoorScheduleManager, DoorScheduleConfig (3+ copies) | Sum quantities across a door array |
| `getSectionValue(door, sectionKey, colKey)` | DoorScheduleConfig line 214, DoorScheduleManager implicit | Safe nested accessor for `door.sections[sectionKey][colKey]` with legacy fallback |

**File to create:** `utils/doorUtils.ts`

**After creation:** Replace each inline copy with an import. One file at a time, verify no behaviour change.

---

### Task 1.2 — `utils/elevationUtils.ts`

**Duplicate logic found in:** `DoorScheduleConfig.tsx`, `EnhancedDoorEditModal.tsx`, `ElevationTab.tsx`, `DoorScheduleManager.tsx`

Functions to extract:

| Function | Description |
|---|---|
| `resolveElevationLabel(door, types)` | Looks up elevation type for a door across legacy + section fields |
| `getElevationById(id, types)` | Simple type lookup with fallback |
| `formatElevationDisplay(type)` | Display label formatter |

**File to create:** `utils/elevationUtils.ts`

---

### Task 1.3 — `utils/imageUtils.ts`

**Duplicate logic found in:** `DoorScheduleConfig.tsx` (lines 15-61), `ElevationManager.tsx`

Functions to extract:

| Function | Description |
|---|---|
| `imageToDataUrl(src)` | Fetch image URL → base64 data URL (async) |
| `fetchImageDimensions(src)` | Get width/height of an image URL (async) |
| `imageUrlToDataUrlWithDimensions(src)` | Combined — returns `{ dataUrl, width, height }` |

**File to create:** `utils/imageUtils.ts`

---

### Task 1.4 — `utils/hierarchyUtils.ts`

**Duplicate logic found in:** `PricingReportConfig.tsx`, `DoorScheduleConfig.tsx`

Functions to extract:

| Function | Description |
|---|---|
| `buildGroupMap<T>(items, keyFn)` | Generic grouping: array → `Map<string, T[]>` |
| `flattenHierarchy<T>(nodes, childKey)` | Recursively flatten a tree to a flat array |

**File to create:** `utils/hierarchyUtils.ts`

Keep the domain-specific builders (`buildDoorHierarchy`, `buildHwHierarchy`) inside their respective components — only extract the generic primitives they share.

---

## Phase 2 — Shared Custom Hooks (extract repeated state patterns) ✅ DONE

Create hooks for state patterns that appear in 5+ components. Import them into existing components — no logic change, just location change.

---

### Task 2.1 — `hooks/useModalState.ts`

**Pattern found in:** 27+ files

This pattern appears constantly:
```tsx
const [isOpen, setIsOpen] = useState(false);
const [selectedItem, setSelectedItem] = useState<T | null>(null);
const handleOpen = (item: T) => { setSelectedItem(item); setIsOpen(true); };
const handleClose = () => { setIsOpen(false); setSelectedItem(null); };
```

**Hook to create:**
```ts
// hooks/useModalState.ts
function useModalState<T = void>()
// Returns: { isOpen, item, open(item), close() }
```

**Files that benefit most** (replace after creating):
- `ProjectView.tsx` — 4 modal state pairs
- `PricingReportConfig.tsx` — 2 modal state pairs
- `Dashboard.tsx` — 2 modal state pairs
- `HardwareSetsManager.tsx` — 1 modal state pair

---

### Task 2.2 — `hooks/useFetchMutation.ts`

**Pattern found in:** 12+ files

```tsx
const [isLoading, setIsLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
const run = async () => {
  setIsLoading(true); setError(null);
  try { /* fetch */ addToast({ type: 'success', ... }); }
  catch (err) { setError(...); addToast({ type: 'error', ... }); }
  finally { setIsLoading(false); }
};
```

**Hook to create:**
```ts
// hooks/useFetchMutation.ts
function useFetchMutation<TResult>(
  fn: () => Promise<TResult>,
  options?: { onSuccess?: (result: TResult) => void; successMessage?: string; errorMessage?: string }
)
// Returns: { run, isLoading, error, reset }
```

**Files that benefit most:**
- `DatabaseView.tsx` — delete + save operations
- `TeamManagement.tsx` — invite + role change
- `CompanySettingsForm.tsx` — save + logo upload
- `MasterItemFormModal.tsx` — create + edit

---

### Task 2.3 — `hooks/useSyncRef.ts`

**Pattern found in:** `ProjectView.tsx` (lines 99-108, 500-502)

```tsx
const dataRef = useRef<T[]>([]);
useEffect(() => { dataRef.current = data; }, [data]);
```

**Hook to create:**
```ts
// hooks/useSyncRef.ts
function useSyncRef<T>(value: T): React.RefObject<T>
// Always returns a ref whose .current is the latest value
```

This is a single-file utility but used 3 times in ProjectView alone and prevents stale closures in callbacks.

---

### Task 2.4 — `hooks/useTableFilters.ts`

**Pattern found in:** `Dashboard.tsx`, `DoorScheduleManager.tsx`, `DatabaseView.tsx`, `PricingReportConfig.tsx`

```tsx
const [searchQuery, setSearchQuery] = useState('');
const [filterA, setFilterA] = useState('all');
const filtered = useMemo(() =>
  items.filter(i =>
    i.name.includes(searchQuery) &&
    (filterA === 'all' || i.a === filterA)
  ), [items, searchQuery, filterA]);
```

**Hook to create:**
```ts
// hooks/useTableFilters.ts
function useTableFilters<T>(
  items: T[],
  filters: FilterDef<T>[]
)
// Returns: { filtered, searchQuery, setSearchQuery, filterValues, setFilter, resetFilters }
```

---

### Task 2.5 — `hooks/useInlineEditor.ts`

**Pattern found in:** `DoorScheduleManager.tsx`, `HardwareSetConfig.tsx`, `EnhancedDoorEditModal.tsx`

```tsx
const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
const [tempValue, setTempValue] = useState<string>('');
const startEdit = (id, field, current) => { setEditingCell({ id, field }); setTempValue(current); };
const cancelEdit = () => { setEditingCell(null); setTempValue(''); };
const commitEdit = async () => { /* save */ setEditingCell(null); };
```

**Hook to create:**
```ts
// hooks/useInlineEditor.ts
function useInlineEditor<TId = string, TField = string>()
// Returns: { editingCell, tempValue, setTempValue, startEdit, cancelEdit, isEditing(id, field) }
```

---

## Phase 3 — Inline Sub-component Extraction ✅ DONE

Extract components that are currently defined *inside* another component's file. Each extracted component gets its own file. The parent imports it — no logic change.

---

### Task 3.1 — `components/dashboard/ProjectCard.tsx`

**Currently in:** `views/Dashboard.tsx` line 139 (~200 lines inline)

**Extract to:** `components/dashboard/ProjectCard.tsx`

The `ProjectCard` component is a fully self-contained card UI with its own state (`showAssignMenu`, `isDeleteDialogOpen`, `isAssigning`). It only communicates with its parent via props. Perfect candidate for extraction.

**Props interface stays identical.** Just move the function definition to its own file and import it in `Dashboard.tsx`.

---

### Task 3.2 — `components/dashboard/DashboardFilters.tsx`

**Currently in:** `views/Dashboard.tsx` (filter bar JSX, ~40 lines, lines 621-660)

**Extract to:** `components/dashboard/DashboardFilters.tsx`

The filter bar (search input + member dropdown + view mode toggles) is a self-contained UI block. Extract it as a presentational component.

---

### Task 3.3 — `components/dashboard/KanbanColumn.tsx`

**Currently in:** `views/Dashboard.tsx` (kanban column JSX, repeated per column, lines 761-827)

**Extract to:** `components/dashboard/KanbanColumn.tsx`

Each kanban column renders the same structure: header + drop zone + cards list. Currently built inline inside a `.map()`. Extract as a component that receives column config + projects + drag handlers.

---

### Task 3.4 — `components/doors/ConfidenceIndicator.tsx`

**Currently in:** `components/DoorScheduleManager.tsx` line ~143 (~15 lines inline)

**Extract to:** `components/doors/ConfidenceIndicator.tsx`

A small indicator badge/icon showing assignment confidence level. Self-contained, used in table rows. No state.

---

### Task 3.5 — `components/pricing/MultiFilterSelect.tsx`

**Currently in:** `components/PricingReportConfig.tsx` lines 135-228 (~93 lines inline)

**Extract to:** `components/pricing/MultiFilterSelect.tsx`

A multi-select dropdown for filtering by dimension (material, floor, building). Used 3 times inside `PricingReportConfig`. Self-contained with its own open/close state.

---

### Task 3.6 — `components/pricing/PriceInput.tsx`

**Currently in:** `components/PricingReportConfig.tsx` lines 230-243 (~13 lines inline)

**Extract to:** `components/pricing/PriceInput.tsx`

Small currency input component. Used multiple times in pricing forms. No state.

---

### Task 3.7 — `components/pricing/PricingDetailModal.tsx`

**Currently in:** `components/PricingReportConfig.tsx` lines ~247-350 (~100+ lines inline)

**Extract to:** `components/pricing/PricingDetailModal.tsx`

Modal for showing detailed pricing breakdown per group. Has its own tab state. Self-contained once parent passes data + open/close props.

---

### Task 3.8 — `components/forms/DoorFormSection.tsx`

**Currently in:** `components/EnhancedDoorEditModal.tsx` (multiple inline `SectionHeader`, `SectionFields`, `ExcludedBanner` sub-components)

**Extract to:** `components/forms/DoorFormSection.tsx`

Group the section header + fields rendering into a reusable section wrapper. Used for door/frame/hardware sections inside the door edit modal.

---

## Phase 4 — Large File Decomposition

Split the largest files by responsibility. Each split creates new files; the original becomes a thin orchestrator that imports and composes them.

**Rule for this phase:** Start with the easiest extraction (isolated state block or isolated UI section). Never touch the data flow.

---

### Task 4.1 — Split `views/Dashboard.tsx` (933 → ~400 lines) ✅ DONE

**After Phase 3 tasks 3.1–3.3 are done**, Dashboard will already be significantly reduced. This task handles the remaining logic.

**Extract:** `hooks/useDashboardState.ts`
- Drag-drop state (`draggedProjectId`, `dropTargetStatus`)
- Optimistic status overrides (`optimisticStatuses`, `updatingProjectIds`)
- The `handleProjectDropToStatus` handler
- The `applyProjectStatusOverrides` and `buildProjectStats` pure functions move to `utils/dashboardUtils.ts`

**Result:** `Dashboard.tsx` becomes the layout/render only. State lives in the hook. No behaviour change.

---

### Task 4.2 — Split `views/ProjectView.tsx` (2104 → ~600 lines) ✅ DONE

This is the largest file. Split in 4 sub-tasks, each independently completable:

#### Task 4.2a — Extract `hooks/useProjectData.ts`
Extracts initial data loading + polling:
- `loadProjectData()` async function
- `startPollingForResult()` and polling interval
- `isDataLoading` state
- `isPollingForResult` state
- `reloadDoorSchedule` callback

**ProjectView consumes:** `const { hardwareSets, doors, trashItems, isDataLoading, isPollingForResult, setHardwareSets, setDoors, setTrashItems } = useProjectData(project.id)`

#### Task 4.2b — Extract `hooks/useProjectPersistence.ts`
Extracts save/persist logic:
- `saveToFinalJson()`
- `saveToHardwarePdf()`
- `performSave()`
- `saveStatus` state
- Auto-save `useEffect` with debounce

#### Task 4.2c — Extract `hooks/useProjectUploads.ts`
Extracts all file upload handling:
- `processHardwarePdf()`
- `processDoorSchedule()`
- `processCombinedUpload()`
- `handleCombinedProcessClick()`
- All upload-related state (`isCombinedProcessing`, `combinedProgress`, etc.)
- `processingTasks` state + helpers

#### Task 4.2d — Extract `hooks/useTrashUndo.ts`
Extracts trash + undo system:
- `trashItems` state
- `undoToasts` state
- `pushUndoToast`, `dismissUndoToast`
- `handleDeleteSet`, `handleBulkDeleteSets`
- `handleDeleteDoors`
- `handleRestoreFromTrash`, `handlePermanentDelete`, `handleClearAllTrash`
- `buildTrashItemForSet`

---

### Task 4.3 — Split `components/DoorScheduleManager.tsx` (1591 → ~613 lines) ✅ DONE

#### Task 4.3a — Extract `components/doors/DoorTableHeader.tsx` ✅
Sticky thead row: checkbox, renderHeader per column, fixed Assigned Set + Action headers. Pure render.

#### Task 4.3b — Extract `components/doors/DoorTableRow.tsx` ✅
Single door `<tr>` with per-section exclude logic, assigned set badge, and action buttons.

#### Task 4.3c — Extract `hooks/useDoorTableState.tsx` ✅
All state, effects, computed values, handlers, renderCell, and renderHeader. Also exports ALL_AVAILABLE_COLUMNS, DOOR/FRAME/HARDWARE_SECTION_KEYS, ColumnDef, CustomColumn, StatusFilter so both the hook and the component can use them.

---

### Task 4.4 — Split `components/PricingReportConfig.tsx` (2061 → ~561 lines) ✅ DONE

**After Phase 3 tasks 3.5–3.7 are done**, inline components are already extracted. This task handles logic.

#### Task 4.4a — Extract `components/pricing/PricingHierarchyView.tsx` ✅
The recursive tree/hierarchy display for pricing groups. Receives computed hierarchy nodes + callbacks. Pure render.

#### Task 4.4b — Extract `hooks/usePricingFilters.ts` ✅
Material + floor + building filter state with `useMemo` for filtered results. Uses `useTableFilters` from Task 2.4.

#### Task 4.4c — Extract `hooks/usePricingExport.ts` ✅
All export handlers (Excel, PDF, proposal) + their loading states. These are fully isolated from the display logic.

> Also extracted: `hooks/usePricingProposal.ts` (proposal state, 3 API effects, all handlers, derived totals) and `components/pricing/PricingTableRows.tsx` (DoorRow, HardwareRow, TH, TD).

---

### Task 4.5 — Split `components/DoorScheduleConfig.tsx` (1461 → ~760 lines) ✅ DONE

#### Task 4.5a — Extract `hooks/useDoorAggregation.ts` ✅
- `aggregateDoorsBySelectedColumns()` logic
- `getSectionValue()` (use `utils/doorUtils.ts` from Task 1.1)
- Grouping state (`selectedGrouping`, `selectedColumns`)

#### Task 4.5b — Extract `components/doorSchedule/DoorGroupingControls.tsx` ✅
The column/grouping selection UI panel. Receives current selection + onChange callbacks. Pure render.

#### Task 4.5c — Extract `hooks/useElevationImages.ts` ✅
- Fetch + cache elevation type images
- `imageToDataUrl()` (use `utils/imageUtils.ts` from Task 1.3)
- Returns a `Map<string, { dataUrl, width, height }>`

> Also extracted: `components/doorSchedule/doorScheduleTypes.ts` (SectionKey, ExportFormat, GroupLevel, DoorGroup, AggregatedDoorRow, GROUPING_FIELDS, SECTION_DEFS, CANONICAL_COLUMN_ORDER, GROUPING_SECTIONS) and `utils/doorScheduleUtils.ts` (buildColId, parseColId, aggregateDoorsBySelectedColumns, getRowValue, getGroupValue, deriveColumnGroups, groupDoorsByLevels, makeGroupId).

---

## Phase 5 — EnhancedDoorEditModal Decomposition (805 → ~230 lines) ✅ DONE

**After Phase 3 Task 3.8.**

#### Task 5.1 — Extract `components/forms/DoorBasicSection.tsx` ✅
Fields: door tag, location, quantity, status. Receives field values + onChange. No internal state.
Also exports: `BASIC_INFO_GROUPS`, `DEFAULT_BASIC_INFO_SEC`.

#### Task 5.2 — Extract `components/forms/DoorDimensionSection.tsx` ✅
Fields: width, height, thickness, leaf count, material. Receives field values + onChange. No internal state.
Also exports: `DOOR_GROUPS`, `DEFAULT_DOOR_SEC`.

#### Task 5.3 — Extract `components/forms/DoorHardwareSection.tsx` ✅
Hardware tab: ExcludedBanner, IncludeExcludeSelect, Assignment controls grid, matched set items table, hardware prep display.
Also exports: `inputCls`.

#### Task 5.4 — Extract `hooks/useDoorFormState.ts` ✅
All the controlled form state for the door edit modal:
- Section state (`basicInfoSec`, `doorSec`, `frameSec`) with 3-tier fallback initialization
- `isDirty` detection via snapshot refs
- `validateDoor` effect → `validationResults`
- Derived flags: `doorExcluded`, `frameExcluded`, `hwExcluded`, `matchedSet`
- Handlers: `updateBasicInfoSec`, `updateDoorSec`, `updateFrameSec`, `updateField`, `handleSave`
Also exports: `FRAME_GROUPS` (used by the frame tab `<SectionFields>` in the main component).

---

## Implementation Order

Work through tasks strictly in this sequence — each phase unblocks the next:

```
Phase 1 (utils)        → Tasks 1.1 → 1.2 → 1.3 → 1.4
Phase 2 (hooks)        → Tasks 2.1 → 2.2 → 2.3 → 2.4 → 2.5
Phase 3 (inline comps) → Tasks 3.1 → 3.2 → 3.3 (Dashboard group)
                              3.4           (DoorScheduleManager group)
                              3.5 → 3.6 → 3.7 (PricingReportConfig group)
                              3.8           (EnhancedDoorEditModal group)
Phase 4 (large splits) → Task 4.1 (after 3.1–3.3)
                         Task 4.2a → 4.2b → 4.2c → 4.2d (ProjectView)
                         Task 4.3a → 4.3b → 4.3c (DoorScheduleManager)
                         Task 4.4a → 4.4b → 4.4c (PricingReportConfig)
                         Task 4.5a → 4.5b → 4.5c (DoorScheduleConfig)
Phase 5               → Tasks 5.1 → 5.2 → 5.3 → 5.4 (EnhancedDoorEditModal)
```

---

## Rules for Every Task

1. **Copy, then delete** — when extracting a component/hook, create the new file first with the moved code, confirm it compiles, then remove the inline copy from the original file
2. **One task = one PR** — each task is independently mergeable
3. **No renames during extraction** — function names, prop names, and variable names stay identical
4. **Export consistency** — all new components use named exports (`export function Foo`), matching the rest of the codebase
5. **Dark mode tokens** — any new JSX must use CSS variable tokens, never hardcoded Tailwind colors
6. **Type-check after every task** — `npx tsc --noEmit` must pass before moving to the next task
7. **No new state** — extracted hooks must manage exactly the same state that was inline before, nothing added
