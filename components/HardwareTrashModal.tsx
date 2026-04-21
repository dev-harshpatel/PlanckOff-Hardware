'use client';

import React, { useState } from 'react';
import { Trash2, Undo2, X, Package, DoorOpen, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TrashItem } from '@/lib/db/hardware';

interface HardwareTrashModalProps {
  isOpen: boolean;
  onClose: () => void;
  trashItems: TrashItem[];
  onRestore: (itemId: string) => void;
  onPermanentDelete: (itemId: string) => void;
  onClearAll: () => void;
}

function formatRelativeTime(isoString: string): string {
  const ms = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(ms / 60_000);
  const hours = Math.floor(ms / 3_600_000);
  const days = Math.floor(ms / 86_400_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

const HardwareTrashModal: React.FC<HardwareTrashModalProps> = ({
  isOpen,
  onClose,
  trashItems,
  onRestore,
  onPermanentDelete,
  onClearAll,
}) => {
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  if (!isOpen) return null;

  const sets = trashItems.filter((i) => i.type === 'set');
  const doors = trashItems.filter((i) => i.type === 'door');

  const handleClearAll = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      return;
    }
    onClearAll();
    setConfirmClearAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl bg-[var(--bg)] border border-[var(--border)] rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] shrink-0">
          <div className="flex items-center gap-2.5">
            <Trash2 className="h-5 w-5 text-[var(--text-muted)]" />
            <h2 className="text-base font-semibold text-[var(--text)]">Trash</h2>
            {trashItems.length > 0 && (
              <span className="text-xs bg-[var(--bg-subtle)] text-[var(--text-secondary)] px-2 py-0.5 rounded-full">
                {trashItems.length} item{trashItems.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {trashItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-[var(--text-muted)]">
              <Trash2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">Trash is empty</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Hardware Sets */}
              {sets.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Hardware Sets ({sets.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {sets.map((item) => (
                      <TrashRow
                        key={item.id}
                        item={item}
                        onRestore={onRestore}
                        onPermanentDelete={onPermanentDelete}
                      />
                    ))}
                  </div>
                </section>
              )}

              {/* Standalone Doors */}
              {doors.length > 0 && (
                <section>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] mb-2">
                    Doors ({doors.length})
                  </h3>
                  <div className="flex flex-col gap-2">
                    {doors.map((item) => (
                      <TrashRow
                        key={item.id}
                        item={item}
                        onRestore={onRestore}
                        onPermanentDelete={onPermanentDelete}
                      />
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {trashItems.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border)] shrink-0">
            <p className="text-xs text-[var(--text-muted)]">
              Restored items return to the project and are saved immediately.
            </p>
            <div className="flex items-center gap-2">
              {confirmClearAll && (
                <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  This cannot be undone
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className={confirmClearAll
                  ? 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950'
                  : 'text-[var(--text-secondary)]'}
              >
                {confirmClearAll ? 'Confirm — Delete All' : 'Empty Trash'}
              </Button>
              {confirmClearAll && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClearAll(false)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TrashRow: React.FC<{
  item: TrashItem;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}> = ({ item, onRestore, onPermanentDelete }) => {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemCount = item.type === 'set'
    ? item.setData?.hardwareItems?.length ?? 0
    : 0;
  const doorCount = item.type === 'set'
    ? item.setData?.doors?.length ?? 0
    : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border)] group">
      {/* Icon */}
      <div className="shrink-0 text-[var(--text-muted)]">
        {item.type === 'set'
          ? <Package className="h-4 w-4" />
          : <DoorOpen className="h-4 w-4" />}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--text)] truncate">{item.setName}</p>
        <p className="text-xs text-[var(--text-muted)]">
          {item.type === 'set'
            ? `${itemCount} item${itemCount !== 1 ? 's' : ''} · ${doorCount} door${doorCount !== 1 ? 's' : ''} · deleted ${formatRelativeTime(item.deletedAt)}`
            : `Door · deleted ${formatRelativeTime(item.deletedAt)}`}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => { setConfirmDelete(false); onRestore(item.id); }}
          className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950"
        >
          <Undo2 className="h-3.5 w-3.5" />
          Restore
        </Button>

        {confirmDelete ? (
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPermanentDelete(item.id)}
              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmDelete(false)}
              className="text-xs text-[var(--text-muted)]"
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmDelete(true)}
            className="text-xs text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default HardwareTrashModal;
