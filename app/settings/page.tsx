'use client';

import { Settings } from 'lucide-react';
import { CompanySettingsForm } from '@/components/CompanySettingsForm';

export default function SettingsPage() {
  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

      {/* Page header — matches Dashboard / Team Management banner */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--primary-bg-hover)] flex items-center justify-center flex-shrink-0">
            <Settings className="w-4 h-4 text-[var(--primary-text-muted)]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[var(--text)] leading-tight">Settings</h1>
            <p className="text-xs text-[var(--primary-text-muted)]">
              Company branding and contact details used across all PDF exports
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto px-6 py-5">
        <div className="max-w-2xl">
          <CompanySettingsForm />
        </div>
      </div>

    </div>
  );
}
