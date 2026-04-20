# Elevations Feature — Implementation Plan

## What We're Building

Users take screenshots of door elevation drawings, upload them, and name them after an elevation type (e.g., "A", "B", "Standard Double"). The system:

1. Matches that name to the `DOOR ELEVATION TYPE` field (`elevationTypeId`) on each door in the schedule
2. Stores the image in Supabase Storage with compression
3. Persists the storage URL in the elevation type record
4. Shows an **Elevation** tab in `EnhancedDoorEditModal` when a door has a matching elevation image
5. Includes `elevationImageUrl` in each door's final JSON export

---

## Mental Model

```
ElevationType (named "A", "B", "Standard")
    └── imageUrl: string  ← Supabase Storage URL (one per type)

Door
    └── elevationTypeId: "A"  ← matches ElevationType.name/code
    └── (derived) elevationImageUrl ← resolved at render + export time

Supabase Storage: door-elevations/
    └── {projectId}/
        └── {elevationTypeName}-{timestamp}.webp
```

One image per elevation type. All doors with the same `DOOR ELEVATION TYPE` value share the same image. No duplicates.

---

## Architecture Decision: Global Elevation Registry (per Project)

**Why not per-door upload?**  
- 50 doors can share the same elevation type "A" — uploading once and resolving by name is the correct approach
- Avoids 50 duplicate images for the same drawing

**Why not a separate Elevation Management page?**  
- The upload UX lives in the Elevation tab of the door edit modal — familiar context for the user
- A separate global manager (optional Phase 2) can be added later

**Flow:**
1. User opens any door with `elevationTypeId = "A"`
2. Elevation tab shows: "No image uploaded for elevation type A yet. Upload one."
3. User uploads → compressed → stored → URL saved to ElevationType record
4. All other doors with `elevationTypeId = "A"` now automatically show the same image

---

## Data Model Changes

### 1. `ElevationType` interface (types.ts, line 375)

```typescript
export interface ElevationType {
  id: string;
  name: string;
  code: string;
  imageUrl?: string;        // ← ADD: Supabase Storage public URL
  imagePath?: string;       // ← ADD: Storage path for deletion/replacement
  doors: Door[];
}
```

### 2. `Door` interface (types.ts, line 273)

No direct change needed — `elevationTypeId` already links to the type. For export:

```typescript
// In the final JSON export only (derived, not stored on Door):
elevationImageUrl?: string;  // resolved from ElevationType.imageUrl at export time
```

### 3. Supabase Storage bucket

Bucket name: `door-elevations`  
Path pattern: `{projectId}/{elevationTypeName}-{timestamp}.webp`  
Access: **Public read** (images are non-sensitive drawing screenshots)

### 4. Supabase DB migration (optional but recommended)

If elevation types are persisted in the DB (check current schema), add:
```sql
ALTER TABLE elevation_types
  ADD COLUMN image_url TEXT,
  ADD COLUMN image_path TEXT;
```

If elevation types are currently stored only in localStorage/ProjectContext, the `imageUrl` and `imagePath` fields ride along with the existing `ElevationType` objects in the project JSONB blob until the full Supabase migration.

---

## Image Compression Strategy

**Target format:** WebP  
**Max resolution:** 1920 × 1080 (downscale only — never upscale)  
**Quality:** 0.83 (83%) — HD-quality WebP, typically 150–400 KB for architectural screenshots  
**Library:** Native browser Canvas API — zero dependencies

```typescript
// services/elevationService.ts
async function compressElevationImage(file: File): Promise<Blob> {
  const MAX_W = 1920;
  const MAX_H = 1080;
  const QUALITY = 0.83;

  const bitmap = await createImageBitmap(file);
  
  let { width, height } = bitmap;
  const ratio = Math.min(MAX_W / width, MAX_H / height, 1); // never upscale
  width  = Math.round(width  * ratio);
  height = Math.round(height * ratio);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.convertToBlob({ type: 'image/webp', quality: QUALITY });
}
```

