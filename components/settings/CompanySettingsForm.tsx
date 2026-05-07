'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Building2, Globe, Mail, MapPin, Phone, Upload, X } from 'lucide-react';
import type { CompanySettings } from '@/lib/db/companySettings';
import { GENERAL_ERRORS } from '@/constants/errors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

// ---------------------------------------------------------------------------
// Shared input / label styles (matches MasterItemFormModal pattern)
// ---------------------------------------------------------------------------

const inputCls =
  'w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--text)] bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors';

const textareaCls =
  'w-full px-3 py-2 border border-[var(--border)] rounded-md text-sm text-[var(--text)] bg-[var(--bg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors resize-none';

const labelCls =
  'block text-xs font-medium text-[var(--text-muted)] mb-1';

// ---------------------------------------------------------------------------
// Save indicator
// ---------------------------------------------------------------------------

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  if (state === 'saving') return (
    <span className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
      <span className="inline-block h-3 w-3 rounded-full border-2 border-[var(--text-muted)] border-t-transparent animate-spin" />
      Saving…
    </span>
  );
  if (state === 'saved') return (
    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Saved ✓</span>
  );
  return (
    <span className="text-xs font-semibold text-[var(--error-text)]">{GENERAL_ERRORS.SAVE_FAILED.message}</span>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CompanySettingsForm() {
  const [form, setForm] = useState<CompanySettings>({
    companyName: '',
    websiteUrl:  '',
    address:     '',
    country:     '',
    province:    '',
    phone:       '',
    email:       '',
    logoUrl:     '',
  });
  const [saveState, setSaveState]           = useState<SaveState>('idle');
  const [logoUploading, setLogoUploading]   = useState(false);
  const [loadError, setLoadError]           = useState<string | null>(null);
  const [isLoading, setIsLoading]           = useState(true);
  const debounceRef                         = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef                       = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef                        = useRef<HTMLInputElement>(null);

  // ── Load on mount ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/settings/company', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : Promise.reject(r.statusText))
      .then((json: { data: CompanySettings }) => setForm(json.data))
      .catch(() => setLoadError('Failed to load company settings.'))
      .finally(() => setIsLoading(false));
  }, []);

  // ── Debounced save ─────────────────────────────────────────────────────────
  const scheduleSave = useCallback((updated: CompanySettings) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveState('saving');

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/settings/company', {
          method:      'PUT',
          credentials: 'include',
          headers:     { 'Content-Type': 'application/json' },
          body:        JSON.stringify(updated),
        });
        if (!res.ok) throw new Error();
        setSaveState('saved');
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2500);
      } catch {
        setSaveState('error');
      }
    }, 800);
  }, []);

  const handleFieldChange = useCallback(
    (field: keyof CompanySettings) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const updated = { ...form, [field]: e.target.value };
        setForm(updated);
        scheduleSave(updated);
      },
    [form, scheduleSave],
  );

  // ── Logo upload ────────────────────────────────────────────────────────────
  const handleLogoSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveState('saving');
    try {
      const fd = new FormData();
      fd.append('logo', file);
      const res = await fetch('/api/settings/company/logo', {
        method: 'POST', credentials: 'include', body: fd,
      });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { data: { logoUrl: string } };
      setForm(prev => ({ ...prev, logoUrl: json.data.logoUrl }));
      setSaveState('saved');
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    } finally {
      setLogoUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const handleLogoRemove = useCallback(async () => {
    setLogoUploading(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    setSaveState('saving');
    try {
      const res = await fetch('/api/settings/company/logo', {
        method: 'DELETE', credentials: 'include',
      });
      if (!res.ok) throw new Error();
      setForm(prev => ({ ...prev, logoUrl: '' }));
      setSaveState('saved');
      savedTimerRef.current = setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    } finally {
      setLogoUploading(false);
    }
  }, []);

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
        {/* Panel header skeleton */}
        <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-2.5 flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-[var(--primary-bg-hover)] animate-pulse" />
          <div className="h-3 w-32 rounded bg-[var(--primary-bg-hover)] animate-pulse" />
        </div>

        <div className="px-5 py-5 space-y-5 animate-pulse">
          {/* Logo row */}
          <div className="flex items-start gap-4">
            <div className="h-14 w-32 rounded-md bg-[var(--bg-muted)]" />
            <div className="space-y-2 mt-1">
              <div className="h-3 w-36 rounded bg-[var(--bg-muted)]" />
              <div className="h-3 w-28 rounded bg-[var(--bg-muted)]" />
            </div>
          </div>

          <hr className="border-[var(--border)]" />

          {/* Row 1 — Company name + Website */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-[var(--bg-muted)]" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)]" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-24 rounded bg-[var(--bg-muted)]" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)]" />
            </div>
          </div>

          {/* Row 2 — Email + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)]" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)]" />
            </div>
          </div>

          {/* Address textarea */}
          <div className="space-y-1.5">
            <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
            <div className="h-16 rounded-md bg-[var(--bg-muted)]" />
          </div>

          {/* Row 3 — Province + Country */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <div className="h-3 w-28 rounded bg-[var(--bg-muted)]" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)]" />
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-16 rounded bg-[var(--bg-muted)]" />
              <div className="h-9 rounded-md bg-[var(--bg-muted)]" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] px-5 py-8 text-center">
        <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">

      {/* Panel header — same as Team Management cards */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded bg-[var(--primary-bg-hover)] flex items-center justify-center flex-shrink-0">
            <Building2 className="w-3.5 h-3.5 text-[var(--primary-text-muted)]" />
          </div>
          <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Company Profile
          </span>
        </div>
        <SaveIndicator state={saveState} />
      </div>

      <div className="px-5 py-5 space-y-5">

        {/* Logo */}
        <div>
          <p className={labelCls}>Company Logo</p>
          <div className="flex items-start gap-4">
            {form.logoUrl ? (
              <div className="relative flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={form.logoUrl}
                  alt="Company logo"
                  className="h-14 w-auto max-w-[140px] rounded-md border border-[var(--border)] object-contain bg-[var(--bg-subtle)] p-1"
                />
                <button
                  onClick={() => void handleLogoRemove()}
                  disabled={logoUploading}
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50"
                  aria-label="Remove logo"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={logoUploading}
                className="flex flex-col items-center justify-center gap-1.5 h-14 w-32 rounded-md border-2 border-dashed border-[var(--border)] text-[var(--text-faint)] hover:border-[var(--primary-action)] hover:text-[var(--primary-action)] transition-colors disabled:opacity-50"
              >
                {logoUploading ? (
                  <span className="inline-block h-4 w-4 rounded-full border-2 border-[var(--text-faint)] border-t-transparent animate-spin" />
                ) : (
                  <>
                    <Upload className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">Upload logo</span>
                  </>
                )}
              </button>
            )}
            <p className="mt-1 text-xs text-[var(--text-faint)] leading-relaxed">
              PNG, JPG or SVG · max 2 MB<br />
              Appears in PDF export headers
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => void handleLogoSelect(e)}
          />
        </div>

        {/* Divider */}
        <hr className="border-[var(--border)]" />

        {/* Company name + Website */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Company Name</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Acme Hardware Supply"
              value={form.companyName}
              onChange={handleFieldChange('companyName')}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <Globe className="h-3 w-3" />Website URL
              </span>
            </label>
            <input
              type="url"
              className={inputCls}
              placeholder="https://yourcompany.com"
              value={form.websiteUrl}
              onChange={handleFieldChange('websiteUrl')}
            />
          </div>
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <Mail className="h-3 w-3" />Email
              </span>
            </label>
            <input
              type="email"
              className={inputCls}
              placeholder="contact@yourcompany.com"
              value={form.email}
              onChange={handleFieldChange('email')}
            />
          </div>
          <div>
            <label className={labelCls}>
              <span className="inline-flex items-center gap-1">
                <Phone className="h-3 w-3" />Phone
              </span>
            </label>
            <input
              type="tel"
              className={inputCls}
              placeholder="+1 (555) 000-0000"
              value={form.phone}
              onChange={handleFieldChange('phone')}
            />
          </div>
        </div>

        {/* Address */}
        <div>
          <label className={labelCls}>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />Address
            </span>
          </label>
          <textarea
            rows={2}
            className={textareaCls}
            placeholder="123 Main Street"
            value={form.address}
            onChange={handleFieldChange('address')}
          />
        </div>

        {/* Province + Country */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Province / State</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Ontario"
              value={form.province}
              onChange={handleFieldChange('province')}
            />
          </div>
          <div>
            <label className={labelCls}>Country</label>
            <input
              type="text"
              className={inputCls}
              placeholder="Canada"
              value={form.country}
              onChange={handleFieldChange('country')}
            />
          </div>
        </div>

      </div>
    </div>
  );
}
