# Security — Hardening Beyond the Basics

## Current State

The authentication and authorization foundation is solid:
- Session-based auth with httpOnly cookies
- RBAC enforced at middleware + API route level
- Client role scoped to assigned projects only (404 not 403 to prevent info leaks)
- Soft-delete of projects doesn't expose them to unauthorized users
- CSP headers are set

But several security-critical details are missing that would be caught in a basic security review.

---

## 1. No Account Lockout on Failed Logins

**File:** `app/api/auth/login/route.ts`

There is IP-based rate limiting (via a rate limiter middleware), but no per-account lockout. An attacker can:
- Rotate IPs (trivial with proxies)
- Attempt thousands of passwords per account if each request comes from a different IP
- Brute-force weak passwords with no detection

**Fix:** Track failed login attempts per email address, not just per IP:

```sql
-- Add to auth schema
ALTER TABLE team_members ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE team_members ADD COLUMN locked_until timestamptz;

ALTER TABLE admins ADD COLUMN failed_login_attempts integer NOT NULL DEFAULT 0;
ALTER TABLE admins ADD COLUMN locked_until timestamptz;
```

```typescript
// In login route
const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

// Check before attempting password compare
if (member.locked_until && new Date(member.locked_until) > new Date()) {
  return NextResponse.json(
    { error: 'Account temporarily locked. Try again later.' },
    { status: 429 }
  );
}

const isValid = await bcrypt.compare(password, member.password_hash);

if (!isValid) {
  const newAttempts = member.failed_login_attempts + 1;
  const lockedUntil = newAttempts >= MAX_ATTEMPTS
    ? new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000)
    : null;
  
  await db.incrementFailedAttempts(member.id, newAttempts, lockedUntil);
  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
}

// On success, reset counter
await db.resetFailedAttempts(member.id);
```

**Note:** The error message "Invalid credentials" must not reveal whether the email exists. Do NOT say "User not found" vs "Wrong password" — both map to the same response.

---

## 2. Sessions Not Revoked on Password Change

When a team member sets their password (via invite acceptance) or when an admin resets it, existing sessions for that user remain valid. If an account is compromised, the attacker's session stays active even after the password is changed.

**Fix:** On password set or reset, invalidate all existing sessions for that user:

```typescript
// lib/db/auth.ts
export async function revokeAllSessionsForUser(userId: string, userType: 'admin' | 'team_member') {
  const column = userType === 'admin' ? 'admin_id' : 'team_member_id';
  await supabaseAdmin
    .from('auth_sessions')
    .delete()
    .eq(column, userId);
}
```

```typescript
// app/api/team/set-password/route.ts
await approveTeamMemberInvite(token, hashedPassword);
await revokeAllSessionsForUser(member.id, 'team_member'); // revoke old sessions
// New session created when they log in with the new password
```

---

## 3. Content Security Policy Is Too Permissive

**File:** `next.config.ts`

```typescript
"script-src 'self' 'unsafe-inline' 'unsafe-eval'",
```

`unsafe-inline` allows injecting `<script>` tags inline (XSS vector). `unsafe-eval` allows `eval()` (XSS escalation vector). These are needed currently for jsPDF (which uses `eval` internally) and inline event handlers.

**Short-term fix:** At minimum, document why these are needed and add a comment:

```typescript
// 'unsafe-inline' required by jsPDF (canvas-based PDF rendering)
// 'unsafe-eval' required by jsPDF template engine
// TODO: Replace jsPDF with a server-side PDF generator to allow removing these
// Tracked in: docs/future-work/08-security.md
```

**Long-term fix:** Move PDF generation entirely server-side (it should already be in API routes, not client-side). Then remove `unsafe-inline` and `unsafe-eval`. Generate nonces for any truly necessary inline scripts.

---

## 4. Invite Token Security

**File:** `app/api/team/invite/[token]/route.ts`

The invite token is a plain random string stored in the database. Current implementation:

```typescript
// lib/db/team.ts
const inviteToken = randomBytes(32).toString('hex');
```

This is acceptable. But there are two missing guards:

**a) Tokens don't expire on use.** After a user accepts their invite and sets their password, the token is marked as used, but the token is still in the database. If the `team_members` table is ever read by an unauthorized party, the tokens are visible.

**Fix:** Delete the token (set to NULL) immediately after successful use:

```typescript
await supabaseAdmin
  .from('team_members')
  .update({ invite_token: null, invite_expires_at: null, status: 'active' })
  .eq('id', member.id);
```

**b) No brute-force protection on the invite acceptance route.** Unlike login, there's no rate limit on `GET /api/team/invite/[token]`. A 64-character hex token has 256 bits of entropy — practically impossible to brute force. But add a short-circuit anyway:

```typescript
// Reject tokens that aren't exactly 64 hex characters
if (!/^[a-f0-9]{64}$/.test(token)) {
  return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
}
```

---

## 5. Missing Security Headers

Several important HTTP security headers are not set:

