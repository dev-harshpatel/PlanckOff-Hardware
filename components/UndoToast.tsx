'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Undo2, X } from 'lucide-react';

export interface UndoToastItem {
  id: string;
  label: string;       // e.g. "Set "AD01b" deleted" or "3 sets deleted"
  onUndo: () => void;
  onConfirm: () => void; // called after timeout — moves item to trash
  durationMs?: number; // default 6000
}

interface UndoToastProps {
  items: UndoToastItem[];
  onDismiss: (id: string) => void;
}

const SINGLE_TOAST_DURATION = 6000;

const UndoToastEntry: React.FC<{
  item: UndoToastItem;
  onDismiss: (id: string) => void;
}> = ({ item, onDismiss }) => {
  const duration = item.durationMs ?? SINGLE_TOAST_DURATION;
  const [remaining, setRemaining] = useState(duration);
  const startedAt = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const confirmedRef = useRef(false);

  useEffect(() => {
    // Countdown display
    intervalRef.current = setInterval(() => {
      setRemaining(Math.max(0, duration - (Date.now() - startedAt.current)));
    }, 50);

    // Confirm timer
    timerRef.current = setTimeout(() => {
      if (!confirmedRef.current) {
        confirmedRef.current = true;
        item.onConfirm();
        onDismiss(item.id);
      }
    }, duration);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    item.onUndo();
    onDismiss(item.id);
  };

  const handleDismiss = () => {
    if (confirmedRef.current) return;
    confirmedRef.current = true;
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    item.onConfirm();
    onDismiss(item.id);
  };

  const progress = remaining / duration; // 1 → 0

  return (
    <div className="flex items-center gap-3 bg-[var(--bg-muted)] border border-[var(--border)] rounded-lg shadow-lg px-4 py-3 min-w-[300px] max-w-[420px] relative overflow-hidden">
      {/* Countdown progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] bg-amber-500 transition-none"
        style={{ width: `${progress * 100}%` }}
      />

      <span className="flex-1 text-sm text-[var(--text)]">{item.label}</span>

      <button
        onClick={handleUndo}
        className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 whitespace-nowrap shrink-0 transition-colors"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Undo
      </button>

      <button
        onClick={handleDismiss}
        className="text-[var(--text-muted)] hover:text-[var(--text)] shrink-0 transition-colors"
        title="Dismiss — move to trash"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const UndoToast: React.FC<UndoToastProps> = ({ items, onDismiss }) => {
  if (items.length === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <UndoToastEntry item={item} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
};

export default UndoToast;
