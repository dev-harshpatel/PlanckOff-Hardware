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
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-4 border-b flex justify-between items-center bg-red-50 rounded-t-lg">
                    <h2 className="text-lg font-bold text-red-800 flex items-center gap-2">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        {title}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    <p className="text-sm text-gray-600 mb-4">
                        The following items were skipped or flagged during processing:
                    </p>
                    <ul className="space-y-2">
                        {errors.map((err, idx) => (
                            <li key={idx} className="bg-red-50 text-red-700 text-sm p-2 rounded border border-red-100 font-mono">
                                • {err}
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="p-4 border-t bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-gray-300 rounded text-sm text-gray-700 hover:bg-gray-100"
                    >
                        Dismiss
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ErrorModal;
