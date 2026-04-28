
import React, { useState, useRef, useEffect } from 'react';
import { analyzeImageWithAI } from '../services/geminiService';
import { AppSettings, Toast } from '../types';
import { CameraIcon, ArrowUpTrayIcon, XCircleIcon } from './icons';

interface ImageAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  appSettings: AppSettings;
  addToast: (toast: Omit<Toast, 'id'>) => void;
}

import { Spinner } from '@/components/ui/spinner';

const ImageAnalysisModal: React.FC<ImageAnalysisModalProps> = ({ isOpen, onClose, appSettings, addToast }) => {
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [prompt, setPrompt] = useState('Analyze this image and identify any door hardware, schedules, or architectural details. Please list them clearly.');
    const [analysisResult, setAnalysisResult] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) {
            // Reset state on close
            setSelectedImage(null);
            setPreviewUrl(null);
            setAnalysisResult('');
            setPrompt('Analyze this image and identify any door hardware, schedules, or architectural details. Please list them clearly.');
        }
    }, [isOpen]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setAnalysisResult('');
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file && file.type.startsWith('image/')) {
            setSelectedImage(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            setAnalysisResult('');
        }
    };

    const handleAnalyze = async () => {
        if (!selectedImage) return;

        setIsLoading(true);
        try {
            const result = await analyzeImageWithAI(selectedImage, prompt, appSettings.geminiApiKey);
            setAnalysisResult(result);
        } catch (error: any) {
            console.error("Analysis failed", error);
            addToast({ 
                type: 'error', 
                message: 'Analysis Failed', 
                details: error.message || 'Could not analyze the image.' 
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                    <div className="flex items-center gap-2">
                        <CameraIcon className="w-6 h-6 text-primary-600" />
                        <h2 className="text-lg font-bold text-gray-800">AI Image Analysis</h2>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <XCircleIcon className="w-6 h-6" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-grow flex flex-col md:flex-row overflow-hidden">
                    
                    {/* Left Panel: Input & Preview */}
                    <div className="w-full md:w-1/2 p-6 border-b md:border-b-0 md:border-r border-gray-200 flex flex-col overflow-y-auto">
                        
                        <div 
                            className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer min-h-[200px]"
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                        >
                            {previewUrl ? (
                                <img src={previewUrl} alt="Preview" className="max-h-64 object-contain rounded-md shadow-sm" />
                            ) : (
                                <>
                                    <ArrowUpTrayIcon className="w-10 h-10 text-gray-400 mb-3" />
                                    <p className="text-sm font-medium text-gray-600">Click to upload or drag and drop</p>
                                    <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP supported</p>
                                </>
                            )}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleImageSelect} 
                            />
                        </div>

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Prompt</label>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md text-sm focus:ring-primary-500 focus:border-primary-500"
                                rows={3}
                                placeholder="Ask Gemini something about the image..."
                            />
                        </div>

                        <button
                            onClick={handleAnalyze}
                            disabled={!selectedImage || isLoading}
                            className="mt-4 w-full bg-primary-600 text-white py-2 px-4 rounded-md font-semibold hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 shadow-sm"
                        >
                            {isLoading ? (
                                <>
                                    <Spinner size="md" className="text-white" />
                                    Analyzing...
                                </>
                            ) : (
                                <>
                                    <CameraIcon className="w-4 h-4" />
                                    Analyze Image
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right Panel: Results */}
                    <div className="w-full md:w-1/2 p-6 bg-gray-50 flex flex-col overflow-hidden">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-2">Analysis Result</h3>
                        <div className="flex-grow bg-white border border-gray-200 rounded-lg p-4 overflow-y-auto shadow-inner">
                            {isLoading ? (
                                <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                    <div className="animate-pulse flex flex-col items-center">
                                        <div className="h-2 bg-gray-200 rounded w-3/4 mb-2"></div>
                                        <div className="h-2 bg-gray-200 rounded w-1/2 mb-2"></div>
                                        <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                                    </div>
                                    <span className="mt-4 text-xs">Gemini 3 Pro is analyzing your image...</span>
                                </div>
                            ) : analysisResult ? (
                                <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap">
                                    {analysisResult}
                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                                    Result will appear here after analysis.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ImageAnalysisModal;
