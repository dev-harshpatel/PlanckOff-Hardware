# Dark Theme Implementation Plan
## PlanckOff Hardware Estimating Platform

> **How to use this file**: Tell Claude "implement Phase N of DARK_THEME_PLAN.md" and this file
> contains everything needed — exact files, exact color mappings, exact code — to execute each phase
> without any additional discovery work.

---

## Current State Snapshot

| Item | Status |
|---|---|
| next-themes installed | ❌ No |
| Tailwind dark mode configured | ❌ No |
| CSS variable color tokens | ❌ No |
| Theme toggle UI | ❌ No |
| Dark variants in any component | ❌ No |
| Total color class occurrences | ~1,500+ hardcoded |
| Total files needing changs | ~35 |

**Tailwind config location**: `tailwind.config.ts`  
**Global CSS location**: `app/globals.css`  
**Shell entry point**: `components/AppShell.tsx`  
**Header**: `components/Header.tsx`  
**Theme provider entry**: `app/providers.tsx`

---

## Color Token Mapping (Light → Dark)

This is the master reference for all phases. Every hardcoded Tailwind class maps to one of these semantic tokens.

### Surface / Background Tokens

| Token | CSS Variable | Light Value | Dark Value | Replaces |
|---|---|---|---|---|
| Surface | `--bg` | `#ffffff` (white) | `#0f1117` | `bg-white` |
| Surface Subtle | `--bg-subtle` | `#f9fafb` (gray-50) | `#161b22` | `bg-gray-50` |
| Surface Muted | `--bg-muted` | `#f3f4f6` (gray-100) | `#1c2128` | `bg-gray-100`, `bg-gray-200` |
| Surface Emphasis | `--bg-emphasis` | `#e5e7eb` (gray-200) | `#262d36` | `bg-gray-200`, `bg-gray-300` |

### Border Tokens

| Token | CSS Variable | Light Value | Dark Value | Replaces |
|---|---|---|---|---|
| Border Default | `--border` | `#e5e7eb` (gray-200) | `#30363d` | `border-gray-200` |
| Border Strong | `--border-strong` | `#d1d5db` (gray-300) | `#3d444d` | `border-gray-300` |
| Border Subtle | `--border-subtle` | `#f3f4f6` (gray-100) | `#21262d` | `border-gray-100` |

### Text Tokens

| Token | CSS Variable | Light Value | Dark Value | Replaces |
|---|---|---|---|---|
| Text Primary | `--text` | `#111827` (gray-900) | `#e6edf3` | `text-gray-900` |
| Text Secondary | `--text-secondary` | `#374151` (gray-700) | `#adbac7` | `text-gray-700`, `text-gray-800` |
| Text Muted | `--text-muted` | `#6b7280` (gray-500) | `#768390` | `text-gray-500`, `text-gray-600` |
| Text Faint | `--text-faint` | `#9ca3af` (gray-400) | `#545d68` | `text-gray-400` |
| Text Inverted | `--text-inverted` | `#ffffff` (white) | `#0f1117` | `text-white` |

### Brand / Primary (Blue) Tokens

| Token | CSS Variable | Light Value | Dark Value | Replaces |
|---|---|---|---|---|
| Primary Bg | `--primary-bg` | `#eff6ff` (blue-50) | `#0c1a2e` | `bg-blue-50`, `bg-primary-50` |
| Primary Bg Hover | `--primary-bg-hover` | `#dbeafe` (blue-100) | `#112240` | `bg-blue-100` |
| Primary Border | `--primary-border` | `#bfdbfe` (blue-200) | `#1a3560` | `border-blue-100`, `border-blue-200` |
| Primary Text | `--primary-text` | `#1d4ed8` (blue-700) | `#58a6ff` | `text-blue-700`, `text-primary-700` |
| Primary Text Muted | `--primary-text-muted` | `#3b82f6` (blue-500) | `#4493f8` | `text-blue-500`, `text-blue-600` |
| Primary Action | `--primary-action` | `#2563eb` (blue-600) | `#1f6feb` | `bg-blue-600`, `bg-primary-600` |
| Primary Action Hover | `--primary-action-hover` | `#1d4ed8` (blue-700) | `#388bfd` | `bg-blue-700`, `bg-primary-700` |
| Primary Ring | `--primary-ring` | `#3b82f6` (blue-500) | `#388bfd` | `ring-blue-500`, `ring-primary-500` |

