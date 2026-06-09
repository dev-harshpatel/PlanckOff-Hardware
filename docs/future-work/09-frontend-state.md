# Frontend State Management — Context Sprawl, Hooks, Performance

## Current State

The frontend works, but its state management has grown organically and now has several patterns that will make it harder to maintain and debug as the UI grows.

- 7 React Context providers stacked in `app/providers.tsx`
- 26 custom hooks, many with overlapping responsibilities
- Component props drilling in several places (10+ props passed through 3 levels)
- Inline event handlers that re-create function references on every render
- `useEffect` dependency arrays that are incomplete (ESLint rule disabled)
- No global state management library — everything is Context + useState + useReducer

---

## 1. Context Provider Explosion

**File:** `app/providers.tsx`

```tsx
<AuthProvider>
  <ToastProvider>
    <NavigationLoadingProvider>
      <ProjectProvider>
        <ProcessingWidgetProvider>
          <BackgroundUploadProvider>
            <AnnouncementProvider>
              {children}
            </AnnouncementProvider>
          </BackgroundUploadProvider>
        </ProcessingWidgetProvider>
      </ProjectProvider>
    </NavigationLoadingProvider>
  </ToastProvider>
</AuthProvider>
```

This is the classic "wrapper hell" problem. Every context re-renders its subtree when its value changes. If `ToastContext` updates (a new toast), everything inside it re-renders — including `ProjectProvider`, `ProcessingWidgetProvider`, and all their children — unless those contexts are memoized correctly.

**Issues:**
- `AnnouncementContext` appears unused — no components consume it
- `BackgroundUploadContext` and `ProcessingWidgetContext` overlap in concern (both track upload/processing state)
- `NavigationLoadingContext` duplicates what Next.js's `useRouter` `isPending` state provides natively in the App Router

**Fix plan:**

