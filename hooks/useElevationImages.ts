import { useState } from 'react';
import type { ElevationType } from '@/types';
import type { DoorGroup } from '@/components/doorSchedule/doorScheduleTypes';
import { fetchImageInfo, type ImageInfo } from '@/utils/imageUtils';

export function useElevationImages(elevationTypes: ElevationType[]) {
    const [showElevationImages, setShowElevationImages] = useState(false);

    // Preload images for ALL project elevation types regardless of door linkage.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const preloadElevationImages = async (_groupsToExport: DoorGroup[]): Promise<Map<string, ImageInfo>> => {
        const imageInfoMap = new Map<string, ImageInfo>();
        if (!showElevationImages || elevationTypes.length === 0) return imageInfoMap;

        await Promise.all(elevationTypes.map(async et => {
            const src = et.imageData || et.imageUrl;
            if (!src) return;
            const info = await fetchImageInfo(src);
            if (info) imageInfoMap.set(et.id, info);
        }));
        return imageInfoMap;
    };

    return { showElevationImages, setShowElevationImages, preloadElevationImages };
}
