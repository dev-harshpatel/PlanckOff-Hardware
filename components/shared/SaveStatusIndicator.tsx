'use client';

import React from 'react';
import { Loader2, Check, AlertCircle } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function SaveStatusIndicator({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
    switch (status) {
        case 'saving':
            return (
                <div className="flex items-center gap-1.5 text-xs text-[var(--text-faint)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Saving…
                </div>
            );
        case 'saved':
            return (
                <div className="flex items-center gap-1.5 text-xs text-green-600">
                    <Check className="h-3.5 w-3.5" />
                    Saved
                </div>
            );
        case 'error':
            return (
                <div className="flex items-center gap-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Save failed
                    <button onClick={onRetry} className="underline hover:text-red-800 ml-1">Retry</button>
                </div>
            );
        default:
            return <div className="h-5" />;
    }
}
