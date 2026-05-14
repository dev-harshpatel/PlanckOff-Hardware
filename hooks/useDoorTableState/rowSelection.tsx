'use client';
import { useState, useEffect, useRef } from 'react';
import { Door } from '../../types';

interface UseRowSelectionParams {
    filteredAndSortedDoors: Door[];
}

export function useRowSelection({ filteredAndSortedDoors }: UseRowSelectionParams) {
    const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
    const filterMenuRef = useRef<HTMLDivElement>(null);

    // Click-outside handler — must stay co-located with isFilterMenuOpen and filterMenuRef (Pitfall 1)
    useEffect(() => {
        if (!isFilterMenuOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Element;
            if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
                if (!target.closest?.('[data-radix-popper-content-wrapper]')) {
                    setIsFilterMenuOpen(false);
                }
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isFilterMenuOpen]);

    const toggleSelectAll = () => {
        if (selectedRows.size === filteredAndSortedDoors.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(filteredAndSortedDoors.map(d => d.id)));
        }
    };

    const toggleRowSelection = (id: string) => {
        const next = new Set(selectedRows);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedRows(next);
    };

    return {
        selectedRows,
        reportModalOpen, setReportModalOpen,
        isFilterMenuOpen, setIsFilterMenuOpen,
        filterMenuRef,
        toggleSelectAll,
        toggleRowSelection,
    };
}
