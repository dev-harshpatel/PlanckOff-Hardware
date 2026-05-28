import React, { useMemo, useRef, useState } from 'react';
import { PrinterIcon } from '../shared/icons';
import type { MergedHardwareSet, MergedDoor, HardwareItem } from '@/lib/db/hardware';
import type { ElevationType } from '@/types';

interface SubmittalGeneratorProps {
  finalJson: MergedHardwareSet[];
  projectName: string;
  elevationTypes?: ElevationType[];
}

interface SetGroup {
  fingerprint: string;
  setNames: string[];
  items: HardwareItem[];
  doors: MergedDoor[];
  totalQuantity: number;
}

function itemsFingerprint(items: HardwareItem[]): string {
  const normalized = [...items]
    .sort((a, b) => (a.item || '').localeCompare(b.item || ''))
    .map(item => ({
      n: (item.item || '').trim().toLowerCase(),
      q: item.qty,
      m: (item.manufacturer || '').trim().toLowerCase(),
      f: (item.finish || '').trim().toLowerCase(),
    }));
  return JSON.stringify(normalized);
}

function doorQuantity(door: MergedDoor): number {
  const raw = door.sections?.door?.['QUANTITY'] ?? door.sections?.basic_information?.['QUANTITY'] ?? String(door.quantity ?? 1);
  return parseInt(raw) || 1;
}

function getDoorParam(door: MergedDoor, ...keys: string[]): string {
  const bi = door.sections?.basic_information ?? {};
  const ds = door.sections?.door ?? {};
  const fr = door.sections?.frame ?? {};
  const all = { ...bi, ...ds, ...fr };
  for (const k of keys) {
    const val = all[k.toUpperCase()];
    if (val && val.trim()) return val.trim();
  }
  return '';
}

function buildDimensions(door: MergedDoor): string {
  const w = getDoorParam(door, 'WIDTH', 'DOOR WIDTH') || door.doorWidth;
  const h = getDoorParam(door, 'HEIGHT', 'DOOR HEIGHT') || door.doorHeight;
  const t = getDoorParam(door, 'THICKNESS', 'DOOR THICKNESS') || door.thickness;
  const parts: string[] = [];
  if (w) parts.push(w.includes('"') ? w : `${w}"`);
  if (h) parts.push(h.includes('"') ? h : `${h}"`);
  if (t) parts.push(t.includes('"') ? t : `${t}"`);
  return parts.join(' x ');
}

function formatParamValue(val: string): string {
  return val || '-';
}

const DOOR_PARAMS = (door: MergedDoor): Array<{ label: string; value: string }> => [
  { label: 'Opening Number', value: formatParamValue(door.doorTag) },
  { label: 'Handing',        value: formatParamValue(getDoorParam(door, 'HAND OF OPENINGS', 'HANDING', 'HAND')) },
  { label: 'Operation',      value: formatParamValue(getDoorParam(door, 'DOOR OPERATION', 'OPERATION')) },
  { label: 'Dimensions',     value: formatParamValue(buildDimensions(door)) },
  { label: 'Undercut',       value: formatParamValue(getDoorParam(door, 'DOOR UNDERCUT', 'UNDERCUT')) },
  { label: 'Leaf Count',     value: formatParamValue(getDoorParam(door, 'LEAF COUNT') || String(door.leafCount ?? '')) },
  { label: 'Core Type',      value: formatParamValue(getDoorParam(door, 'DOOR CORE', 'DOOR MATERIAL', 'CORE TYPE') || door.doorMaterial || '') },
  { label: 'Face Type',      value: formatParamValue(getDoorParam(door, 'DOOR FACE', 'FACE TYPE')) },
  { label: 'Finish Base Prep', value: formatParamValue(getDoorParam(door, 'FINISH BASE PREP', 'FINISH PREP')) },
  { label: 'Finish Type',    value: formatParamValue(getDoorParam(door, 'DOOR FINISH', 'FINISH TYPE', 'FINISH')) },
  { label: 'Fire Rating',    value: formatParamValue(door.fireRating ?? getDoorParam(door, 'FIRE RATING')) },
  { label: 'STC Rating',     value: formatParamValue(getDoorParam(door, 'STC RATING', 'STC')) },
  { label: 'Frame Material', value: formatParamValue(String(door.frameMaterial ?? getDoorParam(door, 'FRAME MATERIAL'))) },
  { label: 'Frame Type',     value: formatParamValue(getDoorParam(door, 'FRAME TYPE', 'FRAME GUAGE', 'FRAME PROFILE')) },
  { label: 'Wall Type',      value: formatParamValue(getDoorParam(door, 'WALL TYPE')) },
  { label: 'Jamb Depth',     value: formatParamValue(getDoorParam(door, 'JAMB DEPTH', 'THROAT THICKNESS', 'JAMB')) },
];

