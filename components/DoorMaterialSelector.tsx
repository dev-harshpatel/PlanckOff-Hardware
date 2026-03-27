import React, { useEffect } from 'react';
import { DoorCoreType, DoorFaceType, WoodSpecies, DoorFaceGrade } from '../types';

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

    // Show species selector only for wood veneer
    const showSpeciesSelector = faceType === 'Wood Veneer';

    // Show grade selector for wood veneer or plastic laminate
    const showGradeSelector = faceType === 'Wood Veneer' || faceType === 'Plastic Laminate';

    // Auto-clear species if face type changes away from wood
    useEffect(() => {
        if (!showSpeciesSelector && faceSpecies) {
            onFaceSpeciesChange(undefined);
        }
    }, [faceType, showSpeciesSelector]);

    return (
        <div className="space-y-4">
            <div className="text-sm font-semibold text-gray-700 border-b pb-2">
                Door Material Specification
            </div>

            {/* Core Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Core Type
                </label>
                <select
                    value={coreType || ''}
                    onChange={(e) => onCoreTypeChange(e.target.value as DoorCoreType || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Select Core Type...</option>
                    {coreTypes.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>
                {coreType === 'Custom' && (
                    <input
                        type="text"
                        placeholder="Specify custom core type..."
                        className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                )}
            </div>

            {/* Face Type */}
            <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                    Face Type
                </label>
                <select
                    value={faceType || ''}
                    onChange={(e) => onFaceTypeChange(e.target.value as DoorFaceType || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                    <option value="">Select Face Type...</option>
                    {faceTypes.map((type) => (
                        <option key={type} value={type}>
                            {type}
                        </option>
                    ))}
                </select>
            </div>

            {/* Wood Species (conditional) */}
            {showSpeciesSelector && (
                <div className="pl-4 border-l-2 border-blue-200 bg-blue-50/30 p-3 rounded-r-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Wood Species
                    </label>
                    <select
                        value={faceSpecies || ''}
                        onChange={(e) => onFaceSpeciesChange(e.target.value || undefined)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                    >
                        <option value="">Select Species...</option>
                        {woodSpeciesList.map((species) => (
                            <option key={species} value={species}>
                                {species}
                            </option>
                        ))}
                    </select>
                    {faceSpecies === 'Custom' && (
                        <input
                            type="text"
                            placeholder="Specify custom species..."
                            className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                        />
                    )}
                </div>
            )}

            {/* Grade (conditional) */}
            {showGradeSelector && (
                <div className="pl-4 border-l-2 border-blue-200 bg-blue-50/30 p-3 rounded-r-lg">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Face Grade
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                        {gradeOptions.map((grade) => (
                            <button
                                key={grade}
                                type="button"
                                onClick={() => onFaceGradeChange(grade)}
                                className={`
                                    px-3 py-2 rounded-lg border-2 text-sm font-medium transition-all
                                    ${faceGrade === grade
                                        ? 'border-blue-600 bg-blue-600 text-white shadow-md'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                                    }
                                `}
                            >
                                {grade}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Summary Preview */}
            {(coreType || faceType) && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                        Material Summary
                    </div>
                    <div className="text-sm font-medium text-gray-900">
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
