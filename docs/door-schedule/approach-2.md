# PlanckOff — Hybrid OCR & Micro-Vision Pipeline Architecture
> Enterprise Architecture for High-Resolution Blueprint Parsing & Door Schedule Extraction

---

## 1. Architectural Summary & The "Zoom" Solution

**The Limitation:** Standard Vision LLMs (Gemini, Claude) heavily compress massive architectural blueprints to fit within memory constraints. This causes tiny text (like door tags) and fine geometry to become illegible, leading to hallucinated data and inaccurate bounding boxes.

**The Hybrid Solution:** We decouple **Detection** from **Comprehension**.
1. **Detection (OCR):** A traditional OCR engine scans the high-resolution blueprint to find text and returns exact X/Y coordinates.
2. **Cropping:** The backend physically crops a tiny, uncompressed square around the detected text.
3. **Comprehension (Micro-Vision AI):** The LLM only looks at the tiny cropped square to determine architectural features (Hand of Opening, Double/Single Leaf).

This approach drastically reduces AI API costs, eliminates hallucinations, and provides mathematically perfect coordinates for the frontend UI.

---

## 2. Updated Layered Architecture Map

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER (React 19 / Next.js)                                │
│ - Interactive Blueprint Canvas (Leaflet.js or OpenSeadragon for zoom)  │
│ - Absolute-positioned HTML <div> overlays acting as interactive doors  │
│   using exact OCR-derived bounding box coordinates.                    │
├────────────────────────────────────────────────────────────────────────┤
│ SERVICE LAYER / TASKS (Background Jobs via Trigger.dev or Inngest)     │
│ - PDF Rasterizer: Converts PDF binary streams into 300 DPI PNGs.       │
│ - Smart Cropper: Uses Node `sharp` library to slice 400x400px tiles.   │
│ - AI Orchestrator: Fires Micro-Vision LLM prompts in parallel batches. │
├────────────────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE LAYER (External APIs)                                   │
│ - Google Cloud Vision API (DOCUMENT_TEXT_DETECTION) for fast OCR.      │
│ - Gemini 1.5 Pro / Claude 3.5 Sonnet for visual semantic reasoning.    │
├────────────────────────────────────────────────────────────────────────┤
│ DATA LAYER (Supabase Infrastructure)                                   │
│ - Supabase Storage: Temp buckets for massive PNGs and tiny Crop JPEGs. │
│ - Supabase PostgreSQL: Managed JSONB storage for final Schedule Rows.  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 6-Phase Execution Pipeline (Fan-Out / Fan-In)

This workflow runs asynchronously in your background job worker to prevent HTTP timeouts.

**Phase 1: Rasterization**
* Worker downloads the uploaded `Doors.pdf` from Supabase Storage.
* Uses Ghostscript/MuPDF to convert each page into a 300+ DPI uncompressed PNG.

**Phase 2: Master Schedule Extraction (The Baseline)**
* Worker sends the cover sheet / door schedule table pages to the LLM to extract an array of known valid tags: `["1109", "MEC-1", "ST-1"]`.

**Phase 3: The OCR Pass (High-Speed Detection)**
* Worker sends the high-res floor plan images to Google Cloud Vision API.
* *Output:* Returns a JSON array of all text strings on the page and their bounding polygons.
* *Filter Step:* Application code filters this list, keeping ONLY bounding boxes where the text string matches an item from the Phase 2 Master Tag array.

**Phase 4: Smart Cropping (The "Zoom")**
* Using the Node.js `sharp` library, the worker iterates over the filtered OCR bounding boxes.
* It calculates the center of the text and crops a `400px by 400px` square of the image around that point.
* *Result:* You now have tiny, crystal-clear images of just the door thresholds.

**Phase 5: Micro-Vision AI Pass (Semantic Comprehension)**
* Worker batches the cropped squares (e.g., 5-10 at a time) and sends them to the Vision LLM with a highly targeted Micro-Prompt (see Section 4).
* The LLM identifies the Hand of Opening and Leaf Count based strictly on the uncompressed crop.

**Phase 6: Reduce & Aggregate**
* Worker combines the exact coordinates from Phase 3 with the architectural metadata from Phase 5.
* It groups by tag to generate the `QUANTITY` field and writes the final structured Master JSON object to Supabase PostgreSQL.

---

## 4. Micro-Vision Prompt Specification

Because the LLM is no longer searching a cluttered page, the prompt becomes highly deterministic. 

**API Configuration:**
* **Model:** `gemini-1.5-pro` or `claude-3-5-sonnet`
* **Temperature:** `0.0`
* **Response Type:** `application/json`

**System Prompt:**
```text
You are an expert architectural draftsperson. I am providing you with a tightly cropped image of a single door opening on a floor plan. The central text tag identifies this door.

Your task is to evaluate ONLY this cropped geometry and output the structural door parameters based on standard architectural swing arcs.

### STRUCTURAL RULES FOR HAND OF OPENING
1. LEFT HAND (LH): Hinges on the left, door pushes away from you (swings inward).
2. RIGHT HAND (RH): Hinges on the right, door pushes away from you (swings inward).
3. LEFT HAND REVERSE (LHR): Hinges on the left, door pulls toward you (swings outward).
4. RIGHT HAND REVERSE (RHR): Hinges on the right, door pulls toward you (swings outward).

### OUTPUT JSON FORMAT
Return a valid, un-nested JSON object containing exclusively the keys specified below.

{
  "hand_of_opening": "LEFT HAND REVERSE", // Enum: LH, RH, LHR, RHR, or UNKNOWN
  "leaf_count": "SINGLE" // Enum: SINGLE, DOUBLE, or UNEQUAL
}
```

---

## 5. Frontend Interactive Overlay Strategy (React/Next.js)

To achieve the "Bild.ai" style clickable blueprints, the frontend must render absolute HTML elements over the static background image. 

**Implementation Details:**
1. **Deep Zoom Library:** Do not rely on standard CSS `transform: scale()` for 4K images. Use **Leaflet.js** (via `react-leaflet`) with `L.imageOverlay`. This handles browser memory management for massive images perfectly.
2. **Coordinate Mapping:** The coordinates saved in the database from the OCR pass (Phase 3) must be converted into percentage-based positions or mapped strictly to the native width/height of the base image.
3. **HTML Highlighting:** ```tsx
// Abstracted example of the React Overlay mapping
{detectedDoors.map(door => (
  <div
    key={door.id}
    className="absolute border-[3px] border-green-500 hover:bg-green-500/30 cursor-pointer"
    style={{
      // Coordinates derived directly from the Google Vision OCR output
      top: `${door.ocrBox.ymin}px`,
      left: `${door.ocrBox.xmin}px`,
      width: `${door.ocrBox.xmax - door.ocrBox.xmin}px`,
      height: `${door.ocrBox.ymax - door.ocrBox.ymin}px`,
    }}
    onClick={() => openEditorSidebar(door)}
  >
    <span className="bg-black text-white text-xs">{door.tag}</span>
  </div>
))}
```

---

## 6. Required Tech Stack Additions

To execute this architecture, the following libraries must be added to the project:

* **Background Workers:** `inngest` or `@trigger.dev/sdk`
* **Image Processing:** `sharp` (High-performance Node.js image processing)
* **OCR Provider:** `@google-cloud/vision` (Specifically the `documentTextDetection` method)
* **Frontend Zoom:** `leaflet` and `react-leaflet` (for rendering the interactive canvas)