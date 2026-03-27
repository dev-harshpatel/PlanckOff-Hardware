# /security — Security Audit

You are executing the `/security` command. Audit the specified file or the entire codebase for security vulnerabilities.

Target (if specified): **$ARGUMENTS**

---

## Audit Checklist

Run every item in this list. Report PASS / FAIL / WARNING with line numbers.

---

### 1. API Key Exposure (CRITICAL)

Search for any API key in client-side code:

```bash
# Keys that must NEVER appear in client bundles
grep -r "VITE_GEMINI" --include="*.ts" --include="*.tsx" .
grep -r "VITE_OPENROUTER" --include="*.ts" --include="*.tsx" .
grep -r "process.env.GEMINI" --include="*.ts" --include="*.tsx" . | grep -v "api/"
grep -r "dangerouslyAllowBrowser" --include="*.ts" --include="*.tsx" .
grep -r "NEXT_PUBLIC_GEMINI" --include="*.ts" --include="*.tsx" .
```

**FAIL if:** Any of these appear in files outside `app/api/` or server-only files.

**Fix:** Move to `app/api/ai/generate/route.ts`. API keys accessed only via `process.env.KEY_NAME` in server code.

---

### 2. Authentication Gaps (CRITICAL)

Check every API route:

```typescript
// Every API route MUST start with this pattern
const { data: { user } } = await supabase.auth.getUser()
if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
```

**FAIL if:** Any `app/api/*.ts` file does not check auth before executing logic.

Also check: Are there any routes that check `isAuthenticated` from client state instead of verifying the JWT server-side? Client state is spoofable.

---

### 3. Input Validation (HIGH)

Every API route and server action must validate input before using it:

```typescript
// Use Zod — never trust request.json() directly
const schema = z.object({ projectId: z.string().uuid() })
const result = schema.safeParse(await request.json())
if (!result.success) return NextResponse.json({ error: result.error }, { status: 400 })
```

**FAIL if:** Any API route uses `request.json()` without validation.

**XSS Risk:** Check any place where user input is rendered as HTML (`dangerouslySetInnerHTML`, `innerHTML`). If found, ensure it's sanitized.

---

### 4. File Upload Validation (HIGH)

Check `services/fileUploadService.ts`:

- Is there a MIME type allowlist? (Not just extension check)
- Is there a file size limit?
- Is there any magic byte / file signature validation?
- Is there a row count limit before AI processing begins?

```typescript
// CORRECT — check both extension AND MIME type
const ALLOWED_TYPES = ['application/pdf', 'text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
if (!ALLOWED_TYPES.includes(file.type)) throw new Error('File type not allowed')
```

**WARNING if:** File type is checked by extension only (can be spoofed).
**FAIL if:** No file size limit exists.

---

### 5. RLS Policies (HIGH — Supabase)

Check that every Supabase table has:
1. `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
2. Explicit SELECT, INSERT, UPDATE, DELETE policies
3. Policies use `get_user_organization_id()` (not raw `auth.uid()`) for multi-tenancy

**FAIL if:** Any table has RLS enabled but with a `TO public` policy (grants everyone access).
**FAIL if:** Any table has RLS disabled.

---

### 6. localStorage Sensitive Data (MEDIUM)

Search for sensitive data being stored in localStorage:

```bash
grep -r "localStorage.setItem" --include="*.ts" --include="*.tsx" .
```

Check if any of the stored values could contain:
- API keys or tokens
- User PII (email, name) that doesn't belong client-side
- Unencrypted session data

**WARNING if:** API keys are in localStorage (even encrypted is not safe enough — they belong server-side).

---

### 7. SQL Injection (LOW for Supabase ORM, check anyway)

If any raw SQL queries exist (`.rpc()`, `supabase.query()`), verify parameters are parameterized:

```typescript
// WRONG — string interpolation in SQL
supabase.rpc(`SELECT * FROM doors WHERE tag = '${doorTag}'`)

// CORRECT — parameterized
supabase.from('doors').select('*').eq('door_tag', doorTag)
```

---

### 8. Dependencies (MEDIUM)

```bash
npm audit
```

Report any HIGH or CRITICAL severity vulnerabilities. Fix or note if acceptable.

---

### 9. Environment Variable Leaks

Check `next.config.ts` for env vars in the `env` or `publicRuntimeConfig` blocks that shouldn't be public.

Check `vite.config.ts` (current) for `define` block exposing secrets:
```typescript
// CURRENT DANGEROUS PATTERN — exposed to client bundle
define: {
  'process.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY)
}
```

**FAIL if:** Any API key or service role key is in the `define` block.

---

### 10. CORS Configuration

If any API routes or Next.js config sets CORS headers, check:
- Is `Access-Control-Allow-Origin: *` set? (Should be domain-specific in production)
- Are credentials allowed from arbitrary origins?

---

## Report Format

Produce a report with this structure:

```
SECURITY AUDIT REPORT — [Date] — [Target]

CRITICAL (must fix before any users):
  [#] [File:Line] — [Issue] — [Fix]

HIGH (fix before launch):
  [#] [File:Line] — [Issue] — [Fix]

MEDIUM (fix in next sprint):
  [#] [File:Line] — [Issue] — [Fix]

LOW / INFO:
  [#] [File:Line] — [Observation]

PASSED CHECKS:
  [List of checks that passed]
```

After producing the report: ask the user which issues to fix now vs defer.
