import React, { useEffect } from 'react';
import { DoorCoreType, DoorFaceType, WoodSpecies, DoorFaceGrade } from '../../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface DoorMaterialSelectorProps {
    coreType?: DoorCoreType;
    faceType?: DoorFaceType;
    faceSpecies?: WoodSpecies | string;
    faceGrade?: DoorFaceGrade;
    onCoreTypeChange: (value: DoorCoreType | undefined) => void;
    onFaceTypeChange: (value: DoorFaceType | undefined) => void;
    onFaceSpeciesChange: (value: WoodSpecies | string | undefined) => void;
    onFaceGradeChange: (value: DoorFaceGrade | undefined) => void;
}

const DoorMaterialSelector: React.FC<DoorMaterialSelectorProps> = ({
    coreType,
    faceType,
    faceSpecies,
    faceGrade,
    onCoreTypeChange,
    onFaceTypeChange,
    onFaceSpeciesChange,
    onFaceGradeChange
}) => {
    const coreTypes: DoorCoreType[] = [
        'Solid Core',
        'Honeycomb Core',
        'Particleboard Core',
        'Stave Core',
        'Mineral Core',
        'Polystyrene Core',
        'Temperature Rise Core',
        'Custom'
    ];

    const faceTypes: DoorFaceType[] = [
        'Wood Veneer',
        'Plastic Laminate',
        'Metal',
        'Fiberglass',
        'Flush Steel',
        'Stile & Rail',
        'Glass',
        'Custom'
    ];

    const woodSpeciesList: WoodSpecies[] = [
        'Red Oak',
        'White Oak',
        'Maple',
        'Birch',
        'Cherry',
        'Walnut',
        'Ash',
        'Pine',
        'Custom'
    ];

    const gradeOptions: DoorFaceGrade[] = ['Premium', 'Custom', 'Standard', 'Economy'];

    const showSpeciesSelector = faceType === 'Wood Veneer';
    const showGradeSelector = faceType === 'Wood Veneer' || faceType === 'Plastic Laminate';

    useEffect(() => {
        if (!showSpeciesSelector && faceSpecies) {
            onFaceSpeciesChange(undefined);
        }
    }, [faceType, showSpeciesSelector]);

    return (
        <div className="space-y-4">
            <div className="text-sm font-semibold text-[var(--text-secondary)] border-b border-[var(--border)] pb-2">
                Door Material Specification
            </div>

            {/* Core Type */}
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Core Type
                </label>
                <Select
                    value={coreType || '__none__'}
                    onValueChange={v => onCoreTypeChange((v === '__none__' ? undefined : v) as DoorCoreType)}
                >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select Core Type..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Select Core Type...</SelectItem>
                        {coreTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                {coreType === 'Custom' && (
                    <input
                        type="text"
                        placeholder="Specify custom core type..."
                        className="mt-2 w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
                    />
                )}
            </div>

            {/* Face Type */}
            <div>
                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                    Face Type
                </label>
                <Select
                    value={faceType || '__none__'}
                    onValueChange={v => onFaceTypeChange((v === '__none__' ? undefined : v) as DoorFaceType)}
                >
                    <SelectTrigger className="w-full"><SelectValue placeholder="Select Face Type..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="__none__">Select Face Type...</SelectItem>
                        {faceTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Wood Species (conditional) */}
            {showSpeciesSelector && (
                <div className="pl-4 border-l-2 border-blue-500/40 bg-blue-500/5 p-3 rounded-r-lg">
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Wood Species
                    </label>
                    <Select
                        value={faceSpecies || '__none__'}
                        onValueChange={v => onFaceSpeciesChange(v === '__none__' ? undefined : v)}
                    >
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select Species..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__none__">Select Species...</SelectItem>
                            {woodSpeciesList.map(species => (
                                <SelectItem key={species} value={species}>{species}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {faceSpecies === 'Custom' && (
                        <input
                            type="text"
                            placeholder="Specify custom species..."
                            className="mt-2 w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)] text-sm"
                        />
                    )}
                </div>
            )}

            {/* Grade (conditional) */}
            {showGradeSelector && (
                <div className="pl-4 border-l-2 border-blue-500/40 bg-blue-500/5 p-3 rounded-r-lg">
                    <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">
                        Face Grade
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {gradeOptions.map((grade) => (
                            <button
                                key={grade}
                                type="button"
                                onClick={() => onFaceGradeChange(grade)}
                                className={`px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                                    faceGrade === grade
                                        ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                                        : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-secondary)] hover:border-blue-500/50'
                                }`}
                            >
                                {grade}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary Preview */}
            {(coreType || faceType) && (
                <div className="mt-4 p-3 bg-[var(--bg-subtle)] rounded-lg border border-[var(--border)]">
                    <div className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide mb-1">
                        Material Summary
                    </div>
                    <div className="text-sm font-medium text-[var(--text)]">
                        {[
                            faceGrade && `${faceGrade} Grade`,
                            faceSpecies && faceSpecies !== 'Custom' && faceSpecies,
                            faceType,
                            coreType && `(${coreType})`
                        ].filter(Boolean).join(' ')}
                    </div>
                </div>
            )}
        </div>
    );
};

export default DoorMaterialSelector;
