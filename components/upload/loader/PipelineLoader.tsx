'use client';

import React, { useEffect, useRef } from 'react';
import type { ProcessingLogEntry } from '@/contexts/ProcessingWidgetContext';
import { StepIcon } from './StepIcon';
import { ShimmerText } from './ShimmerText';
import { LiveLogTicker } from './LiveLogTicker';

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
  /** Most recent entry drives the active step's live detail line. */
  logs?: ProcessingLogEntry[];
}

export function PipelineLoader({ currentStep, logs = [] }: PipelineLoaderProps) {
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
  const latestLog = logs.length > 0 ? logs[logs.length - 1] : null;

  return (
    <div className="mx-5 mb-1 flex-shrink-0 rounded-xl border border-[var(--border)] bg-[var(--bg-subtle)] overflow-hidden animate-stepIn">
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
          const status   = isDone ? 'done' : isActive ? 'active' : 'pending';
          return (
            <div
              key={i}
              className="animate-stepIn flex items-start gap-2.5 px-4 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0"
            >
              <div className="mt-0.5">
                <StepIcon status={status} />
              </div>

              <div className="min-w-0 flex-1">
                <p className={`text-xs font-medium leading-snug ${
                  isDone   ? 'text-[var(--text-secondary)]' :
                  isActive ? 'text-[var(--text)]'           :
                             'text-[var(--text-faint)]'
                }`}>
                  {isActive ? <ShimmerText>{step.label}</ShimmerText> : step.label}
                </p>
                {/* Active step's detail line doubles as the live narrative — swaps in as new events land */}
                {isActive ? (
                  <LiveLogTicker log={latestLog} fallback={step.detail} />
                ) : (
                  <p className="text-[11px] text-[var(--text-faint)] mt-0.5 leading-snug">
                    {step.detail}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
