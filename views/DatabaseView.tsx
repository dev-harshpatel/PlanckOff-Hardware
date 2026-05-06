'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Search,
  Download,
  Plus,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Database,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
  ClipboardCheck,
} from 'lucide-react';
import type { RoleName } from '@/types/auth';
import type { MasterHardwareItem, MasterHardwarePending } from '@/lib/db/masterHardware';
import { MasterItemFormModal } from '../components/settings/MasterItemFormModal';
import { DatabaseSkeleton } from '@/components/skeletons/DatabaseSkeleton';
import { PendingReviewModal } from '../components/projects/PendingReviewModal';

type SortKey = keyof Pick<MasterHardwareItem, 'name' | 'manufacturer' | 'description' | 'finish'>;
type SortDir = 'asc' | 'desc';

interface DatabaseViewProps {
  userRole: RoleName;
  addToast: (toast: { type: string; message: string; details?: string }) => void;
}

const DatabaseView: React.FC<DatabaseViewProps> = ({ userRole, addToast }) => {
  const canEdit = userRole === 'Administrator' || userRole === 'Team Lead';

  // --- data state ---
  const [items, setItems] = useState<MasterHardwareItem[]>([]);
  const [pending, setPending] = useState<MasterHardwarePending[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingLoadError, setPendingLoadError] = useState<string | null>(null);

  // --- ui state ---
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDir }>({ key: 'name', direction: 'asc' });
  const [editingItem, setEditingItem] = useState<MasterHardwareItem | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // --- load data ---
  const loadItems = useCallback(async () => {
    try {
      const res = await fetch('/api/master-hardware', { credentials: 'include' });
      const json = await res.json() as { data?: MasterHardwareItem[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to load database.');
      setItems(json.data ?? []);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load.');
    }
  }, []);

  const loadPending = useCallback(async () => {
    try {
      const res = await fetch('/api/master-hardware/pending', { credentials: 'include' });
      const json = await res.json() as { data?: MasterHardwarePending[]; error?: string };
      if (res.ok) {
        setPending(json.data ?? []);
        setPendingLoadError(null);
      } else {
        const message = json.error ?? 'Failed to load pending review items.';
        setPendingLoadError(message);
        console.warn('[DatabaseView] loadPending failed:', message);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load pending review items.';
      setPendingLoadError(message);
      console.warn('[DatabaseView] loadPending error:', err);
    }
  }, []);

  useEffect(() => {
    if (pendingLoadError) {
      addToast({
        type: 'warning',
        message: 'Pending review items could not be loaded.',
        details: pendingLoadError,
      });
    }
  }, [pendingLoadError, addToast]);

  useEffect(() => {
    setIsLoading(true);
    Promise.all([loadItems(), loadPending()]).finally(() => setIsLoading(false));
  }, [loadItems, loadPending]);

  // --- sort + filter ---
  const filtered = useMemo(() => {
    let result = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.manufacturer.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.finish.toLowerCase().includes(q),
      );
    }
    result.sort((a, b) => {
      const va = (a[sortConfig.key] ?? '').toString().toLowerCase();
      const vb = (b[sortConfig.key] ?? '').toString().toLowerCase();
      if (va < vb) return sortConfig.direction === 'asc' ? -1 : 1;
      if (va > vb) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [items, searchQuery, sortConfig]);

  const handleSort = (key: SortKey) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  // --- CSV export ---
  const handleExportCSV = () => {
    const cols: (keyof MasterHardwareItem)[] = ['name', 'manufacturer', 'description', 'finish'];
    const header = cols.join(',');
    const rows = items.map(i =>
      cols.map(c => `"${String(i[c] ?? '').replace(/"/g, '""')}"`).join(','),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `master-hardware-database-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast({ type: 'success', message: 'Database exported to CSV.' });
  };

  // --- Create ---
  const handleOpenCreate = () => {
    setEditingItem(null);
    setIsFormOpen(true);
  };

  // --- Edit ---
  const handleOpenEdit = (item: MasterHardwareItem) => {
    setEditingItem(item);
    setIsFormOpen(true);
  };

  const handleFormSave = async (payload: {
    name: string; manufacturer: string; description: string; finish: string; modelNumber: string;
  }) => {
    if (editingItem) {
      const res = await fetch(`/api/master-hardware/${editingItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: MasterHardwareItem; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Update failed.');
      setItems(prev => prev.map(i => i.id === editingItem.id ? json.data! : i));
      addToast({ type: 'success', message: 'Item updated.' });
    } else {
      const res = await fetch('/api/master-hardware', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const json = await res.json() as { data?: MasterHardwareItem; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Create failed.');
      setItems(prev => [...prev, json.data!]);
      addToast({ type: 'success', message: 'Item added to database.' });
    }
    setIsFormOpen(false);
    setEditingItem(null);
  };

  // --- Delete ---
  const handleDelete = async (id: string) => {
    if (!confirm('Delete this item from the master database?')) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/master-hardware/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const json = await res.json() as { error?: string };
        throw new Error(json.error ?? 'Delete failed.');
      }
      setItems(prev => prev.filter(i => i.id !== id));
      addToast({ type: 'success', message: 'Item deleted.' });
    } catch (err) {
      addToast({ type: 'error', message: err instanceof Error ? err.message : 'Delete failed.' });
    } finally {
      setDeletingId(null);
    }
  };

  // --- Approval ---
  const handleReview = async (ids: string[], action: 'approve' | 'reject') => {
    const res = await fetch('/api/master-hardware/pending/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ids, action }),
    });
    const json = await res.json() as { data?: { processed: number }; error?: string };
    if (!res.ok) throw new Error(json.error ?? 'Review failed.');

    // Remove processed items from pending list
    setPending(prev => prev.filter(p => !ids.includes(p.id)));

    if (action === 'approve') {
      // Reload approved items into master list
      await loadItems();
      addToast({ type: 'success', message: `${json.data?.processed ?? ids.length} item(s) approved and added to database.` });
    } else {
      addToast({ type: 'info', message: `${json.data?.processed ?? ids.length} item(s) rejected.` } as never);
    }

    // Close modal if no more pending
    if (pending.length - ids.length <= 0) setIsReviewOpen(false);
  };

  // --- Sort icon ---
  const SortIcon: React.FC<{ col: SortKey }> = ({ col }) => {
    if (sortConfig.key !== col) return <ChevronsUpDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-40 flex-shrink-0" />;
    return sortConfig.direction === 'asc'
      ? <ChevronUp className="w-3 h-3 ml-1 text-[var(--primary-text-muted)] flex-shrink-0" />
      : <ChevronDown className="w-3 h-3 ml-1 text-[var(--primary-text-muted)] flex-shrink-0" />;
  };

  const th = (label: string, key: SortKey) => (
    <th
      key={key}
      scope="col"
      className="px-4 py-2.5 cursor-pointer hover:bg-[var(--primary-bg-hover)] group select-none border-b border-[var(--primary-border)]"
      onClick={() => handleSort(key)}
    >
      <div className="flex items-center text-[10px] font-semibold text-[var(--primary-text)] uppercase tracking-wider">
        {label}
        <SortIcon col={key} />
      </div>
    </th>
  );

  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">

      {/* Page header */}
      <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-[var(--primary-bg-hover)] flex items-center justify-center flex-shrink-0">
            <Database className="w-4 h-4 text-[var(--primary-text-muted)]" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-[var(--text)] leading-tight">Master Hardware Database</h1>
            <p className="text-xs text-[var(--primary-text-muted)]">Approved hardware products across all projects</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Pending badge */}
            {pending.length > 0 && (
              <button
                onClick={() => setIsReviewOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-400/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span className="text-xs font-semibold">{pending.length} pending review</span>
              </button>
            )}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[var(--primary-border)] bg-[var(--bg)]">
              <span className="text-xs text-[var(--text-muted)] font-medium">Items</span>
              <span className="text-xs font-bold text-[var(--primary-text)]">{items.length}</span>
            </div>
            {!canEdit && (
              <span className="text-[10px] font-medium text-[var(--text-faint)] italic px-2 py-1 bg-[var(--bg)] border border-[var(--border)] rounded-md">Read-only</span>
            )}
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, manufacturer, finish…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-faint)]"
          />
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-subtle)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          {canEdit && (
            <button
              onClick={handleOpenCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)] rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Create Item
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-grow overflow-hidden flex flex-col mx-6 my-5 rounded-xl border border-[var(--border)] bg-[var(--bg)]">

        {/* Loading / error states */}
        {isLoading && <DatabaseSkeleton />}

        {!isLoading && loadError && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <AlertTriangle className="w-8 h-8 text-amber-500" />
            <p className="text-sm text-[var(--text-muted)]">{loadError}</p>
            <button
              onClick={() => { setIsLoading(true); Promise.all([loadItems(), loadPending()]).finally(() => setIsLoading(false)); }}
              className="text-xs text-[var(--primary-text-muted)] hover:underline"
            >
              Retry
            </button>
          </div>
        )}

        {!isLoading && !loadError && (
          <>
            <div className="overflow-auto flex-grow">
              <table className="w-full text-sm text-left">
                <thead className="bg-[var(--primary-bg)] sticky top-0 z-10">
                  <tr>
                    {th('Item Name', 'name')}
                    {th('Manufacturer', 'manufacturer')}
                    {th('Description', 'description')}
                    {th('Finish', 'finish')}
                    {canEdit && (
                      <th scope="col" className="px-4 py-2.5 text-center w-20 border-b border-[var(--primary-border)]">
                        <span className="text-[10px] font-semibold text-[var(--primary-text)] uppercase tracking-wider">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)]">
                  {filtered.map(item => (
                    <tr key={item.id} className="hover:bg-[var(--bg-subtle)] transition-colors group">
                      <td className="px-4 py-2.5 font-medium text-[var(--text)] align-middle max-w-[200px]">
                        <span className="truncate block" title={item.name}>{item.name || <span className="text-[var(--text-faint)] italic text-xs">—</span>}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)] align-middle max-w-[140px]">
                        <span className="truncate block">{item.manufacturer || <span className="text-[var(--text-faint)] italic text-xs">—</span>}</span>
                      </td>
                      <td className="px-4 py-2.5 text-[var(--text-muted)] align-middle max-w-[260px]">
                        <span className="truncate block" title={item.description}>{item.description || <span className="text-[var(--text-faint)] italic text-xs">—</span>}</span>
                      </td>
                      <td className="px-4 py-2.5 align-middle">
                        {item.finish
                          ? <span className="font-mono text-xs bg-[var(--bg-muted)] px-1.5 py-0.5 rounded border border-[var(--border)] text-[var(--text-secondary)]">{item.finish}</span>
                          : <span className="text-[var(--text-faint)] italic text-xs">—</span>
                        }
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2.5 align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-[var(--primary-text)] hover:bg-[var(--primary-bg)] transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              disabled={deletingId === item.id}
                              className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              {deletingId === item.id
                                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={canEdit ? 5 : 4} className="text-center py-16 text-[var(--text-faint)]">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">
                          {searchQuery
                            ? `No items match "${searchQuery}"`
                            : 'No items in the master database yet. Upload a hardware PDF to get started.'}
                        </p>
                        {searchQuery && (
                          <button onClick={() => setSearchQuery('')} className="mt-1 text-xs text-[var(--primary-text-muted)] hover:underline">
                            Clear search
                          </button>
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            <div className="bg-[var(--bg-subtle)] border-t border-[var(--border)] px-4 py-2.5 flex items-center justify-between flex-shrink-0 rounded-b-xl">
              <span className="text-xs text-[var(--text-muted)]">
                Showing <span className="font-medium text-[var(--text-secondary)]">{filtered.length}</span> of <span className="font-medium text-[var(--text-secondary)]">{items.length}</span> items
              </span>
              {searchQuery && filtered.length !== items.length && (
                <button onClick={() => setSearchQuery('')} className="text-xs text-[var(--primary-text-muted)] hover:underline">
                  Clear filter
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Modals */}
      <MasterItemFormModal
        isOpen={isFormOpen}
        item={editingItem}
        onClose={() => { setIsFormOpen(false); setEditingItem(null); }}
        onSave={handleFormSave}
      />

      <PendingReviewModal
        isOpen={isReviewOpen}
        items={pending}
        onClose={() => setIsReviewOpen(false)}
        onReview={handleReview}
      />
    </div>
  );
};

export default DatabaseView;
