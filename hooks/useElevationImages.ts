import { useState } from 'react';
import type { ElevationType } from '@/types';
import type { DoorGroup } from '@/components/doorSchedule/doorScheduleTypes';
import { collectGroupElevationTypes } from '@/utils/elevationUtils';
import { fetchImageInfo, type ImageInfo } from '@/utils/imageUtils';

export function useElevationImages(elevationTypes: ElevationType[]) {
    const [showElevationImages, setShowElevationImages] = useState(false);

    const preloadElevationImages = async (groupsToExport: DoorGroup[]): Promise<Map<string, ImageInfo>> => {
        const imageInfoMap = new Map<string, ImageInfo>();
        if (!showElevationImages || elevationTypes.length === 0) return imageInfoMap;

        const allUsedTypes: ElevationType[] = [];
        const seen = new Set<string>();
        for (const group of groupsToExport) {
            for (const et of collectGroupElevationTypes(group.doors, elevationTypes)) {
                if (!seen.has(et.id)) { seen.add(et.id); allUsedTypes.push(et); }
            }
        }
        await Promise.all(allUsedTypes.map(async et => {
            const src = et.imageData || et.imageUrl;
            if (!src) return;
            const info = await fetchImageInfo(src);
            if (info) imageInfoMap.set(et.id, info);
        }));
        return imageInfoMap;
    };

    return { showElevationImages, setShowElevationImages, preloadElevationImages };
}
