import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

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
