'use client';

import { useState, useEffect } from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import { getInvitableRoles } from '@/constants/roles';
import type { RoleName } from '@/types/auth';

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Pre-select a role when opened from a role group's "+ Invite" button. */
  defaultRole?: RoleName;
  onSuccess: () => void;
}

export function InviteTeamMemberModal({
  isOpen,
  onClose,
  defaultRole,
  onSuccess,
}: InviteTeamMemberModalProps) {
  const { userRole } = useRBAC();

  const invitableRoles: RoleName[] = userRole ? getInvitableRoles(userRole) : [];

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<RoleName>(defaultRole ?? invitableRoles[0] ?? 'Estimator');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setEmail('');
      setRole(defaultRole ?? invitableRoles[0] ?? 'Estimator');
      setError(null);
      setSuccessMsg(null);
    }
  }, [isOpen, defaultRole]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase(), role }),
      });

      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        emailSent?: boolean;
        inviteLink?: string;
      };

      if (!res.ok) {
        setError(json.error ?? 'Something went wrong.');
        return;
      }

      if (json.emailSent === false && json.inviteLink) {
        // Email not configured — show the link directly
        setSuccessMsg(`Email service not configured. Share this invite link:\n${json.inviteLink}`);
      } else {
        setSuccessMsg(`Invitation sent to ${email}.`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-8 pt-8 pb-6">
          <h2 className="text-xl font-bold text-gray-900">Invite Team Member</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-8 pb-8 space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. John Doe"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-500 transition"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Email Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-green-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-500 transition"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Role
            </label>
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as RoleName)}
                className="w-full appearance-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-green-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-green-500 transition cursor-pointer"
              >
                {invitableRoles.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Info text */}
          <p className="text-sm text-gray-500 leading-relaxed">
            An invitation email will be sent to this address with a link to set their password.
            <br />
            If this email already has a pending invitation, sending again will resend it and refresh the expiry.
          </p>

          {/* Error */}
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm text-green-700 whitespace-pre-line">{successMsg}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isSubmitting ? (
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              )}
              Send / Resend Invitation
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
