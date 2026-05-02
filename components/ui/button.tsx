'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary-ring)] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-[var(--bg)]',
  {
    variants: {
      variant: {
        default:     'bg-[var(--primary-action)] text-white hover:bg-[var(--primary-action-hover)] shadow-sm',
        destructive: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
        outline:     'border border-[var(--border-strong)] bg-[var(--bg)] text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text)]',
        secondary:   'bg-[var(--bg-muted)] text-[var(--text-secondary)] hover:bg-[var(--bg-emphasis)]',
        ghost:       'text-[var(--text-muted)] hover:bg-[var(--bg-muted)] hover:text-[var(--text)]',
        link:        'text-[var(--primary-text)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm:      'h-8 rounded-md px-3 text-xs',
        lg:      'h-10 rounded-md px-6',
        icon:    'h-9 w-9',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, loadingText, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    const spinnerSize = size === 'icon' ? 'sm' : size === 'lg' ? 'sm' : size === 'sm' ? 'xs' : 'sm';

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <>
            <Spinner size={spinnerSize} className="text-current" />
            {size !== 'icon' && (loadingText ?? children)}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
