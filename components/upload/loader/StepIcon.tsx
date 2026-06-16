'use client';

import React from 'react';

export type StepStatus = 'pending' | 'active' | 'done';

interface StepIconProps {
  status: StepStatus;
  size?: 'sm' | 'md';
}

/** Status icon that crossfades between pending/active/done instead of swapping instantly. */
export function StepIcon({ status, size = 'md' }: StepIconProps) {
  const dim = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div className={`${dim} flex-shrink-0 relative`}>
      <div key={status} className="absolute inset-0 animate-scaleIn">
        {status === 'done' ? (
          <svg className={`${dim} text-green-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : status === 'active' ? (
          <svg className={`${dim} text-amber-500 animate-spin`} fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <div className={`${dim} rounded-full border-2 border-[var(--border)]`} />
        )}
      </div>
    </div>
  );
}
