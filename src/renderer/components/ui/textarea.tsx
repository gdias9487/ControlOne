import * as React from 'react';
import { cn } from '@/utils';
import { FieldShell, invalidControlClass } from '@/components/ui/field-error';

type TextareaProps = React.ComponentProps<'textarea'> & {
  invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => (
    <FieldShell invalid={invalid}>
      <textarea
        aria-invalid={invalid || undefined}
        className={cn(
          'flex min-h-[90px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          invalidControlClass(invalid),
          className,
        )}
        ref={ref}
        {...props}
      />
    </FieldShell>
  ),
);
Textarea.displayName = 'Textarea';
