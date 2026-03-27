import React from 'react';
import { DoorHanding } from '../types';

interface DoorHandingSelectorProps {
    value?: DoorHanding;
    onChange: (handing: DoorHanding) => void;
    required?: boolean;
}

const DoorHandingSelector: React.FC<DoorHandingSelectorProps> = ({ value, onChange, required }) => {
    const handingOptions: { value: DoorHanding; label: string; description: string }[] = [
        {
            value: 'LH',
            label: 'LH - Left Hand',
            description: 'Hinges on left, opens inward'
        },
        {
            value: 'RH',
            label: 'RH - Right Hand',
            description: 'Hinges on right, opens inward'
        },
        {
            value: 'LHR',
            label: 'LHR - Left Hand Reverse',
            description: 'Hinges on left, opens outward'
        },
        {
            value: 'RHR',
            label: 'RHR - Right Hand Reverse',
            description: 'Hinges on right, opens outward'
        },
        {
            value: 'LHRB',
            label: 'LHRB - Left Hand Reverse Bevel',
            description: 'Hinges on left, reverse bevel'
        },
        {
            value: 'RHRB',
            label: 'RHRB - Right Hand Reverse Bevel',
            description: 'Hinges on right, reverse bevel'
        },
        {
            value: 'N/A',
            label: 'N/A - Not Applicable',
            description: 'No handing required'
        }
    ];

    return (
        <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700">
                Door Handing {required && <span className="text-red-500">*</span>}
            </label>

            {/* Visual Grid Selector */}
            <div className="grid grid-cols-2 gap-3">
                {handingOptions.filter(opt => opt.value !== 'N/A').map((option) => (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        className={`
                            relative p-4 rounded-lg border-2 transition-all text-left
                            ${value === option.value
                                ? 'border-blue-600 bg-blue-50 shadow-md'
                                : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                            }
                        `}
                    >
                        {/* Visual Diagram */}
                        <div className="flex items-center justify-center mb-3 h-16">
                            <HandingDiagram handing={option.value as DoorHanding} />
                        </div>

                        {/* Label */}
                        <div className="text-center">
                            <div className="font-bold text-gray-900 text-sm">{option.label}</div>
                            <div className="text-xs text-gray-500 mt-1">{option.description}</div>
                        </div>

                        {/* Selected Indicator */}
                        {value === option.value && (
                            <div className="absolute top-2 right-2">
                                <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                        )}
                    </button>
                ))}
            </div>

            {/* N/A Option */}
            <button
                type="button"
                onClick={() => onChange('N/A')}
                className={`
                    w-full p-3 rounded-lg border-2 transition-all text-center
                    ${value === 'N/A'
                        ? 'border-gray-600 bg-gray-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }
                `}
            >
                <span className="font-medium text-gray-700">N/A - Not Applicable</span>
            </button>
        </div>
    );
};

// Simple visual diagram component
const HandingDiagram: React.FC<{ handing: DoorHanding }> = ({ handing }) => {
    const isReverse = handing.includes('R') && handing !== 'RH';
    const isLeft = handing.startsWith('L');

    return (
        <svg width="60" height="60" viewBox="0 0 60 60" className="mx-auto">
            {/* Door Frame */}
            <rect x="5" y="5" width="50" height="50" fill="none" stroke="#94a3b8" strokeWidth="2" />

            {/* Door Panel */}
            <rect
                x={isLeft ? "10" : "30"}
                y="10"
                width="20"
                height="40"
                fill={isReverse ? "#fbbf24" : "#60a5fa"}
                stroke="#1e40af"
                strokeWidth="1.5"
            />

            {/* Hinges (3 small rectangles) */}
            {[15, 30, 45].map((y, i) => (
                <rect
                    key={i}
                    x={isLeft ? "8" : "52"}
                    y={y}
                    width="4"
                    height="6"
                    fill="#374151"
                />
            ))}

            {/* Door Knob */}
            <circle
                cx={isLeft ? "45" : "15"}
                cy="30"
                r="2.5"
                fill="#374151"
            />

            {/* Swing Direction Arrow */}
            <path
                d={isReverse
                    ? (isLeft ? "M 30 8 L 30 2 L 35 7 Z" : "M 30 8 L 30 2 L 25 7 Z")
                    : (isLeft ? "M 30 52 L 30 58 L 35 53 Z" : "M 30 52 L 30 58 L 25 53 Z")
                }
                fill="#ef4444"
            />
        </svg>
    );
};

export default DoorHandingSelector;
