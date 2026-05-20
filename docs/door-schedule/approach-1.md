# PlanckOff — Floor Plan Vision Pipeline Architecture
> Blueprint & Implementation Strategy for Automated Door Counting & Hand Detection

---

## 1. Architectural Summary

To safely process up to 100-page visual floor plans without causing API timeouts, crashing server instances, or risking hallucinated counts, PlanckOff must shift from a text-based extraction approach to an **Asynchronous Vision Pipeline**. 

Instead of asking an LLM to *count* occurrences, the AI acts purely as an **Object Detector** across rasterized high-resolution images. The backend application layer then takes responsibility for aggregating, deduplicating, and compiling the counts into the master JSON schema.

---

## 2. Updated Layered Architecture Map

```text
┌────────────────────────────────────────────────────────────────────────┐
│ PRESENTATION LAYER (React 19 / Next.js Front-End)                      │
│ - Upload Dropzone for Blueprint PDFs (Max 100 Pages)                   │
│ - Real-Time Progress Bar (Subscribed to Supabase Postgres Realtime)    │
│ - Canvas Overlay Engine: Maps absolute <div> elements over page        │
│   images using AI-generated bounding box coordinates for user audits.  │
├────────────────────────────────────────────────────────────────────────┤
│ SERVICE LAYER / TASKS (Background Jobs via Trigger.dev or Inngest)     │
│ - Job Orchestration: Manages state, execution limits, and retries.     │
│ - PDF Rasterizer Engine: Converts PDF binary streams into high-res PNGs│
│ - Map-Reduce Aggregator: Controls parallel batch execution & outputs   │
│   the final structural JSON file.                                      │
├────────────────────────────────────────────────────────────────────────┤
│ INFRASTRUCTURE LAYER (Next.js Serverless Routes / Edge Enablers)       │
│ - Event Emitters: Receives payload upload metadata, boots worker events│
│ - AI Orchestration Proxy: Interacts with Gemini 1.5 Pro / Claude 3.5.  │
├────────────────────────────────────────────────────────────────────────┤
│ DATA LAYER (Supabase Infrastructure)                                   │
│ - Supabase Storage: Buckets for raw blueprints and compressed PNGs.    │
│ - Supabase PostgreSQL: Managed JSONB storage for structural objects.   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Detailed Data Pipeline Flow (The Fan-Out / Fan-In Blueprint)

1. **Upload & Trigger:** The user uploads the `Doors.pdf` blueprint to Supabase Storage. Your Next.js app immediately fires a webhook to your job queue (e.g., `blueprint.uploaded`).
2. **Phase 1 (Rasterization):** The background worker downloads the PDF, converts the 100 pages into 100 individual high-res PNG images, and saves them to an ephemeral storage folder.
3. **Phase 2 (Master Tag Inventory):** The worker sends the Schedule Table pages to the LLM to extract the exact inventory strings (e.g., `["T1", "B101-1", "B101-2"]`).
4. **Phase 3 (The Map Step):** The worker batches the remaining plan views (e.g., 5 concurrent calls to prevent rate limits). It injects the Master Tag Inventory + individual Page Image into the LLM. The AI identifies coordinates, door tag, and Hand of Opening per item.
5. **Phase 4 (The Reduce Step):** The background worker combines all array fragments into a single collection, runs grouping logic to generate the `QUANTITY`, and injects the data into the final Master Sheet JSON structure.

---

## 4. Production Master Prompt Specification

This structured prompt utilizes strict constraints and structural parameters to leverage the native multi-modal capabilities of Gemini 1.5 Pro or Claude 3.5 Sonnet.

**API Configuration:**
* **Model:** `gemini-1.5-pro` or `claude-3-5-sonnet`
* **Temperature:** `0.0` (Critical for structural stability)
* **Response Type:** `application/json`

**System Prompt:**
```text
You are an expert door hardware estimator and architectural draftsperson. Your task is to act as a highly accurate spatial object detector on the attached floor plan image. 

I will provide you with a master array of valid door tags for this project. Your goal is to find every single occurrence of these door tags on this plan sheet, deduce the structural hand of opening from the drawing's swing arc, and provide its coordinates.

### INPUT DATA
Valid Project Door Tags: {{MASTER_DOOR_TAGS_ARRAY}}

### STRUCTURAL RULES FOR HAND OF OPENING
You must identify the door "Handing" by analyzing the location of the hinges and the arc directional path:
1. LEFT HAND (LH): Hinges are on the left, door pushes away from you (swings inward).
2. RIGHT HAND (RH): Hinges are on the right, door pushes away from you (swings inward).
3. LEFT HAND REVERSE (LHR): Hinges are on the left, door pulls toward you (swings outward).
4. RIGHT HAND REVERSE (RHR): Hinges are on the right, door pulls toward you (swings outward).

### EXTRACTION STEPS
1. Scan the drawing thoroughly for text callouts matching any string listed in the "Valid Project Door Tags" array.
2. For each discovered text callout, identify the exact door swing arc geometry connected to or immediately adjacent to that text callout.
3. Compute the normalized bounding box coordinates bounding both the text tag and the door frame asset.
4. Evaluate the handing type based on the architectural rules provided above.

