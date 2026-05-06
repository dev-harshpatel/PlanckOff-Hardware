
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HardwareSet, HardwareItem, NewHardwareSetData, HardwareItemField } from '../../types';
import { Copy, Layers, X, Plus, Trash2 } from 'lucide-react';

interface HardwareSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (set: HardwareSet) => void;
  setToEdit: HardwareSet | null;
  hardwareSets: HardwareSet[];
  autoAddItem?: boolean;
  variantSource?: HardwareSet | null;
}

const inputCls = "w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1.5";

const SuggestionBox: React.FC<{
  suggestions: string[];
  onSelect: (s: string) => void;
  direction?: 'up' | 'down';
}> = ({ suggestions, onSelect, direction = 'down' }) => {
  if (suggestions.length === 0) return null;
  return (
    <ul
      className={`absolute z-20 w-full bg-[var(--bg)] border border-[var(--border-strong)] rounded-md max-h-40 overflow-y-auto shadow-lg ${
        direction === 'up' ? 'bottom-full mb-1' : 'top-full mt-1'
      }`}
    >
      {suggestions.map(s => (
        <li
          key={s}
          onMouseDown={e => { e.preventDefault(); onSelect(s); }}
          className="px-3 py-2 text-sm cursor-pointer hover:bg-[var(--primary-bg)] text-[var(--text)]"
        >
          {s}
        </li>
      ))}
    </ul>
  );
};

const commonHardwareItems = [
  'Hinges', 'Lever Lockset', 'Knob Lockset', 'Deadbolt', 'Mortise Lock', 'Exit Device', 'Panic Bar',
  'Door Closer', 'Surface Mounted Closer', 'Concealed Closer', 'Wall Stop', 'Floor Stop', 'Overhead Stop',
  'Kick Plate', 'Armor Plate', 'Mop Plate', 'Push Plate', 'Pull Handle', 'Privacy Lever', 'Passage Lever',
  'Storeroom Lockset', 'Classroom Lockset', 'Cylindrical Lock', 'Ball Bearing Hinge', 'Continuous Hinge',
  'Electric Strike', 'Magnetic Lock', 'Card Reader', 'Power Supply', 'Door Position Switch',
  'Request to Exit Button', 'Flush Bolt', 'Surface Bolt', 'Door Viewer', 'Weatherstripping', 'Door Sweep',
  'Threshold', 'Gasketing', 'Sound Seal', 'Automatic Door Bottom', 'Coat Hook',
].sort();

