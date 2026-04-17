export const AUTH_CONFIG = {
  SESSION_DURATION_DAYS: 7,
  SESSION_RENEWAL_WINDOW_HOURS: 24,
  SESSION_COOKIE_NAME: 'auth_session',
  BCRYPT_SALT_ROUNDS: 12,
} as const;

export const COOKIE_CONFIG = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};
