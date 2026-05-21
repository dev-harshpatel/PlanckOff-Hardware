'use client';

import React, { useEffect, useRef } from 'react';

const STEPS = [
  { label: 'Understanding request',  detail: 'Parsing uploaded files'           },
  { label: 'Reading door schedule',  detail: 'Connecting to Excel workbook'     },
  { label: 'Extracting hardware',    detail: 'Parsing PDF hardware data'         },
  { label: 'Merging data',           detail: 'Matching doors to hardware sets'  },
  { label: 'Resolving descriptions', detail: 'Computing door dimensions'        },
  { label: 'Saving project',         detail: 'Writing to database'              },
];

const ROW_HEIGHT = 54; // px — label + detail + padding
const MAX_VISIBLE = 4;

interface PipelineLoaderProps {
  /** 0–5 = active step index, 6 = complete, −1 = hidden */
  currentStep: number;
}

export function PipelineLoader({ currentStep }: PipelineLoaderProps) {
  const listRef = useRef<HTMLDivElement>(null);

  const isHidden   = currentStep < 0;
  const isComplete = currentStep >= STEPS.length;
  const visibleCount = isComplete
    ? STEPS.length
    : Math.min(currentStep + 1, STEPS.length);

  // After new step appears: scroll so latest row is always visible
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visibleCount]);

  if (isHidden) return null;

  const listMaxHeight = Math.min(visibleCount, MAX_VISIBLE) * ROW_HEIGHT;
  const headerLabel   = isComplete ? 'Processing complete' : `${STEPS[currentStep]?.label}…`;

  return (
    <div className="mx-5 mb-1 flex-shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] overflow-hidden animate-stepIn">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5">
        {isComplete ? (
          <svg className="w-3.5 h-3.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ) : (
          <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        <span className="text-xs font-semibold text-[var(--text-secondary)] tracking-wide">
          {headerLabel}
        </span>
      </div>

      {/* ── Divider ────────────────────────────────────────── */}
      <div className="border-t border-[var(--border-subtle)]" />

      {/* ── Steps list ─────────────────────────────────────── */}
      <div
        ref={listRef}
        className="overflow-hidden"
        style={{
          maxHeight: `${listMaxHeight}px`,
          transition: 'max-height 0.32s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {STEPS.slice(0, visibleCount).map((step, i) => {
          const isDone   = i < currentStep || isComplete;
          const isActive = i === currentStep && !isComplete;
          return (
            <div
              key={i}
              className="animate-stepIn flex items-start gap-2.5 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0"
            >
              {/* Status icon */}
              <div className="mt-0.5 w-4 h-4 flex-shrink-0">
                {isDone ? (
                  <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                ) : isActive ? (
                  <svg className="w-4 h-4 text-amber-500 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                    <path className="opacity-80" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <div className="w-3.5 h-3.5 mt-0.5 rounded-full border-2 border-[var(--border)]" />
                )}
              </div>

              {/* Text */}
              <div className="min-w-0">
                <p className={`text-xs font-medium leading-snug ${
                  isDone   ? 'text-[var(--text-secondary)]' :
                  isActive ? 'text-[var(--text)]'           :
                             'text-[var(--text-faint)]'
                }`}>
                  {step.label}
                </p>
                <p className="text-[11px] text-[var(--text-faint)] mt-0.5 leading-snug">
                  {step.detail}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