### Status Color Tokens

| Token | CSS Variable | Light Bg | Light Text | Dark Bg | Dark Text | Replaces |
|---|---|---|---|---|---|---|
| Success Bg | `--success-bg` | `#f0fdf4` (green-50) | `#166534` (green-800) | `#0d1f17` | `#3fb950` | `bg-green-50/100`, `text-green-800` |
| Success Dot | `--success-dot` | `#22c55e` (green-500) | — | `#3fb950` | — | `bg-green-500` |
| Error Bg | `--error-bg` | `#fef2f2` (red-50) | `#991b1b` (red-800) | `#1f0d0d` | `#ff7b72` | `bg-red-50/100`, `text-red-800` |
| Error Dot | `--error-dot` | `#ef4444` (red-500) | — | `#ff7b72` | — | `bg-red-500` |
| Warning Bg | `--warning-bg` | `#fffbeb` (amber-50) | `#92400e` (amber-800) | `#1f1407` | `#d29922` | `bg-amber-50/100`, `text-amber-800` |
| Warning Dot | `--warning-dot` | `#f59e0b` (amber-500) | — | `#d29922` | — | `bg-amber-400/500` |

---

## Phase 0 — Foundation & Infrastructure ✅ Done
**Estimated time: 2–3 hours**  
**Risk: Low** (no visual changes yet, just plumbing)

### What this phase does
Installs all dependencies, wires up the theme provider, adds the toggle to the Header, and defines the CSS variable system. No component visuals change yet — light mode looks identical after this phase.

### Step 1 — Install next-themes

```bash
npm install next-themes
```

### Step 2 — Update `tailwind.config.ts`

