import { Component, ErrorInfo, ReactNode } from 'react';

import { GENERAL_ERRORS } from '@/constants/errors';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Optional custom fallback UI. If provided, replaces the default error screen. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Catches unhandled React render errors and shows a safe fallback UI.
 * Never exposes raw error messages or stack traces to users.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log full details for developer debugging — never shown to users
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-subtle)] p-4">
          <div className="w-full max-w-md rounded-lg border border-[var(--error-border)] bg-[var(--bg)] p-8 shadow-xl">
            <h1 className="mb-2 text-xl font-semibold text-[var(--error-text)]">
              {GENERAL_ERRORS.UNEXPECTED.message}
            </h1>
            <p className="mb-6 text-sm text-[var(--text-muted)]">
              {GENERAL_ERRORS.UNEXPECTED.action}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md bg-[var(--primary-action)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ErrorBoundary };
