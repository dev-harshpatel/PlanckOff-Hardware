'use client';

import React, { useCallback, useRef, useState } from 'react';
import {
    AlertCircle, CheckCircle2, Crop, DoorOpen,
    FileX, ImagePlus, Loader2, Upload,
} from 'lucide-react';
import { Door, ElevationType } from '@/types';
import {
    collectElevationCodesFromDoors,
    saveElevationEnrichments,
    validateElevationPDFFile,
} from '@/services/elevationExtractorService';
import { renderPDFPagesAsImages } from '@/utils/pdfParser';
import { Button } from '@/components/ui/button';
import ElevationCropModal, { PageImage } from './ElevationCropModal';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ElevationExtractorPageProps {
    projectId: string;
    doors: Door[];
    existingElevationTypes: ElevationType[];
    onSave: (newTypes: ElevationType[]) => void;
    onClose: () => void;
}

type PdfStage = 'idle' | 'rendering' | 'ready';

interface ElevationCard {
    code: string;
    kind: 'door' | 'frame';
    existingId: string;
    existingImageUrl: string | null;
    existingImagePath: string | null;
    description: string;
    croppedImage: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildCards(doors: Door[], existingElevationTypes: ElevationType[]): ElevationCard[] {
    const knownCodes = collectElevationCodesFromDoors(doors);
    return knownCodes.map(({ code, kind }) => {
        const existing = existingElevationTypes.find(
            et => et.code === code && (et.kind === kind || (kind === 'door' && !et.kind)),
        );
        return {
            code,
            kind,
            existingId: existing?.id ?? '',
            existingImageUrl: existing?.imageUrl ?? null,
            existingImagePath: existing?.imagePath ?? null,
            description: existing?.description ?? '',
            croppedImage: null,
        };
    });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ElevationExtractorPage({
    projectId,
    doors,
    existingElevationTypes,
    onSave,
    onClose,
}: ElevationExtractorPageProps) {
    const [cards, setCards] = useState<ElevationCard[]>(() =>
        buildCards(doors, existingElevationTypes),
    );

    const [pdfStage, setPdfStage] = useState<PdfStage>('idle');
    const [pdfFileName, setPdfFileName] = useState('');
    const [renderProgress, setRenderProgress] = useState({ label: '', percent: 0 });
    const [pageImages, setPageImages] = useState<PageImage[]>([]);

    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);

    const [cropTarget, setCropTarget] = useState<{
        code: string;
        kind: 'door' | 'frame';
    } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Card helpers ──────────────────────────────────────────────────────────

    const updateCard = useCallback(
        (code: string, kind: 'door' | 'frame', update: Partial<ElevationCard>) => {
            setCards(prev =>
                prev.map(c => (c.code === code && c.kind === kind ? { ...c, ...update } : c)),
            );
        },
        [],
    );

    // ── PDF handling ──────────────────────────────────────────────────────────

    const handleFile = useCallback(async (file: File) => {
        setError(null);
        try { validateElevationPDFFile(file); }
        catch (e: unknown) { setError(e instanceof Error ? e.message : String(e)); return; }

        setPdfFileName(file.name);
        setPdfStage('rendering');
        setRenderProgress({ label: 'Starting…', percent: 0 });

        try {
            const pages: PageImage[] = [];
            for await (const page of renderPDFPagesAsImages(file)) {
                pages.push({ pageNumber: page.pageNumber, imageBase64: page.imageBase64, textItems: page.textItems });
                setRenderProgress({
                    label: `Rendering page ${page.pageNumber} of ${page.totalPages}…`,
                    percent: page.progress,
                });
            }
            setPageImages(pages);
            setPdfStage('ready');
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Failed to render PDF.');
            setPdfStage('idle');
        }
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    }, [handleFile]);

    const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
        e.target.value = '';
    }, [handleFile]);

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = useCallback(async () => {
        // Save cards that have a new image crop OR a description that differs
        // from what's already stored on the existing ElevationType.
        const dirtyCards = cards.filter(card => {
            if (card.croppedImage !== null) return true;
            const existing = existingElevationTypes.find(
                et => et.code === card.code && (et.kind === card.kind || (card.kind === 'door' && !et.kind)),
            );
            return card.description !== (existing?.description ?? '');
        });
        if (dirtyCards.length === 0) return;

        setSaving(true);
        setError(null);

        const items = dirtyCards.map(card => ({
            elevationTypeId: card.existingId,
            elevationTypeCode: card.code,
            description: card.description,
            croppedImageBase64: card.croppedImage ?? '',  // empty = description-only update
            kind: card.kind,
            existingImagePath: card.existingImagePath ?? undefined,
            existingImageUrl: card.existingImageUrl ?? undefined,
        }));

        try {
            const newTypes = await saveElevationEnrichments(items, projectId);
            onSave(newTypes);
        } catch (e: unknown) {
            const partial = e as { partial?: boolean; results?: ElevationType[] };
            if (partial?.partial && partial.results && partial.results.length > 0) {
                onSave(partial.results);
                setError(
                    `${partial.results.length} elevation${partial.results.length !== 1 ? 's' : ''} saved. ` +
                    `Some uploads failed — check your connection and try again for the rest.`,
                );
                setSaving(false);
                return;
            }
            setError(
                e instanceof Error
                    ? e.message.replace('All uploads failed:\n', 'Upload failed: ')
                    : 'Save failed. Check your connection and try again.',
            );
            setSaving(false);
        }
    }, [cards, onSave, projectId]);

    // ── Derived ───────────────────────────────────────────────────────────────

    const croppedCount = cards.filter(c =>
        c.croppedImage !== null ||
        c.description !== (existingElevationTypes.find(
            et => et.code === c.code && (et.kind === c.kind || (c.kind === 'door' && !et.kind)),
        )?.description ?? ''),
    ).length;
    const doorCards    = cards.filter(c => c.kind === 'door');
    const frameCards   = cards.filter(c => c.kind === 'frame');
    const isBusy       = pdfStage === 'rendering' || saving;
    const cropCard     = cropTarget
        ? cards.find(c => c.code === cropTarget.code && c.kind === cropTarget.kind)
        : null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col">

            {/* Sticky save bar — only visible when there are pending crops */}
            {(croppedCount > 0 || saving) && (
                <div className="sticky top-0 z-10 bg-[var(--bg)]/95 backdrop-blur-sm border-b border-[var(--border)] flex items-center justify-end gap-2 px-2 py-2">
                    {saving ? (
                        <span className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Uploading…
                        </span>
                    ) : (
                        <>
                            <Button variant="outline" size="sm" onClick={onClose} disabled={isBusy}>
                                Cancel
                            </Button>
                            <Button size="sm" onClick={handleSave} disabled={isBusy}>
                                Save {croppedCount} Elevation{croppedCount !== 1 ? 's' : ''}
                            </Button>
                        </>
                    )}
                </div>
            )}

            <div className="flex flex-col gap-6">

                {/* ── PDF upload zone ── */}
                {pdfStage === 'idle' && (
                    <div
                        onDrop={handleDrop}
                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                        onDragLeave={() => setIsDragging(false)}
                        onClick={() => fileInputRef.current?.click()}
                        className={[
                            'border-2 border-dashed rounded-xl px-8 py-6 flex items-center gap-4 cursor-pointer transition-colors',
                            isDragging
                                ? 'border-[var(--primary)] bg-[var(--primary-bg)]'
                                : 'border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--primary-bg-hover)]',
                        ].join(' ')}
                    >
                        <div className="w-10 h-10 rounded-full bg-[var(--primary-bg)] flex items-center justify-center flex-shrink-0">
                            <Upload className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-[var(--text)]">
                                Drop your elevation PDF here, or{' '}
                                <span className="text-[var(--primary-text)] underline underline-offset-2">click to browse</span>
                            </p>
                            <p className="text-xs text-[var(--text-faint)] mt-0.5">
                                PDF only · max 15 MB · Upload to start cropping elevations
                            </p>
                        </div>
                    </div>
                )}
                <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handleInputChange} />

                {/* ── Rendering progress ── */}
                {pdfStage === 'rendering' && (
                    <div className="rounded-xl border border-[var(--border)] px-6 py-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-[var(--text-muted)] flex items-center gap-2">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                {renderProgress.label}
                            </span>
                            <span className="text-[var(--text-faint)] tabular-nums">{renderProgress.percent}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-[var(--primary-bg)] overflow-hidden">
                            <div
                                className="h-full bg-[var(--primary)] rounded-full transition-all duration-200"
                                style={{ width: `${renderProgress.percent}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* ── PDF loaded pill ── */}
                {pdfStage === 'ready' && (
                    <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/40 px-4 py-2.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm text-[var(--text)] flex-1 truncate">{pdfFileName}</span>
                        <span className="text-xs text-[var(--text-faint)] flex-shrink-0">
                            {pageImages.length} page{pageImages.length !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs text-[var(--primary-text)] hover:underline flex-shrink-0 flex items-center gap-1"
                        >
                            <FileX className="w-3 h-3" />
                            Change PDF
                        </button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        {error}
                    </div>
                )}

                {/* No elevation types */}
                {cards.length === 0 && (
                    <div className="flex flex-col items-center gap-2 py-16 text-center">
                        <AlertCircle className="w-7 h-7 text-[var(--text-faint)]" />
                        <p className="text-sm text-[var(--text-muted)]">No elevation types found in the door schedule.</p>
                        <p className="text-xs text-[var(--text-faint)]">Import the door schedule first so elevation codes appear here.</p>
                    </div>
                )}

                {/* ── Door Elevations ── */}
                {doorCards.length > 0 && (
                    <ElevationSection
                        title="Door Elevations"
                        icon={<DoorOpen className="w-3.5 h-3.5 text-[var(--primary-text)]" />}
                        cards={doorCards}
                        pdfReady={pdfStage === 'ready'}
                        disabled={isBusy}
                        onCrop={card => setCropTarget({ code: card.code, kind: card.kind })}
                        onDescriptionChange={(code, kind, desc) => updateCard(code, kind, { description: desc })}
                    />
                )}

                {/* ── Frame Elevations ── */}
                {frameCards.length > 0 && (
                    <ElevationSection
                        title="Frame Elevations"
                        icon={<DoorOpen className="w-3.5 h-3.5 text-indigo-400" />}
                        cards={frameCards}
                        pdfReady={pdfStage === 'ready'}
                        disabled={isBusy}
                        onCrop={card => setCropTarget({ code: card.code, kind: card.kind })}
                        onDescriptionChange={(code, kind, desc) => updateCard(code, kind, { description: desc })}
                    />
                )}
            </div>

            {/* Crop modal — image crop only */}
            {cropTarget && cropCard !== undefined && pageImages.length > 0 && (
                <ElevationCropModal
                    pageImages={pageImages}
                    typeCode={cropTarget.code}
                    onSave={croppedBase64 => {
                        updateCard(cropTarget.code, cropTarget.kind, { croppedImage: croppedBase64 });
                        setCropTarget(null);
                    }}
                    onClose={() => setCropTarget(null)}
                />
            )}
        </div>
    );
}

// ── Section ───────────────────────────────────────────────────────────────────

interface ElevationSectionProps {
    title: string;
    icon: React.ReactNode;
    cards: ElevationCard[];
    pdfReady: boolean;
    disabled: boolean;
    onCrop: (card: ElevationCard) => void;
    onDescriptionChange: (code: string, kind: 'door' | 'frame', desc: string) => void;
}

function ElevationSection({ title, icon, cards, pdfReady, disabled, onCrop, onDescriptionChange }: ElevationSectionProps) {
    const inputCls =
        'w-full px-2 py-1 border border-[var(--border)] rounded-lg text-xs text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors disabled:opacity-50';

    return (
        <section className="flex flex-col gap-3">
            <h3 className="text-xs font-semibold text-[var(--text-faint)] uppercase tracking-wider flex items-center gap-1.5">
                {icon}
                {title}
                <span className="font-normal normal-case tracking-normal">
                    — {cards.length} type{cards.length !== 1 ? 's' : ''}
                </span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {cards.map(card => {
                    const displayImage = card.croppedImage ?? card.existingImageUrl;
                    const hasNewCrop   = card.croppedImage !== null;
                    const hasSaved     = card.existingImageUrl !== null && !hasNewCrop;
                    const canCrop      = pdfReady && !disabled;

                    return (
                        <div
                            key={`${card.kind}:${card.code}`}
                            className="flex flex-col gap-2 rounded-xl border border-[var(--border)] p-3 transition-colors hover:border-[var(--primary-ring)]"
                        >
                            <div
                                onClick={() => canCrop && onCrop(card)}
                                title={!pdfReady ? 'Upload a PDF above to crop this elevation' : undefined}
                                className={[
                                    'relative w-full aspect-[3/4] rounded-lg overflow-hidden border border-[var(--border)] group bg-[var(--primary-bg)]',
                                    canCrop ? 'cursor-pointer' : 'cursor-default',
                                ].join(' ')}
                            >
                                {displayImage ? (
                                    <>
                                        <img src={displayImage} alt={card.code} className="w-full h-full object-contain" />
                                        {canCrop && (
                                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-white/90 text-gray-800 text-xs font-medium px-2.5 py-1.5 rounded-full shadow">
                                                    <Crop className="w-3.5 h-3.5" />
                                                    Re-crop
                                                </div>
                                            </div>
                                        )}
                                        {hasNewCrop && (
                                            <div className="absolute bottom-1.5 right-1.5 bg-[var(--primary)] text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                                new crop
                                            </div>
                                        )}
                                        {hasSaved && (
                                            <div className="absolute bottom-1.5 right-1.5 bg-emerald-500 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full">
                                                saved
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className={[
                                        'absolute inset-0 flex flex-col items-center justify-center gap-1.5 transition-colors',
                                        canCrop ? 'text-[var(--text-faint)] group-hover:text-[var(--primary-text)]' : 'text-[var(--text-faint)]',
                                    ].join(' ')}>
                                        <ImagePlus className="w-6 h-6" />
                                        <span className="text-[10px] font-medium text-center px-2 leading-tight">
                                            {pdfReady ? 'Click to crop' : 'Upload PDF to crop'}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-[var(--text)] uppercase tracking-wide flex-1">{card.code}</span>
                                {hasNewCrop && <CheckCircle2 className="w-3.5 h-3.5 text-[var(--primary-text)] flex-shrink-0" />}
                                {hasSaved    && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />}
                            </div>

                            {/* Description input — typed manually by the user */}
                            <input
                                type="text"
                                value={card.description}
                                onChange={e => onDescriptionChange(card.code, card.kind, e.target.value)}
                                placeholder="Description…"
                                disabled={disabled}
                                className={inputCls}
                            />
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
