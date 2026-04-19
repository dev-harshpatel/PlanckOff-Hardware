# Project View — UI/UX Redesign Spec

> Philosophy: Cal.com energy. Clean, dense, functional. Every pixel earns its place.
> No decorative color. One neutral palette. Data is the hero.

---

## 1. Component Library

**Use: shadcn/ui** (built on Radix UI + Tailwind)

Why shadcn over others:
- Copy-paste into your codebase — you own the code, no black-box library
- Radix primitives = accessible by default (keyboard nav, ARIA, focus traps)
- Looks exactly like cal.com / Vercel dashboard style
- Works with your existing Tailwind setup
- Zero bundle overhead for unused components

**Install once:**
```bash
npx shadcn@latest init
```

**Components to pull in for this page:**
```bash
npx shadcn@latest add table tabs badge button input skeleton tooltip
npx shadcn@latest add dialog sheet command separator progress
npx shadcn@latest add dropdown-menu alert collapsible card
```

---

## 2. Design Tokens (Replace Current)

### Color — Neutral-first

```
Background:     #FAFAFA  (zinc-50)
Surface:        #FFFFFF  (white)
Border:         #E4E4E7  (zinc-200)
Border subtle:  #F4F4F5  (zinc-100)
Text primary:   #09090B  (zinc-950)
Text secondary: #71717A  (zinc-500)
Text muted:     #A1A1AA  (zinc-400)

Accent (one):   #18181B  (zinc-900) — used for primary buttons only
Success:        #16A34A  (green-600)
Warning:        #CA8A04  (yellow-600)
Danger:         #DC2626  (red-600)
```

No blues, no purples, no gradients. Monochrome with purpose.

### Typography

```
Font:     Inter (already common in Next.js projects)
Sizes:    text-xs (11px) for table data
          text-sm (13px) for body / labels
          text-base (15px) for headings
          text-lg (18px) for panel titles
Weight:   400 body, 500 labels, 600 headings, 700 page title only
```

### Spacing — 4pt grid, be generous with internal padding

```
Panel padding:   p-6
Table cell:      px-4 py-2.5
Section gap:     gap-6
Border radius:   rounded-md (6px) — nothing more
```

---

## 3. Page Layout Redesign

### Current problems
- Top bar has too many items crammed together
- Split view panels feel like floating boxes, not a unified workspace
- No visual hierarchy between the two panels
- View mode switcher is mid-page with no clear affordance

### Redesigned layout

```
┌──────────────────────────────────────────────────────┐
│  HEADER (48px)                                       │
│  ← Project Name        [Analysis] [Reports]  [Save]  │
├──────────────────────────────────────────────────────┤
│  TOOLBAR (40px)                                      │
│  Hardware Sets (22)  |  Door Schedule (40)           │
│                              [⊞ Split] [◧] [◨]       │
├─────────────────────┬────────────────────────────────┤
│                     │                                │
│  HARDWARE SETS      │  DOOR SCHEDULE                 │
│  PANEL              │  PANEL                         │
│                     │                                │
│  (resizable)        │  (resizable)                   │
│                     │                                │
└─────────────────────┴────────────────────────────────┘
```

**Header (48px, border-bottom)**
- Left: `← ` + project name (clickable, goes to dashboard)
- Right: Ghost button "Analyze Image", Ghost button "Reports", then `|` divider, then Save status indicator
- Remove the view mode switcher from here — move it to toolbar

**Toolbar (40px, bg-zinc-50 border-bottom)**
- Left: Two stat pills — `Hardware Sets · 22` and `Door Schedule · 40 doors` — these are the scoreboard
- Right: Three icon-only toggle buttons for view mode (split / hardware only / doors only)

---

## 4. Hardware Sets Panel

### Current problems
- Upload area is a draggable box that floats awkwardly
- Expanded row reveals items in a raw list — hard to scan
- No empty state beyond a spinner
- Bulk actions appear randomly when rows are selected

### Redesigned panel

```
┌─────────────────────────────────────────────────────┐
│ Hardware Sets                    [+ Add] [↑ Upload] │
│ ─────────────────────────────────────────────────── │
│ [🔍 Search sets...]                    [↑↓ Sort ▾]  │
│ ─────────────────────────────────────────────────── │
│ □  SET     ITEMS   DOORS   NOTES                    │
│ ─────────────────────────────────────────────────── │
│ □  AD01b     8      3     Storeroom Lockset         │
│ □  AD02      6      2     —                         │
│ □  SE02a    12      5     Weatherstrip variant      │
│    ↳ [Hardware Items tab] [Doors tab]               │
│       ┌────────────────────────────────────────┐    │
│       │ QTY  ITEM          MFR      FINISH      │    │
│       │  1   Hinge         Hager    652         │    │
│       │  1   Lockset       Schlage  626         │    │
│       └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
```

