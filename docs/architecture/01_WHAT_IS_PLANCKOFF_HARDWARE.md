# PlanckOff — What Is This Application?
> Interview Prep Guide · Part 1 of 3

---

## The One-Line Pitch

PlanckOff is a SaaS platform that helps construction hardware estimators manage door schedules, hardware specifications, and pricing — powered by AI that reads PDFs and does the data entry for them.

---

## The Problem It Solves (Domain Context)

### Who uses it?

**Door hardware estimators** and **door hardware suppliers** in the construction industry. Their job is to figure out exactly which locks, hinges, closers, and other hardware go on every single door in a building — and how much it all costs.

### What was their life like before PlanckOff?

1. An architect sends a 300-page PDF called a "door schedule"
2. The estimator manually reads every page, copies door numbers, sizes, fire ratings, hardware group names into a spreadsheet
3. They look up each hardware group in a binder, figure out quantities, apply pricing
4. They create a quote document, a submittal package, a procurement list — all manually
5. This process takes days, is error-prone, and is redone from scratch on every project

### What does PlanckOff do instead?

1. Estimator uploads the PDF (or Excel/CSV)
2. AI reads it and extracts every door — tag, size, material, fire rating, hardware group — automatically
3. AI matches each door to the correct hardware set from their library
4. System calculates pricing (doors + frames + hardware + markup + tax)
5. One click generates a professional submittal, a procurement summary, or a pricing report

**Time saved: Days → Hours**

---

## Industry Standards This App Handles

Understanding these terms helps in interviews:

| Term | What It Means |
|---|---|
| **Door Schedule** | The master list of all doors in a building — their number, size, type, fire rating, hardware |
| **Hardware Set** | A named group of hardware (e.g., "HW-1" = 3 hinges + 1 mortise lock + 1 closer) |
| **CSI Division 08** | The construction specification standard for doors and hardware |
| **ANSI Grade** | Quality rating for hardware: Grade 1 (commercial heavy-duty) → Grade 3 (residential light) |
| **BHMA Number** | American National Standard number for hardware (e.g., BHMA A156.2 = hinges) |
| **Fire Rating** | How long a door resists fire: 20 min, 45 min, 1 HR, 3 HR |
| **Handing** | Which way a door swings: LH, RH, LHR, RHR (Left/Right Hand, Regular/Reverse) |
| **Submittal Package** | The formal document sent to architects/owners showing exact hardware with specs and cut sheets |
| **EAC** | Egress Assessment Certificate — safety check for exit doors |
| **Elevation Type** | A visual diagram showing what the door looks like (useful for matching similar doors) |

---

## What the App Actually Does — Feature by Feature

### 1. Project Management
- Create projects with client name, location, due date, status
- Multiple team members can access the same project with different roles
- Roles: **Administrator**, **Team Lead**, **Estimator**, **Viewer**

### 2. Import Door Schedules
- Upload: **PDF** (most common), **Excel (.xlsx)**, **CSV**, **Word (.docx)**
- AI reads the file and creates a structured list of doors
- Each door gets: tag number, size, material, fire rating, hardware group, location, handing
- The extraction runs in the background — user sees a progress bar, not a frozen screen

### 3. Hardware Sets Management
- Define hardware sets (like "HW-1", "HW-2") with items, quantities, manufacturers, prices
- Import hardware sets from PDF or Excel too
- AI can read hardware specs from PDFs and populate them automatically

### 4. Hardware Assignment
- After extraction, the app matches each door to the right hardware set
- Three levels of matching confidence:
  - **High:** Exact name match (door said "HW-1", set named "HW-1" exists)
  - **Medium:** Normalized match (door said "SET-01", normalized to "01")
  - **Low:** AI-assisted match (AI looks at door specs and picks best set)
- User can review and override any assignment

### 5. Pricing
- Door pricing: base price + fire rating upcharge + finish + prep
- Frame pricing: material + gauge + profile
- Hardware pricing: per item (unit price × quantity), per set, per project
- Markups, margins, tax rates, shipping — all configurable
- Profit margin calculation

### 6. Reports and Exports
- **Door Schedule PDF** — professional formatted schedule
- **Hardware Sets PDF** — detailed hardware breakdown per set
- **Submittal Package** — complete formal document for architects
- **Procurement Summary** — grouped by manufacturer for ordering
- **Pricing Report** — full cost breakdown for the bid
- Export to **CSV** or **Excel** for further processing

### 7. Elevation Management
- Upload images of door elevation drawings
- Tag which doors use which elevation type
- Visual reference during hardware assignment

### 8. Master Hardware Database
- Global inventory of hardware items (not project-specific)
- Any estimator on the team can reuse items across projects
- Soft delete (trash) with restore capability

### 9. Cut Sheet Library
- Store manufacturer PDF documentation for specific hardware items
- Attach to submittal packages

---

## The Data Flow — Simple Version

```
PDF File
  ↓ (uploaded)
Background Worker (Web Worker)
  ↓ (extracts text in pages)
Gemini AI (via server API)
  ↓ (structured JSON output)
Door List + Hardware Sets
  ↓ (user reviews, edits)
Pricing Engine
  ↓ (calculations)
Reports / Exports
  ↓ (downloaded or shared)
Supabase Database (saved)
```

---

## Users and Roles

| Role | What They Can Do |
|---|---|
| **Administrator** | Full access — manage team, projects, pricing, exports |
| **Team Lead** | Manage projects, assign work, approve submissions |
| **Estimator** | Create/edit projects, run AI extraction, edit doors and hardware |
| **Viewer** | Read-only access to projects and reports |

Team members are invited by email. The admin sets their role. Access is enforced both in the UI and at the database level (Supabase Row Level Security).

---

## Expected Interview Questions — What Is PlanckOff?

---

**Q: Can you describe what PlanckOff does in simple terms?**

A: It's a tool for door hardware estimators in construction. They get big PDFs listing hundreds of doors — our app uses AI to read those PDFs, extract all the door data, match them to hardware specifications, calculate pricing, and generate the professional documents they need to submit a bid. What used to take days of manual work happens in hours.

---

**Q: Who are the end users?**

A: Hardware estimators and suppliers who work on commercial construction projects. They deal with standards like CSI Division 08, ANSI grades, and fire ratings. They need accurate data extraction and professional-looking submittals.

---

**Q: What was the biggest pain point you were solving?**

A: Manual data entry from PDF door schedules. A 300-page PDF might have 200 doors, each with 15+ data fields. Copying that manually is slow and error-prone. AI extraction turns that into a one-click process with a confidence score so users know what to double-check.

---

**Q: How does multi-tenancy work?**

A: Each admin account has its own team. Team members are scoped to that admin's organization. Supabase Row Level Security (RLS) policies ensure one company's data is never visible to another. The auth middleware validates the session on every API call.

---

**Q: What file formats do you support and why?**

A: PDF (most common — what architects send), Excel/CSV (what some clients prefer for structured data), and Word (for text-based specs). Each format has its own parser — PDF uses `pdfjs-dist`, Excel uses `xlsx`, CSV uses `papaparse`, Word uses `mammoth`.

---

**Q: What does the AI actually output?**

A: Structured JSON. We give the AI a strict schema and ask it to return an array of door objects with specific fields. If the AI returns messy or partially broken JSON (which happens), we have a custom JSON repair function that iteratively fixes syntax errors before parsing.

---
