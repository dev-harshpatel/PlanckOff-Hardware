'use client';

import React, { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Door, HardwareSet, ElevationType } from '../types';
import DoorScheduleConfig from '../components/DoorScheduleConfig';
import HardwareSetConfig, { HardwareSetExportConfig } from '../components/HardwareSetConfig';
// SubmittalGenerator now uses finalJson — routing handled by /reports/submittal-package page
import ValidationModal from '../components/ValidationModal';
import { exportHardwareSet } from '../services/reportExportService';
import { validateProject, ProjectValidationReport } from '../utils/doorValidation';
import { ArrowLeft, FileSpreadsheet, Settings2, Package, FileText } from 'lucide-react';

interface ReportsViewProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
    projectName: string;
    onUpdateDoors?: (doors: Door[]) => void;
}

type ReportView = 'selector' | 'door-schedule' | 'hardware-set' | 'submittal-package';

const REPORT_CARDS: {
    id: ReportView;
    label: string;
    description: string;
    features: string[];
    icon: React.ReactNode;
    badge: (d: Door[], h: HardwareSet[]) => string;
    actionLabel: string;
}[] = [
    {
        id: 'door-schedule',
        label: 'Door-Frame Reports',
        description: 'Export comprehensive door data with full customization. Choose from 30+ fields including dimensions, materials, fire ratings, and hardware assignments.',
        features: ['30+ customizable columns', 'Excel, PDF, or CSV export', 'Professional formatting & summaries'],
        icon: <FileSpreadsheet className="h-6 w-6" />,
        badge: (d) => `${d.length} doors`,
        actionLabel: 'Configure & Export',
    },
    {
        id: 'hardware-set',
        label: 'Hardware Set Report',
        description: 'Export hardware items with usage tracking. See exactly which door tags use each item, perfect for procurement and cost analysis.',
        features: ['Usage / location tracking', 'Cross-referencing & grouping', 'Procurement planning'],
        icon: <Settings2 className="h-6 w-6" />,
        badge: (_, h) => `${h.length} sets`,
        actionLabel: 'Configure & Export',
    },
    {
        id: 'submittal-package',
        label: 'Submittal Package',
        description: 'Generate a professional submittal package including Cover Page, Door Schedule, Hardware Sets, Frame Details, and Elevation Drawings.',
        features: ['Door Schedule', 'Hardware Sets', 'Frame Details & Elevations'],
        icon: <Package className="h-6 w-6" />,
        badge: (d, h) => `${d.length} doors · ${h.length} sets`,
        actionLabel: 'Start Submittal',
    },
];

