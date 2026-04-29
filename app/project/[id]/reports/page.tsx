'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useProject } from '@/contexts/ProjectContext';
import { validateProject } from '@/utils/doorValidation';
import { FileSpreadsheet, Settings2, Package, DollarSign, ArrowLeft } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import type { Door } from '@/types';

const REPORT_CARDS: {
  id: string;
  route: string;
  label: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
  actionLabel: string;
}[] = [
  {
    id: 'door-schedule',
    route: 'door-schedule',
    label: 'Door Schedule Report',
    description: 'Export comprehensive door data with full customization. Choose from 30+ fields including dimensions, materials, fire ratings, and hardware assignments.',
    features: ['30+ customizable columns', 'Excel, PDF, or CSV export', 'Professional formatting & summaries'],
    icon: <FileSpreadsheet className="h-6 w-6" />,
    actionLabel: 'Configure & Export',
  },
  {
    id: 'hardware-set',
    route: 'hardware-set',
    label: 'Hardware Set Report',
    description: 'Export hardware items with usage tracking. See which door tags use each item, perfect for procurement and cost analysis.',
    features: ['Usage / location tracking', 'Cross-referencing & grouping', 'Procurement planning'],
    icon: <Settings2 className="h-6 w-6" />,
    actionLabel: 'Configure & Export',
  },
  {
    id: 'submittal-package',
    route: 'submittal-package',
    label: 'Submittal Package',
    description: 'Generate a professional submittal package including Cover Page, Door Schedule, Hardware Sets, Frame Details, and Elevation Drawings.',
    features: ['Door Schedule', 'Hardware Sets', 'Frame Details & Elevations'],
    icon: <Package className="h-6 w-6" />,
    actionLabel: 'Start Submittal',
  },
  {
    id: 'pricing',
    route: 'pricing',
    label: 'Pricing Report',
    description: 'Generate a detailed pricing breakdown for hardware sets and door schedules including unit costs, extended pricing, and budget summaries.',
    features: ['Unit & extended pricing', 'Budget summaries', 'Cost by hardware set'],
    icon: <DollarSign className="h-6 w-6" />,
    actionLabel: 'Configure & Export',
  },
];

export default function ReportsPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { projects } = useProject();
  const [loadingCard, setLoadingCard] = useState<string | null>(null);

  const activeProject = projects.find((p) => p.id === id);
  if (!activeProject) return null;

  const doors = activeProject.doors ?? [];

  const handleCardClick = (route: string) => {
    if (loadingCard) return;
    if (route === 'submittal-package') {
      validateProject(doors);
      // Still navigate — submittal page handles validation display
    }
    setLoadingCard(route);
    router.push(`/project/${id}/reports/${route}`);
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-[var(--text)]">Select Report Type</h2>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">Choose a report to configure and export.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORT_CARDS.map((card) => {
          const isLoading = loadingCard === card.route;
          const isDisabled = loadingCard !== null && !isLoading;
          return (
          <button
            key={card.id}
            onClick={() => handleCardClick(card.route)}
            disabled={isDisabled}
            className="text-left cursor-pointer bg-[var(--bg)] border border-[var(--border)] rounded-md hover:border-[var(--primary-border)] hover:shadow-sm transition-all group flex flex-col overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {/* Icon + badge */}
            <div className="px-5 pt-5 pb-4 flex items-start justify-between">
              <div className="h-10 w-10 rounded-md bg-[var(--primary-bg)] flex items-center justify-center text-[var(--primary-text-muted)] group-hover:bg-[var(--primary-bg-hover)] transition-colors flex-shrink-0">
                {isLoading ? <Spinner size="md" className="text-[var(--primary-text-muted)]" /> : card.icon}
              </div>
              {/* badge temporarily hidden */}
            </div>

            {/* Body */}
            <div className="px-5 pb-4 flex-1">
              <h3 className="text-sm font-semibold text-[var(--text)] mb-1.5">{card.label}</h3>
              <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">{card.description}</p>
              <ul className="space-y-1.5">
                {card.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-dot)] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Footer */}
            <div className="border-t border-[var(--border)] bg-[var(--primary-bg)] px-5 py-3 flex items-center justify-between group-hover:bg-[var(--primary-bg-hover)] transition-colors">
              <span className="text-xs font-semibold text-[var(--primary-text)]">
                {isLoading ? 'Opening…' : card.actionLabel}
              </span>
              {isLoading
                ? <Spinner size="xs" className="text-[var(--primary-text)]" />
                : <ArrowLeft className="h-3.5 w-3.5 text-[var(--primary-text)] rotate-180" />
              }
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}
