import { PAYMENT_METHOD_LABELS } from '../constants';
import type { PaymentMethod } from '../schemas';
import { compareMoney, money, subtractMoney, sumMoney } from './money';

export interface PaymentSplit {
  method: PaymentMethod;
  amount: string;
}

export function paymentsFromLegacy(method: PaymentMethod, total: string): PaymentSplit[] {
  return [{ method, amount: money(total) }];
}

export function resolvePayments(
  payments: Array<{ method: PaymentMethod; amount: string }> | null | undefined,
  fallbackMethod: PaymentMethod | undefined,
  total: string,
): PaymentSplit[] {
  const merged = new Map<PaymentMethod, number>();
  for (const payment of payments ?? []) {
    const amount = Number(money(payment.amount));
    if (amount <= 0) continue;
    merged.set(payment.method, (merged.get(payment.method) ?? 0) + amount);
  }
  if (merged.size > 0) {
    return [...merged.entries()].map(([method, amount]) => ({
      method,
      amount: money(amount),
    }));
  }
  return paymentsFromLegacy(fallbackMethod ?? 'PIX', total);
}

export function fiadoPortion(payments: PaymentSplit[]): string {
  return money(
    payments
      .filter((payment) => payment.method === 'FIADO')
      .reduce((acc, payment) => acc + Number(payment.amount), 0),
  );
}

export function hasFiado(payments: PaymentSplit[]): boolean {
  return compareMoney(fiadoPortion(payments), '0') > 0;
}

export function cashPortion(payments: PaymentSplit[]): string {
  return money(
    payments
      .filter((payment) => payment.method === 'CASH')
      .reduce((acc, payment) => acc + Number(payment.amount), 0),
  );
}

export function primaryPaymentMethod(payments: PaymentSplit[]): PaymentMethod {
  if (hasFiado(payments)) return 'FIADO';
  return payments[0]?.method ?? 'PIX';
}

export function paymentsSum(payments: PaymentSplit[]): string {
  return sumMoney(payments.map((payment) => payment.amount));
}

export function formatPaymentsLabel(payments: PaymentSplit[]): string {
  if (payments.length <= 1) {
    return PAYMENT_METHOD_LABELS[payments[0]?.method ?? 'PIX'];
  }
  return payments
    .map((payment) => PAYMENT_METHOD_LABELS[payment.method])
    .join(' + ');
}

export function formatPaymentsDetail(
  payments: PaymentSplit[],
  formatAmount: (amount: string) => string,
): string {
  return payments
    .map((payment) => `${PAYMENT_METHOD_LABELS[payment.method]} ${formatAmount(payment.amount)}`)
    .join(' · ');
}

export function paymentsOfSale(sale: {
  payments?: PaymentSplit[] | null;
  paymentMethod: PaymentMethod;
  total: string;
}): PaymentSplit[] {
  return resolvePayments(sale.payments, sale.paymentMethod, sale.total);
}

export function salePaymentsLabel(sale: {
  payments?: PaymentSplit[] | null;
  paymentMethod: PaymentMethod;
  total: string;
}): string {
  return formatPaymentsLabel(paymentsOfSale(sale));
}

/** Valor ainda sem forma, considerando linha em branco como “o restante”. */
export function draftUnallocated(
  drafts: Array<{ method: PaymentMethod; amount: string }>,
  total: string,
): string {
  const filled = drafts.filter((draft) => draft.amount.trim() && Number(money(draft.amount)) > 0);
  if (drafts.length === 1 && filled.length === 0) return money(0);
  const allocated = filled.reduce((acc, draft) => acc + Number(money(draft.amount)), 0);
  return money(Math.max(0, Number(money(total)) - allocated));
}

/**
 * Converte o rascunho da UI em splits válidos.
 * Uma única forma sem valor assume o total; uma linha em branco recebe o restante.
 */
export function resolveDraftPayments(
  drafts: Array<{ method: PaymentMethod; amount: string }>,
  total: string,
): PaymentSplit[] | null {
  if (drafts.length === 0) return null;
  const totalMoney = money(total);
  const parsed = drafts.map((draft) => ({
    method: draft.method,
    amount: draft.amount.trim() ? money(draft.amount) : null,
  }));
  const filled = parsed.filter((item) => item.amount != null && Number(item.amount) > 0);
  const emptyCount = parsed.length - filled.length;

  if (parsed.length === 1 && emptyCount === 1) {
    return [{ method: parsed[0].method, amount: totalMoney }];
  }

  let result: PaymentSplit[];
  if (emptyCount === 1) {
    const allocated = filled.reduce((acc, item) => acc + Number(item.amount), 0);
    const remaining = Number(totalMoney) - allocated;
    if (remaining > 0) {
      result = parsed.map((item) =>
        item.amount != null && Number(item.amount) > 0
          ? { method: item.method, amount: item.amount }
          : { method: item.method, amount: money(remaining) },
      );
    } else {
      result = filled.map((item) => ({ method: item.method, amount: item.amount as string }));
    }
  } else if (emptyCount === 0) {
    result = parsed.map((item) => ({ method: item.method, amount: item.amount as string }));
  } else {
    return null;
  }

  if (new Set(result.map((item) => item.method)).size !== result.length) return null;
  if (compareMoney(paymentsSum(result), totalMoney) !== 0) return null;
  return result;
}

export function saleFiadoState(input: {
  status: string;
  fiadoPaidAt: Date | string | null | undefined;
  fiadoPaidAmount: string;
  payments: PaymentSplit[];
}): { fiadoRemaining: string; isFiadoOpen: boolean; fiadoTotal: string } {
  const fiadoTotal = fiadoPortion(input.payments);
  const fiadoRemaining = money(
    Math.max(0, Number(subtractMoney(fiadoTotal, input.fiadoPaidAmount))),
  );
  return {
    fiadoTotal,
    fiadoRemaining,
    isFiadoOpen:
      input.status === 'COMPLETED' &&
      !input.fiadoPaidAt &&
      compareMoney(fiadoRemaining, '0') > 0,
  };
}

export function splitCashFromPayments(input: {
  total: string;
  payments: PaymentSplit[];
  fiadoPaidAmount?: { toString(): string } | string | number | null;
  fiadoPaidAt?: Date | string | null;
  status?: string;
}): { received: string; pending: string } {
  const total = money(input.total);
  const payments = input.payments.length
    ? input.payments
    : paymentsFromLegacy('PIX', total);
  const fiado = fiadoPortion(payments);
  const paid = money(input.fiadoPaidAmount?.toString() ?? '0');
  const remaining = money(Math.max(0, Number(subtractMoney(fiado, paid))));
  const isOpen =
    input.status !== 'CANCELLED' &&
    !input.fiadoPaidAt &&
    compareMoney(remaining, '0') > 0;

  return {
    received: sumMoney([subtractMoney(total, fiado), paid]),
    pending: isOpen ? remaining : '0.00',
  };
}
