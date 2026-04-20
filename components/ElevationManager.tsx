import React, { useRef, useState, useMemo } from 'react';
import {
    AlertTriangle, ImageIcon, Layers, Loader2,
    Pencil, Plus, RefreshCw, Trash2, Upload, X,
} from 'lucide-react';
import { ElevationType } from '../types';
import { compressElevationImage, deleteElevationImage, uploadElevationImage } from '../services/elevationService';

interface ElevationManagerProps {
    elevationTypes: ElevationType[];
    onUpdate: (types: ElevationType[]) => void;
    onClose: () => void;
    projectId: string;
}

const inputCls =
    'w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors';

const Label: React.FC<{ children: React.ReactNode; required?: boolean }> = ({ children, required }) => (
    <label className="block text-[11px] font-semibold text-[var(--text-faint)] uppercase tracking-wide mb-1">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const SectionDivider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-center gap-2 mb-4">
        <span className="text-xs font-bold text-[var(--primary-text-muted)] uppercase tracking-wider flex items-center gap-1">
            {children}
        </span>
        <div className="flex-1 h-px bg-[var(--primary-border)]" />
    </div>
);

// Resolve display image: Supabase URL → legacy base64 → null
const resolveImage = (type: ElevationType) => type.imageUrl ?? type.imageData ?? null;

