# Resend Custom SMTP Setup — Remaining Steps

**Status:** Paused — waiting on Hostinger access to add DNS records.
**Resend domain added:** `planckoff.ai` (DNS records pending verification)
**Target Supabase project:** `itemzdlgzpgeeyeszfgd` (production)

## Why this is needed

Supabase's built-in email service cannot be used in production:

1. **Without custom SMTP, invite emails only deliver to members of your Supabase
   organization.** Invites to real users (e.g. `dhruv.patel@planckoff.com`) are
   silently rejected ("email address not authorized"). Policy in force since
   Sept 2024.
2. Rate limit of ~2–4 emails/hour project-wide.
3. Since June 3, 2026, free-tier projects on the default email provider cannot
   customize email templates (affects our dev project; prod is grandfathered
   for editing, but sending is still restricted per points 1–2).
4. Emails come from `Supabase Auth <noreply@mail.app.supabase.io>` instead of
   our domain.

Configuring Resend as custom SMTP removes all four restrictions.

---

## Step 1 — Copy DNS records from Resend into Hostinger

DNS for `planckoff.ai` is hosted at **Hostinger** (nameservers
`ns1/ns2.dns-parking.com`).

1. Open the Resend dashboard → **Domains → planckoff.ai**. It shows the
   "Fill in your DNS Records" screen with the exact values. The values below
   are truncated — **always use Resend's copy button for the full string**.
2. Log in to Hostinger → **Domains → planckoff.ai → DNS / Nameservers →
   DNS records** (DNS Zone editor).
3. Add these four records:

| # | Type | Name                 | Content (copy full value from Resend)            | TTL     | Priority |
|---|------|----------------------|--------------------------------------------------|---------|----------|
| 1 | TXT  | `resend._domainkey`  | `p=MIGfMA…wIDAQAB` (long DKIM key)               | default | —        |
| 2 | MX   | `send`               | `feedback-smtp.<region>.amazonses.com`           | 3600    | **10**   |
| 3 | TXT  | `send`               | `v=spf1 include:amazonses.com ~all`              | 3600    | —        |
| 4 | TXT  | `_dmarc`             | `v=DMARC1; p=none;` (optional but recommended)   | default | —        |

Hostinger notes:

- In the **Name** field enter only the relative name (`send`,
  `resend._domainkey`, `_dmarc`) — Hostinger appends `.planckoff.ai`
  automatically.
- The MX record's priority `10` goes in its own field.
- These records live on the `send` subdomain — **do not delete or modify any
  existing records** (the ones pointing `planckoff.ai` at Vercel must stay).

## Step 2 — Verify the domain in Resend

1. Back in Resend → Domains → planckoff.ai → click **Verify DNS Records**.
2. Propagation from Hostinger usually takes 5–30 minutes (worst case a few
   hours). Status must become **Verified** on all records.
3. To check propagation manually from a terminal:

   ```
   nslookup -type=TXT resend._domainkey.planckoff.ai 8.8.8.8
   nslookup -type=MX  send.planckoff.ai 8.8.8.8
   nslookup -type=TXT send.planckoff.ai 8.8.8.8
   ```

## Step 3 — Create a Resend API key

Resend dashboard → **API Keys → Create API Key**:

- Name: `planckoff-supabase-smtp`
- Permission: **Sending access** is enough.
- Copy the key (`re_…`) immediately — it is shown only once. Store it
  somewhere safe (it acts as the SMTP password).

## Step 4 — Configure custom SMTP in Supabase (PROD project)

Supabase dashboard → project **itemzdlgzpgeeyeszfgd** →
**Project Settings → Authentication → SMTP Settings**
(or Authentication → Emails → SMTP tab). Enable **Custom SMTP** and fill:

| Field        | Value                          |
|--------------|--------------------------------|
| Host         | `smtp.resend.com`              |
| Port         | `465`                          |
| Username     | `resend`                       |
| Password     | the Resend API key (`re_…`)    |
| Sender email | `invites@planckoff.ai`         |
| Sender name  | `PlanckOff`                    |

Save. (The sender address can be any mailbox-less address on the verified
domain — no inbox needs to exist for it.)

## Step 5 — Raise the auth email rate limit

Supabase dashboard → **Authentication → Rate Limits** → set
"emails sent per hour" to something sane, e.g. **50–100/hour**
(the 2–4/hour cap only applies to the built-in service, but the project-level
limit must be raised manually after enabling custom SMTP).

## Step 6 — Re-save the invite email template

Supabase dashboard → **Authentication → Emails → Templates → Invite user**
tab (direct URL:
`https://supabase.com/dashboard/project/itemzdlgzpgeeyeszfgd/auth/templates`):

1. Subject: `You have been invited to PlanckOff`
2. Message body: paste the full contents of
   [`supabase/email-templates/invite-user.html`](../supabase/email-templates/invite-user.html)
3. Click **Save** (the editor does not auto-save).

## Step 7 — Confirm URL configuration (already done, re-check)

Supabase dashboard → **Authentication → URL Configuration**:

- Site URL: `https://planckoff.ai` ✅ (set on 2026-06-11)
- Redirect URLs include: `https://planckoff.ai/set-password` ✅
- Optional cleanup: remove the `planck-off-hardware.vercel.app` entries so
  auth flows can never land on the non-custom domain.

Also confirm Vercel → Production env has `NEXT_PUBLIC_APP_URL=https://planckoff.ai`
(and the three Supabase vars all from project `itemzdlgzpgeeyeszfgd`), then
**redeploy** — `NEXT_PUBLIC_*` values are baked in at build time.

## Step 8 — End-to-end test

1. On planckoff.ai → Team Management → click **Resend** on a pending invite
   (or invite a brand-new test address — must be an address NOT in the
   Supabase org, to prove the external-delivery restriction is gone).
2. Expected result, in the recipient's inbox:
   - From: `PlanckOff <invites@planckoff.ai>` (not noreply@mail.app.supabase.io)
   - The PlanckOff-branded template (wordmark, blue Accept Invitation button)
   - The button leads to Supabase verify → redirects to
     `https://planckoff.ai/set-password?token=…`
3. Complete the set-password flow and log in to confirm the invite token works.

## Later (optional)

- Hook the same Resend SMTP into the **dev** Supabase project
  (`hrdfstwqfszmeyfnkmlr`) — this also unlocks template editing there
  (blocked since June 3, 2026 for new free-tier projects without SMTP).
- Tighten DMARC from `p=none` to `p=quarantine` once email flow is proven.
