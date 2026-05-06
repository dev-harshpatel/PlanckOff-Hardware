import React, { useState } from 'react';
import { ProjectValidationReport, ValidationResult, getSeverityIcon, getSeverityColor } from '../../utils/doorValidation';
import { XCircleIcon } from './icons';

interface ValidationModalProps {
    report: ProjectValidationReport;
    onClose: () => void;
    onFixDoor: (doorId: string) => void;
    onExportAnyway?: () => void;
}

const ValidationModal: React.FC<ValidationModalProps> = ({
    report,
    onClose,
    onFixDoor,
    onExportAnyway
}) => {
    const [expandedSection, setExpandedSection] = useState<'critical' | 'warning' | 'info' | null>('critical');

    const toggleSection = (section: 'critical' | 'warning' | 'info') => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const getScoreColor = (score: number): string => {
        if (score >= 90) return 'bg-green-500';
        if (score >= 70) return 'bg-yellow-500';
        return 'bg-red-500';
    };

    const getScoreTextColor = (score: number): string => {
        if (score >= 90) return 'text-green-700';
        if (score >= 70) return 'text-yellow-700';
        return 'text-red-700';
    };

    const renderIssueCard = (result: ValidationResult) => {
        const colors = getSeverityColor(result.severity);

        return (
            <div
                key={`${result.doorId}-${result.ruleId}`}
                className={`${colors.bg} border ${colors.border} rounded-lg p-4 mb-3`}
            >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-bold text-[var(--text)]">Door {result.doorTag}</span>
                            {result.field && (
                                <span className="text-xs px-2 py-0.5 bg-[var(--bg)] rounded border border-[var(--border-strong)] text-[var(--text-muted)]">
                                    {result.field}
                                </span>
                            )}
                        </div>
                        <p className={`text-sm ${colors.text} font-medium mb-2`}>
                            {result.message}
                        </p>
                        {result.suggestion && (
                            <p className="text-xs text-[var(--text-muted)] flex items-start gap-1">
                                <span className="mt-0.5">💡</span>
                                <span>{result.suggestion}</span>
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => onFixDoor(result.doorId)}
                        className="ml-4 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                    >
                        Fix Now →
                    </button>
                </div>
            </div>
        );
    };

    const renderSection = (
        title: string,
        icon: string,
        count: number,
        results: ValidationResult[],
        sectionKey: 'critical' | 'warning' | 'info',
        description: string
    ) => {
        const isExpanded = expandedSection === sectionKey;

        return (
            <div className="mb-4">
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className="w-full flex items-center justify-between p-4 bg-[var(--bg-subtle)] hover:bg-[var(--bg-muted)] rounded-lg transition-colors border border-[var(--border)]"
                >
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        <div className="text-left">
                            <div className="font-semibold text-[var(--text)]">
                                {title} ({count})
                            </div>
                            <div className="text-xs text-[var(--text-muted)]">{description}</div>
                        </div>
                    </div>
                    <span className="text-[var(--text-faint)] text-xl">
                        {isExpanded ? '▼' : '▶'}
                    </span>
                </button>

                {isExpanded && results.length > 0 && (
                    <div className="mt-3 pl-4">
                        {results.map(result => renderIssueCard(result))}
                    </div>
                )}

                {isExpanded && results.length === 0 && (
                    <div className="mt-3 pl-4 text-sm text-[var(--text-muted)] italic">
                        No issues in this category ✓
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-[var(--bg)] rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text)]">Validation Report</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            Review data quality - you can export at any time
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-[var(--text-faint)] hover:text-[var(--text-muted)] transition-colors"
                    >
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Completeness Score */}
                <div className="p-6 border-b border-[var(--border)] bg-[var(--bg-subtle)]">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-lg font-semibold text-[var(--text-secondary)]">Completeness Score</span>
                        <span className={`text-3xl font-bold ${getScoreTextColor(report.completenessScore)}`}>
                            {report.completenessScore}%
                        </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[var(--bg-emphasis)] rounded-full h-3 overflow-hidden">
                        <div
                            className={`h-full ${getScoreColor(report.completenessScore)} transition-all duration-500`}
                            style={{ width: `${report.completenessScore}%` }}
                        />
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 gap-4 mt-4">
                        <div className="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
                            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Total Doors</div>
                            <div className="text-2xl font-bold text-[var(--text)] mt-1">{report.totalDoors}</div>
                        </div>
                        <div className="bg-[var(--bg)] rounded-lg p-3 border border-[var(--border)]">
                            <div className="text-xs text-[var(--text-muted)] uppercase tracking-wide">Valid Doors</div>
                            <div className="text-2xl font-bold text-green-600 mt-1">{report.validDoors}</div>
                        </div>
                    </div>

                    {/* Issue Summary */}
                    <div className="mt-4 flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                            <span className="text-red-600 font-semibold">{report.criticalErrors.length}</span>
                            <span className="text-[var(--text-muted)]">Critical</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-yellow-600 font-semibold">{report.warnings.length}</span>
                            <span className="text-[var(--text-muted)]">Warnings</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span className="text-blue-600 font-semibold">{report.infos.length}</span>
                            <span className="text-[var(--text-muted)]">Info</span>
                        </div>
                    </div>
                </div>

                {/* Issues List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {renderSection(
                        'Critical Errors',
                        '🔴',
                        report.criticalErrors.length,
                        report.criticalErrors,
                        'critical',
                        'Important issues to review'
                    )}

                    {renderSection(
                        'Warnings',
                        '⚠️',
                        report.warnings.length,
                        report.warnings,
                        'warning',
                        'Recommended to fix'
                    )}

                    {renderSection(
                        'Info',
                        'ℹ️',
                        report.infos.length,
                        report.infos,
                        'info',
                        'Suggestions for improvement'
                    )}

                    {/* All Clear Message */}
                    {report.canExport && report.warnings.length === 0 && report.infos.length === 0 && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                            <div className="text-4xl mb-2">✅</div>
                            <div className="text-lg font-semibold text-green-800">All Checks Passed!</div>
                            <div className="text-sm text-green-600 mt-1">
                                Your schedule is 100% complete and ready for export.
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between gap-3 p-6 border-t border-[var(--border)] bg-[var(--bg-subtle)]">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-[var(--text-secondary)] bg-[var(--bg)] border border-[var(--border-strong)] rounded-lg hover:bg-[var(--bg-subtle)] font-medium transition-colors"
                    >
                        Cancel
                    </button>

                    <div className="flex items-center gap-3">
                        {report.criticalErrors.length > 0 && (
                            <button
                                onClick={() => {
                                    const firstError = report.criticalErrors[0];
                                    if (firstError) {
                                        onFixDoor(firstError.doorId);
                                    }
                                }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                            >
                                Fix First Issue →
                            </button>
                        )}

                        {/* Always allow export, even with critical errors */}
                        <button
                            onClick={() => {
                                onClose();
                                onExportAnyway?.();
                            }}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors shadow-sm"
                        >
                            {report.criticalErrors.length > 0
                                ? 'Continue with Issues'
                                : report.warnings.length > 0 || report.infos.length > 0
                                    ? 'Continue Anyway'
                                    : 'Continue to Export'
                            }
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ValidationModal;
