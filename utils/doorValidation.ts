import { Door } from '../types';

/**
 * Phase 20: Door Validation Engine
 * 
 * Comprehensive validation system to ensure procurement-ready door schedules.
 * Prevents incomplete submittals and guides users to fix issues.
 */

export interface ValidationRule {
    id: string;
    field: keyof Door | 'composite'; // 'composite' for multi-field rules
    severity: 'critical' | 'warning' | 'info';
    validate: (door: Door) => boolean; // Returns true if VALID
    message: (door: Door) => string; // Dynamic message
    suggestion?: (door: Door) => string; // How to fix
}

export interface ValidationResult {
    doorId: string;
    doorTag: string;
    ruleId: string;
    severity: 'critical' | 'warning' | 'info';
    message: string;
    suggestion?: string;
    field?: keyof Door;
}

export interface ProjectValidationReport {
    totalDoors: number;
    validDoors: number;
    criticalErrors: ValidationResult[];
    warnings: ValidationResult[];
    infos: ValidationResult[];
    completenessScore: number; // 0-100
    canExport: boolean;
}

// ===== VALIDATION RULES =====

export const VALIDATION_RULES: ValidationRule[] = [
    // ===== CRITICAL ERRORS (Block Export) =====
    
    {
        id: 'handing-required-with-hardware',
        field: 'handing',
        severity: 'critical',
        validate: (door) => {
            // Handing is required if hardware is assigned
            if (door.assignedHardwareSet && !door.handing) {
                return false;
            }
            return true;
        },
        message: (door) => `Handing is required when hardware is assigned`,
        suggestion: () => 'Open door editor (double-click row) and select handing (LH/RH/LHR/RHR) in the Basic Info tab'
    },
    
    {
        id: 'fire-rating-label-missing',
        field: 'fireRatingLabel',
        severity: 'critical',
        validate: (door) => {
            // Fire-rated doors must have a label
            if (door.fireRating && door.fireRating !== 'N/A' && !door.fireRatingLabel) {
                return false;
            }
            return true;
        },
        message: (door) => `Fire-rated doors must have a label (UL/WHI/Intertek)`,
        suggestion: () => 'Specify the fire rating label in the Basic Info tab'
    },
    
    {
        id: 'zero-dimensions',
        field: 'composite',
        severity: 'critical',
        validate: (door) => {
            // Dimensions cannot be zero
            if (door.width === 0 || door.height === 0 || door.thickness === 0) {
                return false;
            }
            return true;
        },
        message: (door) => `Door dimensions cannot be zero (W: ${door.width}", H: ${door.height}", T: ${door.thickness}")`,
        suggestion: () => 'Enter valid door dimensions in the Basic Info tab'
    },
    
    {
        id: 'missing-door-tag',
        field: 'doorTag',
        severity: 'critical',
        validate: (door) => {
            // Door tag cannot be empty
            return door.doorTag && door.doorTag.trim().length > 0;
        },
        message: () => `Door tag cannot be empty`,
        suggestion: () => 'Assign a unique door tag/number'
    },
    
    // ===== WARNINGS (Allow Export with Confirmation) =====
    
    {
        id: 'incomplete-material-spec',
        field: 'composite',
        severity: 'warning',
        validate: (door) => {
            const hasCore = !!door.doorCoreType;
            const hasFace = !!door.doorFaceType;
            // Warning if only one is specified (XOR)
            if ((hasCore && !hasFace) || (!hasCore && hasFace)) {
                return false;
            }
            return true;
        },
        message: () => `Incomplete material specification - specify both core and face type`,
        suggestion: () => 'Complete both Core Type and Face Type in the Materials tab for accurate procurement'
    },
    
    {
        id: 'finish-system-incomplete',
        field: 'composite',
        severity: 'warning',
        validate: (door) => {
            if (door.finishSystem && door.finishSystem.finishType && door.finishSystem.finishType !== 'None') {
                // If finish type is specified, manufacturer and color should be too
                if (!door.finishSystem.manufacturer || !door.finishSystem.colorName) {
                    return false;
                }
            }
            return true;
        },
        message: () => `Finish system missing manufacturer or color specification`,
        suggestion: () => 'Complete finish manufacturer and color in the Finish tab to prevent procurement delays'
    },
    
    {
        id: 'frame-gauge-missing',
        field: 'frameGauge',
        severity: 'warning',
        validate: (door) => {
            // Steel/Metal frames should specify gauge
            const frameMaterialLower = door.frameMaterial?.toLowerCase() || '';
            const isMetalFrame = frameMaterialLower.includes('steel') || frameMaterialLower.includes('metal');
            
            if (isMetalFrame && !door.frameGauge) {
                return false;
            }
            return true;
        },
        message: () => `Steel/metal frames should specify gauge (16 GA, 18 GA, etc.)`,
        suggestion: () => 'Specify frame gauge in the Frame tab'
    },
    
    {
        id: 'no-door-manufacturer',
        field: 'doorManufacturer',
        severity: 'warning',
        validate: (door) => {
            return !!door.doorManufacturer;
        },
        message: () => `Door manufacturer not specified`,
        suggestion: () => 'Specify door manufacturer in the Materials tab for procurement clarity'
    },
    
    {
        id: 'no-frame-manufacturer',
        field: 'frameManufacturer',
        severity: 'warning',
        validate: (door) => {
            return !!door.frameManufacturer;
        },
        message: () => `Frame manufacturer not specified`,
        suggestion: () => 'Specify frame manufacturer in the Frame tab'
    },
    
    {
        id: 'undercut-not-specified',
        field: 'undercut',
        severity: 'warning',
        validate: (door) => {
            // Fire-rated doors should specify undercut
            if (door.fireRating && door.fireRating !== 'N/A' && !door.undercut) {
                return false;
            }
            return true;
        },
        message: () => `Fire-rated doors should specify undercut for ADA compliance`,
        suggestion: () => 'Specify undercut (typically 0.75" or 1") in the Basic Info tab'
    },
    
    {
        id: 'wood-species-missing',
        field: 'doorFaceSpecies',
        severity: 'warning',
        validate: (door) => {
            // If face type is wood veneer, species should be specified
            if (door.doorFaceType === 'Wood Veneer' && !door.doorFaceSpecies) {
                return false;
            }
            return true;
        },
        message: () => `Wood veneer doors should specify species (Oak, Maple, etc.)`,
        suggestion: () => 'Specify wood species in the Materials tab'
    },
    
    // ===== INFO (Best Practice Suggestions) =====
    
    {
        id: 'using-legacy-material-field',
        field: 'composite',
        severity: 'info',
        validate: (door) => {
            // Info if using legacy doorMaterial but not structured fields
            if (door.doorMaterial && !door.doorCoreType && !door.doorFaceType) {
                return false;
            }
            return true;
        },
        message: () => `Using legacy material field instead of structured specification`,
        suggestion: () => 'Upgrade to structured material specification (Core Type + Face Type) for better procurement clarity'
    },
    
    {
        id: 'using-legacy-finish-field',
        field: 'composite',
        severity: 'info',
        validate: (door) => {
            // Info if using legacy doorFinish but not finishSystem
            if (door.doorFinish && !door.finishSystem) {
                return false;
            }
            return true;
        },
        message: () => `Using legacy finish field instead of comprehensive finish system`,
        suggestion: () => 'Upgrade to finish system (Base Prep + Type + Manufacturer + Color) in the Finish tab'
    },
    
    {
        id: 'missing-elevation',
        field: 'elevationTypeId',
        severity: 'info',
        validate: (door) => {
            return !!door.elevationTypeId;
        },
        message: () => `No elevation type assigned`,
        suggestion: () => 'Assign an elevation type in the Hardware tab for visual reference in submittals'
    },
    
    {
        id: 'generic-operation',
        field: 'operation',
        severity: 'info',
        validate: (door) => {
            // Suggest more specific operation if just "Swing"
            const opLower = door.operation?.toLowerCase() || '';
            if (opLower === 'swing' || opLower === 'swinging') {
                return false;
            }
            return true;
        },
        message: () => `Operation is generic - could be more specific`,
        suggestion: () => 'Specify operation more precisely (e.g., "Single Swing", "Pair of Doors", "Sliding")'
    },
    
    {
        id: 'no-stc-rating',
        field: 'stcRating',
        severity: 'info',
        validate: (door) => {
            // Interior doors could benefit from STC rating
            if (door.interiorExterior === 'Interior' && !door.stcRating) {
                return false;
            }
            return true;
        },
        message: () => `Interior door without STC rating`,
        suggestion: () => 'Consider specifying STC rating for acoustic performance'
    },
    
    // ===== PHASE 21: HARDWARE SPECIFICATION VALIDATION =====
    
    // CRITICAL
    {
        id: 'electrified-missing-voltage',
        field: 'composite',
        severity: 'critical',
        validate: (door) => {
            // Electrified doors must specify voltage
            if (door.electrification?.isElectrified && !door.electrification.voltage) {
                return false;
            }
            return true;
        },
        message: () => `Electrified door missing voltage specification`,
        suggestion: () => 'Specify voltage (12V DC, 24V DC, 120V AC, or POE) in the Hardware tab → Electrification section'
    },
    
    {
        id: 'ept-missing-wiring-method',
        field: 'composite',
        severity: 'critical',
        validate: (door) => {
            // If EPT is required, wiring method must be specified
            if (door.electrification?.eptRequired && !door.electrification.wiringMethod) {
                return false;
            }
            return true;
        },
        message: () => `EPT required but wiring method not specified`,
        suggestion: () => 'Specify wiring method (EPT, Loop, or Wireless) in the Hardware tab → Electrification section'
    },
    
    // WARNINGS
    {
        id: 'tall-door-insufficient-hinges',
        field: 'composite',
        severity: 'warning',
        validate: (door) => {
            // Doors over 7'0" (84") should have 4+ hinges
            if (door.height && door.height >= 84 && door.hingeSpec && door.hingeSpec.count < 4) {
                return false;
            }
            return true;
        },
        message: (door) => `Door is ${door.height}" tall but only has ${door.hingeSpec?.count} hinges`,
        suggestion: () => 'Doors over 7\'0" should have at least 4 hinges for proper support'
    },
    
    {
        id: 'heavy-door-no-ball-bearing',
        field: 'composite',
        severity: 'warning',
        validate: (door) => {
            // Heavy doors (1-3/4" solid core) should have ball bearing hinges
            const isHeavy = door.thickness === '1-3/4"' && door.doorCoreType === 'Solid Core';
            if (isHeavy && door.hingeSpec && !door.hingeSpec.ballBearing) {
                return false;
            }
            return true;
        },
        message: () => `Heavy solid core door without ball bearing hinges`,
        suggestion: () => 'Enable "Ball Bearing" option in Hardware tab → Hinge Specification for heavy doors'
    },
    
    {
        id: 'electrified-no-door-contact',
        field: 'composite',
        severity: 'warning',
        validate: (door) => {
            // Electrified doors should have door contact for monitoring
            if (door.electrification?.isElectrified && !door.electrification.doorContact) {
                return false;
            }
            return true;
        },
        message: () => `Electrified door without door contact/position switch`,
        suggestion: () => 'Consider adding door contact for monitoring in the Electrification section'
    },
    
    {
        id: 'exit-device-prep-type-mismatch',
        field: 'composite',
        severity: 'warning',
        validate: (door) => {
            // If hardware prep is exit device, should have panic hardware in set
            if (door.hardwarePrepSpec?.prepType === 'Exit Device' && door.assignedHardwareSet) {
                const hasPanicHardware = door.assignedHardwareSet.items.some(item => 
                    item.name.toLowerCase().includes('exit') || 
                    item.name.toLowerCase().includes('panic') ||
                    item.name.toLowerCase().includes('crash bar')
                );
                if (!hasPanicHardware) {
                    return false;
                }
            }
            return true;
        },
        message: () => `Exit device prep specified but no panic hardware in hardware set`,
        suggestion: () => 'Verify hardware set includes exit device/panic hardware'
    },
    
    // INFO
    {
        id: 'continuous-hinge-for-high-traffic',
        field: 'composite',
        severity: 'info',
        validate: (door) => {
            // Suggest continuous hinges for high-traffic doors
            const isHighTraffic = door.location?.toLowerCase().includes('main') || 
                                 door.location?.toLowerCase().includes('lobby') ||
                                 door.location?.toLowerCase().includes('entrance');
            if (isHighTraffic && door.hingeSpec && door.hingeSpec.type !== 'Continuous') {
                return false;
            }
            return true;
        },
        message: () => `High-traffic door could benefit from continuous hinges`,
        suggestion: () => 'Consider continuous/piano hinges for high-traffic applications'
    },
    
    {
        id: 'exterior-door-grade-recommendation',
        field: 'composite',
        severity: 'info',
        validate: (door) => {
            // Recommend Grade 1 hardware for exterior doors
            if (door.interiorExterior === 'Exterior' && door.assignedHardwareSet) {
                const hasGrade1 = door.assignedHardwareSet.items.some(item => 
                    item.ansiGrade === 'Grade 1'
                );
                if (!hasGrade1) {
                    return false;
                }
            }
            return true;
        },
        message: () => `Exterior door without Grade 1 hardware`,
        suggestion: () => 'Consider specifying ANSI Grade 1 hardware for exterior doors for maximum durability'
    },
    
    {
        id: 'stainless-steel-hinge-recommendation',
        field: 'composite',
        severity: 'info',
        validate: (door) => {
            // Suggest stainless steel hinges for exterior/high-moisture
            const isExteriorOrMoisture = door.interiorExterior === 'Exterior' || 
                                        door.location?.toLowerCase().includes('exterior') ||
                                        door.location?.toLowerCase().includes('restroom') ||
                                        door.location?.toLowerCase().includes('shower');
            if (isExteriorOrMoisture && door.hingeSpec && door.hingeSpec.material !== 'Stainless Steel') {
                return false;
            }
            return true;
        },
        message: () => `Exterior/moisture area door without stainless steel hinges`,
        suggestion: () => 'Consider stainless steel hinges for exterior or high-moisture applications'
    }
];

