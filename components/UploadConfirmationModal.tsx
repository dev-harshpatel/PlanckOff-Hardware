import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface UploadConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (mode: 'add' | 'overwrite') => void;
  files: File[];
  isLoading: boolean;
  title?: string;
  entityName?: string;
}

const UploadConfirmationModal: React.FC<UploadConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  files,
  isLoading,
  title = "Confirm Upload",
  entityName = "hardware sets"
}) => {
  const [mode, setMode] = useState<'add' | 'overwrite'>('add');
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const isConfirmDisabled = (mode === 'overwrite' && !confirmOverwrite) || isLoading;

  const handleOpenChange = (open: boolean) => {
    if (!isLoading && !open) onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-gray-100">
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* File list */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              File{files.length > 1 ? 's' : ''} to upload
            </p>
            <ul className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-1 max-h-28 overflow-y-auto">
              {files.map(file => (
                <li key={file.name} className="font-mono text-xs text-gray-700 truncate">{file.name}</li>
              ))}
            </ul>
          </div>

          {/* Mode selection */}
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              How to handle existing data
            </p>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setMode('add')}
                className={`w-full text-left p-3.5 border rounded-lg transition-colors ${
                  mode === 'add'
                    ? 'bg-primary-50 border-primary-400 ring-1 ring-primary-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${mode === 'add' ? 'border-primary-600' : 'border-gray-300'}`}>
                    {mode === 'add' && <div className="w-2 h-2 rounded-full bg-primary-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Add / Merge</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      New {entityName} will be added. Existing items with matching names will be updated.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode('overwrite')}
                className={`w-full text-left p-3.5 border rounded-lg transition-colors ${
                  mode === 'overwrite'
                    ? 'bg-red-50 border-red-400 ring-1 ring-red-300'
                    : 'bg-white border-gray-200 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-4 h-4 rounded-full border-2 mt-0.5 flex-shrink-0 flex items-center justify-center ${mode === 'overwrite' ? 'border-red-600' : 'border-gray-300'}`}>
                    {mode === 'overwrite' && <div className="w-2 h-2 rounded-full bg-red-600" />}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-red-900">Overwrite</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Deletes ALL existing {entityName} and replaces them with the uploaded file(s). Cannot be undone.
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Overwrite confirmation checkbox */}
          {mode === 'overwrite' && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-red-800 mb-2">Destructive Action</p>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      id="confirm-overwrite"
                      checked={confirmOverwrite}
                      onChange={(e) => setConfirmOverwrite(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-red-300 text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs text-red-700">
                      I understand this will permanently delete all current {entityName}.
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-xl">
          <Button variant="outline" onClick={onClose} disabled={isLoading} size="sm">
            Cancel
          </Button>
          <Button
            onClick={() => onConfirm(mode)}
            disabled={isConfirmDisabled}
            variant={mode === 'overwrite' ? 'destructive' : 'default'}
            size="sm"
            className="min-w-[120px]"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'overwrite' ? (
              'Overwrite'
            ) : (
              'Process File(s)'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UploadConfirmationModal;
