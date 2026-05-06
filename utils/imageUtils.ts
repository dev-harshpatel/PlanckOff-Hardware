export interface ImageInfo { dataUrl: string; w: number; h: number }

export async function imageToDataUrl(src: string): Promise<string | null> {
    try {
        if (src.startsWith('data:')) return src;
        const resp = await fetch(src);
        if (!resp.ok) return null;
        const blob = await resp.blob();
        return new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch { return null; }
}

export async function fetchImageInfo(src: string): Promise<ImageInfo | null> {
    const dataUrl = await imageToDataUrl(src);
    if (!dataUrl) return null;
    return new Promise(resolve => {
        const img = new window.Image();
        img.onload = () => resolve({ dataUrl, w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => resolve(null);
        img.src = dataUrl;
    });
}