const HardwareSetModal: React.FC<HardwareSetModalProps> = ({
  isOpen, onClose, onSave, setToEdit, hardwareSets, autoAddItem, variantSource,
}) => {
  const [formData, setFormData] = useState<NewHardwareSetData>({
    name: '', description: '', doorTags: '', division: '', items: [], isAvailable: true, prep: '',
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; division?: string }>({});
  const [itemErrors, setItemErrors] = useState<Record<string, { quantity?: string }>>({});
  const [activeSuggestionBox, setActiveSuggestionBox] = useState<string | null>(null);
  const [focusOnNewItem, setFocusOnNewItem] = useState(false);
  const itemsContainerRef = useRef<HTMLDivElement>(null);

  const allManufacturers = useMemo(() => {
    const s = new Set<string>();
    hardwareSets.forEach(set => set.items.forEach(item => { if (item.manufacturer.trim()) s.add(item.manufacturer.trim()); }));
    return Array.from(s).sort();
  }, [hardwareSets]);

  const allFinishes = useMemo(() => {
    const s = new Set<string>();
    hardwareSets.forEach(set => set.items.forEach(item => { if (item.finish.trim()) s.add(item.finish.trim()); }));
    return Array.from(s).sort();
  }, [hardwareSets]);

  const validateAllItems = (items: HardwareItem[]) => {
    const errors: Record<string, { quantity?: string }> = {};
    items.forEach(item => {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) errors[item.id] = { quantity: 'Must be a positive integer' };
    });
    return errors;
  };

  const validateForm = (data: NewHardwareSetData) => {
    const errors: { name?: string; division?: string } = {};
    if (!data.name.trim()) errors.name = 'Set name is required.';
    if (!data.division.trim()) errors.division = 'Division is required.';
    else if (!/^[a-zA-Z0-9\s]*$/.test(data.division)) errors.division = 'Division can only contain letters, numbers, and spaces.';
    setFormErrors(errors);
  };

  useEffect(() => {
    if (!isOpen) return;
    let initialData: NewHardwareSetData;
    if (setToEdit) {
      initialData = {
        name: setToEdit.name, description: setToEdit.description,
        doorTags: setToEdit.doorTags || '', division: setToEdit.division,
        items: JSON.parse(JSON.stringify(setToEdit.items)),
        extractionWarnings: setToEdit.extractionWarnings || [],
        isAvailable: setToEdit.isAvailable !== false,
        isManualEntry: setToEdit.isManualEntry === true,
        prep: setToEdit.prep || '',
      };
    } else if (variantSource) {
      initialData = {
        name: `${variantSource.name}.W`, description: variantSource.description,
        doorTags: variantSource.doorTags || '', division: variantSource.division,
        items: variantSource.items.map(item => ({
          ...item, id: `item-var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        })),
        extractionWarnings: variantSource.extractionWarnings || [],
        isAvailable: variantSource.isAvailable !== false,
        isManualEntry: true,
      };
    } else {
      initialData = { name: '', description: '', doorTags: '', division: '', items: [], extractionWarnings: [], isAvailable: true, isManualEntry: true };
    }

    if (autoAddItem) {
      initialData.items.push({ id: `new-item-${Date.now()}`, quantity: 1, name: '', manufacturer: '', description: '', finish: '' });
      setFocusOnNewItem(true);
    } else {
      setFocusOnNewItem(false);
    }

    setFormData(initialData);
    validateForm(initialData);
    setItemErrors(validateAllItems(initialData.items));
    setActiveSuggestionBox(null);
  }, [setToEdit, isOpen, autoAddItem, variantSource]);

  useEffect(() => {
    if (focusOnNewItem && itemsContainerRef.current) {
      const inputs = itemsContainerRef.current.querySelectorAll<HTMLInputElement>('input[placeholder="Item Name"]');
      const last = inputs[inputs.length - 1];
      if (last) last.focus();
      setFocusOnNewItem(false);
    }
  }, [focusOnNewItem, formData.items]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    setFormData(next);
    validateForm(next);
  };

  const handleItemChange = (index: number, field: HardwareItemField, value: string | number) => {
    const newItems = [...formData.items];
    const item = { ...newItems[index] };
    if (field === 'quantity') {
      const n = parseInt(String(value), 10);
      item.quantity = isNaN(n) ? 0 : n;
    } else {
      (item as unknown as Record<string, unknown>)[field] = value;
    }
    newItems[index] = item;
    setFormData(prev => ({ ...prev, items: newItems }));
    setItemErrors(validateAllItems(newItems));
  };

  const handleAddItem = () => {
    const newItem: HardwareItem = { id: `new-item-${Date.now()}`, quantity: 1, name: '', manufacturer: '', description: '', finish: '' };
    const newItems = [...formData.items, newItem];
    setFormData(prev => ({ ...prev, items: newItems }));
    setItemErrors(validateAllItems(newItems));
    setFocusOnNewItem(true);
  };

  const handleRemoveItem = (i: number) => {
    const newItems = formData.items.filter((_, idx) => idx !== i);
    setFormData(prev => ({ ...prev, items: newItems }));
    setItemErrors(validateAllItems(newItems));
  };

  const handleSaveClick = () => {
    onSave({ id: setToEdit?.id || '', ...formData });
  };

  const isFormValid = useMemo(() =>
    Object.keys(formErrors).length === 0 &&
    formData.items.length > 0 &&
    formData.items.every(item => item.name.trim() !== '') &&
    Object.keys(itemErrors).length === 0,
  [formData, itemErrors, formErrors]);

  if (!isOpen) return null;

  const isVariant = !!variantSource;
  const isEdit = !!setToEdit;
  const title = isEdit ? 'Edit Hardware Set' : isVariant ? 'Create Variant' : 'New Hardware Set';
  const subtitle = isEdit
    ? 'Modify items and details for this hardware set.'
    : isVariant
    ? `Branching from ${variantSource!.name} — adjust items and save as a new set.`
    : 'Define a hardware set and the items it contains.';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div
        className="bg-[var(--bg)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-[var(--border-subtle)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-[var(--primary-bg-hover)] p-2 rounded-lg">
              {isVariant ? <Copy className="w-4 h-4 text-[var(--primary-text)]" /> : <Layers className="w-4 h-4 text-[var(--primary-text)]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-[var(--text)]">{title}</h2>
                {isVariant && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Variant
                  </span>
                )}
              </div>
              <p className="text-xs text-[var(--primary-text-muted)] mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--primary-bg-hover)] rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Availability toggle */}
          <div className="flex items-center justify-end">
            <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] px-3 py-2 hover:bg-[var(--bg-muted)] transition-colors">
              <input
                type="checkbox"
                checked={formData.isAvailable}
                onChange={e => setFormData(prev => ({ ...prev, isAvailable: e.target.checked }))}
                className="h-4 w-4 rounded border-[var(--border-strong)] accent-[var(--primary-action)]"
              />
              <span className="text-sm font-medium text-[var(--text-secondary)] select-none">Mark as Available</span>
            </label>
          </div>

          {/* Set Name + Division */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className={labelCls}>Set Name</label>
              <input
                type="text" name="name" id="name"
                value={formData.name} onChange={handleInputChange}
                className={`${inputCls} ${formErrors.name ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="e.g. AD01b.V"
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-500">{formErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="division" className={labelCls}>Division</label>
              <input
                type="text" name="division" id="division"
                value={formData.division} onChange={handleInputChange}
                className={`${inputCls} ${formErrors.division ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : ''}`}
                placeholder="e.g. Division 08"
              />
              {formErrors.division && <p className="mt-1 text-xs text-red-500">{formErrors.division}</p>}
            </div>
          </div>

          {/* Door Tags */}
          <div>
            <label htmlFor="doorTags" className={labelCls}>Door Tags</label>
            <input
              type="text" name="doorTags" id="doorTags"
              value={formData.doorTags || ''} onChange={handleInputChange}
              className={inputCls}
              placeholder="e.g. P350-02, P250-02, P150-02"
            />
            <p className="mt-1 text-xs text-[var(--text-faint)]">Comma-separated list of doors this set applies to.</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className={labelCls}>Notes / Description</label>
            <textarea
              name="description" id="description" rows={3}
              value={formData.description} onChange={handleInputChange}
              className={inputCls}
              placeholder="Optional notes about this hardware set..."
            />
          </div>

          {/* Hardware Prep */}
          <div>
            <label htmlFor="prep" className={labelCls}>Hardware Prep</label>
            <textarea
              name="prep" id="prep" rows={2}
              value={formData.prep || ''} onChange={handleInputChange}
              className={inputCls}
              placeholder="e.g. Continuous Hinge + Exit Device + Power Transfer + Card Reader"
            />
            <p className="mt-1 text-xs text-[var(--text-faint)]">Summary of prep requirements. Can be generated via AI or entered manually.</p>
          </div>

          {/* Hardware Items */}
          <div className="pt-1">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-semibold text-[var(--text)]">Hardware Items</h3>
                <p className="text-xs text-[var(--text-faint)] mt-0.5">At least one item is required before saving.</p>
              </div>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Item
              </button>
            </div>

            <div ref={itemsContainerRef} className="space-y-2">
              {formData.items.map((item, index) => {
                const hasQtyError = itemErrors[item.id]?.quantity;
                return (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 gap-2 items-start rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] p-3"
                  >
                    {/* Qty */}
                    <div className="col-span-2 md:col-span-1">
                      <input
                        type="number" placeholder="Qty"
                        value={item.quantity > 0 ? item.quantity : ''}
                        onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                        className={`${inputCls} ${hasQtyError ? 'border-red-500 focus:ring-red-500' : ''}`}
                      />
                      {hasQtyError && <p className="mt-0.5 text-[10px] text-red-500">{itemErrors[item.id].quantity}</p>}
                    </div>

                    {/* Name */}
                    <div className="col-span-10 md:col-span-3 relative">
                      <input
                        type="text" placeholder="Item Name"
                        value={item.name}
                        onChange={e => handleItemChange(index, 'name', e.target.value)}
                        onFocus={() => setActiveSuggestionBox(`name-${index}`)}
                        onBlur={() => setTimeout(() => setActiveSuggestionBox(null), 150)}
                        autoComplete="off"
                        className={inputCls}
                      />
                      {activeSuggestionBox === `name-${index}` && item.name && (
                        <SuggestionBox
                          direction="up"
                          suggestions={commonHardwareItems.filter(h => h.toLowerCase().includes(item.name.toLowerCase()) && h.toLowerCase() !== item.name.toLowerCase())}
                          onSelect={s => { handleItemChange(index, 'name', s); setActiveSuggestionBox(null); }}
                        />
                      )}
                    </div>

                    {/* Description */}
                    <input
                      type="text" placeholder="Description"
                      value={item.description}
                      onChange={e => handleItemChange(index, 'description', e.target.value)}
                      className={`${inputCls} col-span-12 md:col-span-3`}
                    />

                    {/* Manufacturer */}
                    <div className="col-span-6 md:col-span-2 relative">
                      <input
                        type="text" placeholder="Manufacturer"
                        value={item.manufacturer}
                        onChange={e => handleItemChange(index, 'manufacturer', e.target.value)}
                        onFocus={() => setActiveSuggestionBox(`mfr-${index}`)}
                        onBlur={() => setTimeout(() => setActiveSuggestionBox(null), 150)}
                        autoComplete="off"
                        className={inputCls}
                      />
                      {activeSuggestionBox === `mfr-${index}` && item.manufacturer && (
                        <SuggestionBox
                          direction="up"
                          suggestions={allManufacturers.filter(m => m.toLowerCase().includes(item.manufacturer.toLowerCase()) && m.toLowerCase() !== item.manufacturer.toLowerCase())}
                          onSelect={s => { handleItemChange(index, 'manufacturer', s); setActiveSuggestionBox(null); }}
                        />
                      )}
                    </div>

                    {/* Finish */}
                    <div className="col-span-6 md:col-span-2 relative">
                      <input
                        type="text" placeholder="Finish"
                        value={item.finish}
                        onChange={e => handleItemChange(index, 'finish', e.target.value)}
                        onFocus={() => setActiveSuggestionBox(`finish-${index}`)}
                        onBlur={() => setTimeout(() => setActiveSuggestionBox(null), 150)}
                        autoComplete="off"
                        className={inputCls}
                      />
                      {activeSuggestionBox === `finish-${index}` && item.finish && (
                        <SuggestionBox
                          direction="up"
                          suggestions={allFinishes.filter(f => f.toLowerCase().includes(item.finish.toLowerCase()) && f.toLowerCase() !== item.finish.toLowerCase())}
                          onSelect={s => { handleItemChange(index, 'finish', s); setActiveSuggestionBox(null); }}
                        />
                      )}
                    </div>

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="col-span-12 md:col-span-1 flex h-9 items-center justify-center rounded-lg text-[var(--text-faint)] hover:bg-[var(--bg)] hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {formData.items.length === 0 && (
                <div className="flex flex-col items-center gap-2 py-8 border border-dashed border-[var(--border)] rounded-lg bg-[var(--bg-subtle)]">
                  <p className="text-sm text-[var(--text-faint)]">No items yet. Add one to get started.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg)] rounded-b-xl flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--text-muted)] bg-[var(--bg)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-subtle)] font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!isFormValid}
            className="px-5 py-2 text-sm bg-[var(--primary-action)] text-white rounded-lg hover:bg-[var(--primary-action-hover)] font-semibold transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isVariant ? 'Create Variant' : isEdit ? 'Save Changes' : 'Create Set'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HardwareSetModal;
