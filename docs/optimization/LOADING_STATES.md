# Loading States — Optimization Plan

> **Branch:** `optimization`
> **Goal:** Eliminate all blank flashes, silent loads, and unresponsive button presses across the application. Implement page-by-page, without breaking anything.

---

## Audit Summary

### What already works correctly

Before listing gaps, here's what the codebase already does right — **do not change these**:

| Area | Component/File | Status |
|---|---|---|
| `<Button>` | `components/ui/button.tsx` | Already supports `loading` + `loadingText` props with built-in spinner |
| `<Spinner>` | `components/ui/spinner.tsx` | Reusable, size-variant spinner (xs/sm/md/lg) |
| `<RouteLoadingState>` | `components/RouteLoadingState.tsx` | Full-page loading card with spinner + message |
| `<ReportPageSkeleton>` | `components/skeletons/ReportPageSkeleton.tsx` | Skeleton used by all report pages |
| Report pages (4) | `app/project/[id]/reports/*/page.tsx` | All use `ReportPageSkeleton` — complete |
| `<TrashBin>` | `components/TrashBin.tsx` | Per-item `restoringId`/`deletingId` with spinner on button |
| `<NewProjectModal>` | `components/NewProjectModal.tsx` | `loading` prop passed through — fields disabled, button spins |
| `DatabaseView` | `views/DatabaseView.tsx` | Initial `Loader2` spinner; per-row `deletingId` spinner on delete button |
| `CompanySettingsForm` | `components/CompanySettingsForm.tsx` | Full skeleton on load, save indicator, logo upload spinner |
| `ProjectView` | `views/ProjectView.tsx` | `SaveStatusIndicator`; upload/processing handled via BackgroundUpload context |
| Team page | `app/team/page.tsx` | `Loader2` spinner while fetching members |
| Login page | `app/(auth)/login/page.tsx` | Button shows "Signing in…" + disabled during submit |
| Project page | `app/project/[id]/page.tsx` | `<RouteLoadingState>` shown while `!projectsHydrated` |

---

## Identified Gaps (ordered by user-visible impact)

### GAP-1 — Dashboard: Projects flash in from nothing (CRITICAL)

**Severity:** Critical — This is the exact issue the user reported.

**Root Cause:**
`app/page.tsx` consumes `projects` from `useProject()` but **never checks `projectsHydrated`**. The context starts with `projects = []` and `projectsHydrated = false`. The `<Dashboard>` component renders immediately with zero projects, showing an empty kanban/grid. When the API call resolves (~300-800ms), all projects pop in at once with no transition.

**Files involved:**
- `app/page.tsx` — missing `projectsHydrated` guard
- `views/Dashboard.tsx` — receives `projects=[]` with no skeleton

**What the fix looks like:**
```
app/page.tsx
  → check projectsHydrated from useProject()
  → if false: render <DashboardSkeleton /> (new component, see below)
  → if true: render <Dashboard ...>
```

**New component needed:** `components/skeletons/DashboardSkeleton.tsx`
- Mirrors the dashboard layout: header with stat pills, filter bar, kanban columns with card placeholders
- Uses `<Skeleton>` from `components/ui/skeleton.tsx`
- Two variants: kanban (5 columns with shimmer cards) and list (table rows)
- Since the user defaults to kanban/grid, start with that variant

---

### GAP-2 — Dashboard: Team members filter silently empty

**Severity:** Low — doesn't break anything but the "Assign" dropdown in project cards starts empty

**Root Cause:**
`app/page.tsx` lines 23-38 fires a `fetch('/api/team/members')` with no loading state. The member filter dropdown (`SelectDropdown`) shows "All Members" immediately but the list of real members isn't available until the fetch resolves.

**Files involved:**
- `app/page.tsx` — no `isLoadingTeamMembers` state

**What the fix looks like:**
```
app/page.tsx
  → add isLoadingTeamMembers state (default true)
  → set to false after fetch resolves (both success and catch)
  → pass isLoadingTeamMembers to Dashboard
  → Dashboard: disable member filter SelectDropdown while loading
  → Optionally: show a skeleton in the dropdown trigger
```

Note: This is a background fetch that runs alongside the project fetch. Don't block the whole page for this — just disable the filter control.

---

### GAP-3 — DatabaseView: Table loads with a plain spinner, not a skeleton

**Severity:** Low — functional, but inconsistent with the rest of the app

**Current state (`views/DatabaseView.tsx` line 327-332):**
```tsx
{isLoading && (
  <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-faint)]">
    <Loader2 className="w-5 h-5 animate-spin" />
    <span className="text-sm">Loading database…</span>
  </div>
)}
```

