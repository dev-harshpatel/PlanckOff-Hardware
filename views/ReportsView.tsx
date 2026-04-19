'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Door, HardwareSet, ElevationType } from '../types';
import DoorScheduleConfig from '../components/DoorScheduleConfig';
import HardwareSetConfig, { HardwareSetExportConfig } from '../components/HardwareSetConfig';
// import SubmittalPackageConfig, { SubmittalExportConfig } from '../components/SubmittalPackageConfig'; // Replaced
import SubmittalGenerator from '../components/SubmittalGenerator';
import ValidationModal from '../components/ValidationModal';
import { exportDoorSchedule, exportHardwareSet } from '../services/reportExportService';
import { validateProject, ProjectValidationReport } from '../utils/doorValidation';

// Phase 22: Professional Submittal Package Components - REMOVED

// Phase 23: Multi-Format Export & Integration - REMOVED

interface ReportsViewProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
    projectName: string;
    onUpdateDoors?: (doors: Door[]) => void;
}

type ReportView = 'selector' | 'door-schedule' | 'hardware-set' | 'submittal-package';

const ReportsView: React.FC<ReportsViewProps> = ({
    doors,
    hardwareSets,
    elevationTypes,
    projectName,
    onUpdateDoors
}) => {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [currentView, setCurrentView] = useState<ReportView>('selector');

    // Phase 20: Validation State
    const [validationReport, setValidationReport] = useState<ProjectValidationReport | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);
    const [doorToEdit, setDoorToEdit] = useState<string | null>(null);

    // Phase 23: Export Configuration State - REMOVED

    const handleBackToProject = () => {
        router.push(`/project/${id}`);
    };

    const handleHardwareSetExport = (config: HardwareSetExportConfig) => {
        try {
            exportHardwareSet(doors, hardwareSets, config, projectName);
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        }
    };

    // Phase 20: Validation before submittal generation
    const handleSubmittalClick = () => {
        const report = validateProject(doors);
        setValidationReport(report);

        if (!report.canExport) {
            // Critical errors exist - show validation modal
            setShowValidationModal(true);
        } else if (report.warnings.length > 0 || report.infos.length > 0) {
            // Warnings/info exist - show modal with option to proceed
            setShowValidationModal(true);
        } else {
            // All clear - proceed to submittal generator
            setCurrentView('submittal-package');
        }
    };

    const handleFixDoor = (doorId: string) => {
        setDoorToEdit(doorId);
        setShowValidationModal(false);
        // Navigate back to project to edit door
        // The door edit modal will be triggered by the parent component
        router.push(`/project/${id}?editDoor=${doorId}`);
    };

    const handleExportAnyway = () => {
        setShowValidationModal(false);
        setCurrentView('submittal-package');
    };

    // Old submittal handler removed, logic is now direct print/view


    return (
        <div className="min-h-screen bg-[var(--bg-subtle)]">
            {/* Top Navigation Bar */}
            <div className="bg-[var(--bg)] border-b border-[var(--border)] shadow-sm sticky top-0 z-10">
                <div className="max-w-[1920px] mx-auto px-8 py-4">
                    <div className="flex items-center justify-between">
                        {/* Left: Breadcrumb */}
                        <div className="flex items-center space-x-4">
                            <button
                                onClick={handleBackToProject}
                                className="flex items-center text-[var(--text-muted)] hover:text-[var(--text)] transition-colors group"
                            >
                                <svg className="w-5 h-5 mr-2 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                </svg>
                                <span className="font-medium">Back to Project</span>
                            </button>
                            <div className="flex items-center text-[var(--text-faint)]">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                            </div>
                            <div className="flex items-center space-x-3">
                                <svg className="w-6 h-6 text-[var(--primary-text-muted)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <h1 className="text-2xl font-bold text-[var(--text)]">Report Generation Center</h1>
                            </div>
                        </div>

                        {/* Right: Project Info */}
                        <div className="flex items-center space-x-4">
                            <div className="text-right">
                                <div className="text-sm text-[var(--text-muted)]">Project</div>
                                <div className="font-semibold text-[var(--text)]">{projectName}</div>
                            </div>
                            <div className="h-10 w-px bg-[var(--border-strong)]"></div>
                            <div className="text-right">
                                <div className="text-sm text-[var(--text-muted)]">Data</div>
                                <div className="font-semibold text-[var(--text)]">{doors.length} Doors • {hardwareSets.length} Sets</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="max-w-[1920px] mx-auto px-8 py-8">
                {currentView === 'selector' && (
                    <div className="space-y-8">
                        {/* Hero Section */}
                        <div className="text-center max-w-3xl mx-auto">
                            <h2 className="text-3xl font-bold text-[var(--text)] mb-3">Select Report Type</h2>
                            <p className="text-lg text-[var(--text-muted)]">
                                Choose the type of report you want to generate and customize with powerful configuration options
                            </p>
                        </div>

                        {/* Report Type Cards */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
                            {/* Door Schedule Card */}
                            <div
                                className="bg-[var(--bg)] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-blue-500 cursor-pointer group"
                                onClick={() => setCurrentView('door-schedule')}
                            >
                                <div className="p-8">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl group-hover:scale-110 transition-transform">
                                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </div>
                                        <div className="px-4 py-1.5 bg-[var(--primary-bg)] text-[var(--primary-text)] text-sm font-semibold rounded-full">
                                            {doors.length} doors
                                        </div>
                                    </div>

                                    {/* Card Title */}
                                    <h3 className="text-2xl font-bold text-[var(--text)] mb-3">Door Schedule Report</h3>
                                    <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
                                        Export comprehensive door data with full customization. Choose from 30+ fields including dimensions, materials, fire ratings, and hardware assignments.
                                    </p>

                                    {/* Features List */}
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center text-[var(--text-secondary)]">
                                            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>30+ customizable columns</span>
                                        </div>
                                        <div className="flex items-center text-[var(--text-secondary)]">
                                            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Multiple export formats (Excel, PDF, CSV)</span>
                                        </div>
                                        <div className="flex items-center text-[var(--text-secondary)]">
                                            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Professional formatting & summaries</span>
                                        </div>
                                    </div>

                                    {/* CTA Button */}
                                    <button className="w-full px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-md hover:shadow-lg group-hover:scale-105">
                                        Configure & Export
                                        <svg className="w-5 h-5 inline-block ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Live Preview Section */}
                                <div className="bg-[var(--primary-bg)] px-8 py-6 border-t border-[var(--primary-border)]">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-[var(--primary-text)]">Live Preview Available</span>
                                        <span className="text-[var(--primary-text)]">→</span>
                                    </div>
                                </div>
                            </div>

                            {/* Hardware Set Card */}
                            <div
                                className="bg-[var(--bg)] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-purple-500 cursor-pointer group"
                                onClick={() => setCurrentView('hardware-set')}
                            >
                                <div className="p-8">
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between mb-6">
                                        <div className="p-4 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl group-hover:scale-110 transition-transform">
                                            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                        </div>
                                        <div className="px-4 py-1.5 bg-purple-50 text-purple-700 text-sm font-semibold rounded-full">
                                            {hardwareSets.length} sets
                                        </div>
                                    </div>

                                    {/* Card Title */}
                                    <h3 className="text-2xl font-bold text-[var(--text)] mb-3">Hardware Set Report</h3>
                                    <p className="text-[var(--text-muted)] mb-6 leading-relaxed">
                                        Export hardware items with usage tracking. See exactly which door tags use each item, perfect for procurement and cost analysis.
                                    </p>

                                    {/* Features List */}
                                    <div className="space-y-3 mb-6">
                                        <div className="flex items-center text-[var(--text-secondary)]">
                                            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Usage/location tracking</span>
                                        </div>
                                        <div className="flex items-center text-[var(--text-secondary)]">
                                            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Cross-referencing & grouping</span>
                                        </div>
                                        <div className="flex items-center text-[var(--text-secondary)]">
                                            <svg className="w-5 h-5 text-green-500 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                            </svg>
                                            <span>Procurement planning</span>
                                        </div>
                                    </div>

                                    {/* CTA Button */}
                                    <button className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-xl hover:from-purple-700 hover:to-purple-800 transition-all shadow-md hover:shadow-lg group-hover:scale-105">
                                        Configure & Export
                                        <svg className="w-5 h-5 inline-block ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Live Preview Section */}
                                <div className="bg-gradient-to-r from-purple-50 to-purple-100 px-8 py-6 border-t border-purple-200">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-purple-900">Live Preview Available</span>
                                        <span className="text-purple-700">→</span>
                                    </div>
                                </div>
                            </div>

                            {/* Submittal Package Card - Full Width */}
                            <div className="lg:col-span-2 bg-[var(--bg)] rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border-2 border-transparent hover:border-indigo-500 cursor-pointer group relative"
                                onClick={handleSubmittalClick}
                            >
                                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                    <svg className="w-96 h-96" fill="currentColor" viewBox="0 0 20 20">
                                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                    </svg>
                                </div>
                                <div className="p-8 relative z-10">
                                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-4 mb-4">
                                                <div className="p-3 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl shadow-lg group-hover:scale-110 transition-transform">
                                                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                                    </svg>
                                                </div>
                                                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-sm font-semibold rounded-full border border-indigo-100">
                                                    Comprehensive Package
                                                </span>
                                            </div>

                                            <h3 className="text-2xl font-bold text-[var(--text)] mb-3">Submittal Package & Frame Reports</h3>
                                            <p className="text-[var(--text-muted)] mb-6 text-lg leading-relaxed max-w-2xl">
                                                Generate a professional submittal package including Cover Page, Door Schedule, Hardware Sets, Frame Details, and Elevation Drawings.
                                            </p>

                                            <div className="flex flex-wrap gap-3 mb-6">
                                                {['Door Schedule', 'Hardware Sets', 'Elevations', 'Frame Details', 'Cut Sheets'].map((tag) => (
                                                    <span key={tag} className="flex items-center text-sm font-medium text-[var(--text-secondary)] bg-[var(--bg-subtle)] px-3 py-1.5 rounded-lg border border-[var(--border)]">
                                                        <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2"></span> {tag}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-center md:justify-end">
                                            <button className="px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg group-hover:shadow-xl flex items-center">
                                                Start Submittal
                                                <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>



                        {/* Recent Exports Section */}
                        <div className="max-w-6xl mx-auto mt-12">
                            <div className="bg-[var(--bg)] rounded-xl shadow-md p-8">
                                <div className="flex items-center justify-between mb-6">
                                    <div>
                                        <h3 className="text-xl font-bold text-[var(--text)]">Recent Exports</h3>
                                        <p className="text-sm text-[var(--text-muted)] mt-1">Quick access to your previously generated reports</p>
                                    </div>
                                    <button className="text-[var(--primary-text-muted)] hover:text-blue-800 font-medium text-sm">
                                        View All
                                    </button>
                                </div>
                                <div className="text-center py-12 text-[var(--text-muted)]">
                                    <svg className="w-16 h-16 mx-auto mb-4 text-[var(--text-faint)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <p className="text-lg font-medium">No recent exports yet</p>
                                    <p className="text-sm mt-2">Generate your first report above to get started</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {currentView === 'door-schedule' && (
                    <div className="bg-[var(--bg)] rounded-xl shadow-lg p-8">
                        <div className="mb-6">
                            <button
                                onClick={() => setCurrentView('selector')}
                                className="text-[var(--primary-text-muted)] hover:text-blue-800 font-medium text-sm flex items-center gap-1"
                            >
                                ← Back to Reports
                            </button>
                        </div>
                        <DoorScheduleConfig
                            doors={doors}
                            hardwareSets={hardwareSets}
                            projectName={projectName}
                            onUpdateDoors={onUpdateDoors}
                        />
                    </div>
                )}

                {currentView === 'hardware-set' && (
                    <div className="bg-[var(--bg)] rounded-xl shadow-lg p-8">
                        <HardwareSetConfig
                            doors={doors}
                            hardwareSets={hardwareSets}
                            projectName={projectName}
                            onBack={() => setCurrentView('selector')}
                            onExport={handleHardwareSetExport}
                        />
                    </div>
                )}

                {currentView === 'submittal-package' && (
                    <div className="bg-[var(--bg)] rounded-xl shadow-lg overflow-hidden">
                        <div className="bg-[var(--bg)] rounded-xl shadow-lg border-2 border-indigo-500 overflow-hidden flex flex-col h-[calc(100vh-8rem)]">
                            <div className="bg-indigo-50 px-6 py-4 border-b border-indigo-100 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setCurrentView('selector')} className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center gap-1">
                                        ← Back
                                    </button>
                                    <h2 className="text-xl font-bold text-indigo-900">Submittal Package & Frame Report</h2>
                                </div>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <SubmittalGenerator
                                    doors={doors}
                                    elevationTypes={elevationTypes}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* Phase 22: Hardware Schedule View - REMOVED */}

                {/* Phase 22: Cover Page Editor - REMOVED */}

                {/* Phase 22: Cut Sheet Library - REMOVED */}

                {/* Phase 22: Revision History - REMOVED */}

                {/* Phase 23: Procurement Summary - REMOVED */}
            </div>

            {/* Phase 20: Validation Modal */}
            {showValidationModal && validationReport && (
                <ValidationModal
                    report={validationReport}
                    onClose={() => setShowValidationModal(false)}
                    onFixDoor={handleFixDoor}
                    onExportAnyway={handleExportAnyway}
                />
            )}

            {/* Phase 23: Export Configuration Modal - REMOVED */}
        </div >
    );
};

export default ReportsView;
