'use client';

import React from 'react';

interface ConfidenceIndicatorProps {
    confidence?: 'high' | 'medium' | 'low';
    reason?: string;
}

export function ConfidenceIndicator({ confidence }: ConfidenceIndicatorProps) {
    if (!confidence) return null;

    const config = {
        high:   { color: 'bg-green-500' },
        medium: { color: 'bg-yellow-400' },
        low:    { color: 'bg-red-500' },
    };

    const { color } = config[confidence];

    return <span className={`block w-2.5 h-2.5 rounded-full ${color}`} />;
}
