import React, { useState } from 'react';
import { InformationCircleIcon, ExclamationTriangleIcon } from './icons';

interface UploadConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'add' | 'overwrite') => void;
  files: File[];
  isLoading: boolean;
  title?: string;
  entityName?: string;
}

const LoadingSpinner: React.FC = () => (
  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);


const UploadConfirmationModal: React.FC<UploadConfirmationModalProps> = ({ isOpen, onClose, onConfirm, files, isLoading, title = "Confirm Upload", entityName = "hardware sets" }) => {
  const [mode, setMode] = useState<'add' | 'overwrite'>('add');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  if (!isOpen) return null;

  const isConfirmDisabled = (mode === 'overwrite' && !confirmOverwrite) || isLoading;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex justify-center items-center p-4 animate-fadeIn"
      onClick={isLoading ? undefined : onClose}
      aria-modal="true"
      role="dialog"
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg animate-scaleIn"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6 border-b">
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
        </div>
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          <div>
            <p className="text-sm text-gray-600 mb-2">You are about to upload the following file(s):</p>
            <ul className="text-sm list-disc list-inside bg-gray-50 p-3 rounded-md border max-h-32 overflow-y-auto">
              {files.map(file => (
                <li key={file.name} className="text-gray-800 truncate">{file.name}</li>
              ))}
            </ul>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">How should this data be handled?</label>
            <fieldset className="space-y-3">
              <div
                className={`relative p-4 border rounded-lg cursor-pointer ${mode === 'add' ? 'bg-primary-50 border-primary-400 ring-2 ring-primary-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                onClick={() => setMode('add')}
              >
                <div className="flex items-center">
                  <input type="radio" name="upload-mode" checked={mode === 'add'} readOnly className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-gray-900">Add / Merge</span>
                    <p className="text-gray-600">New {entityName} will be added. Existing items with matching IDs/names will be updated.</p>
                  </div>
                </div>
              </div>

              <div
                className={`relative p-4 border rounded-lg cursor-pointer ${mode === 'overwrite' ? 'bg-red-50 border-red-400 ring-2 ring-red-300' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                onClick={() => setMode('overwrite')}
              >
                <div className="flex items-center">
                  <input type="radio" name="upload-mode" checked={mode === 'overwrite'} readOnly className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                  <div className="ml-3 text-sm">
                    <span className="font-bold text-red-900">Overwrite</span>
                    <p className="text-red-700">Deletes ALL existing {entityName} and replaces them with the content of the uploaded file(s). This action cannot be undone.</p>
                  </div>
                </div>
              </div>
            </fieldset>
          </div>

          {mode === 'overwrite' && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-start">
                <div className="flex-shrink-0">
                  <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-bold text-red-800">Warning: Destructive Action</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <div className="relative flex items-start">
                      <div className="flex h-6 items-center">
                        <input
                          id="confirm-overwrite"
                          type="checkbox"
                          checked={confirmOverwrite}
                          onChange={(e) => setConfirmOverwrite(e.target.checked)}
                          className="h-4 w-4 rounded border-red-300 text-primary-600 focus:ring-primary-500"
                        />
                      </div>
                      <div className="ml-3 text-sm leading-6">
                        <label htmlFor="confirm-overwrite" className="font-medium">
                          I understand this will delete all current {entityName}.
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
        <div className="p-6 bg-gray-50 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-md hover:bg-gray-100 text-sm font-semibold disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(mode)}
            disabled={isConfirmDisabled}
            className={`w-40 flex justify-center px-6 py-2 text-white rounded-md text-sm font-semibold transition-colors
              ${isConfirmDisabled
                ? 'bg-gray-300 cursor-not-allowed'
                : mode === 'overwrite'
                  ? 'bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500'
                  : 'bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500'
              }
            `}
          >
            {isLoading ? <LoadingSpinner /> : (mode === 'overwrite' ? 'Overwrite Sets' : 'Process File(s)')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadConfirmationModal;