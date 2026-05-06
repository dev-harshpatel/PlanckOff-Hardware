# Component Folder Reorganization Plan

**Goal:** Move all flat root-level components into domain-grouped subfolders.  
**Rule:** Each phase = one folder group. Move files, then fix all import paths, then verify build.  
**Do not change any logic** — pure file moves + import path updates only.

---

## Current State

73 files across `components/` import from each other and from views/contexts.  
9 subfolders already exist with partial groupings:

| Existing folder | Files inside |
|---|---|
| `ui/` | Shadcn primitives (button, dialog, badge, etc.) |
| `skeletons/` | DashboardSkeleton, DatabaseSkeleton, ReportPageSkeleton |
| `dashboard/` | ProjectCard, DashboardFilters, KanbanColumn |
| `doors/` | ConfidenceIndicator, DoorTableRow, DoorTableHeader |
| `doorSchedule/` | DoorGroupingControls, doorScheduleTypes.ts |
| `hardware/` | HardwareSetExpandedRow |
| `pricing/` | MultiFilterSelect, PriceInput, PricingDetailModal, PricingHierarchyView, PricingTableRows |
| `forms/` | DoorFormSection, DoorBasicSection, DoorDimensionSection, DoorHardwareSection |
| `team/` | InviteTeamMemberModal |

---

## Target Folder Structure

```
components/
├── ui/             (no change — shadcn primitives)
├── skeletons/      (no change)
├── dashboard/      (no change)
├── forms/          (no change — door form sections)
├── layout/         [NEW]
├── shared/         [NEW]
├── reports/        [NEW]
├── submittals/     [NEW]
├── elevation/      [NEW]
├── upload/         [NEW]
├── projects/       [NEW]
├── settings/       [NEW]
├── doors/          [EXTEND existing]
├── doorSchedule/   [EXTEND existing]
├── hardware/       [EXTEND existing]
├── pricing/        [EXTEND existing]
└── team/           [EXTEND existing]
```

---

## Phase 1 — Layout Group

**New folder:** `components/layout/`

| File to move | From |
|---|---|
| `AppShell.tsx` | `components/` |
| `Header.tsx` | `components/` |
| `ResizablePanels.tsx` | `components/` |
| `RouteLoadingState.tsx` | `components/` |
| `RouteTransitionIndicator.tsx` | `components/` |

**Likely import sites to update:** `App.tsx`, `views/`, `contexts/`

---

## Phase 2 — Shared / Common Group

**New folder:** `components/shared/`

| File to move | From |
|---|---|
| `ContextualProgressBar.tsx` | `components/` |
| `ErrorBoundary.tsx` | `components/` |
| `ErrorModal.tsx` | `components/` |
| `KeyboardShortcutsHelpModal.tsx` | `components/` |
| `ProcessingIndicator.tsx` | `components/` |
| `SaveStatusIndicator.tsx` | `components/` |
| `SkeletonLoader.tsx` | `components/` |
| `Toast.tsx` | `components/` |
| `ToastContainer.tsx` | `components/` |
| `Tooltip.tsx` | `components/` |
| `TrashBin.tsx` | `components/` |
| `UndoToast.tsx` | `components/` |
| `ValidationModal.tsx` | `components/` |
| `icons.tsx` | `components/` |

**Likely import sites to update:** widely used — `views/`, `components/*`, `contexts/`

---

## Phase 3 — Doors Group (extend existing)

**Existing folder:** `components/doors/`  
Already contains: `ConfidenceIndicator`, `DoorTableRow`, `DoorTableHeader`

| File to move | From |
|---|---|
| `DoorHandingSelector.tsx` | `components/` |
| `DoorMaterialSelector.tsx` | `components/` |
| `EnhancedDoorEditModal.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `components/DoorScheduleManager.tsx`

---

## Phase 4 — Door Schedule Group (extend existing)

**Existing folder:** `components/doorSchedule/`  
Already contains: `DoorGroupingControls`, `doorScheduleTypes.ts`

| File to move | From |
|---|---|
| `DoorScheduleConfig.tsx` | `components/` |
| `DoorScheduleManager.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `App.tsx`

---

## Phase 5 — Hardware Group (extend existing)

**Existing folder:** `components/hardware/`  
Already contains: `HardwareSetExpandedRow`

