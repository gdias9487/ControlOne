import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

export type DecimalInput = Decimal.Value;

export function toDecimal(value: DecimalInput): Decimal {
  return new Decimal(value);
}

export function money(value: DecimalInput): string {
  return new Decimal(value).toFixed(2);
}

export function moneyExact(value: DecimalInput): string {
  return new Decimal(value).toFixed(4);
}

export function calcProfitMargin(cost: DecimalInput, salePrice: DecimalInput): string {
  const costDec = new Decimal(cost);
  const priceDec = new Decimal(salePrice);
  if (costDec.isZero()) {
    return priceDec.isZero() ? '0.00' : '100.00';
  }
  return priceDec.minus(costDec).div(costDec).times(100).toFixed(2);
}

export function calcProfit(cost: DecimalInput, salePrice: DecimalInput, quantity = 1): string {
  return new Decimal(salePrice).minus(cost).times(quantity).toFixed(2);
}

export function sumMoney(values: DecimalInput[]): string {
  return values.reduce<Decimal>((acc, value) => acc.plus(value), new Decimal(0)).toFixed(2);
}

export function subtractMoney(a: DecimalInput, b: DecimalInput): string {
  return new Decimal(a).minus(b).toFixed(2);
}

/** Aloca um valor (ex.: custo) na mesma proporção de `portion` sobre `whole`. */
export function allocateMoney(
  fullAmount: DecimalInput,
  portion: DecimalInput,
  whole: DecimalInput,
): string {
  const total = new Decimal(whole);
  if (total.isZero()) return money(0);
  return money(new Decimal(fullAmount).times(portion).div(total));
}

/** Desconto em dinheiro a partir de uma porcentagem (0–100). */
export function discountFromPercent(amount: DecimalInput, percent: DecimalInput): string {
  return money(new Decimal(amount).times(percent).div(100));
}

/** Aplica desconto percentual e retorna o valor líquido. */
export function applyPercentDiscount(amount: DecimalInput, percent: DecimalInput): string {
  return subtractMoney(amount, discountFromPercent(amount, percent));
}

export function multiplyMoney(a: DecimalInput, quantity: number): string {
  return new Decimal(a).times(quantity).toFixed(2);
}

export function isPositiveMoney(value: DecimalInput): boolean {
  return new Decimal(value).greaterThan(0);
}

export function compareMoney(a: DecimalInput, b: DecimalInput): number {
  return new Decimal(a).comparedTo(b);
}
