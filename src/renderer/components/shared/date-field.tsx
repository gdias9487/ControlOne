import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/utils';

export function todayDateInputValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateInput(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isoDateToBr(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return '';
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatBrDateDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function brDateToIso(value: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Converte valor de input date (YYYY-MM-DD) para ISO.
 * Por padrão usa meio-dia local (evita mudar o dia por fuso).
 * Com `preferNowIfToday`, se a data for hoje usa o horário atual.
 */
export function dateInputToIso(
  value: string,
  options?: { preferNowIfToday?: boolean },
): string {
  if (options?.preferNowIfToday && value === todayDateInputValue()) {
    return new Date().toISOString();
  }
  return new Date(`${value}T12:00:00`).toISOString();
}

interface DateFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  invalid?: boolean;
  id?: string;
}

export function DateField({
  label = 'Data',
  value,
  onChange,
  required = false,
  invalid = false,
  id,
}: DateFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}
        {required ? ' *' : ''}
      </Label>
      <Input
        id={id}
        type="date"
        value={value || todayDateInputValue()}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        invalid={invalid}
      />
    </div>
  );
}

interface DateFilterInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  'aria-label'?: string;
  className?: string;
  id?: string;
}

export function DateFilterInput({
  value,
  onChange,
  placeholder = 'dd/mm/aaaa',
  title,
  'aria-label': ariaLabel,
  className,
  id,
}: DateFilterInputProps) {
  const committedRef = useRef(value);
  const [text, setText] = useState(() => isoDateToBr(value));

  useEffect(() => {
    if (value !== committedRef.current) {
      committedRef.current = value;
      setText(isoDateToBr(value));
    }
  }, [value]);

  return (
    <div className="relative shrink-0">
      <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={id}
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        title={title}
        aria-label={ariaLabel}
        className={cn('w-[158px] pl-9 tabular-nums', className)}
        value={text}
        onChange={(event) => {
          const formatted = formatBrDateDigits(event.target.value);
          setText(formatted);
          if (formatted === '') {
            committedRef.current = '';
            onChange('');
            return;
          }
          const iso = brDateToIso(formatted);
          if (iso) {
            committedRef.current = iso;
            onChange(iso);
          }
        }}
      />
    </div>
  );
}
