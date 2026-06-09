'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

type PasswordInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'>;

export function PasswordInput({ className = '', ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={`block w-full rounded-md border border-[var(--border-strong)] bg-[var(--bg)] px-3 py-2 pr-10 text-sm text-[var(--text)] placeholder-[var(--text-faint)] focus:border-[var(--primary-ring)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] ${className}`}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-[var(--text-muted)] hover:text-[var(--text)] focus:outline-none"
        tabIndex={-1}
        aria-label={visible ? 'Hide password' : 'Show password'}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
