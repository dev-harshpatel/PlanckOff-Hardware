'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

const ADMIN_EMAIL = 'tech@planckoff.com';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const trimmed = email.trim().toLowerCase();

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const json = (await res.json()) as { error?: string };

      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many attempts. Please try again later.');
        } else {
          setError(json.error ?? 'Failed to send the reset email. Please try again.');
        }
        return;
      }

      setSentTo(trimmed);
    } catch {
      setError('Network error. Please check your connection.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)] px-6 py-12">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/logo.svg" alt="PlanckOff" width={148} height={36} priority />
        </div>

        {sentTo ? (
          /* ── Success state ── */
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Reset link sent</h2>
              <p className="text-sm text-[var(--text-muted)]">
                We've sent a password reset link to{' '}
                <span className="font-semibold text-[var(--text)]">{sentTo}</span>.
                Check your inbox (and spam folder) and follow the link to set a new password.
                The link expires in <strong>1 hour</strong>.
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Back to login
            </button>
          </div>
        ) : (
          /* ── Form state ── */
          <>
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight text-[var(--text)]">Forgot password?</h2>
              <p className="mt-1.5 text-sm text-[var(--text-muted)]">
                Enter your registered email and we'll send you a reset link.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-8 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-medium text-[var(--text-secondary)]">
                    Email address
                  </label>
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-[var(--border-strong)] bg-[var(--bg)] px-3.5 py-2.5 text-sm text-[var(--text)] placeholder-[var(--text-faint)] transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="you@company.com"
                  />
                </div>

                <ErrorDisplay error={error} />

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="relative w-full overflow-hidden rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Sending…
                    </span>
                  ) : (
                    'Send reset link'
                  )}
                </button>
              </form>
            </div>

            <p className="mt-4 text-center text-sm">
              <button
                onClick={() => router.push('/login')}
                className="text-blue-600 hover:underline font-medium"
              >
                Back to login
              </button>
            </p>
          </>
        )}

        {/* Forgot email — shown in both states */}
        <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-4 text-center">
          <p className="text-xs text-[var(--text-muted)]">
            Can't remember your email address?{' '}
            <a
              href={`mailto:${ADMIN_EMAIL}?subject=PlanckOff%20Account%20Access`}
              className="font-medium text-blue-600 hover:underline"
            >
              Contact your admin
            </a>{' '}
            at{' '}
            <a
              href={`mailto:${ADMIN_EMAIL}`}
              className="font-medium text-blue-600 hover:underline"
            >
              {ADMIN_EMAIL}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
