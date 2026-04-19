import React, { useMemo, useRef } from 'react';
import { Door, HardwareSet, ElevationType } from '../types';
import { useReactToPrint } from 'react-to-print';
import { PrinterIcon } from './icons';

interface SubmittalGeneratorProps {
    doors: Door[];
    elevationTypes: ElevationType[];
}

interface GroupedDoorType {
    id: string; // Composite key
    exampleDoor: Door; // To pull parameters from
    quantity: number;
    locations: string[]; // List of tags/locations
    hardwareSet?: HardwareSet;
    elevationType?: ElevationType;
}

const SubmittalGenerator: React.FC<SubmittalGeneratorProps> = ({ doors, elevationTypes }) => {
    const componentRef = useRef<HTMLDivElement>(null);

    // Grouping Logic
    const groupedData = useMemo(() => {
        const groups: Record<string, GroupedDoorType> = {};

        doors.forEach(door => {
            // Create a unique key based on physical properties + hardware + elevation
            // We EXCLUDE location and tag, as we want to count total quantity of this "Type"
            const keyParts = [
                door.width,
                door.height,
                door.thickness,
                door.doorMaterial,
                door.frameMaterial,
                door.fireRating,
                door.operation,
                door.elevationTypeId || 'none',
                door.assignedHardwareSet?.id || door.providedHardwareSet || 'none',
                // Add new phase 15 fields
                door.stcRating || '',
                door.wallType || '',
                door.frameType || '',
                door.leafCount || 1,
                // Custom fields should also be part of the key if they affect the "Type"
                JSON.stringify(door.customFields || {})
            ];

            const key = keyParts.join('|');

            if (!groups[key]) {
                groups[key] = {
                    id: key,
                    exampleDoor: door,
                    quantity: 0,
                    locations: [],
                    hardwareSet: door.assignedHardwareSet,
                    elevationType: elevationTypes.find(e => e.id === door.elevationTypeId)
                };
            }

            groups[key].quantity += door.quantity || 1;
            groups[key].locations.push(door.doorTag);
        });

        return Object.values(groups);
    }, [doors, elevationTypes]);


    const handlePrint = useReactToPrint({
        contentRef: componentRef,
        documentTitle: 'Door_Schedule_Submittal_Package',
    });

    return (
        <div className="flex flex-col h-full bg-[var(--bg-subtle)]">
            {/* Toolbar */}
            <div className="bg-[var(--bg)] border-b border-[var(--border)] px-6 py-4 flex justify-between items-center shadow-sm">
                <div>
                    <h2 className="text-xl font-bold text-[var(--text-secondary)]">Submittal Package Preview</h2>
                    <p className="text-sm text-[var(--text-muted)]">{groupedData.length} Unique Door Types Generated</p>
                </div>
                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium transition-colors shadow-sm"
                >
                    <PrinterIcon className="w-5 h-5" />
                    Print / Save to PDF
                </button>
            </div>

            {/* Printable Content Container */}
            <div className="flex-1 overflow-auto p-8">
                <div ref={componentRef} className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none">
                    <style type="text/css" media="print">
                        {`
                            @media print {
                                body { -webkit-print-color-adjust: exact; }
                                @page { size: auto; margin: 20mm; }
                                .page-break { page-break-after: always; }
                            }
                        `}
                    </style>

                    {groupedData.map((group, index) => (
                        <div key={group.id} className="p-10 page-break min-h-[297mm] flex flex-col relative border-b-2 border-gray-100 print:border-none">

                            {/* Header */}
                            <div className="border-b-2 border-slate-800 pb-4 mb-8 flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold text-slate-900">Door Type Specification</h1>
                                    <p className="text-slate-500 mt-1">Submittal Data Sheet</p>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Total Quantity</div>
                                    <div className="text-4xl font-black text-slate-800">{group.quantity}</div>
                                </div>
                            </div>

                            {/* Main Grid Layout */}
                            <div className="grid grid-cols-2 gap-12 flex-grow">

                                {/* Left Column: Parameters */}
                                <div>
                                    <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">Door Parameters</h3>
                                    <table className="w-full text-sm">
                                        <tbody className="divide-y divide-slate-100">
                                            {[
                                                // Opening Information
                                                ['Opening Number', group.exampleDoor.doorTag],
                                                ['Handing', group.exampleDoor.handing || 'Not Specified'],
                                                ['Operation', group.exampleDoor.operation],
                                                ['Dimensions', `${group.exampleDoor.width}" x ${group.exampleDoor.height}" x ${group.exampleDoor.thickness}"`],
                                                ['Undercut', group.exampleDoor.undercut ? `${group.exampleDoor.undercut}"` : 'Standard'],
                                                ['Leaf Count', group.exampleDoor.leafCount],

                                                // Material Specifications (Phase 19)
                                                ['Core Type', group.exampleDoor.doorCoreType || group.exampleDoor.doorMaterial],
                                                group.exampleDoor.doorCoreDetail && ['Core Detail', group.exampleDoor.doorCoreDetail],
                                                ['Face Type', group.exampleDoor.doorFaceType || '-'],
                                                group.exampleDoor.doorFaceSpecies && ['Face Species', group.exampleDoor.doorFaceSpecies],
                                                group.exampleDoor.doorFaceGrade && ['Face Grade', group.exampleDoor.doorFaceGrade],
                                                group.exampleDoor.doorManufacturer && ['Door Manufacturer', group.exampleDoor.doorManufacturer],
                                                group.exampleDoor.doorModelNumber && ['Door Model', group.exampleDoor.doorModelNumber],

                                                // Finish System (Phase 19)
                                                ['Finish Base Prep', group.exampleDoor.finishSystem?.basePrep || group.exampleDoor.doorFinish || '-'],
                                                ['Finish Type', group.exampleDoor.finishSystem?.finishType || '-'],
                                                group.exampleDoor.finishSystem?.manufacturer && ['Finish Mfr', group.exampleDoor.finishSystem.manufacturer],
                                                group.exampleDoor.finishSystem?.productCode && ['Product Code', group.exampleDoor.finishSystem.productCode],
                                                group.exampleDoor.finishSystem?.colorName && ['Color', group.exampleDoor.finishSystem.colorName],
                                                group.exampleDoor.finishSystem?.sheen && ['Sheen', group.exampleDoor.finishSystem.sheen],

                                                // Fire Rating (Phase 19 Enhanced)
                                                ['Fire Rating', group.exampleDoor.fireRating],
                                                group.exampleDoor.fireRatingLabel && ['Label', group.exampleDoor.fireRatingLabel],
                                                group.exampleDoor.temperatureRise && ['Temp Rise', group.exampleDoor.temperatureRise],
                                                group.exampleDoor.positivePresure && ['Positive Pressure', 'Yes'],

                                                // Acoustic
                                                ['STC Rating', group.exampleDoor.stcRating || '-'],

                                                // Frame Specifications (Phase 19 Enhanced)
                                                ['Frame Material', group.exampleDoor.frameMaterial],
                                                group.exampleDoor.frameGauge && ['Frame Gauge', group.exampleDoor.frameGauge],
                                                group.exampleDoor.frameProfile && ['Frame Profile', group.exampleDoor.frameProfile],
                                                group.exampleDoor.frameAnchorType && ['Frame Anchors', group.exampleDoor.frameAnchorType],
                                                ['Frame Type', group.exampleDoor.frameType || '-'],
                                                ['Wall Type', group.exampleDoor.wallType || '-'],
                                                ['Jamb Depth', group.exampleDoor.jambDepth || '-'],
                                                group.exampleDoor.frameFinish && ['Frame Finish', group.exampleDoor.frameFinish],
                                                group.exampleDoor.frameManufacturer && ['Frame Mfr', group.exampleDoor.frameManufacturer],

                                                // Custom Fields
                                                ...Object.entries(group.exampleDoor.customFields || {}).map(([k, v]) => [k, v])
                                            ].filter(Boolean).map(([label, value], i) => (
                                                <tr key={i}>
                                                    <td className="py-2 text-slate-500 font-medium w-1/3">{label}</td>
                                                    <td className="py-2 text-slate-900 font-bold">{value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>

                                    {/* Associated Tags */}
                                    <div className="mt-8">
                                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Affected Door Tags</h3>
                                        <div className="flex flex-wrap gap-1">
                                            {group.locations.slice(0, 50).map((tag, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 text-xs rounded border border-slate-200">{tag}</span>
                                            ))}
                                            {group.locations.length > 50 && (
                                                <span className="px-1.5 py-0.5 text-slate-400 text-xs italic">...and {group.locations.length - 50} more</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Hardware & Elevation */}
                                <div className="flex flex-col gap-8">

                                    {/* Hardware Set */}
                                    <div>
                                        <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">Hardware Set</h3>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
                                            <div className="flex justify-between items-center mb-3">
                                                <span className="font-bold text-slate-700">{group.hardwareSet?.name || group.exampleDoor.providedHardwareSet || 'Not Defined'}</span>
                                            </div>
                                            {group.hardwareSet ? (
                                                <ul className="space-y-2 text-sm">
                                                    {group.hardwareSet.items.map((item, i) => (
                                                        <li key={i} className="flex gap-3 border-b border-slate-200/50 pb-1 last:border-0 last:pb-0">
                                                            <span className="font-bold text-slate-900 w-6 text-center">{item.quantity}</span>
                                                            <div className="flex-1">
                                                                <div className="font-medium text-slate-800">{item.name}</div>
                                                                <div className="text-xs text-slate-500">{item.manufacturer} • {item.finish}</div>
                                                            </div>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-sm text-red-500 italic">No valid hardware set assigned.</p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Elevation Image */}
                                    {group.elevationType && group.elevationType.imageData ? (
                                        <div className="flex-grow flex flex-col">
                                            <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4 uppercase tracking-wide">Elevation: {group.elevationType.code}</h3>
                                            <div className="flex-grow border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center p-4 bg-white">
                                                <img
                                                    src={group.elevationType.imageData}
                                                    alt={`Elevation ${group.elevationType.code}`}
                                                    className="max-h-[300px] object-contain"
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-48 border-2 border-dashed border-slate-100 rounded-lg flex items-center justify-center text-slate-300">
                                            No Elevation Linked
                                        </div>
                                    )}

                                </div>
                            </div>

                            {/* Footer */}
                            <div className="mt-8 pt-4 border-t border-slate-200 text-xs text-slate-400 flex justify-between">
                                <span>Generated by Planckoff Estimating</span>
                                <span>Page {index + 1} of {groupedData.length}</span>
                            </div>

                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default SubmittalGenerator;