**What the fix looks like:**
Create `components/skeletons/DatabaseSkeleton.tsx` — skeleton that shows the table structure (4 columns × 8 rows) with shimmer animation. Replace the `Loader2` block with `<DatabaseSkeleton />`.

This uses the same `<Skeleton>` primitive as the report skeletons — consistent visual language.

---

### GAP-4 — ProjectView: Merge/Export button states need verification

**Severity:** Medium — async operations that may leave buttons looking clickable mid-action

**Context:**
`ProjectView` handles uploads via the `BackgroundUploadContext` (Web Worker), exports via `generateReport()`, and hardware merges via long API calls. The `ProcessingWidget` overlay handles visual feedback for long-running ops.

**What needs checking when implementing:**
- The "Merge" button (`GitMerge` icon) — should disable while any processing task is active
- The export/PDF download buttons — should show spinner during generation
- The "Upload" file input trigger buttons — already feed into `processingTasks`

**Implementation approach:** These are already partially covered by `isDataLoading || isPollingForResult` being passed to child components as the `isLoading` prop. Audit the actual button elements in the header toolbar during implementation to confirm all are wired.

---

## Implementation Order

Implement one step at a time. Test each before moving to the next.

```
Step 1  →  Create DashboardSkeleton component
Step 2  →  Wire projectsHydrated guard in app/page.tsx (fixes GAP-1)
Step 3  →  Add isLoadingTeamMembers to app/page.tsx (fixes GAP-2)
Step 4  →  Create DatabaseSkeleton component
Step 5  →  Replace Loader2 block in DatabaseView (fixes GAP-3)
Step 6  →  Audit ProjectView toolbar buttons (GAP-4 investigation + fix)
```

---

## Step 1 — Create `<DashboardSkeleton>`

**File to create:** `components/skeletons/DashboardSkeleton.tsx`

The skeleton should visually match the real Dashboard's structure:

```
┌─────────────────────────────────────────────────────────┐
│ [icon] Projects Dashboard                    [Trash] [+] │  ← header skeleton
│ [●Active 0] [●Under Review 0] [●Submitted 0] …          │  ← stat pill skeletons
├─────────────────────────────────────────────────────────┤
│ [Search…]           [Filter by Member ▼]    [⊞] [☰]    │  ← filter bar skeleton
├────────┬────────┬────────┬────────┬──────────────────────┤
│Active  │Review  │Submit  │On Hold │Archived              │  ← 5 kanban column headers
│        │        │        │        │                      │
│[card]  │[card]  │        │        │                      │  ← shimmer cards
│[card]  │        │        │        │                      │
│[card]  │        │        │        │                      │
└────────┴────────┴────────┴────────┴──────────────────────┘
```

**Rules:**
- Use `<Skeleton>` from `components/ui/skeleton.tsx` (same as ReportPageSkeleton)
- Match the exact header color tokens: `bg-[var(--primary-bg)]`, border `border-[var(--primary-border)]`
- Shimmer cards: 2-3 cards per column, each with a title line, meta row, and footer line
- No animation differences — use the same shimmer as existing skeletons
- Keep it under 120 lines

---

## Step 2 — Wire `projectsHydrated` in `app/page.tsx`

**File:** `app/page.tsx`

**Current code (simplified):**
```tsx
export default function HomePage() {
  const { projects, trash, ... } = useProject();
  // ...
  return <Dashboard projects={projects} ... />;
}
```

**Target code:**
```tsx
export default function HomePage() {
  const { projects, trash, projectsHydrated, ... } = useProject();
  // ...
  if (!projectsHydrated) {
    return <DashboardSkeleton />;
  }
  return <Dashboard projects={projects} ... />;
}
```

**Important:** The `dynamic(() => import('@/views/Dashboard'), { ssr: false })` import wraps `<Dashboard>`. The skeleton does NOT need to be dynamic — it has no browser-only dependencies so it can render on server safely. Import it normally.

**Edge case:** If `projectsHydrated` becomes `true` but `projects` is still `[]` (empty project list), the real dashboard should render with the empty state message ("No projects found"), not the skeleton. The skeleton only guards against the loading phase.

---

## Step 3 — Team members loading in `app/page.tsx`

**File:** `app/page.tsx`

**Change:**
```tsx
const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
const [isLoadingTeamMembers, setIsLoadingTeamMembers] = useState(true);

useEffect(() => {
  fetch('/api/team/members', { credentials: 'include' })
    .then(res => res.ok ? res.json() : { data: [] })
    .then((json: ...) => {
      setTeamMembers(...);
    })
    .catch(() => {})
    .finally(() => setIsLoadingTeamMembers(false));
}, []);
```

**Pass to Dashboard:**
```tsx
<Dashboard
  ...
  isLoadingTeamMembers={isLoadingTeamMembers}
/>
```

