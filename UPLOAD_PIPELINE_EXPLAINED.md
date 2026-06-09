# Upload Pipeline Explained

This document explains how files (Excel door schedules + hardware PDFs) travel through the system — from when a user clicks "upload" to when the final merged data is saved in the database.

There are **two systems** in this codebase that do uploads. One is **old (legacy)** and no longer the primary path. One is **modern** and actively used. Understanding both will help you navigate the code.

---

## Table of Contents

1. [Simple Overview — What Happens When You Upload](#1-simple-overview)
2. [The Legacy Worker System (What It Is and Why It Exists)](#2-the-legacy-worker-system)
   - [What is a Web Worker?](#what-is-a-web-worker)
   - [The Worker File: `workers/upload.worker.ts`](#the-worker-file)
   - [The Queue Manager: `contexts/BackgroundUploadContext.tsx`](#the-queue-manager)
   - [The Crash Memory: `utils/uploadPersistence.ts`](#the-crash-memory-indexeddb)
   - [How They All Connect (Legacy Flow)](#how-they-all-connect-legacy-flow)
   - [Why This Was Replaced](#why-this-was-replaced)
3. [The Modern Server-Side Pipeline](#3-the-modern-server-side-pipeline)
   - [Stage 1 — Door Schedule Parsing (Excel)](#stage-1--door-schedule-parsing-excel)
   - [Stage 2 — PDF Hardware Extraction (Two Tiers)](#stage-2--pdf-hardware-extraction-two-tiers)
   - [Stage 3 — Hardware Prep Generation](#stage-3--hardware-prep-generation)
   - [Stage 4 — Master Hardware Queueing](#stage-4--master-hardware-queueing)
   - [Stage 5 — Door-to-Set Matching (Merge)](#stage-5--door-to-set-matching-merge)
   - [Stage 6 — Save to Database](#stage-6--save-to-database)
4. [API Endpoints](#4-api-endpoints)
5. [Database Tables](#5-database-tables)
6. [Full Flow Diagram](#6-full-flow-diagram)
7. [Key Files Quick Reference](#7-key-files-quick-reference)

---

## 1. Simple Overview

When a user uploads an Excel file (door schedule) and a PDF (hardware sets), this is what happens at a high level:

```
User uploads files
      ↓
Server receives them
      ↓
Excel → parsed into door list (door 101 uses set CA01, etc.)
PDF  → AI reads it and extracts hardware sets (CA01 = 2x Hinges, 1x Lever, etc.)
      ↓
Merge: match each door to its hardware set
      ↓
Save to database → reports and submittal packages can now be generated
```

No magic. No queue. No background jobs. It's a straight synchronous server call — the client waits, the server does all the work, then responds when done.

---

## 2. The Legacy Worker System

> **Status: Still in the codebase but NOT the active upload path.** It was the original design and was replaced. Understanding it helps you know what `workers/`, `contexts/BackgroundUploadContext.tsx`, and `utils/uploadPersistence.ts` are doing.

### What is a Web Worker?

Your browser runs JavaScript on a single thread. If you do something heavy (parse a big file, call an AI API) on that thread, the whole UI freezes — buttons stop responding, animations stutter, the page feels broken.

A **Web Worker** is a way to run JavaScript on a **separate background thread** inside the browser. You spin it up, send it a message with the file and settings, it does the heavy work, and it sends progress updates and a final result back to the main page — all without freezing the UI.

Think of it like a kitchen: the main thread is the waiter taking orders and talking to customers. The Web Worker is the cook in the back, doing the actual food prep. They communicate through a small window (message passing), but they don't block each other.

### The Worker File

**`workers/upload.worker.ts`** — This is the actual background thread code.

```
Main page                          Worker (background thread)
   │                                     │
   │── postMessage({ taskId, file }) ──▶ │  receives message
   │                                     │  starts processing file
   │◀── postMessage({ type:'progress' }) │  sends progress (e.g., 45%)
   │◀── postMessage({ type:'progress' }) │  sends progress (e.g., 80%)
   │◀── postMessage({ type:'complete' }) │  sends final result
```

The worker handles three message types it **receives**:
- `START` (default, no `action` field) — start processing a file
- `STOP` — pause/stop gracefully after current chunk finishes
- `CANCEL` — abort immediately, discard result

The worker sends these message types **back**:
- `progress` — percentage + stage label (e.g., "Extracting text... 45%")
- `partial_data` — a chunk of results as they stream in (so UI can show data early)
- `complete` — final result object
- `error` — something went wrong
- `cancelled` — user cancelled, discard this task

The worker uses an `AbortController` per task (`controllers` Map) to signal cancellation down into the service functions.

**Key lines in the file:**

```ts
// Line 3 — one AbortController per task so multiple can be tracked
const controllers = new Map<string, AbortController>();

// Line 5 — this is how a Web Worker receives messages from the main page
self.onmessage = async (e: MessageEvent) => { ... }

// Line 41 — actually calls the processing service
result = await processDoorScheduleFile(file, apiKey, onProgress, onData, controller.signal, settings);

// Line 48 — sends the final result back to the main page
self.postMessage({ type: 'complete', taskId, result });
```

### The Queue Manager

**`contexts/BackgroundUploadContext.tsx`** — This is the React glue that:
1. Spins up the Web Worker when the app loads
2. Maintains a list of upload tasks (`tasks` state)
3. Implements a **FIFO queue** — one upload processes at a time
4. Persists tasks to IndexedDB (so they survive page refresh)
5. Exposes `queueUpload`, `cancelUpload`, `stopUpload`, `retryUpload` to the rest of the app

**In simple terms:** it's the "upload manager" panel you might picture in a download manager app — a list of items that are queued, in-progress, done, or errored.

**How the queue works (lines 85–94):**

```ts
// Every time the tasks list changes, check if we should start the next one
useEffect(() => {
    if (!isWorkerReady) return;
    if (processingRef.current) return;  // ← already processing one, wait

    const nextTask = tasks.find(t => t.status === 'pending');
    if (nextTask) {
        startTask(nextTask);  // ← start the first pending task
    }
}, [tasks, isWorkerReady]);
```

Only one task runs at a time. When it finishes, `processingRef.current` goes back to `false`, the effect re-runs, and the next pending task starts automatically.

**Task lifecycle:**

```
pending → processing → completed
                     → error
                     → cancelled (removed from list)
```

**On page reload (lines 69–77):** Any task that was `processing` when the page closed gets reset back to `pending` with the stage label "Interrupted (Restarting)". This way, uploads that got cut off restart automatically.

### The Crash Memory (IndexedDB)

**`utils/uploadPersistence.ts`** — This is a tiny wrapper around the browser's **IndexedDB** database.

IndexedDB is a key-value store built into the browser that survives page refreshes (unlike `useState`, which is lost when you close the tab). It stores tasks by their `id`.

Three functions:
- `saveTaskToDB(task)` — save/update a task (called every time status changes)
- `getTasksFromDB()` — load all saved tasks on app startup
- `deleteTaskFromDB(id)` — remove a task (called when user clears completed)

Database name: `planckoff_uploads`, store name: `queue`.

This is why if you close the browser mid-upload, come back, and the task is still in the queue — IndexedDB remembered it.

### How They All Connect (Legacy Flow)

```
User picks a file
      ↓
BackgroundUploadContext.queueUpload()
  → creates a task with status: 'pending'
  → saves task to IndexedDB (uploadPersistence.saveTaskToDB)
  → adds to tasks[] state
      ↓
Queue effect fires (tasks changed)
  → finds the pending task
  → calls startTask()
  → sends postMessage to the Web Worker with the file
      ↓
Web Worker receives the message
  → calls processDoorScheduleFile() or processHardwareSetFile()
    (these were the V1 services — client-side processing)
  → posts 'progress' messages as it works
      ↓
BackgroundUploadContext.handleWorkerMessage()
  → receives 'progress' → updates task progress in state + IndexedDB
  → receives 'partial_data' → appends data chunks to task.partialData
  → receives 'complete' → marks task as completed, stores result
  → receives 'error' → marks task as error
  → receives 'cancelled' → removes task from list
```

### Why This Was Replaced

The client-side (browser) processing had real problems:

1. **PDFs with broken/embedded fonts** — text extraction in the browser produced garbled output. The server-side Tier 2 visual fallback (render to images → Gemini reads them like a human) can't run in a browser.
2. **Large files** — running AI API calls from the browser required exposing API keys to the client.
3. **Reliability** — if the user closed the tab, the processing died. Server-side, it completes regardless.
4. **The V1 services** (`fileUploadService.ts`, `hardwarePdfService.ts`) were less capable than V2.

The modern pipeline moved everything to the server. The Web Worker system became unnecessary — server-side Next.js API routes handle all processing now.

---

## 3. The Modern Server-Side Pipeline

All active uploads go through `app/api/projects/[id]/process/route.ts` (or the individual endpoints). No worker, no queue, no IndexedDB. Just a POST request that the server handles start-to-finish.

### Stage 1 — Door Schedule Parsing (Excel)

**File:** `services/doorScheduleService.ts`

The Excel file is parsed on the server:

1. Detect file format (`.xlsx`, `.xls`, or `.csv`)
2. **Pick the right sheet** — scores each sheet by how many door-schedule keywords it contains (`DOOR`, `FRAME`, `HARDWARE`, `HINGE`, etc.)
3. **Handle two-row headers** — some schedules span two rows with section groups (`BASIC INFORMATION | DOOR | FRAME | HARDWARE`) merged across columns
4. **Normalize headers** — 100+ header variants all map to canonical names:
   - `"door #"`, `"Dr. #"`, `"Mark"` → `doorTag`
   - `"hw set"`, `"hardware set #"`, `"Set #"` → `hwSet`
5. Parse each row into a typed `DoorScheduleRow` object
6. Save to `door_schedule_imports` table

### Stage 2 — PDF Hardware Extraction (Two Tiers)

**Files:** `services/hardwarePdfServiceV2.ts`, `lib/ai/pdfTextExtractor.ts`

This is the most complex stage. There are two strategies tried in order:

#### Tier 1 — Text Extraction (Fast)

1. Use `pdfjs-dist` to extract text with x/y coordinates from every page
2. Group text items by their y-coordinate (within 3pt tolerance) to reconstruct visual rows
3. Check if hardware keywords appear — if not, the font is garbled → skip to Tier 2
4. Group pages into 10-page batches (with 1-page overlap to handle sets that span page boundaries)
5. Send up to 4 batches in parallel to Gemini 2.5 Flash via OpenRouter
6. Merge results from all batches, deduplicating sets with the same name

#### Tier 2 — Visual Fallback (Slower, for garbled PDFs)

Used when Tier 1 fails or returns 0 sets:

1. Render each PDF page to a PNG image at 2× resolution using `@napi-rs/canvas`
2. For wide architectural drawings: crop to the bottom-right quadrant (where the hardware table typically lives)
3. Send all page images to Gemini as a single multimodal call
4. Gemini reads the PDF visually — like a human would — and extracts the same structured data

**Tier selection logic:**
- Always try Tier 1 first
- If Tier 1 returns 0 sets OR throws → try Tier 2
- Response includes `tier: 1` or `tier: 2` so you know which path ran

**Skip conditions:**
- File > 15 MB → skip Tier 1
- File > 20 MB → skip Tier 2 entirely (too large even for images)

### Stage 3 — Hardware Prep Generation

**File:** `services/hardwarePrepService.ts`

After extraction, one batched AI call determines the "prep" (function string) for each set — e.g., `"Hinge + Lever + Elec Strike"`. This is an industry-standard column in hardware schedules.

This stage is **non-fatal** — if it fails, the pipeline continues without prep data.

### Stage 4 — Master Hardware Queueing

**File:** `lib/db/masterHardware.ts`

New unique hardware items found in the PDF are inserted into the `master_hardware_pending` table for admin review before they enter the master library. Duplicates are silently skipped.

### Stage 5 — Door-to-Set Matching (Merge)

**File:** `services/mergeService.ts`

Each door row from the Excel file has a `hwSet` field (e.g., `"CA01"`). Each extracted PDF set has a `setName`. This stage links them together.

Five matching strategies are tried in order (first match wins):

| Strategy | Example |
|---|---|
| Exact match (case-insensitive) | `"CA01"` === `"CA01"` |
| Comma-space normalization | `"S2,S4,S5"` ↔ `"S2, S4, S5"` |
| Numeric equivalence | `"1"` === `"001"` |
| Starts-with + separator check | `"P200"` matches `"P200 – Elevator Lobby"` |
| Reverse token match | Door `"S2"` matches set `"S2, S4, S5, S6"` |
| Prefix fallback (last resort) | `"ad05e"` → strips trailing letter → `"ad05"` |

Special cases:
- Doors with no `hwSet` → stored under `__unassigned__` sentinel
- Doors listing multiple sets (e.g., `"P106, P109"`) → linked to all matched sets

### Stage 6 — Save to Database

All DB writes happen **after all AI work completes**. If the client aborts mid-processing, nothing is written — the project stays in its prior state.

Writes in order:
1. `door_schedule_imports` — raw parsed door rows
2. `hardware_pdf_extractions` — raw extracted hardware sets
3. `master_hardware_pending` — new items for admin approval
4. `project_hardware_finals` — the final merged JSON (source of truth for all reports)

---

## 4. API Endpoints

| Endpoint | Method | What it does |
|---|---|---|
| `/api/projects/[id]/door-schedule` | POST | Upload + parse Excel file |
| `/api/projects/[id]/door-schedule` | GET | Fetch cached door schedule |
| `/api/projects/[id]/door-schedule` | PUT | Prune specific doors from schedule |
| `/api/projects/[id]/door-schedule` | PATCH | Update a single door row |
| `/api/projects/[id]/hardware-pdf` | POST | Upload + extract PDF hardware sets |
| `/api/projects/[id]/hardware-pdf` | GET | Fetch cached PDF extraction |
| `/api/projects/[id]/hardware-pdf` | PUT | Update sets (for variant creation) |
| `/api/projects/[id]/process` | POST | **Combined**: both files + merge in one call |

---

## 5. Database Tables

| Table | What it stores |
|---|---|
| `door_schedule_imports` | Parsed rows from the Excel upload |
| `hardware_pdf_extractions` | Extracted hardware sets from the PDF |
| `master_hardware_pending` | New hardware items waiting for admin approval |
| `project_hardware_finals` | **Source of truth** — final merged data used by all reports |

---

## 6. Full Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│  User uploads Excel + PDF via the UI                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
              POST /api/projects/[id]/process
                             │
              ┌──────────────┼──────────────┐
              │                             │
              ▼                             ▼
   ┌─────────────────────┐      ┌─────────────────────────────┐
   │ Excel Parsing        │      │ PDF Extraction               │
   │ (doorScheduleService)│      │ (hardwarePdfServiceV2)       │
   │                     │      │                             │
   │ • Pick best sheet   │      │  Try Tier 1:                │
   │ • Normalize headers │      │  • pdfjs text extract       │
   │ • Parse each row    │      │  • AI batch calls (Gemini)  │
   └──────────┬──────────┘      │                             │
              │                 │  If Tier 1 fails → Tier 2:  │
              │                 │  • Render pages to images   │
              │                 │  • Gemini reads visually    │
              │                 └──────────────┬──────────────┘
              │                                │
              │                                ▼
              │                 ┌─────────────────────────────┐
              │                 │ Prep Generation              │
              │                 │ (hardwarePrepService)        │
              │                 │ "Hinge + Lever + Elec Strike"│
              │                 └──────────────┬──────────────┘
              │                                │
              │                                ▼
              │                 ┌─────────────────────────────┐
              │                 │ Master Hardware Queueing     │
              │                 │ (lib/db/masterHardware)      │
              │                 │ New items → pending approval │
              │                 └──────────────┬──────────────┘
              │                                │
              └──────────────┬─────────────────┘
                             │
                             ▼
              ┌─────────────────────────────────────┐
              │ Merge: Door ↔ Set Matching           │
              │ (mergeService)                       │
              │ 5 strategies to match hwSet → setName│
              └──────────────────┬──────────────────┘
                                 │
                                 ▼
              ┌─────────────────────────────────────┐
              │ Database Writes                      │
              │ 1. door_schedule_imports             │
              │ 2. hardware_pdf_extractions          │
              │ 3. master_hardware_pending           │
              │ 4. project_hardware_finals ← truth   │
              └──────────────────┬──────────────────┘
                                 │
                                 ▼
              ┌─────────────────────────────────────┐
              │ Response to Client                   │
              │ { setCount, matchedDoorCount,        │
              │   unmatchedDoorCount, warnings,      │
              │   rowCount, itemCount, tier }        │
              └─────────────────────────────────────┘
```

---

## 7. Key Files Quick Reference

| File | What it does |
|---|---|
| `workers/upload.worker.ts` | **[LEGACY]** Browser Web Worker — runs file processing off the main UI thread |
| `contexts/BackgroundUploadContext.tsx` | **[LEGACY]** React context that manages the worker, task queue, and task state |
| `utils/uploadPersistence.ts` | **[LEGACY]** IndexedDB wrapper — persists upload tasks across page refreshes |
| `services/fileUploadService.ts` | **[LEGACY]** V1 client-side file processing services |
| `services/hardwarePdfService.ts` | **[LEGACY]** V1 PDF extraction |
| `app/api/projects/[id]/process/route.ts` | **[ACTIVE]** Combined upload endpoint — orchestrates the whole pipeline |
| `app/api/projects/[id]/door-schedule/route.ts` | **[ACTIVE]** Door schedule upload/fetch/edit endpoint |
| `app/api/projects/[id]/hardware-pdf/route.ts` | **[ACTIVE]** Hardware PDF upload/fetch endpoint |
| `services/doorScheduleService.ts` | **[ACTIVE]** Excel parsing, header normalization, sheet detection |
| `services/hardwarePdfServiceV2.ts` | **[ACTIVE]** PDF extraction orchestration (Tier 1 + Tier 2 fallback) |
| `lib/ai/pdfTextExtractor.ts` | **[ACTIVE]** pdfjs text extraction + PDF-to-image rendering |
| `services/hardwarePrepService.ts` | **[ACTIVE]** AI-generated prep/function strings per set |
| `services/mergeService.ts` | **[ACTIVE]** Door-to-set matching with 5-strategy cascade |
| `lib/db/hardware.ts` | **[ACTIVE]** Supabase operations for schedule, extraction, finals tables |
| `lib/db/masterHardware.ts` | **[ACTIVE]** Queues new hardware items for admin approval |
