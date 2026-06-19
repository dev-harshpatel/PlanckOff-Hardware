'use client';

import React from 'react';

export type StepStatus = 'pending' | 'active' | 'done';

interface StepIconProps {
  status: StepStatus;
  size?: 'sm' | 'md';
}

/** Filled status circle — green check when done, spinning dot when active, hollow ring when pending. */
export function StepIcon({ status, size = 'md' }: StepIconProps) {
  const dim = size === 'sm' ? 'w-[18px] h-[18px]' : 'w-5 h-5';

  return (
    <div
      key={status}
      className={`${dim} flex-shrink-0 rounded-full flex items-center justify-center transition-colors duration-300 animate-scaleIn ${
        status === 'done'
          ? 'bg-emerald-500'
          : status === 'active'
            ? 'bg-[var(--primary-action)]'
            : 'bg-[var(--bg-muted)] border-2 border-[var(--border)]'
      }`}
    >
      {status === 'done' ? (
        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
        </svg>
      ) : status === 'active' ? (
        <svg className="w-3 h-3 text-white animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
          <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      ) : null}
    </div>
  );
}
