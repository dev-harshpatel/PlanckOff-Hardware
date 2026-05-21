

declare global {
  interface Window {
    pdfjsLib: any;
    XLSX: any;
    mammoth: any;
    pdfJsFailedToLoad: boolean;
    sheetJsFailedToLoad: boolean;
  }
}

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  details?: string;
}

export enum Role {
  Administrator = 'Administrator',
  SeniorEstimator = 'SeniorEstimator',
  Estimator = 'Estimator',
  Viewer = 'Viewer'
}

export type Page = 'dashboard' | 'project' | 'database' | 'team' | 'settings';

export type TeamMemberStatus = 'Active' | 'Pending' | 'Inactive';

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: TeamMemberStatus;
  lastActive?: string;
}

export type AIProvider = 'gemini' | 'openrouter';

export interface AppSettings {
  provider: AIProvider;
  model: string;
  geminiApiKey?: string;
  openRouterKey?: string;
}


export interface HardwareItem {
  id: string;
  name: string;
  quantity: number;
  multipliedQuantity?: number; // quantity × number of doors assigned to the set
  manufacturer: string;
  description: string;
  processedDescription?: string; // dimension-resolved description; display as processedDescription ?? description
  userDescription?: string;      // manual override; takes precedence over processedDescription
  finish: string;
  
  // Phase 21: Standards Compliance & Enhanced Specifications
  ansiGrade?: ANSIGrade;
  bhmaNumber?: string; // e.g., "A156.2", "A156.4"
  ulListed?: boolean;
  adaCompliant?: boolean;
  modelNumber?: string;
  leadTime?: string; // e.g., "2-3 weeks", "Stock"
  
  // Phase 22: CSI MasterFormat
  csiSection?: string; // e.g., "08 71 00"
  
  // Phase 24: Pricing
  unitPrice?: number;
  extendedPrice?: number;
  laborCost?: number;
  installationTime?: number; // minutes
  unitCost?: number;   // alias for unitPrice used in procurement/export services
  category?: string;   // item category used in export services
}

// New explicit type to replace `keyof Omit<HardwareItem, 'id'>`
export type HardwareItemField = 'name' | 'quantity' | 'manufacturer' | 'description' | 'finish' | 'ansiGrade' | 'bhmaNumber' | 'ulListed' | 'adaCompliant' | 'modelNumber' | 'leadTime' | 'csiSection' | 'unitPrice' | 'extendedPrice' | 'laborCost' | 'installationTime';

export interface HardwareSet {
  id: string;
  name: string;
  description: string; // Will now hold operational notes, not door tags.
  doorTags?: string; // New field for comma-separated door tags.
  division: string;
  items: HardwareItem[];
  extractionWarnings?: string[];
  isAvailable?: boolean; // New field for availability status
  isManualEntry?: boolean; // Added when the set is created manually in the UI
  
  // Phase 24: Pricing
  pricing?: HardwareSetPricing;
  totalSetCost?: number;

  prep?: string;
  parentSetId?: string; // Set when this is a variant; references the source set's id
}

// New explicit interface to replace `Omit<HardwareSet, 'id'>`
export interface NewHardwareSetData {
  name: string;
  description: string;
  doorTags?: string;
  division: string;
  items: HardwareItem[];
  extractionWarnings?: string[];
  isAvailable?: boolean;
  isManualEntry?: boolean;
  pricing?: HardwareSetPricing;
  totalSetCost?: number;
  prep?: string;
}

// ===== PHASE 19: CRITICAL DATA FIELDS =====
// Professional procurement-ready field types

export type DoorHanding = 'LH' | 'RH' | 'LHR' | 'RHR' | 'LHRB' | 'RHRB' | 'N/A';

export type DoorCoreType = 
    | 'Solid Core'
    | 'Honeycomb Core'
    | 'Particleboard Core'
    | 'Stave Core'
    | 'Mineral Core'
    | 'Polystyrene Core'
    | 'Temperature Rise Core'
    | 'Custom';

