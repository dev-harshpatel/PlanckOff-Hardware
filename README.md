<div align="center">
<h1>PlanckOff</h1>
<p>AI-powered Division 08 door hardware estimating platform</p>

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue?logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-Database%20%26%20Auth-3ECF8E?logo=supabase)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38BDF8?logo=tailwindcss)

</div>

---

## Overview

PlanckOff is a full-stack estimating tool built for door hardware contractors. It parses architectural hardware schedule PDFs and Excel door schedules using AI, organizes hardware sets and doors into projects, and generates pricing proposals and submittal packages — eliminating hours of manual takeoff work.

---

## Features

- **AI PDF Parsing** — Upload a hardware schedule PDF; Gemini 2.5 Flash extracts every hardware set and item automatically (two-tier fallback with server-side text extraction)
- **Door Schedule Import** — Upload Excel or CSV door schedules; doors are parsed and linked to hardware sets
- **Project Workspace** — Manage doors, hardware sets, and assignments per project
- **Hardware Set Builder** — Manually create or edit sets; auto-generate variant sets per door type
- **Pricing Engine** — Unit pricing, labor, markup, margin, and full proposal generation
- **Reports & Exports** — Door schedule, hardware set schedule, submittal package, and pricing proposal as Excel or PDF
- **Master Hardware Database** — Company-wide catalogue of hardware items with pricing
- **Team Management** — Role-based access (Administrator, Senior Estimator, Estimator, Viewer)
- **Supabase Auth** — Email invite flow with RLS-protected data per organization

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router, Turbopack) |
| Language | TypeScript 5.8 |
| Database & Auth | Supabase (PostgreSQL + Row Level Security) |
| AI — Primary | Google Gemini 2.5 Flash via OpenRouter |
| AI — Fallback | Google Gemini API (`@google/genai`) |
| PDF Parsing | `pdfjs-dist` (browser + server-side) |
| Excel Parsing | `xlsx`, `exceljs` |
| Styling | Tailwind CSS 3, Radix UI |
| Exports | jsPDF, ExcelJS, JSZip |

---

## Prerequisites

