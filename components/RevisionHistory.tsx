import React, { useState } from 'react';
import { SubmittalRevision, SubmittalStatus } from '../types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface RevisionHistoryProps {
    revisions: SubmittalRevision[];
    currentRevision: number;
    onAddRevision: (revision: Omit<SubmittalRevision, 'revisionNumber' | 'revisionDate'>) => void;
    onUpdateRevision: (revisionNumber: number, updates: Partial<SubmittalRevision>) => void;
}

const RevisionHistory: React.FC<RevisionHistoryProps> = ({
    revisions,
    currentRevision,
    onAddRevision,
    onUpdateRevision
}) => {
    const [showNewRevisionModal, setShowNewRevisionModal] = useState(false);
    const [expandedRevision, setExpandedRevision] = useState<number | null>(currentRevision);
    const [newRevisionData, setNewRevisionData] = useState({
        changedBy: '',
        changeDescription: '',
        affectedDoors: [] as string[],
        status: 'Draft' as SubmittalStatus
    });

    const getStatusColor = (status: SubmittalStatus) => {
        switch (status) {
            case 'Approved': return 'bg-green-100 text-green-800 border-green-200';
            case 'Submitted': return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Reviewed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
            case 'Rejected': return 'bg-red-100 text-red-800 border-red-200';
            default: return 'bg-[var(--bg-muted)] text-[var(--text-secondary)] border-[var(--border)]';
        }
    };

    const getStatusIcon = (status: SubmittalStatus) => {
        switch (status) {
            case 'Approved': return '✓';
            case 'Submitted': return '📤';
            case 'Reviewed': return '👁️';
            case 'Rejected': return '✗';
            default: return '📝';
        }
    };

    const handleCreateRevision = () => {
        if (!newRevisionData.changedBy || !newRevisionData.changeDescription) {
            alert('Please fill in all required fields');
            return;
        }

        onAddRevision({
            changedBy: newRevisionData.changedBy,
            changeDescription: newRevisionData.changeDescription,
            affectedDoors: newRevisionData.affectedDoors,
            affectedItems: [],
            status: newRevisionData.status
        });

        setNewRevisionData({
            changedBy: '',
            changeDescription: '',
            affectedDoors: [],
            status: 'Draft'
        });
        setShowNewRevisionModal(false);
    };

    const handleStatusChange = (revisionNumber: number, newStatus: SubmittalStatus) => {
        onUpdateRevision(revisionNumber, { status: newStatus });
    };

    const handleAddComment = (revisionNumber: number) => {
        const comment = prompt('Enter review comment:');
        if (comment) {
            onUpdateRevision(revisionNumber, {
                reviewComments: comment,
                reviewDate: new Date(),
                status: 'Reviewed'
            });
        }
    };

    const sortedRevisions = [...revisions].sort((a, b) => b.revisionNumber - a.revisionNumber);

    return (
        <div className="bg-[var(--bg)] rounded-lg shadow-sm border border-[var(--border)]">
            {/* Header */}
            <div className="border-b border-[var(--border)] p-6">
                <div className="flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-[var(--text)]">Revision History</h2>
                        <p className="text-sm text-[var(--text-muted)] mt-1">
                            Track changes and approval workflow
                        </p>
                    </div>
                    <button
                        onClick={() => setShowNewRevisionModal(true)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                    >
                        + New Revision
                    </button>
                </div>
            </div>

            {/* Timeline */}
            <div className="p-6">
                {sortedRevisions.length === 0 ? (
                    <div className="text-center py-12 text-[var(--text-muted)]">
                        <div className="text-4xl mb-2">📋</div>
                        <div className="font-medium">No revisions yet</div>
                        <div className="text-sm">Create your first revision to get started</div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {sortedRevisions.map((revision, index) => {
                            const isExpanded = expandedRevision === revision.revisionNumber;
                            const isCurrent = revision.revisionNumber === currentRevision;

                            return (
                                <div
                                    key={revision.revisionNumber}
                                    className={`border rounded-lg ${isCurrent ? 'border-blue-500 shadow-md' : 'border-[var(--border)]'
                                        }`}
                                >
                                    {/* Revision Header */}
                                    <div
                                        className="p-4 cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
                                        onClick={() => setExpandedRevision(isExpanded ? null : revision.revisionNumber)}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-4 flex-1">
                                                {/* Timeline Indicator */}
                                                <div className="relative">
                                                    <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center font-bold ${isCurrent ? 'bg-blue-500 text-white border-blue-600' :
                                                            revision.status === 'Approved' ? 'bg-green-500 text-white border-green-600' :
                                                                'bg-[var(--bg)] text-[var(--text-secondary)] border-[var(--border-strong)]'
                                                        }`}>
                                                        {revision.revisionNumber}
                                                    </div>
                                                    {index < sortedRevisions.length - 1 && (
                                                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 w-0.5 h-8 bg-[var(--border-strong)]"></div>
                                                    )}
                                                </div>

                                                {/* Revision Info */}
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="text-lg font-semibold text-[var(--text)]">
                                                            Rev {revision.revisionNumber}
                                                            {isCurrent && (
                                                                <span className="ml-2 text-xs px-2 py-1 bg-blue-100 text-blue-800 rounded">
                                                                    CURRENT
                                                                </span>
                                                            )}
                                                        </h3>
                                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getStatusColor(revision.status)}`}>
                                                            {getStatusIcon(revision.status)} {revision.status}
                                                        </span>
                                                    </div>

                                                    <div className="text-sm text-[var(--text-muted)] mb-1">
                                                        <strong>{revision.changedBy}</strong> • {new Date(revision.revisionDate).toLocaleDateString()}
                                                    </div>

                                                    <div className="text-sm text-[var(--text-secondary)]">
                                                        {revision.changeDescription}
                                                    </div>

                                                    {revision.affectedDoors && revision.affectedDoors.length > 0 && (
                                                        <div className="mt-2 text-xs text-[var(--text-muted)]">
                                                            Affected doors: {revision.affectedDoors.join(', ')}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Expand/Collapse Icon */}
                                                <button className="text-[var(--text-faint)] hover:text-[var(--text-muted)]">
                                                    {isExpanded ? '▼' : '▶'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="border-t border-[var(--border)] bg-[var(--bg-subtle)] p-4 space-y-4">
                                            {/* Review Comments */}
                                            {revision.reviewComments && (
                                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                                    <div className="flex items-start gap-2">
                                                        <span className="text-yellow-600 text-lg">💬</span>
                                                        <div className="flex-1">
                                                            <div className="text-sm font-semibold text-yellow-800 mb-1">
                                                                Review Comments
                                                            </div>
                                                            <div className="text-sm text-yellow-900">
                                                                {revision.reviewComments}
                                                            </div>
                                                            {revision.reviewedBy && (
                                                                <div className="text-xs text-yellow-700 mt-2">
                                                                    — {revision.reviewedBy} on {revision.reviewDate ? new Date(revision.reviewDate).toLocaleDateString() : 'N/A'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Actions */}
                                            <div className="flex gap-2">
                                                {revision.status === 'Draft' && (
                                                    <button
                                                        onClick={() => handleStatusChange(revision.revisionNumber, 'Submitted')}
                                                        className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700"
                                                    >
                                                        Submit for Review
                                                    </button>
                                                )}

                                                {revision.status === 'Submitted' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleAddComment(revision.revisionNumber)}
                                                            className="px-3 py-1.5 bg-yellow-600 text-white rounded text-sm font-medium hover:bg-yellow-700"
                                                        >
                                                            Add Review Comment
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusChange(revision.revisionNumber, 'Approved')}
                                                            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusChange(revision.revisionNumber, 'Rejected')}
                                                            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}

                                                {revision.status === 'Reviewed' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleStatusChange(revision.revisionNumber, 'Approved')}
                                                            className="px-3 py-1.5 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleStatusChange(revision.revisionNumber, 'Rejected')}
                                                            className="px-3 py-1.5 bg-red-600 text-white rounded text-sm font-medium hover:bg-red-700"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* New Revision Modal */}
            {showNewRevisionModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-[var(--bg)] rounded-lg shadow-xl max-w-2xl w-full mx-4">
                        <div className="p-6 border-b border-[var(--border)]">
                            <h3 className="text-xl font-bold text-[var(--text)]">Create New Revision</h3>
                            <p className="text-sm text-[var(--text-muted)] mt-1">
                                Rev {currentRevision + 1}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Changed By <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newRevisionData.changedBy}
                                    onChange={(e) => setNewRevisionData(prev => ({ ...prev, changedBy: e.target.value }))}
                                    className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                    placeholder="Your name"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Change Description <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={newRevisionData.changeDescription}
                                    onChange={(e) => setNewRevisionData(prev => ({ ...prev, changeDescription: e.target.value }))}
                                    rows={3}
                                    className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                    placeholder="Describe what changed in this revision..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Affected Doors (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={newRevisionData.affectedDoors.join(', ')}
                                    onChange={(e) => setNewRevisionData(prev => ({
                                        ...prev,
                                        affectedDoors: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                                    }))}
                                    className="w-full px-3 py-2 border border-[var(--border-strong)] rounded-lg bg-[var(--bg)] text-[var(--text)]"
                                    placeholder="e.g., 101, 102, 103"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-[var(--text-secondary)] mb-1">
                                    Initial Status
                                </label>
                                <Select
                                    value={newRevisionData.status}
                                    onValueChange={(v) => setNewRevisionData(prev => ({ ...prev, status: v as SubmittalStatus }))}
                                >
                                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Draft">Draft</SelectItem>
                                        <SelectItem value="Submitted">Submitted</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-6 border-t border-[var(--border)] flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowNewRevisionModal(false);
                                    setNewRevisionData({
                                        changedBy: '',
                                        changeDescription: '',
                                        affectedDoors: [],
                                        status: 'Draft'
                                    });
                                }}
                                className="px-4 py-2 border border-[var(--border-strong)] rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text)]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateRevision}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                            >
                                Create Revision
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RevisionHistory;
