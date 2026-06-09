# PlanckOff — Production Deployment Guide

Deploy PlanckOff to Vercel with a custom Hostinger domain and a separate production Supabase instance.

---

## Overview

| Layer | Dev | Prod |
|---|---|---|
| Database | Local/dev Supabase project | New prod Supabase project |
| Hosting | `localhost:3000` | Vercel |
| Domain | — | Hostinger domain → Vercel |
| Env vars | `.env.local` | Vercel dashboard |

---

## Phase 1 — Create a Production Supabase Project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Name it `planckoff-prod`, set a strong DB password (save it somewhere safe), pick a region close to your users
3. Wait for provisioning (~2 min)
4. Go to **Settings → API** and copy these — you'll need them in Phase 4:

| Key | Where to find it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

---

## Phase 2 — Run All Migrations on Prod Supabase

You have 21 migration files in `supabase/migrations/`. Run them **in order**.

### Option A — SQL Editor (no CLI needed)

1. In your prod Supabase dashboard → **SQL Editor**
2. Open and paste each file in order, clicking **Run** after each:

```
001_auth_tables.sql
002_schema_updates_and_projects.sql
003_project_location_lookup.sql
004_relational_hardware_schema.sql
005_elevation_images.sql
006_fix_elevation_policies.sql
007_project_elevation_types.sql
008_master_hardware_items.sql
009_hardware_trash.sql
010_fix_master_hardware_uniqueness.sql
011_project_notes.sql
012_enable_realtime.sql
013_pricing_report.sql
014_pricing_proposal.sql
015_proposal_extras.sql
016_proposal_remarks.sql
017_company_settings.sql
018_proposal_tax_rows.sql
019_enable_realtime_pricing_projects.sql
020_add_client_role.sql
021_client_project_assignments.sql
```

> If any migration fails, read the error message before continuing — it's usually a dependency order issue or an already-exists conflict.

### Option B — Supabase CLI

```powershell
# Install CLI
npm install -g supabase

# Link to your prod project (project ref is in the dashboard URL)
supabase link --project-ref <your-prod-project-ref>

# Push all migrations at once
supabase db push
```

---

## Phase 3 — Configure Auth Settings on Prod Supabase

### URL Configuration
**Authentication → URL Configuration**

| Field | Value |
|---|---|
| Site URL | `https://yourdomain.com` |
| Redirect URLs | `https://yourdomain.com/set-password` |
| Redirect URLs | `https://yourdomain.com/**` |

### Invite Email Template
**Authentication → Email Templates → Invite User**

Paste the HTML from:
```
.planning/phases/14.1-revert-email-service-from-aws-ses-to-supabase-built-in-email/14.1-01-DASHBOARD-TEMPLATE.html
```

### Email Provider
**Authentication → Providers → Email**

Make sure "Enable Email Confirmations" is set the way you want for prod.

---

## Phase 4 — Deploy to Vercel

### Step 1 — Push code to GitHub
```powershell
git push origin main
```

### Step 2 — Import project on Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Framework auto-detects as **Next.js** — leave build settings as-is
4. Before clicking Deploy, go to **Environment Variables** and add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Prod Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Prod anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Prod service role key |
| `GEMINI_API_KEY` | Your Gemini API key |
| `OPENROUTER_API_KEY` | Your OpenRouter API key |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com` |

5. Click **Deploy**

---

## Phase 5 — Connect Hostinger Domain to Vercel

### Step 1 — Add domain in Vercel
1. Vercel project → **Settings → Domains**
2. Click **Add Domain** → enter `yourdomain.com`
3. Also add `www.yourdomain.com`
4. Vercel will show you DNS records to configure

### Step 2 — Update DNS in Hostinger
1. Log into Hostinger → **Domains** → your domain → **DNS / Nameservers → DNS Zone**
2. Add or update these records:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `@` | `76.76.21.21` | 3600 |
| CNAME | `www` | `cname.vercel-dns.com` | 3600 |

3. Delete any existing A records pointing to Hostinger's old hosting IP

> DNS propagation takes 5–30 minutes, sometimes up to 24 hours. Vercel auto-provisions SSL once it verifies the domain.

### Alternative — Use Vercel Nameservers (cleaner, but hands all DNS to Vercel)

In Hostinger, change nameservers to:
- `ns1.vercel-dns.com`
- `ns2.vercel-dns.com`

> Only do this if you don't use Hostinger for email or other DNS-dependent services. If you have MX records (email), stick with the A + CNAME approach above.

---

## Phase 6 — Verify Everything End-to-End

After DNS propagates and Vercel shows the domain as active:

- [ ] Visit `https://yourdomain.com` — SSL padlock should be present
- [ ] Log in with an existing account
- [ ] Invite a new user — email link should redirect to `https://yourdomain.com/set-password`
- [ ] Create a project and run a PDF process — check AI keys are working
- [ ] Check **Vercel → Functions** logs for any server-side errors
- [ ] Check **Supabase → Logs → Auth** for any auth issues

---

## Keeping Dev and Prod Separate

Your `.env.local` already points to your dev Supabase — nothing changes there.
Prod env vars live only in the Vercel dashboard.

**Never point your local `.env.local` at the prod Supabase** — any test data, schema experiments, or broken migrations will affect real users.

If you need to test against prod locally (rare):
```
# .env.production.local  ← git-ignored, local only
NEXT_PUBLIC_SUPABASE_URL=https://your-prod-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

Run with: `npx next dev` (it picks up `.env.local` by default, not `.env.production.local`)

---

## Future Migrations

Whenever you add a new migration file for a feature:

1. Run it on **dev Supabase** first and test locally
2. Once confirmed working, run the same SQL in the **prod Supabase SQL Editor**
3. Or use `supabase db push` if you have the CLI linked to prod

---

## Quick Reference

| Resource | URL |
|---|---|
| Vercel dashboard | https://vercel.com/dashboard |
| Prod Supabase dashboard | https://supabase.com/dashboard |
| Hostinger DNS | https://hpanel.hostinger.com |
| Gemini API keys | https://aistudio.google.com/app/apikey |
| OpenRouter API keys | https://openrouter.ai/keys |
