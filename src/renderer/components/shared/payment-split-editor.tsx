import { Plus, Trash2 } from 'lucide-react';
import type { PaymentMethod } from '@shared/schemas';
import { PAYMENT_METHOD_LABELS } from '@shared/constants';
import { draftUnallocated } from '@shared/utils/sale-payments';
import { Button } from '@/components/ui/button';
import { MoneyInput } from '@/components/ui/money-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency, formatMoneyDigits } from '@/utils';

export type PaymentDraft = { method: PaymentMethod; amount: string };

export const DEFAULT_SALE_PAYMENTS: PaymentDraft[] = [{ method: 'PIX', amount: '' }];

const METHODS = Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[];

const BUTTON_ORDER: PaymentMethod[] = [
  'PIX',
  'CASH',
  'DEBIT_CARD',
  'CREDIT_CARD',
  'FIADO',
  'OTHER',
];

interface PaymentSplitEditorProps {
  total: string;
  payments: PaymentDraft[];
  onChange: (payments: PaymentDraft[]) => void;
  compact?: boolean;
  variant?: 'rows' | 'buttons';
  invalid?: boolean;
}

export function PaymentSplitEditor({
  total,
  payments,
  onChange,
  compact = false,
  variant = 'rows',
  invalid = false,
}: PaymentSplitEditorProps) {
  const remaining = Number(draftUnallocated(payments, total));
  const used = new Set(payments.map((payment) => payment.method));
  const showAmounts = payments.length > 1;

  function update(index: number, patch: Partial<PaymentDraft>) {
    onChange(payments.map((payment, i) => (i === index ? { ...payment, ...patch } : payment)));
  }

  function addRow() {
    const next = METHODS.find((method) => !used.has(method));
    if (!next) return;
    onChange([...payments, { method: next, amount: '' }]);
  }

  function selectMethod(method: PaymentMethod) {
    if (payments.length <= 1) {
      onChange([{ method, amount: payments[0]?.amount ?? '' }]);
      return;
    }
    if (used.has(method)) return;
    onChange([...payments, { method, amount: '' }]);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className={compact ? 'text-xs' : undefined}>Formas de pagamento</Label>
        {METHODS.some((method) => !used.has(method)) ? (
          <Button type="button" size="sm" variant="outline" onClick={addRow}>
            <Plus className="h-3.5 w-3.5" />
            Outra forma
          </Button>
        ) : null}
      </div>

      {variant === 'buttons' ? (
        <div className="grid grid-cols-2 gap-2">
          {BUTTON_ORDER.map((method) => (
            <Button
              key={method}
              type="button"
              variant={used.has(method) ? 'accent' : 'outline'}
              className="h-11 justify-center px-2 text-sm"
              onClick={() => selectMethod(method)}
            >
              {PAYMENT_METHOD_LABELS[method]}
            </Button>
          ))}
        </div>
      ) : null}

      {variant === 'rows' || showAmounts ? (
        <div className="space-y-2">
          {payments.map((payment, index) => (
            <div
              key={`${payment.method}-${index}`}
              className="grid grid-cols-[1fr_8.5rem_2rem] items-center gap-2"
            >
              {variant === 'buttons' ? (
                <p className="truncate text-sm font-medium">{PAYMENT_METHOD_LABELS[payment.method]}</p>
              ) : (
                <Select
                  value={payment.method}
                  onValueChange={(value) => update(index, { method: value as PaymentMethod })}
                >
                  <SelectTrigger className={compact ? 'h-9' : 'h-10'}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {METHODS.map((method) => (
                      <SelectItem
                        key={method}
                        value={method}
                        disabled={used.has(method) && method !== payment.method}
                      >
                        {PAYMENT_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <MoneyInput
                className={compact ? 'h-9' : 'h-10'}
                value={payment.amount}
                allowEmpty
                invalid={invalid}
                placeholder={remaining > 0 ? formatMoneyDigits(remaining) : '0,00'}
                onChange={(amount) => update(index, { amount })}
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-rose-600"
                disabled={payments.length === 1}
                onClick={() => onChange(payments.filter((_, i) => i !== index))}
                aria-label="Remover forma"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {showAmounts ? (
        <p className={`text-xs ${invalid ? 'text-destructive' : 'text-muted-foreground'}`}>
          Restante: {formatCurrency(remaining)}
          {remaining > 0 ? ' · uma linha em branco recebe o que falta' : ''}
        </p>
      ) : null}
    </div>
  );
}
