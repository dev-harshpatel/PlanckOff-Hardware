'use client';

import React, { useState, useEffect } from 'react';
import { X, Package } from 'lucide-react';
import type { MasterHardwareItem } from '@/lib/db/masterHardware';
import { Button } from '@/components/ui/button';
import { ERRORS } from '@/constants/errors';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';

interface MasterItemFormModalProps {
  isOpen: boolean;
  item?: MasterHardwareItem | null;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    manufacturer: string;
    description: string;
    finish: string;
    modelNumber: string;
  }) => Promise<void>;
}

const inputCls =
  'w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors';

const labelCls = 'block text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1';

export const MasterItemFormModal: React.FC<MasterItemFormModalProps> = ({
  isOpen,
  item,
  onClose,
  onSave,
}) => {
  const isEdit = !!item;

  const [name, setName] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [description, setDescription] = useState('');
  const [finish, setFinish] = useState('');
  const [modelNumber, setModelNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(item?.name ?? '');
      setManufacturer(item?.manufacturer ?? '');
      setDescription(item?.description ?? '');
      setFinish(item?.finish ?? '');
      setModelNumber(item?.modelNumber ?? '');
      setError(null);
    }
  }, [isOpen, item]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError(ERRORS.GENERAL.REQUIRED_FIELD.message); return; }
    setError(null);
    setIsSaving(true);
    try {
      await onSave({ name: name.trim(), manufacturer: manufacturer.trim(), description: description.trim(), finish: finish.trim(), modelNumber: modelNumber.trim() });
    } catch (err) {
      setError(ERRORS.GENERAL.SAVE_FAILED.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--bg)] rounded-xl shadow-2xl w-full max-w-lg border border-[var(--border-subtle)] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border)] bg-[var(--primary-bg)] rounded-t-xl">
          <div className="p-1.5 rounded-lg bg-[var(--primary-bg-hover)]">
            <Package className="w-4 h-4 text-[var(--primary-text-muted)]" />
          </div>
          <h2 className="text-sm font-semibold text-[var(--text)] flex-1">
            {isEdit ? 'Edit Hardware Item' : 'Create Hardware Item'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Item Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cylindrical Lockset"
              className={inputCls}
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Manufacturer</label>
              <input
                type="text"
                value={manufacturer}
                onChange={e => setManufacturer(e.target.value)}
                placeholder="e.g. Schlage"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Finish</label>
              <input
                type="text"
                value={finish}
                onChange={e => setFinish(e.target.value)}
                placeholder="e.g. 626 Satin Chrome"
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. Grade 1 cylindrical lever, office function"
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Model Number</label>
            <input
              type="text"
              value={modelNumber}
              onChange={e => setModelNumber(e.target.value)}
              placeholder="e.g. ND53PD-SPA-626"
              className={inputCls}
            />
          </div>

          {error && <ErrorDisplay error={error} />}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button
              type="button"
              onClick={onClose}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              loading={isSaving}
              loadingText="Saving..."
            >
              {isEdit ? 'Save Changes' : 'Create Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
