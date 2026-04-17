import { createSupabaseAdminClient } from '@/lib/supabase/admin';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

export interface SendInviteEmailInput {
  toEmail: string;
  toName: string;
  role: string;
  inviteToken: string;
}

/**
 * Sends an invitation email via Supabase's built-in email infrastructure.
 *
 * Uses `auth.admin.inviteUserByEmail()` which triggers the "Invite User"
 * email template configured in your Supabase dashboard:
 *   Authentication → Email Templates → Invite User
 *
 * The `redirectTo` URL embeds our custom invite token so our set-password
 * page can validate it independently of Supabase Auth.
 *
 * IMPORTANT — add this URL to Supabase's redirect allowlist:
 *   Dashboard → Authentication → URL Configuration → Redirect URLs
 *   Add: http://localhost:3000/set-password (dev)
 *        https://yourdomain.com/set-password (prod)
 */
export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<{ error: string | null }> {
  const { toEmail, toName, role, inviteToken } = input;

  // Our custom token rides in the redirectTo query param.
  // After Supabase verifies the magic link it redirects here,
  // and our set-password page reads ?token= to complete the flow.
  const redirectTo = `${APP_URL}/set-password?token=${inviteToken}`;

  try {
    const db = createSupabaseAdminClient();

    const { error } = await db.auth.admin.inviteUserByEmail(toEmail, {
      redirectTo,
      data: {
        // Stored in Supabase auth.users.raw_user_meta_data — available as
        // {{ .Data.name }} and {{ .Data.role }} in the email template.
        name: toName,
        role,
      },
    });

    if (error) return { error: error.message };
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
