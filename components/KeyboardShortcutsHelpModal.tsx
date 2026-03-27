import React from 'react';

interface ShortcutItem {
    keys: string[];
    description: string;
}

interface Section {
    title: string;
    shortcuts: ShortcutItem[];
}

const sections: Section[] = [
    {
        title: 'General',
        shortcuts: [
            { keys: ['?'], description: 'Show this help dialog' },
            { keys: ['Esc'], description: 'Close modal / Clear selection' },
        ]
    },
    {
        title: 'Hardware Sets',
        shortcuts: [
            { keys: ['Ctrl', 'A'], description: 'Select all hardware sets' },
            { keys: ['Ctrl', 'D'], description: 'Duplicate selected set (Create Variant)' },
            { keys: ['Ctrl', 'E'], description: 'Edit selected set' },
            { keys: ['Del'], description: 'Delete selected set(s)' },
        ]
    },
];

interface KeyboardShortcutsHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const KeyboardShortcutsHelpModal: React.FC<KeyboardShortcutsHelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex justify-center items-center p-4 animate-fadeIn"
            onClick={onClose}
            aria-modal="true"
            role="dialog"
        >
            <div
                className="bg-white rounded-lg shadow-xl w-full max-w-2xl animate-scaleIn"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        Keyboard Shortcuts
                    </h2>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-200"
                        aria-label="Close"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                    {sections.map(section => (
                        <div key={section.title}>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 border-b pb-2">{section.title}</h3>
                            <ul className="space-y-4">
                                {section.shortcuts.map(s => (
                                    <li key={s.description} className="flex justify-between items-center group">
                                        <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">{s.description}</span>
                                        <div className="flex gap-1.5">
                                            {s.keys.map(k => (
                                                <kbd key={k} className="px-2.5 py-1 bg-white border border-gray-200 border-b-2 rounded-lg text-xs font-bold text-gray-500 min-w-[28px] text-center shadow-sm font-sans">
                                                    {k}
                                                </kbd>
                                            ))}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
                <div className="p-4 bg-gray-50 rounded-b-lg border-t text-center text-xs text-gray-500">
                    Press
                    <kbd className="mx-1 px-1.5 py-0.5 bg-white border rounded text-gray-600 border-b-2 font-sans font-semibold">Esc</kbd>
                    to close this dialog
                </div>
            </div>
        </div>
    );
};

export default KeyboardShortcutsHelpModal;
