import { createSupabaseAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HardwareItem {
  qty: number;
  item: string;
  manufacturer: string;
  description: string;
  finish: string;
  multipliedQuantity?: number; // qty × number of doors assigned to this set
}

export interface ExtractedHardwareSet {
  setName: string;
  hardwareItems: HardwareItem[];
  notes?: string;
}

export interface DoorScheduleRow {
  doorTag: string;
  hwSet: string;
  // Identity
  buildingTag?: string;
  buildingArea?: string;
  buildingLocation?: string;
  roomNumber?: string;
  doorLocation?: string;
  interiorExterior?: string;
  quantity?: number;
  handOfOpenings?: string;
  doorOperation?: string;
  leafCount?: string;
  excludeReason?: string;
  // Dimensions
  doorWidth?: string;
  doorHeight?: string;
  thickness?: string;
  doorWidthMm?: string;
  doorHeightMm?: string;
  // Door material & finish
  fireRating?: string;
  doorType?: string;
  doorElevationType?: string;
  doorMaterial?: string;
  doorCore?: string;
  doorFace?: string;
  doorEdge?: string;
  doorGauge?: string;
  doorFinish?: string;
  stcRating?: string;
  doorUndercut?: string;
  doorIncludeExclude?: string;
  glazingType?: string;
  // Frame
  wallType?: string;
  throatThickness?: string;
  frameType?: string;
  frameMaterial?: string;
  frameAnchor?: string;
  baseAnchor?: string;
  numberOfAnchors?: string;
  frameProfile?: string;
  frameElevationType?: string;
  frameAssembly?: string;
  frameGauge?: string;
  frameFinish?: string;
  prehung?: string;
  frameHead?: string;
  casing?: string;
  frameIncludeExclude?: string;
  // Hardware
  hardwareSet?: string;
  hardwareIncludeExclude?: string;
  hardwarePrep?: string;
  hardwareOnDoor?: string;
  // Accessories (boolean flags)
  hasCardReader?: boolean;
  hasKeyPad?: boolean;
  hasAutoOperator?: boolean;
  hasPrivacySet?: boolean;
  hasKeyedLock?: boolean;
  hasPushPlate?: boolean;
  hasAntiBarricade?: boolean;
  hasKickPlate?: boolean;
  hasFrameProtection?: boolean;
  hasDoorCloser?: boolean;
  comments?: string;
  // Sectioned representation from structured Excel uploads.
  // Keys are the original Excel column names (e.g. "DOOR TAG", "FRAME MATERIAL", "HARDWARE SET").
  sections?: {
    door: Record<string, string | undefined>;
    frame: Record<string, string | undefined>;
    hardware: Record<string, string | undefined>;
  };
}

export interface HardwarePdfExtraction {
  id: string;
  projectId: string;
  extractedJson: ExtractedHardwareSet[];
  fileName: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DoorScheduleImport {
  id: string;
  projectId: string;
  scheduleJson: DoorScheduleRow[];
  fileName: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Merged types (project_hardware_finals)
// ---------------------------------------------------------------------------

/** A door row as it appears in the merged output — key fields only. */
export interface MergedDoor {
  doorTag: string;
  hwSet: string;            // original code from schedule (may have suffix like .W)
  matchedSetName: string;   // the PDF setName this was matched to
  buildingArea?: string;
  doorLocation?: string;
  interiorExterior?: string;
  quantity?: number;
  fireRating?: string;
  leafCount?: string;
  doorType?: string;
  doorElevationType?: string;
  doorWidth?: string;
  doorHeight?: string;
  thickness?: string;
  doorMaterial?: string;
  frameMaterial?: string;
  hardwarePrep?: string;
  hasCardReader?: boolean;
  hasKeyPad?: boolean;
  hasAutoOperator?: boolean;
  hasPrivacySet?: boolean;
  hasKeyedLock?: boolean;
  hasPushPlate?: boolean;
  hasAntiBarricade?: boolean;
  hasKickPlate?: boolean;
  hasFrameProtection?: boolean;
  hasDoorCloser?: boolean;
  comments?: string;
  excludeReason?: string;
  scheduleOrder?: number; // original row index in the uploaded door schedule
  sections?: {
    door: Record<string, string | undefined>;
    frame: Record<string, string | undefined>;
    hardware: Record<string, string | undefined>;
  };
}

/** One hardware set with its matched doors — the canonical merged shape. */
export interface MergedHardwareSet {
  setName: string;
  hardwareItems: HardwareItem[];
  notes: string;
  doors: MergedDoor[];
}

/** A deleted hardware set or standalone door held in trash_json until restored or purged. */
export interface TrashItem {
  id: string;           // stable UUID for this trash entry
  type: 'set' | 'door';
  setData?: MergedHardwareSet;  // present when type = 'set'
  doorData?: MergedDoor;        // present when type = 'door'
  setName: string;      // display label (set name, or door tag for standalone doors)
  deletedAt: string;    // ISO timestamp
}

export interface ProjectHardwareFinal {
  id: string;
  projectId: string;
  finalJson: MergedHardwareSet[];
  trashJson: TrashItem[];
  pdfExtractionId: string | null;
  doorScheduleId: string | null;
  generatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type DbResult<T> = { data: T | null; error: { message: string } | null };

// ---------------------------------------------------------------------------
// Hardware PDF Extractions
// ---------------------------------------------------------------------------

export async function upsertHardwarePdfExtraction(
  projectId: string,
  payload: {
    extractedJson: ExtractedHardwareSet[];
    fileName?: string;
    uploadedBy?: string;
  },
): Promise<DbResult<HardwarePdfExtraction>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('hardware_pdf_extractions')
      .upsert(
        {
          project_id: projectId,
          extracted_json: payload.extractedJson,
          file_name: payload.fileName ?? null,
          uploaded_by: payload.uploadedBy ?? null,
        },
        { onConflict: 'project_id' },
      )
      .select()
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toHardwarePdfExtraction(data), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getHardwarePdfExtraction(
  projectId: string,
): Promise<DbResult<HardwarePdfExtraction | null>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('hardware_pdf_extractions')
      .select()
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data ? toHardwarePdfExtraction(data) : null, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

// ---------------------------------------------------------------------------
// Door Schedule Imports
// ---------------------------------------------------------------------------

export async function upsertDoorScheduleImport(
  projectId: string,
  payload: {
    scheduleJson: DoorScheduleRow[];
    fileName?: string;
    uploadedBy?: string;
  },
): Promise<DbResult<DoorScheduleImport>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('door_schedule_imports')
      .upsert(
        {
          project_id: projectId,
          schedule_json: payload.scheduleJson,
          file_name: payload.fileName ?? null,
          uploaded_by: payload.uploadedBy ?? null,
        },
        { onConflict: 'project_id' },
      )
      .select()
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toDoorScheduleImport(data), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getDoorScheduleImport(
  projectId: string,
): Promise<DbResult<DoorScheduleImport | null>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('door_schedule_imports')
      .select()
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data ? toDoorScheduleImport(data) : null, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

// ---------------------------------------------------------------------------
// Row transformers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toHardwarePdfExtraction(row: any): HardwarePdfExtraction {
  return {
    id: row.id,
    projectId: row.project_id,
    extractedJson: row.extracted_json ?? [],
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDoorScheduleImport(row: any): DoorScheduleImport {
  return {
    id: row.id,
    projectId: row.project_id,
    scheduleJson: row.schedule_json ?? [],
    fileName: row.file_name,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toProjectHardwareFinal(row: any): ProjectHardwareFinal {
  return {
    id: row.id,
    projectId: row.project_id,
    finalJson: row.final_json ?? [],
    trashJson: row.trash_json ?? [],
    pdfExtractionId: row.pdf_extraction_id,
    doorScheduleId: row.door_schedule_id,
    generatedBy: row.generated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ---------------------------------------------------------------------------
// Project Hardware Finals
// ---------------------------------------------------------------------------

export async function upsertProjectHardwareFinal(
  projectId: string,
  payload: {
    finalJson: MergedHardwareSet[];
    pdfExtractionId?: string;
    doorScheduleId?: string;
    generatedBy?: string;
  },
): Promise<DbResult<ProjectHardwareFinal>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_hardware_finals')
      .upsert(
        {
          project_id: projectId,
          final_json: payload.finalJson,
          pdf_extraction_id: payload.pdfExtractionId ?? null,
          door_schedule_id: payload.doorScheduleId ?? null,
          generated_by: payload.generatedBy ?? null,
        },
        { onConflict: 'project_id' },
      )
      .select()
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toProjectHardwareFinal(data), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function updateProjectHardwareFinal(
  projectId: string,
  finalJson: MergedHardwareSet[],
  trashJson?: TrashItem[],
): Promise<DbResult<ProjectHardwareFinal>> {
  try {
    const db = createSupabaseAdminClient();
    const patch: Record<string, unknown> = { final_json: finalJson };
    if (trashJson !== undefined) patch.trash_json = trashJson;

    const { data, error } = await db
      .from('project_hardware_finals')
      .update(patch)
      .eq('project_id', projectId)
      .select()
      .single();

    if (error) return { data: null, error: { message: error.message } };
    return { data: toProjectHardwareFinal(data), error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}

export async function getProjectHardwareFinal(
  projectId: string,
): Promise<DbResult<ProjectHardwareFinal | null>> {
  try {
    const db = createSupabaseAdminClient();
    const { data, error } = await db
      .from('project_hardware_finals')
      .select()
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return { data: null, error: { message: error.message } };
    return { data: data ? toProjectHardwareFinal(data) : null, error: null };
  } catch (err) {
    return { data: null, error: { message: String(err) } };
  }
}