export type DoorFaceType = 
    | 'Wood Veneer'
    | 'Plastic Laminate'
    | 'Metal'
    | 'Fiberglass'
    | 'Flush Steel'
    | 'Stile & Rail'
    | 'Glass'
    | 'Custom'
    | 'Not Selected'
    | '';

export type WoodSpecies = 
    | 'Red Oak'
    | 'White Oak'
    | 'Maple'
    | 'Birch'
    | 'Cherry'
    | 'Walnut'
    | 'Ash'
    | 'Pine'
    | 'Mahogany'
    | 'Poplar'
    | 'Custom';

export type DoorFaceGrade = 'Premium' | 'Custom' | 'Standard' | 'Economy';

export type FrameMaterial = 
    | 'Hollow Metal'
    | 'Wood'
    | 'Aluminum'
    | 'Fiberglass'
    | 'Composite'
    | 'Custom'
    | 'Not Selected'
    | '';

export type FrameProfile = 
    | 'Single Rabbet'
    | 'Double Rabbet'
    | 'Cased Opening'
    | 'Drywall'
    | 'Masonry'
    | 'Custom';

export type AnchorType = 
    | 'Masonry Anchors'
    | 'Drywall Anchors'
    | 'Wood Screws'
    | 'Welded Anchors'
    | 'Expansion Anchors'
    | 'Custom';

// Phase 21: ANSI/BHMA Standards
export type ANSIGrade = 'Grade 1' | 'Grade 2' | 'Grade 3';

// Phase 21: Hardware Specifications
export interface HingeSpec {
    type: string;
    weight?: 'Standard' | 'Heavy Duty' | 'Extra Heavy Duty';
    size?: string;
    finish?: string;
    count?: number; // Used in validation
    quantity?: number; // Alias for count
    ballBearing?: boolean;
    material?: string;
    nrp?: boolean;           // Non-removable pin
    electricWire?: boolean;  // Electric wire transfer hinge
}

export interface HardwarePrepSpec {
    prepType: string;
    location?: string;
    backset?: string;
    thickness?: string;
    notes?: string;
    strikeType?: string;
    closerPrep?: boolean;
    closerType?: string;
    closerArmType?: string;
}


export interface ElectrificationSpec {
    isElectrified: boolean;
    voltage?: string;
    current?: string;
    transferType?: string;
    wiringDiagram?: string;
    powerSupplyLocation?: string;

    // Additional features
    eptRequired?: boolean;
    wiringMethod?: 'EPT' | 'Loop' | 'Wireless' | 'Hinge';
    doorContact?: boolean;
    rxSwitch?: boolean;
    latchBoltMonitor?: boolean;
    accessControlType?: string; // e.g. 'Card Reader', 'Keypad', 'Biometric'
    requestToExit?: boolean;    // REX device required
}

// Sectioned data from structured Excel uploads (mirrors the BASIC INFORMATION / DOOR / FRAME / HARDWARE column groups)
export interface BasicInformationSectionData {
  doorTag?: string;
  buildingTag?: string;
  buildingLocation?: string;
  doorLocation?: string;
  quantity?: number;
  handOfOpenings?: string;
  doorOperation?: string;
  leafCount?: string;
  interiorExterior?: string;
  excludeReason?: string;
  width?: string;
  height?: string;
  thickness?: string;
  fireRating?: string;
}

export interface DoorSectionData {
  doorMaterial?: string;
  doorElevationType?: string;
  doorCore?: string;
  doorFace?: string;
  doorEdge?: string;
  doorGauge?: string;
  doorFinish?: string;
  stcRating?: string;
  doorUndercut?: string;
  doorIncludeExclude?: string;
  width?: string;
  height?: string;
  thickness?: string;
  fireRating?: string;
}

