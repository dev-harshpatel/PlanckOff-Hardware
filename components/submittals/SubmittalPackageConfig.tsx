import React, { useState } from 'react';
import { Door, HardwareSet, ElevationType } from '../../types';
import ReportDataPreview from '../reports/ReportDataPreview';

export interface SubmittalExportConfig {
    sections: {
        coverPage: boolean;
        doorSchedule: boolean;
        hardwareSets: boolean;
        elevations: boolean; // Door & Frame Elevations
        cutSheets: boolean;
    };
    coverPageDetails: {
        projectName: string;
        clientName: string;
        submittalDate: string;
        submittalNumber: string;
        architect?: string;
        contractor?: string;
    };
    format: 'pdf'; // Submittals are usually PDF only
}

interface SubmittalPackageConfigProps {
    doors: Door[];
    hardwareSets: HardwareSet[];
    elevationTypes: ElevationType[];
    projectName: string;
    onBack: () => void;
    onExport: (config: SubmittalExportConfig) => void;
}

const SubmittalPackageConfig: React.FC<SubmittalPackageConfigProps> = ({
    doors,
    hardwareSets,
    elevationTypes = [],
    projectName,
    onBack,
    onExport
}) => {
    const [sections, setSections] = useState({
        coverPage: true,
        doorSchedule: true,
        hardwareSets: true,
        elevations: true,
        cutSheets: false // Default to false as it might require extra data
    });

    const [coverDetails, setCoverDetails] = useState({
        projectName: projectName,
        clientName: '',
        submittalDate: new Date().toISOString().split('T')[0],
        submittalNumber: '001',
        architect: '',
        contractor: ''
    });

    const [isPreviewOpen, setIsPreviewOpen] = useState(false);

    const handleSectionToggle = (key: keyof typeof sections) => {
        setSections(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const handleCoverChange = (field: string, value: string) => {
        setCoverDetails(prev => ({ ...prev, [field]: value }));
    };

    return (
        <div className="flex flex-col h-full bg-gray-50">
            <div className="bg-white border-b border-gray-200 px-8 py-6 mb-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Submittal Package Configuration</h2>
                        <p className="text-gray-600 mt-1">Configure your comprehensive submittal package layout and content.</p>
                    </div>
                    <button onClick={onBack} className="text-gray-500 hover:text-gray-700 font-medium">
                        Back to Selection
                    </button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto px-8 pb-8">
                <div className="max-w-4xl mx-auto space-y-8">

                    {/* Sections Selection */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Package Contents
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                                { id: 'coverPage', label: 'Cover Page', desc: 'Project details and approval status' },
                                { id: 'doorSchedule', label: 'Door Schedule', desc: 'Complete door list with specs' },
                                { id: 'hardwareSets', label: 'Hardware Sets', desc: 'Detailed hardware breakdown' },
                                { id: 'elevations', label: 'Elevations', desc: 'Door and Frame elevation drawings' },
                                { id: 'cutSheets', label: 'Cut Sheets', desc: 'Manufacturer product data sheets (Placeholders)' },
                            ].map((item) => (
                                <label key={item.id} className={`flex items-start p-4 border rounded-lg cursor-pointer transition-all ${sections[item.id as keyof typeof sections] ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300'}`}>
                                    <input
                                        type="checkbox"
                                        checked={sections[item.id as keyof typeof sections]}
                                        onChange={() => handleSectionToggle(item.id as any)}
                                        className="mt-1 w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                                    />
                                    <div className="ml-3">
                                        <div className="font-semibold text-gray-900">{item.label}</div>
                                        <div className="text-sm text-gray-500">{item.desc}</div>
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Cover Page Details */}
                    {sections.coverPage && (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fadeIn">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <svg className="w-5 h-5 text-purple-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                                </svg>
                                Cover Page Details
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Project Name</label>
                                    <input
                                        type="text"
                                        value={coverDetails.projectName}
                                        onChange={(e) => handleCoverChange('projectName', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Client Name</label>
                                    <input
                                        type="text"
                                        placeholder="Enter Client Name"
                                        value={coverDetails.clientName}
                                        onChange={(e) => handleCoverChange('clientName', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Submittal Number</label>
                                    <input
                                        type="text"
                                        value={coverDetails.submittalNumber}
                                        onChange={(e) => handleCoverChange('submittalNumber', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        value={coverDetails.submittalDate}
                                        onChange={(e) => handleCoverChange('submittalDate', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Architect (Optional)</label>
                                    <input
                                        type="text"
                                        value={coverDetails.architect}
                                        onChange={(e) => handleCoverChange('architect', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contractor (Optional)</label>
                                    <input
                                        type="text"
                                        value={coverDetails.contractor}
                                        onChange={(e) => handleCoverChange('contractor', e.target.value)}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Footer Actions */}
            <div className="bg-white border-t border-gray-200 px-8 py-5 flex items-center justify-between">
                <div className="text-gray-600 text-sm">
                    Total Doors: <span className="font-semibold text-gray-900">{doors.length}</span> •
                    Hardware Sets: <span className="font-semibold text-gray-900">{hardwareSets.length}</span> •
                    Elevations: <span className="font-semibold text-gray-900">{elevationTypes.length}</span>
                </div>
                <div className="flex gap-4">
                    <button
                        onClick={() => setIsPreviewOpen(true)}
                        className="px-6 py-2.5 bg-white text-gray-700 font-semibold border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        Preview Package
                    </button>
                    <button
                        onClick={() => onExport({ sections, coverPageDetails: coverDetails, format: 'pdf' })}
                        className="px-6 py-2.5 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors shadow-sm flex items-center"
                    >
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Generate Submittal PDF
                    </button>
                </div>
            </div>

            {/* Preview Modal */}
            <ReportDataPreview
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                doors={doors}
                hardwareSets={hardwareSets}
                elevationTypes={elevationTypes}
                reportType="submittal-package" // Need to update ReportDataPreview to handle this
                format="pdf"
            />
        </div>
    );
};

export default SubmittalPackageConfig;
