import React, { useState } from 'react';
import { SubmittalMetadata, TableOfContentsItem } from '../../types';

interface SubmittalCoverPageProps {
    metadata: SubmittalMetadata;
    tableOfContents: TableOfContentsItem[];
    onMetadataChange?: (metadata: SubmittalMetadata) => void;
    editable?: boolean;
}

const SubmittalCoverPage: React.FC<SubmittalCoverPageProps> = ({
    metadata,
    tableOfContents,
    onMetadataChange,
    editable = false
}) => {
    const [editedMetadata, setEditedMetadata] = useState<SubmittalMetadata>(metadata);
    const [logoFile, setLogoFile] = useState<File | null>(null);

    const updateField = <K extends keyof SubmittalMetadata>(field: K, value: SubmittalMetadata[K]) => {
        const updated = { ...editedMetadata, [field]: value };
        setEditedMetadata(updated);
        onMetadataChange?.(updated);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setLogoFile(file);
            const reader = new FileReader();
            reader.onload = (event) => {
                updateField('companyLogoUrl', event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Approved': return 'text-green-600 bg-green-50 border-green-200';
            case 'Submitted': return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'Reviewed': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'Rejected': return 'text-red-600 bg-red-50 border-red-200';
            default: return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    return (
        <div className="bg-white p-12 max-w-4xl mx-auto print:p-8">
            {/* Header Section */}
            <div className="border-b-4 border-blue-600 pb-8 mb-8">
                {/* Company Logo */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex-1">
                        {editedMetadata.companyLogoUrl ? (
                            <img
                                src={editedMetadata.companyLogoUrl}
                                alt="Company Logo"
                                className="h-20 object-contain"
                            />
                        ) : editable ? (
                            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                    id="logo-upload"
                                />
                                <label htmlFor="logo-upload" className="cursor-pointer text-blue-600 hover:text-blue-800">
                                    📷 Upload Company Logo
                                </label>
                            </div>
                        ) : (
                            <div className="h-20 flex items-center text-gray-400">
                                [Company Logo]
                            </div>
                        )}
                    </div>

                    {/* Status Badge */}
                    <div className={`px-4 py-2 rounded-lg border-2 font-semibold ${getStatusColor(editedMetadata.status)}`}>
                        {editedMetadata.status.toUpperCase()}
                    </div>
                </div>

                {/* Title */}
                <h1 className="text-4xl font-bold text-gray-900 mb-2">
                    DOOR HARDWARE SUBMITTAL
                </h1>
                <div className="text-lg text-gray-600">
                    Division 08 - Openings
                </div>
            </div>

            {/* Project Information */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
                    Project Information
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Project Name</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.projectName}
                                onChange={(e) => updateField('projectName', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900 font-medium">{editedMetadata.projectName}</div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Project Number</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.projectNumber}
                                onChange={(e) => updateField('projectNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900 font-medium">{editedMetadata.projectNumber}</div>
                        )}
                    </div>

                    <div className="col-span-2">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Project Address</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.projectAddress || ''}
                                onChange={(e) => updateField('projectAddress', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900">{editedMetadata.projectAddress || 'N/A'}</div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Architect</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.architect || ''}
                                onChange={(e) => updateField('architect', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900">{editedMetadata.architect || 'N/A'}</div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Contractor</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.contractor || ''}
                                onChange={(e) => updateField('contractor', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900">{editedMetadata.contractor || 'N/A'}</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Submittal Details */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
                    Submittal Details
                </h2>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Submittal Number</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.submittalNumber}
                                onChange={(e) => updateField('submittalNumber', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900 font-medium">{editedMetadata.submittalNumber}</div>
                        )}
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Submittal Date</label>
                        <div className="text-gray-900 font-medium">
                            {new Date(editedMetadata.submittalDate).toLocaleDateString()}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Revision Number</label>
                        <div className="text-gray-900 font-medium">Rev {editedMetadata.revisionNumber}</div>
                    </div>

                    {editedMetadata.revisionDate && (
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-1">Revision Date</label>
                            <div className="text-gray-900 font-medium">
                                {new Date(editedMetadata.revisionDate).toLocaleDateString()}
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Prepared By</label>
                        {editable ? (
                            <input
                                type="text"
                                value={editedMetadata.preparedBy}
                                onChange={(e) => updateField('preparedBy', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900">{editedMetadata.preparedBy}</div>
                        )}
                    </div>
                </div>

                {editedMetadata.notes && (
                    <div className="mt-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-1">Notes</label>
                        {editable ? (
                            <textarea
                                value={editedMetadata.notes}
                                onChange={(e) => updateField('notes', e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        ) : (
                            <div className="text-gray-900 bg-gray-50 p-3 rounded-lg">{editedMetadata.notes}</div>
                        )}
                    </div>
                )}
            </div>

            {/* Table of Contents */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-4 border-b pb-2">
                    Table of Contents
                </h2>
                <div className="space-y-2">
                    {tableOfContents.map((item, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200">
                            <div className="flex items-center gap-3">
                                <span className="font-semibold text-gray-700">{item.section}</span>
                                <span className="text-gray-900">{item.title}</span>
                            </div>
                            {item.pageNumber && (
                                <span className="text-gray-600 font-mono">{item.pageNumber}</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Approval Signatures */}
            <div className="border-t-2 border-gray-300 pt-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-6">
                    Approval Signatures
                </h2>

                <div className="grid grid-cols-1 gap-6">
                    {/* Prepared By */}
                    <div className="border border-gray-300 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Prepared By</div>
                        <div className="flex justify-between items-end">
                            <div className="flex-1">
                                <div className="text-gray-900 font-medium mb-1">{editedMetadata.preparedBy}</div>
                                <div className="border-b-2 border-gray-400 w-64"></div>
                                <div className="text-xs text-gray-500 mt-1">Signature</div>
                            </div>
                            <div>
                                <div className="border-b-2 border-gray-400 w-32"></div>
                                <div className="text-xs text-gray-500 mt-1">Date</div>
                            </div>
                        </div>
                    </div>

                    {/* Reviewed By */}
                    <div className="border border-gray-300 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Reviewed By</div>
                        <div className="flex justify-between items-end">
                            <div className="flex-1">
                                <div className="text-gray-900 font-medium mb-1">
                                    {editedMetadata.reviewedBy || '_______________________'}
                                </div>
                                <div className="border-b-2 border-gray-400 w-64"></div>
                                <div className="text-xs text-gray-500 mt-1">Signature</div>
                            </div>
                            <div>
                                <div className="border-b-2 border-gray-400 w-32"></div>
                                <div className="text-xs text-gray-500 mt-1">Date</div>
                            </div>
                        </div>
                    </div>

                    {/* Approved By */}
                    <div className="border border-gray-300 rounded-lg p-4">
                        <div className="text-sm font-semibold text-gray-700 mb-2">Approved By</div>
                        <div className="flex justify-between items-end">
                            <div className="flex-1">
                                <div className="text-gray-900 font-medium mb-1">
                                    {editedMetadata.approvedBy || '_______________________'}
                                </div>
                                <div className="border-b-2 border-gray-400 w-64"></div>
                                <div className="text-xs text-gray-500 mt-1">Signature</div>
                            </div>
                            <div>
                                <div className="border-b-2 border-gray-400 w-32"></div>
                                <div className="text-xs text-gray-500 mt-1">Date</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-center text-sm text-gray-500 border-t pt-4">
                This submittal is submitted for review and approval in accordance with the contract documents.
            </div>
        </div>
    );
};

export default SubmittalCoverPage;