Replace the entire file with:

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',                      // ← ADD THIS
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './features/**/*.{ts,tsx}',
    './views/**/*.{ts,tsx}',
    './contexts/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          '50':  '#eff6ff',
          '100': '#dbeafe',
          '200': '#bfdbfe',
          '300': '#93c5fd',
          '400': '#60a5fa',
          '500': '#3b82f6',
          '600': '#2563eb',
          '700': '#1d4ed8',
          '800': '#1e40af',
          '900': '#1e3a8a',
          '950': '#172554',
        },
        // CSS-variable-backed semantic tokens
        surface: {
          DEFAULT:  'var(--bg)',
          subtle:   'var(--bg-subtle)',
          muted:    'var(--bg-muted)',
          emphasis: 'var(--bg-emphasis)',
        },
        border: {
          DEFAULT:  'var(--border)',
          strong:   'var(--border-strong)',
          subtle:   'var(--border-subtle)',
        },
        content: {
          DEFAULT:   'var(--text)',
          secondary: 'var(--text-secondary)',
          muted:     'var(--text-muted)',
          faint:     'var(--text-faint)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
```

### Step 3 — Update `app/globals.css`

Add the CSS variable definitions BEFORE the existing custom styles (after the @tailwind directives):

```css
/* ── Theme Tokens ────────────────────────────────────────── */
:root {
  /* Surface */
  --bg:          #ffffff;
  --bg-subtle:   #f9fafb;
  --bg-muted:    #f3f4f6;
  --bg-emphasis: #e5e7eb;

  /* Border */
  --border:        #e5e7eb;
  --border-strong: #d1d5db;
  --border-subtle: #f3f4f6;

  /* Text */
  --text:           #111827;
  --text-secondary: #374151;
  --text-muted:     #6b7280;
  --text-faint:     #9ca3af;
  --text-inverted:  #ffffff;

  /* Primary (Blue) */
  --primary-bg:           #eff6ff;
  --primary-bg-hover:     #dbeafe;
  --primary-border:       #bfdbfe;
  --primary-text:         #1d4ed8;
  --primary-text-muted:   #3b82f6;
  --primary-action:       #2563eb;
  --primary-action-hover: #1d4ed8;
  --primary-ring:         #3b82f6;

  /* Status — Success */
  --success-bg:   #f0fdf4;
  --success-text: #166534;
  --success-dot:  #22c55e;
  --success-border: #bbf7d0;

  /* Status — Error */
  --error-bg:   #fef2f2;
  --error-text: #991b1b;
  --error-dot:  #ef4444;
  --error-border: #fecaca;

  /* Status — Warning */
  --warning-bg:   #fffbeb;
  --warning-text: #92400e;
  --warning-dot:  #f59e0b;
  --warning-border: #fde68a;
}

.dark {
  /* Surface */
  --bg:          #0d1117;
  --bg-subtle:   #161b22;
  --bg-muted:    #1c2128;
  --bg-emphasis: #262d36;

  /* Border */
  --border:        #30363d;
  --border-strong: #3d444d;
  --border-subtle: #21262d;

  /* Text */
  --text:           #e6edf3;
  --text-secondary: #adbac7;
  --text-muted:     #768390;
  --text-faint:     #545d68;
  --text-inverted:  #0d1117;

  /* Primary (Blue) */
  --primary-bg:           #0c1a2e;
  --primary-bg-hover:     #112240;
  --primary-border:       #1a3a6b;
  --primary-text:         #58a6ff;
  --primary-text-muted:   #4493f8;
  --primary-action:       #1f6feb;
  --primary-action-hover: #388bfd;
  --primary-ring:         #388bfd;

  /* Status — Success */
  --success-bg:     #0d1f17;
  --success-text:   #3fb950;
  --success-dot:    #3fb950;
  --success-border: #1a4a2e;

  /* Status — Error */
  --error-bg:     #1f0d0d;
  --error-text:   #ff7b72;
  --error-dot:    #ff7b72;
  --error-border: #5c1a1a;

  /* Status — Warning */
  --warning-bg:     #1f1407;
  --warning-text:   #d29922;
  --warning-dot:    #d29922;
  --warning-border: #4a3000;
}

/* Scrollbar (add dark variant) */
.dark ::-webkit-scrollbar-track { background: #161b22; }
.dark ::-webkit-scrollbar-thumb { background-color: #30363d; }
```

### Step 4 — Update `app/providers.tsx`

Wrap with ThemeProvider:

```typescript
'use client';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
```

### Step 5 — Update `app/layout.tsx`

Add `suppressHydrationWarning` to `<html>` (required by next-themes):

```tsx
<html lang="en" suppressHydrationWarning>
```

### Step 6 — Add Theme Toggle to `components/Header.tsx`

Add a sun/moon toggle button:

```tsx
// Add to imports
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';

// Inside Header component, add before closing </nav>:
const { theme, setTheme } = useTheme();
// ...
<button
  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
  className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition-colors"
  title="Toggle theme"
>
  <Sun className="w-3.5 h-3.5 dark:hidden" />
  <Moon className="w-3.5 h-3.5 hidden dark:block" />
</button>
```

### Step 7 — Update `components/AppShell.tsx`

Change the outer div:
```tsx
// Before:
<div className="h-full flex flex-col bg-gray-50 text-gray-800">

// After:
<div className="h-full flex flex-col bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
```

Change the loading spinner:
```tsx
// Before:
<div className="min-h-screen flex items-center justify-center bg-gray-50">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-700" />

// After:
<div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary-action)]" />
```

---

## Phase 1 — UI Primitives (shadcn components) ✅ Done
**Estimated time: 1–2 hours**  
**Risk: Low** (these are isolated, well-scoped files)  
**Why first**: these propagate to every page automatically once updated.

### Files to update:
- `components/ui/button.tsx`
- `components/ui/badge.tsx`
- `components/ui/dialog.tsx`
- `components/ui/input.tsx`
- `components/ui/textarea.tsx`
- `components/ui/select.tsx`
- `components/ui/tabs.tsx`
- `components/ui/label.tsx`
- `components/ui/skeleton.tsx`
- `components/ui/progress.tsx`
- `components/ui/separator.tsx`
- `components/ui/tooltip.tsx`
- `components/ui/sonner.tsx`
- `components/ui/sheet.tsx`
- `components/ui/dropdown-menu.tsx`
- `components/ui/alert-dialog.tsx`
- `components/ui/table.tsx`

### Pattern to apply for every file:

```
bg-white           → bg-[var(--bg)]
bg-gray-50         → bg-[var(--bg-subtle)]
bg-gray-100        → bg-[var(--bg-muted)]
text-gray-900      → text-[var(--text)]
text-gray-700      → text-[var(--text-secondary)]
text-gray-500      → text-[var(--text-muted)]
text-gray-400      → text-[var(--text-faint)]
border-gray-200    → border-[var(--border)]
border-gray-300    → border-[var(--border-strong)]
```

### `button.tsx` specific changes:

The `default` variant needs primary token:
```tsx
// Before:
default: 'bg-primary-600 text-white hover:bg-primary-700'
// After:
default: 'bg-[var(--primary-action)] text-white hover:bg-[var(--primary-action-hover)]'
```

The `outline` variant:
```tsx
// Before:
outline: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
// After:
outline: 'border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]'
```

### `badge.tsx` specific changes:

Each badge variant maps to a status token:
```tsx
success:     'bg-[var(--success-bg)] text-[var(--success-text)] border-[var(--success-border)]'
destructive: 'bg-[var(--error-bg)] text-[var(--error-text)] border-[var(--error-border)]'
warning:     'bg-[var(--warning-bg)] text-[var(--warning-text)] border-[var(--warning-border)]'
secondary:   'bg-[var(--bg-muted)] text-[var(--text-muted)]'
```

### `dialog.tsx` specific changes:

```tsx
// Overlay: already dark — no change needed
// Content panel:
// Before: bg-white
// After:  bg-[var(--bg)] border border-[var(--border)]
```

### `sonner.tsx` specific changes:

```tsx
// Add to Toaster props:
theme={resolvedTheme as 'light' | 'dark'}
// (requires useTheme from next-themes)
```

---

## Phase 2 — Shell, Header & Navigation ✅ Done
**Estimated time: 45 minutes**  
**Risk: Low**

### Files to update:
- `components/Header.tsx` — nav link active/inactive states
- `app/layout.tsx` — body background
- `app/(auth)/login/page.tsx` — login page background
- `app/set-password/page.tsx` — set-password page background

### `Header.tsx` full color mapping:

```tsx
// Header wrapper:
// Before: bg-white border-b border-zinc-200
// After:  bg-[var(--bg)] border-b border-[var(--border)]

// NavLink active:
// Before: bg-blue-50 text-blue-700 border border-blue-100
// After:  bg-[var(--primary-bg)] text-[var(--primary-text)] border border-[var(--primary-border)]

// NavLink inactive:
// Before: text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900
// After:  text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]
```

### `app/layout.tsx` body:

```tsx
// Before:
<body className="h-screen overflow-hidden bg-gray-100">
// After:
<body className="h-screen overflow-hidden bg-[var(--bg-muted)]">
```

---

## Phase 3 — Page Views ✅ Done
**Estimated time: 3–4 hours**  
**Risk: Medium** (large files with many color classes)

### Files to update (in order of complexity):

1. `views/Dashboard.tsx` (429 lines)
2. `views/DatabaseView.tsx` (393 lines)
3. `app/team/page.tsx` (265 lines)
4. `views/ProjectView.tsx` (689 lines)
5. `views/PricingView.tsx` (458 lines)
6. `views/ReportsView.tsx` (435 lines)

### Universal replacement rules (apply to all view files):

```
bg-white              → bg-[var(--bg)]
bg-gray-50            → bg-[var(--bg-subtle)]
bg-gray-100           → bg-[var(--bg-muted)]
bg-zinc-50            → bg-[var(--bg-subtle)]

text-gray-900         → text-[var(--text)]
text-gray-800         → text-[var(--text)]
text-gray-700         → text-[var(--text-secondary)]
text-gray-600         → text-[var(--text-muted)]
text-gray-500         → text-[var(--text-muted)]
text-gray-400         → text-[var(--text-faint)]

border-gray-100       → border-[var(--border-subtle)]
border-gray-200       → border-[var(--border)]
border-gray-300       → border-[var(--border-strong)]
border-zinc-200       → border-[var(--border)]

bg-blue-50            → bg-[var(--primary-bg)]
border-blue-100       → border-[var(--primary-border)]
text-blue-700         → text-[var(--primary-text)]
text-blue-600         → text-[var(--primary-text-muted)]
text-blue-500         → text-[var(--primary-text-muted)]

bg-green-50           → bg-[var(--success-bg)]
text-green-700        → text-[var(--success-text)]
border-green-200      → border-[var(--success-border)]

bg-red-50             → bg-[var(--error-bg)]
text-red-700          → text-[var(--error-text)]
border-red-200        → border-[var(--error-border)]

bg-amber-50           → bg-[var(--warning-bg)]
text-amber-700        → text-[var(--warning-text)]
border-amber-200      → border-[var(--warning-border)]

hover:bg-gray-50      → hover:bg-[var(--bg-subtle)]
hover:bg-gray-100     → hover:bg-[var(--bg-muted)]
hover:border-blue-200 → hover:border-[var(--primary-border)]
```

### `Dashboard.tsx` specific notes:
- Project cards: `border-zinc-200 hover:border-blue-200` → use border tokens
- Kanban column headers already use `bg-blue-50` → use `--primary-bg`
- Stat pills: `bg-white border border-blue-100` → `bg-[var(--bg)] border-[var(--primary-border)]`

### `ProjectView.tsx` specific notes:
- ResizablePanels divider: `bg-gray-200 hover:bg-blue-300` → `bg-[var(--border)] hover:bg-[var(--primary-ring)]`
- Tab panels (left/right) background: `bg-white` → `bg-[var(--bg)]`

---

## Phase 4 — Major Components ✅ Done
**Estimated time: 5–7 hours**  
**Risk: High** (largest files, most color usage)

### Files to update (in order):

1. **`components/DoorScheduleManager.tsx`** (1,332 lines) — highest complexity
2. **`components/HardwareSetsManager.tsx`** (678 lines)
3. **`components/EnhancedDoorEditModal.tsx`** (639 lines)
4. **`components/HardwareSetModal.tsx`** (454 lines)
5. **`components/ExportConfigModal.tsx`** (468 lines)
6. **`components/PriceBookManager.tsx`** (494 lines)

### Apply the universal replacement rules from Phase 3 to all files above.

### `DoorScheduleManager.tsx` specific notes:

**Table header** (already using blue-50 design):
```
bg-blue-50 → bg-[var(--primary-bg)]
text-blue-700 → text-[var(--primary-text)]
border-blue-100 → border-[var(--primary-border)]
shadow-[0_1px_0_0_#bfdbfe] → shadow-[0_1px_0_0_var(--primary-border)]
```

**Table rows**:
```
bg-white → bg-[var(--bg)]
hover:bg-blue-50 → hover:bg-[var(--primary-bg)]
bg-gray-50/50 → bg-[var(--bg-subtle)]/50
```

**Toolbar** (single-row compact bar):
```
bg-white border-gray-100 → bg-[var(--bg)] border-[var(--border-subtle)]
border-gray-200 → border-[var(--border)]
text-gray-500 → text-[var(--text-muted)]
hover:bg-gray-50 → hover:bg-[var(--bg-subtle)]
```

**Segmented status control**:
```
border-gray-200 divide-gray-200 → border-[var(--border)] divide-[var(--border)]
text-gray-500 → text-[var(--text-muted)]
bg-blue-50 text-blue-700 → bg-[var(--primary-bg)] text-[var(--primary-text)]
```

**Filter chips**:
```
bg-primary-50 text-primary-700 border-primary-200 → use primary tokens
```

**Column header drag handle** (`GripVertical`):
```
text-blue-300 → text-[var(--primary-border)]
```

**Inline cell editing inputs**:
```
bg-white border-blue-500 ring-blue-500 → bg-[var(--bg)] border-[var(--primary-ring)] ring-[var(--primary-ring)]
```

**Active upload progress bar**:
```
bg-blue-50 border-blue-100 → var(--primary-bg) var(--primary-border)
text-blue-500 → text-[var(--primary-text-muted)]
```

### `EnhancedDoorEditModal.tsx` specific notes:

**Modal overlay**:
```
bg-black/40 → bg-black/60 dark:bg-black/70
```

**Modal header**:
```
bg-blue-50 border-blue-100 → var(--primary-bg) var(--primary-border)
text-gray-900 → text-[var(--text)]
text-blue-500 → text-[var(--primary-text-muted)]
```

**Tab bar**:
```
bg-white border-blue-100 → bg-[var(--bg)] border-[var(--primary-border)]
text-blue-700 border-blue-600 → text-[var(--primary-text)] border-[var(--primary-action)]
text-gray-500 → text-[var(--text-muted)]
hover:bg-gray-50 → hover:bg-[var(--bg-subtle)]
```

**Section headers**:
```
text-blue-600 → text-[var(--primary-text-muted)]
bg-blue-100 → bg-[var(--primary-border)]
```

**All inputs/selects** (use the `inputCls` / `selectCls` constants):
```
border-gray-200 → border-[var(--border)]
bg-white → bg-[var(--bg)]
text-gray-800 → text-[var(--text-secondary)]
focus:ring-blue-500 → focus:ring-[var(--primary-ring)]
focus:border-blue-400 → focus:border-[var(--primary-ring)]
```

**Hardware items table**:
```
bg-blue-50 border-blue-100 → var(--primary-bg) var(--primary-border)
bg-gray-50 border-gray-100 → var(--bg-subtle) var(--border-subtle)
bg-white → bg-[var(--bg)]
bg-gray-50/50 → bg-[var(--bg-subtle)]/50
text-gray-800 → text-[var(--text-secondary)]
text-gray-400 → text-[var(--text-faint)]
bg-gray-100 text-gray-600 (finish pill) → bg-[var(--bg-muted)] text-[var(--text-muted)]
```

**Footer**:
```
bg-white border-gray-100 → bg-[var(--bg)] border-[var(--border-subtle)]
text-gray-600 border-gray-200 hover:bg-gray-50 → use text/border tokens
bg-blue-600 hover:bg-blue-700 → var(--primary-action) var(--primary-action-hover)
```

---

## Phase 5 — Secondary Components ✅ Done
**Estimated time: 3–4 hours**  
**Risk: Low-Medium**

### Files to update:

```
components/HardwareSetConfig.tsx        (401 lines)
components/NewProjectModal.tsx          (379 lines)
components/ValidationModal.tsx          (272 lines)
components/HardwareScheduleView.tsx     (279 lines)
components/EstimatingReportBanner.tsx   (247 lines)
components/ReportGenerationCenter.tsx   (318 lines)
components/RevisionHistory.tsx          (368 lines)
components/SubmittalGenerator.tsx       (262 lines)
components/SubmittalCoverPage.tsx       (336 lines)
components/DoorScheduleConfig.tsx       (291 lines)
components/ValidationReportModal.tsx
components/ElevationManager.tsx
components/HardwarePrepEditor.tsx
components/ElectrificationEditor.tsx
components/HingeSpecEditor.tsx
components/CutSheetLibrary.tsx          (439 lines)
components/ProcurementSummaryView.tsx   (383 lines)
components/ReportDataPreview.tsx        (411 lines)
components/ContextualProgressBar.tsx
components/UploadProgressWidget.tsx
components/Tooltip.tsx
components/ResizablePanels.tsx
```

Apply the **universal replacement rules** from Phase 3 to all files above. No file-specific special cases — they all use the same core pattern.

---

## Phase 6 — Contexts & Utility Components ✅ Done
**Estimated time: 1 hour**  
**Risk: Low**

### Files to update:

```
contexts/ProjectContext.tsx     — any inline JSX color classes
contexts/AuthContext.tsx        — any inline JSX color classes
app/(auth)/login/page.tsx       — full login page dark treatment
app/set-password/page.tsx       — full set-password page dark treatment
```

### Login page specific notes:
```
bg-gray-100 → bg-[var(--bg-muted)]
bg-white (card) → bg-[var(--bg)]
border-gray-200 → border-[var(--border)]
```

---

## Phase 7 — Polish & Edge Cases ✅ Done
**Estimated time: 1–2 hours**  
**Risk: Low**

### Checklist for this phase:

- [ ] **Logo**: If `public/images/logo.svg` uses dark text/marks, add a `dark:hidden` version and a `dark:block` white variant, or use CSS `filter: invert(1)` conditionally
- [ ] **Focus rings**: Verify all inputs show `ring-[var(--primary-ring)]` correctly — no blue-500 hardcodes missed
- [ ] **Scrollbars**: Verify the dark scrollbar CSS in globals.css applies correctly
- [ ] **Modals/overlays**: All modal backdrops should be `bg-black/50` (already theme-neutral)
- [ ] **Skeleton**: `bg-gray-200 animate-pulse` → `bg-[var(--bg-emphasis)] animate-pulse`
- [ ] **Toaster (sonner)**: Verify the `theme` prop is correctly passed
- [ ] **Progress bars**: `bg-blue-100` track → `bg-[var(--primary-bg)]`, `bg-blue-600` fill → `bg-[var(--primary-action)]`
- [ ] **Drag-over indicators** (DoorScheduleManager): `border-l-blue-500` → `border-l-[var(--primary-action)]`
- [ ] **Charts/graphs** (if any in ReportsView): Use theme-aware colors
- [ ] **Print styles**: Add `@media print { :root { --bg: #fff; ... } }` if reports need printing
- [ ] **System preference test**: Toggle OS dark mode — verify `defaultTheme="system"` responds
- [ ] **Hydration**: Verify no flash of wrong theme on page load (suppressHydrationWarning is set)
- [ ] **Mobile**: Verify toggle button is accessible on small screens

---

## Quick Reference: Common Anti-Patterns to Watch

When implementing any phase, search for and avoid these patterns:

```
❌ bg-white          → ✅ bg-[var(--bg)]
❌ bg-gray-50        → ✅ bg-[var(--bg-subtle)]
❌ text-gray-900     → ✅ text-[var(--text)]
❌ border-gray-200   → ✅ border-[var(--border)]
❌ ring-blue-500     → ✅ ring-[var(--primary-ring)]
❌ bg-blue-50        → ✅ bg-[var(--primary-bg)]
❌ text-blue-700     → ✅ text-[var(--primary-text)]
❌ bg-blue-600       → ✅ bg-[var(--primary-action)]
```

**Status colors that are safe to keep as-is** (they already have good contrast in both modes):
```
✅ text-white (on colored backgrounds)
✅ bg-black/50 (modal overlays)
✅ bg-green-500 / bg-red-500 / bg-amber-400 (solid indicator dots, high contrast both modes)
```

---

## Total Effort Estimate

| Phase | Description | Time | Risk |
|---|---|---|---|
| Phase 0 | Foundation & Infrastructure | 2–3h | Low |
| Phase 1 | UI Primitives (shadcn) | 1–2h | Low |
| Phase 2 | Shell & Navigation | 45m | Low |
| Phase 3 | Page Views (6 files) | 3–4h | Medium |
| Phase 4 | Major Components (6 files) | 5–7h | High |
| Phase 5 | Secondary Components (20+ files) | 3–4h | Low-Med |
| Phase 6 | Contexts & Auth Pages | 1h | Low |
| Phase 7 | Polish & Edge Cases | 1–2h | Low |
| **Total** | | **17–24h** | |

**Recommended order**: Phase 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7

After Phase 2, the toggle button is visible and the app structure responds to dark mode (shell goes dark). After Phase 1, all shadcn buttons/badges/dialogs go dark. After Phase 4, the main working surfaces (door schedule, hardware manager, modals) are fully themed.
