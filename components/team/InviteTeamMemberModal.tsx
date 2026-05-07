'use client';

import { useState, useEffect } from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import { getInvitableRoles } from '@/constants/roles';
import type { RoleName } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ERRORS } from '@/constants/errors';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

interface InviteTeamMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
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
        setError(json.error ?? ERRORS.GENERAL.UNEXPECTED.message);
        return;
      }

      if (json.emailSent === false && json.inviteLink) {
        setSuccessMsg(`Email service not configured. Share this invite link:\n${json.inviteLink}`);
      } else {
        setSuccessMsg(`Invitation sent to ${email}.`);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1500);
      }
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
      <div className="w-full max-w-lg mx-4 bg-white rounded-2xl shadow-2xl">
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

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Role
            </label>
            <Select value={role} onValueChange={v => setRole(v as RoleName)}>
              <SelectTrigger className="w-full h-12 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {invitableRoles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <p className="text-sm text-gray-500 leading-relaxed">
            An invitation email will be sent to this address with a link to set their password.
            <br />
            If this email already has a pending invitation, sending again will resend it and refresh the expiry.
          </p>

          {error && <ErrorDisplay error={error} />}

          {successMsg && (
            <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3">
              <p className="text-sm text-green-700 whitespace-pre-line">{successMsg}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
              className="flex-1 rounded-xl border-gray-200"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              loading={isSubmitting}
              loadingText="Sending Invitation..."
              className="flex-1 rounded-xl bg-green-700 hover:bg-green-800"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              Send / Resend Invitation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
