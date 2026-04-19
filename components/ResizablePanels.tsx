import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ResizablePanelsProps {
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    defaultSplit?: number; // 0-100, default 60
    minLeftWidth?: number; // default 40
    maxLeftWidth?: number; // default 80
    onSplitChange?: (ratio: number) => void;
    storageKey?: string; // localStorage key to persist split ratio
}

const ResizablePanels: React.FC<ResizablePanelsProps> = ({
    leftPanel,
    rightPanel,
    defaultSplit = 60,
    minLeftWidth = 40,
    maxLeftWidth = 80,
    onSplitChange,
    storageKey = 'resizable-panels-split'
}) => {
    // Load saved split ratio from localStorage
    const getSavedSplit = (): number => {
        if (typeof window === 'undefined') return defaultSplit;
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            const parsed = parseFloat(saved);
            if (!isNaN(parsed) && parsed >= minLeftWidth && parsed <= maxLeftWidth) {
                return parsed;
            }
        }
        return defaultSplit;
    };

    const [splitRatio, setSplitRatio] = useState<number>(getSavedSplit());
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Save split ratio to localStorage
    useEffect(() => {
        localStorage.setItem(storageKey, splitRatio.toString());
        onSplitChange?.(splitRatio);
    }, [splitRatio, storageKey, onSplitChange]);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        // Clamp between min and max
        const clampedRatio = Math.max(minLeftWidth, Math.min(maxLeftWidth, newRatio));
        setSplitRatio(clampedRatio);
    }, [isDragging, minLeftWidth, maxLeftWidth]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!isDragging || !containerRef.current) return;

        const touch = e.touches[0];
        const containerRect = containerRef.current.getBoundingClientRect();
        const newRatio = ((touch.clientX - containerRect.left) / containerRect.width) * 100;

        const clampedRatio = Math.max(minLeftWidth, Math.min(maxLeftWidth, newRatio));
        setSplitRatio(clampedRatio);
    }, [isDragging, minLeftWidth, maxLeftWidth]);

    // Keyboard navigation
    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            setSplitRatio(prev => Math.max(minLeftWidth, prev - 1));
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            setSplitRatio(prev => Math.min(maxLeftWidth, prev + 1));
        }
    }, [minLeftWidth, maxLeftWidth]);

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.addEventListener('touchmove', handleTouchMove);
            document.addEventListener('touchend', handleMouseUp);

            // Prevent text selection while dragging
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'col-resize';
        } else {
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleMouseUp);
            document.body.style.userSelect = '';
            document.body.style.cursor = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove]);

    return (
        <div
            ref={containerRef}
            className="flex h-full min-h-0 w-full overflow-hidden"
        >
            {/* Left Panel */}
            <div
                className="h-full min-h-0 min-w-0 overflow-hidden"
                style={{ width: `${splitRatio}%` }}
            >
                {leftPanel}
            </div>

            {/* Draggable Divider */}
            <div
                className={`relative flex-shrink-0 w-px cursor-col-resize transition-colors group ${isDragging ? 'bg-[var(--primary-ring)]' : 'bg-[var(--border)] hover:bg-[var(--primary-ring)]'}`}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown as unknown as React.TouchEventHandler<HTMLDivElement>}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="separator"
                aria-label="Resize panels"
                aria-valuenow={splitRatio}
                aria-valuemin={minLeftWidth}
                aria-valuemax={maxLeftWidth}
            >
                {/* Drag handle pill */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    {[0,1,2,3,4].map(i => (
                        <div key={i} className="w-0.5 h-0.5 rounded-full bg-[var(--primary-ring)]" />
                    ))}
                </div>

                {/* Touch-friendly hit area */}
                <div className="absolute inset-y-0 -left-2 -right-2" />
            </div>

            {/* Right Panel */}
            <div
                className="h-full min-h-0 min-w-0 overflow-hidden"
                style={{ width: `${100 - splitRatio}%` }}
            >
                {rightPanel}
            </div>
        </div>
    );
};

export default ResizablePanels;
