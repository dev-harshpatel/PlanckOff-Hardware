import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

/**
 * Input parameters for sending a PlanckOff invitation email.
 *
 * NOTE: inviterName is optional — both callers (/api/team/invite and
 * /api/team/members/[id]/resend-invite) pass user.name today. It is threaded
 * into Supabase user_metadata as `data.inviterName` so the dashboard email
 * template can reference it as `{{ .Data.inviterName }}`.
 */
export interface SendInviteEmailInput {
  toEmail: string;
  toName: string;
  role: string;
  inviteToken: string;
  inviterName?: string;
}

/**
 * Sends a PlanckOff invitation email via Supabase's built-in email
 * infrastructure (auth.admin.inviteUserByEmail).
 *
 * The HTML body is owned by the Supabase dashboard:
 *   Supabase Dashboard → Authentication → Email Templates → Invite User
 * Paste 14.1-01-DASHBOARD-TEMPLATE.html (produced by Plan 14.1-01 Task 2)
 * into that template editor to restore the PlanckOff visual branding.
 *
 * The recipient receives a link that lands on the Supabase confirmation URL,
 * which then redirects to:
 *   ${NEXT_PUBLIC_APP_URL}/set-password?token=${inviteToken}
 *
 * Required environment variables:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - NEXT_PUBLIC_APP_URL (must also be added to Supabase → Auth → URL
 *     Configuration → Redirect URLs allowlist)
 *
 * @returns `{ error: null }` on success or `{ error: string }` on failure.
 *   Callers should check `error` rather than catching — this function never throws.
 */
export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<{ error: string | null }> {
  const { toEmail, toName, role, inviteToken, inviterName } = input;
  const redirectTo = `${APP_URL}/set-password?token=${inviteToken}`;

  try {
    const db = createSupabaseAdminClient();
    const { error } = await db.auth.admin.inviteUserByEmail(toEmail, {
      redirectTo,
      data: { name: toName, role, inviterName: inviterName ?? '' },
    });
    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
