'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  /** Current page (1-based). */
  page: number;
  /** Number of rows per page. */
  pageSize: number;
  /** Total number of records across all pages. */
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

function buildPageNumbers(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (page > 3) pages.push('ellipsis');

  const start = Math.max(2, page - 1);
  const end   = Math.min(totalPages - 1, page + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (page < totalPages - 2) pages.push('ellipsis');

  pages.push(totalPages);
  return pages;
}

const navBtn = cn(
  'p-1.5 rounded-md transition-colors',
  'text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--bg-muted)]',
  'disabled:opacity-40 disabled:pointer-events-none',
);

export const Pagination: React.FC<PaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100],
  className,
}) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(page * pageSize, total);

  const pageNumbers = buildPageNumbers(page, totalPages);

  return (
    <div className={cn('flex items-center flex-wrap gap-3', className)}>
      {/* Record range info */}
      <span className="text-xs text-[var(--text-muted)] shrink-0">
        Showing{' '}
        <span className="font-medium text-[var(--text-secondary)]">{from}</span>
        {' – '}
        <span className="font-medium text-[var(--text-secondary)]">{to}</span>
        {' of '}
        <span className="font-medium text-[var(--text-secondary)]">{total}</span>
        {' items'}
      </span>

      <div className="flex items-center gap-1 ml-auto">
        {/* Page size selector */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={e => onPageSizeChange(Number(e.target.value))}
            className="mr-2 text-xs border border-[var(--border)] rounded-md px-2 py-1 bg-[var(--bg)] text-[var(--text-secondary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary-ring)] cursor-pointer"
          >
            {pageSizeOptions.map(s => (
              <option key={s} value={s}>{s} / page</option>
            ))}
          </select>
        )}

        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={page === 1}
          className={navBtn}
          aria-label="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Previous page */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className={navBtn}
          aria-label="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page number buttons */}
        {pageNumbers.map((p, i) =>
          p === 'ellipsis' ? (
            <span
              key={`ellipsis-${i}`}
              className="px-1 text-xs text-[var(--text-faint)] select-none"
            >
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
              className={cn(
                'min-w-[28px] h-7 px-1.5 rounded-md text-xs font-medium transition-colors',
                p === page
                  ? 'bg-[var(--primary-action)] text-white shadow-sm'
                  : 'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]',
              )}
            >
              {p}
            </button>
          ),
        )}

        {/* Next page */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className={navBtn}
          aria-label="Next page"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={page === totalPages}
          className={navBtn}
          aria-label="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
