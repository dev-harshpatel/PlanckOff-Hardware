import { readFileSync } from 'fs';
import { join } from 'path';

import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const INVITE_EXPIRY_DAYS = 7;
const SUPPORT_EMAIL = 'tech.planckoff@gmail.com';

/**
 * Input parameters for sending a PlanckOff invitation email.
 */
export interface SendInviteEmailInput {
  toEmail: string;
  toName: string;
  role: string;
  inviteToken: string;
  /** Optional — resend-invite route does not supply this. Displays as 'A team member' when absent. */
  inviterName?: string;
}

/**
 * Parameters for the invite email template helpers.
 * @internal
 */
interface InviteTemplateParams {
  toName: string;
  role: string;
  inviterName?: string;
  inviteLink: string;
  logoBase64: string;
}

/**
 * Sends a PlanckOff-branded invitation email via AWS SES.
 *
 * The recipient receives a set-password link valid for 7 days pointing to
 * `${NEXT_PUBLIC_APP_URL}/set-password?token=${inviteToken}`.
 *
 * Required environment variables:
 *   - AWS_REGION          — AWS region where your SES identity is verified
 *   - AWS_ACCESS_KEY_ID   — IAM access key with ses:SendEmail permission
 *   - AWS_SECRET_ACCESS_KEY — IAM secret access key
 *   - SES_FROM_EMAIL      — Verified SES sender address
 *
 * @returns `{ error: null }` on success or `{ error: string }` on failure.
 *   Callers should check `error` rather than catching — this function never throws.
 */
export async function sendInviteEmail(
  input: SendInviteEmailInput,
): Promise<{ error: string | null }> {
  const { toEmail, toName, role, inviteToken, inviterName } = input;

  const inviteLink = `${APP_URL}/set-password?token=${inviteToken}`;

  // Read logo inside the function (not at module load) to avoid Next.js static
  // analysis failures when public/images/logo.png might be absent at build time.
  const logoBase64 = readFileSync(
    join(process.cwd(), 'public', 'images', 'logo.png'),
  ).toString('base64');

  const htmlBody = buildInviteHtml({ toName, role, inviterName, inviteLink, logoBase64 });
  const textBody = buildInvitePlainText({ toName, role, inviterName, inviteLink });

  // Instantiate SES client inside the function (not at module level) — avoids
  // Next.js static analysis failures when AWS env vars are absent at build time.
  const client = new SESClient({
    region: process.env.AWS_REGION ?? 'us-east-1',
    credentials: {
      accessKeyId:     process.env.AWS_ACCESS_KEY_ID ?? '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? '',
    },
  });

  try {
    await client.send(new SendEmailCommand({
      Source: process.env.SES_FROM_EMAIL ?? '',
      Destination: { ToAddresses: [toEmail] },
      Message: {
        Subject: { Charset: 'UTF-8', Data: 'You have been invited to PlanckOff' },
        Body: {
          Html: { Charset: 'UTF-8', Data: htmlBody },
          Text: { Charset: 'UTF-8', Data: textBody },
        },
      },
    }));
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Builds the PlanckOff-branded HTML invitation email body.
 * All CSS is inline — email clients strip `<style>` blocks.
 * @internal
 */
function buildInviteHtml(params: InviteTemplateParams): string {
  const { toName, role, inviterName, inviteLink, logoBase64 } = params;
  const inviterDisplay = inviterName ?? 'A team member';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>You've been invited to PlanckOff</title>
</head>
<body style="margin:0;padding:0;background-color:#f8f9fa;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f8f9fa;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background-color:#2563eb;padding:32px;text-align:center;">
              <img src="data:image/png;base64,${logoBase64}" alt="PlanckOff" height="48" style="display:block;margin:0 auto 12px;">
              <h1 style="color:#ffffff;font-size:24px;margin:0;font-weight:700;letter-spacing:-0.5px;">PlanckOff</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 48px;">
              <h2 style="color:#1e293b;font-size:20px;margin:0 0 16px;font-weight:600;">Hi ${toName}, you've been invited!</h2>
              <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 24px;">
                <strong>${inviterDisplay}</strong> has invited you to join <strong>PlanckOff</strong>
                as a <strong>${role}</strong>.
              </p>
              <p style="color:#475569;font-size:16px;line-height:1.6;margin:0 0 16px;">
                With PlanckOff you can:
              </p>
              <ul style="color:#475569;font-size:15px;line-height:1.8;margin:0 0 32px;padding-left:20px;">
                <li>View hardware specifications and door schedules</li>
                <li>Access pricing reports and project summaries</li>
                <li>Download formatted exports</li>
              </ul>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td style="background-color:#2563eb;border-radius:6px;">
                    <a href="${inviteLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                      Accept Invitation
                    </a>
                  </td>
                </tr>
              </table>

              <p style="color:#94a3b8;font-size:13px;margin:0 0 8px;">
                Or copy this link into your browser:
              </p>
              <p style="color:#2563eb;font-size:13px;word-break:break-all;margin:0 0 32px;">
                ${inviteLink}
              </p>

              <p style="color:#94a3b8;font-size:13px;margin:0;">
                This invitation expires in ${INVITE_EXPIRY_DAYS} days. If you did not expect this email, you can safely ignore it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f9fa;padding:24px 48px;border-top:1px solid #e2e8f0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">
                Need help? Contact us at
                <a href="mailto:${SUPPORT_EMAIL}" style="color:#2563eb;">${SUPPORT_EMAIL}</a>
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

/**
 * Builds the plain-text fallback body for the PlanckOff invitation email.
 * Used by email clients that do not render HTML.
 * @internal
 */
function buildInvitePlainText(params: Omit<InviteTemplateParams, 'logoBase64'>): string {
  const { toName, role, inviterName, inviteLink } = params;
  const inviterDisplay = inviterName ?? 'A team member';

  return [
    `Hi ${toName},`,
    '',
    `${inviterDisplay} has invited you to join PlanckOff as a ${role}.`,
    '',
    'Accept your invitation by visiting the link below:',
    inviteLink,
    '',
    `This invitation expires in ${INVITE_EXPIRY_DAYS} days.`,
    '',
    'If you did not expect this email, you can safely ignore it.',
    '',
    `Need help? Contact us at ${SUPPORT_EMAIL}`,
  ].join('\n');
}
