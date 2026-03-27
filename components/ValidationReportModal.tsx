import React, { useState, useMemo } from 'react';
import { ValidationReport, ValidationError } from '../types';
import {
    ExclamationTriangleIcon,
    ExclamationCircleIcon,
    ArrowDownTrayIcon,
    MagnifyingGlassIcon,
    CheckCircleIcon
} from './icons';

interface ValidationReportModalProps {
    isOpen: boolean;
    onClose: () => void;
    report: ValidationReport<any> | null;
    title: string;
    fileName?: string;
}

const ValidationReportModal: React.FC<ValidationReportModalProps> = ({ isOpen, onClose, report, title }) => {
    const [activeTab, setActiveTab] = useState<'errors' | 'warnings'>('errors');
    const [searchQuery, setSearchQuery] = useState('');

    if (!isOpen || !report) return null;

    const { summary, errors: allErrors } = report;

    // Filter Logic
    const filteredIssues = useMemo(() => {
        let issues = allErrors;

        // Filter by Tab
        issues = issues.filter(e => activeTab === 'errors' ? e.severity === 'error' : e.severity === 'warning');

        // Filter by Search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            issues = issues.filter(e =>
                String(e.row).toLowerCase().includes(q) ||
                e.field.toLowerCase().includes(q) ||
                e.issue.toLowerCase().includes(q) ||
                (e.suggestion && e.suggestion.toLowerCase().includes(q))
            );
        }

        return issues;
    }, [allErrors, activeTab, searchQuery]);

    const handleExportCSV = () => {
        const headers = ['Row', 'Severity', 'Field', 'Value', 'Issue', 'Suggestion'];
        const rows = allErrors.map(e => [
            e.row,
            e.severity,
            e.field,
            `"${String(e.value || '').replace(/"/g, '""')}"`,
            `"${e.issue.replace(/"/g, '""')}"`,
            `"${(e.suggestion || '').replace(/"/g, '""')}"`
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(r => r.join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${title.replace(/\s+/g, '_')}_Validation_Report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[80vh] flex flex-col animate-fadeIn">

                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800">{title} - Validation Report</h2>
                        <div className="text-sm text-gray-500 mt-1 flex gap-4">
                            <span className="flex items-center text-green-600"><CheckCircleIcon className="w-4 h-4 mr-1" /> Valid Rows: {summary.validCount}</span>
                            <span className="flex items-center text-red-600"><ExclamationCircleIcon className="w-4 h-4 mr-1" /> Errors: {summary.errorCount}</span>
                            <span className="flex items-center text-amber-600"><ExclamationTriangleIcon className="w-4 h-4 mr-1" /> Warnings: {summary.warningCount}</span>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Toolbar */}
                <div className="px-6 py-3 border-b border-gray-100 flex justify-between items-center bg-white">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('errors')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'errors' ? 'bg-red-100 text-red-700 border border-red-200' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Errors ({summary.errorCount})
                        </button>
                        <button
                            onClick={() => setActiveTab('warnings')}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${activeTab === 'warnings' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'text-gray-600 hover:bg-gray-50'}`}
                        >
                            Warnings ({summary.warningCount})
                        </button>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <MagnifyingGlassIcon className="h-4 w-4 text-gray-400" />
                            </div>
                            <input
                                type="text"
                                placeholder="Search report..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-primary-500 focus:outline-none w-64"
                            />
                        </div>
                        <button
                            onClick={handleExportCSV}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                            <ArrowDownTrayIcon className="w-4 h-4" />
                            Export
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-grow overflow-auto bg-gray-50 p-6">
                    {filteredIssues.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                            <CheckCircleIcon className="w-12 h-12 mb-2 text-gray-300" />
                            <p>No {activeTab} found.</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Row</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Field</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Issue</th>
                                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Suggestion</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredIssues.map((issue, idx) => {
                                        const isSkipped = issue.issue.toLowerCase().includes('skipped');
                                        return (
                                            <tr key={idx} className={`hover:bg-gray-50 ${isSkipped ? 'bg-red-50/30' : ''}`}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{issue.row}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono bg-gray-50 bg-opacity-50">{issue.field}</td>
                                                <td className="px-6 py-4 text-sm text-gray-700">
                                                    <div className={`font-medium ${isSkipped ? 'text-red-700 font-bold' : ''}`}>{issue.issue}</div>
                                                    <div className="text-xs text-gray-400 mt-1">Value: {String(issue.value).substring(0, 50) || '(empty)'}</div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-500 italic">
                                                    {issue.suggestion}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded-md text-gray-700 font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ValidationReportModal;