**Key changes:**
1. **Panel header** — title left, `[+ Add Set]` + `[↑ Upload PDF]` buttons right. Upload is a button, not a drag zone (drag zone still works underneath).
2. **Table** — shadcn `Table` component. Sticky header. Clean `border-b border-zinc-100` between rows.
3. **Set name badge** — `font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded` — looks like a code badge, immediately distinguishable.
4. **Expanded row** — uses shadcn `Tabs` (Hardware Items / Assigned Doors). No accordion weirdness. Inline, same width as row, subtle `bg-zinc-50` background.
5. **Bulk action bar** — only appears when rows are checked. Slides down from top of table as a sticky bar: `2 selected · [Delete] [Export]`. Not a modal, not a dropdown — a contextual bar.
6. **Empty state** — full-height centered empty state with upload affordance (see Section 7).

### Skeleton loader (while data loads)

```
□  ████████    ██    ██    ████████████████
□  ██████      ██    ██    ──
□  ████████    ██    ██    ████████
```

Each row: 3 skeleton pulses, staggered animation delay (0ms, 100ms, 200ms). Use shadcn `Skeleton` component.

---

## 5. Door Schedule Panel

### Current problems
- Too many columns visible at once — horizontal scroll feels broken
- Status (pending/complete) is visually noisy
- Filter/column picker is buried

### Redesigned panel

```
┌──────────────────────────────────────────────────────┐
│ Door Schedule                  [+ Door] [↑ Upload]   │
│ ─────────────────────────────────────────────────── │
│ [🔍 Search doors...]    [Filters ▾]  [Columns ▾]    │
│ ─────────────────────────────────────────────────── │
│ TAG    LOCATION         HW SET   DIMS       STATUS  │
│ ─────────────────────────────────────────────────── │
│ 001    Main Entry       AD01b    3'-0"×7'   ● Done  │
│ 002    Office 101       SE02a    2'-8"×7'   ● Done  │
│ 003    Storage          —        3'-0"×7'   ○ —     │
│ 004    Mech Room        CA01     3'-0"×7'   ● Done  │
└──────────────────────────────────────────────────────┘
```

**Key changes:**
1. **Columns** — default shows only 5: Tag, Location, HW Set, Dims, Status. Rest hidden behind `[Columns ▾]` dropdown (shadcn `DropdownMenu` with checkboxes).
2. **Status column** — two states only: `● Linked` (green dot, small) or `○ Unlinked` (zinc dot). No color badges — dots take 12px, not 80px.
3. **HW Set cell** — `font-mono text-xs bg-zinc-100 px-1.5 rounded` same treatment as hardware sets. Immediately visually tied together.
4. **Dims** — single `3'-0"×7'-0"` formatted column instead of separate width/height.
5. **Filters** — shadcn `Popover` with filter chips: Fire Rating, Material, Status. Applied filters show as dismissible chips below the search bar.
6. **Row click** — opens a `Sheet` (shadcn slide-over panel from the right) with full door detail. No inline editing in the table — cleaner.

---

## 6. Upload Flow Redesign

### Current problems
- Confirmation modal appears but doesn't feel native
- Progress indicator is a floating widget in bottom-right — disconnected from the panel it's for
- No feedback on what the AI is actually doing

### Redesigned upload flow

**Step 1 — Drop / select**
- Upload button opens system file picker OR drag over panel to activate
- Dragging: entire panel gets a `border-2 border-dashed border-zinc-400 bg-zinc-50/80` overlay — subtle, not jarring

**Step 2 — Confirmation (if overwrite)**
- Replace current modal with shadcn `Dialog` — same content but cleaner
- Only shows when there is existing data to overwrite

**Step 3 — Processing**
- Instead of floating bottom-right widget: inline progress replaces the panel header temporarily
```
┌─────────────────────────────────────────────────────┐
│ ⟳ Processing HARDWARE - DIV 08.pdf                  │
│   AI is reading hardware sets…          ████░░  62% │
└─────────────────────────────────────────────────────┘
```
- Uses shadcn `Progress` component
- Stage label updates in real time
- On complete: 1-second success flash (green checkmark + count), then back to normal header

**Step 4 — Toast**
- shadcn `Sonner` toasts (already the standard in shadcn ecosystem)
- Position: bottom-right, max 3 stacked
- Style: white card, thin left border matching status color, `text-sm`

---

## 7. Empty States

Three scenarios, each needs a proper empty state:

