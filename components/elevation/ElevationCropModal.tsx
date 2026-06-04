'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Crop, Minus, Plus, RotateCcw, Maximize2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PDFPageTextItem } from '@/utils/pdfParser';

// ── Types ────────────────────────────────────────────────────────────────────

interface Rect { x: number; y: number; w: number; h: number }

export interface PageImage {
    pageNumber: number;
    imageBase64: string;
    textItems: PDFPageTextItem[];
}

interface ElevationCropModalProps {
    pageImages: PageImage[];
    typeCode: string;
    onSave: (croppedBase64: string) => void;
    onClose: () => void;
}

// ── Constants ────────────────────────────────────────────────────────────────

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;
const ZOOM_STEP = 0.35;

// ── Component ────────────────────────────────────────────────────────────────

export default function ElevationCropModal({
    pageImages,
    typeCode,
    onSave,
    onClose,
}: ElevationCropModalProps) {
    const canvasRef    = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const imgRef       = useRef<HTMLImageElement | null>(null);

    // ── Page navigation ───────────────────────────────────────────────────
    const [currentPageIdx, setCurrentPageIdx] = useState(0);
    const totalPages = pageImages.length;

    // ── Transform state ───────────────────────────────────────────────────
    const panX = useRef(0);
    const panY = useRef(0);
    const zoom = useRef(1);

    // ── Crop rect (image pixels) ──────────────────────────────────────────
    const cropRef = useRef<Rect | null>(null);
    const [crop, setCrop] = useState<Rect | null>(null);
    const [zoomDisplay, setZoomDisplay] = useState(100);

    // ── Drag state ────────────────────────────────────────────────────────
    const drawStart  = useRef<{ ix: number; iy: number } | null>(null);
    const isDrawing  = useRef(false);
    const panStart   = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
    const isPanning  = useRef(false);

    const [loaded, setLoaded] = useState(false);

    // (text extraction feedback states removed — description is typed manually)

    // ── Coordinate helpers ────────────────────────────────────────────────

    const canvasToImg = useCallback((cx: number, cy: number) => {
        const canvas = canvasRef.current!;
        const s      = zoom.current;
        const bscale = Math.min(canvas.width  / (imgRef.current?.width  ?? 1),
                                canvas.height / (imgRef.current?.height ?? 1));
        return {
            ix: panX.current + (cx - canvas.width  / 2) / (s * bscale),
            iy: panY.current + (cy - canvas.height / 2) / (s * bscale),
        };
    }, []);

    const imgToCanvas = useCallback((ix: number, iy: number) => {
        const canvas = canvasRef.current!;
        const s      = zoom.current;
        const bscale = Math.min(canvas.width  / (imgRef.current?.width  ?? 1),
                                canvas.height / (imgRef.current?.height ?? 1));
        return {
            cx: (ix - panX.current) * s * bscale + canvas.width  / 2,
            cy: (iy - panY.current) * s * bscale + canvas.height / 2,
        };
    }, []);

    // ── Draw ──────────────────────────────────────────────────────────────

    const redraw = useCallback(() => {
        const canvas = canvasRef.current;
        const img    = imgRef.current;
        if (!canvas || !img) return;

        const ctx           = canvas.getContext('2d')!;
        const s             = zoom.current;
        const bscale        = Math.min(canvas.width / img.width, canvas.height / img.height);
        const effectiveScale = s * bscale;

        const dw = img.width  * effectiveScale;
        const dh = img.height * effectiveScale;
        const dx = canvas.width  / 2 - panX.current * effectiveScale;
        const dy = canvas.height / 2 - panY.current * effectiveScale;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, dx, dy, dw, dh);

        const rect = cropRef.current;
        if (rect) {
            const { cx: rx,  cy: ry  } = imgToCanvas(rect.x, rect.y);
            const { cx: rx2, cy: ry2 } = imgToCanvas(rect.x + rect.w, rect.y + rect.h);
            const rw = rx2 - rx;
            const rh = ry2 - ry;

            // Dim outside the selection
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.52)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fillRect(rx, ry, rw, rh);
            ctx.restore();

            // Re-draw selected area at full brightness
            ctx.drawImage(img, rect.x, rect.y, rect.w, rect.h, rx, ry, rw, rh);

            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth   = 2;
            ctx.setLineDash([7, 4]);
            ctx.strokeRect(rx, ry, rw, rh);
            ctx.setLineDash([]);

            // Corner handles
            ctx.fillStyle = '#3b82f6';
            [[rx, ry], [rx + rw, ry], [rx, ry + rh], [rx + rw, ry + rh]].forEach(
                ([hx, hy]) => ctx.fillRect(hx - 5, hy - 5, 10, 10),
            );

            // Size label
            const label = `${Math.round(rect.w)} × ${Math.round(rect.h)} px`;
            ctx.font = 'bold 12px system-ui, sans-serif';
            const tw = ctx.measureText(label).width;
            ctx.fillStyle = 'rgba(30,64,175,0.85)';
            ctx.fillRect(rx + 4, ry + 4, tw + 12, 22);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, rx + 10, ry + 19);
        }

        setZoomDisplay(Math.round(s * 100));
    }, [imgToCanvas]);

    // ── Load image on page change ─────────────────────────────────────────

    useEffect(() => {
        setLoaded(false);
        imgRef.current  = null;
        cropRef.current = null;
        setCrop(null);

        const img = new Image();
        img.onload = () => { imgRef.current = img; setLoaded(true); };
        img.src = pageImages[currentPageIdx].imageBase64;
    }, [currentPageIdx, pageImages]);

    // ── Resize canvas + reset view after image loads ──────────────────────

    useEffect(() => {
        const canvas    = canvasRef.current;
        const container = containerRef.current;
        const img       = imgRef.current;
        if (!canvas || !container || !img || !loaded) return;

        canvas.width  = container.clientWidth;
        canvas.height = container.clientHeight;
        panX.current  = img.width  / 2;
        panY.current  = img.height / 2;
        zoom.current  = 1;
        redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loaded]);

    // ── Zoom helpers ──────────────────────────────────────────────────────

    const applyZoom = useCallback((newZoom: number, cx?: number, cy?: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const clamped = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoom));
        if (cx !== undefined && cy !== undefined) {
            const before = canvasToImg(cx, cy);
            zoom.current = clamped;
            const after  = canvasToImg(cx, cy);
            panX.current += before.ix - after.ix;
            panY.current += before.iy - after.iy;
        } else {
            zoom.current = clamped;
        }
        redraw();
    }, [canvasToImg, redraw]);

    const zoomIn  = () => applyZoom(zoom.current + ZOOM_STEP);
    const zoomOut = () => applyZoom(zoom.current - ZOOM_STEP);

    const fitPage = useCallback(() => {
        const img = imgRef.current;
        if (!img) return;
        panX.current = img.width  / 2;
        panY.current = img.height / 2;
        zoom.current = 1;
        redraw();
    }, [redraw]);

    // ── Mouse wheel — zoom or Shift+scroll horizontal pan ─────────────────

    const onWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const canvas = canvasRef.current!;
        if (e.shiftKey) {
            const bscale = Math.min(canvas.width  / (imgRef.current?.width  ?? 1),
                                    canvas.height / (imgRef.current?.height ?? 1));
            panX.current += e.deltaY / (zoom.current * bscale);
            redraw();
            return;
        }
        const r  = canvas.getBoundingClientRect();
        const cx = (e.clientX - r.left) * (canvas.width  / r.width);
        const cy = (e.clientY - r.top)  * (canvas.height / r.height);
        applyZoom(zoom.current + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), cx, cy);
    }, [applyZoom, redraw]);

    // ── Mouse events ──────────────────────────────────────────────────────

    const getCanvasPt = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current!;
        const r      = canvas.getBoundingClientRect();
        return {
            cx: (e.clientX - r.left) * (canvas.width  / r.width),
            cy: (e.clientY - r.top)  * (canvas.height / r.height),
        };
    };

    const onMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        e.preventDefault();
        const { cx, cy } = getCanvasPt(e);
        if (e.button === 1 || e.button === 2 || e.ctrlKey) {
            isPanning.current = true;
            panStart.current  = { mx: cx, my: cy, px: panX.current, py: panY.current };
        } else {
            isDrawing.current = true;
            const { ix, iy }  = canvasToImg(cx, cy);
            drawStart.current = { ix, iy };
            cropRef.current   = null;
            setCrop(null);
            redraw();
        }
    };

    const onMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const { cx, cy } = getCanvasPt(e);
        const img = imgRef.current;
        if (isPanning.current && panStart.current) {
            const canvas = canvasRef.current!;
            const bscale = Math.min(canvas.width / (img?.width ?? 1), canvas.height / (img?.height ?? 1));
            const eff    = zoom.current * bscale;
            panX.current = panStart.current.px - (cx - panStart.current.mx) / eff;
            panY.current = panStart.current.py - (cy - panStart.current.my) / eff;
            redraw();
        } else if (isDrawing.current && drawStart.current && img) {
            const { ix, iy } = canvasToImg(cx, cy);
            const x = Math.max(0, Math.min(drawStart.current.ix, ix));
            const y = Math.max(0, Math.min(drawStart.current.iy, iy));
            const w = Math.min(img.width  - x, Math.abs(ix - drawStart.current.ix));
            const h = Math.min(img.height - y, Math.abs(iy - drawStart.current.iy));
            cropRef.current = { x, y, w, h };
            setCrop({ x, y, w, h });
            redraw();
        }
    };

    const onMouseUp = () => {
        isDrawing.current = false;
        isPanning.current = false;
        drawStart.current = null;
        panStart.current  = null;
    };

    // ── Clear ─────────────────────────────────────────────────────────────

    const handleClear = useCallback(() => {
        cropRef.current = null;
        setCrop(null);
        redraw();
    }, [redraw]);

    // ── Save image crop ───────────────────────────────────────────────────

    const handleSaveImage = () => {
        const img  = imgRef.current;
        const rect = cropRef.current;
        if (!img || !rect || rect.w < 2 || rect.h < 2 || !onSave) return;

        const out = document.createElement('canvas');
        out.width  = Math.round(rect.w);
        out.height = Math.round(rect.h);
        out.getContext('2d')!.drawImage(img, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
        onSave(out.toDataURL('image/webp', 0.92));
    };

    // ── Text mode: description is typed manually by the user ─────────────
    // The AI/OCR extraction approach has been commented out — the user
    // types the description directly in the card's input field instead.

    /*
    const extractTextFromItems = useCallback((): string | null => { ... }, []);
    const extractTextViaAI     = useCallback(async (): Promise<string | null> => { ... }, []);
    const handleExtractText    = useCallback(async () => { ... }, []);
    */

    // ── Page navigation ───────────────────────────────────────────────────

    const goToPrevPage = () => setCurrentPageIdx(i => Math.max(0, i - 1));
    const goToNextPage = () => setCurrentPageIdx(i => Math.min(totalPages - 1, i + 1));

    // ── Cursor ────────────────────────────────────────────────────────────

    const [cursor, setCursor] = useState('crosshair');
    const onMouseMoveForCursor = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (isPanning.current)            setCursor('grabbing');
        else if (e.buttons === 2 || e.buttons === 4 || e.ctrlKey) setCursor('grab');
        else                              setCursor('crosshair');
        onMouseMove(e);
    };

    // ── Derived ───────────────────────────────────────────────────────────

    const headerTitle = `Crop Elevation — ${typeCode}`;
    const hintAction  = 'Draw a selection over the elevation drawing';

    // ── Render ────────────────────────────────────────────────────────────

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-3">
            <div
                className="bg-[var(--bg)] rounded-xl shadow-2xl flex flex-col overflow-hidden"
                style={{ width: '92vw', height: '92vh' }}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <Crop className="w-4 h-4 text-[var(--primary-text)]" />
                        <span className="text-sm font-semibold text-[var(--text)]">
                            {headerTitle}
                        </span>
                    </div>

                    {/* Page navigation */}
                    {totalPages > 1 && (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={goToPrevPage}
                                disabled={currentPageIdx === 0}
                                className="p-1.5 rounded-lg hover:bg-[var(--primary-bg-hover)] text-[var(--text-muted)] border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Previous page"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-xs text-[var(--text-muted)] px-2 tabular-nums select-none">
                                Page {pageImages[currentPageIdx].pageNumber} of {totalPages}
                            </span>
                            <button
                                onClick={goToNextPage}
                                disabled={currentPageIdx === totalPages - 1}
                                className="p-1.5 rounded-lg hover:bg-[var(--primary-bg-hover)] text-[var(--text-muted)] border border-[var(--border)] disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Next page"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}

                    {/* Zoom controls */}
                    <div className="flex items-center gap-1">
                        <button onClick={zoomOut} className="p-1.5 rounded-lg hover:bg-[var(--primary-bg-hover)] text-[var(--text-muted)] border border-[var(--border)]" title="Zoom out">
                            <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs font-mono text-[var(--text-muted)] w-12 text-center select-none">
                            {zoomDisplay}%
                        </span>
                        <button onClick={zoomIn} className="p-1.5 rounded-lg hover:bg-[var(--primary-bg-hover)] text-[var(--text-muted)] border border-[var(--border)]" title="Zoom in">
                            <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={fitPage} className="p-1.5 rounded-lg hover:bg-[var(--primary-bg-hover)] text-[var(--text-muted)] border border-[var(--border)] ml-1" title="Fit full page">
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    <button onClick={onClose} className="p-1 rounded-lg hover:bg-[var(--primary-bg-hover)] text-[var(--text-muted)]">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Hint bar */}
                <div className="px-4 py-1.5 border-b border-[var(--border)] flex-shrink-0 flex items-center gap-3">
                    <p className="text-xs text-[var(--text-faint)] flex-1">
                        <span className="font-medium text-[var(--text-muted)]">{hintAction}</span>
                        &nbsp;·&nbsp;
                        <span className="font-medium text-[var(--text-muted)]">Ctrl + drag</span> — pan &nbsp;·&nbsp;
                        <span className="font-medium text-[var(--text-muted)]">Scroll</span> — zoom &nbsp;·&nbsp;
                        <span className="font-medium text-[var(--text-muted)]">Shift + scroll</span> — pan left/right
                        {totalPages > 1 && (
                            <> &nbsp;·&nbsp; <span className="font-medium text-[var(--text-muted)]">← →</span> — switch page</>
                        )}
                    </p>
                </div>

                {/* Canvas */}
                <div ref={containerRef} className="flex-1 overflow-hidden relative">
                    {!loaded && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <p className="text-sm text-[var(--text-faint)]">Loading page…</p>
                        </div>
                    )}
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                        style={{ cursor, display: loaded ? 'block' : 'none' }}
                        onContextMenu={e => e.preventDefault()}
                        onWheel={onWheel}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMoveForCursor}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                    />
                </div>

                {/* Footer */}
                <div className="flex items-center px-4 py-2.5 border-t border-[var(--border)] flex-shrink-0 gap-2">
                    <Button variant="outline" size="sm" onClick={handleClear} disabled={!crop}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                        Clear
                    </Button>

                    <div className="flex gap-2 ml-auto">
                        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
                        <Button size="sm" onClick={handleSaveImage} disabled={!crop || crop.w < 5}>
                            Save Crop
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
