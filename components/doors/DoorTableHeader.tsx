'use client';
import React from 'react';
import { Door } from '../../types';
import { ColumnDef, CustomColumn } from '../../hooks/useDoorTableState';

interface DoorTableHeaderProps {
    orderedColumns: ColumnDef[];
    customColumns: CustomColumn[];
    filteredAndSortedDoors: Door[];
    selectedRows: Set<string>;
    toggleSelectAll: () => void;
    renderHeader: (col: ColumnDef | CustomColumn) => React.ReactNode;
}

export function DoorTableHeader({
    orderedColumns,
    customColumns,
    filteredAndSortedDoors,
    selectedRows,
    toggleSelectAll,
    renderHeader,
}: DoorTableHeaderProps) {
    return (
        <thead className="text-xs text-[var(--primary-text)] bg-[var(--primary-bg)] sticky top-0 z-10 shadow-[0_1px_0_0_var(--primary-border)]">
            <tr>
                <th scope="col" className="w-10 px-3 py-2.5 border-b border-[var(--primary-border)]">
                    <input
                        type="checkbox"
                        onChange={toggleSelectAll}
                        checked={filteredAndSortedDoors.length > 0 && selectedRows.size === filteredAndSortedDoors.length}
                        className="rounded border-[var(--primary-border)] text-[var(--primary-action)] focus:ring-[var(--primary-ring)] h-3.5 w-3.5 cursor-pointer"
                    />
                </th>

                {orderedColumns.map(col => renderHeader(col))}
                {customColumns.map(col => renderHeader(col))}

                <th scope="col" className="px-2 py-2.5 border-b border-[var(--primary-border)] bg-[var(--primary-bg-hover)] min-w-[140px]">
                    <span className="text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">Assigned Set</span>
                </th>
                <th scope="col" className="px-2 py-2.5 border-b border-[var(--primary-border)] text-center min-w-[80px]">
                    <span className="text-xs font-semibold text-[var(--primary-text)] uppercase tracking-wide">Action</span>
                </th>
            </tr>
        </thead>
    );
}
