import { useState, useMemo, useCallback } from 'react';

export type FilterMatcher<T> = (item: T, value: string) => boolean;

export interface FilterDef<T> {
    key: string;
    defaultValue?: string;
    match: FilterMatcher<T>;
}

export interface TableFiltersState<T> {
    filtered: T[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    filterValues: Record<string, string>;
    setFilter: (key: string, value: string) => void;
    resetFilters: () => void;
}

/**
 * Generic filter + search state for tabular data.
 * Pass `filters` to define each filterable dimension.
 * Search is applied as an AND on top of all filters.
 */
export function useTableFilters<T>(
    items: T[],
    filters: FilterDef<T>[],
    searchMatcher?: (item: T, query: string) => boolean,
): TableFiltersState<T> {
    const defaults = useMemo(() => {
        const d: Record<string, string> = {};
        for (const f of filters) d[f.key] = f.defaultValue ?? 'all';
        return d;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const [searchQuery, setSearchQuery] = useState('');
    const [filterValues, setFilterValues] = useState<Record<string, string>>(defaults);

    const setFilter = useCallback((key: string, value: string) => {
        setFilterValues(prev => ({ ...prev, [key]: value }));
    }, []);

    const resetFilters = useCallback(() => {
        setSearchQuery('');
        setFilterValues(defaults);
    }, [defaults]);

    const filtered = useMemo(() => {
        let result = items;

        for (const f of filters) {
            const val = filterValues[f.key] ?? 'all';
            if (val !== 'all') {
                result = result.filter(item => f.match(item, val));
            }
        }

        if (searchQuery.trim() && searchMatcher) {
            const q = searchQuery.toLowerCase();
            result = result.filter(item => searchMatcher(item, q));
        }

        return result;
    }, [items, filters, filterValues, searchQuery, searchMatcher]);

    return { filtered, searchQuery, setSearchQuery, filterValues, setFilter, resetFilters };
}
