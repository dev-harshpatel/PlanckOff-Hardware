import React, { useEffect, useMemo, useState } from 'react';
import { PrinterIcon } from '../shared/icons';
import type { MergedHardwareSet, MergedDoor, HardwareItem } from '@/lib/db/hardware';
import type { ElevationType } from '@/types';
import { buildExportFilename } from '@/utils/exportFilename';
import ScheduleTable from './ScheduleTable';
import type { ScheduleCol } from './ScheduleTable';
import type { SubmittalMeta } from '@/lib/db/submittalMetadata';

interface SubmittalGeneratorProps {
  projectId: string;
  finalJson: MergedHardwareSet[];
  projectName: string;
  elevationTypes?: ElevationType[];
  submittalMeta?: SubmittalMeta;
  printMode?: boolean;
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
  if (fromSection?.trim() && !isEmptyMaterialValue(fromSection.trim())) return fromSection.trim();
  const fromAll = getDoorParam(door, 'DOOR MATERIAL');
  if (fromAll && !isEmptyMaterialValue(fromAll)) return fromAll;
  const direct = door.doorMaterial?.trim();
  if (direct && !isEmptyMaterialValue(direct)) return direct;
  return 'Unspecified';
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

type DoorMatType  = 'hm' | 'wood' | 'fiberglass' | 'vinyl' | 'aluminum' | 'other';
type FrameMatType = 'hm' | 'wood' | 'fiberglass' | 'aluminum' | 'other';

interface DoorTypeGroup  { matType: DoorMatType;  displayName: string; doors: MergedDoor[]; totalQuantity: number; }
interface FrameTypeGroup { matType: FrameMatType; displayName: string; doors: MergedDoor[]; totalQuantity: number; }

type SectionKey = 'basic_information' | 'door' | 'frame' | 'hardware';
interface ColumnDef { key: string; section: SectionKey; }

// Aliases — order matters: first match wins.
// MET / MET3 / MET7 etc. are common door-schedule shorthand for Hollow Metal.
function classifyDoorMat(raw: string): DoorMatType {
  const m = raw.trim().toLowerCase();
  if (/\bhm\b|hollow[\s-]?metal|\bmet\d*\b/i.test(m))                    return 'hm';
  if (/\bwd\b|\bwood\b|wooden|timber|solid[\s-]?wood/i.test(m))          return 'wood';
  if (/fibr[ei][\s-]?glass|fiberglass|fibreglass|\bfg\b|\bfrp\b/i.test(m)) return 'fiberglass';
  if (/vinyl|\bvd\b|\bpvc\b|\bupvc\b/i.test(m))                          return 'vinyl';
  if (/alumin[ui]m|\bal\b|\balu\b/i.test(m))                             return 'aluminum';
  return 'other';
}

function classifyFrameMat(raw: string): FrameMatType {
  const m = raw.trim().toLowerCase();
  if (/\bhm\b|hollow[\s-]?metal|\bmet\d*\b/i.test(m))                    return 'hm';
  if (/\bwd\b|\bwood\b|wooden|timber/i.test(m))                          return 'wood';
  if (/fibr[ei][\s-]?glass|fiberglass|fibreglass|\bfg\b|\bfrp\b/i.test(m)) return 'fiberglass';
  if (/alumin[ui]m|\bal\b|\balu\b|\balum\b/i.test(m))                    return 'aluminum';
  return 'other';
}

// Treat Excel placeholder values (0, -, --) as empty so they don't create
// spurious material groups in the report.
function isEmptyMaterialValue(val: string): boolean {
  return !val || /^[-–—]+$/.test(val) || val === '0';
}

function getFrameMaterialValue(door: MergedDoor): string {
  const val = (door.sections?.frame?.['FRAME MATERIAL'] ?? door.frameMaterial ?? '').trim();
  return isEmptyMaterialValue(val) ? '' : val;
}

const DOOR_TYPE_DISPLAY: Record<DoorMatType,  string> = { hm: 'Hollow Metal', wood: 'Wood', fiberglass: 'Fiberglass', vinyl: 'Vinyl', aluminum: 'Aluminum', other: 'Other' };
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
  aluminum:   null,
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

// Max data rows per landscape common-schedule page.
// Both headers and data cells word-wrap, so rows may be 2+ lines.
// 22 rows fits safely inside 210mm on both first and continuation pages.
const COMMON_ROWS_PER_PAGE = 22;

// ── Hardware Set Report flow-packing constants (all mm, matches the .spage CSS box model) ──
// Several sets are stacked per page until the page is full; a set whose table
// is too long to fit the remaining space is split, continuing on the next page.
const HWSET_PAGE_BUDGET_MM    = 245; // usable height per page, kept under the true ~261mm to avoid clipping (overflow:hidden)
const HWSET_HEADER_MM         = 23;  // full title + subtitle + qty block (first chunk of a set)
const HWSET_CONT_HEADER_MM    = 9;   // compact "(cont'd)" label used on continuation chunks
const HWSET_TABLE_HEADER_MM   = 6;   // table <thead>, repeated on every chunk
const HWSET_ROW_MM            = 6.2; // one item row
const HWSET_AFFECTED_TITLE_MM = 10;  // "Affected Doors" title, only on the last chunk of a set
const HWSET_TAG_ROW_MM        = 5;   // one wrapped row of door-tag chips
const HWSET_TAGS_PER_ROW      = 10;  // average chip width assumption
const HWSET_GAP_MM            = 8;   // vertical space between stacked sets on the same page
const HWSET_MIN_ROWS          = 2;   // never start a chunk that can't show at least this many rows

interface HwSetChunk {
  key: string;
  set: HwSetDisplay;
  startIdx: number;
  endIdx: number;
  isFirst: boolean;
  isLast: boolean;
}

function hwSetTagRowCount(n: number): number {
  return n === 0 ? 0 : Math.ceil(n / HWSET_TAGS_PER_ROW);
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks.length > 0 ? chunks : [[]];
}

// Fallback schedule columns for material types with no predefined column set
// (aluminum, other). Reads all non-skip keys from the representative door.
function buildFallbackScheduleCols(
  door: MergedDoor,
  sections: ScheduleCol['section'][],
): ScheduleCol[] {
  const seen = new Set<string>();
  const cols: ScheduleCol[] = [];
  for (const sec of sections) {
    const data = (door.sections?.[sec] ?? {}) as Record<string, string>;
    for (const rawKey of Object.keys(data)) {
      const key = rawKey.toUpperCase().trim();
      if (SKIP_SECTION_KEYS.has(key)) continue;
      if (seen.has(key)) continue;
      seen.add(key);
      cols.push({ key, section: sec });
    }
  }
  return cols;
}

// Dedup doors by their non-identity column values.
// Doors that share identical values for every column (excluding DOOR TAG,
// QUANTITY, HARDWARE SET) are merged into one variant with comma-separated tags.
interface DoorVariant {
  doorTags: string;  // comma-separated
  rep:      MergedDoor;
  count:    number;
}

const DEDUP_SKIP_KEYS = new Set(['DOOR TAG', 'QUANTITY', 'HARDWARE SET']);

function dedupDoorsByColumns(doors: MergedDoor[], cols: ScheduleCol[]): DoorVariant[] {
  const compCols = cols.filter(c => !DEDUP_SKIP_KEYS.has(c.key.toUpperCase()));
  const map = new Map<string, { tags: string[]; rep: MergedDoor }>();
  for (const door of doors) {
    const fp = compCols.map(col => {
      const sec = (door.sections?.[col.section] ?? {}) as Record<string, string>;
      return (sec[col.key] ?? '').trim().toLowerCase();
    }).join('␟');
    if (!map.has(fp)) map.set(fp, { tags: [], rep: door });
    map.get(fp)!.tags.push(door.doorTag);
  }
  return Array.from(map.values()).map(v => ({
    doorTags: v.tags.join(', '),
    rep:      v.rep,
    count:    v.tags.length,
  }));
}

// ── Component ─────────────────────────────────────────────────────────────────

const SubmittalGenerator: React.FC<SubmittalGeneratorProps> = ({
  projectId,
  finalJson,
  projectName,
  elevationTypes = [],
  submittalMeta,
  printMode = false,
}) => {
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

  // All doors across all sets — exclude doors that have an EXCLUDE REASON
  // (existing doors like EX211/EX214 that only need hardware, not new door/frame spec)
  const allDoors = useMemo(() =>
    finalJson.flatMap(s => s.doors).filter(
      d => !d.sections?.basic_information?.['EXCLUDE REASON']?.trim()
    ),
  [finalJson]);

  // Section 1: group by classified Door Material type
  const doorTypeGroups = useMemo<DoorTypeGroup[]>(() => {
    const knownMap = new Map<DoorMatType, DoorTypeGroup>();
    // Unrecognised materials get their own group keyed by raw value so the actual
    // material name shows in the report instead of the generic fallback "Other".
    const otherMap = new Map<string, DoorTypeGroup>();
    for (const door of allDoors) {
      const raw = getDoorMaterial(door);
      const matType = classifyDoorMat(raw);
      if (matType !== 'other') {
        if (!knownMap.has(matType)) {
          knownMap.set(matType, { matType, displayName: DOOR_TYPE_DISPLAY[matType], doors: [], totalQuantity: 0 });
        }
        const g = knownMap.get(matType)!;
        g.doors.push(door);
        g.totalQuantity += doorQuantity(door);
      } else {
        const displayName = raw && raw !== 'Unspecified' ? raw : 'Other';
        if (!otherMap.has(displayName)) {
          otherMap.set(displayName, { matType: 'other', displayName, doors: [], totalQuantity: 0 });
        }
        const g = otherMap.get(displayName)!;
        g.doors.push(door);
        g.totalQuantity += doorQuantity(door);
      }
    }
    const order: DoorMatType[] = ['hm', 'wood', 'fiberglass', 'vinyl', 'aluminum'];
    const knownGroups = order.map(t => knownMap.get(t)).filter((g): g is DoorTypeGroup => g !== undefined);
    const otherGroups = Array.from(otherMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
    return [...knownGroups, ...otherGroups];
  }, [allDoors]);

  // Section 2: group by classified Frame Material type (reads FRAME MATERIAL, not DOOR MATERIAL)
  const frameTypeGroups = useMemo<FrameTypeGroup[]>(() => {
    const knownMap = new Map<FrameMatType, FrameTypeGroup>();
    const otherMap = new Map<string, FrameTypeGroup>();
    for (const door of allDoors) {
      const raw = getFrameMaterialValue(door);
      const matType = classifyFrameMat(raw);
      if (matType !== 'other') {
        if (!knownMap.has(matType)) {
          knownMap.set(matType, { matType, displayName: FRAME_TYPE_DISPLAY[matType], doors: [], totalQuantity: 0 });
        }
        const g = knownMap.get(matType)!;
        g.doors.push(door);
        g.totalQuantity += doorQuantity(door);
      } else {
        const displayName = raw && raw !== 'Unspecified' ? raw : 'Other';
        if (!otherMap.has(displayName)) {
          otherMap.set(displayName, { matType: 'other', displayName, doors: [], totalQuantity: 0 });
        }
        const g = otherMap.get(displayName)!;
        g.doors.push(door);
        g.totalQuantity += doorQuantity(door);
      }
    }
    const order: FrameMatType[] = ['hm', 'wood', 'fiberglass', 'aluminum'];
    const knownGroups = order.map(t => knownMap.get(t)).filter((g): g is FrameTypeGroup => g !== undefined);
    const otherGroups = Array.from(otherMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName));
    return [...knownGroups, ...otherGroups];
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

  // Pack hardware sets into pages: stack multiple sets per page with a gap between
  // them, splitting a set's table across pages when it doesn't fit the remaining space.
  const hwSetPages = useMemo<HwSetChunk[][]>(() => {
    const pages: HwSetChunk[][] = [];
    let current: HwSetChunk[] = [];
    let used = 0;

    const startNewPage = () => {
      if (current.length > 0) pages.push(current);
      current = [];
      used = 0;
    };

    hwSetDisplays.forEach((set, setIdx) => {
      const total = set.items.length;
      const tagRows = hwSetTagRowCount(set.doorTags.length);
      const affectedCost = HWSET_AFFECTED_TITLE_MM + tagRows * HWSET_TAG_ROW_MM;

      let idx = 0;
      let isFirst = true;
      let chunkN = 0;

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const gapBefore = current.length > 0 ? HWSET_GAP_MM : 0;
        const headerCost = isFirst ? HWSET_HEADER_MM : HWSET_CONT_HEADER_MM;
        const fixedCost = headerCost + HWSET_TABLE_HEADER_MM;
        const remaining = HWSET_PAGE_BUDGET_MM - used - gapBefore;
        const minNeeded = fixedCost + HWSET_MIN_ROWS * HWSET_ROW_MM;

        if (remaining < minNeeded && current.length > 0) {
          startNewPage();
          continue;
        }

        const availForRows = Math.max(0, remaining - fixedCost);
        const rowsRemainingInSet = total - idx;

        let take: number;
        let chunkIsLast: boolean;

        if (rowsRemainingInSet * HWSET_ROW_MM + affectedCost <= availForRows) {
          take = rowsRemainingInSet;
          chunkIsLast = true;
        } else {
          take = Math.max(HWSET_MIN_ROWS, Math.floor(availForRows / HWSET_ROW_MM));
          if (take >= rowsRemainingInSet) take = Math.max(1, rowsRemainingInSet - 1);
          chunkIsLast = false;
        }

        const chunkHeight = fixedCost + take * HWSET_ROW_MM + (chunkIsLast ? affectedCost : 0);

        current.push({
          key: `${set.setName}__${setIdx}__${chunkN}`,
          set,
          startIdx: idx,
          endIdx: idx + take,
          isFirst,
          isLast: chunkIsLast,
        });

        used += gapBefore + chunkHeight;
        idx += take;
        isFirst = false;
        chunkN += 1;

        if (idx >= total) break;
      }
    });

    if (current.length > 0) pages.push(current);
    return pages;
  }, [hwSetDisplays]);

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

  // How many landscape common-sheet pages each material group needs
  const doorCommonPageCounts = useMemo(
    () => doorTypeGroups.map(g => Math.max(1, Math.ceil(g.doors.length / COMMON_ROWS_PER_PAGE))),
    [doorTypeGroups],
  );
  const frameCommonPageCounts = useMemo(
    () => frameTypeGroups.map(g => Math.max(1, Math.ceil(g.doors.length / COMMON_ROWS_PER_PAGE))),
    [frameTypeGroups],
  );

  // Precompute schedule column sets per group (needed for dedup before render)
  const doorGroupSchedCols = useMemo<ScheduleCol[][]>(() =>
    doorTypeGroups.map(group => {
      const colSet = DOOR_TYPE_COLS[group.matType];
      const rep = group.doors[0];
      return (colSet as ScheduleCol[] | null) ?? buildFallbackScheduleCols(rep, ['basic_information', 'door', 'hardware']);
    }),
  [doorTypeGroups]);

  const frameGroupSchedCols = useMemo<ScheduleCol[][]>(() =>
    frameTypeGroups.map(group => {
      const colSet = FRAME_TYPE_COLS[group.matType];
      const rep = group.doors[0];
      return (colSet as ScheduleCol[] | null) ?? buildFallbackScheduleCols(rep, ['basic_information', 'frame', 'hardware']);
    }),
  [frameTypeGroups]);

  // Number of spec pages per group = number of unique door parameter combinations
  const doorSpecPageCounts = useMemo<number[]>(() =>
    doorTypeGroups.map((group, i) =>
      Math.max(1, dedupDoorsByColumns(group.doors, doorGroupSchedCols[i] ?? []).length)
    ),
  [doorTypeGroups, doorGroupSchedCols]);

  const frameSpecPageCounts = useMemo<number[]>(() =>
    frameTypeGroups.map((group, i) =>
      Math.max(1, dedupDoorsByColumns(group.doors, frameGroupSchedCols[i] ?? []).length)
    ),
  [frameTypeGroups, frameGroupSchedCols]);

  // Total page count for each section (common pages + N spec pages per group)
  const doorSectionTotal  = useMemo(
    () => doorTypeGroups.reduce((s, _, i) => s + (doorCommonPageCounts[i] ?? 1) + (doorSpecPageCounts[i] ?? 1), 0),
    [doorTypeGroups, doorCommonPageCounts, doorSpecPageCounts],
  );
  const frameSectionTotal = useMemo(
    () => frameTypeGroups.reduce((s, _, i) => s + (frameCommonPageCounts[i] ?? 1) + (frameSpecPageCounts[i] ?? 1), 0),
    [frameTypeGroups, frameCommonPageCounts, frameSpecPageCounts],
  );

  const totalPages =
    COVER_PAGES +
    doorSectionTotal +
    frameSectionTotal +
    prehungGroups.length +
    hwSetPages.length +
    flatListPages.length;

  // Cumulative first-page number for each door group (common sheet page 1)
  const doorGroupStartPages = useMemo(() => {
    const starts: number[] = [];
    let page = COVER_PAGES + 1;
    doorTypeGroups.forEach((_, i) => {
      starts.push(page);
      page += (doorCommonPageCounts[i] ?? 1) + (doorSpecPageCounts[i] ?? 1);
    });
    return starts;
  }, [doorTypeGroups, doorCommonPageCounts, doorSpecPageCounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cumulative first-page number for each frame group
  const frameGroupStartPages = useMemo(() => {
    const starts: number[] = [];
    let page = COVER_PAGES + doorSectionTotal + 1;
    frameTypeGroups.forEach((_, i) => {
      starts.push(page);
      page += (frameCommonPageCounts[i] ?? 1) + (frameSpecPageCounts[i] ?? 1);
    });
    return starts;
  }, [frameTypeGroups, frameCommonPageCounts, frameSpecPageCounts, doorSectionTotal]); // eslint-disable-line react-hooks/exhaustive-deps

  // Section start pages for sections 3–5
  const prehungSectionStart  = COVER_PAGES + doorSectionTotal + frameSectionTotal + 1;
  const hwSetSectionStart    = prehungSectionStart + prehungGroups.length;
  const flatListSectionStart = hwSetSectionStart   + hwSetPages.length;

  // Section numbers are derived from which sections actually have content, so the
  // visible "SECTION N" badges never skip a number when e.g. there are no prehung doors.
  const sectionNumbers = useMemo(() => {
    let n = 0;
    const door     = doorTypeGroups.length  > 0 ? ++n : null;
    const frame    = frameTypeGroups.length > 0 ? ++n : null;
    const prehung  = prehungGroups.length   > 0 ? ++n : null;
    const hwSet    = hwSetPages.length      > 0 ? ++n : null;
    const flatList = flatListPages.length   > 0 ? ++n : null;
    return { door, frame, prehung, hwSet, flatList };
  }, [doorTypeGroups.length, frameTypeGroups.length, prehungGroups.length, hwSetPages.length, flatListPages.length]);

  // ── Table of Contents entries ──────────────────────────────────────────────
  interface TocEntry {
    label:     string;
    startPage: number;
    endPage:   number;
    isHeader:  boolean;
  }

  const tocEntries = useMemo<TocEntry[]>(() => {
    const entries: TocEntry[] = [];

    // Section — Door Specification
    if (doorTypeGroups.length > 0) {
      const secStart = doorGroupStartPages[0] ?? COVER_PAGES + 1;
      const lastIdx  = doorTypeGroups.length - 1;
      const secEnd   = (doorGroupStartPages[lastIdx] ?? secStart) + (doorCommonPageCounts[lastIdx] ?? 1) + (doorSpecPageCounts[lastIdx] ?? 1) - 1;
      entries.push({ label: `Section ${sectionNumbers.door} — Door Specification`, startPage: secStart, endPage: secEnd, isHeader: true });
      doorTypeGroups.forEach((g, i) => {
        const start = doorGroupStartPages[i] ?? secStart;
        const end   = start + (doorCommonPageCounts[i] ?? 1) + (doorSpecPageCounts[i] ?? 1) - 1;
        entries.push({ label: g.displayName, startPage: start, endPage: end, isHeader: false });
      });
    }

    // Section — Frame Specification
    if (frameTypeGroups.length > 0) {
      const secStart = frameGroupStartPages[0] ?? COVER_PAGES + doorSectionTotal + 1;
      const lastIdx  = frameTypeGroups.length - 1;
      const secEnd   = (frameGroupStartPages[lastIdx] ?? secStart) + (frameCommonPageCounts[lastIdx] ?? 1) + (frameSpecPageCounts[lastIdx] ?? 1) - 1;
      entries.push({ label: `Section ${sectionNumbers.frame} — Frame Specification`, startPage: secStart, endPage: secEnd, isHeader: true });
      frameTypeGroups.forEach((g, i) => {
        const start = frameGroupStartPages[i] ?? secStart;
        const end   = start + (frameCommonPageCounts[i] ?? 1) + (frameSpecPageCounts[i] ?? 1) - 1;
        entries.push({ label: g.displayName, startPage: start, endPage: end, isHeader: false });
      });
    }

    // Section — Prehung
    if (prehungGroups.length > 0) {
      entries.push({ label: `Section ${sectionNumbers.prehung} — Prehung Doors`, startPage: prehungSectionStart, endPage: prehungSectionStart + prehungGroups.length - 1, isHeader: true });
      prehungGroups.forEach((g, i) => {
        entries.push({ label: g.material, startPage: prehungSectionStart + i, endPage: prehungSectionStart + i, isHeader: false });
      });
    }

    // Section — Hardware Sets
    if (hwSetPages.length > 0) {
      entries.push({ label: `Section ${sectionNumbers.hwSet} — Hardware Sets`, startPage: hwSetSectionStart, endPage: hwSetSectionStart + hwSetPages.length - 1, isHeader: true });
    }

    // Section — Hardware Schedule
    if (flatListPages.length > 0) {
      entries.push({ label: `Section ${sectionNumbers.flatList} — Hardware Schedule`, startPage: flatListSectionStart, endPage: flatListSectionStart + flatListPages.length - 1, isHeader: true });
    }

    return entries;
  }, [doorTypeGroups, doorGroupStartPages, doorCommonPageCounts, doorSpecPageCounts, doorSectionTotal, frameTypeGroups, frameGroupStartPages, frameCommonPageCounts, frameSpecPageCounts, prehungGroups, hwSetPages, flatListPages, prehungSectionStart, hwSetSectionStart, flatListSectionStart, sectionNumbers]); // eslint-disable-line react-hooks/exhaustive-deps

  const hasContent = allDoors.length > 0 || hwSetDisplays.length > 0;

  // ── Download ───────────────────────────────────────────────────────────────
  const handleDownload = async () => {
    if (isDownloading || !hasContent || printMode) return;
    setIsDownloading(true);

    try {
      const response = await fetch(`/api/projects/${projectId}/submittal-package/pdf`, {
        credentials: 'include',
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(errorText || `PDF export failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildExportFilename(projectName, 'Submittal Package', 'pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[submittal-package] PDF download failed:', err);
      alert(err instanceof Error ? err.message : 'Failed to generate the submittal PDF.');
    } finally {
      setIsDownloading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className={printMode ? 'submittal-print-shell' : 'flex flex-col h-full bg-[var(--bg-subtle)]'}>
      {/* Toolbar */}
      {!printMode && <div className="bg-[var(--bg)] border-b border-[var(--border)] px-5 py-2.5 flex items-center justify-between flex-shrink-0">
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
      </div>}

      {!hasContent && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-[var(--text-muted)]">
            <p className="text-sm font-medium">No hardware sets found in final JSON</p>
            <p className="text-xs mt-1">Run the merge pipeline first to generate the submittal package.</p>
          </div>
        </div>
      )}

      {hasContent && (
        <div className={printMode ? 'submittal-print-content' : 'flex-1 overflow-hidden relative'}>
          {isDownloading && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[var(--bg)]">
              <span className="inline-block h-5 w-5 rounded-full border-2 border-[var(--primary-action)] border-t-transparent animate-spin" />
              <span className="text-xs font-medium text-[var(--text-muted)]">Generating PDF…</span>
            </div>
          )}
          <div className={printMode ? 'submittal-print-scroll' : 'overflow-auto h-full p-4'}>
          <div style={{ zoom: printMode ? 1 : zoom }}>
            <div>
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

                /* ── Landscape override for common schedule pages ── */
                .spage.spage-landscape {
                  width: 297mm;
                  min-height: 210mm;
                  max-height: 210mm;
                  padding: 7mm 12mm 6mm;
                }

                @media print {
                  @page {
                    size: A4 portrait;
                    margin: 0;
                  }
                  @page landscape {
                    size: A4 landscape;
                    margin: 0;
                  }
                  html,
                  body {
                    margin: 0;
                    padding: 0;
                    background: #fff;
                  }
                  .submittal-print-shell,
                  .submittal-print-content,
                  .submittal-print-scroll {
                    width: auto;
                    height: auto;
                    overflow: visible;
                    background: #fff;
                  }
                  .spage {
                    box-shadow: none;
                    margin: 0;
                    width: 210mm;
                    min-height: 297mm;
                    max-height: 297mm;
                    break-after: page;
                    page-break-after: always;
                    print-color-adjust: exact;
                    -webkit-print-color-adjust: exact;
                  }
                  .spage.spage-landscape {
                    page: landscape;
                    width: 297mm;
                    min-height: 210mm;
                    max-height: 210mm;
                  }
                  .spage:last-child {
                    break-after: auto;
                    page-break-after: auto;
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
                }
                .scol-left {
                  display: flex;
                  flex-direction: column;
                }
                .scol-right {
                  display: flex;
                  flex-direction: column;
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
                  gap: 3px;
                  margin-top: 2px;
                  align-items: center;
                }
                .stag {
                  display: inline-block;
                  height: 16px;
                  box-sizing: border-box;
                  font-size: 6.5pt;
                  font-weight: 500;
                  color: #334155;
                  background: #f1f5f9;
                  border: 1px solid #e2e8f0;
                  border-radius: 3px;
                  padding: 0 5px;
                  line-height: 14px;
                  vertical-align: middle;
                  overflow: visible;
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

                /* ── Common schedule table ── */
                .sched-table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 6pt;
                  table-layout: fixed;
                }
                .sched-table th.sched-col-hdr {
                  background: #1e293b;
                  color: #e2e8f0;
                  padding: 4px 5px;
                  text-align: left;
                  font-size: 6pt;
                  font-weight: 700;
                  letter-spacing: 0.03em;
                  /* Word-break so full header labels are visible (multi-line) */
                  white-space: normal;
                  word-break: break-word;
                  overflow-wrap: break-word;
                  vertical-align: bottom;
                  border-right: 1px solid #334155;
                }
                .sched-table th.sched-col-hdr:last-child { border-right: none; }
                .sched-table td {
                  padding: 3px 5px;
                  border-bottom: 1px solid #e8edf2;
                  border-right: 1px solid #f1f5f9;
                  color: #0f172a;
                  line-height: 1.3;
                  word-break: break-word;
                  white-space: normal;
                  vertical-align: middle;
                }
                .sched-table td:last-child { border-right: none; }
                .sched-table tr:nth-child(even) td { background: #f8fafc; }
                .sched-table td.sched-tag {
                  font-weight: 700;
                  color: #1e3a5f;
                }
                .sched-table td.sched-muted { color: #94a3b8; }

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
                  max-height: 32mm;
                  max-width: 90mm;
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
                  height: 22px;
                  box-sizing: border-box;
                  margin-bottom: 4mm;
                  background: #1e3a5f;
                  color: #fff;
                  font-size: 7pt;
                  font-weight: 800;
                  letter-spacing: 0.18em;
                  text-transform: uppercase;
                  text-align: center;
                  padding: 0 12px;
                  border-radius: 3px;
                  line-height: 22px;
                  vertical-align: middle;
                  overflow: visible;
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
                .scover-meta {
                  border: 1px solid #e2e8f0;
                  border-radius: 6px;
                  overflow: hidden;
                  margin-bottom: 5mm;
                  font-size: 9pt;
                }
                .scover-meta-row {
                  display: flex;
                  align-items: baseline;
                  padding: 3mm 4mm;
                  border-bottom: 1px solid #f1f5f9;
                }
                .scover-meta-row:last-child { border-bottom: none; }
                .scover-meta-label {
                  min-width: 22mm;
                  font-size: 7pt;
                  font-weight: 700;
                  letter-spacing: 0.08em;
                  text-transform: uppercase;
                  color: #94a3b8;
                }
                .scover-meta-value {
                  color: #1e293b;
                  font-weight: 500;
                }
                /* ── Table of Contents ── */
                .stoc {
                  margin-top: 5mm;
                }
                .stoc-title {
                  font-size: 7pt;
                  font-weight: 700;
                  letter-spacing: 0.10em;
                  text-transform: uppercase;
                  color: #94a3b8;
                  margin-bottom: 2mm;
                }
                .stoc-table {
                  width: 100%;
                  border-collapse: collapse;
                  font-size: 8.5pt;
                }
                .stoc-th {
                  background: #1e293b;
                  color: #e2e8f0;
                  padding: 3px 8px;
                  font-size: 7pt;
                  font-weight: 700;
                  letter-spacing: 0.06em;
                  text-transform: uppercase;
                }
                .stoc-th-item { text-align: left; }
                .stoc-th-page { text-align: right; width: 22mm; }
                .stoc-section-row { background: #f1f5f9; }
                .stoc-item-row { background: #ffffff; }
                .stoc-item-row:nth-child(even) { background: #f8fafc; }
                .stoc-td {
                  padding: 4px 8px;
                  border-bottom: 1px solid #e2e8f0;
                }
                .stoc-td-label { color: #1e293b; }
                .stoc-section-row .stoc-td-label {
                  font-weight: 700;
                  color: #0f172a;
                }
                .stoc-td-page {
                  text-align: right;
                  font-weight: 600;
                  color: #1d4ed8;
                  font-variant-numeric: tabular-nums;
                  white-space: nowrap;
                }
                .stoc-indent {
                  color: #94a3b8;
                  margin-right: 2px;
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
                      <div className="scover-project">{(submittalMeta?.projectName || projectName) || 'Untitled Project'}</div>
                      <div className="scover-date">
                        {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </div>
                    </div>

                    {/* Submittal metadata — from/to/gc/address/company */}
                    {submittalMeta && (submittalMeta.fromName || submittalMeta.toName || submittalMeta.gcName || submittalMeta.projectAddress || submittalMeta.companyName) && (
                      <div className="scover-meta">
                        {submittalMeta.fromName && (
                          <div className="scover-meta-row">
                            <span className="scover-meta-label">From</span>
                            <span className="scover-meta-value">{submittalMeta.fromName}</span>
                          </div>
                        )}
                        {submittalMeta.toName && (
                          <div className="scover-meta-row">
                            <span className="scover-meta-label">To</span>
                            <span className="scover-meta-value">{submittalMeta.toName}</span>
                          </div>
                        )}
                        {submittalMeta.gcName && (
                          <div className="scover-meta-row">
                            <span className="scover-meta-label">GC</span>
                            <span className="scover-meta-value">{submittalMeta.gcName}</span>
                          </div>
                        )}
                        {submittalMeta.projectAddress && (
                          <div className="scover-meta-row">
                            <span className="scover-meta-label">Address</span>
                            <span className="scover-meta-value">{submittalMeta.projectAddress}</span>
                          </div>
                        )}
                        {submittalMeta.companyName && (
                          <div className="scover-meta-row">
                            <span className="scover-meta-label">Company</span>
                            <span className="scover-meta-value">{submittalMeta.companyName}</span>
                          </div>
                        )}
                      </div>
                    )}

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

                    {/* Table of Contents */}
                    {tocEntries.length > 0 && (
                      <div className="stoc">
                        <div className="stoc-title">Table of Contents</div>
                        <table className="stoc-table">
                          <thead>
                            <tr>
                              <th className="stoc-th stoc-th-item">Section / Item</th>
                              <th className="stoc-th stoc-th-page">Page No.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {tocEntries.map((entry, i) => (
                              <tr key={i} className={entry.isHeader ? 'stoc-section-row' : 'stoc-item-row'}>
                                <td className="stoc-td stoc-td-label">
                                  {!entry.isHeader && <span className="stoc-indent">└ </span>}
                                  {entry.label}
                                </td>
                                <td className="stoc-td stoc-td-page">
                                  {entry.startPage === entry.endPage
                                    ? String(entry.startPage).padStart(2, '0')
                                    : `${String(entry.startPage).padStart(2, '0')} – ${String(entry.endPage).padStart(2, '0')}`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

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
                  const colSet      = DOOR_TYPE_COLS[group.matType];
                  const schedCols   = doorGroupSchedCols[idx] ?? [];
                  const groupStart  = doorGroupStartPages[idx] ?? COVER_PAGES + 1;
                  const nCommon     = doorCommonPageCounts[idx] ?? 1;
                  const doorChunks  = chunkArray(group.doors, COMMON_ROWS_PER_PAGE);
                  const uniqueVariants = dedupDoorsByColumns(group.doors, schedCols);

                  return (
                    <React.Fragment key={`door-${group.matType}`}>

                      {/* ── Common schedule sheet (paginated) ───────── */}
                      {doorChunks.map((chunk, ci) => (
                        <div key={`door-common-${idx}-${ci}`} className="spage spage-landscape">
                          <div className="ssec-badge">
                            Section {sectionNumbers.door} · Door Schedule{doorChunks.length > 1 ? ` (${ci + 1} / ${doorChunks.length})` : ''}
                          </div>
                          {ci === 0 && (
                            <div className="spage-header">
                              <div>
                                <h1 className="spage-title">{group.displayName}</h1>
                                <p className="spage-subtitle">Door Schedule · All Parameters</p>
                              </div>
                              <div className="spage-qty-block">
                                <div className="spage-qty-label">Total Openings</div>
                                <div className="spage-qty-value">{group.totalQuantity}</div>
                              </div>
                            </div>
                          )}
                          <div className="shw-table-wrap">
                            <ScheduleTable columns={schedCols} doors={chunk} />
                          </div>
                          <div className="spage-footer">
                            <span>Generated by Planckoff Estimating</span>
                            <span>Page {groupStart + ci} of {totalPages}</span>
                          </div>
                        </div>
                      ))}

                      {/* ── Spec pages — one per unique door parameter combination ── */}
                      {uniqueVariants.map((variant, vi) => {
                        const specPageNum  = groupStart + nCommon + vi;
                        const vRep         = variant.rep;
                        const params       = colSet
                          ? buildParamsFromCols(vRep, colSet)
                          : buildSectionParams(vRep, ['basic_information', 'door']);
                        const elevType     = getElevationType(vRep, elevationTypes, 'door');
                        const elevCode     = vRep.doorElevationType ?? getDoorParam(vRep, 'DOOR ELEVATION TYPE');
                        const elevImg      = elevType?.imageUrl ?? elevType?.imageData;
                        const repSetName   = vRep.hwSet ?? vRep.matchedSetName;
                        const repSetData   = repSetName ? finalJson.find(s => s.setName === repSetName) : null;
                        const repHwItems   = repSetData?.hardwareItems ?? [];
                        const variantTags  = variant.doorTags.split(', ');

                        return (
                          <div key={`door-spec-${idx}-${vi}`} className="spage">
                            <div className="ssec-badge">Section {sectionNumbers.door} · Door Specification</div>
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

                            {/* Flex column: two-col body + optional hw table */}
                            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', gap: '6mm', flex: 1, minHeight: 0 }}>
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
                                      Door Tags ({variant.count})
                                    </div>
                                    <div className="stags-wrap">
                                      {variantTags.map((tag, ti) => (
                                        <span key={ti} className="stag">{tag}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Hardware items table for matched set */}
                              {repHwItems.length > 0 && (
                                <div className="shw-items" style={{ flexShrink: 0, marginTop: '3mm' }}>
                                  <div className="ssection-title" style={{ marginBottom: '1.5mm' }}>
                                    Hardware Set {repSetName}
                                  </div>
                                  <table className="shw-table">
                                    <thead>
                                      <tr>
                                        <th style={{ width: '22%' }}>Item</th>
                                        <th style={{ width: '38%' }}>Description</th>
                                        <th style={{ width: '20%' }}>Manufacturer</th>
                                        <th style={{ width: '10%' }}>Finish</th>
                                        <th className="th-r" style={{ width: '10%' }}>Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {repHwItems.map((item, ii) => (
                                        <tr key={ii}>
                                          <td className="td-name">{item.item}</td>
                                          <td>{(item.userDescription ?? item.processedDescription ?? item.description) || '—'}</td>
                                          <td>{item.manufacturer || '—'}</td>
                                          <td>{item.finish || '—'}</td>
                                          <td className="td-r">{item.qty}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div className="spage-footer">
                              <span>Generated by Planckoff Estimating</span>
                              <span>Page {specPageNum} of {totalPages}</span>
                            </div>
                          </div>
                        );
                      })}

                    </React.Fragment>
                  );
                })}

                {/* ══════════════════════════════════════════════════
                    SECTION 2 — FRAME SPECIFICATION
                    One page per unique Door Material
                ══════════════════════════════════════════════════ */}
                {frameTypeGroups.map((group, idx) => {
                  const colSet         = FRAME_TYPE_COLS[group.matType];
                  const schedCols      = frameGroupSchedCols[idx] ?? [];
                  const frameGroupStart = frameGroupStartPages[idx] ?? COVER_PAGES + doorSectionTotal + 1;
                  const frameNCommon   = frameCommonPageCounts[idx] ?? 1;
                  const frameChunks    = chunkArray(group.doors, COMMON_ROWS_PER_PAGE);
                  const uniqueVariants = dedupDoorsByColumns(group.doors, schedCols);

                  return (
                    <React.Fragment key={`frame-${group.matType}`}>

                      {/* ── Common schedule sheet (paginated) ───────── */}
                      {frameChunks.map((chunk, ci) => (
                        <div key={`frame-common-${idx}-${ci}`} className="spage spage-landscape">
                          <div className="ssec-badge">
                            Section {sectionNumbers.frame} · Frame Schedule{frameChunks.length > 1 ? ` (${ci + 1} / ${frameChunks.length})` : ''}
                          </div>
                          {ci === 0 && (
                            <div className="spage-header">
                              <div>
                                <h1 className="spage-title">{group.displayName}</h1>
                                <p className="spage-subtitle">Frame Schedule · All Parameters</p>
                              </div>
                              <div className="spage-qty-block">
                                <div className="spage-qty-label">Total Openings</div>
                                <div className="spage-qty-value">{group.totalQuantity}</div>
                              </div>
                            </div>
                          )}
                          <div className="shw-table-wrap">
                            <ScheduleTable columns={schedCols} doors={chunk} />
                          </div>
                          <div className="spage-footer">
                            <span>Generated by Planckoff Estimating</span>
                            <span>Page {frameGroupStart + ci} of {totalPages}</span>
                          </div>
                        </div>
                      ))}

                      {/* ── Spec pages — one per unique frame parameter combination ── */}
                      {uniqueVariants.map((variant, vi) => {
                        const specPageNum  = frameGroupStart + frameNCommon + vi;
                        const vRep         = variant.rep;
                        const params       = colSet
                          ? buildParamsFromCols(vRep, colSet)
                          : buildSectionParams(vRep, ['basic_information', 'frame']);
                        const elevType     = getElevationType(vRep, elevationTypes, 'frame');
                        const elevCode     = getDoorParam(vRep, 'FRAME ELEVATION TYPE');
                        const elevImg      = elevType?.imageUrl ?? elevType?.imageData;
                        const repSetName   = vRep.hwSet ?? vRep.matchedSetName;
                        const repSetData   = repSetName ? finalJson.find(s => s.setName === repSetName) : null;
                        const repHwItems   = repSetData?.hardwareItems ?? [];
                        const variantTags  = variant.doorTags.split(', ');

                        return (
                          <div key={`frame-spec-${idx}-${vi}`} className="spage">
                            <div className="ssec-badge">Section {sectionNumbers.frame} · Frame Specification</div>
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

                            {/* Flex column: two-col body + optional hw table */}
                            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: '45% 55%', gap: '6mm', flex: 1, minHeight: 0 }}>
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
                                      Door Tags ({variant.count})
                                    </div>
                                    <div className="stags-wrap">
                                      {variantTags.map((tag, ti) => (
                                        <span key={ti} className="stag">{tag}</span>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Hardware items table for matched set */}
                              {repHwItems.length > 0 && (
                                <div className="shw-items" style={{ flexShrink: 0, marginTop: '3mm' }}>
                                  <div className="ssection-title" style={{ marginBottom: '1.5mm' }}>
                                    Hardware Set {repSetName}
                                  </div>
                                  <table className="shw-table">
                                    <thead>
                                      <tr>
                                        <th style={{ width: '22%' }}>Item</th>
                                        <th style={{ width: '38%' }}>Description</th>
                                        <th style={{ width: '20%' }}>Manufacturer</th>
                                        <th style={{ width: '10%' }}>Finish</th>
                                        <th className="th-r" style={{ width: '10%' }}>Qty</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {repHwItems.map((item, ii) => (
                                        <tr key={ii}>
                                          <td className="td-name">{item.item}</td>
                                          <td>{(item.userDescription ?? item.processedDescription ?? item.description) || '—'}</td>
                                          <td>{item.manufacturer || '—'}</td>
                                          <td>{item.finish || '—'}</td>
                                          <td className="td-r">{item.qty}</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>

                            <div className="spage-footer">
                              <span>Generated by Planckoff Estimating</span>
                              <span>Page {specPageNum} of {totalPages}</span>
                            </div>
                          </div>
                        );
                      })}

                    </React.Fragment>
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
                  const pageNum       = prehungSectionStart + idx;

                  const sectionColorClass: Record<string, string> = {
                    basic_information: 'ph-basic',
                    door:              'ph-door',
                    frame:             'ph-frame',
                    hardware:          'ph-hw',
                  };

                  return (
                    <div key={`prehung-${group.material}`} className="spage">
                      <div className="ssec-badge">Section {sectionNumbers.prehung} · Prehung Specification</div>
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
                {hwSetPages.map((chunks, pageIdx) => {
                  const pageNum = hwSetSectionStart + pageIdx;
                  return (
                    <div key={`hwset-page-${pageIdx}`} className="spage">
                      <div className="ssec-badge">Section {sectionNumbers.hwSet} · Hardware Schedule — Set Report</div>

                      {chunks.map((chunk, ci) => {
                        const { set } = chunk;
                        const items = set.items.slice(chunk.startIdx, chunk.endIdx);
                        return (
                          <div
                            key={chunk.key}
                            className="shw-set-block"
                            style={{ marginTop: ci > 0 ? '8mm' : 0 }}
                          >
                            {chunk.isFirst ? (
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
                            ) : (
                              <div className="shw-set-label">{set.setName} (continued)</div>
                            )}

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
                                  {items.map((item, ii) => (
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

                              {chunk.isLast && (
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
                              )}
                            </div>
                          </div>
                        );
                      })}

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
                  const pageNum = flatListSectionStart + idx;
                  const continuationLabel =
                    flatListPages.length > 1 ? ` (${idx + 1} / ${flatListPages.length})` : '';

                  return (
                    <div key={`flat-${idx}`} className="spage">
                      <div className="ssec-badge">
                        Section {sectionNumbers.flatList} · Hardware Schedule — Flat List{continuationLabel}
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
        </div>
      )}
    </div>
  );
};

export default SubmittalGenerator;
