
import React, { useState, useEffect } from 'react';
import { AppSettings, AIProvider, Project, Role } from '../types';
import { TrashIcon, LockClosedIcon } from './icons';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: AppSettings;
    onSave: (newSettings: AppSettings) => void;
    trashProjects?: Project[];
    onRestoreProject?: (id: string) => void;
    onPermanentDeleteProject?: (id: string) => void;
    userRole?: Role;
}

const GEMINI_MODELS = [
    { id: 'gemini-3.0-pro-001', name: 'Gemini 3.0 Pro (Latest SOTA)' },
    { id: 'gemini-3.0-flash-001', name: 'Gemini 3.0 Flash (Ultra Fast)' },
    { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro (Complex Tasks)' },
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Efficient)' },
];

const OPENROUTER_MODELS = [
    { id: 'openai/gpt-5', name: 'OpenAI: GPT-5 (Flagship)' },
    { id: 'anthropic/claude-4.5-sonnet', name: 'Anthropic: Claude 4.5 Sonnet' },
    { id: 'google/gemini-3.0-pro', name: 'Google: Gemini 3.0 Pro' },
    { id: 'deepseek/deepseek-r2', name: 'DeepSeek: R2 (Advanced Reasoning)' },
    { id: 'deepseek/deepseek-v3', name: 'DeepSeek: V3' },
    { id: 'google/gemini-2.0-flash-001', name: 'Google: Gemini 2.0 Flash' },
    { id: 'anthropic/claude-3.5-sonnet', name: 'Anthropic: Claude 3.5 Sonnet' },
    { id: 'openai/gpt-4o', name: 'OpenAI: GPT-4o' },
];

type Tab = 'general' | 'trash';

