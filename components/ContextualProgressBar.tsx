import React from 'react';
import { useBackgroundUpload } from '../contexts/BackgroundUploadContext';
import { StopIcon, XCircleIcon } from './icons'; // Assuming these exist, effectively reusing from UploadProgressWidget

const ContextualProgressBar: React.FC<{ type: 'door-schedule' | 'hardware-set' }> = ({ type }) => {
    const { tasks, stopUpload, cancelUpload } = useBackgroundUpload();

    // Find the active task for this context
    // We prioritize 'processing', then 'pending'.
    const activeTask = tasks.find(t => t.type === type && (t.status === 'processing' || t.status === 'pending'));

    if (!activeTask) return null;

    const isProcessing = activeTask.status === 'processing';

    return (
        <div className="w-full bg-blue-50 border-b border-blue-100 p-3 flex items-center justify-between shadow-sm sticky top-0 z-20">
            <div className="flex-1 mr-4">
                <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-blue-900 flex items-center gap-2">
                        {isProcessing ? (
                            <svg className="animate-spin h-4 w-4 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        ) : (
                            <span className="h-4 w-4 block rounded-full border-2 border-gray-300"></span>
                        )}
                        {activeTask.file.name}
                    </span>
                    <span className="text-xs text-blue-700 font-mono">{activeTask.stage} ({Math.round(activeTask.progress)}%)</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${activeTask.progress}%` }}
                    ></div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {isProcessing && (
                    <button
                        onClick={() => stopUpload(activeTask.id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 rounded-md transition-colors"
                        title="Stop & Save (Finish Early)"
                    >
                        <StopIcon className="w-4 h-4" />
                        Stop
                    </button>
                )}
                <button
                    onClick={() => cancelUpload(activeTask.id)}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
                    title="Cancel Upload"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Cancel
                </button>
            </div>
        </div>
    );
};

export default ContextualProgressBar;
