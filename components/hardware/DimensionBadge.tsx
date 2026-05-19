'use client';

import React from 'react';
import { Ruler } from 'lucide-react';
import { resolveDimension } from '@/utils/dimensionRules';
import type { Door } from '@/types';

interface DimensionBadgeProps {
  /** Hardware item category name, e.g. "Gasketing", "Kick Plate" */
  itemName: string;
  /** The door whose width/height are used to compute the dimension */
  door: Door;
  /** True when the door is a pair (leafCount > 1) — affects Kick Plate and Sensor rules */
  isPair?: boolean;
}

/**
 * Renders a small inline badge showing the calculated dimension for
 * dimension-sensitive hardware items (Gasketing, Kick Plate, Continuous
 * Hinge, etc.). Returns null when the item type has no matching rule or the
 * door is missing dimensions — so it is always safe to render unconditionally.
 */
export function DimensionBadge({ itemName, door, isPair = false }: DimensionBadgeProps) {
  const result = resolveDimension(itemName, door, isPair);
  if (!result) return null;

  return (
    <span
      className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-[var(--primary-bg)] text-[var(--primary-text)] border border-[var(--primary-border)] whitespace-nowrap align-middle"
      title={`Dimension rule: ${result.rule}`}
    >
      <Ruler className="w-2.5 h-2.5 flex-shrink-0" />
      {result.value}
    </span>
  );
}
