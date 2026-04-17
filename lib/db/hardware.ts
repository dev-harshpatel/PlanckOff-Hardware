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
}

export interface ExtractedHardwareSet {
  setName: string;
  hardwareItems: HardwareItem[];
  notes?: string;
}

export interface DoorScheduleRow {
  doorTag: string;
  hwSet: string;
  buildingArea?: string;
  roomNumber?: string;
  doorLocation?: string;
  interiorExterior?: string;
  quantity?: number;
  wallType?: string;
  throatThickness?: string;
  excludeReason?: string;
  fireRating?: string;
  leafCount?: string;
  doorType?: string;
  doorWidth?: string;
  doorHeight?: string;
  thickness?: string;
  doorWidthMm?: string;
  doorHeightMm?: string;
  doorMaterial?: string;
  doorFinish?: string;
  glazingType?: string;
  frameType?: string;
  frameMaterial?: string;
  frameFinish?: string;
  hardwareSet?: string;
  hardwarePrep?: string;
  hardwareOnDoor?: string;
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
}

/** One hardware set with its matched doors — the canonical merged shape. */
export interface MergedHardwareSet {
  setName: string;
  hardwareItems: HardwareItem[];
  notes: string;
  doors: MergedDoor[];
}

export interface ProjectHardwareFinal {
  id: string;
  projectId: string;
  finalJson: MergedHardwareSet[];
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