function getElevationType(door: MergedDoor, elevationTypes: ElevationType[], kind: 'door' | 'frame'): ElevationType | undefined {
  const code = kind === 'door'
    ? (door.doorElevationType ?? getDoorParam(door, 'DOOR ELEVATION TYPE'))
    : getDoorParam(door, 'FRAME ELEVATION TYPE');
  if (!code) return undefined;
  // Prefer matching by kind; fall back to any match so legacy entries (kind=undefined) still work
  return (
    elevationTypes.find(e => e.kind === kind && (e.code?.toLowerCase() === code.toLowerCase() || e.name?.toLowerCase() === code.toLowerCase())) ??
    elevationTypes.find(e => e.code?.toLowerCase() === code.toLowerCase() || e.name?.toLowerCase() === code.toLowerCase())
  );
}

// Determine font-size scaling for the hardware items list based on item count
function hwFontScale(itemCount: number): number {
  if (itemCount <= 8)  return 11;
  if (itemCount <= 11) return 10;
  if (itemCount <= 14) return 9;
  if (itemCount <= 18) return 8;
  return 7.5;
}

const SubmittalGenerator: React.FC<SubmittalGeneratorProps> = ({
  finalJson,
  projectName,
  elevationTypes = [],
}) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const adjustZoom = (delta: number) => setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + delta) * 10) / 10)));

  const groups = useMemo<SetGroup[]>(() => {
    const map = new Map<string, SetGroup>();

    for (const set of finalJson) {
      if (!set.hardwareItems?.length) continue;

      const fp = itemsFingerprint(set.hardwareItems);

      if (!map.has(fp)) {
        map.set(fp, {
          fingerprint: fp,
          setNames: [],
          items: set.hardwareItems,
          doors: [],
          totalQuantity: 0,
        });
      }

      const group = map.get(fp)!;

      if (!group.setNames.includes(set.setName)) {
        group.setNames.push(set.setName);
      }

      for (const door of set.doors) {
        group.doors.push(door);
        group.totalQuantity += doorQuantity(door);
      }
    }

    return Array.from(map.values());
  }, [finalJson]);

  const setsWithDoors = groups.filter(g => g.doors.length > 0);
  const emptyGroups = groups.filter(g => g.doors.length === 0);
  const totalPages = setsWithDoors.length;

  const handleDownload = async () => {
    if (!componentRef.current || isDownloading || setsWithDoors.length === 0) return;
    setIsDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Wait for the font link to fully load before proceeding — appending the link
      // and immediately calling document.fonts.ready races against the CSS fetch.
      if (!document.querySelector('link[data-submittal-font]')) {
        await new Promise<void>((resolve) => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=block';
          link.dataset.submittalFont = '1';
          link.onload = () => resolve();
          link.onerror = () => resolve();
          document.head.appendChild(link);
        });
      }

      // Force-load every weight actually used in the layout so html2canvas gets Inter,
      // not the fallback (Arial/Helvetica). Different metrics in the fallback cause text
      // to render slightly taller/wider, overflowing the overflow:hidden A4 page.
      await Promise.allSettled([
        document.fonts.load('400 12px Inter'),
        document.fonts.load('500 12px Inter'),
        document.fonts.load('600 12px Inter'),
        document.fonts.load('700 12px Inter'),
        document.fonts.load('800 12px Inter'),
        document.fonts.load('900 12px Inter'),
      ]);
      await document.fonts.ready;

      // Reset zoom to 1 before capture — CSS zoom shifts offsetWidth/offsetHeight and
      // causes html2canvas to measure at the wrong scale, producing clipped output.
      const zoomWrapper = componentRef.current.parentElement as HTMLElement;
      const savedZoom = zoomWrapper.style.zoom;
      zoomWrapper.style.zoom = '1';

      // html2canvas renders fonts 2-4 px taller than the browser due to sub-pixel
      // rounding differences. Every intermediate overflow:hidden container in the flex
      // hierarchy (.spage-body, .scol-right, .shw-items) clips that extra height and
      // slashes the bottom of text lines. Inject a temporary override that makes all
      // intermediate containers overflow:visible for the duration of the capture, keeping
      // only .spage as the final A4 boundary clip.
      const captureOverride = document.createElement('style');
      captureOverride.textContent = `
        .submittal-root .spage-body,
        .submittal-root .scol-left,
        .submittal-root .scol-right,
        .submittal-root .shw-items,
        .submittal-root .shw-item-detail {
          overflow: visible !important;
          max-height: none !important;
        }
      `;
      document.head.appendChild(captureOverride);

      // Two rAF ticks to let the browser apply both style changes before measuring.
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const pages = Array.from(componentRef.current.querySelectorAll<HTMLElement>('.spage'));
      if (!pages.length) {
        document.head.removeChild(captureOverride);
        zoomWrapper.style.zoom = savedZoom;
        return;
      }

      const canvases = await Promise.all(pages.map(el =>
        html2canvas(el, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
        })
      ));

      // Restore both overrides immediately after capture.
      document.head.removeChild(captureOverride);
      zoomWrapper.style.zoom = savedZoom;

      // Each .spage is exactly A4 (210×297 mm) — use fixed dimensions instead of
      // computing from aspect ratio to avoid floating-point drift.
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      canvases.forEach((canvas, i) => {
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      });

      const safeName = projectName.replace(/[^a-zA-Z0-9\s-]/g, '').trim().replace(/\s+/g, '_');
      pdf.save(`${safeName}_Submittal_Package.pdf`);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">
      {/* Toolbar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>
            <span className="font-semibold text-[var(--text)]">{setsWithDoors.length}</span>
            {' '}unique hardware set{setsWithDoors.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="font-semibold text-[var(--text)]">
              {groups.reduce((s, g) => s + g.totalQuantity, 0)}
            </span>
            {' '}total door openings
          </span>
          {emptyGroups.length > 0 && (
            <span className="text-amber-600 dark:text-amber-400">
              · {emptyGroups.length} set{emptyGroups.length !== 1 ? 's' : ''} with no doors assigned
            </span>
          )}
        </div>
        {setsWithDoors.length > 0 && (
          <div className="flex items-center gap-1 border border-[var(--border)] rounded-md overflow-hidden">
            <button
              onClick={() => adjustZoom(-0.1)}
              disabled={zoom <= 0.4}
              className="px-2.5 py-1.5 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
              title="Zoom out"
            >−</button>
            <span className="px-1.5 text-xs font-medium text-[var(--text-muted)] min-w-[40px] text-center select-none">
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={() => adjustZoom(0.1)}
              disabled={zoom >= 2}
              className="px-2.5 py-1.5 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--bg-muted)] disabled:opacity-30 transition-colors"
              title="Zoom in"
            >+</button>
          </div>
        )}
        <button
          onClick={handleDownload}
          disabled={setsWithDoors.length === 0 || isDownloading}
          className="flex items-center gap-2 bg-[var(--primary-action)] text-[var(--text-inverted)] px-4 py-2 rounded-md hover:bg-[var(--primary-action-hover)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PrinterIcon className="w-4 h-4" />
          {isDownloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {groups.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--text-muted)]">
            <p className="text-sm font-medium">No hardware sets found in final JSON</p>
            <p className="text-xs mt-1">Run the merge pipeline first to generate the submittal package.</p>
          </div>
        </div>
      )}
      {groups.length > 0 && setsWithDoors.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--text-muted)]">
            <p className="text-sm font-medium">No door assignments found</p>
            <p className="text-xs mt-1">Hardware sets exist but no doors are matched to them. Re-run the merge pipeline.</p>
          </div>
        </div>
      )}

      {setsWithDoors.length > 0 && (
        <div className="flex-1 overflow-auto p-4">
          <div style={{ zoom: zoom }}>
          <div ref={componentRef}>
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

              .submittal-root {
                font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
                color: #0f172a;
              }

              /* Each page wrapper */
              .spage {
                background: #fff;
                width: 210mm;
                min-height: 297mm;
                max-height: 297mm;
                overflow: hidden;
                box-sizing: border-box;
                padding: 12mm 14mm 10mm;
                display: flex;
                flex-direction: column;
                position: relative;
                margin: 0 auto 24px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.10);
              }

              @media print {
                .spage {
                  box-shadow: none;
                  margin: 0;
                  width: 100%;
                  min-height: 100vh;
                  max-height: 100vh;
                  padding: 10mm 12mm 8mm;
                }
              }

              /* ── Page top: title + quantity ── */
              .spage-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 5mm;
                border-bottom: 1.5px solid #1e293b;
                padding-bottom: 4mm;
              }
              .spage-title {
                font-size: 22pt;
                font-weight: 900;
                color: #0f172a;
                line-height: 1.1;
                margin: 0;
              }
              .spage-subtitle {
                font-size: 8.5pt;
                color: #64748b;
                margin: 2px 0 0;
              }
              .spage-qty-block {
                text-align: right;
                flex-shrink: 0;
                margin-left: 12mm;
              }
              .spage-qty-label {
                font-size: 7pt;
                font-weight: 700;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: #64748b;
                margin-bottom: 2px;
              }
              .spage-qty-value {
                font-size: 36pt;
                font-weight: 900;
                color: #1e3a5f;
                line-height: 1;
              }

              /* ── Two-column body ── */
              .spage-body {
                display: grid;
                grid-template-columns: 45% 55%;
                gap: 6mm;
                flex: 1;
                min-height: 0;
                overflow: hidden;
              }

              /* ── LEFT COLUMN ── */
              .scol-left {
                display: flex;
                flex-direction: column;
                overflow: hidden;
              }

              /* Door params section */
              .sparam-section {
                flex-shrink: 0;
              }
              .ssection-title {
                font-size: 7.5pt;
                font-weight: 800;
                letter-spacing: 0.12em;
                text-transform: uppercase;
                color: #1e293b;
                border-bottom: 1px solid #cbd5e1;
                padding-bottom: 4px;
                margin-bottom: 2mm;
                line-height: 1.5;
              }
              .sparam-row {
                display: flex;
                align-items: baseline;
                padding: 5px 0 6px;
                border-bottom: 1px solid #e8edf2;
              }
              .sparam-label {
                font-size: 7.5pt;
                color: #64748b;
                width: 38%;
                flex-shrink: 0;
                line-height: 1.5;
              }
              .sparam-value {
                font-size: 7.5pt;
                font-weight: 700;
                color: #0f172a;
                flex: 1;
                line-height: 1.5;
                word-break: break-word;
                overflow-wrap: break-word;
              }
              .sparam-value.is-dash {
                font-weight: 400;
                color: #94a3b8;
              }

              /* Affected door tags */
              .stags-section {
                margin-top: 3mm;
                flex-shrink: 0;
              }
              .stags-wrap {
                display: flex;
                flex-wrap: wrap;
                gap: 2px;
                margin-top: 2px;
              }
              .stag {
                font-size: 7pt;
                font-weight: 500;
                color: #334155;
                background: #f1f5f9;
                border: 1px solid #e2e8f0;
                border-radius: 3px;
                padding: 3px 6px;
                line-height: 1.5;
              }

              /* ── RIGHT COLUMN ── */
              .scol-right {
                display: flex;
                flex-direction: column;
                overflow: hidden;
              }

              /* Hardware set header box */
              .shw-set-name {
                background: #f1f5f9;
                border-radius: 3px;
                padding: 2.5px 7px;
                font-size: 9pt;
                font-weight: 700;
                color: #1e293b;
                margin-bottom: 1.5mm;
                flex-shrink: 0;
              }
              .shw-invalid {
                font-size: 8.5pt;
                font-style: italic;
                color: #dc2626;
                padding: 3px 0;
              }

              /* Hardware items list */
              .shw-items {
                flex: 1;
                overflow-x: hidden;
                overflow-y: visible;
              }
              .shw-item-row {
                display: flex;
                align-items: flex-start;
                padding: 4px 0 5px;
                border-bottom: 1px solid #e8edf2;
              }
              .shw-item-qty {
                font-weight: 800;
                color: #0f172a;
                width: 16px;
                flex-shrink: 0;
                text-align: right;
                margin-right: 8px;
                line-height: 1.4;
                padding-top: 1px;
              }
              .shw-item-detail {
                flex: 1;
                min-width: 0;
                overflow-x: hidden;
                overflow-y: visible;
              }
              .shw-item-name {
                font-weight: 600;
                color: #1e293b;
                word-break: break-word;
                overflow-wrap: break-word;
                line-height: 1.3;
              }
              .shw-item-sub {
                color: #64748b;
                line-height: 1.5;
                margin-top: 2px;
                padding-bottom: 1px;
              }

              /* Elevation section */
              .selev-section {
                margin-top: 3mm;
                flex-shrink: 0;
              }
              .selev-title {
                font-size: 8pt;
                font-weight: 800;
                letter-spacing: 0.10em;
                text-transform: uppercase;
                color: #1e293b;
                border-bottom: 1px solid #cbd5e1;
                padding-bottom: 2px;
                margin-bottom: 2mm;
              }
              /* Two-column row when both door + frame elevations exist */
              .selev-row {
                display: flex;
                gap: 3mm;
              }
              .selev-col {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
              }
              .selev-col-label {
                font-size: 6.5pt;
                font-weight: 700;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: #64748b;
                margin-bottom: 1.5mm;
              }
              .selev-image-wrap {
                border: 1.5px dashed #cbd5e1;
                border-radius: 3px;
                overflow: hidden;
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f8fafc;
              }
              .selev-image-wrap img {
                max-width: 100%;
                max-height: 100%;
                object-fit: contain;
                display: block;
              }
              .selev-no-elev {
                font-size: 8pt;
                color: #94a3b8;
                padding: 16px 0;
                text-align: center;
              }

              /* Footer */
              .spage-footer {
                display: flex;
                justify-content: space-between;
                font-size: 7pt;
                color: #94a3b8;
                border-top: 1px solid #e2e8f0;
                margin-top: 3mm;
                padding-top: 2mm;
                flex-shrink: 0;
              }
            `}</style>

            <div className="submittal-root">
              {setsWithDoors.map((group, idx) => {
                const firstDoor = group.doors[0];
                const params = DOOR_PARAMS(firstDoor);
                const setDisplayName = group.setNames.join(', ');
                const doorTags = group.doors.map(d => String(d.doorTag));
                const fs = hwFontScale(group.items.length);

                // Resolve door and frame elevations separately
                const doorElevType  = getElevationType(firstDoor, elevationTypes, 'door');
                const frameElevType = getElevationType(firstDoor, elevationTypes, 'frame');
                const doorElevCode  = firstDoor.doorElevationType ?? getDoorParam(firstDoor, 'DOOR ELEVATION TYPE');
                const frameElevCode = getDoorParam(firstDoor, 'FRAME ELEVATION TYPE');
                const doorElevImg   = doorElevType?.imageUrl  ?? doorElevType?.imageData;
                const frameElevImg  = frameElevType?.imageUrl ?? frameElevType?.imageData;
                const hasBothElev   = !!(doorElevImg && frameElevImg);

                // Available height for elevation image(s) — tighter when more hardware items
                const elevH = group.items.length <= 8 ? 90 : group.items.length <= 12 ? 72 : group.items.length <= 16 ? 58 : 48;

                return (
                  <div
                    key={group.fingerprint}
                    className="spage"
                  >
                    {/* ── Header ── */}
                    <div className="spage-header">
                      <div>
                        <h1 className="spage-title">Door Type Specification</h1>
                        <p className="spage-subtitle">Submittal Data Sheet</p>
                      </div>
                      <div className="spage-qty-block">
                        <div className="spage-qty-label">Total Quantity</div>
                        <div className="spage-qty-value">{group.totalQuantity}</div>
                      </div>
                    </div>

                    {/* ── Body ── */}
                    <div className="spage-body">
                      {/* ── LEFT COLUMN ── */}
                      <div className="scol-left">
                        {/* Door Parameters */}
                        <div className="sparam-section">
                          <div className="ssection-title">Door Parameters</div>
                          {params.map((p, pi) => (
                            <div key={pi} className="sparam-row">
                              <span className="sparam-label">{p.label}</span>
                              <span className={`sparam-value${p.value === '-' ? ' is-dash' : ''}`}>
                                {p.value}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Affected Door Tags */}
                        <div className="stags-section">
                          <div className="ssection-title">Affected Door Tags</div>
                          <div className="stags-wrap">
                            {doorTags.slice(0, 80).map((tag, ti) => (
                              <span key={ti} className="stag">{tag}</span>
                            ))}
                            {doorTags.length > 80 && (
                              <span className="stag" style={{ color: '#94a3b8', background: 'none', border: 'none' }}>
                                +{doorTags.length - 80} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* ── RIGHT COLUMN ── */}
                      <div className="scol-right">
                        {/* Hardware Set header */}
                        <div className="ssection-title">Hardware Set</div>
                        <div className="shw-set-name">{setDisplayName}</div>

                        {/* Hardware items */}
                        {group.items.length === 0 ? (
                          <p className="shw-invalid">No valid hardware set assigned.</p>
                        ) : (
                          <div className="shw-items" style={{ fontSize: `${fs}pt` }}>
                            {group.items.map((item, ii) => {
                              const sub = [item.manufacturer, item.finish].filter(Boolean).join(' • ');
                              return (
                                <div key={ii} className="shw-item-row">
                                  <span className="shw-item-qty">{item.qty}</span>
                                  <div className="shw-item-detail">
                                    <div className="shw-item-name">{item.item}</div>
                                    {sub && <div className="shw-item-sub">{sub}</div>}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Elevation — door and frame side by side when both exist */}
                        <div className="selev-section">
                          <div className="selev-title">Elevation</div>
                          {hasBothElev ? (
                            <div className="selev-row">
                              <div className="selev-col">
                                <div className="selev-col-label">
                                  Door{doorElevCode ? ` · ${doorElevCode}` : ''}
                                </div>
                                <div className="selev-image-wrap" style={{ height: `${elevH}mm` }}>
                                  <img src={doorElevImg!} alt={doorElevCode || 'Door Elevation'} />
                                </div>
                              </div>
                              <div className="selev-col">
                                <div className="selev-col-label">
                                  Frame{frameElevCode ? ` · ${frameElevCode}` : ''}
                                </div>
                                <div className="selev-image-wrap" style={{ height: `${elevH}mm` }}>
                                  <img src={frameElevImg!} alt={frameElevCode || 'Frame Elevation'} />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div>
                              {(doorElevImg || frameElevImg) && (
                                <div className="selev-col-label">
                                  {doorElevImg
                                    ? `Door${doorElevCode ? ` · ${doorElevCode}` : ''}`
                                    : `Frame${frameElevCode ? ` · ${frameElevCode}` : ''}`}
                                </div>
                              )}
                              <div className="selev-image-wrap" style={{ height: `${elevH}mm` }}>
                                {(doorElevImg || frameElevImg) ? (
                                  <img
                                    src={(doorElevImg ?? frameElevImg)!}
                                    alt={doorElevCode || frameElevCode || 'Elevation'}
                                  />
                                ) : (
                                  <span className="selev-no-elev">No Elevation Linked</span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* ── Footer ── */}
                    <div className="spage-footer">
                      <span>Generated by Planckoff Estimating</span>
                      <span>Page {idx + 1} of {totalPages}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubmittalGenerator;
