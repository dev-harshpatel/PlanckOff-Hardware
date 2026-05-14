'use client';
import { useState, useMemo } from 'react';
import { Door } from '../../types';
import { StatusFilter } from './columnDefinitions';

interface UseFilterStateParams {
    doors: Door[];
}

export function useFilterState({ doors }: UseFilterStateParams) {
    const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
    const [doorMaterialFilter, setDoorMaterialFilter] = useState<string>('all');
    const [frameMaterialFilter, setFrameMaterialFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: keyof Door; direction: 'asc' | 'desc' } | null>(null);

    const statusCounts = useMemo(() => {
        if (!Array.isArray(doors)) return { pending: 0, complete: 0, error: 0 };
        return doors.reduce((acc, door) => {
            acc[door.status] = (acc[door.status] || 0) + 1;
            return acc;
        }, {} as Record<'pending' | 'complete', number>);
    }, [doors]);

    const uniqueDoorMaterials = useMemo(() => {
        if (!Array.isArray(doors)) return [];
        const materials = new Set(doors.map(d => d.doorMaterial).filter(m => m && m !== "Not Selected" && m.trim() !== ""));
        return Array.from(materials).sort();
    }, [doors]);

    const uniqueFrameMaterials = useMemo(() => {
        if (!Array.isArray(doors)) return [];
        const materials = new Set(doors.map(d => d.frameMaterial).filter(m => m && m !== "Not Selected" && m.trim() !== ""));
        return Array.from(materials).sort();
    }, [doors]);

    const handleSort = (key: keyof Door) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const filteredAndSortedDoors = useMemo(() => {
        let result = doors;

        if (statusFilter !== 'all') {
            result = result.filter(door => door.status === statusFilter);
        }

        if (doorMaterialFilter !== 'all') {
            result = result.filter(door => door.doorMaterial === doorMaterialFilter);
        }

        if (frameMaterialFilter !== 'all') {
            result = result.filter(door => door.frameMaterial === frameMaterialFilter);
        }

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            result = result.filter(d => {
                const standardMatch = Object.entries(d).some(([key, val]) => {
                    if (key === 'customFields' || typeof val === 'object' || val === undefined || val === null) return false;
                    return String(val).toLowerCase().includes(query);
                });
                if (standardMatch) return true;

                if (d.customFields) {
                    return Object.values(d.customFields).some(val => String(val).toLowerCase().includes(query));
                }
                return false;
            });
        }

        if (sortConfig) {
            result = [...result].sort((a, b) => {
                let aVal: any = a[sortConfig.key as keyof Door];
                let bVal: any = b[sortConfig.key as keyof Door];

                if (aVal === undefined && a.customFields) aVal = a.customFields[sortConfig.key as string];
                if (bVal === undefined && b.customFields) bVal = b.customFields[sortConfig.key as string];

                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;

                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    return sortConfig.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
                }

                if (aVal < bVal) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (aVal > bVal) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return result;
    }, [doors, statusFilter, doorMaterialFilter, frameMaterialFilter, searchQuery, sortConfig]);

    return {
        statusFilter, setStatusFilter,
        doorMaterialFilter, setDoorMaterialFilter,
        frameMaterialFilter, setFrameMaterialFilter,
        searchQuery, setSearchQuery,
        sortConfig,
        handleSort,
        statusCounts,
        uniqueDoorMaterials,
        uniqueFrameMaterials,
        filteredAndSortedDoors,
    };
}