### No data yet (fresh project)
```
┌─────────────────────────────────────────────────────┐
│                                                     │
│         ┌─────────────────────────┐                 │
│         │   Drop PDF here         │                 │
│         │   or click to browse    │                 │
│         │                         │                 │
│         │   [↑ Upload Hardware PDF]│                │
│         └─────────────────────────┘                 │
│                                                     │
│   Accepts Division 08 hardware schedule PDFs        │
│   Up to 20 MB · PDF only                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Data loading (skeleton)
- 6 skeleton rows, staggered pulse
- Header/search bar render normally — only table body skeletonizes
- Never show a spinner that blocks the whole panel

### Search/filter returned nothing
```
  No sets match "AD07z"
  Clear search →
```

---

## 8. Micro-interactions & Polish Details

### Hover states
- Table rows: `hover:bg-zinc-50` — extremely subtle
- Buttons: use shadcn variants (ghost, outline, default) consistently — no custom hover colors

### Set name matching visual
- When a door's HW Set links to a real hardware set: the code in the door table and the code in the hardware table should look identical (`font-mono bg-zinc-100 rounded`). The visual sameness tells the user they're connected without any explanation.

### Linked / Unlinked count in toolbar
```
Hardware Sets · 22          Door Schedule · 40 doors · 34 linked
```
The `34 linked` is `text-green-600` — the only meaningful color on the page.

### Save status
- Current: text in top-right corner
- New: small inline indicator next to the project name in the header
```
Project Alpha  ·  Saved ✓          (zinc-400, disappears after 2s)
Project Alpha  ·  Saving…          (animated dots)
Project Alpha  ·  Unsaved changes  (zinc-600, stays)
```

### Resize handle
- Current: custom implementation
- New: Keep the logic, restyle — `w-1 bg-zinc-200 hover:bg-zinc-400 cursor-col-resize transition-colors` — a thin line that brightens on hover

---

## 9. Implementation Order (Phased)

### Phase A — Foundation ✅ Done
1. ✅ Install shadcn/ui, pull in: `button`, `input`, `skeleton`, `table`, `badge`, `dialog`, `sheet`, `tabs`, `progress`, `dropdown-menu`, `separator`, `tooltip`, `sonner`
2. ✅ Set up design tokens in `tailwind.config` (blue primary #2563eb, Inter font)
3. ✅ Replace current Toast system with `sonner` (bridged via ToastContext, zero consumer changes)
4. ✅ Redesigned 48px header in `ProjectView.tsx` (back button, actions, view toggle, save status)

### Phase B — Project View shell ✅ Done
5. ✅ Redesign `ProjectView.tsx` toolbar (stats + view mode segmented control with lucide icons)
6. ✅ Restyle resize handle in `ResizablePanels.tsx` (1px line, 5-dot pill handle)
7. ✅ Restyle save status indicator (lucide icons, compact text-xs)

### Phase C — Hardware Sets panel ✅ Done
8. ✅ Rebuild `HardwareSetsManager.tsx` — dark charcoal header, lucide icons, shadcn Button
9. ✅ Skeleton loading rows using shadcn `Skeleton` (replaced custom TableRowSkeleton)
10. ✅ Expanded row with shadcn `Tabs` (Components / Assigned Doors / Details)
11. ✅ Contextual bulk action bar (slides in on row selection, X dismiss, destructive delete)
12. ✅ Empty state with Package icon and CTA buttons (Upload PDF + Create Manually)

### Phase D — Door Schedule panel ✅ Done
13. ✅ Rebuild `DoorScheduleManager.tsx` — dark charcoal header, lucide icons, shadcn Skeleton/Badge/Button
14. ✅ Column visibility dropdown (customizer panel with standard + custom column toggles)
15. ✅ Removed inline cell editing — row click now opens `EnhancedDoorEditModal` (full editor, accessible on single click)
16. ✅ Dismissible filter chips — appear below toolbar when any filter is active; each chip has an × to clear; "Clear all" resets all filters at once

### Phase E — Upload flow ✅ Done
17. ✅ Replace `UploadConfirmationModal` with shadcn `Dialog` (Radix focus trap, backdrop blur, radio cards)
18. ✅ Inline progress replaces panel header during upload (Loader2 spinner → CheckCircle2 on complete)
19. ✅ Removed floating `ProcessingIndicator` widget — progress is now co-located in each panel header

---

## 10. What NOT to do

- No card grid layouts for hardware sets — tables scale, cards don't
- No color-coded rows (red/yellow/green per status) — use dots and text only
- No modal for everything — use `Sheet` (slide-over) for detail views, modals only for destructive confirmations
- No custom-built dropdowns — Radix `DropdownMenu` handles keyboard, focus, and a11y correctly
- Don't animate everything — only the progress bar and skeleton pulse should animate
- Don't add a sidebar — this tool is about the data, not navigation
