'use client';
import React, { useState, useRef, useEffect } from 'react';
import { Door } from '../../types';

interface UseCellEditStateParams {
    onDoorsUpdate: (updater: React.SetStateAction<Door[]>) => void;
    onProvidedSetChange?: (doorId: string, setName: string) => void;
}

export function useCellEditState({ onDoorsUpdate, onProvidedSetChange }: UseCellEditStateParams) {
    const [editingCell, setEditingCell] = useState<{ id: string, field: keyof Door } | null>(null);
    const [tempValue, setTempValue] = useState<string | number>('');
    const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
        }
    }, [editingCell]);

    const startEditing = (door: Door, field: keyof Door) => {
        setEditingCell({ id: door.id, field });
        setTempValue(door[field] as string | number || '');
    };

    const cancelEditing = () => {
        setEditingCell(null);
        setTempValue('');
    };

    const saveEdit = () => {
        if (!editingCell) return;

        if (editingCell.field === 'providedHardwareSet') {
            if (onProvidedSetChange) {
                onProvidedSetChange(editingCell.id, String(tempValue));
            }
            onDoorsUpdate(prev => prev.map(d => {
                if (d.id === editingCell.id) {
                    return { ...d, providedHardwareSet: String(tempValue) };
                }
                return d;
            }));
            setEditingCell(null);
            setTempValue('');
            return;
        }

        onDoorsUpdate(prev => prev.map(d => {
            if (d.id === editingCell.id) {
                let newVal = tempValue;
                const isCustom = editingCell.field.toString().startsWith('custom_');

                if (isCustom || !Object.keys(d).includes(editingCell.field as string)) {
                    const currentCustom = d.customFields || {};
                    return {
                        ...d,
                        customFields: {
                            ...currentCustom,
                            [editingCell.field]: newVal
                        }
                    };
                }

                if (['quantity', 'width', 'height', 'thickness'].includes(editingCell.field as string)) {
                    const rawStr = String(tempValue).trim();
                    const numeric = parseFloat(rawStr);
                    newVal = isNaN(numeric) ? 0 : numeric;

                    // Mirror the display-string fields so syncedSections writes the
                    // user's typed value (not stale raw Excel) back to final_json.
                    if (editingCell.field === 'width') {
                        return { ...d, width: newVal as number, widthDisplay: rawStr };
                    }
                    if (editingCell.field === 'height') {
                        return { ...d, height: newVal as number, heightDisplay: rawStr };
                    }
                    if (editingCell.field === 'thickness') {
                        return { ...d, thickness: newVal as number, thicknessDisplay: rawStr };
                    }
                }

                if (editingCell.field === 'leafCount') {
                    return {
                        ...d,
                        leafCountDisplay: String(tempValue).trim() || undefined,
                        leafCount: (() => {
                            const raw = String(tempValue).trim().toLowerCase();
                            const numeric = parseFloat(String(tempValue));
                            if (!isNaN(numeric)) return numeric;
                            if (['single', 'singles', 'single leaf', '1 leaf'].includes(raw)) return 1;
                            if (['double', 'pair', 'double leaf', '2 leaf', '2 leaves'].includes(raw)) return 2;
                            return d.leafCount;
                        })(),
                    };
                }

                return {
                    ...d,
                    [editingCell.field]: newVal,
                };
            }
            return d;
        }));

        setEditingCell(null);
        setTempValue('');
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveEdit();
        } else if (e.key === 'Escape') {
            cancelEditing();
        }
    };

    return {
        editingCell, setEditingCell,
        tempValue, setTempValue,
        inputRef,
        startEditing,
        cancelEditing,
        saveEdit,
        handleKeyDown,
    };
}