**In `views/Dashboard.tsx`:**
- Add `isLoadingTeamMembers?: boolean` to `DashboardProps`
- Disable the `<SelectDropdown>` member filter while `isLoadingTeamMembers` is true
- Optionally show a shimmer in place of the filter text

**What NOT to do:** Don't block the whole dashboard render waiting for team members. Projects and team members load in parallel. The dashboard should appear with projects as soon as `projectsHydrated` is true, even if team members aren't ready.

---

## Step 4 — Create `<DatabaseSkeleton>`

**File to create:** `components/skeletons/DatabaseSkeleton.tsx`

Structure:
```
┌──────────────────────────────────────────┐
│ [icon] Master Hardware Database  [badge] │  ← header skeleton
├──────────────────────────────────────────┤
│ [Search…]           [Export] [+ Create]  │  ← toolbar skeleton
├────────────┬────────────┬─────┬──────────┤
│ Item Name  │Manufacturer│Desc │ Finish   │  ← table header (real text or skeleton)
├────────────┼────────────┼─────┼──────────┤
│ ████████   │ ██████     │████ │ ███      │  ← 8 shimmer rows
│ ████       │ █████████  │████ │ █████    │
│ ...                                      │
└──────────────────────────────────────────┘
```

**Rules:**
- 8 shimmer rows is a good default
- Keep column width proportions similar to real table
- Same `<Skeleton>` primitive as other skeletons

---

## Step 5 — Replace `DatabaseView` loading block

**File:** `views/DatabaseView.tsx` lines 327-332

**Change:**
Replace:
```tsx
{isLoading && (
  <div className="flex items-center justify-center py-20 gap-2 text-[var(--text-faint)]">
    <Loader2 className="w-5 h-5 animate-spin" />
    <span className="text-sm">Loading database…</span>
  </div>
)}
```

With:
```tsx
{isLoading && <DatabaseSkeleton />}
```

The error state (`!isLoading && loadError`) and the table itself stay unchanged.

---

## Step 6 — ProjectView toolbar button audit

**File:** `views/ProjectView.tsx`

During this step, go through the top toolbar buttons (Back, Reports, Merge, Export, Upload triggers) and confirm each one:

1. Is disabled while a relevant async operation is in progress?
2. Shows a spinner icon (or `Loader2`) when active?
3. Does not allow double-submission?

The relevant loading states already in ProjectView to use:
- `isDataLoading` — data is being fetched or processed
- `isPollingForResult` — waiting for server to finish processing
- `processingTasks` — from `ProcessingWidgetContext`, tracks active background tasks
- `saveStatus` — `'idle' | 'saving' | 'saved' | 'error'`

Document any buttons that are missing loading feedback and fix them using the existing `<Button loading={...}>` pattern or inline `disabled + Loader2` for icon-only buttons.

---

## Common component usage rules

When wiring loading states, use these patterns consistently:

### For full buttons (text + possible icon):
```tsx
// Use the <Button> component — it already handles everything
<Button loading={isSaving} loadingText="Saving…">
  Save
</Button>
```

### For icon-only buttons (no <Button> wrapper):
```tsx
<button
  onClick={handleAction}
  disabled={isLoading}
  className="... disabled:opacity-50"
>
  {isLoading
    ? <Loader2 className="w-4 h-4 animate-spin" />
    : <SomeIcon className="w-4 h-4" />
  }
</button>
```

### For page-level loading (data fetch in-flight):
```tsx
// Use RouteLoadingState for a full-page wait
if (!projectsHydrated) {
  return <RouteLoadingState title="Loading projects" message="..." />;
}

// Use a skeleton component for richer layouts
if (isLoading) {
  return <DashboardSkeleton />;
}
```

### For inline section loading (partial page):
```tsx
// Use Spinner directly
{isLoading && (
  <div className="flex justify-center py-8">
    <Spinner size="md" className="text-[var(--text-faint)]" />
  </div>
)}
```

---

## Constraints / Rules

- **Dark mode always**: All new skeleton components must use `bg-[var(--bg)]`, `bg-[var(--primary-bg)]`, `border-[var(--border)]` etc. No hardcoded Tailwind color classes.
- **No new React Contexts**: Use existing `projectsHydrated`, `isAuthenticated`, etc.
- **No localStorage**: This optimization work touches UI only — no data layer changes.
- **Don't break optimistic updates**: The Dashboard's drag-drop status updates use optimistic state. Don't add loading states that interfere with that flow.
- **Incremental**: Implement and test one step at a time. Each step is independently mergeable.
- **Skeleton vs Spinner**: Use a skeleton when the layout is known (page-level or section-level data). Use a spinner when the action is brief or the container size is dynamic (button actions, inline saves).
