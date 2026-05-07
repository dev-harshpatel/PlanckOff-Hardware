'use client';

import type { AppError } from '@/constants/errors';
import { cn } from '@/lib/utils';

interface ErrorDisplayProps {
  /** Registry AppError object or plain string. Renders nothing when null. */
  error: AppError | string | null;
  /** Additional Tailwind classes merged onto the wrapper element. */
  className?: string;
  /**
   * compact — inline badge-style for use inside form fields.
   * Default (false) — full alert block with optional action hint.
   */
  compact?: boolean;
}

/**
 * Renders a user-facing error from the registry or a plain string.
 * Uses CSS variable tokens (--error-bg, --error-text, --error-border) so it
 * is automatically correct in both light and dark modes.
 */
export function ErrorDisplay({ error, className, compact = false }: ErrorDisplayProps) {
  if (!error) return null;

  const message = typeof error === 'string' ? error : error.message;
  const action = typeof error === 'string' ? undefined : error.action;

  if (compact) {
    return (
      <span
        role="alert"
        className={cn(
          'inline-flex items-center rounded border border-[var(--error-border)] bg-[var(--error-bg)] px-2 py-1 text-xs text-[var(--error-text)]',
          className,
        )}
      >
        {message}
      </span>
    );
  }

  return (
    <div
      role="alert"
      className={cn(
        'rounded-md border border-[var(--error-border)] bg-[var(--error-bg)] px-4 py-3',
        className,
      )}
    >
      <p className="text-sm font-medium text-[var(--error-text)]">{message}</p>
      {action && (
        <p className="mt-1 text-xs text-[var(--error-text)] opacity-75">{action}</p>
      )}
    </div>
  );
}