// ===== VALIDATION FUNCTIONS =====

/**
 * Validate a single door against all rules
 */
export function validateDoor(door: Door): ValidationResult[] {
    const results: ValidationResult[] = [];
    
    for (const rule of VALIDATION_RULES) {
        const isValid = rule.validate(door);
        if (!isValid) {
            results.push({
                doorId: door.id,
                doorTag: door.doorTag,
                ruleId: rule.id,
                severity: rule.severity,
                message: rule.message(door),
                suggestion: rule.suggestion?.(door),
                field: rule.field !== 'composite' ? rule.field : undefined
            });
        }
    }
    
    return results;
}

/**
 * Validate entire project (all doors)
 */
export function validateProject(doors: Door[]): ProjectValidationReport {
    const allResults: ValidationResult[] = [];
    
    // Validate each door
    doors.forEach(door => {
        const doorResults = validateDoor(door);
        allResults.push(...doorResults);
    });
    
    // Check for duplicate door tags (cross-door validation)
    const tagCounts = new Map<string, number>();
    doors.forEach(door => {
        const tag = door.doorTag?.trim().toLowerCase();
        if (tag) {
            tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        }
    });
    
    // Add duplicate tag errors
    doors.forEach(door => {
        const tag = door.doorTag?.trim().toLowerCase();
        if (tag && tagCounts.get(tag)! > 1) {
            allResults.push({
                doorId: door.id,
                doorTag: door.doorTag,
                ruleId: 'duplicate-door-tag',
                severity: 'critical',
                message: `Duplicate door tag "${door.doorTag}" found`,
                suggestion: 'Assign a unique door tag to each opening',
                field: 'doorTag'
            });
        }
    });
    
    // Categorize results
    const criticalErrors = allResults.filter(r => r.severity === 'critical');
    const warnings = allResults.filter(r => r.severity === 'warning');
    const infos = allResults.filter(r => r.severity === 'info');
    
    // Calculate completeness score
    const totalChecks = doors.length * VALIDATION_RULES.length;
    const failedChecks = allResults.length;
    const passedChecks = totalChecks - failedChecks;
    const completenessScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;
    
    // Count valid doors (no critical errors)
    const doorsWithCritical = new Set(criticalErrors.map(e => e.doorId));
    const validDoors = doors.length - doorsWithCritical.size;
    
    return {
        totalDoors: doors.length,
        validDoors,
        criticalErrors,
        warnings,
        infos,
        completenessScore,
        canExport: criticalErrors.length === 0
    };
}

/**
 * Get validation results for a specific door by ID
 */
export function getValidationResultsForDoor(doorId: string, allResults: ValidationResult[]): ValidationResult[] {
    return allResults.filter(r => r.doorId === doorId);
}

/**
 * Get severity icon for display
 */
export function getSeverityIcon(severity: 'critical' | 'warning' | 'info'): string {
    switch (severity) {
        case 'critical': return '🔴';
        case 'warning': return '⚠️';
        case 'info': return 'ℹ️';
    }
}

/**
 * Get severity color class for Tailwind
 */
export function getSeverityColor(severity: 'critical' | 'warning' | 'info'): {
    bg: string;
    border: string;
    text: string;
} {
    switch (severity) {
        case 'critical':
            return {
                bg: 'bg-red-50',
                border: 'border-red-200',
                text: 'text-red-700'
            };
        case 'warning':
            return {
                bg: 'bg-yellow-50',
                border: 'border-yellow-200',
                text: 'text-yellow-700'
            };
        case 'info':
            return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                text: 'text-blue-700'
            };
    }
}
