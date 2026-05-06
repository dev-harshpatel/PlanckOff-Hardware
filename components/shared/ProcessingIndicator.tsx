'use client';

import React from 'react';
import { FileText, Table2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

export interface ProcessingTask {
  id: string;
  fileName: string;
  type: 'hardware-pdf' | 'door-schedule' | 'combined';
  stage: string;        // e.g. "Extracting text (page 4/8)…"
  progress: number;     // 0–100
}

interface ProcessingIndicatorProps {
  tasks: ProcessingTask[];
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="absolute bottom-5 right-5 z-50 flex flex-col gap-2 animate-fadeIn">
      {tasks.map((task) => {
        const Icon = task.type === 'hardware-pdf' ? FileText : Table2;
        const isDone = task.progress === 100;
        return (
          <div
            key={task.id}
            className="bg-white border border-gray-200 shadow-lg rounded-xl w-72 overflow-hidden"
          >
            <div className="px-4 pt-3 pb-2 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{task.fileName}</p>
                <p className="text-xs text-primary-600 mt-0.5">{task.stage}</p>
              </div>
              {!isDone && (
                <svg className="animate-spin h-4 w-4 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              )}
            </div>
            <div className="px-4 pb-3">
              <Progress value={task.progress} className="h-1.5" />
              <p className="text-right text-[10px] text-gray-400 mt-1">{task.progress}%</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProcessingIndicator;
