
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HardwareSet, HardwareItem, NewHardwareSetData, HardwareItemField } from '../types';

interface HardwareSetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (set: HardwareSet) => void;
  setToEdit: HardwareSet | null;
  hardwareSets: HardwareSet[];
  autoAddItem?: boolean;
  variantSource?: HardwareSet | null; // New prop to pre-fill data for variants
}

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.58.22-2.365.468a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193v-.443A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
  </svg>
);

const SuggestionBox: React.FC<{ suggestions: string[]; onSelect: (suggestion: string) => void }> = ({ suggestions, onSelect }) => {
  if (suggestions.length === 0) return null;
  return (
    <ul className="absolute z-20 w-full bg-[var(--bg)] border border-[var(--border-strong)] rounded-md mt-1 max-h-40 overflow-y-auto shadow-lg">
      {suggestions.map(suggestion => (
        <li
          key={suggestion}
          onMouseDown={(e) => {
            e.preventDefault(); // Prevents the input from losing focus before selection
            onSelect(suggestion);
          }}
          className="px-3 py-2 text-sm cursor-pointer hover:bg-[var(--primary-bg)]"
        >
          {suggestion}
        </li>
      ))}
    </ul>
  );
};

// A predefined list of common hardware items to assist with data entry.
const commonHardwareItems = [
  'Hinges', 'Lever Lockset', 'Knob Lockset', 'Deadbolt', 'Mortise Lock', 'Exit Device', 'Panic Bar',
  'Door Closer', 'Surface Mounted Closer', 'Concealed Closer', 'Wall Stop', 'Floor Stop', 'Overhead Stop',
  'Kick Plate', 'Armor Plate', 'Mop Plate', 'Push Plate', 'Pull Handle', 'Privacy Lever', 'Passage Lever',
  'Storeroom Lockset', 'Classroom Lockset', 'Cylindrical Lock', 'Ball Bearing Hinge', 'Continuous Hinge',
  'Electric Strike', 'Magnetic Lock', 'Card Reader', 'Power Supply', 'Door Position Switch',
  'Request to Exit Button', 'Flush Bolt', 'Surface Bolt', 'Door Viewer', 'Weatherstripping', 'Door Sweep',
  'Threshold', 'Gasketing', 'Sound Seal', 'Automatic Door Bottom', 'Coat Hook'
].sort();