`OffscreenCanvas` runs off the main thread — no UI jank during compression.  
Fallback to regular `Canvas` if `OffscreenCanvas` is unavailable (Safari < 16.4).

---

## File Structure

```
services/
  elevationService.ts       ← compress + upload + fetch + delete

components/
  ElevationTab.tsx          ← tab content rendered inside EnhancedDoorEditModal
  ElevationUploadZone.tsx   ← drag-drop / click-to-upload sub-component

supabase/migrations/
  005_elevation_images.sql  ← add image_url/image_path to elevation_types (if table exists)
```

---

## `elevationService.ts` — Full API Surface

```typescript
// Compress a File to WebP Blob (client-side, no upload)
compressElevationImage(file: File): Promise<Blob>

// Upload compressed blob to Supabase Storage, return public URL
uploadElevationImage(
  projectId: string,
  elevationTypeName: string,
  blob: Blob
): Promise<{ url: string; path: string }>

// Delete old image from storage (used when replacing)
deleteElevationImage(path: string): Promise<void>

// Build public URL from path (utility — for reconstructing URLs from stored paths)
getElevationPublicUrl(path: string): string
```

---

## `ElevationTab.tsx` — UI States

The Elevation tab renders inside `EnhancedDoorEditModal` as a 4th tab.

### State 1: No elevation type assigned to door
```
┌─────────────────────────────────────────┐
│  This door has no Elevation Type set.   │
│  Set the "Door Elevation Type" field    │
│  in the Door tab first.                 │
└─────────────────────────────────────────┘
```

### State 2: Elevation type assigned, no image yet
```
┌─────────────────────────────────────────┐
│  Elevation Type: A                      │
│  ┌───────────────────────────────────┐  │
│  │  Drop screenshot here or click    │  │
│  │  to upload                        │  │
│  │  PNG / JPG / WebP accepted        │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### State 3: Image uploaded, displaying
```
┌─────────────────────────────────────────┐
│  Elevation Type: A          [Replace]   │
│  ┌───────────────────────────────────┐  │
│  │                                   │  │
│  │   [HD elevation image rendered]   │  │
│  │                                   │  │
│  └───────────────────────────────────┘  │
│  Shared by N doors with type "A"        │
└─────────────────────────────────────────┘
```

### State 4: Uploading / compressing
```
┌─────────────────────────────────────────┐
│  Compressing image…  ████░░░░░ 60%      │
└─────────────────────────────────────────┘
```

---

## Tab Addition in `EnhancedDoorEditModal.tsx`

Current tabs (line 220–224):
```typescript
const TABS = [
  { id: 'door',     label: 'Door',     icon: DoorOpen },
  { id: 'frame',    label: 'Frame',    icon: Square   },
  { id: 'hardware', label: 'Hardware', icon: Wrench   },
];
```

Updated:
```typescript
const TABS = [
  { id: 'door',      label: 'Door',      icon: DoorOpen  },
  { id: 'frame',     label: 'Frame',     icon: Square    },
  { id: 'hardware',  label: 'Hardware',  icon: Wrench    },
  { id: 'elevation', label: 'Elevation', icon: Image     }, // ← ADD
];
```

Tab content:
```tsx
{activeTab === 'elevation' && (
  <ElevationTab
    door={editedDoor}
    elevationTypes={elevationTypes}
    projectId={projectId}
    onElevationTypeUpdated={handleElevationTypeUpdated}
  />
)}
```

---

## Final JSON Export — Door-Level `elevationImageUrl`

In the export service (wherever the final JSON is assembled), resolve the URL at export time:

```typescript
// When building each door entry for the export JSON:
const elevationType = elevationTypes.find(
  et => et.id === door.elevationTypeId || et.name === door.elevationTypeId
);

