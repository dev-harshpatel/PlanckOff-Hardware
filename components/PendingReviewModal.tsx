'use client';

import React, { useState } from 'react';
import { X, CheckCircle2, XCircle, ClipboardCheck } from 'lucide-react';
import type { MasterHardwarePending } from '@/lib/db/masterHardware';
import { Button } from '@/components/ui/button';

interface PendingReviewModalProps {
  isOpen: boolean;
  items: MasterHardwarePending[];
  onClose: () => void;
  onReview: (ids: string[], action: 'approve' | 'reject') => Promise<void>;
}

export const PendingReviewModal: React.FC<PendingReviewModalProps> = ({
  isOpen,
  items,
  onClose,
  onReview,
}) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionAction, setSubmissionAction] = useState<'approve' | 'reject' | null>(null);

  if (!isOpen) return null;

  const allSelected = selected.size === items.length && items.length > 0;

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)));
  };

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAction = async (action: 'approve' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setIsSubmitting(true);
    setSubmissionAction(action);
    try {
      await onReview(ids, action);
      setSelected(new Set());
    } finally {
      setIsSubmitting(false);
      setSubmissionAction(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-[var(--border-subtle)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--primary-bg)] rounded-t-xl flex-shrink-0">
          <div className="p-1.5 rounded-lg bg-[var(--primary-bg-hover)]">
            <ClipboardCheck className="w-4 h-4 text-[var(--primary-text-muted)]" />
          </div>
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-[var(--text)]">Pending Approval</h2>
            <p className="text-xs text-[var(--text-faint)] mt-0.5">
              {items.length} new {items.length === 1 ? 'item' : 'items'} extracted from PDFs — review before adding to master database.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-[var(--bg-subtle)] sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {['Item Name', 'Manufacturer', 'Description', 'Finish', 'Source'].map(h => (
                  <th key={h} className="px-3 py-2.5 text-left text-[10px] font-semibold text-[var(--text-faint)] uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {items.map(item => (
                <tr
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  className={`cursor-pointer transition-colors ${selected.has(item.id) ? 'bg-[var(--primary-bg)]' : 'hover:bg-[var(--bg-subtle)]'}`}
                >
                  <td className="px-4 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggle(item.id)}
                      onClick={e => e.stopPropagation()}
                      className="rounded"
                    />
                  </td>
                  <td className="px-3 py-2.5 font-medium text-[var(--text)] max-w-[180px]">
                    <span className="truncate block" title={item.name}>{item.name || <span className="text-[var(--text-faint)] italic">—</span>}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-muted)] max-w-[140px]">
                    <span className="truncate block">{item.manufacturer || <span className="text-[var(--text-faint)] italic text-xs">—</span>}</span>
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-muted)] max-w-[200px]">
                    <span className="truncate block" title={item.description}>{item.description || <span className="text-[var(--text-faint)] italic text-xs">—</span>}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {item.finish
                      ? <span className="font-mono text-xs bg-[var(--bg-muted)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">{item.finish}</span>
                      : <span className="text-[var(--text-faint)] italic text-xs">—</span>
                    }
                  </td>
                  <td className="px-3 py-2.5 text-[var(--text-faint)] text-xs max-w-[120px]">
                    <span className="truncate block" title={item.sourceFileName ?? ''}>{item.sourceFileName ?? '—'}</span>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--text-faint)] text-sm">
                    No items pending review.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3.5 border-t border-[var(--border)] bg-[var(--bg-subtle)] rounded-b-xl flex-shrink-0 gap-3">
          <span className="text-xs text-[var(--text-muted)]">
            {selected.size > 0
              ? `${selected.size} of ${items.length} selected`
              : 'Select items to approve or reject'}
          </span>
          <div className="flex items-center gap-2">
            {items.length > 0 && selected.size === 0 && (
              <button
                onClick={toggleAll}
                className="text-xs text-[var(--primary-text-muted)] hover:underline"
              >
                Select all
              </button>
            )}
            <Button
              onClick={() => handleAction('reject')}
              disabled={selected.size === 0 || isSubmitting}
              variant="outline"
              size="sm"
              loading={isSubmitting && submissionAction === 'reject'}
              loadingText="Rejecting..."
              className="text-xs text-red-600 border-red-400/40 hover:bg-red-500/10 hover:text-red-700"
            >
              <XCircle className="w-3.5 h-3.5" />
              Reject
            </Button>
            <Button
              onClick={() => handleAction('approve')}
              disabled={selected.size === 0 || isSubmitting}
              size="sm"
              loading={isSubmitting && submissionAction === 'approve'}
              loadingText="Approving..."
              className="text-xs"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Approve & Add to Database
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
