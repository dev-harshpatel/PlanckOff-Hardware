'use client';

import React from 'react';

interface ShimmerTextProps {
  children: React.ReactNode;
  className?: string;
}

/** Animated gradient sweep over text — the "thinking" look used by v0.dev / Bolt loaders. */
export function ShimmerText({ children, className = '' }: ShimmerTextProps) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent animate-text-shimmer ${className}`}
      style={{
        backgroundImage: 'linear-gradient(90deg, var(--text-faint) 0%, var(--text-faint) 35%, var(--text) 50%, var(--text-faint) 65%, var(--text-faint) 100%)',
        backgroundSize: '200% 100%',
      }}
    >
      {children}
    </span>
  );
}
