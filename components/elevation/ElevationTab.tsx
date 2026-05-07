import React, { useCallback, useRef, useState, useEffect } from 'react';
import { ImageIcon, Upload, RefreshCw, Loader2, AlertTriangle, ZoomIn } from 'lucide-react';
import { Door, ElevationType } from '../../types';
import { ErrorDisplay } from '@/components/shared/ErrorDisplay';
import {
  compressElevationImage,
  deleteElevationImage,
  uploadElevationImage,
} from '../../services/elevationService';

interface ElevationTabProps {
  door: Door;
  elevationTypes: ElevationType[];
  projectId: string;
  onElevationTypeUpdate: (updated: ElevationType) => void;
  mode: 'door' | 'frame';
}

type UploadState = 'idle' | 'compressing' | 'uploading' | 'error';

const ACCEPTED = 'image/png,image/jpeg,image/webp,image/gif';

export const ElevationTab: React.FC<ElevationTabProps> = ({
  door,
  elevationTypes,
  projectId,
  onElevationTypeUpdate,
  mode,
}) => {
  // Resolve the elevation code for the active mode.
  const activeCode = mode === 'door' ? door.elevationTypeId : door.frameElevationType;

  // Excel-imported doors set elevationTypeId / frameElevationType to the raw code string (e.g. "A1").
  // Manually-assigned doors use the UUID. Match both.
  // Filter by kind so door and frame types with the same code remain separate.
  // `kind` is undefined on legacy entries — treat those as 'door' for backward compat.
  const elevationType = activeCode
    ? elevationTypes.find(
        et =>
          (et.kind === mode || (mode === 'door' && et.kind === undefined)) &&
          (et.id === activeCode || et.code === activeCode || et.name === activeCode),
      )
    : null;

  // Resolve display image: prefer Supabase URL, fall back to legacy base64
  const imageSource = elevationType?.imageUrl ?? elevationType?.imageData ?? null;
  const sharingCount = elevationType
    ? elevationTypes.filter(et => et.id === elevationType.id).length
    : 0;

  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [description, setDescription] = useState(elevationType?.description ?? '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep description in sync if the elevationType changes (e.g. after first upload creates it)
  useEffect(() => {
    setDescription(elevationType?.description ?? '');
  }, [elevationType?.id]);

  const handleDescriptionBlur = () => {
    if (!activeCode) return;
    const typeToUpdate: ElevationType = elevationType ?? {
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `et-${Date.now()}`,
      code: activeCode,
      name: activeCode,
    };
    if (description.trim() === (typeToUpdate.description ?? '')) return;
    onElevationTypeUpdate({ ...typeToUpdate, description: description.trim() || undefined });
  };

  const doUpload = useCallback(
    async (file: File) => {
      if (!activeCode) return;
      setUploadError(null);

      // If the ElevationType doesn't exist yet (door imported from Excel but
      // ElevationManager was never opened), create it on the fly so the user
      // can upload directly from this tab.
      const typeToUse: ElevationType = elevationType ?? {
        id: typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : `et-${Date.now()}`,
        code: activeCode,
        name: activeCode,
        kind: mode,
      };

      try {
        setUploadState('compressing');
        const blob = await compressElevationImage(file);

        setUploadState('uploading');

        if (typeToUse.imagePath) {
          await deleteElevationImage(typeToUse.imagePath).catch(() => {});
        }

        const { url, path } = await uploadElevationImage(projectId, typeToUse.code, blob, mode);

        onElevationTypeUpdate({
          ...typeToUse,
          kind: mode,
          imageUrl: url,
          imagePath: path,
          imageData: undefined,
        });

        setUploadState('idle');
      } catch (err) {
        setUploadState('error');
        setUploadError(err instanceof Error ? err.message : 'Upload failed');
      }
    },
    [activeCode, elevationType, projectId, onElevationTypeUpdate],
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) doUpload(file);
    e.target.value = '';
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file && file.type.startsWith('image/')) doUpload(file);
    },
    [doUpload],
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => setIsDragging(false);

  const isUploading = uploadState === 'compressing' || uploadState === 'uploading';

  // ── State 1: No elevation type assigned ──────────────────────────────────
  if (!activeCode) {
    const fieldName = mode === 'door' ? 'Door Elevation Type' : 'Frame Elevation Type';
    const tabName   = mode === 'door' ? 'Door' : 'Frame';
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center max-w-sm mx-auto gap-3">
        <div className="p-3 rounded-full bg-[var(--bg-subtle)] border border-[var(--border)]">
          <ImageIcon className="w-6 h-6 text-[var(--text-faint)]" />
        </div>
        <p className="text-sm font-medium text-[var(--text-muted)]">No {fieldName} set</p>
        <p className="text-xs text-[var(--text-faint)] leading-relaxed">
          Set the <span className="font-semibold text-[var(--text-secondary)]">{fieldName}</span> field
          in the <span className="font-semibold text-[var(--text-secondary)]">{tabName}</span> tab first,
          then come back here to upload the elevation drawing.
        </p>
      </div>
    );
  }

  // ── State 2 / 3 / 4: Elevation type exists ───────────────────────────────
  return (
    <div className="space-y-4 max-w-2xl">

      {/* Elevation type badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-[var(--text-faint)] uppercase tracking-wider">
            Elevation Type
          </span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--primary-bg)] border border-[var(--primary-border)] text-xs font-semibold text-[var(--primary-text)]">
            {elevationType?.code ?? activeCode}
          </span>
        </div>

        {imageSource && !isUploading && (
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[var(--text-muted)] border border-[var(--border)] rounded-lg hover:bg-[var(--bg-subtle)] transition-colors flex-shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Replace
          </button>
        )}
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-muted)] mb-1.5">
          Description
        </label>
        <input
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          placeholder="e.g. Double Door, Pair with Sidelight…"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm text-[var(--text)] bg-[var(--bg)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:border-[var(--primary-ring)] placeholder:text-[var(--text-faint)] transition-colors"
        />
      </div>

      {/* Uploading state */}
      {isUploading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-[var(--primary-bg)] border border-[var(--primary-border)]">
          <Loader2 className="w-4 h-4 text-[var(--primary-text-muted)] animate-spin flex-shrink-0" />
          <span className="text-xs font-medium text-[var(--primary-text-muted)]">
            {uploadState === 'compressing' ? 'Compressing to WebP…' : 'Uploading to storage…'}
          </span>
        </div>
      )}

      {/* Error state */}
      {uploadState === 'error' && <ErrorDisplay error={uploadError} />}

      {/* Image display or upload zone */}
      {!isUploading && (
        imageSource ? (
          /* ── State 3: Image exists ── */
          <div className="relative group rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-subtle)]">
            <img
              src={imageSource}
              alt={`Elevation ${elevationType?.code ?? activeCode}`}
              className="w-full object-contain max-h-[400px]"
              loading="lazy"
            />
            {/* Lightbox trigger overlay */}
            <button
              onClick={() => setLightboxOpen(true)}
              className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors"
              aria-label="View full size"
            >
              <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 drop-shadow-lg transition-opacity" />
            </button>
          </div>
        ) : (
          /* ── State 2: No image yet — upload zone ── */
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`
              flex flex-col items-center justify-center gap-3 py-14 rounded-xl border-2 border-dashed cursor-pointer transition-colors
              ${isDragging
                ? 'border-[var(--primary-action)] bg-[var(--primary-bg)]'
                : 'border-[var(--border)] hover:border-[var(--primary-action)]/60 hover:bg-[var(--bg-subtle)]'
              }
            `}
          >
            <div className="p-3 rounded-full bg-[var(--bg-muted)] border border-[var(--border)]">
              <Upload className="w-5 h-5 text-[var(--text-faint)]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[var(--text-muted)]">
                Drop screenshot here or <span className="text-[var(--primary-text)] underline underline-offset-2">click to upload</span>
              </p>
              <p className="text-xs text-[var(--text-faint)] mt-1">PNG · JPG · WebP — compressed to HD WebP on upload</p>
            </div>
          </div>
        )
      )}

      {/* "Shared by N doors" note */}
      {elevationType && (
        <p className="text-[10px] text-[var(--text-faint)] text-right">
          This image is shared by all doors with elevation type <strong>{elevationType.code}</strong>
          {sharingCount > 1 ? ` (${sharingCount} doors total)` : ''}.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Lightbox */}
      {lightboxOpen && imageSource && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={imageSource}
            alt={`Elevation ${elevationType?.code ?? activeCode} — full size`}
            className="max-w-full max-h-full rounded-lg shadow-2xl object-contain"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
