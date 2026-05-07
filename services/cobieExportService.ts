import * as XLSX from 'xlsx-js-style';
import { saveAs } from 'file-saver';
import { Door, HardwareSet, HardwareItem } from '../types';
import { assignDoorCSISection, assignHardwareCSISection } from '../utils/csiMasterFormat';

/**
 * COBie (Construction Operations Building Information Exchange) Export Service
 * Implements COBie 2.4 format for BIM coordination and facility management
 * 
 * COBie is a standard format for capturing and recording important project data
 * at the point of origin, including equipment lists, product data sheets, warranties,
 * spare parts lists, and preventive maintenance schedules.
 */

export interface COBieExportOptions {
    projectName: string;
    facilityName?: string;
    siteName?: string;
    projectDescription?: string;
    linearUnits?: 'millimeters' | 'centimeters' | 'meters' | 'inches' | 'feet';
    areaUnits?: 'square meters' | 'square feet';
    volumeUnits?: 'cubic meters' | 'cubic feet';
    currencyUnit?: 'USD' | 'EUR' | 'GBP';
    createdBy?: string;
    createdOn?: Date;
}

/**
 * Export doors and hardware to COBie 2.4 format
 */
export function exportToCOBie(
    doors: Door[],
    hardwareSets: HardwareSet[],
    options: COBieExportOptions
): void {
    const workbook = XLSX.utils.book_new();

    // COBie 2.4 requires specific sheets in a specific order
    createContactSheet(workbook, options);
    createFacilitySheet(workbook, options);
    createFloorSheet(workbook, options);
    createSpaceSheet(workbook, doors, options);
    createZoneSheet(workbook, options);
    createTypeSheet(workbook, doors, hardwareSets, options);
    createComponentSheet(workbook, doors, hardwareSets, options);
    createSystemSheet(workbook, options);
    createAssemblySheet(workbook, options);
    createConnectionSheet(workbook, options);
    createSpareSheet(workbook, options);
    createResourceSheet(workbook, options);
    createJobSheet(workbook, options);
    createImpactSheet(workbook, options);
    createDocumentSheet(workbook, options);
    createAttributeSheet(workbook, doors, hardwareSets, options);
    createCoordinateSheet(workbook, options);
    createIssueSheet(workbook, options);

    // Generate COBie file
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    
    const fileName = `${options.projectName.replace(/[^a-z0-9]/gi, '_')}_COBie.xlsx`;
    saveAs(blob, fileName);
}

/**
 * Contact Sheet - Information about project contacts
 */
function createContactSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'Company', 'Phone', 'Email',
        'Department', 'OrganizationCode', 'GivenName', 'FamilyName', 'Street',
        'PostalBox', 'Town', 'StateRegion', 'PostalCode', 'Country'
    ];

    const data: any[][] = [headers];

    // Add default contact (creator)
    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();
    
    data.push([
        createdBy,
        createdBy,
        createdOn.toISOString(),
        'Architect',
        options.facilityName || options.projectName,
        '',
        '',
        'Design',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Contact');
}

/**
 * Facility Sheet - Building/facility information
 */
function createFacilitySheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'ProjectName', 'SiteName',
        'LinearUnits', 'AreaUnits', 'VolumeUnits', 'CurrencyUnit', 'AreaMeasurement',
        'ExternalSystem', 'ExternalObject', 'ExternalIdentifier', 'Description', 'ProjectDescription', 'Phase'
    ];

    const data: any[][] = [headers];

    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();

    data.push([
        options.facilityName || options.projectName,
        createdBy,
        createdOn.toISOString(),
        'Building',
        options.projectName,
        options.siteName || options.projectName,
        options.linearUnits || 'millimeters',
        options.areaUnits || 'square meters',
        options.volumeUnits || 'cubic meters',
        options.currencyUnit || 'USD',
        '',
        '',
        '',
        '',
        options.projectDescription || '',
        options.projectDescription || '',
        'Construction'
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Facility');
}

/**
 * Floor Sheet - Building floor information
 */
function createFloorSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'ExtSystem', 'ExtObject',
        'ExtIdentifier', 'Description', 'Elevation', 'Height'
    ];

    const data: any[][] = [headers];

    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();

    // Add a default floor (can be expanded based on door locations)
    data.push([
        'Level 1',
        createdBy,
        createdOn.toISOString(),
        'Floor',
        '',
        '',
        '',
        'Ground Floor',
        '0',
        '3000'
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Floor');
}

/**
 * Space Sheet - Room/space information derived from door locations
 */
function createSpaceSheet(workbook: XLSX.WorkBook, doors: Door[], options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'FloorName', 'Description',
        'ExtSystem', 'ExtObject', 'ExtIdentifier', 'RoomTag', 'UsableHeight',
        'GrossArea', 'NetArea'
    ];

    const data: any[][] = [headers];

    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();

    // Extract unique locations from doors
    const locations = new Set<string>();
    doors.forEach(door => {
        if (door.location) {
            locations.add(door.location);
        }
    });

    locations.forEach(location => {
        data.push([
            location,
            createdBy,
            createdOn.toISOString(),
            'Space',
            'Level 1',
            `Space: ${location}`,
            '',
            '',
            '',
            location,
            '3000',
            '',
            ''
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Space');
}

/**
 * Zone Sheet - Functional zones (optional)
 */
function createZoneSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'SpaceNames', 'ExtSystem',
        'ExtObject', 'ExtIdentifier', 'Description'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Zone');
}

/**
 * Type Sheet - Product types (doors and hardware)
 */
function createTypeSheet(
    workbook: XLSX.WorkBook,
    doors: Door[],
    hardwareSets: HardwareSet[],
    options: COBieExportOptions
): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'Description', 'AssetType',
        'Manufacturer', 'ModelNumber', 'WarrantyGuarantorParts', 'WarrantyDurationParts',
        'WarrantyGuarantorLabor', 'WarrantyDurationLabor', 'WarrantyDurationUnit',
        'ExtSystem', 'ExtObject', 'ExtIdentifier', 'ReplacementCost', 'ExpectedLife',
        'DurationUnit', 'WarrantyDescription', 'NominalLength', 'NominalWidth', 'NominalHeight',
        'ModelReference', 'Shape', 'Size', 'Color', 'Finish', 'Grade', 'Material',
        'Constituents', 'Features', 'AccessibilityPerformance', 'CodePerformance',
        'SustainabilityPerformance'
    ];

    const data: any[][] = [headers];

    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();

    // Add door types
    const doorTypes = new Map<string, Door>();
    doors.forEach(door => {
        const typeKey = `${door.doorMaterial}-${door.width}x${door.height}x${door.thickness}`;
        if (!doorTypes.has(typeKey)) {
            doorTypes.set(typeKey, door);
        }
    });

    doorTypes.forEach((door, typeKey) => {
        const csiSection = door.csiSection || assignDoorCSISection(door);
        data.push([
            `Door-${typeKey}`,
            createdBy,
            createdOn.toISOString(),
            'Product',
            `${door.doorMaterial} Door`,
            'Fixed',
            door.doorManufacturer || '',
            door.doorModelNumber || '',
            '',
            '',
            '',
            '',
            'year',
            csiSection,
            'Door',
            door.doorTag || '',
            '',
            '20',
            'year',
            '',
            '',
            door.width || '',
            door.height || '',
            '',
            '',
            '',
            '',
            door.doorFinish || '',
            '',
            door.doorMaterial || '',
            '',
            door.fireRating || '',
            '',
            '',
            ''
        ]);
    });

    // Add hardware types
    hardwareSets.forEach(set => {
        set.items.forEach(item => {
            const csiSection = item.csiSection || assignHardwareCSISection(item);
            data.push([
                `Hardware-${item.name}`,
                createdBy,
                createdOn.toISOString(),
                'Product',
                item.description || item.name,
                'Fixed',
                item.manufacturer || '',
                item.modelNumber || '',
                item.manufacturer || '',
                '1',
                item.manufacturer || '',
                '1',
                'year',
                csiSection,
                'Hardware',
                '',
                '', // Cost not available in HardwareItem
                '10',
                'year',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                '',
                item.finish || '',
                item.ansiGrade || '',
                '',
                '',
                '',
                '',
                '',
                ''
            ]);
        });
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Type');
}

/**
 * Component Sheet - Individual component instances
 */
function createComponentSheet(
    workbook: XLSX.WorkBook,
    doors: Door[],
    hardwareSets: HardwareSet[],
    options: COBieExportOptions
): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'TypeName', 'Space', 'Description',
        'ExtSystem', 'ExtObject', 'ExtIdentifier', 'SerialNumber', 'InstallationDate',
        'WarrantyStartDate', 'TagNumber', 'BarCode', 'AssetIdentifier'
    ];

    const data: any[][] = [headers];

    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();

    // Add door components
    doors.forEach(door => {
        const typeKey = `${door.doorMaterial}-${door.width}x${door.height}x${door.thickness}`;
        data.push([
            door.doorTag || `Door-${doors.indexOf(door) + 1}`,
            createdBy,
            createdOn.toISOString(),
            `Door-${typeKey}`,
            door.location || '',
            `${door.doorMaterial} Door at ${door.location || 'Unknown'}`,
            '',
            '',
            '',
            '',
            '',
            '',
            door.doorTag || '',
            '',
            ''
        ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Component');
}

/**
 * System Sheet - System groupings (optional)
 */
function createSystemSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'ComponentNames', 'ExtSystem',
        'ExtObject', 'ExtIdentifier', 'Description'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'System');
}

/**
 * Assembly Sheet - Assembly information (optional)
 */
function createAssemblySheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'SheetName', 'ParentName', 'ChildNames',
        'AssemblyType', 'ExtSystem', 'ExtObject', 'ExtIdentifier', 'Description'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Assembly');
}

/**
 * Connection Sheet - Component connections (optional)
 */
function createConnectionSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'ConnectionType', 'SheetName', 'RowName1',
        'RowName2', 'RealizingElement', 'PortName1', 'PortName2', 'ExtSystem',
        'ExtObject', 'ExtIdentifier', 'Description'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Connection');
}

/**
 * Spare Sheet - Spare parts information (optional)
 */
function createSpareSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'TypeName', 'Suppliers',
        'ExtSystem', 'ExtObject', 'ExtIdentifier', 'Description', 'SetNumber',
        'PartNumber'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Spare');
}

