import { useState, useMemo, useCallback } from 'react';
import type { Door } from '@/types';
import type { GroupLevel, DoorGroup } from '@/components/doorSchedule/doorScheduleTypes';
import { GROUPING_FIELDS } from '@/components/doorSchedule/doorScheduleTypes';
import { groupDoorsByLevels, makeGroupId } from '@/utils/doorScheduleUtils';

interface UseDoorAggregationParams {
    includedDoors: Door[];
    setPreviewReady: (ready: boolean) => void;
}

export function useDoorAggregation({ includedDoors, setPreviewReady }: UseDoorAggregationParams) {
    const [groupLevels, setGroupLevels]             = useState<GroupLevel[]>([]);
    const [pickerOpen, setPickerOpen]               = useState(false);
    const [pickerForLevelId, setPickerForLevelId]   = useState<string | null>(null);
    const [uniqueData, setUniqueData]               = useState(false);

    // Picker modal state: null = adding new level, string = editing that level id
    const openPicker = useCallback((levelId: string | null = null) => {
        setPickerForLevelId(levelId);
        setPickerOpen(true);
    }, []);

    const handlePickField = useCallback((colId: string) => {
        const gf = GROUPING_FIELDS.find(f => f.colId === colId);
        if (!gf) return;
        if (pickerForLevelId === null) {
            // Multi-select toggle mode — add if not present, remove if already selected
            setGroupLevels(p =>
                p.some(l => l.colId === colId)
                    ? p.filter(l => l.colId !== colId)
                    : [...p, { id: makeGroupId(), colId: gf.colId, label: gf.label }],
            );
        } else {
            // Edit mode — replace one level and close
            setGroupLevels(p => p.map(l => l.id === pickerForLevelId ? { ...l, colId: gf.colId, label: gf.label } : l));
            setPickerOpen(false);
        }
        setPreviewReady(false);
    }, [pickerForLevelId, setPreviewReady]);

    const removeGroupLevel = useCallback((id: string) => {
        setGroupLevels(p => p.filter(l => l.id !== id));
        setPreviewReady(false);
    }, [setPreviewReady]);

    const groups        = useMemo<DoorGroup[]>(() => groupDoorsByLevels(includedDoors, groupLevels), [includedDoors, groupLevels]);
    const usedGroupColIds = useMemo(() => new Set(groupLevels.map(l => l.colId)), [groupLevels]);

    return {
        groupLevels,
        groups,
        usedGroupColIds,
        pickerOpen,
        pickerForLevelId,
        uniqueData,
        openPicker,
        handlePickField,
        setPickerOpen,
        setUniqueData,
        removeGroupLevel,
    };
}
