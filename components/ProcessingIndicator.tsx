'use client';

import React from 'react';
import { DocumentChartBarIcon, TableCellsIcon } from './icons';

export interface ProcessingTask {
  id: string;
  fileName: string;
  type: 'hardware-pdf' | 'door-schedule';
  stage: string;        // e.g. "Extracting text (page 4/8)…"
  progress: number;     // 0–100
}

interface ProcessingIndicatorProps {
  tasks: ProcessingTask[];
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({ tasks }) => {
  if (tasks.length === 0) return null;

  return (
    <div className="absolute bottom-6 right-6 z-50 flex flex-col gap-2 animate-fadeIn">
      {tasks.map((task) => {
        const Icon = task.type === 'hardware-pdf' ? DocumentChartBarIcon : TableCellsIcon;
        return (
          <div
            key={task.id}
            className="bg-white/95 backdrop-blur-lg border border-gray-200 shadow-2xl rounded-xl w-80 overflow-hidden ring-1 ring-black/5"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{task.fileName}</p>
                <p className="text-xs text-blue-600 font-medium">{task.stage}</p>
              </div>
              {/* Spinner */}
              <svg className="animate-spin h-4 w-4 text-blue-500 flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            {/* Progress bar */}
            <div className="h-1.5 w-full bg-gray-100">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ProcessingIndicator;