/**
 * Resource Sheet - Resources (optional)
 */
function createResourceSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'ExtSystem', 'ExtObject',
        'ExtIdentifier', 'Description'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Resource');
}

/**
 * Job Sheet - Maintenance jobs (optional)
 */
function createJobSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'Status', 'TypeName', 'Description',
        'Duration', 'DurationUnit', 'Start', 'TaskStartUnit', 'Frequency', 'FrequencyUnit',
        'ExtSystem', 'ExtObject', 'ExtIdentifier', 'TaskNumber', 'Priors', 'ResourceNames'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Job');
}

/**
 * Impact Sheet - Environmental impact (optional)
 */
function createImpactSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'ImpactType', 'ImpactStage', 'SheetName',
        'RowName', 'Value', 'ImpactUnit', 'LeadInTime', 'Duration', 'LeadOutTime',
        'ExtSystem', 'ExtObject', 'ExtIdentifier', 'Description'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Impact');
}

/**
 * Document Sheet - Associated documents (optional)
 */
function createDocumentSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'ApprovalBy', 'Stage', 'SheetName',
        'RowName', 'Directory', 'File', 'ExtSystem', 'ExtObject', 'ExtIdentifier', 'Description', 'Reference'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Document');
}

/**
 * Attribute Sheet - Additional attributes for components
 */
function createAttributeSheet(
    workbook: XLSX.WorkBook,
    doors: Door[],
    hardwareSets: HardwareSet[],
    options: COBieExportOptions
): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'SheetName', 'RowName',
        'Value', 'Unit', 'ExtSystem', 'ExtObject', 'ExtIdentifier', 'Description', 'AllowedValues'
    ];

    const data: any[][] = [headers];

    const createdBy = options.createdBy || 'System';
    const createdOn = options.createdOn || new Date();

    // Add door attributes
    doors.forEach(door => {
        const doorName = door.doorTag || `Door-${doors.indexOf(door) + 1}`;
        
        if (door.fireRating) {
            data.push([
                'FireRating',
                createdBy,
                createdOn.toISOString(),
                'Fire Safety',
                'Component',
                doorName,
                door.fireRating,
                '',
                '',
                '',
                '',
                'Fire rating classification',
                ''
            ]);
        }

        if (door.assignedHardwareSet) {
            data.push([
                'HardwareSet',
                createdBy,
                createdOn.toISOString(),
                'Hardware',
                'Component',
                doorName,
                door.assignedHardwareSet?.name || '',
                '',
                '',
                '',
                '',
                'Assigned hardware set',
                ''
            ]);
        }
    });

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attribute');
}

/**
 * Coordinate Sheet - Spatial coordinates (optional)
 */
function createCoordinateSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Category', 'SheetName', 'RowName',
        'CoordinateXAxis', 'CoordinateYAxis', 'CoordinateZAxis', 'ExtSystem',
        'ExtObject', 'ExtIdentifier', 'ClockwiseRotation', 'ElevationalRotation',
        'YawRotation'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Coordinate');
}

/**
 * Issue Sheet - Project issues (optional)
 */
function createIssueSheet(workbook: XLSX.WorkBook, options: COBieExportOptions): void {
    const headers = [
        'Name', 'CreatedBy', 'CreatedOn', 'Type', 'Risk', 'Chance', 'Impact', 'SheetName1',
        'RowName1', 'SheetName2', 'RowName2', 'Description', 'Owner', 'Mitigation',
        'ExtSystem', 'ExtObject', 'ExtIdentifier'
    ];

    const data: any[][] = [headers];

    const worksheet = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Issue');
}
