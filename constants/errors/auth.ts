import type { AppError } from './index';

/**
 * Error registry for authentication flows — login, session, and access control.
 */
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    message: 'Invalid email or password.',
    action: 'Check your credentials and try again.',
  },
  NETWORK_ERROR: {
    code: 'AUTH_NETWORK_ERROR',
    message: 'Network error. Please check your connection.',
    action: 'Try again in a moment.',
  },
  SESSION_FAILED: {
    code: 'AUTH_SESSION_FAILED',
    message: 'Sign-in failed. Please try again.',
  },
  LOGIN_FAILED: {
    code: 'AUTH_LOGIN_FAILED',
    message: 'Login failed.',
    action: 'Please try again.',
  },
  ACCESS_DENIED: {
    code: 'AUTH_ACCESS_DENIED',
    message: 'You do not have permission to access this page.',
  },
  SET_PASSWORD_FAILED: {
    code: 'AUTH_SET_PASSWORD_FAILED',
    message: 'Failed to set your password.',
    action: 'Please try again or contact your administrator.',
  },
  INVITE_FAILED: {
    code: 'AUTH_INVITE_FAILED',
    message: 'Failed to send the invitation.',
    action: 'Please try again.',
  },
  RESEND_INVITE_FAILED: {
    code: 'AUTH_RESEND_INVITE_FAILED',
    message: 'Failed to resend the invitation.',
    action: 'Please try again.',
  },
} as const satisfies Record<string, AppError>;