const ReportsView: React.FC<ReportsViewProps> = ({
    doors,
    hardwareSets,
    elevationTypes,
    projectName,
    onUpdateDoors,
}) => {
    const router = useRouter();
    const params = useParams();
    const id = params.id as string;
    const [currentView, setCurrentView] = useState<ReportView>('selector');

    const [validationReport, setValidationReport] = useState<ProjectValidationReport | null>(null);
    const [showValidationModal, setShowValidationModal] = useState(false);

    const activeCard = REPORT_CARDS.find(c => c.id === currentView);

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

    const handleCardClick = (cardId: ReportView) => {
        if (cardId === 'submittal-package') {
            const report = validateProject(doors);
            setValidationReport(report);
            if (!report.canExport || report.warnings.length > 0 || report.infos.length > 0) {
                setShowValidationModal(true);
            } else {
                setCurrentView('submittal-package');
            }
        } else {
            setCurrentView(cardId);
        }
    };

    const handleFixDoor = (doorId: string) => {
        setShowValidationModal(false);
        router.push(`/project/${id}?editDoor=${doorId}`);
    };

    const handleExportAnyway = () => {
        setShowValidationModal(false);
        setCurrentView('submittal-package');
    };

    return (
        <div className="min-h-screen bg-[var(--bg-subtle)]">
            {/* Top Navigation */}
            <div className="bg-[var(--bg)] border-b border-[var(--border)] sticky top-0 z-10">
                <div className="max-w-[1920px] mx-auto px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={currentView === 'selector' ? handleBackToProject : () => setCurrentView('selector')}
                            className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                        >
                            <ArrowLeft className="h-4 w-4" />
                            {currentView === 'selector' ? 'Back to Project' : 'Back to Reports'}
                        </button>
                        <span className="text-[var(--text-faint)]">/</span>
                        <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-[var(--primary-text-muted)]" />
                            <span className="text-sm font-semibold text-[var(--text)]">
                                {currentView === 'selector' ? 'Reports' : (activeCard?.label ?? 'Reports')}
                            </span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                        <span className="font-medium text-[var(--text)]">{projectName}</span>
                        <span className="text-[var(--text-faint)]">·</span>
                        <span className="text-[var(--text-muted)]">{doors.length} doors · {hardwareSets.length} sets</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-[1920px] mx-auto px-6 py-6">

                {/* Selector — 3 big cards in one row */}
                {currentView === 'selector' && (
                    <div className="space-y-5">
                        <div>
                            <h2 className="text-sm font-semibold text-[var(--text)]">Select Report Type</h2>
                            <p className="text-xs text-[var(--text-muted)] mt-0.5">Choose a report to configure and export.</p>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {REPORT_CARDS.map((card) => (
                                <button
                                    key={card.id}
                                    onClick={() => handleCardClick(card.id)}
                                    className="text-left bg-[var(--bg)] border border-[var(--border)] rounded-md hover:border-[var(--primary-border)] hover:shadow-sm transition-all group flex flex-col overflow-hidden"
                                >
                                    {/* Card top: icon + badge */}
                                    <div className="px-5 pt-5 pb-4 flex items-start justify-between">
                                        <div className="h-10 w-10 rounded-md bg-[var(--primary-bg)] flex items-center justify-center text-[var(--primary-text-muted)] group-hover:bg-[var(--primary-bg-hover)] transition-colors flex-shrink-0">
                                            {card.icon}
                                        </div>
                                        <span className="text-xs font-semibold px-2 py-1 rounded bg-[var(--primary-bg)] text-[var(--primary-text)]">
                                            {card.badge(doors, hardwareSets)}
                                        </span>
                                    </div>

                                    {/* Card body */}
                                    <div className="px-5 pb-4 flex-1">
                                        <h3 className="text-sm font-semibold text-[var(--text)] mb-1.5">{card.label}</h3>
                                        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-4">{card.description}</p>

                                        <ul className="space-y-1.5">
                                            {card.features.map((f) => (
                                                <li key={f} className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                                                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--success-dot)] flex-shrink-0" />
                                                    {f}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Card footer */}
                                    <div className="border-t border-[var(--border)] bg-[var(--primary-bg)] px-5 py-3 flex items-center justify-between group-hover:bg-[var(--primary-bg-hover)] transition-colors">
                                        <span className="text-xs font-semibold text-[var(--primary-text)]">{card.actionLabel}</span>
                                        <ArrowLeft className="h-3.5 w-3.5 text-[var(--primary-text)] rotate-180" />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Door Schedule sub-view */}
                {currentView === 'door-schedule' && (
                    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
                        <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
                            <FileSpreadsheet className="h-4 w-4 text-[var(--primary-text-muted)]" />
                            <h2 className="text-sm font-semibold text-[var(--text)]">Door-Frame Reports</h2>
                            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
                                {doors.length} doors
                            </span>
                        </div>
                        <div className="p-5">
                            <DoorScheduleConfig
                                doors={doors}
                                hardwareSets={hardwareSets}
                                projectName={projectName}
                                onUpdateDoors={onUpdateDoors}
                            />
                        </div>
                    </div>
                )}

                {/* Hardware Set sub-view */}
                {currentView === 'hardware-set' && (
                    <div className="bg-[var(--bg)] rounded-md border border-[var(--border)] overflow-hidden">
                        <div className="bg-[var(--primary-bg)] border-b border-[var(--primary-border)] px-5 py-3 flex items-center gap-3">
                            <Settings2 className="h-4 w-4 text-[var(--primary-text-muted)]" />
                            <h2 className="text-sm font-semibold text-[var(--text)]">Hardware Set Report</h2>
                            <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--primary-border)] text-[var(--primary-text)]">
                                {hardwareSets.length} sets
                            </span>
                        </div>
                        <div className="p-5">
                            <HardwareSetConfig
                                doors={doors}
                                hardwareSets={hardwareSets}
                                projectName={projectName}
                                onBack={() => setCurrentView('selector')}
                                onExport={handleHardwareSetExport}
                            />
                        </div>
                    </div>
                )}

                {/* Submittal Package — handled by /reports/submittal-package route */}
            </div>

            {showValidationModal && validationReport && (
                <ValidationModal
                    report={validationReport}
                    onClose={() => setShowValidationModal(false)}
                    onFixDoor={handleFixDoor}
                    onExportAnyway={handleExportAnyway}
                />
            )}
        </div>
    );
};

export default ReportsView;