- **Node.js** 20+
- **npm** 10+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key **and/or** an [OpenRouter](https://openrouter.ai/keys) API key

---

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/your-org/planckoff-hardware.git
cd planckoff-hardware
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Copy the example file and fill in your values:

```bash
cp .env.example .env.local
```

Open `.env.local` and set the following (see [Environment Variables](#environment-variables) for details):

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GEMINI_API_KEY=
OPENROUTER_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Set up the database

Run all migrations in order against your Supabase project. You can do this via the **Supabase SQL Editor** or the Supabase CLI.

```bash
# Using Supabase CLI (if linked)
supabase db push
```

Or paste each file manually in the SQL Editor:

```
supabase/migrations/001_auth_tables.sql
supabase/migrations/002_schema_updates_and_projects.sql
supabase/migrations/003_project_location_lookup.sql
supabase/migrations/004_relational_hardware_schema.sql
supabase/migrations/005_elevation_images.sql
supabase/migrations/006_fix_elevation_policies.sql
supabase/migrations/007_project_elevation_types.sql
supabase/migrations/008_master_hardware_items.sql
supabase/migrations/009_hardware_trash.sql
supabase/migrations/010_fix_master_hardware_uniqueness.sql
supabase/migrations/011_project_notes.sql
supabase/migrations/012_enable_realtime.sql
supabase/migrations/013_pricing_report.sql
supabase/migrations/014_pricing_proposal.sql
supabase/migrations/015_proposal_extras.sql
supabase/migrations/016_proposal_remarks.sql
supabase/migrations/017_company_settings.sql
supabase/migrations/018_proposal_tax_rows.sql
supabase/migrations/019_enable_realtime_pricing_projects.sql
supabase/migrations/020_add_client_role.sql
```

Then run the seed file for province/location data:

```
supabase/seeds/001_project_location_provinces.sql
```

### 5. Configure Supabase Auth

**Redirect URL allowlist** — In your Supabase dashboard go to **Authentication → URL Configuration → Redirect URLs** and add:

```
http://localhost:3000/set-password
https://yourdomain.com/set-password
```

**Invite email template** — Go to **Authentication → Email Templates → Invite User** and paste the contents of:

```
.planning/phases/14.1-revert-email-service-from-aws-ses-to-supabase-built-in-email/14.1-01-DASHBOARD-TEMPLATE.html
```

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL — safe for the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous/public key — safe for the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key — **server only**, never expose to browser |
| `GEMINI_API_KEY` | Yes* | Google Gemini API key. Get it from [AI Studio](https://aistudio.google.com/app/apikey) |
| `OPENROUTER_API_KEY` | Yes* | OpenRouter API key. Get it from [openrouter.ai/keys](https://openrouter.ai/keys) |
| `NEXT_PUBLIC_APP_URL` | Yes | Full URL of the app — used to build invite email redirect links |

> *At least one AI provider key is required. OpenRouter is used as the primary for PDF parsing (Gemini 2.5 Flash via OpenRouter). `GEMINI_API_KEY` is used for the direct Gemini fallback path. For full functionality, provide both.

All AI keys are **server-side only** — they are never prefixed with `NEXT_PUBLIC_` and never sent to the browser.

---

## Available Scripts

```bash
npm run dev      # Start dev server with Turbopack on port 3000
npm run build    # Production build
npm run start    # Start production server
npm run lint     # ESLint
```

---

## Project Structure

```
planckoff-hardware/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/             # Login, set-password
│   ├── project/[id]/       # Project workspace (doors, hardware, reports)
│   ├── database/           # Master hardware database
│   ├── settings/           # App and company settings
│   └── team/               # Team member management
├── components/             # React components
│   ├── hardware/           # Hardware set manager, schedule view, modals
│   ├── doorSchedule/       # Door schedule grid and config
│   ├── reports/            # Export components (proposal, submittal, pricing)
│   └── ui/                 # Shared UI primitives (Radix-based)
├── services/               # Business logic and AI integrations
│   ├── hardwarePdfServiceV2.ts   # PDF extraction (Tier 1 base64 + Tier 2 text)
│   ├── fileUploadService.ts      # Multi-format file processor
│   └── geminiService.ts          # Client-side AI extraction
├── utils/                  # Pure utilities (parsers, formatters, validators)
├── lib/
│   └── ai/                 # Server-side PDF text extractor (pdfjs)
├── supabase/
│   ├── migrations/         # Ordered SQL migration files
│   └── seeds/              # Seed data (provinces, etc.)
├── types.ts                # Shared TypeScript interfaces
├── .env.example            # Environment variable template
└── prompt.txt              # AI system prompt for hardware schedule parsing
```

---

## How PDF Parsing Works

1. **Tier 1 (≤ 15 MB)** — The raw PDF is sent as a base64-encoded inline file to Google Gemini 2.5 Flash via OpenRouter. The model reads the PDF natively and returns structured JSON.
2. **Tier 2 (> 15 MB or Tier 1 failure)** — The server extracts text from each page using `pdfjs-dist` with position-aware row reconstruction (preserves table columns). Pages are batched (10 pages + 1 overlap page for cross-page continuity), then sent to Gemini in parallel (up to 4 concurrent calls). Results are merged by set name.

All AI responses are validated against a JSON schema and normalized before being returned to the client.

---

## Roles & Permissions

| Role | Capabilities |
|---|---|
| Administrator | Full access — projects, team management, company settings |
| Senior Estimator | Full project access — create, edit, export |
| Estimator | View and edit assigned projects |
| Viewer | Read-only access |
| Client | Read-only access to shared project data |

---

## License

Private — all rights reserved.
