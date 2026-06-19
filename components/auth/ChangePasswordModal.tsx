'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ERRORS } from '@/constants/errors';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import { Eye, EyeOff, KeyRound, Check, X } from 'lucide-react';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PasswordRequirement {
  label: string;
  met: boolean;
}

function getRequirements(password: string): PasswordRequirement[] {
  return [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'One lowercase letter', met: /[a-z]/.test(password) },
    { label: 'One number', met: /\d/.test(password) },
  ];
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setShowCurrent(false);
      setShowNew(false);
      setShowConfirm(false);
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const requirements = getRequirements(newPassword);
  const allMet = requirements.every((r) => r.met);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!allMet) {
      setError('New password does not meet all requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(ERRORS.AUTH.PASSWORD_MISMATCH.message);
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        if (res.status === 401) {
          setError(ERRORS.AUTH.INCORRECT_CURRENT_PASSWORD.message);
        } else {
          setError(json.error ?? ERRORS.AUTH.CHANGE_PASSWORD_FAILED.message);
        }
        return;
      }

      setSuccess(true);
      // All sessions are invalidated — redirect to login after a short delay
      setTimeout(() => {
        onClose();
        router.push('/login');
      }, 2000);
    } catch {
      setError(ERRORS.AUTH.NETWORK_ERROR.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md mx-4 bg-white dark:bg-[var(--bg)] rounded-2xl shadow-2xl border border-[var(--border)]">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
              <KeyRound className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text)]">Change Password</h2>
              <p className="text-xs text-[var(--text-muted)]">Update your account password</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors p-1 rounded-full hover:bg-[var(--bg-muted)]"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="h-px bg-[var(--border)] mx-8" />

        {success ? (
          <div className="px-8 py-6">
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-5 py-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Check className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Password changed successfully
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                  Redirecting to login…
                </p>
              </div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-8 pt-5 pb-8 space-y-5">
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Current Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  autoComplete="current-password"
                  required
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3 pr-11 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:border-blue-500 focus:bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  tabIndex={-1}
                  aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  autoComplete="new-password"
                  required
                  className="w-full rounded-xl border border-[var(--border-strong)] bg-[var(--bg-subtle)] px-4 py-3 pr-11 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:border-blue-500 focus:bg-[var(--bg)] focus:outline-none focus:ring-1 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  tabIndex={-1}
                  aria-label={showNew ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {newPassword.length > 0 && (
                <ul className="mt-2.5 space-y-1.5 pl-1">
                  {requirements.map((req) => (
                    <li
                      key={req.label}
                      className={`flex items-center gap-2 text-xs transition-colors ${req.met ? 'text-green-600' : 'text-[var(--text-muted)]'}`}
                    >
                      {req.met ? (
                        <Check className="w-3 h-3 flex-shrink-0" />
                      ) : (
                        <span className="w-3 h-3 flex-shrink-0 rounded-full border border-[var(--border-strong)] inline-block" />
                      )}
                      {req.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">
                Confirm New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                  className={`w-full rounded-xl bg-[var(--bg-subtle)] px-4 py-3 pr-11 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:bg-[var(--bg)] focus:outline-none focus:ring-1 transition border ${
                    confirmPassword.length > 0
                      ? passwordsMatch
                        ? 'border-green-400 focus:border-green-500 focus:ring-green-500'
                        : 'border-red-300 focus:border-red-400 focus:ring-red-400'
                      : 'border-[var(--border-strong)] focus:border-blue-500 focus:ring-blue-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  tabIndex={-1}
                  aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p className="mt-1.5 text-xs text-red-500">Passwords do not match.</p>
              )}
              {confirmPassword.length > 0 && passwordsMatch && (
                <p className="mt-1.5 text-xs text-green-600 flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  Passwords match
                </p>
              )}
            </div>

            {error && <ErrorDisplay error={error} />}

            <div className="flex gap-3 pt-1">
              <Button
                type="button"
                onClick={onClose}
                variant="outline"
                className="flex-1 rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !allMet || !passwordsMatch || !currentPassword}
                className="flex-1 rounded-xl bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Changing…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <KeyRound className="w-4 h-4" />
                    Change Password
                  </span>
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