```typescript
// next.config.ts — add to headers config

// Missing currently:
'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',  // HSTS
'X-Content-Type-Options': 'nosniff',        // Prevent MIME sniffing
'X-Frame-Options': 'DENY',                  // Prevent iframe embedding (clickjacking)
'Referrer-Policy': 'strict-origin-when-cross-origin',
'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
```

Add these to the `headers()` function in `next.config.ts` alongside the existing CSP.

**Note:** Vercel automatically adds `X-Content-Type-Options` and `X-Frame-Options` on deployed apps — verify these are present in production responses before adding manually.

---

## 6. Service Role Key Used for All Server Operations

The `SUPABASE_SERVICE_ROLE_KEY` bypasses all Row Level Security policies. It is the most powerful credential in the application. Currently, it is used for:
- Every API route
- Every DB query
- The admin Supabase client

This is standard practice for server-side Supabase usage, but it means a single leaked env var gives full database access.

**Mitigations:**

1. **Rotate the service role key** if it's ever exposed (logged, committed to git, etc.)
2. **Never log requests that include it** — the server-side client uses it in the Authorization header
3. **Ensure it's not in the client bundle** — `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix) should never reach the browser. Verify with bundle analyzer.
4. **Add Supabase's built-in key restriction** (dashboard → Settings → API → Restrict service role) — restrict to specific IP ranges if the API server has a fixed IP

---

## 7. Uploaded File Validation

**File:** `app/api/projects/[id]/process/route.ts`

Files are validated by MIME type and size before processing. But MIME type can be spoofed by the client — an attacker can upload a `.exe` file with `Content-Type: application/pdf`.

**Fix:** Add magic byte (file signature) validation in addition to MIME type:

```typescript
// lib/security/fileMagic.ts
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const XLSX_MAGIC = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // PK\x03\x04 (ZIP, used by XLSX)

export function validateFileSignature(buffer: Buffer, expectedType: 'pdf' | 'xlsx'): boolean {
  if (expectedType === 'pdf') {
    return buffer.slice(0, 4).equals(PDF_MAGIC);
  }
  if (expectedType === 'xlsx') {
    return buffer.slice(0, 4).equals(XLSX_MAGIC);
  }
  return false;
}
```

```typescript
// In route handler, after buffering the file
if (!validateFileSignature(pdfBuffer, 'pdf')) {
  return NextResponse.json({ error: 'File is not a valid PDF' }, { status: 400 });
}
```

This prevents the class of attacks where a maliciously crafted file exploits parsing vulnerabilities in pdfjs-dist or XLSX.

---

## 8. Password Policy Not Enforced

The invite acceptance route (`POST /api/team/set-password`) accepts any password. There is no minimum length, no complexity requirement, no common-password check.

**Fix:**
```typescript
// Minimum viable password policy
function validatePassword(password: string): { valid: boolean; reason?: string } {
  if (password.length < 12) {
    return { valid: false, reason: 'Password must be at least 12 characters' };
  }
  if (/^\s+$/.test(password)) {
    return { valid: false, reason: 'Password cannot be all spaces' };
  }
  // Could add: check against top 1000 common passwords list
  return { valid: true };
}
```

12 characters is the current NIST recommendation. Don't add complexity rules (uppercase + number + symbol) — NIST 800-63B deprecated those in favor of length.

---

## 9. No CSRF Protection on Mutating Routes

The application uses cookie-based authentication. A malicious website could craft a `<form action="https://app.planckoff.com/api/projects" method="POST">` that a logged-in user submits (cross-site request forgery).

**Why it's partially mitigated today:**
- Most mutating routes expect `Content-Type: application/json` and parse via `req.json()`. A simple form POST sends `application/x-www-form-urlencoded` which `req.json()` will reject.
- Vercel adds `SameSite=Lax` to cookies by default, which blocks cross-site POSTs from form navigations.

**Remaining risk:** `SameSite=Lax` does not block cross-site requests from `fetch()` calls (e.g., from an iframe). A `SameSite=Strict` cookie would fully block this but would break OAuth flows (not relevant here).

**Fix:** Verify the `session` cookie has `SameSite=Strict`:

```typescript
// lib/auth/session.ts — when setting the cookie
response.cookies.set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',   // Was this 'lax'? Change to 'strict'.
  maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
  path: '/',
});
```

`SameSite=Strict` is safe here because PlanckOff doesn't support OAuth or external login flows that need to land with a cookie.

---

## Summary: Security Items by Priority

| Issue | Risk | Effort | Priority |
|-------|------|--------|---------|
| Account lockout on failed logins | High (brute force) | Low | High |
| Session revocation on password change | High (credential compromise) | Low | High |
| Delete invite token on use | Medium (token exposure) | Low | High |
| Missing security headers (HSTS, etc.) | Medium | Low | Medium |
| File magic byte validation | Medium (malformed file attacks) | Low | Medium |
| Password policy enforcement | Medium | Low | Medium |
| `SameSite=Strict` on session cookie | Low (partially mitigated) | Low | Medium |
| CSP hardening (remove unsafe-inline) | High (XSS) | High (needs PDF refactor) | Low (long-term) |
| Service role key restriction | Low (already standard) | Low (config) | Low |
