const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const RESEND_API_KEY = process.env.RESEND_API;
const FROM_EMAIL = 'noreply@planckoff.ai';
const FROM_NAME = 'PlanckOff';

export interface SendInviteEmailInput {
  toEmail: string;
  toName: string;
  role: string;
  inviteToken: string;
  inviterName?: string;
}

function buildInviteHtml(input: SendInviteEmailInput, inviteLink: string): string {
  const { toName, role, inviterName } = input;
  const inviterLine = inviterName
    ? `<strong style="color:#0f172a;">${escapeHtml(inviterName)}</strong> has invited you to join`
    : 'You have been invited to join';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>You've been invited to PlanckOff</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f1f5f9;padding:48px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;">
          <tr>
            <td style="padding:0 8px 24px;text-align:center;">
              <span style="font-size:22px;font-weight:700;letter-spacing:-0.5px;color:#0f172a;">Planck<span style="color:#2563eb;">Off</span></span>
            </td>
          </tr>
          <tr>
            <td style="background-color:#ffffff;border-radius:16px;border:1px solid #e2e8f0;padding:48px;">
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-bottom:8px;">
                    <span style="display:inline-block;padding:6px 14px;border-radius:999px;background-color:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                      Team Invitation
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="padding:16px 0 12px;">
                    <h1 style="margin:0;font-size:26px;line-height:1.3;font-weight:700;letter-spacing:-0.5px;color:#0f172a;">
                      Hi ${escapeHtml(toName)}, welcome aboard.
                    </h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding-bottom:32px;">
                    <p style="margin:0;font-size:16px;line-height:1.7;color:#475569;">
                      ${inviterLine}
                      <strong style="color:#0f172a;">PlanckOff</strong> as
                      a&nbsp;<strong style="color:#0f172a;">${escapeHtml(role)}</strong> — set your password to get started.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td align="center" style="padding-bottom:32px;">
                    <table cellpadding="0" cellspacing="0" role="presentation">
                      <tr>
                        <td style="background-color:#2563eb;border-radius:10px;">
                          <a href="${inviteLink}" style="display:inline-block;padding:15px 40px;color:#ffffff;font-size:16px;font-weight:600;letter-spacing:0.2px;text-decoration:none;border-radius:10px;">
                            Accept Invitation
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #e2e8f0;padding-top:24px;">
                    <p style="margin:0 0 6px;font-size:13px;line-height:1.6;color:#94a3b8;">
                      Button not working? Copy this link into your browser:
                    </p>
                    <p style="margin:0 0 24px;font-size:13px;line-height:1.6;word-break:break-all;">
                      <a href="${inviteLink}" style="color:#2563eb;text-decoration:none;">${inviteLink}</a>
                    </p>
                    <p style="margin:0;font-size:13px;line-height:1.6;color:#94a3b8;">
                      This invitation expires in 7 days. If you weren't expecting it, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 8px 0;text-align:center;">
              <p style="margin:0 0 6px;font-size:12px;line-height:1.6;color:#94a3b8;">
                Need help? Reach us at
                <a href="mailto:tech@planckoff.com" style="color:#2563eb;text-decoration:none;">tech@planckoff.com</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:1.6;color:#cbd5e1;">
                PlanckOff — Hardware Estimating Platform
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<{ error: string | null }> {
  if (!RESEND_API_KEY) {
    return { error: 'RESEND_API environment variable is not set.' };
  }

  const inviteLink = `${APP_URL}/set-password?token=${input.inviteToken}`;

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [input.toEmail],
        subject: 'You have been invited to PlanckOff',
        html: buildInviteHtml(input, inviteLink),
      }),
    });

    if (response.ok) return { error: null };

    const body = await response.json().catch(() => ({})) as { message?: string; name?: string };
    return { error: body.message ?? `Resend API error ${response.status}` };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
