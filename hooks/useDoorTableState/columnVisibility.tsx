'use client';
import { useState, useMemo, useEffect, useRef } from 'react';
import { Toast } from '../../types';
import { ALL_AVAILABLE_COLUMNS, ColumnDef, CustomColumn, PersistedColumnPrefs } from './columnDefinitions';
import { ERRORS } from '@/constants/errors';

interface UseColumnVisibilityParams {
    projectId: string;
    addToast: (toast: Toast) => void;
}

export function useColumnVisibility({ projectId, addToast }: UseColumnVisibilityParams) {
    const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(ALL_AVAILABLE_COLUMNS.filter(c => c.isCore).map(c => c.key)));
    const [columnOrder, setColumnOrder] = useState<string[]>(() => ALL_AVAILABLE_COLUMNS.map(c => c.key));
    const [dragOverKey, setDragOverKey] = useState<string | null>(null);
    const dragSourceKey = useRef<string | null>(null);
    const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
    const [isColumnCustomizerOpen, setIsColumnCustomizerOpen] = useState(false);
    const [newColumnName, setNewColumnName] = useState('');
    const [newColumnType, setNewColumnType] = useState<'text' | 'number'>('text');
    const [columnPrefsLoaded, setColumnPrefsLoaded] = useState(false);

    // Load localStorage prefs on mount (Pitfall 2: load + save must stay together)
    useEffect(() => {
        const defaultVisible = ALL_AVAILABLE_COLUMNS.filter(c => c.isCore).map(c => c.key);
        const defaultOrder = ALL_AVAILABLE_COLUMNS.map(c => c.key);

        if (typeof window === 'undefined') {
            setVisibleColumns(new Set(defaultVisible));
            setColumnOrder(defaultOrder);
            setCustomColumns([]);
            setColumnPrefsLoaded(true);
            return;
        }

        const storageKey = `planckoff-door-columns-${projectId}`;

        try {
            const raw = window.localStorage.getItem(storageKey);
            if (!raw) {
                setVisibleColumns(new Set(defaultVisible));
                setColumnOrder(defaultOrder);
                setCustomColumns([]);
                setColumnPrefsLoaded(true);
                return;
            }

            const parsed = JSON.parse(raw) as Partial<PersistedColumnPrefs>;
            const parsedCustomColumns = Array.isArray(parsed.customColumns) ? parsed.customColumns : [];
            const allowedKeys = new Set([
                ...ALL_AVAILABLE_COLUMNS.map(c => c.key),
                ...parsedCustomColumns.map(c => c.id),
            ]);

            const parsedVisible = Array.isArray(parsed.visibleColumns)
                ? parsed.visibleColumns.filter((key): key is string => typeof key === 'string' && allowedKeys.has(key))
                : defaultVisible;

            const parsedOrder = Array.isArray(parsed.columnOrder)
                ? parsed.columnOrder.filter((key): key is string => typeof key === 'string' && ALL_AVAILABLE_COLUMNS.some(c => c.key === key))
                : defaultOrder;

            const missingStandardKeys = defaultOrder.filter(key => !parsedOrder.includes(key));

            setCustomColumns(parsedCustomColumns);
            setVisibleColumns(new Set(parsedVisible.length > 0 ? parsedVisible : defaultVisible));
            setColumnOrder([...parsedOrder, ...missingStandardKeys]);
        } catch {
            setVisibleColumns(new Set(defaultVisible));
            setColumnOrder(defaultOrder);
            setCustomColumns([]);
        } finally {
            setColumnPrefsLoaded(true);
        }
    }, [projectId]);

    // Save localStorage prefs when state changes (Pitfall 2: guard must stay with save effect)
    useEffect(() => {
        if (!columnPrefsLoaded || typeof window === 'undefined') return;

        const storageKey = `planckoff-door-columns-${projectId}`;
        const payload: PersistedColumnPrefs = {
            visibleColumns: Array.from(visibleColumns),
            columnOrder,
            customColumns,
        };

        window.localStorage.setItem(storageKey, JSON.stringify(payload));
    }, [projectId, visibleColumns, columnOrder, customColumns, columnPrefsLoaded]);

    const orderedColumns = useMemo(() => {
        const colMap = new Map(ALL_AVAILABLE_COLUMNS.map(c => [c.key, c]));
        return columnOrder.map(key => colMap.get(key)).filter((c): c is ColumnDef => c !== undefined);
    }, [columnOrder]);

    const handleColDragStart = (e: React.DragEvent<HTMLTableCellElement>, colKey: string) => {
        dragSourceKey.current = colKey;
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleColDragOver = (e: React.DragEvent<HTMLTableCellElement>, colKey: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (dragSourceKey.current && dragSourceKey.current !== colKey) {
            setDragOverKey(colKey);
        }
    };

    const handleColDrop = (e: React.DragEvent<HTMLTableCellElement>, targetKey: string) => {
        e.preventDefault();
        const sourceKey = dragSourceKey.current;
        if (!sourceKey || sourceKey === targetKey) { setDragOverKey(null); return; }
        setColumnOrder(prev => {
            const next = [...prev];
            const from = next.indexOf(sourceKey);
            const to = next.indexOf(targetKey);
            if (from === -1 || to === -1) return prev;
            next.splice(from, 1);
            next.splice(to, 0, sourceKey);
            return next;
        });
        dragSourceKey.current = null;
        setDragOverKey(null);
    };

    const handleColDragEnd = () => {
        dragSourceKey.current = null;
        setDragOverKey(null);
    };

    const toggleColumn = (key: string) => {
        setVisibleColumns(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const allSelectableColumnKeys = useMemo(
        () => [...ALL_AVAILABLE_COLUMNS.map(col => col.key), ...customColumns.map(col => col.id)],
        [customColumns]
    );

    const areAllColumnsSelected = allSelectableColumnKeys.length > 0
        && allSelectableColumnKeys.every(key => visibleColumns.has(key));

    const toggleAllColumns = () => {
        setVisibleColumns(() => (
            areAllColumnsSelected
                ? new Set()
                : new Set(allSelectableColumnKeys)
        ));
    };

    const addCustomColumn = () => {
        if (!newColumnName.trim()) {
            addToast({ type: 'warning', message: ERRORS.DOORS.COLUMN_NAME_REQUIRED.message });
            return;
        }
        const id = `custom_${Date.now()}`;
        const newCol: CustomColumn = { id, label: newColumnName, type: newColumnType };

        setCustomColumns(prev => [...prev, newCol]);
        setVisibleColumns(prev => {
            const next = new Set(prev);
            next.add(id);
            return next;
        });
        setNewColumnName('');
        addToast({ type: 'success', message: `Column "${newColumnName}" added` });
    };

    const removeCustomColumn = (id: string) => {
        setCustomColumns(prev => prev.filter(c => c.id !== id));
        setVisibleColumns(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    };

    return {
        visibleColumns, setVisibleColumns,
        columnOrder,
        dragOverKey,
        customColumns,
        isColumnCustomizerOpen, setIsColumnCustomizerOpen,
        newColumnName, setNewColumnName,
        newColumnType, setNewColumnType,
        columnPrefsLoaded,
        orderedColumns,
        allSelectableColumnKeys,
        areAllColumnsSelected,
        handleColDragStart,
        handleColDragOver,
        handleColDrop,
        handleColDragEnd,
        toggleColumn,
        toggleAllColumns,
        addCustomColumn,
        removeCustomColumn,
    };
}
