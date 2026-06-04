import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PrinterIcon } from '../shared/icons';
import type { MergedHardwareSet, MergedDoor, HardwareItem } from '@/lib/db/hardware';
import type { ElevationType } from '@/types';
import { buildExportFilename } from '@/utils/exportFilename';

interface SubmittalGeneratorProps {
  finalJson: MergedHardwareSet[];
  projectName: string;
  elevationTypes?: ElevationType[];
}

// ── Data shapes ──────────────────────────────────────────────────────────────

interface DoorMaterialGroup {
  material: string;
  doors: MergedDoor[];
  totalQuantity: number;
}

interface HwSetRowItem {
  itemName: string;
  description: string;
  manufacturer: string;
  finish: string;
  qtyPerSet: number;
  totalQty: number;
  doorMaterials: string[];
}

interface HwSetDisplay {
  setName: string;
  items: HwSetRowItem[];
  totalDoorQty: number;
  doorTags: string[];
}

interface FlatListRow {
  itemName: string;
  description: string;
  manufacturer: string;
  finish: string;
  totalQty: number;
  doorTags: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function doorQuantity(door: MergedDoor): number {
  const raw =
    door.sections?.door?.['QUANTITY'] ??
    door.sections?.basic_information?.['QUANTITY'] ??
    String(door.quantity ?? 1);
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

function fmt(val: string): string {
  return val || '-';
}

function getDoorMaterial(door: MergedDoor): string {
  const fromSection = door.sections?.door?.['DOOR MATERIAL'];
  if (fromSection?.trim()) return fromSection.trim();
  const fromAll = getDoorParam(door, 'DOOR MATERIAL');
  if (fromAll) return fromAll;
  return door.doorMaterial?.trim() || 'Unspecified';
}

function getElevationType(
  door: MergedDoor,
  elevationTypes: ElevationType[],
  kind: 'door' | 'frame',
): ElevationType | undefined {
  const code =
    kind === 'door'
      ? (door.doorElevationType ?? getDoorParam(door, 'DOOR ELEVATION TYPE'))
      : getDoorParam(door, 'FRAME ELEVATION TYPE');
  if (!code) return undefined;
  return (
    elevationTypes.find(
      e =>
        e.kind === kind &&
        (e.code?.toLowerCase() === code.toLowerCase() ||
          e.name?.toLowerCase() === code.toLowerCase()),
    ) ??
    elevationTypes.find(
      e =>
        e.code?.toLowerCase() === code.toLowerCase() ||
        e.name?.toLowerCase() === code.toLowerCase(),
    )
  );
}

// Keys to always skip — internal system/workflow flags
const SKIP_SECTION_KEYS = new Set([
  'DOOR INCLUDE/EXCLUDE',
  'FRAME INCLUDE/EXCLUDE',
  'HARDWARE INCLUDE/EXCLUDE',
  'EXCLUDE REASON',
]);

function formatSectionLabel(key: string): string {
  return key
    .split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

// Reads params directly from the sections data in the JSON.
// sectionOrder controls which sections are merged and in what order.
// Duplicate keys (same key appearing in multiple sections) are shown only once.
function buildSectionParams(
  door: MergedDoor,
  sectionOrder: Array<'basic_information' | 'door' | 'frame'>,
): Array<{ label: string; value: string }> {
  const seen = new Set<string>();
  const params: Array<{ label: string; value: string }> = [];

  for (const sKey of sectionOrder) {
    const section = door.sections?.[sKey] ?? {};
    for (const [key, val] of Object.entries(section)) {
      const upper = key.toUpperCase().trim();
      if (SKIP_SECTION_KEYS.has(upper)) continue;
      if (seen.has(upper)) continue;
      seen.add(upper);
      params.push({ label: formatSectionLabel(key), value: val?.trim() || '-' });
    }
  }

  return params;
}

// ── Material type classification ─────────────────────────────────────────────

type DoorMatType  = 'hm' | 'wood' | 'fiberglass' | 'vinyl' | 'other';
type FrameMatType = 'hm' | 'wood' | 'fiberglass' | 'aluminum' | 'other';

interface DoorTypeGroup  { matType: DoorMatType;  displayName: string; doors: MergedDoor[]; totalQuantity: number; }
interface FrameTypeGroup { matType: FrameMatType; displayName: string; doors: MergedDoor[]; totalQuantity: number; }

type SectionKey = 'basic_information' | 'door' | 'frame' | 'hardware';
interface ColumnDef { key: string; section: SectionKey; }

// Aliases — order matters: first match wins.
function classifyDoorMat(raw: string): DoorMatType {
  const m = raw.trim().toLowerCase();
  if (/\bhm\b|hollow[\s-]?metal/i.test(m))                               return 'hm';
  if (/\bwd\b|\bwood\b|wooden|timber|solid[\s-]?wood/i.test(m))          return 'wood';
  if (/fibr[ei][\s-]?glass|fiberglass|fibreglass|\bfg\b|\bfrp\b/i.test(m)) return 'fiberglass';
  if (/vinyl|\bvd\b|\bpvc\b|\bupvc\b/i.test(m))                          return 'vinyl';
  return 'other';
}

function classifyFrameMat(raw: string): FrameMatType {
  const m = raw.trim().toLowerCase();
  if (/\bhm\b|hollow[\s-]?metal/i.test(m))                               return 'hm';
  if (/\bwd\b|\bwood\b|wooden|timber/i.test(m))                          return 'wood';
  if (/fibr[ei][\s-]?glass|fiberglass|fibreglass|\bfg\b|\bfrp\b/i.test(m)) return 'fiberglass';
  if (/alumin[ui]m|\bal\b|\balu\b/i.test(m))                             return 'aluminum';
  return 'other';
}

function getFrameMaterialValue(door: MergedDoor): string {
  return (door.sections?.frame?.['FRAME MATERIAL'] ?? door.frameMaterial ?? '').trim();
}

const DOOR_TYPE_DISPLAY: Record<DoorMatType,  string> = { hm: 'Hollow Metal', wood: 'Wood', fiberglass: 'Fiberglass', vinyl: 'Vinyl', other: 'Other' };
const FRAME_TYPE_DISPLAY: Record<FrameMatType, string> = { hm: 'Hollow Metal', wood: 'Wood', fiberglass: 'Fiberglass', aluminum: 'Aluminum', other: 'Other' };

// ── Column definitions ────────────────────────────────────────────────────────

// Shared basic-info block (no DOOR LOCATION)
const BI: ColumnDef[] = [
  { key: 'DOOR TAG',          section: 'basic_information' },
  { key: 'QUANTITY',          section: 'basic_information' },
  { key: 'HAND OF OPENINGS',  section: 'basic_information' },
  { key: 'DOOR OPERATION',    section: 'basic_information' },
  { key: 'LEAF COUNT',        section: 'basic_information' },
  { key: 'INTERIOR/EXTERIOR', section: 'basic_information' },
  { key: 'WIDTH',             section: 'basic_information' },
  { key: 'HEIGHT',            section: 'basic_information' },
  { key: 'THICKNESS',         section: 'basic_information' },
  { key: 'FIRE RATING',       section: 'basic_information' },
];

// Shared basic-info block WITH DOOR LOCATION
const BI_LOC: ColumnDef[] = [
  { key: 'DOOR TAG',          section: 'basic_information' },
  { key: 'DOOR LOCATION',     section: 'basic_information' },
  { key: 'QUANTITY',          section: 'basic_information' },
  { key: 'HAND OF OPENINGS',  section: 'basic_information' },
  { key: 'DOOR OPERATION',    section: 'basic_information' },
  { key: 'LEAF COUNT',        section: 'basic_information' },
  { key: 'INTERIOR/EXTERIOR', section: 'basic_information' },
  { key: 'WIDTH',             section: 'basic_information' },
  { key: 'HEIGHT',            section: 'basic_information' },
  { key: 'THICKNESS',         section: 'basic_information' },
  { key: 'FIRE RATING',       section: 'basic_information' },
];

const HW_SET: ColumnDef = { key: 'HARDWARE SET', section: 'hardware' };

// ── Door column sets ──
const HM_DOOR_COLS: ColumnDef[] = [
  ...BI,
  { key: 'DOOR MATERIAL',       section: 'door' },
  { key: 'DOOR ELEVATION TYPE', section: 'door' },
  { key: 'DOOR CORE',           section: 'door' },
  { key: 'DOOR FACE',           section: 'door' },
  { key: 'DOOR EDGE',           section: 'door' },
  { key: 'DOOR GUAGE',          section: 'door' },
  { key: 'DOOR FINISH',         section: 'door' },
  { key: 'STC RATING',          section: 'door' },
  { key: 'DOOR UNDERCUT',       section: 'door' },
  HW_SET,
];

// Wood and Fiberglass share the same column set
const WOOD_FG_DOOR_COLS: ColumnDef[] = [
  ...BI,
  { key: 'DOOR MATERIAL',       section: 'door' },
  { key: 'DOOR ELEVATION TYPE', section: 'door' },
  { key: 'DOOR CORE',           section: 'door' },
  { key: 'DOOR FINISH',         section: 'door' },
  { key: 'STC RATING',          section: 'door' },
  { key: 'DOOR UNDERCUT',       section: 'door' },
  HW_SET,
];

const VINYL_DOOR_COLS: ColumnDef[] = [
  ...BI_LOC,
  { key: 'DOOR MATERIAL',       section: 'door' },
  { key: 'DOOR ELEVATION TYPE', section: 'door' },
  { key: 'DOOR CORE',           section: 'door' },
  { key: 'DOOR FINISH',         section: 'door' },
  { key: 'DOOR UNDERCUT',       section: 'door' },
  HW_SET,
];

const DOOR_TYPE_COLS: Record<DoorMatType, ColumnDef[] | null> = {
  hm:         HM_DOOR_COLS,
  wood:       WOOD_FG_DOOR_COLS,
  fiberglass: WOOD_FG_DOOR_COLS,
  vinyl:      VINYL_DOOR_COLS,
  other:      null,  // null → fall back to dynamic buildSectionParams
};

// ── Frame column sets ──
// Wood and Fiberglass share the same column set (includes DOOR LOCATION)
const WOOD_FG_FRAME_COLS: ColumnDef[] = [
  ...BI_LOC,
  { key: 'FRAME MATERIAL',       section: 'frame' },
  { key: 'WALL TYPE',            section: 'frame' },
  { key: 'THROAT THICKNESS',     section: 'frame' },
  { key: 'FRAME PROFILE',        section: 'frame' },
  { key: 'FRAME ELEVATION TYPE', section: 'frame' },
  { key: 'FRAME FINISH',         section: 'frame' },
  { key: 'FRAME HEAD',           section: 'frame' },
  { key: 'CASING',               section: 'frame' },
];

const HM_FRAME_COLS: ColumnDef[] = [
  ...BI,
  { key: 'FRAME MATERIAL',       section: 'frame' },
  { key: 'WALL TYPE',            section: 'frame' },
  { key: 'THROAT THICKNESS',     section: 'frame' },
  { key: 'FRAME ANCHOR',         section: 'frame' },
  { key: 'BASE ANCHOR',          section: 'frame' },
  { key: 'NO OF ANCHOR',         section: 'frame' },
  { key: 'FRAME PROFILE',        section: 'frame' },
  { key: 'FRAME ELEVATION TYPE', section: 'frame' },
  { key: 'FRAME ASSEMBLY',       section: 'frame' },
  { key: 'FRAME GUAGE',          section: 'frame' },
  { key: 'FRAME FINISH',         section: 'frame' },
  { key: 'FRAME HEAD',           section: 'frame' },
  { key: 'CASING',               section: 'frame' },
  HW_SET,
];

const AL_FRAME_COLS: ColumnDef[] = [
  ...BI,
  { key: 'FRAME MATERIAL',       section: 'frame' },
  { key: 'WALL TYPE',            section: 'frame' },
  { key: 'THROAT THICKNESS',     section: 'frame' },
  { key: 'FRAME ELEVATION TYPE', section: 'frame' },
  { key: 'FRAME FINISH',         section: 'frame' },
  { key: 'FRAME HEAD',           section: 'frame' },
  HW_SET,
];

const FRAME_TYPE_COLS: Record<FrameMatType, ColumnDef[] | null> = {
  hm:         HM_FRAME_COLS,
  wood:       WOOD_FG_FRAME_COLS,
  fiberglass: WOOD_FG_FRAME_COLS,
  aluminum:   AL_FRAME_COLS,
  other:      null,  // null → fall back to dynamic buildSectionParams
};

// Build params from an explicit column list
function buildParamsFromCols(
  door: MergedDoor,
  cols: ColumnDef[],
): Array<{ label: string; value: string }> {
  return cols.map(col => {
    const section = door.sections?.[col.section] ?? {};
    return {
      label: formatSectionLabel(col.key),
      value: (section[col.key] ?? '').trim() || '-',
    };
  });
}

// ── Prehung helpers ───────────────────────────────────────────────────────────

// Exact columns to show in the Prehung section, in order, with section grouping
interface PrehungColumn {
  key: string;
  section: 'basic_information' | 'door' | 'frame' | 'hardware';
  sectionHeader?: string; // emitted before this row as a sub-section title
}

const PREHUNG_COLUMNS: PrehungColumn[] = [
  { key: 'DOOR TAG',             section: 'basic_information', sectionHeader: 'Basic Information' },
  { key: 'QUANTITY',             section: 'basic_information' },
  { key: 'HAND OF OPENINGS',     section: 'basic_information' },
  { key: 'DOOR OPERATION',       section: 'basic_information' },
  { key: 'LEAF COUNT',           section: 'basic_information' },
  { key: 'INTERIOR/EXTERIOR',    section: 'basic_information' },
  { key: 'WIDTH',                section: 'basic_information' },
  { key: 'HEIGHT',               section: 'basic_information' },
  { key: 'THICKNESS',            section: 'basic_information' },
  { key: 'FIRE RATING',          section: 'basic_information' },
  { key: 'DOOR MATERIAL',        section: 'door',             sectionHeader: 'Door' },
  { key: 'DOOR ELEVATION TYPE',  section: 'door' },
  { key: 'DOOR CORE',            section: 'door' },
  { key: 'DOOR FINISH',          section: 'door' },
  { key: 'DOOR UNDERCUT',        section: 'door' },
  { key: 'FRAME MATERIAL',       section: 'frame',            sectionHeader: 'Frame' },
  { key: 'WALL TYPE',            section: 'frame' },
  { key: 'THROAT THICKNESS',     section: 'frame' },
  { key: 'FRAME PROFILE',        section: 'frame' },
  { key: 'FRAME ELEVATION TYPE', section: 'frame' },
  { key: 'FRAME FINISH',         section: 'frame' },
  { key: 'PREHUNG',              section: 'frame' },
  { key: 'FRAME HEAD',           section: 'frame' },
  { key: 'CASING',               section: 'frame' },
  { key: 'HARDWARE SET',         section: 'hardware',         sectionHeader: 'Hardware' },
];

function isPrehung(door: MergedDoor): boolean {
  return (door.sections?.frame?.['PREHUNG'] ?? '').trim().toLowerCase() === 'prehung';
}

function buildPrehungParams(
  door: MergedDoor,
): Array<{ key: string; label: string; value: string; sectionHeader?: string; section: string }> {
  return PREHUNG_COLUMNS.map(col => {
    const sectionData = col.section === 'hardware'
      ? door.sections?.hardware
      : door.sections?.[col.section];
    const raw = sectionData?.[col.key] ?? '';
    return {
      key: col.key,
      label: formatSectionLabel(col.key),
      value: raw.trim() || '-',
      sectionHeader: col.sectionHeader,
      section: col.section,
    };
  });
}

const FLAT_ROWS_PER_PAGE = 22;

// ── Component ─────────────────────────────────────────────────────────────────

const SubmittalGenerator: React.FC<SubmittalGeneratorProps> = ({
  finalJson,
  projectName,
  elevationTypes = [],
}) => {
  const componentRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [zoom, setZoom] = useState(1.0);
  const adjustZoom = (delta: number) =>
    setZoom(z => Math.min(2, Math.max(0.4, Math.round((z + delta) * 10) / 10)));

  const [companySettings, setCompanySettings] = useState<{
    companyName?: string; logoUrl?: string; websiteUrl?: string;
    email?: string; phone?: string; address?: string; province?: string; country?: string;
  } | null>(null);

  useEffect(() => {
    fetch('/api/settings/company', { credentials: 'include' })
      .then(r => r.ok ? r.json() : null)
      .then((json: { data?: typeof companySettings } | null) => { if (json?.data) setCompanySettings(json.data); })
      .catch(() => {});
  }, []);

  // All doors across all sets
  const allDoors = useMemo(() => finalJson.flatMap(s => s.doors), [finalJson]);

  // Section 1: group by classified Door Material type
  const doorTypeGroups = useMemo<DoorTypeGroup[]>(() => {
    const map = new Map<DoorMatType, DoorTypeGroup>();
    for (const door of allDoors) {
      const raw = getDoorMaterial(door);
      const matType = classifyDoorMat(raw);
      if (!map.has(matType)) {
        map.set(matType, { matType, displayName: DOOR_TYPE_DISPLAY[matType], doors: [], totalQuantity: 0 });
      }
      const g = map.get(matType)!;
      g.doors.push(door);
      g.totalQuantity += doorQuantity(door);
    }
    // Preferred display order
    const order: DoorMatType[] = ['hm', 'wood', 'fiberglass', 'vinyl', 'other'];
    return order.map(t => map.get(t)).filter((g): g is DoorTypeGroup => g !== undefined);
  }, [allDoors]);

  // Section 2: group by classified Frame Material type (reads FRAME MATERIAL, not DOOR MATERIAL)
  const frameTypeGroups = useMemo<FrameTypeGroup[]>(() => {
    const map = new Map<FrameMatType, FrameTypeGroup>();
    for (const door of allDoors) {
      const raw = getFrameMaterialValue(door);
      const matType = classifyFrameMat(raw);
      if (!map.has(matType)) {
        map.set(matType, { matType, displayName: FRAME_TYPE_DISPLAY[matType], doors: [], totalQuantity: 0 });
      }
      const g = map.get(matType)!;
      g.doors.push(door);
      g.totalQuantity += doorQuantity(door);
    }
    const order: FrameMatType[] = ['hm', 'wood', 'fiberglass', 'aluminum', 'other'];
    return order.map(t => map.get(t)).filter((g): g is FrameTypeGroup => g !== undefined);
  }, [allDoors]);

  // Section 3A: one entry per MergedHardwareSet
  const hwSetDisplays = useMemo<HwSetDisplay[]>(() => {
    return finalJson
      .filter(set => set.hardwareItems?.length > 0)
      .map(set => {
        const totalDoorQty = set.doors.reduce((s, d) => s + doorQuantity(d), 0);
        const doorMaterials = [...new Set(set.doors.map(getDoorMaterial))];
        return {
          setName: set.setName,
          totalDoorQty,
          doorTags: set.doors.map(d => d.doorTag),
          items: set.hardwareItems.map(item => ({
            itemName: item.item,
            description: (item.userDescription ?? item.processedDescription ?? item.description) || '',
            manufacturer: item.manufacturer || '',
            finish: item.finish || '',
            qtyPerSet: item.qty,
            totalQty: item.qty * totalDoorQty,
            doorMaterials,
          })),
        };
      });
  }, [finalJson]);

  // Section 3B: flat list — aggregate by item identity
  const flatListItems = useMemo<FlatListRow[]>(() => {
    const map = new Map<string, FlatListRow>();
    for (const set of finalJson) {
      const totalDoorQty = set.doors.reduce((s, d) => s + doorQuantity(d), 0);
      for (const item of set.hardwareItems) {
        const key = [
          (item.item || '').trim().toLowerCase(),
          (item.manufacturer || '').trim().toLowerCase(),
          (item.finish || '').trim().toLowerCase(),
        ].join('|');
        if (!map.has(key)) {
          map.set(key, {
            itemName: item.item,
            description: (item.userDescription ?? item.processedDescription ?? item.description) || '',
            manufacturer: item.manufacturer || '',
            finish: item.finish || '',
            totalQty: 0,
            doorTags: [],
          });
        }
        const entry = map.get(key)!;
        entry.totalQty += item.qty * totalDoorQty;
        for (const door of set.doors) {
          if (!entry.doorTags.includes(door.doorTag)) entry.doorTags.push(door.doorTag);
        }
      }
    }
    return Array.from(map.values()).sort((a, b) => a.itemName.localeCompare(b.itemName));
  }, [finalJson]);

  const flatListPages = useMemo<FlatListRow[][]>(() => {
    const pages: FlatListRow[][] = [];
    for (let i = 0; i < flatListItems.length; i += FLAT_ROWS_PER_PAGE) {
      pages.push(flatListItems.slice(i, i + FLAT_ROWS_PER_PAGE));
    }
    return pages.length > 0 ? pages : [[]];
  }, [flatListItems]);

  // Section 3: Prehung — doors where frame.PREHUNG = "prehung", grouped by Door Material
  const prehungGroups = useMemo<DoorMaterialGroup[]>(() => {
    const map = new Map<string, DoorMaterialGroup>();
    for (const door of allDoors) {
      if (!isPrehung(door)) continue;
      const mat = getDoorMaterial(door);
      if (!map.has(mat)) map.set(mat, { material: mat, doors: [], totalQuantity: 0 });
      const g = map.get(mat)!;
      g.doors.push(door);
      g.totalQuantity += doorQuantity(door);
    }
    return Array.from(map.values()).sort((a, b) => a.material.localeCompare(b.material));
  }, [allDoors]);

  const totalDoorOpenings = useMemo(
    () => allDoors.reduce((s, d) => s + doorQuantity(d), 0),
    [allDoors],
  );

  const COVER_PAGES = 1;
  const totalPages =
    COVER_PAGES +
    doorTypeGroups.length +
    frameTypeGroups.length +
    prehungGroups.length +
    hwSetDisplays.length +
    flatListPages.length;

  const hasContent = allDoors.length > 0 || hwSetDisplays.length > 0;

  // ── Download (unchanged capture logic) ────────────────────────────────────
  const handleDownload = async () => {
    if (!componentRef.current || isDownloading || !hasContent) return;
    setIsDownloading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      if (!document.querySelector('link[data-submittal-font]')) {
        await new Promise<void>(resolve => {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href =
            'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=block';
          link.dataset.submittalFont = '1';
          link.onload = () => resolve();
          link.onerror = () => resolve();
          document.head.appendChild(link);
        });
      }

      await Promise.allSettled([
        document.fonts.load('400 12px Inter'),
        document.fonts.load('500 12px Inter'),
        document.fonts.load('600 12px Inter'),
        document.fonts.load('700 12px Inter'),
        document.fonts.load('800 12px Inter'),
        document.fonts.load('900 12px Inter'),
      ]);
      await document.fonts.ready;

      const zoomWrapper = componentRef.current.parentElement as HTMLElement;
      const savedZoom = zoomWrapper.style.zoom;
      zoomWrapper.style.zoom = '1';

      const captureOverride = document.createElement('style');
      captureOverride.textContent = `
        .submittal-root .spage-body,
        .submittal-root .scol-left,
        .submittal-root .scol-right,
        .submittal-root .shw-items,
        .submittal-root .shw-item-detail,
        .submittal-root .shw-table-wrap {
          overflow: visible !important;
          max-height: none !important;
        }
      `;
      document.head.appendChild(captureOverride);

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const pages = Array.from(
        componentRef.current.querySelectorAll<HTMLElement>('.spage'),
      );
      if (!pages.length) {
        document.head.removeChild(captureOverride);
        zoomWrapper.style.zoom = savedZoom;
        return;
      }

      const canvases = await Promise.all(
        pages.map(el =>
          html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
          }),
        ),
      );

      document.head.removeChild(captureOverride);
      zoomWrapper.style.zoom = savedZoom;

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      canvases.forEach((canvas, i) => {
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
      });

      pdf.save(buildExportFilename(projectName, 'Submittal Package', 'pdf'));
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-[var(--bg-subtle)]">
      {/* Toolbar */}
      <div className="bg-[var(--bg)] border-b border-[var(--border)] px-5 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4 text-xs text-[var(--text-muted)]">
          <span>
            <span className="font-semibold text-[var(--text)]">{doorTypeGroups.length}</span>
            {' '}door type{doorTypeGroups.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="font-semibold text-[var(--text)]">{totalDoorOpenings}</span>
            {' '}total openings
          </span>
          <span>
            <span className="font-semibold text-[var(--text)]">{hwSetDisplays.length}</span>
            {' '}hardware set{hwSetDisplays.length !== 1 ? 's' : ''}
          </span>
          <span>
            <span className="font-semibold text-[var(--text)]">{flatListItems.length}</span>
            {' '}unique items
          </span>
        </div>
        {hasContent && (
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
          disabled={!hasContent || isDownloading}
          className="flex items-center gap-2 bg-[var(--primary-action)] text-[var(--text-inverted)] px-4 py-2 rounded-md hover:bg-[var(--primary-action-hover)] text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PrinterIcon className="w-4 h-4" />
          {isDownloading ? 'Generating…' : 'Download PDF'}
        </button>
      </div>

      {!hasContent && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--text-muted)]">
            <p className="text-sm font-medium">No hardware sets found in final JSON</p>
            <p className="text-xs mt-1">Run the merge pipeline first to generate the submittal package.</p>
          </div>
        </div>
      )}

      {hasContent && (
        <div className="flex-1 overflow-auto p-4">
          <div style={{ zoom }}>
            <div ref={componentRef}>
              <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');

                .submittal-root {
                  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
                  color: #0f172a;
                }

                /* ── A4 page wrapper ── */
                .spage {
                  background: #fff;
                  width: 210mm;
                  min-height: 297mm;
                  max-height: 297mm;
                  overflow: hidden;
                  box-sizing: border-box;
                  padding: 10mm 14mm 8mm;
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
                  }
                }

                /* ── Section badge ── */
                .ssec-badge {
                  display: inline-block;
                  background: #1e3a5f;
                  color: #fff;
                  font-size: 6pt;
                  font-weight: 800;
                  letter-spacing: 0.14em;
                  text-transform: uppercase;
                  padding: 2.5px 7px;
                  border-radius: 3px;
                  margin-bottom: 2.5mm;
                  flex-shrink: 0;
                }

                /* ── Page header ── */
                .spage-header {
                  display: flex;
                  justify-content: space-between;
                  align-items: flex-start;
                  margin-bottom: 4mm;
                  border-bottom: 1.5px solid #1e293b;
                  padding-bottom: 3.5mm;
                  flex-shrink: 0;
                }
                .spage-title {
                  font-size: 20pt;
                  font-weight: 900;
                  color: #0f172a;
                  line-height: 1.1;
                  margin: 0;
                }
                .spage-subtitle {
                  font-size: 8pt;
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
                  font-size: 32pt;
                  font-weight: 900;
                  color: #1e3a5f;
                  line-height: 1;
                }

                /* ── Two-column body (Door / Frame pages) ── */
                .spage-body {
                  display: grid;
                  grid-template-columns: 45% 55%;
                  gap: 6mm;
                  flex: 1;
                  min-height: 0;
                  overflow: hidden;
                }
                .scol-left {
                  display: flex;
                  flex-direction: column;
                  overflow: hidden;
                }
                .scol-right {
                  display: flex;
                  flex-direction: column;
                  overflow: hidden;
                }

                /* ── Param rows ── */
                .sparam-section { flex-shrink: 0; }
                .ssection-title {
                  font-size: 7pt;
                  font-weight: 800;
                  letter-spacing: 0.12em;
                  text-transform: uppercase;
                  color: #1e293b;
                  border-bottom: 1px solid #cbd5e1;
                  padding-bottom: 3px;
                  margin-bottom: 1.5mm;
                  line-height: 1.5;
                }
                .sparam-row {
                  display: flex;
                  align-items: baseline;
                  padding: 4px 0 5px;
                  border-bottom: 1px solid #e8edf2;
                }
                .sparam-label {
                  font-size: 7pt;
                  color: #64748b;
                  width: 40%;
                  flex-shrink: 0;
                  line-height: 1.5;
                }
                .sparam-value {
                  font-size: 7pt;
                  font-weight: 700;
                  color: #0f172a;
                  flex: 1;
                  line-height: 1.5;
                  word-break: break-word;
                }
                .sparam-value.is-dash {
                  font-weight: 400;
                  color: #94a3b8;
                }

                /* ── Door tags ── */
                .stags-section { flex-shrink: 0; }
                .stags-wrap {
                  display: flex;
                  flex-wrap: wrap;
                  gap: 2px;
                  margin-top: 2px;
                }
                .stag {
                  font-size: 6.5pt;
                  font-weight: 500;
                  color: #334155;
                  background: #f1f5f9;
                  border: 1px solid #e2e8f0;
                  border-radius: 3px;
                  padding: 2px 5px;
                  line-height: 1.5;
                }

                /* ── Elevation ── */
                .selev-section { flex-shrink: 0; margin-bottom: 3mm; }
                .selev-title {
                  font-size: 7pt;
                  font-weight: 800;
                  letter-spacing: 0.10em;
                  text-transform: uppercase;
                  color: #1e293b;
                  border-bottom: 1px solid #cbd5e1;
                  padding-bottom: 2px;
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
                  font-size: 7.5pt;
                  color: #94a3b8;
                  padding: 12px 0;
                  text-align: center;
                }

                /* ── Prehung sub-section headers ── */
                .prehung-sub-hdr {
                  font-size: 6pt;
                  font-weight: 800;
                  letter-spacing: 0.12em;
                  text-transform: uppercase;
                  padding: 3px 4px 2px;
                  margin: 3px 0 1px;
                  border-radius: 2px;
                }
                .prehung-sub-hdr.ph-basic { background: #f1f5f9; color: #475569; }
                .prehung-sub-hdr.ph-door  { background: #dcfce7; color: #15803d; }
                .prehung-sub-hdr.ph-frame { background: #dbeafe; color: #1d4ed8; }
                .prehung-sub-hdr.ph-hw    { background: #fef3c7; color: #92400e; }

                .prehung-param-row {
                  display: flex;
                  align-items: baseline;
                  padding: 3px 0 3px;
                  border-bottom: 1px solid #f1f5f9;
                }

                /* ── Hardware table pages ── */
                .shw-table-wrap {
                  flex: 1;
                  overflow: hidden;
                }
                .shw-set-label {
                  background: #f1f5f9;
                  border-radius: 3px;
                  padding: 3px 8px;
                  font-size: 8.5pt;
                  font-weight: 700;
                  color: #1e293b;
                  margin-bottom: 2mm;
                  flex-shrink: 0;
                }
                .shw-table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 7pt;
                }
                .shw-table th {
                  background: #1e293b;
                  color: #e2e8f0;
                  padding: 4px 6px;
                  text-align: left;
                  font-size: 6.5pt;
                  font-weight: 700;
                  letter-spacing: 0.06em;
                  text-transform: uppercase;
                  white-space: nowrap;
                }
                .shw-table th.th-r { text-align: right; }
                .shw-table td {
                  padding: 4px 6px;
                  border-bottom: 1px solid #e8edf2;
                  color: #0f172a;
                  line-height: 1.4;
                  vertical-align: top;
                }
                .shw-table tr:nth-child(even) td { background: #f8fafc; }
                .shw-table td.td-name {
                  font-weight: 600;
                  color: #1e293b;
                }
                .shw-table td.td-r {
                  text-align: right;
                  font-weight: 700;
                  color: #1e3a5f;
                  white-space: nowrap;
                }
                .shw-table td.td-muted {
                  color: #64748b;
                  font-size: 6.5pt;
                }

                /* ── Door tags below hardware table ── */
                .shw-affected {
                  margin-top: 3mm;
                  flex-shrink: 0;
                }
                .shw-affected-title {
                  font-size: 6.5pt;
                  font-weight: 700;
                  letter-spacing: 0.10em;
                  text-transform: uppercase;
                  color: #64748b;
                  border-top: 1px solid #e2e8f0;
                  padding-top: 2mm;
                  margin-bottom: 1.5mm;
                }

                /* ── Footer ── */
                .spage-footer {
                  display: flex;
                  justify-content: space-between;
                  font-size: 6.5pt;
                  color: #94a3b8;
                  border-top: 1px solid #e2e8f0;
                  margin-top: 3mm;
                  padding-top: 1.5mm;
                  flex-shrink: 0;
                }

                /* ── Cover page ── */
                .scover-page {
                  justify-content: space-between;
                  border: 1.2px solid #1e3a5f;
                }
                .scover-inner {
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  justify-content: center;
                  gap: 0;
                }
                .scover-company {
                  text-align: center;
                  padding-bottom: 7mm;
                  margin-bottom: 7mm;
                  border-bottom: 1.5px solid #1e3a5f;
                }
                .scover-logo {
                  max-height: 20mm;
                  max-width: 60mm;
                  object-fit: contain;
                  margin-bottom: 4mm;
                  display: block;
                  margin-left: auto;
                  margin-right: auto;
                }
                .scover-company-name {
                  font-size: 22pt;
                  font-weight: 800;
                  color: #0f172a;
                  line-height: 1.1;
                  margin-bottom: 3mm;
                }
                .scover-contact {
                  font-size: 9.5pt;
                  color: #475569;
                  line-height: 1.9;
                }
                .scover-contact-sep {
                  color: #cbd5e1;
                  margin: 0 5px;
                }
                .scover-title-block {
                  text-align: center;
                  margin-bottom: 8mm;
                }
                .scover-badge {
                  display: inline-block;
                  background: #1e3a5f;
                  color: #fff;
                  font-size: 7pt;
                  font-weight: 800;
                  letter-spacing: 0.18em;
                  text-transform: uppercase;
                  padding: 3px 10px;
                  border-radius: 3px;
                  margin-bottom: 4mm;
                }
                .scover-project {
                  font-size: 28pt;
                  font-weight: 900;
                  color: #0f172a;
                  line-height: 1.1;
                  margin-bottom: 3mm;
                  word-break: break-word;
                }
                .scover-date {
                  font-size: 10pt;
                  font-weight: 400;
                  color: #64748b;
                }
                .scover-stats {
                  display: flex;
                  gap: 0;
                  border: 1px solid #e2e8f0;
                  border-radius: 6px;
                  overflow: hidden;
                }
                .scover-stat {
                  flex: 1;
                  text-align: center;
                  padding: 5mm 4mm;
                  border-right: 1px solid #e2e8f0;
                }
                .scover-stat:last-child { border-right: none; }
                .scover-stat-value {
                  font-size: 26pt;
                  font-weight: 900;
                  color: #1e3a5f;
                  line-height: 1;
                }
                .scover-stat-label {
                  font-size: 7pt;
                  font-weight: 600;
                  letter-spacing: 0.10em;
                  text-transform: uppercase;
                  color: #94a3b8;
                  margin-top: 2px;
                }
              `}</style>

              <div className="submittal-root">

                {/* ══════════════════════════════════════════════════
                    COVER PAGE — Company + Project Info
                ══════════════════════════════════════════════════ */}
                <div className="spage scover-page">
                  <div className="scover-inner">

                    {/* Company block — only when settings are loaded */}
                    {companySettings?.companyName && (
                      <div className="scover-company">
                        {companySettings.logoUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={companySettings.logoUrl}
                            alt={companySettings.companyName}
                            className="scover-logo"
                            crossOrigin="anonymous"
                          />
                        )}
                        <div className="scover-company-name">{companySettings.companyName}</div>
                        <div className="scover-contact">
                          {(companySettings.websiteUrl || companySettings.email) && (
                            <div>
                              {companySettings.websiteUrl && <span>{companySettings.websiteUrl}</span>}
                              {companySettings.websiteUrl && companySettings.email && (
                                <span className="scover-contact-sep">·</span>
                              )}
                              {companySettings.email && <span>{companySettings.email}</span>}
                            </div>
                          )}
                          {companySettings.phone && <div>{companySettings.phone}</div>}
                          {[companySettings.address, companySettings.province, companySettings.country]
                            .filter(Boolean).join(', ') && (
                            <div>
                              {[companySettings.address, companySettings.province, companySettings.country]
                                .filter(Boolean).join(', ')}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Submittal title block */}
                    <div className="scover-title-block">
                      <div className="scover-badge">Submittal Package</div>
                      <div className="scover-project">{projectName || 'Untitled Project'}</div>
                      <div className="scover-date">
                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="scover-stats">
                      <div className="scover-stat">
                        <div className="scover-stat-value">{totalDoorOpenings}</div>
                        <div className="scover-stat-label">Total Openings</div>
                      </div>
                      <div className="scover-stat">
                        <div className="scover-stat-value">{doorTypeGroups.length + frameTypeGroups.length}</div>
                        <div className="scover-stat-label">Material Types</div>
                      </div>
                      <div className="scover-stat">
                        <div className="scover-stat-value">{hwSetDisplays.length}</div>
                        <div className="scover-stat-label">Hardware Sets</div>
                      </div>
                      <div className="scover-stat">
                        <div className="scover-stat-value">{flatListItems.length}</div>
                        <div className="scover-stat-label">Unique Items</div>
                      </div>
                    </div>

                  </div>

                  <div className="spage-footer">
                    <span>Generated by Planckoff Estimating</span>
                    <span>Page 1 of {totalPages}</span>
                  </div>
                </div>

                {/* ══════════════════════════════════════════════════
                    SECTION 1 — DOOR SPECIFICATION
                    One page per unique Door Material
                ══════════════════════════════════════════════════ */}
                {doorTypeGroups.map((group, idx) => {
                  const rep = group.doors[0];
                  const colSet = DOOR_TYPE_COLS[group.matType];
                  const params = colSet
                    ? buildParamsFromCols(rep, colSet)
                    : buildSectionParams(rep, ['basic_information', 'door']);
                  const elevType = getElevationType(rep, elevationTypes, 'door');
                  const elevCode = rep.doorElevationType ?? getDoorParam(rep, 'DOOR ELEVATION TYPE');
                  const elevImg = elevType?.imageUrl ?? elevType?.imageData;
                  const pageNum = COVER_PAGES + idx + 1;

                  return (
                    <div key={`door-${group.matType}`} className="spage">
                      <div className="ssec-badge">Section 1 · Door Specification</div>
                      <div className="spage-header">
                        <div>
                          <h1 className="spage-title">{group.displayName}</h1>
                          <p className="spage-subtitle">Door Material Type · Basic Information</p>
                        </div>
                        <div className="spage-qty-block">
                          <div className="spage-qty-label">Total Openings</div>
                          <div className="spage-qty-value">{group.totalQuantity}</div>
                        </div>
                      </div>

                      <div className="spage-body">
                        {/* Left: door params */}
                        <div className="scol-left">
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
                        </div>

                        {/* Right: elevation + tags */}
                        <div className="scol-right">
                          <div className="selev-section">
                            <div className="selev-title">
                              Door Elevation{elevCode ? ` · ${elevCode}` : ''}
                            </div>
                            <div className="selev-image-wrap" style={{ height: '72mm' }}>
                              {elevImg ? (
                                <img src={elevImg} alt={elevCode || 'Door Elevation'} />
                              ) : (
                                <span className="selev-no-elev">No Elevation Linked</span>
                              )}
                            </div>
                          </div>
                          <div className="stags-section">
                            <div className="ssection-title">
                              Affected Door Tags ({group.doors.length})
                            </div>
                            <div className="stags-wrap">
                              {group.doors.slice(0, 100).map((d, ti) => (
                                <span key={ti} className="stag">{d.doorTag}</span>
                              ))}
                              {group.doors.length > 100 && (
                                <span
                                  className="stag"
                                  style={{ color: '#94a3b8', background: 'none', border: 'none' }}
                                >
                                  +{group.doors.length - 100} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="spage-footer">
                        <span>Generated by Planckoff Estimating</span>
                        <span>Page {pageNum} of {totalPages}</span>
                      </div>
                    </div>
                  );
                })}

                {/* ══════════════════════════════════════════════════
                    SECTION 2 — FRAME SPECIFICATION
                    One page per unique Door Material
                ══════════════════════════════════════════════════ */}
                {frameTypeGroups.map((group, idx) => {
                  const rep = group.doors[0];
                  const colSet = FRAME_TYPE_COLS[group.matType];
                  const params = colSet
                    ? buildParamsFromCols(rep, colSet)
                    : buildSectionParams(rep, ['basic_information', 'frame']);
                  const elevType = getElevationType(rep, elevationTypes, 'frame');
                  const elevCode = getDoorParam(rep, 'FRAME ELEVATION TYPE');
                  const elevImg = elevType?.imageUrl ?? elevType?.imageData;
                  const pageNum = COVER_PAGES + doorTypeGroups.length + idx + 1;

                  return (
                    <div key={`frame-${group.matType}`} className="spage">
                      <div className="ssec-badge">Section 2 · Frame Specification</div>
                      <div className="spage-header">
                        <div>
                          <h1 className="spage-title">{group.displayName}</h1>
                          <p className="spage-subtitle">Frame Material Type · Basic Information</p>
                        </div>
                        <div className="spage-qty-block">
                          <div className="spage-qty-label">Total Openings</div>
                          <div className="spage-qty-value">{group.totalQuantity}</div>
                        </div>
                      </div>

                      <div className="spage-body">
                        {/* Left: frame params */}
                        <div className="scol-left">
                          <div className="sparam-section">
                            <div className="ssection-title">Frame Parameters</div>
                            {params.map((p, pi) => (
                              <div key={pi} className="sparam-row">
                                <span className="sparam-label">{p.label}</span>
                                <span className={`sparam-value${p.value === '-' ? ' is-dash' : ''}`}>
                                  {p.value}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Right: elevation + tags */}
                        <div className="scol-right">
                          <div className="selev-section">
                            <div className="selev-title">
                              Frame Elevation{elevCode ? ` · ${elevCode}` : ''}
                            </div>
                            <div className="selev-image-wrap" style={{ height: '72mm' }}>
                              {elevImg ? (
                                <img src={elevImg} alt={elevCode || 'Frame Elevation'} />
                              ) : (
                                <span className="selev-no-elev">No Elevation Linked</span>
                              )}
                            </div>
                          </div>
                          <div className="stags-section">
                            <div className="ssection-title">
                              Affected Door Tags ({group.doors.length})
                            </div>
                            <div className="stags-wrap">
                              {group.doors.slice(0, 100).map((d, ti) => (
                                <span key={ti} className="stag">{d.doorTag}</span>
                              ))}
                              {group.doors.length > 100 && (
                                <span
                                  className="stag"
                                  style={{ color: '#94a3b8', background: 'none', border: 'none' }}
                                >
                                  +{group.doors.length - 100} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="spage-footer">
                        <span>Generated by Planckoff Estimating</span>
                        <span>Page {pageNum} of {totalPages}</span>
                      </div>
                    </div>
                  );
                })}

                {/* ══════════════════════════════════════════════════
                    SECTION 3 — PREHUNG SPECIFICATION
                    Doors where frame.PREHUNG = "prehung", grouped by Door Material
                    Shows exact columns from spec: Basic Info + selected Door + Frame + HW Set
                ══════════════════════════════════════════════════ */}
                {prehungGroups.map((group, idx) => {
                  const rep = group.doors[0];
                  const params = buildPrehungParams(rep);
                  const doorElevType  = getElevationType(rep, elevationTypes, 'door');
                  const frameElevType = getElevationType(rep, elevationTypes, 'frame');
                  const doorElevCode  = rep.doorElevationType ?? getDoorParam(rep, 'DOOR ELEVATION TYPE');
                  const frameElevCode = getDoorParam(rep, 'FRAME ELEVATION TYPE');
                  const doorElevImg   = doorElevType?.imageUrl  ?? doorElevType?.imageData;
                  const frameElevImg  = frameElevType?.imageUrl ?? frameElevType?.imageData;
                  const pageNum       = COVER_PAGES + doorTypeGroups.length + frameTypeGroups.length + idx + 1;

                  const sectionColorClass: Record<string, string> = {
                    basic_information: 'ph-basic',
                    door:              'ph-door',
                    frame:             'ph-frame',
                    hardware:          'ph-hw',
                  };

                  return (
                    <div key={`prehung-${group.material}`} className="spage">
                      <div className="ssec-badge">Section 3 · Prehung Specification</div>
                      <div className="spage-header">
                        <div>
                          <h1 className="spage-title">{group.material}</h1>
                          <p className="spage-subtitle">Prehung Door &amp; Frame · Combined View</p>
                        </div>
                        <div className="spage-qty-block">
                          <div className="spage-qty-label">Total Openings</div>
                          <div className="spage-qty-value">{group.totalQuantity}</div>
                        </div>
                      </div>

                      <div className="spage-body">
                        {/* Left: prehung params with color-coded sub-section headers */}
                        <div className="scol-left">
                          <div className="sparam-section">
                            {params.map((p, pi) => (
                              <React.Fragment key={pi}>
                                {p.sectionHeader && (
                                  <div className={`prehung-sub-hdr ${sectionColorClass[p.section] ?? 'ph-basic'}`}>
                                    {p.sectionHeader}
                                  </div>
                                )}
                                <div className="prehung-param-row">
                                  <span className="sparam-label">{p.label}</span>
                                  <span className={`sparam-value${p.value === '-' ? ' is-dash' : ''}`}>
                                    {p.value}
                                  </span>
                                </div>
                              </React.Fragment>
                            ))}
                          </div>
                        </div>

                        {/* Right: door + frame elevations + door tags */}
                        <div className="scol-right">
                          {(doorElevImg || frameElevImg) && (
                            <div className="selev-section">
                              <div className="selev-title">Elevations</div>
                              {doorElevImg && frameElevImg ? (
                                <div style={{ display: 'flex', gap: '2mm', marginBottom: '2mm' }}>
                                  <div style={{ flex: 1 }}>
                                    <div className="selev-col-label" style={{ fontSize: '6pt', fontWeight: 700, color: '#64748b', marginBottom: '1mm', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                                      Door{doorElevCode ? ` · ${doorElevCode}` : ''}
                                    </div>
                                    <div className="selev-image-wrap" style={{ height: '52mm' }}>
                                      <img src={doorElevImg} alt={doorElevCode || 'Door Elevation'} />
                                    </div>
                                  </div>
                                  <div style={{ flex: 1 }}>
                                    <div className="selev-col-label" style={{ fontSize: '6pt', fontWeight: 700, color: '#64748b', marginBottom: '1mm', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                                      Frame{frameElevCode ? ` · ${frameElevCode}` : ''}
                                    </div>
                                    <div className="selev-image-wrap" style={{ height: '52mm' }}>
                                      <img src={frameElevImg} alt={frameElevCode || 'Frame Elevation'} />
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="selev-image-wrap" style={{ height: '52mm', marginBottom: '2mm' }}>
                                  <img
                                    src={(doorElevImg ?? frameElevImg)!}
                                    alt={doorElevCode || frameElevCode || 'Elevation'}
                                  />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="stags-section">
                            <div className="ssection-title">
                              Affected Door Tags ({group.doors.length})
                            </div>
                            <div className="stags-wrap">
                              {group.doors.slice(0, 100).map((d, ti) => (
                                <span key={ti} className="stag">{d.doorTag}</span>
                              ))}
                              {group.doors.length > 100 && (
                                <span
                                  className="stag"
                                  style={{ color: '#94a3b8', background: 'none', border: 'none' }}
                                >
                                  +{group.doors.length - 100} more
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="spage-footer">
                        <span>Generated by Planckoff Estimating</span>
                        <span>Page {pageNum} of {totalPages}</span>
                      </div>
                    </div>
                  );
                })}

                {/* ══════════════════════════════════════════════════
                    SECTION 3A — HARDWARE SCHEDULE · SET REPORT
                    Group By Hardware Set
                    Columns: Item Name, Description, Mfr, Finish, Total, Door Material
                    Usage: count + all door tags
                ══════════════════════════════════════════════════ */}
                {hwSetDisplays.map((set, idx) => {
                  const pageNum = COVER_PAGES + doorTypeGroups.length + frameTypeGroups.length + prehungGroups.length + idx + 1;
                  return (
                    <div key={`hwset-${set.setName}-${idx}`} className="spage">
                      <div className="ssec-badge">Section 4 · Hardware Schedule — Set Report</div>
                      <div className="spage-header">
                        <div>
                          <h1 className="spage-title">{set.setName}</h1>
                          <p className="spage-subtitle">Hardware Set · Group By Set</p>
                        </div>
                        <div className="spage-qty-block">
                          <div className="spage-qty-label">Total Doors</div>
                          <div className="spage-qty-value">{set.totalDoorQty}</div>
                        </div>
                      </div>

                      <div className="shw-table-wrap">
                        <table className="shw-table">
                          <thead>
                            <tr>
                              <th style={{ width: '20%' }}>Item Name</th>
                              <th style={{ width: '28%' }}>Description</th>
                              <th style={{ width: '16%' }}>Manufacturer</th>
                              <th style={{ width: '10%' }}>Finish</th>
                              <th className="th-r" style={{ width: '8%' }}>Total</th>
                              <th style={{ width: '18%' }}>Door Material</th>
                            </tr>
                          </thead>
                          <tbody>
                            {set.items.map((item, ii) => (
                              <tr key={ii}>
                                <td className="td-name">{item.itemName}</td>
                                <td>{item.description}</td>
                                <td>{item.manufacturer}</td>
                                <td>{item.finish}</td>
                                <td className="td-r">{item.totalQty}</td>
                                <td className="td-muted">{item.doorMaterials.join(', ') || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="shw-affected">
                          <div className="shw-affected-title">
                            Affected Doors ({set.doorTags.length})
                          </div>
                          <div className="stags-wrap">
                            {set.doorTags.slice(0, 100).map((tag, ti) => (
                              <span key={ti} className="stag">{tag}</span>
                            ))}
                            {set.doorTags.length > 100 && (
                              <span
                                className="stag"
                                style={{ color: '#94a3b8', background: 'none', border: 'none' }}
                              >
                                +{set.doorTags.length - 100} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="spage-footer">
                        <span>Generated by Planckoff Estimating</span>
                        <span>Page {pageNum} of {totalPages}</span>
                      </div>
                    </div>
                  );
                })}

                {/* ══════════════════════════════════════════════════
                    SECTION 3B — HARDWARE SCHEDULE · FLAT LIST
                    Columns: Item Name, Description, Mfr, Finish, Total
                    Doors column: count
                    Paginated at FLAT_ROWS_PER_PAGE rows
                ══════════════════════════════════════════════════ */}
                {flatListPages.map((pageItems, idx) => {
                  const pageNum =
                    COVER_PAGES + doorTypeGroups.length + frameTypeGroups.length + prehungGroups.length + hwSetDisplays.length + idx + 1;
                  const continuationLabel =
                    flatListPages.length > 1 ? ` (${idx + 1} / ${flatListPages.length})` : '';

                  return (
                    <div key={`flat-${idx}`} className="spage">
                      <div className="ssec-badge">
                        Section 4 · Hardware Schedule — Flat List{continuationLabel}
                      </div>
                      <div className="spage-header">
                        <div>
                          <h1 className="spage-title">Hardware Flat List</h1>
                          <p className="spage-subtitle">All items aggregated across hardware sets</p>
                        </div>
                        {idx === 0 && (
                          <div className="spage-qty-block">
                            <div className="spage-qty-label">Unique Items</div>
                            <div className="spage-qty-value">{flatListItems.length}</div>
                          </div>
                        )}
                      </div>

                      <div className="shw-table-wrap">
                        <table className="shw-table">
                          <thead>
                            <tr>
                              <th style={{ width: '22%' }}>Item Name</th>
                              <th style={{ width: '32%' }}>Description</th>
                              <th style={{ width: '18%' }}>Manufacturer</th>
                              <th style={{ width: '12%' }}>Finish</th>
                              <th className="th-r" style={{ width: '8%' }}>Total</th>
                              <th className="th-r" style={{ width: '8%' }}>Doors</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageItems.map((item, ii) => (
                              <tr key={ii}>
                                <td className="td-name">{item.itemName}</td>
                                <td>{item.description}</td>
                                <td>{item.manufacturer}</td>
                                <td>{item.finish}</td>
                                <td className="td-r">{item.totalQty}</td>
                                <td className="td-r td-muted">{item.doorTags.length}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="spage-footer">
                        <span>Generated by Planckoff Estimating</span>
                        <span>Page {pageNum} of {totalPages}</span>
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
