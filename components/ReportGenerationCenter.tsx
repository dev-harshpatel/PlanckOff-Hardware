import React, { useState } from 'react';
import { Door, HardwareSet, ElevationType } from '../types';
import DoorScheduleConfig, { DoorScheduleExportConfig } from './DoorScheduleConfig';
import HardwareSetConfig, { HardwareSetExportConfig } from './HardwareSetConfig';
import SubmittalPackageConfig, { SubmittalExportConfig } from './SubmittalPackageConfig';
import { exportDoorSchedule, exportHardwareSet } from '../services/reportExportService';

interface ReportGenerationCenterProps {
    isOpen: boolean;
    onClose: () => void;
    doors: Door[];
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
    projectName: string;
}

type ReportView = 'selector' | 'door-schedule' | 'hardware-set' | 'submittal-package';

const ReportGenerationCenter: React.FC<ReportGenerationCenterProps> = ({
    isOpen,
    onClose,
    doors,
    hardwareSets,
    elevationTypes = [],
    projectName
}) => {
    const [currentView, setCurrentView] = useState<ReportView>('selector');

    if (!isOpen) return null;

    const handleEscapeKey = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
            onClose();
        }
    };

    const handleDoorScheduleExport = (config: DoorScheduleExportConfig) => {
        try {
            exportDoorSchedule(doors, config, projectName);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    };

    const handleHardwareSetExport = (config: HardwareSetExportConfig) => {
        try {
            exportHardwareSet(doors, hardwareSets, config, projectName);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    };

    const handleSubmittalExport = (config: SubmittalExportConfig) => {
        console.log('Generating Submittal Package:', config);
        alert('Submittal Package generation initialized. PDF generation service will be connected next.');
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn"
            onClick={onClose}
            onKeyDown={handleEscapeKey}
            tabIndex={-1}
        >
            <div
                className="bg-[var(--bg)] rounded-lg shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col animate-slideIn"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] flex-shrink-0">
                    <div className="flex items-center space-x-3">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <h2 className="text-2xl font-bold text-[var(--text)]">Report Generation Center</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-[var(--bg-muted)] rounded-full transition-colors"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6 text-[var(--text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto p-8">
                    {currentView === 'selector' && (
                        <ReportTypeSelector
                            onSelectDoorSchedule={() => setCurrentView('door-schedule')}
                            onSelectHardwareSet={() => setCurrentView('hardware-set')}
                            onSelectSubmittalPackage={() => setCurrentView('submittal-package')}
                            doorCount={doors.length}
                            hardwareSetCount={hardwareSets.length}
                        />
                    )}

                    {currentView === 'door-schedule' && (
                        <DoorScheduleConfig
                            doors={doors}
                            projectName={projectName}
                            onBack={() => setCurrentView('selector')}
                            onExport={handleDoorScheduleExport}
                        />
                    )}

                    {currentView === 'hardware-set' && (
                        <HardwareSetConfig
                            doors={doors}
                            hardwareSets={hardwareSets}
                            projectName={projectName}
                            onBack={() => setCurrentView('selector')}
                            onExport={handleHardwareSetExport}
                        />
                    )}

                    {currentView === 'submittal-package' && (
                        <SubmittalPackageConfig
                            doors={doors}
                            hardwareSets={hardwareSets}
                            elevationTypes={elevationTypes}
                            projectName={projectName}
                            onBack={() => setCurrentView('selector')}
                            onExport={handleSubmittalExport}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

// Report Type Selector Component
interface ReportTypeSelectorProps {
    onSelectDoorSchedule: () => void;
    onSelectHardwareSet: () => void;
    onSelectSubmittalPackage: () => void;
    doorCount: number;
    hardwareSetCount: number;
}

const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({
    onSelectDoorSchedule,
    onSelectHardwareSet,
    onSelectSubmittalPackage,
    doorCount,
    hardwareSetCount
}) => {
    return (
        <div className="max-w-5xl mx-auto">
            <div className="mb-8">
                <h3 className="text-lg font-semibold text-[var(--text-secondary)] mb-2">Select Report Type</h3>
                <p className="text-[var(--text-muted)]">Choose the type of report you want to generate and customize</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                {/* Door Schedule Card */}
                <div className="bg-[var(--bg)] border-2 border-[var(--border)] rounded-xl p-8 hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer group">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <span className="px-3 py-1 bg-[var(--primary-bg)] text-[var(--primary-text)] text-sm font-semibold rounded-full">
                            {doorCount} doors
                        </span>
                    </div>

                    <h4 className="text-xl font-bold text-[var(--text)] mb-3">Door Schedule Report</h4>
                    <p className="text-[var(--text-muted)] mb-6">
                        Export comprehensive door data with full customization. Choose from 30+ fields including dimensions, materials, fire ratings, and hardware assignments.
                    </p>

                    <ul className="space-y-2 mb-6">
                        <li className="flex items-center text-sm text-[var(--text-secondary)]">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Customizable columns
                        </li>
                        <li className="flex items-center text-sm text-[var(--text-secondary)]">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Multiple export formats
                        </li>
                        <li className="flex items-center text-sm text-[var(--text-secondary)]">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Professional formatting
                        </li>
                    </ul>

                    <button
                        onClick={onSelectDoorSchedule}
                        className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Configure & Export
                    </button>
                </div>

                {/* Hardware Set Card */}
                <div className="bg-[var(--bg)] border-2 border-[var(--border)] rounded-xl p-8 hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer group">
                    {/* ... existing Hardware Set content ... */}
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-purple-100 rounded-lg group-hover:bg-purple-200 transition-colors">
                            <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </div>
                        <span className="px-3 py-1 bg-purple-50 text-purple-700 text-sm font-semibold rounded-full">
                            {hardwareSetCount} sets
                        </span>
                    </div>

                    <h4 className="text-xl font-bold text-[var(--text)] mb-3">Hardware Set Report</h4>
                    <p className="text-[var(--text-muted)] mb-6">
                        Export hardware items with usage tracking. See exactly which door tags use each item, perfect for procurement and cost analysis.
                    </p>

                    <ul className="space-y-2 mb-6">
                        <li className="flex items-center text-sm text-[var(--text-secondary)]">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Usage/location tracking
                        </li>
                        <li className="flex items-center text-sm text-[var(--text-secondary)]">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Cross-referencing
                        </li>
                        <li className="flex items-center text-sm text-[var(--text-secondary)]">
                            <svg className="w-4 h-4 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                            Procurement planning
                        </li>
                    </ul>

                    <button
                        onClick={onSelectHardwareSet}
                        className="w-full px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors"
                    >
                        Configure & Export
                    </button>
                </div>
            </div>

            {/* Submittal Package Card - Full Width */}
            <div className="bg-[var(--bg)] border-2 border-[var(--border)] rounded-xl p-8 hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer group mb-12 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                    <svg className="w-64 h-64" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                    </svg>
                </div>

                <div className="flex items-center justify-between relative z-10">
                    <div>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-3 bg-indigo-100 rounded-lg group-hover:bg-indigo-200 transition-colors">
                                <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                </svg>
                            </div>
                            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-full">
                                Comprehensive
                            </span>
                        </div>

                        <h4 className="text-2xl font-bold text-[var(--text)] mb-2">Submittal Package & Frame Reports</h4>
                        <p className="text-[var(--text-muted)] mb-6 max-w-2xl">
                            Generate a complete submittal package including Cover Page, Door Schedule, Hardware Sets, Frame Details, and Elevation Drawings. This is your all-in-one documentation solution.
                        </p>

                        <div className="flex flex-wrap gap-4 mb-6">
                            <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-3 py-1 rounded-full border border-[var(--border)]">
                                <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span> Door Schedule
                            </div>
                            <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-3 py-1 rounded-full border border-[var(--border)]">
                                <span className="w-2 h-2 bg-purple-500 rounded-full mr-2"></span> Hardware Sets
                            </div>
                            <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-3 py-1 rounded-full border border-[var(--border)]">
                                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span> Elevations
                            </div>
                            <div className="flex items-center text-sm text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-3 py-1 rounded-full border border-[var(--border)]">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span> Frames
                            </div>
                        </div>

                        <button
                            onClick={onSelectSubmittalPackage}
                            className="px-8 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                        >
                            Create Submittal Package
                        </button>
                    </div>
                </div>
            </div>

            {/* Recent Exports Section */}
            <div className="bg-[var(--bg-subtle)] rounded-lg p-6">
                <h4 className="text-sm font-semibold text-[var(--text-secondary)] mb-3">Recent Exports</h4>
                <p className="text-sm text-[var(--text-muted)]">No recent exports yet. Generate your first report above.</p>
            </div>
        </div>
    );
};

export default ReportGenerationCenter;
