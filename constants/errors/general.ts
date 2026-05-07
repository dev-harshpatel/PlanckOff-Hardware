import type { AppError } from './index';

/**
 * Error registry for generic / cross-domain error conditions.
 * Use GENERAL_ERRORS.UNEXPECTED as the catch-all fallback.
 */
export const GENERAL_ERRORS = {
  UNEXPECTED: {
    code: 'GEN_UNEXPECTED',
    message: 'Something went wrong.',
    action: 'Please reload the page or try again.',
  },
  NETWORK: {
    code: 'GEN_NETWORK',
    message: 'Network error. Please check your connection.',
    action: 'Try again in a moment.',
  },
  SERVER: {
    code: 'GEN_SERVER',
    message: 'A server error occurred.',
    action: 'Please try again. If the problem persists, contact support.',
  },
  UNAUTHORIZED: {
    code: 'GEN_UNAUTHORIZED',
    message: 'You are not authorised to perform this action.',
  },
  NOT_FOUND: {
    code: 'GEN_NOT_FOUND',
    message: 'The requested resource could not be found.',
  },
  REQUIRED_FIELD: {
    code: 'GEN_REQUIRED_FIELD',
    message: 'Please fill in all required fields.',
  },
  SAVE_FAILED: {
    code: 'GEN_SAVE_FAILED',
    message: 'Save failed.',
    action: 'Please try again.',
  },
  TIMEOUT: {
    code: 'GEN_TIMEOUT',
    message: 'The request timed out.',
    action: 'Please try again.',
  },
} as const satisfies Record<string, AppError>;
