import type { ReactNode } from 'react';
import { cn } from '@/utils';

export const REQUIRED_FIELD_MESSAGE = 'Campo Obrigatório';

export function invalidControlClass(invalid?: boolean): string | undefined {
  return invalid
    ? 'border-destructive focus-visible:ring-destructive focus:ring-destructive'
    : undefined;
}

export function FieldErrorTip({ show }: { show?: boolean }) {
  if (!show) return null;
  return (
    <span
      role="tooltip"
      className="pointer-events-none absolute left-0 top-[calc(100%+6px)] z-40 inline-flex items-center rounded-md bg-destructive px-2 py-1 text-[11px] font-medium leading-none text-destructive-foreground shadow-md"
    >
      <span className="absolute -top-1 left-3 h-2 w-2 rotate-45 bg-destructive" />
      {REQUIRED_FIELD_MESSAGE}
    </span>
  );
}

export function FieldShell({
  invalid,
  className,
  children,
}: {
  invalid?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('relative shrink-0', className)}>
      {children}
      <FieldErrorTip show={invalid} />
    </div>
  );
}