const ElevationManager: React.FC<ElevationManagerProps> = ({ elevationTypes, onUpdate, onClose, projectId }) => {
    const [types, setTypes] = useState<ElevationType[]>(elevationTypes);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ── Form state ────────────────────────────────────────────────────────────
    const [editingId, setEditingId] = useState<string | null>(null); // null = add mode
    const [formCode, setFormCode] = useState('');
    const [formDescription, setFormDescription] = useState('');
    // pendingFile = new file picked; null means keep existing (only relevant in edit mode)
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [replaceConfirmed, setReplaceConfirmed] = useState(false);

    const isEditMode = editingId !== null;
    const editingType = isEditMode ? types.find(t => t.id === editingId) ?? null : null;

    // Duplicate detection: only active in add mode, ignores the type being edited
    const duplicate = useMemo(() => {
        if (isEditMode) return null;
        const trimmed = formCode.trim();
        if (!trimmed) return null;
        const match = types.find(t => t.code === trimmed || t.name === trimmed);
        return match && (match.imageUrl || match.imageData) ? match : null;
    }, [formCode, types, isEditMode]);

    // ── Helpers ───────────────────────────────────────────────────────────────
    const resetForm = () => {
        setEditingId(null);
        setFormCode('');
        setFormDescription('');
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
        setPendingFile(null);
        setSaveError(null);
        setReplaceConfirmed(false);
    };

    const handleCodeChange = (value: string) => {
        setFormCode(value);
        setReplaceConfirmed(false);
        setSaveError(null);
    };

    const handleFilePicked = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setPendingFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        setSaveError(null);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFilePicked(file);
        e.target.value = '';
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) handleFilePicked(file);
    };

    // Enter edit mode: populate form with existing type data
    const handleEditClick = (type: ElevationType) => {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        setEditingId(type.id);
        setFormCode(type.code);
        setFormDescription(type.description ?? '');
        setPendingFile(null);
        // Show the existing image as the current preview
        setPreviewUrl(resolveImage(type));
        setSaveError(null);
        setReplaceConfirmed(false);
    };

    // ── Save (add or edit) ────────────────────────────────────────────────────
    const handleSave = async () => {
        const trimmedCode = formCode.trim();
        if (!trimmedCode) return;

        // In add mode, an image is required. In edit mode, it's optional.
        if (!isEditMode && !pendingFile) return;

        setIsSaving(true);
        setSaveError(null);

        try {
            let imageUrl = editingType?.imageUrl;
            let imagePath = editingType?.imagePath;

            if (pendingFile) {
                // Delete old Supabase file when replacing in edit mode
                if (isEditMode && editingType?.imagePath) {
                    await deleteElevationImage(editingType.imagePath).catch(() => {});
                }
                const blob = await compressElevationImage(pendingFile);
                const uploaded = await uploadElevationImage(projectId, trimmedCode, blob);
                imageUrl = uploaded.url;
                imagePath = uploaded.path;
            }

            let updated: ElevationType[];

            if (isEditMode && editingType) {
                // Update the existing entry
                const upserted: ElevationType = {
                    ...editingType,
                    code: trimmedCode,
                    name: trimmedCode,
                    description: formDescription.trim() || undefined,
                    imageUrl,
                    imagePath,
                    imageData: undefined, // clear legacy base64
                };
                updated = types.map(t => t.id === editingType.id ? upserted : t);
            } else {
                // Check if code already exists (add mode duplicate)
                const existing = types.find(t => t.code === trimmedCode || t.name === trimmedCode);
                if (existing) {
                    const upserted: ElevationType = {
                        ...existing,
                        imageUrl,
                        imagePath,
                        description: formDescription.trim() || existing.description,
                        imageData: undefined,
                    };
                    updated = types.map(t => t.id === existing.id ? upserted : t);
                } else {
                    const created: ElevationType = {
                        id: crypto.randomUUID(),
                        name: trimmedCode,
                        code: trimmedCode,
                        description: formDescription.trim() || undefined,
                        imageUrl,
                        imagePath,
                    };
                    updated = [...types, created];
                }
            }

            setTypes(updated);
            onUpdate(updated);
            resetForm();
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Upload failed — check your Supabase connection.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = (id: string) => {
        if (!window.confirm('Delete this elevation type? It will be unlinked from all assigned doors.')) return;
        if (editingId === id) resetForm();
        const updated = types.filter(t => t.id !== id);
        setTypes(updated);
        onUpdate(updated);
    };

    // In edit mode: no image required if type already has one; new file is optional
    const existingImageInEdit = isEditMode ? resolveImage(editingType ?? {} as ElevationType) : null;
    const hasImage = !!pendingFile || !!existingImageInEdit;

    const canSave =
        formCode.trim().length > 0 &&
        (isEditMode ? hasImage : !!pendingFile) &&
        !isSaving &&
        (!duplicate || replaceConfirmed);

    // Displayed image in the upload zone
    const zoneImage = previewUrl ?? (isEditMode ? existingImageInEdit : null);

    return (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--bg)] rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-[var(--border-subtle)]">

                {/* ── Header ── */}
                <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-6 py-4 flex items-center justify-between flex-shrink-0 rounded-t-xl">
                    <div className="flex items-center gap-3">
                        <div className="bg-[var(--primary-bg-hover)] p-2 rounded-lg">
                            <Layers className="w-4 h-4 text-[var(--primary-text-muted)]" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text)]">Manage Elevation Types</h2>
                            <p className="text-xs text-[var(--primary-text-muted)] mt-0.5">
                                {types.length} type{types.length !== 1 ? 's' : ''} defined
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--primary-bg-hover)] rounded-lg transition-colors"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* ── Body ── */}
                <div className="flex-1 overflow-hidden flex min-h-0">

                    {/* ── Left panel: existing types list ── */}
                    <div className="w-64 flex-shrink-0 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-subtle)]">
                        <div className="px-4 py-3 border-b border-[var(--border-subtle)]">
                            <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">
                                Existing Types
                            </span>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 space-y-2">
                            {types.map(type => {
                                const thumb = resolveImage(type);
                                const isBeingEdited = type.id === editingId;
                                return (
                                    <div
                                        key={type.id}
                                        className={`group relative rounded-lg border transition-all overflow-hidden ${
                                            isBeingEdited
                                                ? 'border-[var(--primary-action)] bg-[var(--primary-bg)] ring-1 ring-[var(--primary-ring)]'
                                                : 'border-[var(--border)] bg-[var(--bg)] hover:border-[var(--primary-border)] hover:bg-[var(--primary-bg)]'
                                        }`}
                                    >
                                        {/* Thumbnail */}
                                        <div className="h-24 bg-[var(--bg-muted)] flex items-center justify-center overflow-hidden">
                                            {thumb
                                                ? <img src={thumb} alt={type.code} className="w-full h-full object-contain" />
                                                : <ImageIcon className="w-6 h-6 text-[var(--text-faint)]" />
                                            }
                                        </div>

                                        {/* Label + action row */}
                                        <div className="px-3 py-2 flex items-center justify-between">
                                            <div className="min-w-0">
                                                <p className="text-xs font-semibold text-[var(--text)] truncate">{type.code}</p>
                                                {type.description && (
                                                    <p className="text-[10px] text-[var(--text-faint)] truncate mt-0.5">{type.description}</p>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0 ml-1">
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleEditClick(type); }}
                                                    className="p-1 text-[var(--text-faint)] hover:text-[var(--primary-text)] rounded transition-colors"
                                                    aria-label="Edit"
                                                    title="Edit"
                                                >
                                                    <Pencil className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(type.id); }}
                                                    className="p-1 text-[var(--text-faint)] hover:text-red-500 dark:hover:text-red-400 rounded transition-colors"
                                                    aria-label="Delete"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}

                            {types.length === 0 && (
                                <div className="flex flex-col items-center gap-2 py-10 text-center">
                                    <Layers className="w-7 h-7 text-[var(--text-faint)] opacity-50" />
                                    <p className="text-xs text-[var(--text-faint)]">No elevation types yet.</p>
                                    <p className="text-[10px] text-[var(--text-faint)]">Add one using the form →</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Right panel: add / edit form ── */}
                    <div className="flex-1 overflow-y-auto p-6">

                        <SectionDivider>
                            {isEditMode
                                ? <><Pencil className="w-3 h-3" /> Edit Type — {editingType?.code}</>
                                : <><Plus className="w-3 h-3" /> Add New Type</>
                            }
                        </SectionDivider>

                        <div className="space-y-4 max-w-lg">

                            {/* Code + Description */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <Label required>Elevation Code</Label>
                                    <input
                                        type="text"
                                        className={`${inputCls} ${duplicate ? 'border-amber-500/60 focus:ring-amber-500/40 focus:border-amber-500' : ''}`}
                                        placeholder="e.g. A1, E-1, GW-01"
                                        value={formCode}
                                        onChange={e => handleCodeChange(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>Description</Label>
                                    <input
                                        type="text"
                                        className={inputCls}
                                        placeholder="e.g. Single Door"
                                        value={formDescription}
                                        onChange={e => setFormDescription(e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Duplicate warning (add mode only) */}
                            {duplicate && (
                                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 space-y-3">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                                                Elevation type <strong>{duplicate.code}</strong> already has an image.
                                            </p>
                                            <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80 mt-0.5">
                                                {duplicate.description ? `"${duplicate.description}"` : 'No description set.'}
                                            </p>
                                        </div>
                                    </div>
                                    {resolveImage(duplicate) && (
                                        <img
                                            src={resolveImage(duplicate)!}
                                            alt={duplicate.code}
                                            className="w-full max-h-28 object-contain rounded border border-amber-500/20 bg-[var(--bg)]"
                                        />
                                    )}
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="w-3.5 h-3.5 accent-amber-500 cursor-pointer"
                                            checked={replaceConfirmed}
                                            onChange={e => setReplaceConfirmed(e.target.checked)}
                                        />
                                        <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">
                                            Yes, replace the existing image for <strong>{duplicate.code}</strong>
                                        </span>
                                    </label>
                                </div>
                            )}

                            {/* Upload zone */}
                            <div>
                                <Label required={!isEditMode}>
                                    Drawing / Screenshot{isEditMode && ' (leave unchanged to keep current)'}
                                </Label>
                                <div
                                    onDrop={handleDrop}
                                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                    onDragLeave={() => setIsDragging(false)}
                                    onClick={() => !isSaving && fileInputRef.current?.click()}
                                    className={`
                                        relative rounded-xl border-2 border-dashed transition-colors overflow-hidden
                                        ${isSaving ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}
                                        ${isDragging
                                            ? 'border-[var(--primary-action)] bg-[var(--primary-bg)]'
                                            : 'border-[var(--border)] hover:border-[var(--primary-action)]/60 hover:bg-[var(--bg-subtle)]'
                                        }
                                    `}
                                >
                                    {zoneImage ? (
                                        <div className="group relative">
                                            <img src={zoneImage} alt="Preview" className="w-full max-h-52 object-contain" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors rounded-xl">
                                                <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white text-xs font-semibold bg-black/60 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                                                    <Upload className="w-3.5 h-3.5" /> Click to replace image
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center gap-2 py-10">
                                            <div className="p-3 rounded-full bg-[var(--primary-bg)] border border-[var(--primary-border)]">
                                                <Upload className="w-5 h-5 text-[var(--primary-text-muted)]" />
                                            </div>
                                            <p className="text-sm font-medium text-[var(--text-muted)]">
                                                Drop here or{' '}
                                                <span className="text-[var(--primary-text)] underline underline-offset-2">click to upload</span>
                                            </p>
                                            <p className="text-[10px] text-[var(--text-faint)]">PNG · JPG · WebP</p>
                                        </div>
                                    )}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                    />
                                </div>
                            </div>

                            {/* Upload progress */}
                            {isSaving && (
                                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[var(--primary-bg)] border border-[var(--primary-border)]">
                                    <Loader2 className="w-4 h-4 text-[var(--primary-text-muted)] animate-spin flex-shrink-0" />
                                    <span className="text-xs font-medium text-[var(--primary-text-muted)]">
                                        {pendingFile ? 'Compressing & uploading…' : 'Saving changes…'}
                                    </span>
                                </div>
                            )}

                            {saveError && (
                                <p className="text-xs text-red-600 dark:text-red-400 px-1">{saveError}</p>
                            )}

                            {/* Action buttons */}
                            <div className={`flex gap-2 ${isEditMode ? 'flex-row' : ''}`}>
                                {isEditMode && (
                                    <button
                                        onClick={resetForm}
                                        disabled={isSaving}
                                        className="px-4 py-2.5 rounded-lg text-sm font-semibold border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleSave}
                                    disabled={!canSave}
                                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-2 ${
                                        !canSave
                                            ? 'bg-[var(--bg-muted)] text-[var(--text-faint)] cursor-not-allowed'
                                            : duplicate
                                            ? 'bg-amber-600 hover:bg-amber-700'
                                            : 'bg-[var(--primary-action)] hover:bg-[var(--primary-action-hover)]'
                                    }`}
                                >
                                    {isSaving
                                        ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                                        : isEditMode
                                        ? <><Pencil className="w-4 h-4" /> Save Changes</>
                                        : duplicate
                                        ? <><RefreshCw className="w-4 h-4" /> Replace Image for {duplicate.code}</>
                                        : <><Plus className="w-4 h-4" /> Create Elevation Type</>
                                    }
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Footer ── */}
                <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--border-subtle)] bg-[var(--bg)] rounded-b-xl flex-shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2 text-sm bg-[var(--primary-action)] text-white rounded-lg hover:bg-[var(--primary-action-hover)] font-semibold transition-colors shadow-sm"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ElevationManager;