export interface FrameSectionData {
  frameMaterial?: string;
  wallType?: string;
  throatThickness?: string;
  frameAnchor?: string;
  baseAnchor?: string;
  noOfAnchor?: string;
  frameProfile?: string;
  frameElevationType?: string;
  frameAssembly?: string;
  frameGauge?: string;
  frameFinish?: string;
  prehung?: string;
  frameHead?: string;
  casing?: string;
  frameIncludeExclude?: string;
}

export interface HardwareSectionData {
  hardwareSet?: string;
  hardwareIncludeExclude?: string;
}

export interface DoorScheduleSections {
  basic_information: BasicInformationSectionData;
  door: DoorSectionData;
  frame: FrameSectionData;
  hardware: HardwareSectionData;
}

export interface Door {
  id: string; // Required for React keys and identification
  doorTag: string;
  status: 'pending' | 'complete' | 'error' | 'loading'; // Added status field
  width: number;
  height: number;
  thickness: number;
  doorMaterial: string;
  doorCoreType?: DoorCoreType;
  doorFaceType?: DoorFaceType;
  doorFaceSpecies?: WoodSpecies | string;
  doorFaceGrade?: DoorFaceGrade;
  woodSpecies?: WoodSpecies; // Legacy/Alias
  doorFinish?: string;
  fireRating?: string;
  fireRatingLabel?: string; // Added for validation
  location?: string;
  handing?: DoorHanding;
  assignedHardwareSet?: HardwareSet | null;
  providedHardwareSet?: string; // Hardware set specified in source document
  assignmentConfidence?: 'high' | 'medium' | 'low';
  assignmentReason?: string;
  errorMessage?: string;
  isManualEntry?: boolean; // Added when the door is created manually in the UI
  elevationTypeId?: string;
  customFields?: Record<string, any>;
  // Basic fields that were missing
  quantity?: number;
  type?: string; // Single, Pair, etc.

  // Phase 19: Additional Details
  interiorExterior?: string;
  swingDirection?: string;
  undercut?: string;
  louvers?: string;
  visionPanels?: string;
  specialNotes?: string;
  operation?: string; // Added for validation
  finishSystem?: any; // Placeholder for FinishSystem type if missing
  stcRating?: string;
  smokeRating?: string; // Added for completeness
  egressRequired?: boolean; // Added for completeness
  
  // Phase 21: Hardware Specs
  hardwarePrep?: string; // Legacy/Quick access
  hingeType?: string; // Legacy/Quick access
  lockType?: string; // Legacy/Quick access
  
  hardwarePrepSpec?: HardwarePrepSpec;
  electrification?: ElectrificationSpec;
  hingeSpec?: HingeSpec;
  
  // Phase 19: Frame Details
  frameMaterial?: FrameMaterial;
  frameGauge?: string;
  frameDepth?: string;
  frameProfile?: FrameProfile;
  anchorType?: AnchorType;
  anchorSpacing?: string;
  silencerQuantity?: number;
  framePreparationNotes?: string;
  
  // Phase 19: Manufacturer Details
  doorManufacturer?: string;
  doorModelNumber?: string;
  frameManufacturer?: string;
  frameModelNumber?: string;
  
  // Phase 22: CSI MasterFormat
  csiSection?: string; // e.g., "08 11 13"

  // Phase 24: Pricing
  pricing?: DoorPricing;
  framePricing?: FramePricing;
  totalUnitCost?: number;

