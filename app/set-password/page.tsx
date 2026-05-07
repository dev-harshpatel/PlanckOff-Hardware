'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { AUTH_ERRORS, GENERAL_ERRORS } from '@/constants/errors';

interface InviteInfo {
  name: string;
  email: string;
  role: string;
}

const spinner = (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setTokenError(AUTH_ERRORS.INVITE_INVALID.message);
      setIsValidating(false);
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/team/invite/${token}`);
        const json = (await res.json()) as { data?: InviteInfo; error?: string };

        if (!res.ok) {
          setTokenError(json.error ?? AUTH_ERRORS.INVITE_INVALID.message);
        } else if (json.data) {
          setInviteInfo(json.data);
        }
      } catch {
        setTokenError(GENERAL_ERRORS.NETWORK.message);
      } finally {
        setIsValidating(false);
      }
    }

    validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError(AUTH_ERRORS.PASSWORD_MISMATCH.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/team/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        setError(json.error ?? AUTH_ERRORS.SET_PASSWORD_FAILED.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError(AUTH_ERRORS.NETWORK_ERROR.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) return spinner;

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)] px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[var(--bg)] shadow-sm rounded-lg border border-[var(--border)] p-8">
            <ErrorDisplay error={tokenError} />
            <button onClick={() => router.push('/login')} className="mt-4 text-sm text-blue-600 hover:underline">
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)] px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-[var(--bg)] shadow-sm rounded-lg border border-green-500/30 p-8">
            <p className="text-green-600 dark:text-green-400 font-medium">Password set successfully! Redirecting to login…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/logo.svg" alt="PlanckOff" width={180} height={48} priority />
          <p className="mt-3 text-sm text-[var(--text-muted)]">Accept your invitation</p>
        </div>

        <div className="bg-[var(--bg)] shadow-sm rounded-lg border border-[var(--border)] p-8">
          {inviteInfo && (
            <div className="mb-6 rounded-md bg-[var(--primary-bg)] border border-[var(--primary-border)] px-4 py-3">
              <p className="text-sm text-[var(--primary-text)]">
                Setting password for <strong>{inviteInfo.name}</strong> ({inviteInfo.email}) —{' '}
                <span className="font-medium">{inviteInfo.role}</span>
              </p>
            </div>
          )}

          <h2 className="text-xl font-semibold text-[var(--text-secondary)] mb-6">Set your password</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:border-[var(--primary-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)]"
                placeholder="Min 8 chars, uppercase, lowercase, number"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:border-[var(--primary-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)]"
                placeholder="••••••••"
              />
            </div>

            <ErrorDisplay error={error} />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Setting password…' : 'Set password & activate account'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function SetPasswordPage() {
  return (
    <Suspense fallback={spinner}>
      <SetPasswordForm />
    </Suspense>
  );
}
