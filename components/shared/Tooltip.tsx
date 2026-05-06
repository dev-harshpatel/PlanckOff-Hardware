import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
    content: string;
    shortcut?: string;
    position?: 'top' | 'bottom' | 'left' | 'right';
    children: React.ReactNode;
    delay?: number;
}

const Tooltip: React.FC<TooltipProps> = ({
    content,
    shortcut,
    position = 'top',
    children,
    delay = 300
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
    const [actualPosition, setActualPosition] = useState(position);
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);
    const timeoutRef = useRef<NodeJS.Timeout>();

    const calculatePosition = () => {
        if (!triggerRef.current || !tooltipRef.current) return;

        const triggerRect = triggerRef.current.getBoundingClientRect();
        const tooltipRect = tooltipRef.current.getBoundingClientRect();
        const spacing = 8;

        let top = 0;
        let left = 0;
        let finalPosition = position;

        // Calculate initial position
        switch (position) {
            case 'top':
                top = triggerRect.top - tooltipRect.height - spacing;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'bottom':
                top = triggerRect.bottom + spacing;
                left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
                break;
            case 'left':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.left - tooltipRect.width - spacing;
                break;
            case 'right':
                top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
                left = triggerRect.right + spacing;
                break;
        }

        // Check viewport boundaries and adjust if needed
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Adjust horizontal position
        if (left < 0) {
            left = spacing;
        } else if (left + tooltipRect.width > viewportWidth) {
            left = viewportWidth - tooltipRect.width - spacing;
        }

        // Adjust vertical position and flip if needed
        if (top < 0 && (position === 'top' || position === 'bottom')) {
            // Flip to bottom if top doesn't fit
            top = triggerRect.bottom + spacing;
            finalPosition = 'bottom';
        } else if (top + tooltipRect.height > viewportHeight && (position === 'top' || position === 'bottom')) {
            // Flip to top if bottom doesn't fit
            top = triggerRect.top - tooltipRect.height - spacing;
            finalPosition = 'top';
        }

        setTooltipPosition({ top, left });
        setActualPosition(finalPosition);
    };

    const handleMouseEnter = () => {
        timeoutRef.current = setTimeout(() => {
            setIsVisible(true);
        }, delay);
    };

    const handleMouseLeave = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        setIsVisible(false);
    };

    useEffect(() => {
        if (isVisible) {
            calculatePosition();
        }
    }, [isVisible]);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const getArrowClasses = () => {
        const base = "absolute w-2 h-2 bg-gray-900 transform rotate-45";
        switch (actualPosition) {
            case 'top':
                return `${base} bottom-[-4px] left-1/2 -translate-x-1/2`;
            case 'bottom':
                return `${base} top-[-4px] left-1/2 -translate-x-1/2`;
            case 'left':
                return `${base} right-[-4px] top-1/2 -translate-y-1/2`;
            case 'right':
                return `${base} left-[-4px] top-1/2 -translate-y-1/2`;
            default:
                return base;
        }
    };

    return (
        <>
            <div
                ref={triggerRef}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onFocus={handleMouseEnter}
                onBlur={handleMouseLeave}
                className="inline-block"
            >
                {children}
            </div>

            {isVisible && createPortal(
                <div
                    ref={tooltipRef}
                    className="fixed z-[9999] pointer-events-none animate-fadeIn"
                    style={{
                        top: `${tooltipPosition.top}px`,
                        left: `${tooltipPosition.left}px`,
                    }}
                >
                    <div className="relative bg-gray-900 text-white text-sm rounded-lg shadow-xl px-3 py-2 max-w-xs">
                        <div className="flex items-center gap-2">
                            <span>{content}</span>
                            {shortcut && (
                                <kbd className="ml-auto px-2 py-0.5 text-xs font-mono bg-gray-800 border border-gray-700 rounded shadow-sm">
                                    {shortcut}
                                </kbd>
                            )}
                        </div>
                        <div className={getArrowClasses()} />
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default Tooltip;
