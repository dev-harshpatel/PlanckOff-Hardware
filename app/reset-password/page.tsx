'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { AUTH_ERRORS, GENERAL_ERRORS } from '@/constants/errors';

interface UserInfo {
  name: string;
  email: string;
}

const spinner = (
  <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
  </div>
);

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isValidating, setIsValidating] = useState(true);

  useEffect(() => {
    if (!token) {
      setTokenError(AUTH_ERRORS.RESET_TOKEN_INVALID.message);
      setIsValidating(false);
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/auth/reset-password/${token}`);
        const json = (await res.json()) as { data?: UserInfo; error?: string };

        if (!res.ok) {
          setTokenError(json.error ?? AUTH_ERRORS.RESET_TOKEN_INVALID.message);
        } else if (json.data) {
          setUserInfo(json.data);
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
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        setError(json.error ?? AUTH_ERRORS.RESET_PASSWORD_FAILED.message);
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2500);
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
            <p className="mt-3 text-sm text-[var(--text-muted)]">
              {AUTH_ERRORS.RESET_TOKEN_INVALID.action}
            </p>
            <button
              onClick={() => router.push('/forgot-password')}
              className="mt-4 text-sm text-blue-600 hover:underline font-medium"
            >
              Request a new reset link
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
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-green-600 dark:text-green-400 font-medium">
              Password reset successfully! Redirecting to login…
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-subtle)] px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image src="/images/logo.svg" alt="PlanckOff" width={148} height={36} priority />
          <p className="mt-3 text-sm text-[var(--text-muted)]">Choose a new password</p>
        </div>

        <div className="bg-[var(--bg)] shadow-sm rounded-lg border border-[var(--border)] p-8">
          {userInfo && (
            <div className="mb-6 rounded-md bg-[var(--primary-bg)] border border-[var(--primary-border)] px-4 py-3">
              <p className="text-sm text-[var(--primary-text)]">
                Resetting password for <strong>{userInfo.name}</strong> ({userInfo.email})
              </p>
            </div>
          )}

          <h2 className="text-xl font-semibold text-[var(--text-secondary)] mb-6">Set new password</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                New password
              </label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min 8 chars, uppercase, lowercase, number"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                Confirm new password
              </label>
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            <ErrorDisplay error={error} />

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Resetting password…' : 'Reset password'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-sm">
          <a href="/login" className="text-blue-600 hover:underline font-medium">
            Back to login
          </a>
        </p>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={spinner}>
      <ResetPasswordForm />
    </Suspense>
  );
}
