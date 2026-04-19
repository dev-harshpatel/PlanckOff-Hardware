import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary-ring)] focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'bg-[var(--primary-bg)] text-[var(--primary-text)]',
        secondary:   'bg-[var(--bg-muted)] text-[var(--text-muted)]',
        success:     'bg-[var(--success-bg)] text-[var(--success-text)] border border-[var(--success-border)]',
        warning:     'bg-[var(--warning-bg)] text-[var(--warning-text)] border border-[var(--warning-border)]',
        destructive: 'bg-[var(--error-bg)] text-[var(--error-text)] border border-[var(--error-border)]',
        outline:     'border border-[var(--border-strong)] text-[var(--text-secondary)] bg-[var(--bg)]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
