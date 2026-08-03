import * as React from 'react';
import { cn } from '@/utils';

export function Badge({
  className,
  variant = 'default',
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'success' | 'warning' | 'muted' | 'destructive';
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variant === 'default' && 'bg-secondary text-secondary-foreground',
        variant === 'success' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
        variant === 'warning' && 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
        variant === 'muted' && 'bg-muted text-muted-foreground',
        variant === 'destructive' && 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
        className,
      )}
      {...props}
    />
  );
}
