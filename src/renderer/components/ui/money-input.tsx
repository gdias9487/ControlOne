import * as React from 'react';
import { Input } from '@/components/ui/input';
import { cn, digitsToMoney, formatMoneyDigits } from '@/utils';

type MoneyInputProps = Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'type'> & {
  value: string;
  onChange: (value: string) => void;
  /** Se verdadeiro, campo vazio permanece vazio (não força 0,00). */
  allowEmpty?: boolean;
  invalid?: boolean;
};

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value, onChange, allowEmpty = false, className, disabled, invalid, ...props }, ref) => {
    const display = allowEmpty && value.trim() === '' ? '' : formatMoneyDigits(value || '0');

    return (
      <div className="relative w-full">
        <span
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-sm text-muted-foreground',
            disabled && 'opacity-50',
          )}
        >
          R$
        </span>
        <Input
          {...props}
          ref={ref}
          invalid={invalid}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="off"
          className={cn('pl-10 tabular-nums', className)}
          value={display}
          placeholder={props.placeholder ?? '0,00'}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, '');
            if (allowEmpty && digits === '') {
              onChange('');
              return;
            }
            onChange(digitsToMoney(digits));
          }}
        />
      </div>
    );
  },
);
MoneyInput.displayName = 'MoneyInput';
