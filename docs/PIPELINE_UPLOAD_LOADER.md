# Pipeline Upload Loader

Animated progress card shown while the user's Excel + PDF files are being processed.

---

## What it looks like

An expanding card (similar to AI "thinking" UIs) that reveals pipeline steps one by one:

- Each step row slides in and shows a spinning circle → green checkmark on complete
- The card expands vertically as steps are added
- Once it reaches ~5 visible rows it stops growing; older rows scroll upward smoothly
- On full completion, the card fades to a success state

---

## Pipeline steps (in order)

| # | Label | Detail line |
|---|-------|-------------|
| 1 | Understanding request | Parsing uploaded files |
| 2 | Reading door schedule | Connecting to Excel workbook |
| 3 | Extracting hardware sets | Parsing PDF hardware data |
| 4 | Merging data | Matching doors to hardware sets |
| 5 | Resolving descriptions | Computing door dimensions |
| 6 | Saving project | Writing to database |

---

## Implementation — Option A (current): Client-side simulation

**Status: implemented**

### How it works

The pipeline always runs the same 6 steps in the same sequence. Instead of streaming real events from the server, the client advances through the steps using known timing anchors:

1. **Step 1** fires immediately when upload starts
2. **Steps 2–3** fire on short fixed delays (Excel parse is fast, PDF parse is slower)
3. **Step 4** fires when the API call returns (merge is done server-side)
4. **Steps 5–6** fire on short delays after the API response (client-side resolve + DB write)

The component is decoupled from timing — it only receives a `currentStep: number` prop and animates accordingly. The hook (`useProjectUploads`) drives step advancement.

### Key files

| File | Role |
|------|------|
| `components/upload/PipelineLoader.tsx` | The animated card component |
| `hooks/useProjectUploads.ts` | Drives step index as upload progresses |

### Component API

```tsx
<PipelineLoader
  isVisible={boolean}        // mount/unmount the card
  currentStep={number}       // 0-based index of the active step (0–5)
  onComplete={() => void}    // called after the final step's animation finishes
/>
```

### Animation details

- **Card expand**: CSS `max-height` transition on a wrapper div (0 → auto via measured height)
- **Row entrance**: each row slides in from below with opacity fade (`transform: translateY(8px) → 0`)
- **Spinner → checkmark**: SVG stroke-dashoffset animation on complete
- **Scroll-up**: wrapper has `overflow: hidden` + fixed max visible height; completed rows push up naturally as new rows appear
- **Completion fade**: whole card opacity → 0 after 800 ms hold

---

## Option B (future): Server-Sent Events

**Status: planned, not implemented**

### Why upgrade

Option A timing is approximate. Under slow network or large PDFs the step labels can be out of sync with what the server is actually doing. SSE gives real-time accuracy at the cost of backend changes.

### What changes

#### Server (`app/api/projects/[id]/process/route.ts`)

Switch from returning a single JSON response to streaming an `EventStream`:

```ts
// Instead of: return NextResponse.json(result)
const stream = new TransformStream();
const writer = stream.writable.getWriter();

// emit at each real milestone:
await writer.write(encode({ event: 'step', data: '{ "step": 2, "label": "Reading door schedule" }' }));
// ...run Excel parse...
await writer.write(encode({ event: 'step', data: '{ "step": 3, "label": "Extracting hardware sets" }' }));
// ...etc...
await writer.write(encode({ event: 'done', data: JSON.stringify(finalResult) }));
await writer.close();

return new Response(stream.readable, {
  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
});
```

#### Client (`hooks/useProjectUploads.ts`)

Replace `fetch(...).then(res => res.json())` with an `EventSource` (or manual `ReadableStream` reader) that dispatches step events to `PipelineLoader` as they arrive.

#### Component (`components/upload/PipelineLoader.tsx`)

No changes needed — the component already accepts `currentStep: number`. Only the source of that number changes (SSE events instead of timers).

### Migration path

1. Add SSE streaming to the API route
2. Replace the timer-based step advancement in `useProjectUploads` with SSE event handlers
3. Delete the timer constants — everything else stays the same

---

## Design reference

Screenshots of the target design are in the project's Figma / shared with the team separately.
The loader style is modelled after Perplexity AI's "Searching…" / "Analyzing…" step cards.