  // Door schedule columns (matched to Excel upload fields)
  buildingTag?: string;
  buildingLocation?: string;
  leafCount?: number;
  leafCountDisplay?: string;
  widthDisplay?: string;     // raw Excel string e.g. "(2)3'-0\""
  heightDisplay?: string;    // raw Excel string e.g. "7'-0\""
  thicknessDisplay?: string; // raw Excel string e.g. "1 3/4\""
  excludeReason?: string;
  doorCore?: string;
  doorFace?: string;
  doorEdge?: string;
  doorGauge?: string;
  doorIncludeExclude?: string;
  wallType?: string;
  throatThickness?: string;
  frameAnchor?: string;
  baseAnchor?: string;
  numberOfAnchors?: string;
  frameElevationType?: string;
  frameAssembly?: string;
  frameFinish?: string;
  prehung?: string;
  frameHead?: string;
  casing?: string;
  frameIncludeExclude?: string;
  hardwareIncludeExclude?: string;
  // Legacy/alias fields used by older services and utilities
  liftCount?: number;         // alias for leafCount used in reports
  hardwareSet?: string;       // alias for assignedHardwareSet?.name used in export services
  tag?: string;               // alias for doorTag used in export services
  material?: string;          // alias for doorMaterial used in export services
  coreType?: string;          // alias for doorCore used in export services
  faceType?: string;          // alias for doorFace used in export services
  veneerType?: string;        // door veneer type used in export services
  silencerQty?: number;       // silencer quantity override
  schedule?: string;          // schedule reference used in CSV parser

  // Sectioned representation from structured Excel uploads
  sections?: DoorScheduleSections;
}

export interface ElevationType {
  id: string;
  name: string;
  code: string;
  description?: string;
  kind?: 'door' | 'frame'; // undefined = legacy door elevation (backward compat)
  imageData?: string;   // legacy base64 (ElevationManager — kept for backward compat)
  imageUrl?: string;    // Supabase Storage public URL
  imagePath?: string;   // Storage path (used for deletion/replacement)
  doors?: Door[];
}

export interface NewProjectData {
  name: string;
  description?: string;
  client?: string;
  location?: string;
  country?: string;
  province?: string;
  dueDate?: string;
  status?: ProjectStatus;
  projectNumber?: string;
  assignedTo?: string;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  location: string;
  country?: string;
  province?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  // Added fields for Dashboard
  dueDate?: string;
  status?: ProjectStatus;
  projectNumber?: string;
  lastModified: string | Date; // Allow both for flexibility with legacy data

  elevationTypes?: ElevationType[];
  hardwareSets?: HardwareSet[];
  doors?: Door[];
  assignedTo?: string; // Team Member ID
  deletedAt?: string;  // ISO string — present only for trashed projects
}

export type ProjectStatus = 'Active' | 'Under Review' | 'Submitted' | 'On Hold' | 'Complete' | 'Archived';

export type NoteTab = 'hardware' | 'door' | 'frame';

export interface ProjectNotes {
  projectId: string;
  hardware: Record<string, unknown> | null;
  door: Record<string, unknown> | null;
  frame: Record<string, unknown> | null;
}

// Phase 20: Validation Types
export interface DoorValidationIssue {
  doorTag: string;
  field: string;
  issue: string;
  severity: 'error' | 'warning';
  suggestion?: string;
}

export interface ProjectValidationReport {
  isValid: boolean;
  totalDoors: number;
  doorsWithIssues: number;
  issues: DoorValidationIssue[];
  summary: {
    errors: number;
    warnings: number;
  };
}

// Phase 22: Professional Submittal Package Types

export type SubmittalStatus = 'Draft' | 'Submitted' | 'Approved' | 'Rejected' | 'Resubmit' | 'Reviewed';

export interface SubmittalMetadata {
  projectName: string;
  projectNumber: string;
  submittalNumber: string;
  submittalDate: Date;
  revisionNumber: number;
  preparedBy: string;
  status: SubmittalStatus;
  companyLogoUrl?: string;
  projectAddress?: string;
  architect?: string;
  contractor?: string;
  revisionDate?: Date;
  notes?: string;
  reviewedBy?: string;
  approvedBy?: string;
}

export interface SubmittalRevision {
  revisionNumber: number;
  date: Date;
  description: string;
  preparedBy: string;
  reviewedBy?: string;
  approvalStatus?: 'Approved' | 'Approved as Noted' | 'Rejected' | 'Resubmit';
  comments?: string;
  // Extended fields used by RevisionHistory component
  status?: SubmittalStatus;
  changedBy?: string;
  revisionDate?: Date;
  changeDescription?: string;
  affectedDoors?: string[];
  affectedItems?: string[];
  reviewComments?: string;
  reviewDate?: Date;
}

