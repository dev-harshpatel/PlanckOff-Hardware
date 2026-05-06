import React from 'react';

interface SkeletonLoaderProps {
    variant?: 'table' | 'card' | 'text';
    rows?: number;
    columns?: number;
    className?: string;
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    variant = 'table',
    rows = 5,
    columns = 5,
    className = ''
}) => {
    if (variant === 'table') {
        return (
            <div className={`w-full ${className}`}>
                {/* Table Header Skeleton */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-gray-200">
                    <div className="grid gap-4 p-3" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
                        {Array.from({ length: columns }).map((_, i) => (
                            <div key={`header-${i}`} className="h-4 bg-gray-300 rounded animate-shimmer" />
                        ))}
                    </div>
                </div>

                {/* Table Body Skeleton */}
                <div className="divide-y divide-gray-200">
                    {Array.from({ length: rows }).map((_, rowIndex) => (
                        <div
                            key={`row-${rowIndex}`}
                            className="grid gap-4 p-3 hover:bg-gray-50 transition-colors"
                            style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                        >
                            {Array.from({ length: columns }).map((_, colIndex) => (
                                <div
                                    key={`cell-${rowIndex}-${colIndex}`}
                                    className="h-4 bg-gray-200 rounded animate-shimmer"
                                    style={{
                                        animationDelay: `${(rowIndex * columns + colIndex) * 0.05}s`,
                                        width: colIndex === 0 ? '60%' : '100%' // First column narrower for checkbox
                                    }}
                                />
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    if (variant === 'card') {
        return (
            <div className={`grid gap-4 ${className}`}>
                {Array.from({ length: rows }).map((_, index) => (
                    <div
                        key={`card-${index}`}
                        className="bg-white rounded-lg shadow-md p-6 space-y-3"
                    >
                        <div className="h-6 bg-gray-300 rounded w-3/4 animate-shimmer" />
                        <div className="h-4 bg-gray-200 rounded w-full animate-shimmer" style={{ animationDelay: '0.1s' }} />
                        <div className="h-4 bg-gray-200 rounded w-5/6 animate-shimmer" style={{ animationDelay: '0.2s' }} />
                        <div className="flex gap-2 mt-4">
                            <div className="h-8 bg-gray-300 rounded w-20 animate-shimmer" style={{ animationDelay: '0.3s' }} />
                            <div className="h-8 bg-gray-300 rounded w-20 animate-shimmer" style={{ animationDelay: '0.4s' }} />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Text variant
    return (
        <div className={`space-y-2 ${className}`}>
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={`text-${index}`}
                    className="h-4 bg-gray-200 rounded animate-shimmer"
                    style={{
                        width: `${Math.random() * 30 + 70}%`,
                        animationDelay: `${index * 0.1}s`
                    }}
                />
            ))}
        </div>
    );
};

// Specialized component for table rows
export const TableRowSkeleton: React.FC<{ columns: number }> = ({ columns }) => (
    <tr className="border-b">
        {Array.from({ length: columns }).map((_, index) => (
            <td key={`skeleton-cell-${index}`} className="p-3">
                <div
                    className="h-4 bg-gray-200 rounded animate-shimmer"
                    style={{
                        animationDelay: `${index * 0.05}s`,
                        width: index === 0 ? '40px' : '100%'
                    }}
                />
            </td>
        ))}
    </tr>
);

// Specialized component for expanded row content
export const ExpandedRowSkeleton: React.FC = () => (
    <tr className="bg-gray-50">
        <td colSpan={5} className="p-6">
            <div className="space-y-4">
                {/* Tab headers skeleton */}
                <div className="flex gap-4 border-b pb-2">
                    <div className="h-8 w-32 bg-gray-300 rounded animate-shimmer" />
                    <div className="h-8 w-32 bg-gray-200 rounded animate-shimmer" style={{ animationDelay: '0.1s' }} />
                    <div className="h-8 w-32 bg-gray-200 rounded animate-shimmer" style={{ animationDelay: '0.2s' }} />
                </div>

                {/* Content skeleton */}
                <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={`content-${index}`} className="flex gap-4">
                            <div className="h-4 w-12 bg-gray-300 rounded animate-shimmer" style={{ animationDelay: `${index * 0.1}s` }} />
                            <div className="h-4 flex-1 bg-gray-200 rounded animate-shimmer" style={{ animationDelay: `${index * 0.1 + 0.05}s` }} />
                            <div className="h-4 w-24 bg-gray-200 rounded animate-shimmer" style={{ animationDelay: `${index * 0.1 + 0.1}s` }} />
                        </div>
                    ))}
                </div>
            </div>
        </td>
    </tr>
);

export default SkeletonLoader;
