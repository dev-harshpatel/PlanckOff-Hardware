'use client';

import React, { useState } from 'react';
import type { SubmittalMeta } from '@/lib/db/submittalMetadata';

const inputCls =
  'w-full px-3 py-1.5 border border-[var(--border)] rounded-md text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors';

const labelCls = 'block text-[11px] font-medium text-[var(--text-muted)] mb-1 uppercase tracking-wide';

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

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
  return <span className="text-xs font-semibold text-[var(--error-text)]">Save failed</span>;
}

interface SubmittalMetaFormProps {
  projectId:          string;
  defaultProjectName: string;
  defaultCompanyName: string;
  initialMeta:        SubmittalMeta;
  onSave:             (meta: SubmittalMeta) => void;
}

export default function SubmittalMetaForm({
  projectId,
  defaultProjectName,
  defaultCompanyName,
  initialMeta,
  onSave,
}: SubmittalMetaFormProps) {
  const [form, setForm] = useState<SubmittalMeta>(initialMeta);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  React.useEffect(() => {
    setForm(prev => ({
      ...initialMeta,
      projectName: initialMeta.projectName || prev.projectName || defaultProjectName,
      companyName: initialMeta.companyName || prev.companyName || defaultCompanyName,
    }));
  }, [initialMeta, defaultProjectName, defaultCompanyName]);

  function handleChange(field: keyof SubmittalMeta, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
    if (saveState !== 'idle') setSaveState('idle');
  }

  async function handleSave() {
    setSaveState('saving');
    try {
      const res = await fetch(`/api/projects/${projectId}/submittal-metadata`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('save failed');
      setSaveState('saved');
      onSave(form);
      setTimeout(() => setSaveState('idle'), 2500);
    } catch {
      setSaveState('error');
    }
  }

  const fields: Array<{ key: keyof SubmittalMeta; label: string; placeholder: string; note?: string }> = [
    { key: 'fromName',       label: 'From',         placeholder: 'Your name / company' },
    { key: 'toName',         label: 'To',           placeholder: 'Recipient' },
    { key: 'gcName',         label: 'GC Name',      placeholder: 'General Contractor' },
    { key: 'projectAddress', label: 'Address',      placeholder: 'Project site address' },
    { key: 'projectName',    label: 'Project Name', placeholder: defaultProjectName || 'Project name', note: 'auto-filled' },
    { key: 'companyName',    label: 'Company',      placeholder: defaultCompanyName || 'Company name', note: 'auto-filled' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
        Submittal Details
      </p>

      <div className="flex flex-col gap-3">
        {fields.map(({ key, label, placeholder, note }) => (
          <div key={key}>
            <label className={labelCls}>
              {label}
              {note && <span className="ml-1 font-normal normal-case tracking-normal text-[var(--text-faint)]">({note})</span>}
            </label>
            <input
              className={inputCls}
              value={(form[key] as string) ?? ''}
              onChange={e => handleChange(key, e.target.value)}
              placeholder={placeholder}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="w-full px-3 py-1.5 rounded-md text-xs font-semibold bg-[var(--primary-action)] text-white hover:bg-[var(--primary-action-hover)] disabled:opacity-60 transition-colors"
        >
          Save
        </button>
        <SaveIndicator state={saveState} />
      </div>
    </div>
  );
}
