'use client';

import React from 'react';
import type { ProcessingLogEntry } from '@/contexts/ProcessingWidgetContext';

interface LiveLogTickerProps {
  log: ProcessingLogEntry | null;
  fallback: string;
}

const LEVEL_TEXT: Record<ProcessingLogEntry['level'], string> = {
  success: 'text-green-600 dark:text-green-400',
  warn: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-[var(--text-faint)]',
};

/** Single line that fades/slides in fresh whenever the latest log message changes. */
export function LiveLogTicker({ log, fallback }: LiveLogTickerProps) {
  const text = log?.msg ?? fallback;
  const colorClass = log ? LEVEL_TEXT[log.level] : 'text-[var(--text-faint)]';

  return (
    <p key={text} className={`text-[11px] mt-0.5 leading-snug animate-fadeIn truncate ${colorClass}`}>
      {text}
    </p>
  );
}
