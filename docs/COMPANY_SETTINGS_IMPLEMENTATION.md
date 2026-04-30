# Company Settings — Implementation Plan

## Overview

A global **Company Settings** page where users fill in their company profile once. Every PDF export (Pricing Report, Proposal) reads these details and renders a branded header — logo, company name, website, address, etc.

This replaces the earlier per-project "Client Details" idea. Company details belong to the account, not to individual projects.

---

## Data to Store (Global, Per User)

| Field        | Type   | Notes                                  |
|--------------|--------|----------------------------------------|
| company_name | TEXT   | Company name shown in PDFs             |
| website_url  | TEXT   | e.g. https://yourcompany.com           |
| address      | TEXT   | Street address                         |
| country      | TEXT   |                                        |
| province     | TEXT   | State / Province                       |
| phone        | TEXT   | Contact phone number                   |
| email        | TEXT   | Contact email shown in PDFs            |
| logo_url     | TEXT   | Public URL from Supabase Storage       |

---

## Database

### New Table: `company_settings`

```sql
-- 017_company_settings.sql

CREATE TABLE IF NOT EXISTS company_settings (
  user_id      UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT        NOT NULL DEFAULT '',
  website_url  TEXT        NOT NULL DEFAULT '',
  address      TEXT        NOT NULL DEFAULT '',
  country      TEXT        NOT NULL DEFAULT '',
  province     TEXT        NOT NULL DEFAULT '',
  phone        TEXT        NOT NULL DEFAULT '',
  email        TEXT        NOT NULL DEFAULT '',
  logo_url     TEXT        NOT NULL DEFAULT '',
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS company_settings_set_updated_at ON company_settings;
CREATE TRIGGER company_settings_set_updated_at
  BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

-- Users can only read/write their own row
CREATE POLICY company_settings_select ON company_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY company_settings_all    ON company_settings FOR ALL    USING (auth.uid() = user_id);
```

### Logo Storage

- Supabase Storage bucket: `company-logos`
- Path pattern: `{userId}/{filename}`
- Store the resulting public URL in `logo_url`
- Bucket should be public (logos appear in PDFs — no auth needed to render)

---

## Backend

### DB Layer — `lib/db/companySettings.ts`

```ts
interface CompanySettingsRow {
  company_name: string;
  website_url:  string;
  address:      string;
  country:      string;
  province:     string;
  phone:        string;
  email:        string;
  logo_url:     string;
}

getCompanySettings(userId)        → DbResult<CompanySettingsRow>
upsertCompanySettings(userId, row) → DbResult<boolean>
```

### API Routes

| Method | Route                          | Purpose                         |
|--------|--------------------------------|---------------------------------|
| GET    | `/api/settings/company`        | Load saved company details      |
| PUT    | `/api/settings/company`        | Save company details            |
| POST   | `/api/settings/company/logo`   | Upload logo to Storage          |
| DELETE | `/api/settings/company/logo`   | Remove logo, clear logo_url     |

Logo upload route:
1. Accept `multipart/form-data` with the image file
2. Upload to `company-logos/{userId}/{filename}`
3. Return the public URL
4. Client immediately saves it via the PUT route

---

## Frontend

### New Page: `/settings`

Create `app/settings/page.tsx` — a dedicated Settings page accessible from the main navigation sidebar/header.

#### Nav Link

Add a **Settings** entry to the existing sidebar or top navigation (wherever the main app nav lives). Use a gear icon (⚙).

#### Layout

```
Settings
─────────────────────────────────────────────
  Company Profile

  [ Logo upload area — drag & drop / click ]
  [ Shows preview if logo_url is set        ]

  Company Name      [input]
  Website URL       [input]
  Email             [input]
  Phone             [input]
  Address           [textarea]
  Country           [input]
  Province          [input]

                    [ Save ] ← or debounce-save on change
─────────────────────────────────────────────
```

#### Behaviour

- Load existing values from GET `/api/settings/company` on mount
- All text fields debounce-save (800 ms) to PUT `/api/settings/company` on change
- Logo: immediate upload on file select → POST `/api/settings/company/logo` → returns URL → saved automatically
- Logo remove button: DELETE `/api/settings/company/logo` → clears preview
- Show a small "Saved ✓" indicator after each successful save
- Match existing app UI style (dark mode tokens, same card/input components)

### Component Location

`app/settings/page.tsx` — thin page shell  
`components/CompanySettingsForm.tsx` — the form itself (reusable if needed elsewhere)

---

## PDF Integration

Every PDF export reads company settings from the API and renders a header block:

```
┌─────────────────────────────────────────┐
│  [LOGO]   Company Name                  │
│           website.com  |  email@co.com  │
│           123 Street, Province, Country │
└─────────────────────────────────────────┘
```

If any field is empty it is simply omitted from the header. If `logo_url` is empty the logo slot is hidden.

### Files to Update

| File                               | Change                                               |
|------------------------------------|------------------------------------------------------|
| `services/pricingReportService.ts` | Fetch company settings, add header to all sheets     |
| Proposal PDF export function       | Fetch company settings, render header on each page   |

Pattern: before generating any PDF, call GET `/api/settings/company` (or pass the already-loaded data down). Inject `companySettings` as a parameter into the export functions alongside existing params like `projectName`.

---

## Implementation Order

1. Migration `017_company_settings.sql`
2. `lib/db/companySettings.ts` — DB functions
3. `app/api/settings/company/route.ts` — GET + PUT
4. `app/api/settings/company/logo/route.ts` — logo upload/delete
5. `components/CompanySettingsForm.tsx` — form UI with logo upload + debounce save
6. `app/settings/page.tsx` — page shell, loads and passes data to form
7. Add Settings nav link to sidebar/header
8. PDF export functions — fetch company settings and inject header

---

## Open Questions

- **Logo bucket visibility**: Public bucket is simplest (logos appear in PDFs without auth). If that's a concern, use signed URLs with long expiry.
- **Country field**: Free-text or a dropdown of country names/codes?
- **Multi-user accounts**: If two users share the same account/org in future, `user_id` PK may need to become `org_id`. For now, one row per user is fine.
