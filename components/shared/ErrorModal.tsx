import React from 'react';

interface ErrorModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    errors: string[];
}

const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, onClose, title = "Upload Warnings", errors }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-[var(--bg)] border border-[var(--border)] rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg-muted)] rounded-t-lg">
                    <h2 className="text-base font-semibold text-[var(--text)] flex items-center gap-2">
                        <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text)] transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-5 overflow-y-auto flex-1">
                    <p className="text-xs text-[var(--text-muted)] mb-3">
                        The following items were skipped or flagged during processing:
                    </p>
                    <ul className="space-y-1.5">
                        {errors.map((err, idx) => (
                            <li key={idx} className="bg-amber-500/10 text-amber-700 dark:text-amber-400 text-xs p-2 rounded border border-amber-500/20 font-mono">
                                • {err}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-muted)] rounded-b-lg flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-[var(--bg)] border border-[var(--border)] rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] transition-colors"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;
