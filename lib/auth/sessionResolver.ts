import {
  findSessionByToken,
  isSessionExpired,
  deleteSessionById,
  updateSessionExpiry,
  computeNewExpiry,
} from '@/lib/db/auth';
import { AUTH_CONFIG } from '@/constants/auth';
import type { AuthUser } from '@/types/auth';
import type { TeamMemberWithRole } from '@/types/team';

export interface ResolvedSession {
  session: {
    id: string;
    token: string;
    expiresAt: string;
    ipAddress: string | null;
  };
  user: AuthUser;
  teamMember: TeamMemberWithRole | null;
  renewed: boolean;
  expiresAt: string;
}

interface ResolveOptions {
  cleanupExpired?: boolean;
  renewIfExpiring?: boolean;
}

/**
 * Resolve a raw session token into a full session object.
 * Returns null if the session is invalid, expired, or missing.
 */
export async function resolveSessionFromToken(
  token: string,
  options: ResolveOptions = {},
): Promise<ResolvedSession | null> {
  const { cleanupExpired = false, renewIfExpiring = false } = options;

  const { data, error } = await findSessionByToken(token);
  if (error || !data) return null;

  const { session, user, teamMember } = data;

  // Check expiry
  if (isSessionExpired(session.expires_at)) {
    if (cleanupExpired) {
      await deleteSessionById(session.id);
    }
    return null;
  }

  let currentExpiry = session.expires_at;
  let renewed = false;

  // Renew if within the renewal window
  if (renewIfExpiring) {
    const expiresAt = new Date(session.expires_at);
    const renewalThreshold = new Date();
    renewalThreshold.setHours(
      renewalThreshold.getHours() + AUTH_CONFIG.SESSION_RENEWAL_WINDOW_HOURS,
    );

    if (expiresAt <= renewalThreshold) {
      const newExpiry = computeNewExpiry();
      const { error: renewError } = await updateSessionExpiry({
        sessionId: session.id,
        expiresAt: newExpiry,
      });
      if (!renewError) {
        currentExpiry = newExpiry;
        renewed = true;
      }
    }
  }

  return {
    session: {
      id: session.id,
      token: session.token,
      expiresAt: currentExpiry,
      ipAddress: session.ip_address,
    },
    user,
    teamMember,
    renewed,
    expiresAt: currentExpiry,
  };
}
