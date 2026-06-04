import { Door, ElevationType } from '@/types';
import { compressElevationImage, deleteElevationImage, uploadElevationImage } from './elevationService';
import { ELEVATION_EXTRACTION } from '@/constants/elevationExtraction';

// ── Normalise type codes ───────────────────────────────────────────────────────
// "TYPE A1" → "A1", "type-b2" → "B2", "01" → "1"
function normalizeCode(code: string): string {
    return code
        .toUpperCase()
        .replace(/^TYPE\s+/, '')
        .replace(/[^A-Z0-9]/g, '')
        .replace(/^0+(?=\d)/, '');
}

function isValidCode(code: string | undefined): code is string {
    if (!code) return false;
    const t = code.trim();
    return t.length > 0 && t !== '0';
}

export function collectElevationCodesFromDoors(doors: Door[]): { code: string; kind: 'door' | 'frame' }[] {
    const seen = new Set<string>();
    const result: { code: string; kind: 'door' | 'frame' }[] = [];

    const add = (code: string, kind: 'door' | 'frame') => {
        const key = `${kind}:${normalizeCode(code)}`;
        if (!seen.has(key)) {
            seen.add(key);
            result.push({ code: code.trim(), kind });
        }
    };

    for (const door of doors) {
        // Only read from parsed JSON sections — top-level elevationTypeId may be a
        // UUID (after manual linking) and must not appear as a card code.
        const sec = door.sections as unknown as Record<string, Record<string, string | undefined>> | undefined;
        const secDoor  = sec?.door?.['DOOR ELEVATION TYPE'];
        const secFrame = sec?.frame?.['FRAME ELEVATION TYPE'];
        if (isValidCode(secDoor))  add(secDoor,  'door');
        if (isValidCode(secFrame)) add(secFrame, 'frame');
    }

    return result;
}

// ── base64 data URL → Blob ────────────────────────────────────────────────────
function dataURLToBlob(dataURL: string): Blob {
    const [header, b64] = dataURL.split(',');
    const mime = header.match(/:(.*?);/)?.[1] ?? 'image/webp';
    const bytes = atob(b64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
}

// ── Save: upload images + return updated ElevationType records ────────────────
export async function saveElevationEnrichments(
    items: Array<{
        elevationTypeId: string;
        elevationTypeCode: string;
        description: string;
        croppedImageBase64: string;   // empty string = description-only, no new image upload
        kind: 'door' | 'frame';
        existingImagePath?: string;
        existingImageUrl?: string;    // kept as-is when croppedImageBase64 is empty
    }>,
    projectId: string,
): Promise<ElevationType[]> {
    const results: ElevationType[] = [];
    const errors: string[] = [];

    for (const item of items) {
        try {
            // ── Description-only update: no new image ─────────────────────────
            if (!item.croppedImageBase64) {
                results.push({
                    id: item.elevationTypeId || crypto.randomUUID(),
                    name: item.elevationTypeCode,
                    code: item.elevationTypeCode,
                    kind: item.kind,
                    description: item.description || undefined,
                    imageUrl: item.existingImageUrl,
                    imagePath: item.existingImagePath,
                });
                continue;
            }

            // ── Image upload (with optional old-file cleanup) ─────────────────
            if (item.existingImagePath) {
                try {
                    await deleteElevationImage(item.existingImagePath);
                } catch {
                    console.warn(`[elevationExtractor] Could not delete old image: ${item.existingImagePath}`);
                }
            }

            const blob = dataURLToBlob(item.croppedImageBase64);
            const imageFile = new File([blob], `${item.elevationTypeCode}.webp`, { type: 'image/webp' });

            const compressed = await compressElevationImage(imageFile);
            const { url, path } = await uploadElevationImage(
                projectId, item.elevationTypeCode, compressed, item.kind,
            );

            results.push({
                id: item.elevationTypeId || crypto.randomUUID(),
                name: item.elevationTypeCode,
                code: item.elevationTypeCode,
                kind: item.kind,
                description: item.description || undefined,
                imageUrl: url,
                imagePath: path,
            });
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`${item.elevationTypeCode}: ${msg}`);
            console.error(`[elevationExtractor] Upload failed for ${item.elevationTypeCode}:`, msg);
        }
    }

    if (errors.length > 0 && results.length === 0) {
        throw new Error(`All uploads failed:\n${errors.join('\n')}`);
    }

    if (errors.length > 0) {
        throw Object.assign(
            new Error(`${results.length} saved, ${errors.length} failed: ${errors.join('; ')}`),
            { partial: true, results },
        );
    }

    return results;
}

export function validateElevationPDFFile(file: File): void {
    if (!(ELEVATION_EXTRACTION.SUPPORTED_FILE_TYPES as readonly string[]).includes(file.type)) {
        throw new Error('Only PDF files are supported for elevation extraction.');
    }
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > ELEVATION_EXTRACTION.MAX_FILE_SIZE_MB) {
        throw new Error(
            `File is ${sizeMB.toFixed(1)} MB. Maximum allowed is ${ELEVATION_EXTRACTION.MAX_FILE_SIZE_MB} MB.`,
        );
    }
}
