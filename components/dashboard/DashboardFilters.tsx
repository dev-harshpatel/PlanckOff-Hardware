'use client';

import React from 'react';
import SelectDropdown from '@/components/ui/select-dropdown';
import { Search, Filter, LayoutGrid, List } from 'lucide-react';

export interface DashboardFiltersProps {
    searchQuery: string;
    onSearchChange: (q: string) => void;
    selectedMemberFilter: string;
    onMemberFilterChange: (value: string) => void;
    memberFilterOptions: Array<{ value: string; label: string }>;
    isLoadingTeamMembers: boolean;
    viewMode: 'grid' | 'list';
    onViewModeChange: (mode: 'grid' | 'list') => void;
}

export function DashboardFilters({
    searchQuery,
    onSearchChange,
    selectedMemberFilter,
    onMemberFilterChange,
    memberFilterOptions,
    isLoadingTeamMembers,
    viewMode,
    onViewModeChange,
}: DashboardFiltersProps) {
    return (
        <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3 flex-shrink-0">
            <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-faint)] pointer-events-none" />
                <input
                    type="text"
                    placeholder="Search projects or clients…"
                    value={searchQuery}
                    onChange={e => onSearchChange(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-[var(--border)] rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] bg-[var(--bg)] text-[var(--text)] placeholder:text-[var(--text-faint)]"
                />
            </div>
            <div className="relative min-w-[200px]">
                <Filter className="absolute left-3 top-1/2 z-10 h-3.5 w-3.5 -translate-y-1/2 text-[var(--text-faint)] pointer-events-none" />
                <SelectDropdown
                    value={selectedMemberFilter}
                    onChange={onMemberFilterChange}
                    options={memberFilterOptions}
                    disabled={isLoadingTeamMembers}
                    className="w-full"
                    triggerClassName="border-[var(--border)] bg-[var(--bg)] pl-9 pr-3 hover:bg-[var(--bg-subtle)] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    contentClassName="mt-1"
                />
            </div>
            <div className="ml-auto flex items-center gap-1">
                <button
                    onClick={() => onViewModeChange('grid')}
                    className={`p-1.5 rounded-md border transition-colors ${viewMode === 'grid' ? 'bg-[var(--primary-bg)] text-[var(--primary-text-muted)] border-[var(--primary-border)]' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)] border-transparent'}`}
                    title="Grid view"
                >
                    <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                    onClick={() => onViewModeChange('list')}
                    className={`p-1.5 rounded-md border transition-colors ${viewMode === 'list' ? 'bg-[var(--primary-bg)] text-[var(--primary-text-muted)] border-[var(--primary-border)]' : 'text-[var(--text-faint)] hover:bg-[var(--bg-muted)] hover:text-[var(--text-muted)] border-transparent'}`}
                    title="List view"
                >
                    <List className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
