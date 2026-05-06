import React, { useState } from 'react';
import { useBackgroundUpload } from '../../contexts/BackgroundUploadContext';
import {
    ArrowPathIcon,
    XCircleIcon,
    CheckCircleIcon,
    ExclamationTriangleIcon,
    TableCellsIcon,
    DocumentChartBarIcon,
    TrashIcon,
    StopIcon
} from '../shared/icons';

const UploadProgressWidget: React.FC = () => {
    const { tasks, cancelUpload, stopUpload, clearCompleted } = useBackgroundUpload();
    const [isExpanded, setIsExpanded] = useState(true);



    if (tasks.length === 0) return null;

    const activeCount = tasks.filter(t => t.status === 'processing' || t.status === 'pending').length;
    const errorCount = tasks.filter(t => t.status === 'error').length;
    const completedCount = tasks.filter(t => t.status === 'completed').length;

    // Collapsed State (Pill)
    if (!isExpanded) {
        return (
            <div
                className="absolute bottom-6 right-6 z-50 cursor-pointer animate-fadeIn"
                onClick={() => setIsExpanded(true)}
            >
                <div className="bg-[var(--bg)]/90 backdrop-blur-md border border-[var(--border)]/50 shadow-lg rounded-full px-4 py-2 flex items-center gap-3 hover:scale-105 transition-transform duration-200 ring-1 ring-black/5">
                    {activeCount > 0 ? (
                        <div className="relative">
                            <ArrowPathIcon className="w-5 h-5 text-blue-600 animate-spin" />
                            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                            </span>
                        </div>
                    ) : errorCount > 0 ? (
                        <ExclamationTriangleIcon className="w-5 h-5 text-amber-500" />
                    ) : (
                        <CheckCircleIcon className="w-5 h-5 text-green-500" />
                    )}

                    <div className="flex flex-col leading-none">
                        <span className="text-xs font-bold text-[var(--text-secondary)]">
                            {activeCount > 0 ? 'Uploading...' : 'Uploads'}
                        </span>
                        <span className="text-[10px] text-[var(--text-muted)]">
                            {activeCount} active • {completedCount} done
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Expanded State (Card)
    return (
        <div className="absolute bottom-6 right-6 z-50 flex flex-col items-end animate-slideUp">
            {/* Header / Controls */}
            <div className="bg-[var(--bg)]/95 backdrop-blur-lg border border-[var(--border)]/60 shadow-2xl rounded-xl w-96 overflow-hidden ring-1 ring-black/5">
                <div className="px-4 py-3 bg-[var(--bg-subtle)]/80 border-b border-[var(--border-subtle)] flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-[var(--text-secondary)] tracking-tight">Activity</h3>
                        {activeCount > 0 && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded-full font-bold">
                                {activeCount} RUNNING
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {(completedCount > 0 || errorCount > 0) && (
                            <button
                                onClick={clearCompleted}
                                className="text-[10px] font-medium text-[var(--text-faint)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-muted)] px-2 py-1 rounded transition-colors flex items-center gap-1"
                                title="Clear completed tasks"
                            >
                                <TrashIcon className="w-3 h-3" />
                                Clear Done
                            </button>
                        )}
                        <button
                            onClick={() => setIsExpanded(false)}
                            className="p-1 text-[var(--text-faint)] hover:text-[var(--text-muted)] hover:bg-[var(--bg-muted)] rounded-md transition-colors"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Task List */}
                <div className="max-h-[400px] overflow-y-auto custom-scrollbar bg-[var(--bg)]/50">
                    {tasks.length === 0 ? (
                        <div className="p-8 text-center">
                            <p className="text-sm text-[var(--text-faint)] font-medium">No activity yet</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-[var(--border-subtle)]">
                            {tasks.slice().reverse().map(task => {
                                const isHardware = task.type === 'hardware-set';
                                const Icon = isHardware ? DocumentChartBarIcon : TableCellsIcon;

                                return (
                                    <div key={task.id} className="p-4 hover:bg-blue-50/20 transition-colors group relative">

                                        {/* Row Top: Icon + Name + Controls */}
                                        <div className="flex gap-3 mb-2">
                                            {/* File Icon */}
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${task.status === 'error' ? 'bg-red-50 text-red-500' :
                                                task.status === 'completed' ? 'bg-green-50 text-green-500' :
                                                    'bg-blue-50 text-blue-500'
                                                }`}>
                                                <Icon className="w-4 h-4" />
                                            </div>

                                            {/* Content */}
                                            <div className="flex-grow min-w-0">
                                                <div className="flex justify-between items-start">
                                                    <h4 className="text-sm font-medium text-[var(--text)] truncate pr-6" title={task.file.name}>
                                                        {task.file.name}
                                                    </h4>
                                                </div>

                                                {/* Status / Error Message */}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    {task.status === 'error' ? (
                                                        <span className="text-xs text-red-600 font-medium flex items-center gap-1">
                                                            <ExclamationTriangleIcon className="w-3 h-3" />
                                                            {task.error || 'Failed'}
                                                        </span>
                                                    ) : task.status === 'completed' ? (
                                                        <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                                                            <CheckCircleIcon className="w-3 h-3" />
                                                            Completed
                                                        </span>
                                                    ) : (
                                                        <span className="text-xs text-blue-600 font-medium">
                                                            {task.stage}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Floating Actions (Visible on Hover/Processing) */}
                                            <div className={`absolute top-3 right-3 flex items-center gap-1 transition-opacity ${task.status === 'processing' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                                                }`}>
                                                {task.status === 'processing' && (
                                                    <button
                                                        onClick={() => stopUpload(task.id)}
                                                        className="p-1 text-[var(--text-faint)] hover:text-amber-600 bg-[var(--bg)]/80 rounded shadow-sm border border-[var(--border-subtle)] hover:border-amber-200 transition-all transform hover:scale-105"
                                                        title="Stop Early (Save partial)"
                                                    >
                                                        <StopIcon className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => cancelUpload(task.id)}
                                                    className="p-1 text-[var(--text-faint)] hover:text-red-500 bg-[var(--bg)]/80 rounded shadow-sm border border-[var(--border-subtle)] hover:border-red-200 transition-all transform hover:scale-105"
                                                    title="Remove"
                                                >
                                                    <XCircleIcon className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Progress Bar (Processing) */}
                                        {task.status === 'processing' && (
                                            <div className="mt-2 h-1.5 w-full bg-[var(--bg-muted)] rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-300 relative"
                                                    style={{ width: `${task.progress}%` }}
                                                >
                                                    <div className="absolute inset-0 bg-white/30 animate-[shimmer_1.5s_infinite]"></div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Result Summary (Completed) */}
                                        {task.status === 'completed' && task.result && (
                                            <div className="mt-2 bg-[var(--bg-subtle)]/50 rounded-md p-2 flex items-center justify-between text-[10px] text-[var(--text-muted)] border border-[var(--border-subtle)]">
                                                <div className="flex gap-3">
                                                    <span className="font-medium text-[var(--text-secondary)]">{task.result.summary.totalProcessed} Rows</span>
                                                    <span className="text-green-600 font-medium">
                                                        {task.result.summary.validCount} Valid
                                                    </span>
                                                </div>
                                                {(task.result.summary.errorCount > 0 || task.result.summary.warningCount > 0) && (
                                                    <span className="flex items-center gap-1 text-amber-600 font-bold bg-amber-50 px-1.5 py-0.5 rounded">
                                                        <ExclamationTriangleIcon className="w-3 h-3" />
                                                        {task.result.summary.errorCount + task.result.summary.warningCount} Issues
                                                    </span>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UploadProgressWidget;
