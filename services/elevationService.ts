import { supabase } from '../lib/supabase';

const BUCKET = 'door-elevations';
const MAX_W = 1920;
const MAX_H = 1080;
const QUALITY = 0.83;

export async function compressElevationImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  const ratio = Math.min(MAX_W / width, MAX_H / height, 1); // never upscale
  width = Math.round(width * ratio);
  height = Math.round(height * ratio);

  try {
    // OffscreenCanvas runs off the main thread — no UI jank
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return canvas.convertToBlob({ type: 'image/webp', quality: QUALITY });
  } catch {
    // Safari < 16.4 fallback — regular Canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => (blob ? resolve(blob) : reject(new Error('Canvas toBlob returned null'))),
        'image/webp',
        QUALITY,
      );
    });
  }
}

export async function uploadElevationImage(
  projectId: string,
  elevationTypeCode: string,
  blob: Blob,
  kind: 'door' | 'frame' = 'door',
): Promise<{ url: string; path: string }> {
  const safeCode = elevationTypeCode.replace(/[^a-zA-Z0-9\-_]/g, '_');
  const path = `${projectId}/${kind}/${safeCode}-${Date.now()}.webp`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/webp', upsert: false });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, path };
}

export async function deleteElevationImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw new Error(`Delete failed: ${error.message}`);
}

export function getElevationPublicUrl(path: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
