import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal.Value;

/**
 * Aceita separador decimal brasileiro ou internacional.
 * Exemplos: "11,50" e "11.50" viram "11.50".
 * Também evita erro durante a digitação de valores incompletos ("," ou ".").
 */
export function normalizeDecimalInput(value: DecimalInput): DecimalInput {
  if (typeof value !== 'string') return value;

  const cleaned = value.trim().replace(/[^\d,.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === ',' || cleaned === '.') return '0';

  const isNegative = cleaned.startsWith('-');
  const unsigned = cleaned.replace(/-/g, '');
  const lastComma = unsigned.lastIndexOf(',');
  const lastDot = unsigned.lastIndexOf('.');
  const decimalIndex = Math.max(lastComma, lastDot);

  if (decimalIndex < 0) {
    return `${isNegative ? '-' : ''}${unsigned.replace(/\D/g, '') || '0'}`;
  }

  const integer = unsigned.slice(0, decimalIndex).replace(/\D/g, '') || '0';
  const decimals = unsigned.slice(decimalIndex + 1).replace(/\D/g, '');
  return `${isNegative ? '-' : ''}${integer}${decimals ? `.${decimals}` : ''}`;
}

export function toDecimal(value: DecimalInput): Decimal {
  return new Decimal(normalizeDecimalInput(value));
}

export function money(value: DecimalInput): string {
  return toDecimal(value).toFixed(2);
}

export function moneyExact(value: DecimalInput): string {
  return toDecimal(value).toFixed(4);
}

export function calcProfitMargin(cost: DecimalInput, salePrice: DecimalInput): string {
  const costDec = toDecimal(cost);
  const priceDec = toDecimal(salePrice);
  if (costDec.isZero()) {
    return priceDec.isZero() ? '0.00' : '100.00';
  }
  return priceDec.minus(costDec).div(costDec).times(100).toFixed(2);
}

export function calcProfit(cost: DecimalInput, salePrice: DecimalInput, quantity = 1): string {
  return toDecimal(salePrice).minus(toDecimal(cost)).times(quantity).toFixed(2);
}

export function sumMoney(values: DecimalInput[]): string {
  return values.reduce<Decimal>((acc, value) => acc.plus(toDecimal(value)), new Decimal(0)).toFixed(2);
}

export function subtractMoney(a: DecimalInput, b: DecimalInput): string {
  return toDecimal(a).minus(toDecimal(b)).toFixed(2);
}

/** Aloca um valor (ex.: custo) na mesma proporção de `portion` sobre `whole`. */
export function allocateMoney(
  fullAmount: DecimalInput,
  portion: DecimalInput,
  whole: DecimalInput,
): string {
  const total = toDecimal(whole);
  if (total.isZero()) return money(0);
  return money(toDecimal(fullAmount).times(toDecimal(portion)).div(total));
}

/** Desconto em dinheiro a partir de uma porcentagem (0–100). */
export function discountFromPercent(amount: DecimalInput, percent: DecimalInput): string {
  return money(toDecimal(amount).times(toDecimal(percent)).div(100));
}

/** Aplica desconto percentual e retorna o valor líquido. */
export function applyPercentDiscount(amount: DecimalInput, percent: DecimalInput): string {
  return subtractMoney(amount, discountFromPercent(amount, percent));
}

export function multiplyMoney(a: DecimalInput, quantity: number): string {
  return toDecimal(a).times(quantity).toFixed(2);
}

export function isPositiveMoney(value: DecimalInput): boolean {
  return toDecimal(value).greaterThan(0);
}

export function compareMoney(a: DecimalInput, b: DecimalInput): number {
  return toDecimal(a).comparedTo(toDecimal(b));
}