const SettingsModal: React.FC<SettingsModalProps> = ({
    isOpen,
    onClose,
    settings,
    onSave,
    trashProjects = [],
    onRestoreProject,
    onPermanentDeleteProject,
    userRole
}) => {
    const [localSettings, setLocalSettings] = useState<AppSettings>(settings);
    const [activeTab, setActiveTab] = useState<Tab>('general');

    useEffect(() => {
        if (isOpen) {
            setLocalSettings(settings);
            setActiveTab('general');
        }
    }, [isOpen, settings]);

    const handleProviderChange = (provider: AIProvider) => {
        // Reset model to default for that provider
        const defaultModel = provider === 'gemini' ? GEMINI_MODELS[0].id : OPENROUTER_MODELS[0].id;
        setLocalSettings(prev => ({ ...prev, provider, model: defaultModel }));
    };

    const handleSave = () => {
        onSave(localSettings);
        onClose();
    };

    const formatDate = (isoDate?: string) => {
        if (!isoDate) return 'N/A';
        return new Date(isoDate).toLocaleDateString();
    };

    const getDaysLeft = (isoDate?: string) => {
        if (!isoDate) return 0;
        const deletedDate = new Date(isoDate);
        const expiryDate = new Date(deletedDate.getTime() + (15 * 24 * 60 * 60 * 1000));
        const now = new Date();
        const diffTime = expiryDate.getTime() - now.getTime();
        return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    };

    // Determine access level
    const isAdmin = userRole === Role.Administrator;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b flex justify-between items-center flex-shrink-0">
                    <h2 className="text-2xl font-bold text-gray-800">Settings</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">&times;</button>
                </div>

                <div className="flex flex-grow overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-1/4 bg-gray-50 border-r border-gray-200 p-4 flex flex-col gap-2">
                        <button
                            onClick={() => setActiveTab('general')}
                            className={`text-left px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'general' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            General
                        </button>
                        <button
                            onClick={() => setActiveTab('trash')}
                            className={`text-left px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center justify-between ${activeTab === 'trash' ? 'bg-primary-100 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                                }`}
                        >
                            <span>Trash</span>
                            {trashProjects.length > 0 && (
                                <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{trashProjects.length}</span>
                            )}
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="w-3/4 p-6 overflow-y-auto">
                        {activeTab === 'general' && (
                            <div className="space-y-6">
                                {/* API SETTINGS: AVAILABLE TO ALL */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">AI Provider</label>
                                    <div className="flex rounded-md shadow-sm" role="group">
                                        <button
                                            type="button"
                                            onClick={() => handleProviderChange('gemini')}
                                            className={`px-4 py-2 text-sm font-medium rounded-l-lg border border-gray-200 flex-1 focus:z-10 focus:ring-2 focus:ring-primary-500 ${localSettings.provider === 'gemini'
                                                ? 'bg-primary-600 text-white border-primary-600'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            Gemini
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleProviderChange('openrouter')}
                                            className={`px-4 py-2 text-sm font-medium rounded-r-lg border border-gray-200 flex-1 focus:z-10 focus:ring-2 focus:ring-primary-500 ${localSettings.provider === 'openrouter'
                                                ? 'bg-primary-600 text-white border-primary-600'
                                                : 'bg-white text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            Open Router
                                        </button>
                                    </div>
                                </div>

                                {/* Model Selection */}
                                <div>
                                    <label htmlFor="modelSelect" className="block text-sm font-bold text-gray-700 mb-2">Model</label>
                                    <select
                                        id="modelSelect"
                                        value={localSettings.model}
                                        onChange={(e) => setLocalSettings({ ...localSettings, model: e.target.value })}
                                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm py-2"
                                    >
                                        {localSettings.provider === 'gemini' ? (
                                            GEMINI_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                        ) : (
                                            OPENROUTER_MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)
                                        )}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-500">
                                        {localSettings.provider === 'gemini'
                                            ? "Select the Gemini model version for processing."
                                            : "Choose a compatible model via Open Router."}
                                    </p>
                                </div>

                                {/* API Key Configuration */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">API Key</label>
                                    {localSettings.provider === 'gemini' ? (
                                        <div>
                                            <input
                                                type="password"
                                                placeholder="Enter Gemini API Key (Leave empty to use system default)"
                                                value={localSettings.geminiApiKey || ''}
                                                onChange={(e) => setLocalSettings({ ...localSettings, geminiApiKey: e.target.value })}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                            />
                                            <p className="mt-1 text-xs text-gray-500">
                                                Paste your custom Gemini API Key here to override the system default.
                                            </p>
                                        </div>
                                    ) : (
                                        <div>
                                            <input
                                                type="password"
                                                placeholder="Enter Open Router API Key"
                                                value={localSettings.openRouterKey || ''}
                                                onChange={(e) => setLocalSettings({ ...localSettings, openRouterKey: e.target.value })}
                                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'trash' && (
                            <div>
                                <h3 className="text-lg font-semibold text-gray-800 mb-2">Recycle Bin</h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Projects listed here will be permanently deleted after 15 days.
                                </p>

                                {trashProjects.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                        <TrashIcon className="w-10 h-10 mx-auto text-gray-300 mb-2" />
                                        <p className="text-gray-500">Trash is empty</p>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-300">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Project Name</th>
                                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Deleted On</th>
                                                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Expires In</th>
                                                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                                        <span className="sr-only">Actions</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-200 bg-white">
                                                {trashProjects.map((project) => (
                                                    <tr key={project.id}>
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">
                                                            {project.name}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {formatDate(project.deletedAt)}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-amber-600 font-medium">
                                                            {getDaysLeft(project.deletedAt)} days
                                                        </td>
                                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                            <button
                                                                onClick={() => onRestoreProject && onRestoreProject(project.id)}
                                                                className="text-primary-600 hover:text-primary-900 mr-4"
                                                            >
                                                                Restore
                                                            </button>
                                                            {isAdmin && ( // Only Admins can force delete immediately
                                                                <button
                                                                    onClick={() => {
                                                                        if (confirm('Are you sure you want to permanently delete this project? This cannot be undone.')) {
                                                                            onPermanentDeleteProject && onPermanentDeleteProject(project.id)
                                                                        }
                                                                    }}
                                                                    className="text-red-600 hover:text-red-900"
                                                                >
                                                                    Delete Forever
                                                                </button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 bg-gray-50 border-t flex justify-end gap-3 rounded-b-lg flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 text-sm font-semibold">
                        Close
                    </button>
                    {activeTab === 'general' && (
                        <button onClick={handleSave} className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 text-sm font-semibold">
                            Save Settings
                        </button>
                    )}
                </div>
            </div>
        </div >
    );
};

export default SettingsModal;
