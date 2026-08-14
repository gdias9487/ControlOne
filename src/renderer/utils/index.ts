import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { normalizeDecimalInput } from '@shared/utils/money';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Tom do valor de fiado — alinhado ao card do dashboard. */
export const FIADO_VALUE_CLASS = 'font-semibold text-amber-600 dark:text-amber-400';

/** Tom de entradas / vendas recebidas — alinhado ao faturamento do dashboard. */
export const INCOME_VALUE_CLASS = 'font-semibold text-emerald-600 dark:text-emerald-400';

/** Tom de saídas / despesas — alinhado às despesas do dashboard. */
export const EXPENSE_VALUE_CLASS = 'font-semibold text-rose-600 dark:text-rose-400';

/** Classe de valor para venda/serviço conforme status. */
export function transactionAmountClass(options: {
  isFiadoOpen?: boolean;
  status?: string;
}): string {
  if (options.isFiadoOpen) return FIADO_VALUE_CLASS;
  if (options.status === 'CANCELLED') return 'font-semibold text-muted-foreground line-through';
  return INCOME_VALUE_CLASS;
}

export function formatCurrency(value: string | number): string {
  const amount = Number(normalizeDecimalInput(value));
  if (Number.isNaN(amount)) return 'R$ 0,00';
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function formatPercent(value: string | number): string {
  const amount = Number(normalizeDecimalInput(value));
  if (Number.isNaN(amount)) return '0%';
  return `${amount.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`;
}

export function toMoneyInput(value: string): string {
  const normalized = String(normalizeDecimalInput(value));
  const [integer = '0', decimals] = normalized.split('.');
  return decimals === undefined ? integer : `${integer}.${decimals.slice(0, 4)}`;
}

export function unwrapApi<T>(result: { success: boolean; data?: T; error?: string }): T {
  if (!result.success || result.data === undefined) {
    throw new Error(result.error ?? 'Falha na operação.');
  }
  return result.data;
}