### OUTPUT JSON FORMAT
You must return a valid, un-nested JSON array containing exclusively objects with the keys specified below. Do not wrap the response in markdown code blocks or provide commentary.

[
  {
    "detected_tag": "B101-1",
    "hand_of_opening": "LEFT HAND",
    "bounding_box": {
      "ymin": 240,
      "xmin": 450,
      "ymax": 285,
      "xmax": 495
    },
    "confidence_score": 0.96
  }
]

### CRITICAL CONSTRAINTS
- Do not estimate total quantities. Output one distinct object for every individual door frame tag you locate on the page. 
- If a door tag matches textually but does not feature an accompanying swing drawing, categorize it but lower the confidence_score to under 0.50.
- Use a 0-1000 scale for bounding box coordinates where (ymin: 0, xmin: 0) is top-left, and (ymax: 1000, xmax: 1000) is bottom-right.
```

---

## 5. Map-Reduce Reducer Implementation (TypeScript)

Once the background queue worker finishes fetching payloads from all parallel page evaluation promises, pass the output to this deterministic application loop to populate your schema structure:

```typescript
interface AIDetectedDoor {
  detected_tag: string;
  hand_of_opening: string;
  bounding_box: { ymin: number; xmin: number; ymax: number; xmax: number };
  confidence_score: number;
}

interface MasterScheduleRow {
  doorTag: string;
  hwSet: string;
  sections: {
    basic_information: Record<string, string>;
    door: Record<string, string>;
    frame: Record<string, string>;
    hardware: Record<string, string>;
  };
}

/**
 * Normalizes and processes raw fragmented JSON collections coming from visual AI scans
 * into the structured target master JSON entity format.
 */
export function aggregateVisualExtracts(
  allPagesOutput: AIDetectedDoor[],
  initialProjectMasterTags: string[]
): MasterScheduleRow[] {
  
  // Step 1: Map occurrences and isolate dominant parameters
  const aggregationMap = new Map<string, { count: number; hands: string[] }>();

  // Seed the map with known valid tags to keep data safe even if missed on plan views
  initialProjectMasterTags.forEach(tag => {
    aggregationMap.set(tag, { count: 0, hands: [] });
  });

  allPagesOutput.forEach(item => {
    const canonicalTag = item.detected_tag.trim();
    const current = aggregationMap.get(canonicalTag) || { count: 0, hands: [] };
    
    current.count += 1;
    if (item.hand_of_opening) {
      current.hands.push(item.hand_of_opening);
    }
    
    aggregationMap.set(canonicalTag, current);
  });

  // Step 2: Assemble rows aligning perfectly with the excel core model template
  const scheduleRows: MasterScheduleRow[] = [];

  aggregationMap.forEach((data, tag) => {
    // Resolve dominant door hand by getting the most frequent value (fallback logic)
    const dominantHand = data.hands.length > 0 
      ? data.hands.sort((a, b) => 
          data.hands.filter(v => v === a).length - data.hands.filter(v => v === b).length
        ).pop() 
      : "NOT DETECTED";

    scheduleRows.push({
      doorTag: tag,
      hwSet: "", 
      sections: {
        basic_information: {
          "DOOR TAG": tag,
          "BUILDING TAG": "BUILDING 1",
          "BUILDING LOCATION": "",
          "DOOR LOCATION": "",
          "QUANTITY": data.count.toString(),
          "HAND OF OPENINGS": dominantHand as string,
          "DOOR OPERATION": "SWING",
          "LEAF COUNT": "SINGLE",
          "INTERIOR/EXTERIOR": "",
          "EXCLUDE REASON": "",
          "WIDTH": "",
          "HEIGHT": "",
          "THICKNESS": "",
          "FIRE RATING": ""
        },
        door: {
          "DOOR MATERIAL": "",
          "DOOR ELEVATION TYPE": "",
          "DOOR CORE": "",
          "DOOR FACE": "",
          "DOOR EDGE": "",
          "DOOR GUAGE": "",
          "DOOR FINISH": "",
          "STC RATING": "",
          "DOOR UNDERCUT": "",
          "DOOR INCLUDE/EXCLUDE": "INCLUDE"
        },
        frame: {
          "FRAME MATERIAL": "",
          "WALL TYPE": "",
          "THROAT THICKNESS": "",
          "FRAME ANCHOR": "",
          "BASE ANCHOR": "",
          "NO OF ANCHOR": "",
          "FRAME PROFILE": "",
          "FRAME ELEVATION TYPE": "",
          "FRAME ASSEMBLY": "",
          "FRAME GUAGE": "",
          "FRAME FINISH": "",
          "PREHUNG": "",
          "FRAME HEAD": "",
          "CASING": "",
          "FRAME INCLUDE/EXCLUDE": "INCLUDE"
        },
        hardware: {
          "HARDWARE SET": "",
          "HARDWARE INCLUDE/EXCLUDE": "INCLUDE"
        }
      }
    });
  });

  return scheduleRows;
}
``` 