export interface TableOfContentsEntry {
  section: string;
  title: string;
  pageNumber: number;
}

export interface SubmittalPackage {
  metadata: SubmittalMetadata;
  tableOfContents: TableOfContentsEntry[];
  revisions: SubmittalRevision[];
  doors: Door[];
  hardwareSets: HardwareSet[];
  cutSheets: ManufacturerCutSheet[];
}

export interface ManufacturerCutSheet {
  id: string;
  manufacturer: string;
  productName: string;
  modelNumber: string;
  category: 'door' | 'frame' | 'hardware';
  csiSection?: string;
  fileUrl?: string;
  fileName?: string;
  uploadDate: Date;
  notes?: string;
  linkedDoorIds?: string[];
  linkedHardwareItemIds?: string[];
}

// Phase 23: Procurement Summary Types (already defined in procurementSummaryService.ts)
// These are re-exported here for consistency

export interface ProcurementItem {
  itemId: string;
  name: string;
  description: string;
  manufacturer: string;
  modelNumber: string;
  quantity: number;
  leadTime: string;
  ansiGrade?: string;
  csiSection?: string;
  hardwareSets: string[];
}

export interface ManufacturerGroup {
  manufacturer: string;
  items: ProcurementItem[];
  totalQuantity: number;
  totalCost: number;
  longestLeadTime: string;
}

// ===== PHASE 24: COMPREHENSIVE PRICING SYSTEM =====

// Door Pricing
export interface DoorPricing {
  baseDoorPrice: number;
  framePrice: number;
  prepPrice: number; // Preparation/machining
  finishPrice: number;
  fireRatingUpcharge: number;
  totalDoorPrice: number;
}

// Frame Pricing
export interface FramePricing {
  baseFramePrice: number;
  anchorPrice: number;
  silencerPrice: number;
  prepPrice: number;
  finishPrice: number;
  totalFramePrice: number;
}

// Hardware Set Pricing
export interface HardwareSetPricing {
  materialCost: number;
  laborCost: number;
  totalCost: number;
  markup: number; // percentage
  margin: number; // percentage
  sellPrice: number;
}

// Project Pricing Summary
export interface ProjectPricing {
  totalDoorsCost: number;
  totalFramesCost: number;
  totalHardwareCost: number;
  subtotal: number;
  
  // Adjustments
  taxRate: number; // percentage
  taxAmount: number;
  shippingCost: number;
  discountAmount: number;
  
  // Markups
  materialMarkup: number; // percentage
  laborMarkup: number; // percentage
  overheadPercentage: number;
  profitMargin: number; // percentage
  
  // Totals
  totalCost: number;
  totalSellPrice: number;
  totalProfit: number;
  profitMarginPercentage: number;
}

// Price Book Entry
export interface PriceBookEntry {
  id: string;
  category: 'door' | 'frame' | 'hardware';
  itemType: string; // e.g., "Hollow Metal Door", "Mortise Lock"
  manufacturer?: string;
  modelNumber?: string;
  description: string;
  unitPrice: number;
  unitOfMeasure: 'each' | 'set' | 'pair';
  laborHours?: number;
  laborRate?: number;
  effectiveDate: Date;
  expirationDate?: Date;
  supplier?: string;
  leadTime?: string;
  notes?: string;
  
  // Specification matching criteria
  specifications?: {
    material?: string;
    width?: number;
    height?: number;
    thickness?: number;
    finish?: string;
    fireRating?: string;
    ansiGrade?: ANSIGrade;
  };
}