const HardwareSetModal: React.FC<HardwareSetModalProps> = ({ isOpen, onClose, onSave, setToEdit, hardwareSets, autoAddItem, variantSource }) => {
  const [formData, setFormData] = useState<NewHardwareSetData>({
    name: '',
    description: '',
    doorTags: '',
    division: '',
    items: [],
    isAvailable: true,
  });
  const [formErrors, setFormErrors] = useState<{ name?: string; division?: string }>({});
  const [itemErrors, setItemErrors] = useState<Record<string, { quantity?: string }>>({});
  const [activeSuggestionBox, setActiveSuggestionBox] = useState<string | null>(null);
  const [focusOnNewItem, setFocusOnNewItem] = useState(false);
  const itemsContainerRef = useRef<HTMLDivElement>(null);


  const allManufacturers = useMemo(() => {
    const manufacturers = new Set<string>();
    hardwareSets.forEach(set => {
      set.items.forEach(item => {
        if (item.manufacturer.trim()) {
          manufacturers.add(item.manufacturer.trim());
        }
      });
    });
    return Array.from(manufacturers).sort();
  }, [hardwareSets]);

  const allFinishes = useMemo(() => {
    const finishes = new Set<string>();
    hardwareSets.forEach(set => {
      set.items.forEach(item => {
        if (item.finish.trim()) {
          finishes.add(item.finish.trim());
        }
      });
    });
    return Array.from(finishes).sort();
  }, [hardwareSets]);

  const validateAllItems = (items: HardwareItem[]) => {
    const errors: Record<string, { quantity?: string }> = {};
    items.forEach(item => {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        errors[item.id] = { ...errors[item.id], quantity: 'Must be a positive integer' };
      }
    });
    return errors;
  };

  const validateForm = (data: NewHardwareSetData) => {
    const errors: { name?: string; division?: string } = {};
    if (!data.name.trim()) {
      errors.name = 'Set name is required.';
    }
    if (!data.division.trim()) {
      errors.division = 'Division is required.';
    } else if (!/^[a-zA-Z0-9\s]*$/.test(data.division)) {
      errors.division = 'Division can only contain letters, numbers, and spaces.';
    }
    setFormErrors(errors);
  };

  useEffect(() => {
    if (isOpen) {
      let initialData: NewHardwareSetData;

      if (setToEdit) {
        // EDIT MODE: Use existing data
        initialData = {
          name: setToEdit.name,
          description: setToEdit.description,
          doorTags: setToEdit.doorTags || '',
          division: setToEdit.division,
          items: JSON.parse(JSON.stringify(setToEdit.items)),
          extractionWarnings: setToEdit.extractionWarnings || [],
          isAvailable: setToEdit.isAvailable !== false, // Default to true if undefined
        };
      } else if (variantSource) {
        // VARIANT MODE: Use source data but prepare for new set
        initialData = {
          name: `${variantSource.name} - Variant`,
          description: variantSource.description,
          doorTags: variantSource.doorTags || '',
          division: variantSource.division,
          // Deep copy items and give them new temporary IDs to avoid key conflicts or reference issues
          items: variantSource.items.map(item => ({
            ...item,
            id: `item-var-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
          })),
          extractionWarnings: variantSource.extractionWarnings || [],
          isAvailable: variantSource.isAvailable !== false,
        };
      } else {
        // CREATE NEW MODE
        initialData = {
          name: '',
          description: '',
          doorTags: '',
          division: '',
          items: [],
          extractionWarnings: [],
          isAvailable: true
        };
      }

      if (autoAddItem) {
        initialData.items.push({
          id: `new-item-${Date.now()}`,
          quantity: 1,
          name: '',
          manufacturer: '',
          description: '',
          finish: '',
        });
        setFocusOnNewItem(true);
      } else {
        setFocusOnNewItem(false);
      }

      setFormData(initialData);
      validateForm(initialData);
      setItemErrors(validateAllItems(initialData.items));
      setActiveSuggestionBox(null);
    }
  }, [setToEdit, isOpen, autoAddItem, variantSource]);

  useEffect(() => {
    if (focusOnNewItem && itemsContainerRef.current) {
      const inputs = itemsContainerRef.current.querySelectorAll<HTMLInputElement>('input[placeholder="Item Name"]');
      const lastInput = inputs[inputs.length - 1];
      if (lastInput) {
        lastInput.focus();
      }
      setFocusOnNewItem(false);
    }
  }, [focusOnNewItem, formData.items]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);
    validateForm(newFormData);
  };

  const handleAvailabilityToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, isAvailable: e.target.checked }));
  };

  const handleItemChange = (index: number, field: HardwareItemField, value: string | number) => {
    const newItems = [...formData.items];
    const itemToUpdate = { ...newItems[index] };

    if (field === 'quantity') {
      const parsedQty = parseInt(String(value), 10);
      itemToUpdate.quantity = isNaN(parsedQty) ? 0 : parsedQty;
    } else {
      (itemToUpdate as any)[field] = value;
    }

    newItems[index] = itemToUpdate;
    setFormData(prev => ({ ...prev, items: newItems }));
    setItemErrors(validateAllItems(newItems));
  };

  const handleAddItem = () => {
    const newItem: HardwareItem = {
      id: `new-item-${Date.now()}`,
      quantity: 1,
      name: '',
      manufacturer: '',
      description: '',
      finish: '',
    };
    const newItems = [...formData.items, newItem];
    setFormData(prev => ({ ...prev, items: newItems }));
    setItemErrors(validateAllItems(newItems));
    setFocusOnNewItem(true);
  };

  const handleRemoveItem = (itemIndex: number) => {
    const newItems = formData.items.filter((_, i) => i !== itemIndex);
    setFormData(prev => ({ ...prev, items: newItems }));
    setItemErrors(validateAllItems(newItems));
  };

  const handleSaveClick = () => {
    // If setToEdit is null, we are creating a new set (either brand new or variant)
    const finalSet: HardwareSet = {
      id: setToEdit?.id || '', // ID will be handled by parent if empty
      ...formData,
    };
    onSave(finalSet);
  };

  const isFormValid = useMemo(() => {
    return Object.keys(formErrors).length === 0 &&
      formData.items.length > 0 &&
      formData.items.every(item => item.name.trim() !== '') &&
      Object.keys(itemErrors).length === 0;
  }, [formData, itemErrors, formErrors]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fadeIn"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-[var(--bg)] rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b border-[var(--border)]">
          <h2 className="text-2xl font-bold text-[var(--text)]">
            {setToEdit ? 'Edit Hardware Set' : variantSource ? 'Create Variant Set' : 'Create New Hardware Set'}
          </h2>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-end">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isAvailable}
                onChange={handleAvailabilityToggle}
                className="form-checkbox h-5 w-5 text-[var(--primary-action)] rounded border-[var(--border-strong)] focus:ring-[var(--primary-ring)] transition duration-150 ease-in-out"
              />
              <span className="ml-2 text-sm font-medium text-[var(--text-secondary)] select-none">
                Mark as Available
              </span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-[var(--text-secondary)]">Set Name</label>
              <input
                type="text"
                name="name"
                id="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)] ${formErrors.name ? 'border-red-500' : 'border-[var(--border-strong)]'}`}
              />
              {formErrors.name && <p className="mt-1 text-xs text-red-600">{formErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="division" className="block text-sm font-medium text-gray-700">Division</label>
              <input
                type="text"
                name="division"
                id="division"
                value={formData.division}
                onChange={handleInputChange}
                className={`mt-1 block w-full rounded-md shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)] ${formErrors.division ? 'border-red-500' : 'border-[var(--border-strong)]'}`}
              />
              {formErrors.division && <p className="mt-1 text-xs text-red-600">{formErrors.division}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="doorTags" className="block text-sm font-medium text-gray-700">Door Tags (optional)</label>
            <input
              type="text"
              name="doorTags"
              id="doorTags"
              value={formData.doorTags || ''}
              onChange={handleInputChange}
              placeholder="e.g., P350-02, P250-02, P150-02"
              className="mt-1 block w-full rounded-md border-[var(--border-strong)] shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)]"
            />
            <p className="mt-1 text-xs text-[var(--text-muted)]">Comma-separated list of doors this set applies to.</p>
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Set Description / Notes</label>
            <textarea name="description" id="description" rows={2} value={formData.description} onChange={handleInputChange} className="mt-1 block w-full rounded-md border-[var(--border-strong)] shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)] focus:border-[var(--primary-ring)] focus:ring-[var(--primary-ring)]" />
          </div>

          <div className="pt-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Hardware Items</h3>
            <div ref={itemsContainerRef} className="space-y-3">
              {formData.items.map((item, index) => {
                const hasError = itemErrors[item.id]?.quantity;
                return (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-start p-2 bg-[var(--bg-subtle)] rounded-md">
                    <div className="col-span-2 md:col-span-1">
                      <input
                        type="number"
                        placeholder="Qty"
                        value={item.quantity > 0 ? item.quantity : ''}
                        onChange={e => handleItemChange(index, 'quantity', e.target.value)}
                        className={`w-full rounded-md shadow-sm sm:text-sm ${hasError
                            ? 'border-red-500 text-red-900 placeholder-red-300 focus:outline-none focus:ring-red-500 focus:border-red-500'
                            : 'border-[var(--border-strong)] focus:border-[var(--primary-ring)] focus:ring-[var(--primary-ring)]'
                          }`}
                      />
                      {hasError && (
                        <p className="mt-1 text-xs text-red-600">{itemErrors[item.id].quantity}</p>
                      )}
                    </div>

                    <div className="col-span-10 md:col-span-3 relative">
                      <input
                        type="text"
                        placeholder="Item Name"
                        value={item.name}
                        onChange={e => handleItemChange(index, 'name', e.target.value)}
                        onFocus={() => setActiveSuggestionBox(`name-${index}`)}
                        onBlur={() => setTimeout(() => setActiveSuggestionBox(null), 150)}
                        className="w-full rounded-md border-[var(--border-strong)] shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)]"
                        autoComplete="off"
                      />
                      {activeSuggestionBox === `name-${index}` && item.name && (
                        <SuggestionBox
                          suggestions={commonHardwareItems.filter(h => h.toLowerCase().includes(item.name.toLowerCase()) && h.toLowerCase() !== item.name.toLowerCase())}
                          onSelect={(suggestion) => {
                            handleItemChange(index, 'name', suggestion);
                            setActiveSuggestionBox(null);
                          }}
                        />
                      )}
                    </div>

                    <input type="text" placeholder="Description" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="col-span-12 md:col-span-3 rounded-md border-[var(--border-strong)] shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)]" />

                    <div className="col-span-6 md:col-span-2 relative">
                      <input
                        type="text"
                        placeholder="Manufacturer"
                        value={item.manufacturer}
                        onChange={e => handleItemChange(index, 'manufacturer', e.target.value)}
                        onFocus={() => setActiveSuggestionBox(`manufacturer-${index}`)}
                        onBlur={() => setTimeout(() => setActiveSuggestionBox(null), 150)}
                        className="w-full rounded-md border-[var(--border-strong)] shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)]"
                        autoComplete="off"
                      />
                      {activeSuggestionBox === `manufacturer-${index}` && item.manufacturer && (
                        <SuggestionBox
                          suggestions={allManufacturers.filter(m => m.toLowerCase().includes(item.manufacturer.toLowerCase()) && m.toLowerCase() !== item.manufacturer.toLowerCase())}
                          onSelect={(suggestion) => {
                            handleItemChange(index, 'manufacturer', suggestion);
                            setActiveSuggestionBox(null);
                          }}
                        />
                      )}
                    </div>
                    <div className="col-span-6 md:col-span-2 relative">
                      <input
                        type="text"
                        placeholder="Finish"
                        value={item.finish}
                        onChange={e => handleItemChange(index, 'finish', e.target.value)}
                        onFocus={() => setActiveSuggestionBox(`finish-${index}`)}
                        onBlur={() => setTimeout(() => setActiveSuggestionBox(null), 150)}
                        className="w-full rounded-md border-[var(--border-strong)] shadow-sm sm:text-sm bg-[var(--bg)] text-[var(--text)]"
                        autoComplete="off"
                      />
                      {activeSuggestionBox === `finish-${index}` && item.finish && (
                        <SuggestionBox
                          suggestions={allFinishes.filter(f => f.toLowerCase().includes(item.finish.toLowerCase()) && f.toLowerCase() !== item.finish.toLowerCase())}
                          onSelect={(suggestion) => {
                            handleItemChange(index, 'finish', suggestion);
                            setActiveSuggestionBox(null);
                          }}
                        />
                      )}
                    </div>

                    <button onClick={() => handleRemoveItem(index)} className="col-span-12 md:col-span-1 flex justify-center items-center text-[var(--text-faint)] hover:text-red-500">
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </div>
                )
              })}
              {formData.items.length === 0 && <p className="text-sm text-[var(--text-muted)] text-center py-4">No items in this set. Add one to get started.</p>}
            </div>
            <button onClick={handleAddItem} className="mt-3 text-sm font-semibold text-[var(--primary-text-muted)] hover:text-[var(--primary-text)] transition-colors">
              + Add Item
            </button>
          </div>
        </div>

        <div className="p-6 bg-[var(--bg-subtle)] border-t border-[var(--border)] flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 bg-[var(--bg)] border border-[var(--border-strong)] text-[var(--text-secondary)] rounded-md hover:bg-[var(--bg-muted)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-ring)] text-sm font-semibold">
            Cancel
          </button>
          <button
            onClick={handleSaveClick}
            disabled={!isFormValid}
            className="px-4 py-2 bg-[var(--primary-action)] text-white rounded-md hover:bg-[var(--primary-action-hover)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--primary-ring)] text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {variantSource ? 'Create Variant' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HardwareSetModal;