const doorExportEntry = {
  doorTag: door.doorTag,
  doorLocation: door.location,
  // ... all other door fields ...
  doorElevationType: elevationType?.name ?? door.elevationTypeId ?? null,
  elevationImageUrl: elevationType?.imageUrl ?? null,  // ← resolved URL
};
```

This way every door subobject in the final JSON carries its elevation image URL, as requested.

---

## Supabase Storage Bucket Setup

```sql
-- Run in Supabase SQL editor or via migration
INSERT INTO storage.buckets (id, name, public)
VALUES ('door-elevations', 'door-elevations', true);

-- Public read policy (images are non-sensitive)
CREATE POLICY "Public read door elevations"
ON storage.objects FOR SELECT
USING (bucket_id = 'door-elevations');

-- Authenticated users can upload
CREATE POLICY "Auth users upload door elevations"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'door-elevations');

-- Authenticated users can delete (for replace flow)
CREATE POLICY "Auth users delete door elevations"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'door-elevations');
```

---

## Implementation Order (Phased)

### Phase 1 — Foundation (no UI yet)
- [x] Create `door-elevations` bucket in Supabase (SQL above)
- [x] Add `imageUrl` and `imagePath` to `ElevationType` interface in `types.ts`
- [x] Create `services/elevationService.ts` with compress + upload + delete functions
- [ ] Write compression unit test: input file → output is WebP, ≤ original size, ≤ 1920px wide

### Phase 2 — Elevation Tab UI
- [x] Create `components/ElevationTab.tsx` (all 4 UI states)
- [x] Add `elevation` tab to `EnhancedDoorEditModal.tsx` TABS array
- [x] Wire up upload flow in `ElevationManager`: file picked → compress → upload → update ElevationType.imageUrl in context
- [x] Show "shared by N doors" count in the tab
- [x] Elevation type matching: `et.id === door.elevationTypeId || et.code === ... || et.name === ...` (covers Excel-sourced doors where elevationTypeId is the raw code string, not a UUID)
- [x] `ElevationManager` redesigned to match app UI language

> ⚠️ **Implementation note:** The plan's Mental Model (line 22) and Export section (line 257) already specified matching by `name/code` fallback. During implementation this was initially missed — `ElevationTab` only matched by `id`. Also, `ElevationManager` was rewritten for UI but the Supabase upload call was not wired in until the bug was caught. Always re-read the plan's matching logic before shipping the find() call.

### Phase 3 — Export Integration
- [ ] Update export service to include `elevationImageUrl` per door in final JSON
- [ ] Verify PDF/Excel export also carries the URL (if applicable)

### Phase 4 — Polish
- [ ] Loading skeleton while image fetches
- [x] Image lightbox / full-screen view on click (implemented in ElevationTab)
- [x] Replace flow with old-image deletion (implemented in ElevationTab)
- [ ] Optional: Bulk upload in ElevationManager (upload images for multiple types at once)

---

## Open Questions / Decisions Needed

| # | Question | Default Assumption |
|---|----------|-------------------|
| 1 | Are elevation types stored in the DB or only in localStorage/context? | LocalStorage/context for now — URL rides along in the ElevationType object |
| 2 | Should the bucket be public or signed URLs? | Public — elevation screenshots aren't sensitive; simpler to render in `<img>` |
| 3 | Should replacing an image delete the old one from Storage? | Yes — avoid orphaned files accumulating |
| 4 | Should the Elevation tab show even if no image exists (to encourage upload)? | Yes — show upload zone, not hidden tab |
| 5 | Does the final JSON export need the full URL or just the storage path? | Full public URL — consumers shouldn't need to reconstruct it |

---

## Constraints Respected

- No new `localStorage` keys — elevation image URLs stored in Supabase Storage + `ElevationType` objects already in context
- No direct API calls from components — `elevationService.ts` is the only layer touching Supabase Storage
- No `any` TypeScript — all file/blob types are explicit
- Dark mode — `ElevationTab` and `ElevationUploadZone` will use only CSS custom property tokens
- Image rendered in `<img>` with `loading="lazy"` and explicit `width/height` to avoid layout shift