// Pricing Settings
export interface PricingSettings {
  defaultLaborRate: number; // $/hour
  defaultMaterialMarkup: number; // percentage
  defaultLaborMarkup: number; // percentage
  defaultOverheadPercentage: number; // percentage
  defaultProfitMargin: number; // percentage
  defaultTaxRate: number; // percentage
  includeShipping: boolean;
  defaultShippingCost: number;
  
  // Quantity discount tiers
  quantityDiscounts: DiscountTier[];
}

// Discount Tier
export interface DiscountTier {
  minQuantity: number;
  maxQuantity?: number;
  discountPercentage: number;
}

// Pricing Report
export interface PricingReport {
  projectName: string;
  generatedDate: Date;
  generatedBy: string;
  
  // Line items
  doorLineItems: DoorLineItem[];
  hardwareLineItems: HardwareLineItem[];
  
  // Summary
  pricing: ProjectPricing;
  
  // Metadata
  validUntil?: Date;
  notes?: string;
  terms?: string;
}

// Door Line Item
export interface DoorLineItem {
  doorTag: string;
  description: string;
  quantity: number;
  unitPrice: number;
  extendedPrice: number;
  pricing?: DoorPricing;
}

// Hardware Line Item
export interface HardwareLineItem {
  hardwareSetName: string;
  description: string;
  doorsUsingSet: number;
  unitPrice: number;
  extendedPrice: number;
  pricing?: HardwareSetPricing;
}

// ===== END PHASE 24 =====

// PDF Ingestion Types
export interface PDFProcessingProgress {
  currentPage: number;
  totalPages: number;
  status: 'processing' | 'complete' | 'error';
  message?: string;
}

export interface PDFExtractionResult {
  doors: Door[];
  hardwareSets: HardwareSet[];
  warnings: string[];
  processingTime: number;
}

// Validation types for CSV/Excel import
export interface ImportValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  data: any[];
}

export interface ValidationError {
  row: number | string;
  field: string;
  value: any;
  issue: string;
  suggestion?: string;
  severity: 'error' | 'warning';
}

export interface ValidationReport<T> {
  data: T[];
  errors: ValidationError[];
  warnings: ValidationError[];
  summary: {
    totalProcessed: number;
    validCount: number;
    errorCount: number;
    warningCount: number;
  };
}

// ===== ESTIMATION REPORT =====

export interface HardwareSummaryItemDetails {
  name: string;
  manufacturer: string;
  description: string;
  processedDescription?: string;
  finish: string;
  doorMaterial?: string;
  [key: string]: unknown;
}

export interface HardwareSummary {
  item: HardwareSummaryItemDetails;
  totalQuantity: number;
  sourceSets: string[];
}

export interface Report {
  totalDoors: number;
  doorsWithHardware: number;
  hardwareSummary: Record<string, HardwareSummary>;
}

// ===== FINISH SYSTEM =====

export interface DoorFinishSystem {
  id: string;
  name: string;
  basePrep?: 'Factory Primed' | 'Unfinished' | 'Pre-finished' | 'Field Applied';
  finishType?: 'Paint' | 'Stain' | 'Clear Coat' | 'Powder Coat' | 'Anodized' | 'Mill Finish' | 'None';
  sheen?: 'Flat' | 'Eggshell' | 'Satin' | 'Semi-Gloss' | 'Gloss';
  colorName?: string;
  manufacturer?: string;
  productCode?: string;
  doorFinish?: string;
  frameFinish?: string;
  hardwareFinish?: string;
  notes?: string;
}

// ===== ML OPS =====

export interface TrainingExample {
  id?: string;
  timestamp: string;
  projectId?: string;
  inputContext: {
    doorType?: string;
    fireRating?: string;
    location?: string;
    hardwarePrep?: string;
    material?: string;
    [key: string]: unknown;
  };
  userCorrection: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface MLModelMetrics {
  accuracy?: number;
  totalPredictions?: number;
  correctPredictions?: number;
  lastUpdated?: string;
  totalExamples?: number;
  lastLearned?: string;
}
