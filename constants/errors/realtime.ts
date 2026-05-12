import type { AppError } from './index';

/**
 * Error registry for Supabase Realtime subscription failures.
 * Surfaced when a postgres_changes channel errors out (network drop,
 * auth/replication failure, etc.). Toast persists until user dismisses.
 */
export const REALTIME_ERRORS = {
  SUBSCRIPTION_FAILED: {
    code: 'RT_SUBSCRIPTION_FAILED',
    message: 'Live updates are temporarily unavailable.',
    action: 'Your changes are still saved. Reload the page if data appears out of date.',
  },
} as const satisfies Record<string, AppError>;
