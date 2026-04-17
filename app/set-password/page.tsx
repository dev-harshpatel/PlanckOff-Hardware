'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface InviteInfo {
  name: string;
  email: string;
  role: string;
}

export default function SetPasswordPage() {
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

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      setTokenError('No invite token provided.');
      setIsValidating(false);
      return;
    }

    async function validateToken() {
      try {
        const res = await fetch(`/api/team/invite/${token}`);
        const json = (await res.json()) as { data?: InviteInfo; error?: string };

        if (!res.ok) {
          setTokenError(json.error ?? 'Invalid or expired invite link.');
        } else if (json.data) {
          setInviteInfo(json.data);
        }
      } catch {
        setTokenError('Failed to validate invite link.');
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
      setError('Passwords do not match.');
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
        setError(json.error ?? 'Failed to set password.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white shadow-sm rounded-lg border border-red-200 p-8">
            <p className="text-red-700 font-medium">{tokenError}</p>
            <button
              onClick={() => router.push('/login')}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Go to login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-white shadow-sm rounded-lg border border-green-200 p-8">
            <p className="text-green-700 font-medium">Password set successfully! Redirecting to login…</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <Image
            src="/images/logo.svg"
            alt="PlanckOff"
            width={180}
            height={48}
            priority
          />
          <p className="mt-3 text-sm text-gray-500">Accept your invitation</p>
        </div>

        <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-8">
          {inviteInfo && (
            <div className="mb-6 rounded-md bg-blue-50 border border-blue-200 px-4 py-3">
              <p className="text-sm text-blue-800">
                Setting password for <strong>{inviteInfo.name}</strong> ({inviteInfo.email}) —{' '}
                <span className="font-medium">{inviteInfo.role}</span>
              </p>
            </div>
          )}

          <h2 className="text-xl font-semibold text-gray-800 mb-6">Set your password</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Min 8 chars, uppercase, lowercase, number"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-md bg-red-50 border border-red-200 px-4 py-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

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
