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
            className="flex h-full w-full overflow-hidden"
        >
            {/* Left Panel */}
            <div
                className="overflow-auto"
                style={{ width: `${splitRatio}%` }}
            >
                {leftPanel}
            </div>

            {/* Draggable Divider */}
            <div
                className={`
          relative flex-shrink-0 w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize
          transition-colors group
          ${isDragging ? 'bg-blue-500' : ''}
        `}
                onMouseDown={handleMouseDown}
                onTouchStart={handleMouseDown}
                onKeyDown={handleKeyDown}
                tabIndex={0}
                role="separator"
                aria-label="Resize panels"
                aria-valuenow={splitRatio}
                aria-valuemin={minLeftWidth}
                aria-valuemax={maxLeftWidth}
            >
                {/* Visual indicator */}
                <div className="absolute inset-y-0 -left-1 -right-1 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-1 h-12 bg-blue-500 rounded-full shadow-lg" />
                </div>

                {/* Touch-friendly hit area */}
                <div className="absolute inset-y-0 -left-2 -right-2" />
            </div>

            {/* Right Panel */}
            <div
                className="overflow-auto"
                style={{ width: `${100 - splitRatio}%` }}
            >
                {rightPanel}
            </div>
        </div>
    );
};

export default ResizablePanels;
