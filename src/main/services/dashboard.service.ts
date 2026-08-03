import type { DateRangeInput } from '../../shared/schemas';
import type { BreakdownLine, DashboardDto, NamedMetric } from '../../shared/types';
import { EXPENSE_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '../../shared/constants';
import { formatMonthLabel, resolveDateRange, toIso } from '../../shared/utils/date-range';
import { allocateMoney, money, subtractMoney, sumMoney, toDecimal } from '../../shared/utils/money';
import { getPrisma } from '../database/client';
import { listLowStockProducts } from './product.service';

function paidAmountOf(raw: { toString(): string } | string | number | null | undefined): string {
  return money(raw?.toString() ?? '0');
}

function formatShortDate(date: Date): string {
  return date.toLocaleDateString('pt-BR');
}

/** Separa valor já recebido (caixa) do fiado ainda pendente. */
function splitCash(input: {
  paymentMethod: string;
  total: string;
  fiadoPaidAmount?: { toString(): string } | string | number | null;
  fiadoPaidAt?: Date | null;
  status?: string;
}): { received: string; pending: string } {
  const total = money(input.total);
  if (input.paymentMethod !== 'FIADO') {
    return { received: total, pending: '0.00' };
  }

  const paid = paidAmountOf(input.fiadoPaidAmount);
  const remaining = money(Math.max(0, Number(subtractMoney(total, paid))));
  const isOpen =
    input.status !== 'CANCELLED' &&
    input.fiadoPaidAt == null &&
    Number(remaining) > 0;

  return {
    received: paid,
    pending: isOpen ? remaining : '0.00',
  };
}

function dayKey(date: Date): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export async function getDashboard(rangeInput: DateRangeInput): Promise<DashboardDto> {
  const prisma = getPrisma();
  const range = resolveDateRange(rangeInput);
  const { startDate, endDate } = range;

  const [sales, services, expenses, products, movements] = await Promise.all([
    prisma.sale.findMany({
      where: {
        status: 'COMPLETED',
        soldAt: { gte: startDate, lte: endDate },
      },
      include: { items: true, customer: true },
      orderBy: { soldAt: 'desc' },
    }),
    prisma.service.findMany({
      where: {
        status: 'COMPLETED',
        performedAt: { gte: startDate, lte: endDate },
      },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: startDate, lte: endDate } },
      orderBy: { expenseDate: 'desc' },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      include: { category: true },
    }),
    prisma.inventoryMovement.findMany({
      include: { product: true },
      orderBy: { movedAt: 'desc' },
      take: 8,
    }),
  ]);

  const saleSplits = sales.map((sale) =>
    splitCash({
      paymentMethod: sale.paymentMethod,
      total: sale.total.toString(),
      fiadoPaidAmount: (sale as typeof sale & { fiadoPaidAmount?: { toString(): string } })
        .fiadoPaidAmount,
      fiadoPaidAt: sale.fiadoPaidAt,
      status: sale.status,
    }),
  );
  const serviceSplits = services.map((service) =>
    splitCash({
      paymentMethod: service.paymentMethod,
      total: service.amount.toString(),
      fiadoPaidAmount: (service as typeof service & { fiadoPaidAmount?: { toString(): string } })
        .fiadoPaidAmount,
      fiadoPaidAt: service.fiadoPaidAt,
      status: service.status,
    }),
  );

  const monthlyRevenue = sumMoney([
    ...saleSplits.map((s) => s.received),
    ...serviceSplits.map((s) => s.received),
  ]);
  const openFiado = sumMoney([
    ...saleSplits.map((s) => s.pending),
    ...serviceSplits.map((s) => s.pending),
  ]);

  const salesCostReceived = sumMoney(
    sales.map((sale, index) => {
      const fullCost = sumMoney(
        sale.items.map((item) =>
          toDecimal(item.unitCost.toString()).times(item.quantity).toFixed(2),
        ),
      );
      return allocateMoney(fullCost, saleSplits[index].received, sale.total.toString());
    }),
  );
  const servicesCostReceived = sumMoney(
    services.map((service, index) =>
      allocateMoney(service.cost.toString(), serviceSplits[index].received, service.amount.toString()),
    ),
  );
  const salesCostFull = sumMoney(
    sales.flatMap((sale) =>
      sale.items.map((item) =>
        toDecimal(item.unitCost.toString()).times(item.quantity).toFixed(2),
      ),
    ),
  );
  const servicesCostFull = sumMoney(services.map((s) => s.cost.toString()));
  const expensesTotal = sumMoney(expenses.map((e) => e.amount.toString()));
  const receivedCosts = sumMoney([salesCostReceived, servicesCostReceived]);
  const soldCostsFiado = money(
    Math.max(0, Number(subtractMoney(sumMoney([salesCostFull, servicesCostFull]), receivedCosts))),
  );
  /** Total exibido no card: parte recebida + custo ainda em fiado. */
  const soldCosts = sumMoney([receivedCosts, soldCostsFiado]);
  /** Margem/saldo usam só o custo da parte já recebida (caixa). */
  const estimatedProfit = money(
    Math.max(0, Number(subtractMoney(monthlyRevenue, receivedCosts))),
  );
  const totalAfterExpenses = subtractMoney(estimatedProfit, expensesTotal);

  const productsSold = sales.reduce(
    (acc, sale) => acc + sale.items.reduce((sum, item) => sum + item.quantity, 0),
    0,
  );

  const stockValue = sumMoney(
    products.map((p) => toDecimal(p.cost.toString()).times(p.stockQuantity).toFixed(2)),
  );

  const productSalesMap = new Map<string, { name: string; qty: number; revenue: string }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const current = productSalesMap.get(item.productId) ?? {
        name: item.productName,
        qty: 0,
        revenue: '0.00',
      };
      current.qty += item.quantity;
      current.revenue = sumMoney([current.revenue, item.subtotal.toString()]);
      productSalesMap.set(item.productId, current);
    }
  }

  const ranked = [...productSalesMap.entries()]
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.qty - a.qty);

  const topProducts: NamedMetric[] = ranked.slice(0, 5).map((item) => ({
    id: item.id,
    name: item.name,
    value: item.qty,
    extra: money(item.revenue),
  }));

  const bottomProducts: NamedMetric[] = ranked
    .slice()
    .reverse()
    .slice(0, 5)
    .map((item) => ({
      id: item.id,
      name: item.name,
      value: item.qty,
      extra: money(item.revenue),
    }));

  const lowStock = (await listLowStockProducts()).slice(0, 12);

  const salesByPeriodMap = new Map<string, { received: string; pending: string }>();
  sales.forEach((sale, index) => {
    const key = dayKey(sale.soldAt);
    const split = saleSplits[index];
    const current = salesByPeriodMap.get(key) ?? { received: '0.00', pending: '0.00' };
    salesByPeriodMap.set(key, {
      received: sumMoney([current.received, split.received]),
      pending: sumMoney([current.pending, split.pending]),
    });
  });
  services.forEach((service, index) => {
    const key = dayKey(service.performedAt);
    const split = serviceSplits[index];
    const current = salesByPeriodMap.get(key) ?? { received: '0.00', pending: '0.00' };
    salesByPeriodMap.set(key, {
      received: sumMoney([current.received, split.received]),
      pending: sumMoney([current.pending, split.pending]),
    });
  });

  const salesByPeriod = [...salesByPeriodMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, point]) => {
      const [year, month, day] = key.split('-').map(Number);
      const date = new Date(year, month - 1, day);
      return {
        label: date.toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: '2-digit',
        }),
        value: point.received,
        secondaryValue: point.pending,
      };
    });

  const now = new Date();
  const monthlyRevenuePoints = [];
  const monthlyProfitPoints = [];
  const cashFlowPoints = [];

  for (let i = 5; i >= 0; i -= 1) {
    const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
    const label = formatMonthLabel(monthDate);

    const monthSales = await prisma.sale.findMany({
      where: { status: 'COMPLETED', soldAt: { gte: monthStart, lte: monthEnd } },
      include: { items: true },
    });
    const monthServices = await prisma.service.findMany({
      where: { status: 'COMPLETED', performedAt: { gte: monthStart, lte: monthEnd } },
    });
    const monthExpenses = await prisma.expense.findMany({
      where: { expenseDate: { gte: monthStart, lte: monthEnd } },
    });

    const monthSaleSplits = monthSales.map((sale) =>
      splitCash({
        paymentMethod: sale.paymentMethod,
        total: sale.total.toString(),
        fiadoPaidAmount: (sale as typeof sale & { fiadoPaidAmount?: { toString(): string } })
          .fiadoPaidAmount,
        fiadoPaidAt: sale.fiadoPaidAt,
        status: sale.status,
      }),
    );
    const monthServiceSplits = monthServices.map((service) =>
      splitCash({
        paymentMethod: service.paymentMethod,
        total: service.amount.toString(),
        fiadoPaidAmount: (service as typeof service & { fiadoPaidAmount?: { toString(): string } })
          .fiadoPaidAmount,
        fiadoPaidAt: service.fiadoPaidAt,
        status: service.status,
      }),
    );

    const received = sumMoney([
      ...monthSaleSplits.map((s) => s.received),
      ...monthServiceSplits.map((s) => s.received),
    ]);
    const pending = sumMoney([
      ...monthSaleSplits.map((s) => s.pending),
      ...monthServiceSplits.map((s) => s.pending),
    ]);
    const cost = sumMoney([
      ...monthSales.map((sale, index) => {
        const fullCost = sumMoney(
          sale.items.map((item) =>
            toDecimal(item.unitCost.toString()).times(item.quantity).toFixed(2),
          ),
        );
        return allocateMoney(fullCost, monthSaleSplits[index].received, sale.total.toString());
      }),
      ...monthServices.map((service, index) =>
        allocateMoney(
          service.cost.toString(),
          monthServiceSplits[index].received,
          service.amount.toString(),
        ),
      ),
    ]);
    const expenseTotal = sumMoney(monthExpenses.map((e) => e.amount.toString()));
    const profit = money(Math.max(0, Number(subtractMoney(received, cost))));
    const totalAfterExpenses = subtractMoney(profit, expenseTotal);

    monthlyRevenuePoints.push({
      label,
      value: received,
      secondaryValue: pending,
    });
    monthlyProfitPoints.push({
      label,
      value: profit,
      secondaryValue: totalAfterExpenses,
    });
    cashFlowPoints.push({
      label,
      value: received,
      secondaryValue: sumMoney([cost, expenseTotal]),
    });
  }

  const revenueLines: BreakdownLine[] = [];
  sales.forEach((sale, index) => {
    const received = saleSplits[index].received;
    if (Number(received) <= 0) return;
    revenueLines.push({
      label: `Venda ${sale.saleNumber}`,
      detail: `${formatShortDate(sale.soldAt)} · ${PAYMENT_METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}${sale.customer?.name ? ` · ${sale.customer.name}` : ''}`,
      amount: received,
      sign: '+',
    });
  });
  services.forEach((service, index) => {
    const received = serviceSplits[index].received;
    if (Number(received) <= 0) return;
    revenueLines.push({
      label: service.name,
      detail: `${formatShortDate(service.performedAt)} · ${PAYMENT_METHOD_LABELS[service.paymentMethod] ?? service.paymentMethod}`,
      amount: received,
      sign: '+',
    });
  });

  const fiadoLines: BreakdownLine[] = [];
  sales.forEach((sale, index) => {
    const pending = saleSplits[index].pending;
    if (Number(pending) <= 0) return;
    fiadoLines.push({
      label: `Venda ${sale.saleNumber}`,
      detail: `${formatShortDate(sale.soldAt)}${sale.customer?.name ? ` · ${sale.customer.name}` : ''}`,
      amount: pending,
      sign: '+',
    });
  });
  services.forEach((service, index) => {
    const pending = serviceSplits[index].pending;
    if (Number(pending) <= 0) return;
    fiadoLines.push({
      label: service.name,
      detail: formatShortDate(service.performedAt),
      amount: pending,
      sign: '+',
    });
  });

  const expenseLines: BreakdownLine[] = expenses.map((expense) => ({
    label: expense.description,
    detail: `${formatShortDate(expense.expenseDate)} · ${EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category}`,
    amount: money(expense.amount.toString()),
    sign: '+',
  }));

  const costLines: BreakdownLine[] = [];
  const fiadoCostLines: BreakdownLine[] = [];
  sales.forEach((sale, index) => {
    const fullCost = sumMoney(
      sale.items.map((item) =>
        toDecimal(item.unitCost.toString()).times(item.quantity).toFixed(2),
      ),
    );
    const costReceived = allocateMoney(fullCost, saleSplits[index].received, sale.total.toString());
    const costPending = allocateMoney(fullCost, saleSplits[index].pending, sale.total.toString());
    if (Number(costReceived) > 0) {
      costLines.push({
        label: `Venda ${sale.saleNumber}`,
        detail: `${formatShortDate(sale.soldAt)} · custo da parte recebida`,
        amount: costReceived,
        sign: '+',
      });
    }
    if (Number(costPending) > 0) {
      fiadoCostLines.push({
        label: `Venda ${sale.saleNumber}`,
        detail: `${formatShortDate(sale.soldAt)} · custo em fiado`,
        amount: costPending,
        sign: '+',
      });
    }
  });
  services.forEach((service, index) => {
    const fullCost = money(service.cost.toString());
    const costReceived = allocateMoney(
      fullCost,
      serviceSplits[index].received,
      service.amount.toString(),
    );
    const costPending = allocateMoney(
      fullCost,
      serviceSplits[index].pending,
      service.amount.toString(),
    );
    if (Number(costReceived) > 0) {
      costLines.push({
        label: service.name,
        detail: `${formatShortDate(service.performedAt)} · custo da parte recebida`,
        amount: costReceived,
        sign: '+',
      });
    }
    if (Number(costPending) > 0) {
      fiadoCostLines.push({
        label: service.name,
        detail: `${formatShortDate(service.performedAt)} · custo em fiado`,
        amount: costPending,
        sign: '+',
      });
    }
  });

  const saldoLines: BreakdownLine[] = [
    {
      label: 'Faturamento recebido',
      detail: 'Valores já pagos',
      amount: monthlyRevenue,
      sign: '+',
    },
    {
      label: 'Custos (parte recebida)',
      detail: 'Produtos e serviços já pagos',
      amount: receivedCosts,
      sign: '-',
    },
    {
      label: 'Despesas do período',
      detail: 'Gastos operacionais',
      amount: expensesTotal,
      sign: '-',
    },
  ];

  const breakdowns: DashboardDto['breakdowns'] = {
    monthlyRevenue: {
      id: 'monthlyRevenue',
      title: 'Faturamento recebido',
      description: 'Soma dos valores já pagos em vendas e serviços no período.',
      lines: revenueLines,
      total: monthlyRevenue,
      totalLabel: 'Total recebido',
    },
    openFiado: {
      id: 'openFiado',
      title: 'Fiado',
      description: 'Soma dos valores ainda pendentes de pagamento.',
      lines: fiadoLines,
      total: openFiado,
      totalLabel: 'Total em fiado',
    },
    monthlyExpenses: {
      id: 'monthlyExpenses',
      title: 'Despesas do mês',
      description: 'Soma das despesas operacionais do período.',
      lines: expenseLines,
      total: expensesTotal,
      totalLabel: 'Total de despesas',
    },
    soldCosts: {
      id: 'soldCosts',
      title: 'Custos',
      description:
        'Custo total de produtos/serviços do período. Inclui a parte já recebida e o custo ainda em fiado (não pago).',
      lines: [
        ...costLines,
        ...fiadoCostLines.map((line) => ({
          ...line,
          detail: `${line.detail} · ainda não pago`,
        })),
      ],
      total: soldCosts,
      totalLabel: 'Total de custos',
      note:
        Number(soldCostsFiado) > 0
          ? {
              label: 'Dos quais em fiado (ainda não pagos)',
              amount: soldCostsFiado,
            }
          : undefined,
    },
    soldCostsFiado: {
      id: 'soldCostsFiado',
      title: 'Custo de fiados',
      description: 'Custo dos produtos/serviços ainda em fiado (não pagos).',
      lines: fiadoCostLines,
      total: soldCostsFiado,
      totalLabel: 'Total custo de fiados',
    },
    totalAfterExpenses: {
      id: 'totalAfterExpenses',
      title: 'Saldo final',
      description:
        'Recebido menos custos da parte recebida menos despesas. Custo de fiados não entra neste saldo.',
      lines: saldoLines,
      total: totalAfterExpenses,
      totalLabel: 'Saldo final',
      note:
        Number(soldCostsFiado) > 0
          ? {
              label: 'Custo em fiado (ainda não pago; não entra no saldo)',
              amount: soldCostsFiado,
            }
          : Number(openFiado) > 0
            ? { label: 'Fiado (não entra no saldo)', amount: openFiado }
            : undefined,
    },
  };

  return {
    period: {
      preset: range.preset,
      startDate: toIso(startDate),
      endDate: toIso(endDate),
    },
    cards: {
      monthlyRevenue,
      openFiado,
      estimatedProfit,
      monthlyExpenses: expensesTotal,
      soldCosts,
      soldCostsFiado,
      totalAfterExpenses,
      productsCount: products.filter((p) => p.status === 'ACTIVE').length,
      productsSold,
      stockValue,
    },
    breakdowns,
    charts: {
      salesByPeriod,
      monthlyRevenue: monthlyRevenuePoints,
      monthlyProfit: monthlyProfitPoints,
      cashFlow: cashFlowPoints,
    },
    widgets: {
      topProducts,
      bottomProducts,
      lowStock,
      recentSales: sales.slice(0, 6).map((sale) => {
        const total = money(sale.total.toString());
        const fiadoPaidAmount = paidAmountOf(
          (sale as typeof sale & { fiadoPaidAmount?: { toString(): string } }).fiadoPaidAmount,
        );
        const fiadoRemaining = money(
          Math.max(0, Number(subtractMoney(total, fiadoPaidAmount))),
        );
        return {
          id: sale.id,
          saleNumber: sale.saleNumber,
          customerId: sale.customerId,
          customerName: sale.customer?.name ?? null,
          discount: money(sale.discount.toString()),
          subtotal: money(sale.subtotal.toString()),
          total,
          paymentMethod: sale.paymentMethod,
          status: sale.status,
          fiadoPaidAmount,
          fiadoRemaining,
          fiadoPaidAt: sale.fiadoPaidAt?.toISOString() ?? null,
          isFiadoOpen:
            sale.paymentMethod === 'FIADO' &&
            sale.status === 'COMPLETED' &&
            sale.fiadoPaidAt == null &&
            Number(fiadoRemaining) > 0,
          notes: sale.notes,
          soldAt: sale.soldAt.toISOString(),
          createdAt: sale.createdAt.toISOString(),
          updatedAt: sale.updatedAt.toISOString(),
          items: sale.items.map((item) => ({
            id: item.id,
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: money(item.unitPrice.toString()),
            unitCost: money(item.unitCost.toString()),
            discountPercent: money(
              (
                item as typeof item & { discountPercent?: { toString(): string } }
              ).discountPercent?.toString() ?? '0',
            ),
            subtotal: money(item.subtotal.toString()),
          })),
        };
      }),
      recentMovements: movements.map((m) => ({
        id: m.id,
        productId: m.productId,
        productName: m.product.name,
        type: m.type,
        quantity: m.quantity,
        reason: m.reason,
        notes: m.notes,
        previousStock: m.previousStock,
        resultingStock: m.resultingStock,
        allowNegative: m.allowNegative,
        saleId: m.saleId,
        movedAt: m.movedAt.toISOString(),
        createdAt: m.createdAt.toISOString(),
      })),
      recentExpenses: expenses.slice(0, 6).map((expense) => ({
        id: expense.id,
        description: expense.description,
        category: expense.category,
        amount: money(expense.amount.toString()),
        paymentMethod: expense.paymentMethod,
        notes: expense.notes,
        expenseDate: expense.expenseDate.toISOString(),
        recurringExpenseId: expense.recurringExpenseId,
        isFixed: Boolean(expense.recurringExpenseId),
        createdAt: expense.createdAt.toISOString(),
        updatedAt: expense.updatedAt.toISOString(),
      })),
    },
  };
}