1. **Remove `AnnouncementContext`** — it's unused
2. **Merge `BackgroundUploadContext` and `ProcessingWidgetContext`** — they both track ongoing async operations; unify into one `AsyncOperationsContext`
3. **Remove `NavigationLoadingContext`** — replace with `useTransition` from React 18 in the navigation link components
4. **Split `ProjectContext`** — it currently holds projects list, trash, master hardware inventory, settings, and realtime subscriptions. Split into:
   - `ProjectListContext` — dashboard-level (projects, trash)
   - `ActiveProjectContext` — project-detail-level (current project's doors, hardware, settings)

---

## 2. Missing React.memo and useCallback on Expensive Components

Heavy components re-render on every parent state change:

```tsx
// components/doors/DoorTableRow.tsx — 500 lines, renders for every row
// This re-renders on every parent state change, even if the door data didn't change

// Fix: wrap in React.memo
export const DoorTableRow = React.memo(function DoorTableRow(props: DoorTableRowProps) {
  // ...
}, (prevProps, nextProps) => {
  // Custom comparison — only re-render if the door data changed
  return prevProps.door.id === nextProps.door.id &&
         prevProps.door.updatedAt === nextProps.door.updatedAt &&
         prevProps.isSelected === nextProps.isSelected &&
         prevProps.isEditing === nextProps.isEditing;
});
```

Event handlers passed as props need `useCallback` or they break memo:

```tsx
// Without useCallback, a new function is created every render, breaking React.memo
const handleEdit = useCallback((doorId: string) => {
  setEditingDoorId(doorId);
}, []); // stable reference

// Pass stable handler to memoized row
<DoorTableRow door={door} onEdit={handleEdit} />
```

**Where to prioritize:** The door table is the most rendered component (one `DoorTableRow` per door, 50–200 doors per project). Memoizing it will have the most noticeable impact.

---

## 3. useEffect Dependency Arrays

Several hooks disable the `react-hooks/exhaustive-deps` rule or have incorrect dependencies. This causes stale closures — the effect captures an old value and never updates.

Example of stale closure bug:
```typescript
// hooks/useProjectData.ts
const [filters, setFilters] = useState(defaultFilters);

useEffect(() => {
  // 'filters' is captured at mount — never updates
  fetchProjectData(filters);
}, []); // Missing 'filters' in deps
```

If `filters` changes, `fetchProjectData` is not re-run with the new filters. The UI shows stale data.

**The correct fix** — not just adding `filters` to the deps array (which would cause an infinite loop if `filters` is an object), but stabilizing the reference:

```typescript
const filtersRef = useRef(filters);
filtersRef.current = filters;

useEffect(() => {
  fetchProjectData(filtersRef.current); // always reads current value
}, []); // stable: mount-only fetch
```

Or use a reducer pattern where the effect depends on a derived primitive:

```typescript
useEffect(() => {
  fetchProjectData(filters);
}, [JSON.stringify(filters)]); // hack, but avoids object identity issues
// Better: useMemo to create a stable filters key
```

**Action:** Re-enable `react-hooks/exhaustive-deps` as a warning, fix all reported issues.

---

## 4. Props Drilling

Several components receive more than 8 props, many of which are just passed down to a child:

```tsx
// components/hardware/HardwareSetsManager.tsx
<HardwareSetConfig
  set={selectedSet}
  projectId={projectId}
  onSave={handleSave}
  onDelete={handleDelete}
  onVariantCreate={handleVariantCreate}
  onPrepRegenerate={handlePrepRegenerate}
  userRole={userRole}
  isReadOnly={isReadOnly}
  masterHardwareItems={masterHardwareItems}
  elevationTypes={elevationTypes}
/>
```

`HardwareSetConfig` then passes most of these down to `HardwareGroupTable`, which passes some to `HardwareItemRow`.

**Fix:** Use a `HardwareSetContext` at the `HardwareSetsManager` level. Child components consume it directly:

```tsx
// Create context for the active hardware set editing session
const HardwareSetEditContext = createContext<HardwareSetEditState | null>(null);

function HardwareSetsManager({ projectId }: Props) {
  const [selectedSet, setSelectedSet] = useState<HardwareSet | null>(null);
  // ... other state
  
  return (
    <HardwareSetEditContext.Provider value={{ selectedSet, projectId, userRole, isReadOnly, ... }}>
      <SetList />
      <HardwareSetConfig />  {/* No more props waterfall */}
    </HardwareSetEditContext.Provider>
  );
}
```

---

## 5. State Colocation

Some state lives too high in the component tree:

- `isEditing` for individual door rows lives in `ProjectContext` — it should live in `DoorTableRow` or a table-level hook
- Modal open/close state for hardware set dialogs lives in `HardwareSetsManager` — it should be local to each modal trigger

Moving state down means fewer re-renders when that state changes (only the component that owns the state re-renders, not the whole context subtree).

---

## 6. Inconsistent Loading State Patterns

Different components handle loading in different ways:

```tsx
// Pattern A — boolean flag
const [isLoading, setIsLoading] = useState(false);
if (isLoading) return <Spinner />;

// Pattern B — skeleton components
if (!data) return <DashboardSkeleton />;

// Pattern C — no loading state
const data = useSomeHook(); // renders empty briefly, then fills in

// Pattern D — Suspense (not used yet)
```

The inconsistency means the user sees different loading experiences depending on which component they're looking at.

**Fix:** Pick one pattern and stick to it:
- Use React Suspense + `loading.tsx` for page-level loading (App Router pattern)
- Use skeleton components (not spinners) for component-level loading
- Reserve spinners for action feedback (button saving state)

---

## 7. Form State Management

Door edit forms, hardware set forms, and proposal forms each implement their own form state:

```typescript
// Each form has this pattern repeated:
const [name, setName] = useState(initial.name);
const [manufacturer, setManufacturer] = useState(initial.manufacturer);
const [description, setDescription] = useState(initial.description);
// ... 15 more fields

const handleSubmit = () => {
  // manual validation
  if (!name.trim()) setNameError('Name is required');
  // ...
};
```

This is ~50 lines of boilerplate per form. Use React Hook Form:

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const { register, handleSubmit, formState: { errors } } = useForm<HardwareItemFormData>({
  resolver: zodResolver(HardwareItemSchema),
  defaultValues: initial,
});
```

Benefits:
- Removes all the manual `useState` for each field
- Validation via the same Zod schemas used in API routes (single source of truth)
- Better performance (field updates don't re-render the whole form)
- Built-in `isDirty`, `isSubmitting`, `isValid` states

---

## 8. Keyboard Shortcut Conflicts

`useKeyboardShortcuts.ts` registers window-level `keydown` listeners. If multiple components register shortcuts for the same key, they all fire. There is no shortcut registry or conflict detection.

Example: `Esc` closes a modal, but also cancels door cell editing. If both are registered independently, pressing `Esc` does both — or whichever fires last wins unpredictably.

**Fix:** Use a shortcut registry that handles priority:

```typescript
// lib/shortcuts/registry.ts
type ShortcutHandler = (event: KeyboardEvent) => boolean; // return true to stop propagation

class ShortcutRegistry {
  private handlers: Map<string, Array<{ handler: ShortcutHandler; priority: number }>> = new Map();

  register(key: string, handler: ShortcutHandler, priority = 0): () => void {
    const list = this.handlers.get(key) ?? [];
    list.push({ handler, priority });
    list.sort((a, b) => b.priority - a.priority); // highest priority first
    this.handlers.set(key, list);
    return () => this.unregister(key, handler); // cleanup
  }

  handle(event: KeyboardEvent): void {
    const key = buildKey(event); // e.g., 'Ctrl+S', 'Escape'
    for (const { handler } of this.handlers.get(key) ?? []) {
      if (handler(event)) break; // stop if handler consumed the event
    }
  }
}
```

---

## Priority Order

1. **Fix useEffect dependencies** — causes subtle bugs that are hard to reproduce
2. **Remove unused contexts** (AnnouncementContext, merge ProcessingWidget + BackgroundUpload)
3. **Memoize DoorTableRow** — most impactful performance fix
4. **React Hook Form for forms** — removes significant boilerplate
5. **Split ProjectContext** — reduces re-render surface
6. **Fix props drilling in HardwareSetsManager** — maintainability
7. **Shortcut registry** — prevents conflict bugs
8. **Standardize loading states** — consistency

Most of these are independent and can be done one component at a time during normal feature work. Don't try to refactor all at once.
