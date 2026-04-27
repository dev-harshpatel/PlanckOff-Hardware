'use client';

import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';

export interface ProcessingLogEntry {
  level: 'info' | 'success' | 'warn' | 'error';
  msg: string;
}

export interface ProcessingWidgetState {
  isActive: boolean;
  isMinimized: boolean;
  isProcessing: boolean;
  progress: number;
  step: string;
  elapsedSeconds: number;
  projectId: string | null;
  projectPath: string | null; // e.g. /project/abc-123
  logs: ProcessingLogEntry[];
}

interface ProcessingWidgetContextType {
  widget: ProcessingWidgetState;
  setWidget: (patch: Partial<ProcessingWidgetState>) => void;
  clearWidget: () => void;
  // ProjectView registers a handler so clicking the widget can expand the modal
  // when already on the correct project page.
  registerExpandHandler: (fn: () => void) => void;
  unregisterExpandHandler: () => void;
  expandModal: () => void;
}

const DEFAULT: ProcessingWidgetState = {
  isActive: false,
  isMinimized: false,
  isProcessing: false,
  progress: 0,
  step: '',
  elapsedSeconds: 0,
  projectId: null,
  projectPath: null,
  logs: [],
};

const ProcessingWidgetContext = createContext<ProcessingWidgetContextType | null>(null);

export function ProcessingWidgetProvider({ children }: { children: React.ReactNode }) {
  const [widget, setWidgetState] = useState<ProcessingWidgetState>(DEFAULT);
  const expandHandlerRef = useRef<(() => void) | null>(null);

  const setWidget = useCallback((patch: Partial<ProcessingWidgetState>) => {
    setWidgetState(prev => ({ ...prev, ...patch }));
  }, []);

  const clearWidget = useCallback(() => {
    setWidgetState(DEFAULT);
  }, []);

  const registerExpandHandler = useCallback((fn: () => void) => {
    expandHandlerRef.current = fn;
  }, []);

  const unregisterExpandHandler = useCallback(() => {
    expandHandlerRef.current = null;
  }, []);

  const expandModal = useCallback(() => {
    expandHandlerRef.current?.();
  }, []);

  // Keep elapsedSeconds ticking while processing — survives navigation
  useEffect(() => {
    if (!widget.isProcessing) return;
    const id = setInterval(() => {
      setWidgetState(prev => ({ ...prev, elapsedSeconds: prev.elapsedSeconds + 1 }));
    }, 1000);
    return () => clearInterval(id);
  }, [widget.isProcessing]);

  return (
    <ProcessingWidgetContext.Provider value={{
      widget, setWidget, clearWidget,
      registerExpandHandler, unregisterExpandHandler, expandModal,
    }}>
      {children}
    </ProcessingWidgetContext.Provider>
  );
}

export function useProcessingWidget() {
  const ctx = useContext(ProcessingWidgetContext);
  if (!ctx) throw new Error('useProcessingWidget must be used within ProcessingWidgetProvider');
  return ctx;
}