| File to move | From |
|---|---|
| `ElectrificationEditor.tsx` | `components/` |
| `FinishSystemEditor.tsx` | `components/` |
| `HardwarePrepEditor.tsx` | `components/` |
| `HardwareScheduleView.tsx` | `components/` |
| `HardwareSetConfig.tsx` | `components/` |
| `HardwareSetModal.tsx` | `components/` |
| `HardwareSetsManager.tsx` | `components/` |
| `HardwareTrashModal.tsx` | `components/` |
| `HingeSpecEditor.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `components/HardwareSetsManager.tsx`

---

## Phase 6 — Pricing Group (extend existing)

**Existing folder:** `components/pricing/`  
Already contains: `MultiFilterSelect`, `PriceInput`, `PricingDetailModal`, `PricingHierarchyView`, `PricingTableRows`

| File to move | From |
|---|---|
| `PriceBookManager.tsx` | `components/` |
| `PricingReportConfig.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `views/Dashboard.tsx`

---

## Phase 7 — Reports Group

**New folder:** `components/reports/`

| File to move | From |
|---|---|
| `EstimatingReportBanner.tsx` | `components/` |
| `EstimationReport.tsx` | `components/` |
| `ProcurementSummaryView.tsx` | `components/` |
| `ReportDataPreview.tsx` | `components/` |
| `ReportGenerationCenter.tsx` | `components/` |
| `ReportPreviewModal.tsx` | `components/` |
| `ValidationReportModal.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `views/Dashboard.tsx`

---

## Phase 8 — Submittals Group

**New folder:** `components/submittals/`

| File to move | From |
|---|---|
| `ExportConfigModal.tsx` | `components/` |
| `SubmittalCoverPage.tsx` | `components/` |
| `SubmittalGenerator.tsx` | `components/` |
| `SubmittalPackageConfig.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`

---

## Phase 9 — Elevation Group

**New folder:** `components/elevation/`

| File to move | From |
|---|---|
| `ElevationManager.tsx` | `components/` |
| `ElevationTab.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `components/HardwareSetsManager.tsx`

---

## Phase 10 — Upload Group

**New folder:** `components/upload/`

| File to move | From |
|---|---|
| `ImageAnalysisModal.tsx` | `components/` |
| `UploadConfirmationModal.tsx` | `components/` |
| `UploadProgressWidget.tsx` | `components/` |

**Likely import sites to update:** `views/ProjectView.tsx`, `App.tsx`, `contexts/`

---

## Phase 11 — Team Group (extend existing)

**Existing folder:** `components/team/`  
Already contains: `InviteTeamMemberModal`

| File to move | From |
|---|---|
| `InviteMemberModal.tsx` | `components/` |
| `InviteUserPanel.tsx` | `components/` |

**Likely import sites to update:** `views/Dashboard.tsx`, `views/ProjectView.tsx`

---

## Phase 12 — Projects Group

**New folder:** `components/projects/`

| File to move | From |
|---|---|
| `NewProjectModal.tsx` | `components/` |
| `PendingReviewModal.tsx` | `components/` |
| `ProjectNotesPanel.tsx` | `components/` |
| `RevisionHistory.tsx` | `components/` |

**Likely import sites to update:** `views/Dashboard.tsx`, `views/ProjectView.tsx`

---

## Phase 13 — Settings Group

**New folder:** `components/settings/`

| File to move | From |
|---|---|
| `CompanySettingsForm.tsx` | `components/` |
| `CutSheetLibrary.tsx` | `components/` |
| `MasterItemFormModal.tsx` | `components/` |

**Likely import sites to update:** `views/`, settings-related views

---

## Execution Checklist (per phase)

For each phase, in order:

- [ ] Create the new folder if it doesn't exist
- [ ] Move each listed file into the folder
- [ ] Search all `.tsx` / `.ts` files for the old import path
- [ ] Update each import to the new path
- [ ] Run `tsc --noEmit` to verify no broken imports
- [ ] Check `vite build` or dev server to confirm no runtime errors
- [ ] Commit: `refactor: move <group> components to components/<folder>/`

---

## Files NOT being moved

| File | Reason |
|---|---|
| `HardwareSetsManager_fix.txt` | Not a component — delete it |
| `components/ui/*` | Shadcn primitives — stable, leave as-is |
| `components/skeletons/*` | Already grouped — no change |
| `components/dashboard/*` | Already grouped — no change |
| `components/forms/*` | Already grouped — no change |
