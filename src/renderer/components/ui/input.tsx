import * as React from 'react';
import { cn } from '@/utils';
import { FieldShell, invalidControlClass } from '@/components/ui/field-error';

type InputProps = React.ComponentProps<'input'> & {
  invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, invalid, ...props }, ref) => (
    <FieldShell invalid={invalid}>
      <input
        type={type}
        aria-invalid={invalid || undefined}
        className={cn(
          'flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          invalidControlClass(invalid),
          className,
        )}
        ref={ref}
        {...props}
      />
    </FieldShell>
  ),
);
Input.displayName = 'Input';
