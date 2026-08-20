import { dialog } from 'electron';
import ExcelJS from 'exceljs';
import fs from 'fs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import path from 'path';
import {
  APP_NAME,
  EXPENSE_CATEGORY_LABELS,
  INVENTORY_MOVEMENT_LABELS,
  PAYMENT_METHOD_LABELS,
} from '../../shared/constants';
import type { ReportFiltersInput } from '../../shared/schemas';
import type { ChartPoint, NamedMetric, ReportDto } from '../../shared/types';
import { formatDateBr, resolveDateRange, toIso } from '../../shared/utils/date-range';
import { allocateMoney, money, subtractMoney, sumMoney, toDecimal } from '../../shared/utils/money';
import { getPrisma } from '../database/client';
import { getDefaultReportsDir } from '../utils/paths';
import { getSettings } from './settings.service';

function sanitizeReportFileName(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 180);
}

/** Tipo do relatório - range do período (se existir) - data atual */
function buildReportExportFileName(report: ReportDto, extension: 'pdf' | 'xlsx'): string {
  const type = report.title.trim();
  const start = report.period?.startDate
    ? formatDateBr(report.period.startDate).replace(/\//g, '-')
    : '';
  const end = report.period?.endDate
    ? formatDateBr(report.period.endDate).replace(/\//g, '-')
    : '';
  const range = start && end ? `${start} a ${end}` : start || end || '';
  const today = formatDateBr(new Date()).replace(/\//g, '-');
  const parts = [type, range || null, today].filter((part): part is string => Boolean(part));
  return `${sanitizeReportFileName(parts.join(' - '))}.${extension}`;
}

/** Paleta do template financeiro (navy / teal / cinzas) + Helvetica. */
const PDF = {
  bg: [255, 255, 255] as [number, number, number],
  surface: [255, 255, 255] as [number, number, number],
  border: [204, 204, 204] as [number, number, number],
  line: [220, 220, 220] as [number, number, number],
  /** #1A2B44 */
  navy: [26, 43, 68] as [number, number, number],
  text: [51, 51, 51] as [number, number, number],
  muted: [120, 128, 138] as [number, number, number],
  /** #C9E2E9 — cabeçalhos / totais */
  teal: [201, 226, 233] as [number, number, number],
  /** #D6E9ED */
  tealSoft: [214, 233, 237] as [number, number, number],
  /** #D9D9D9 */
  grey: [217, 217, 217] as [number, number, number],
  /** #F2F2F2 */
  greySoft: [242, 242, 242] as [number, number, number],
  /** Valores semânticos (UI): verde #059669, amarelo #D97706, vermelho #E11D48 */
  green: [5, 150, 105] as [number, number, number],
  yellow: [217, 119, 6] as [number, number, number],
  red: [225, 29, 72] as [number, number, number],
  bar: [5, 150, 105] as [number, number, number],
  barProfit: [5, 150, 105] as [number, number, number],
  barFiado: [217, 119, 6] as [number, number, number],
  barAlt: [225, 29, 72] as [number, number, number],
  headerBg: [201, 226, 233] as [number, number, number],
};

function pdfBarColor(label: string, value: number): [number, number, number] {
  const l = label.toLowerCase();
  if (l.includes('fiado')) return PDF.yellow;
  if (l.includes('custo') || l.includes('despesa') || l.includes('saí')) return PDF.red;
  if (
    l.includes('recebido') ||
    l.includes('margem') ||
    l.includes('saldo') ||
    l.includes('lucro') ||
    l.includes('faturamento') ||
    l.includes('receita') ||
    l.includes('entrada')
  ) {
    return value < 0 ? PDF.red : PDF.green;
  }
  return PDF.green;
}

function pdfSummaryValueColor(
  id: string,
  value: string | number,
): [number, number, number] {
  if (id === 'received' || id === 'stock') return PDF.green;
  if (id === 'openFiado') return PDF.yellow;
  if (id === 'costs' || id === 'expenses') return PDF.red;
  if (id === 'profit' || id === 'totalAfterExpenses') {
    const n = Number(value);
    if (Number.isFinite(n) && n < 0) return PDF.red;
    if (Number.isFinite(n) && n > 0) return PDF.green;
  }
  return PDF.text;
}

function isMoneyCell(value: unknown): boolean {
  if (typeof value === 'number') return false;
  const s = String(value);
  return /^\d+\.\d{2}$/.test(s);
}

function isTotalRow(row: Record<string, string | number>): boolean {
  return Object.values(row).some((v) =>
    String(v)
      .toLowerCase()
      .includes('total'),
  );
}

function paidAmountOf(raw: { toString(): string } | string | number | null | undefined): string {
  return money(raw?.toString() ?? '0');
}

function splitCash(input: {
  paymentMethod: string;
  total: string;
  fiadoPaidAmount?: { toString(): string } | string | number | null;
  fiadoPaidAt?: Date | null;
}): { received: string; pending: string } {
  const total = money(input.total);
  if (input.paymentMethod !== 'FIADO') {
    return { received: total, pending: '0.00' };
  }
  const paid = paidAmountOf(input.fiadoPaidAmount);
  const remaining = money(Math.max(0, Number(subtractMoney(total, paid))));
  const isOpen = input.fiadoPaidAt == null && Number(remaining) > 0;
  return { received: paid, pending: isOpen ? remaining : '0.00' };
}

function formatMoneyBr(value: string | number): string {
  const n = Number(value);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export async function getReport(filters: ReportFiltersInput): Promise<ReportDto> {
  const prisma = getPrisma();
  const range = resolveDateRange(filters);
  const { startDate, endDate } = range;

  const [sales, services, expenses, products, movements, settings] = await Promise.all([
    prisma.sale.findMany({
      where: { status: 'COMPLETED', soldAt: { gte: startDate, lte: endDate } },
      include: { items: true, customer: true },
      orderBy: { soldAt: 'desc' },
    }),
    prisma.service.findMany({
      where: { status: 'COMPLETED', performedAt: { gte: startDate, lte: endDate } },
      include: { customer: true },
      orderBy: { performedAt: 'desc' },
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
      where: { movedAt: { gte: startDate, lte: endDate } },
      include: { product: true },
      orderBy: { movedAt: 'desc' },
    }),
    getSettings(),
  ]);

  const saleSplits = sales.map((sale) =>
    splitCash({
      paymentMethod: sale.paymentMethod,
      total: sale.total.toString(),
      fiadoPaidAmount: (sale as typeof sale & { fiadoPaidAmount?: { toString(): string } })
        .fiadoPaidAmount,
      fiadoPaidAt: sale.fiadoPaidAt,
    }),
  );
  const serviceSplits = services.map((service) =>
    splitCash({
      paymentMethod: service.paymentMethod,
      total: service.amount.toString(),
      fiadoPaidAmount: (service as typeof service & { fiadoPaidAmount?: { toString(): string } })
        .fiadoPaidAmount,
      fiadoPaidAt: service.fiadoPaidAt,
    }),
  );

  const salesBooked = sumMoney(sales.map((s) => s.total.toString()));
  const servicesBooked = sumMoney(services.map((s) => s.amount.toString()));
  const revenueBooked = sumMoney([salesBooked, servicesBooked]);
  const received = sumMoney([
    ...saleSplits.map((s) => s.received),
    ...serviceSplits.map((s) => s.received),
  ]);
  const openFiado = sumMoney([
    ...saleSplits.map((s) => s.pending),
    ...serviceSplits.map((s) => s.pending),
  ]);

  const salesCost = sumMoney(
    sales.map((sale, index) => {
      const fullCost = sumMoney(
        sale.items.map((item) =>
          toDecimal(item.unitCost.toString()).times(item.quantity).toFixed(2),
        ),
      );
      return allocateMoney(fullCost, saleSplits[index].received, sale.total.toString());
    }),
  );
  const servicesCost = sumMoney(
    services.map((service, index) =>
      allocateMoney(service.cost.toString(), serviceSplits[index].received, service.amount.toString()),
    ),
  );
  const expensesTotal = sumMoney(expenses.map((e) => e.amount.toString()));
  const costsTotal = sumMoney([salesCost, servicesCost]);
  const profitGross = money(
    Math.max(0, Number(subtractMoney(received, costsTotal))),
  );
  const totalAfterExpenses = subtractMoney(profitGross, expensesTotal);
  const stockValue = sumMoney(
    products.map((p) => toDecimal(p.cost.toString()).times(p.stockQuantity).toFixed(2)),
  );
  const productsSoldQty = sales.reduce(
    (acc, sale) => acc + sale.items.reduce((sum, item) => sum + item.quantity, 0),
    0,
  );
  const ticketMedio =
    sales.length > 0
      ? money(Number(salesBooked) / sales.length)
      : '0.00';

  const productSales = new Map<string, { name: string; qty: number; revenue: string }>();
  for (const sale of sales) {
    for (const item of sale.items) {
      const key = item.productId ?? `avulso:${item.productName}`;
      const current = productSales.get(key) ?? {
        name: item.productId ? item.productName : `${item.productName} (avulso)`,
        qty: 0,
        revenue: '0.00',
      };
      current.qty += item.quantity;
      current.revenue = sumMoney([current.revenue, item.subtotal.toString()]);
      productSales.set(key, current);
    }
  }

  const ranked = [...productSales.entries()]
    .map(([id, data]) => ({ id, ...data }))
    .sort((a, b) => b.qty - a.qty);

  const period = { startDate: toIso(startDate), endDate: toIso(endDate) };
  const baseSummary: NamedMetric[] = [
    { id: 'received', name: 'Recebido', value: received },
    { id: 'openFiado', name: 'Fiado', value: openFiado },
    { id: 'costs', name: 'Custos', value: costsTotal },
    { id: 'profit', name: 'Margem', value: profitGross },
    { id: 'expenses', name: 'Despesas', value: expensesTotal },
    { id: 'totalAfterExpenses', name: 'Saldo final', value: totalAfterExpenses },
    { id: 'salesCount', name: 'Vendas', value: sales.length },
    { id: 'servicesCount', name: 'Serviços', value: services.length },
    { id: 'productsSold', name: 'Itens vendidos', value: productsSoldQty },
    { id: 'stock', name: 'Valor do estoque', value: stockValue },
  ];

  const financialChart: ChartPoint[] = [
    { label: 'Recebido', value: received },
    { label: 'Custos', value: costsTotal },
    { label: 'Margem', value: profitGross },
    { label: 'Despesas', value: expensesTotal },
    { label: 'Saldo final', value: totalAfterExpenses },
  ];

  const meta = {
    storeName: settings.storeName || APP_NAME,
    businessType: settings.businessType,
    salesCount: sales.length,
    servicesCount: services.length,
    ticketMedio,
    revenueBooked,
  };

  const reportType = filters.reportType ?? 'MONTHLY_REVENUE';

  const withMeta = (
    report: Omit<ReportDto, 'period'> & { period?: ReportDto['period'] },
  ): ReportDto => ({
    ...report,
    period,
    summary: report.summary,
    // Guarda metadados úteis em summary extras via rows intro — já cobertos no PDF
  });

  switch (reportType) {
    case 'DAILY_REVENUE': {
      const map = new Map<string, { received: string; pending: string; booked: string }>();
      sales.forEach((sale, index) => {
        const key = formatDateBr(sale.soldAt);
        const split = saleSplits[index];
        const current = map.get(key) ?? { received: '0.00', pending: '0.00', booked: '0.00' };
        map.set(key, {
          received: sumMoney([current.received, split.received]),
          pending: sumMoney([current.pending, split.pending]),
          booked: sumMoney([current.booked, sale.total.toString()]),
        });
      });
      services.forEach((service, index) => {
        const key = formatDateBr(service.performedAt);
        const split = serviceSplits[index];
        const current = map.get(key) ?? { received: '0.00', pending: '0.00', booked: '0.00' };
        map.set(key, {
          received: sumMoney([current.received, split.received]),
          pending: sumMoney([current.pending, split.pending]),
          booked: sumMoney([current.booked, service.amount.toString()]),
        });
      });
      const rows = [...map.entries()]
        .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR'))
        .map(([date, values]) => ({
          Data: date,
          Recebido: values.received,
          'Fiado': values.pending,
          'Total lançado': values.booked,
        }));
      return withMeta({
        title: 'Faturamento por dia',
        summary: baseSummary,
        rows,
        charts: rows.map((r) => ({
          label: String(r.Data),
          value: String(r.Recebido),
          secondaryValue: String(r['Fiado']),
        })),
      });
    }
    case 'MONTHLY_REVENUE':
    case 'MONTHLY_EXPENSES': {
      const expenseByCategory = new Map<string, string>();
      for (const expense of expenses) {
        const key = EXPENSE_CATEGORY_LABELS[expense.category] ?? expense.category;
        expenseByCategory.set(key, sumMoney([expenseByCategory.get(key) ?? '0', expense.amount.toString()]));
      }

      const rows =
        reportType === 'MONTHLY_EXPENSES'
          ? [
              ...[...expenseByCategory.entries()].map(([cat, value]) => ({
                Categoria: cat,
                Valor: value,
                Participação:
                  Number(expensesTotal) > 0
                    ? `${((Number(value) / Number(expensesTotal)) * 100).toFixed(1)}%`
                    : '0%',
              })),
              {
                Categoria: 'Total de despesas',
                Valor: expensesTotal,
                Participação: '100%',
              },
            ]
          : [
              { Métrica: 'Recebido (caixa)', Valor: received },
              { Métrica: 'Fiado', Valor: openFiado },
              { Métrica: 'Total lançado (vendas + serviços)', Valor: revenueBooked },
              { Métrica: 'Faturamento vendas', Valor: salesBooked },
              { Métrica: 'Faturamento serviços', Valor: servicesBooked },
              { Métrica: 'Custos (parte recebida)', Valor: costsTotal },
              { Métrica: 'Custo das vendas', Valor: salesCost },
              { Métrica: 'Custo dos serviços', Valor: servicesCost },
              { Métrica: 'Margem (recebido − custos)', Valor: profitGross },
              { Métrica: 'Despesas (à parte)', Valor: expensesTotal },
              { Métrica: 'Saldo final', Valor: totalAfterExpenses },
              { Métrica: 'Qtd. vendas', Valor: sales.length },
              { Métrica: 'Qtd. serviços', Valor: services.length },
              { Métrica: 'Valor médio por venda', Valor: ticketMedio },
            ];

      return withMeta({
        title:
          reportType === 'MONTHLY_REVENUE'
            ? 'Faturamento do período'
            : 'Despesas do período',
        summary: baseSummary,
        rows,
        charts:
          reportType === 'MONTHLY_EXPENSES'
            ? [...expenseByCategory.entries()].slice(0, 8).map(([label, value]) => ({
                label,
                value,
              }))
            : financialChart,
      });
    }
    case 'TOP_PRODUCTS':
      return withMeta({
        title: 'Produtos mais vendidos',
        summary: [],
        rows: ranked.slice(0, 20).map((p, index) => ({
          Posição: index + 1,
          Produto: p.name,
          Quantidade: p.qty,
          Receita: p.revenue,
          'Preço médio': p.qty > 0 ? money(Number(p.revenue) / p.qty) : '0.00',
        })),
        charts: ranked.slice(0, 10).map((p) => ({
          label: p.name,
          value: String(p.qty),
        })),
      });
    case 'STALE_PRODUCTS': {
      const soldIds = new Set(productSales.keys());
      const stale = products.filter((p) => !soldIds.has(p.id) && p.status === 'ACTIVE');
      return withMeta({
        title: 'Produtos parados',
        summary: [{ id: 'stale', name: 'Produtos parados', value: stale.length }],
        rows: stale.map((p) => ({
          Produto: p.name,
          Código: p.internalCode,
          Estoque: p.stockQuantity,
          Categoria: p.category.name,
          'Valor parado': toDecimal(p.cost.toString()).times(p.stockQuantity).toFixed(2),
        })),
        charts: stale.slice(0, 10).map((p) => ({
          label: p.name,
          value: toDecimal(p.cost.toString()).times(p.stockQuantity).toFixed(2),
        })),
      });
    }
    case 'PAYMENT_METHODS': {
      const map = new Map<string, { received: string; pending: string; count: number }>();
      const bump = (
        method: string,
        split: { received: string; pending: string },
      ) => {
        const current = map.get(method) ?? { received: '0.00', pending: '0.00', count: 0 };
        map.set(method, {
          received: sumMoney([current.received, split.received]),
          pending: sumMoney([current.pending, split.pending]),
          count: current.count + 1,
        });
      };
      sales.forEach((sale, index) => bump(sale.paymentMethod, saleSplits[index]));
      services.forEach((service, index) => bump(service.paymentMethod, serviceSplits[index]));

      const rows = [...map.entries()].map(([method, values]) => ({
        Forma: PAYMENT_METHOD_LABELS[method as keyof typeof PAYMENT_METHOD_LABELS] ?? method,
        Recebido: values.received,
        'Fiado': values.pending,
        Lançamentos: values.count,
        Total: sumMoney([values.received, values.pending]),
      }));
      return withMeta({
        title: 'Vendas por forma de pagamento',
        summary: baseSummary,
        rows,
        // Total (recebido + pendente): fiado não some do gráfico
        charts: rows.map((r) => ({ label: String(r.Forma), value: String(r.Total) })),
      });
    }
    case 'INVENTORY_HISTORY':
      return withMeta({
        title: 'Histórico de movimentações',
        summary: [{ id: 'movements', name: 'Movimentações', value: movements.length }],
        rows: movements.map((m) => ({
          Data: formatDateBr(m.movedAt),
          Produto: m.product.name,
          Tipo: INVENTORY_MOVEMENT_LABELS[m.type],
          Quantidade: m.quantity,
          Anterior: m.previousStock,
          Resultante: m.resultingStock,
          Motivo: m.reason ?? '—',
        })),
        charts: [],
      });
    case 'STOCK_VALUE': {
      const byCategory = new Map<string, string>();
      for (const p of products) {
        const total = toDecimal(p.cost.toString()).times(p.stockQuantity).toFixed(2);
        byCategory.set(
          p.category.name,
          sumMoney([byCategory.get(p.category.name) ?? '0', total]),
        );
      }
      return withMeta({
        title: 'Valor total do estoque',
        summary: [{ id: 'stock', name: 'Valor do estoque', value: stockValue }],
        rows: products
          .map((p) => ({
            Produto: p.name,
            Categoria: p.category.name,
            Estoque: p.stockQuantity,
            Custo: money(p.cost.toString()),
            'Preço venda': money(p.salePrice.toString()),
            Total: toDecimal(p.cost.toString()).times(p.stockQuantity).toFixed(2),
          }))
          .sort((a, b) => Number(b.Total) - Number(a.Total)),
        charts: [...byCategory.entries()]
          .sort((a, b) => Number(b[1]) - Number(a[1]))
          .slice(0, 8)
          .map(([label, value]) => ({ label, value })),
      });
    }
    case 'PRODUCT_MARGINS':
      return withMeta({
        title: 'Margem de lucro por produto',
        summary: baseSummary,
        rows: products
          .map((p) => ({
            Produto: p.name,
            Categoria: p.category.name,
            Custo: money(p.cost.toString()),
            Preço: money(p.salePrice.toString()),
            Margem: `${money(p.profitMargin.toString())}%`,
            Estoque: p.stockQuantity,
          }))
          .sort((a, b) => Number.parseFloat(b.Margem) - Number.parseFloat(a.Margem)),
        charts: products
          .slice()
          .sort((a, b) => Number(b.profitMargin) - Number(a.profitMargin))
          .map((p) => ({
            label: p.name,
            value: money(p.profitMargin.toString()),
          })),
      });
    case 'SERVICE_REVENUE':
      return withMeta({
        title: 'Receita com serviços',
        summary: [
          ...baseSummary,
          { id: 'services', name: 'Receita serviços', value: servicesBooked },
        ],
        rows: services.map((s, index) => {
          const split = serviceSplits[index];
          return {
            Serviço: s.name,
            Cliente: s.customer?.name ?? '—',
            Data: formatDateBr(s.performedAt),
            Valor: money(s.amount.toString()),
            Recebido: split.received,
            Pendente: split.pending,
            Custo: money(s.cost.toString()),
            Forma: PAYMENT_METHOD_LABELS[s.paymentMethod],
          };
        }),
        charts: financialChart,
      });
    default:
      return withMeta({
        title: 'Despesas do período',
        summary: baseSummary,
        rows: expenses.map((e) => ({
          Descrição: e.description,
          Categoria: EXPENSE_CATEGORY_LABELS[e.category],
          Valor: money(e.amount.toString()),
          Forma: PAYMENT_METHOD_LABELS[e.paymentMethod],
          Data: formatDateBr(e.expenseDate),
          Observações: e.notes ?? '—',
        })),
        charts: financialChart,
      });
  }
}

function drawBarChart(
  doc: jsPDF,
  charts: ChartPoint[],
  startY: number,
  opts?: { expenseCategories?: boolean },
): number {
  if (charts.length === 0) return startY;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const chartWidth = pageWidth - margin * 2;
  const chartHeight = 52;
  const top = startY + 4;

  doc.setFillColor(...PDF.teal);
  doc.rect(margin, top, chartWidth, 8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(...PDF.navy);
  doc.text('VISÃO GRÁFICA', margin + 3, top + 5.5);

  const stacked = charts.some((c) => Number(c.secondaryValue ?? 0) > 0);
  const totals = charts.map((c) => {
    const primary = Math.max(0, Number(c.value) || 0);
    const secondary = stacked ? Math.max(0, Number(c.secondaryValue ?? 0) || 0) : 0;
    return primary + secondary;
  });
  const max = Math.max(...totals, 1);
  const gap = charts.length > 20 ? 1.5 : charts.length > 12 ? 3 : 6;
  const barAreaLeft = margin + 8;
  const barAreaWidth = chartWidth - 16;
  const barWidth = Math.max(
    2,
    Math.min(28, (barAreaWidth - gap * Math.max(charts.length - 1, 0)) / Math.max(charts.length, 1)),
  );
  const baseY = top + 14 + chartHeight;

  doc.setDrawColor(...PDF.line);
  doc.setLineWidth(0.3);
  doc.line(margin, baseY, margin + chartWidth, baseY);

  const showLabels = barWidth >= 6;
  charts.forEach((point, index) => {
    const rawValue = Number(point.value) || 0;
    const value = Math.max(0, rawValue);
    const secondary = stacked ? Math.max(0, Number(point.secondaryValue ?? 0) || 0) : 0;
    const primaryH = (value / max) * (chartHeight - 8);
    const secondaryH = (secondary / max) * (chartHeight - 8);
    const x = barAreaLeft + index * (barWidth + gap);

    if (stacked) {
      // Base: recebido (verde); topo: fiado pendente (amarelo)
      if (value > 0) {
        doc.setFillColor(...PDF.bar);
        if (secondary > 0) {
          doc.rect(x, baseY - primaryH, barWidth, Math.max(primaryH, 1), 'F');
        } else {
          doc.roundedRect(x, baseY - primaryH, barWidth, Math.max(primaryH, 1), 1, 1, 'F');
        }
      }
      if (secondary > 0) {
        doc.setFillColor(...PDF.barFiado);
        doc.roundedRect(
          x,
          baseY - primaryH - secondaryH,
          barWidth,
          Math.max(secondaryH, 1),
          1,
          1,
          'F',
        );
      }
    } else {
      const color = opts?.expenseCategories
        ? PDF.barAlt
        : pdfBarColor(point.label, rawValue);
      doc.setFillColor(...color);
      doc.roundedRect(x, baseY - primaryH, barWidth, Math.max(primaryH, 1), 1, 1, 'F');
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(barWidth >= 12 ? 6 : 5);
    doc.setTextColor(...PDF.muted);
    if (showLabels) {
      const maxChars = barWidth >= 14 ? 10 : barWidth >= 8 ? 6 : 3;
      const label =
        point.label.length > maxChars
          ? `${point.label.slice(0, maxChars - 1)}…`
          : point.label;
      doc.text(label, x + barWidth / 2, baseY + 4, { align: 'center' });
    }
  });

  return top + chartHeight + (showLabels ? 22 : 16);
}

export async function exportReportPdf(
  filters: ReportFiltersInput,
): Promise<{ path: string }> {
  const report = await getReport(filters);
  const settings = await getSettings();
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFillColor(...PDF.bg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFont('helvetica', 'normal');

  // Cabeçalho estilo balance sheet
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...PDF.navy);
  doc.text(report.title, 14, 18);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF.muted);
  doc.text('RELATÓRIO', pageWidth - 14, 14, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...PDF.text);
  doc.text((settings.storeName || APP_NAME).toUpperCase(), 14, 25);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(...PDF.muted);
  const periodLabel = `Período: ${formatDateBr(report.period.startDate)} até ${formatDateBr(report.period.endDate)}`;
  doc.text(periodLabel, 14, 31);
  if (settings.businessType) {
    doc.text(settings.businessType.toUpperCase(), pageWidth - 14, 25, { align: 'right' });
  }
  doc.text(`Gerado em ${formatDateBr(new Date())}`, pageWidth - 14, 31, { align: 'right' });

  doc.setDrawColor(...PDF.teal);
  doc.setLineWidth(1.2);
  doc.line(14, 34, pageWidth - 14, 34);

  // Cards financeiros (ou resumo operacional quando não há cards financeiros)
  const mainSummary = report.summary
    .filter((item) =>
      ['received', 'openFiado', 'costs', 'profit', 'expenses', 'totalAfterExpenses'].includes(
        item.id,
      ),
    )
    .slice(0, 6);
  const cardsToShow =
    mainSummary.length > 0 ? mainSummary : report.summary.slice(0, 6);
  let y = 38;
  if (cardsToShow.length > 0) {
    const cardGap = 3;
    const cardWidth =
      (pageWidth - 28 - cardGap * (cardsToShow.length - 1)) / cardsToShow.length;
    cardsToShow.forEach((item, index) => {
      const x = 14 + index * (cardWidth + cardGap);
      const fill = index % 2 === 0 ? PDF.tealSoft : PDF.greySoft;
      doc.setFillColor(...fill);
      doc.rect(x, y, cardWidth, 16, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(...PDF.navy);
      doc.text(item.name.toUpperCase(), x + 2.5, y + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...pdfSummaryValueColor(item.id, item.value));
      const display =
        typeof item.value === 'number' ? String(item.value) : formatMoneyBr(item.value);
      doc.text(display, x + 2.5, y + 12);
    });
    y = 58;
  }

  if (report.charts.length > 0) {
    y = drawBarChart(doc, report.charts, y, {
      expenseCategories: filters.reportType === 'MONTHLY_EXPENSES',
    });
  }

  const columns = report.rows.length > 0 ? Object.keys(report.rows[0]) : ['Info'];
  const moneyColIndexes = new Set<number>();
  if (report.rows.length > 0) {
    columns.forEach((col, idx) => {
      if (report.rows.some((row) => isMoneyCell(row[col]))) moneyColIndexes.add(idx);
    });
  }

  autoTable(doc, {
    startY: y + 2,
    head: [columns.map((c) => c.toUpperCase())],
    body:
      report.rows.length > 0
        ? report.rows.map((row) =>
            columns.map((col) => {
              const v = row[col];
              if (typeof v === 'number') return String(v);
              if (isMoneyCell(v)) return formatMoneyBr(v);
              return String(v);
            }),
          )
        : [['Sem dados para o período']],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 8,
      textColor: PDF.text,
      fillColor: PDF.surface,
      lineColor: PDF.line,
      lineWidth: 0.2,
      cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
      valign: 'middle',
    },
    headStyles: {
      fillColor: PDF.teal,
      textColor: PDF.navy,
      fontStyle: 'bold',
      fontSize: 7,
      lineColor: PDF.teal,
      halign: 'left',
    },
    columnStyles: Object.fromEntries(
      [...moneyColIndexes].map((idx) => [idx, { halign: 'right' as const }]),
    ),
    didParseCell: (data) => {
      if (data.section !== 'body' || report.rows.length === 0) return;
      const row = report.rows[data.row.index];
      if (!row || !isTotalRow(row)) return;
      data.cell.styles.fillColor = PDF.tealSoft;
      data.cell.styles.fontStyle = 'bold';
      data.cell.styles.textColor = PDF.navy;
    },
    margin: { left: 14, right: 14 },
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i += 1) {
    doc.setPage(i);
    doc.setDrawColor(...PDF.line);
    doc.setLineWidth(0.4);
    doc.line(14, pageHeight - 12, pageWidth - 14, pageHeight - 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(...PDF.muted);
    doc.text(
      `${(settings.storeName || APP_NAME).toUpperCase()}  ·  ${report.title}  ·  ${i}/${pageCount}`,
      pageWidth / 2,
      pageHeight - 7,
      { align: 'center' },
    );
  }

  const filePath = path.join(getDefaultReportsDir(), buildReportExportFileName(report, 'pdf'));
  const save = await dialog.showSaveDialog({
    title: 'Exportar PDF',
    defaultPath: filePath,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (save.canceled || !save.filePath) {
    throw new Error('Exportação cancelada.');
  }
  fs.writeFileSync(save.filePath, Buffer.from(doc.output('arraybuffer')));
  return { path: save.filePath };
}

export async function exportReportExcel(
  filters: ReportFiltersInput,
): Promise<{ path: string }> {
  const report = await getReport(filters);
  const settings = await getSettings();
  const workbook = new ExcelJS.Workbook();
  workbook.creator = settings.storeName || APP_NAME;
  workbook.created = new Date();

  const XLS = {
    navy: 'FF1A2B44',
    text: 'FF333333',
    muted: 'FF78808A',
    teal: 'FFC9E2E9',
    tealSoft: 'FFD6E9ED',
    greySoft: 'FFF2F2F2',
    white: 'FFFFFFFF',
    green: 'FF059669',
    yellow: 'FFD97706',
    red: 'FFE11D48',
    border: 'FFCCCCCC',
  } as const;

  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: XLS.border } },
    left: { style: 'thin', color: { argb: XLS.border } },
    bottom: { style: 'thin', color: { argb: XLS.border } },
    right: { style: 'thin', color: { argb: XLS.border } },
  };

  function excelSummaryColor(id: string, value: string | number): string {
    const [r, g, b] = pdfSummaryValueColor(id, value);
    return `FF${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  }

  function styleHeaderRow(row: ExcelJS.Row, fillArgb = XLS.teal) {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: XLS.navy }, name: 'Calibri', size: 10 };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fillArgb } };
      cell.border = thinBorder;
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });
    row.height = 20;
  }

  // —— Resumo ——
  const summarySheet = workbook.addWorksheet('Resumo', {
    views: [{ showGridLines: false }],
  });
  summarySheet.mergeCells('A1:B1');
  const titleCell = summarySheet.getCell('A1');
  titleCell.value = report.title;
  titleCell.font = { bold: true, size: 16, color: { argb: XLS.navy }, name: 'Calibri' };
  titleCell.alignment = { vertical: 'middle' };
  summarySheet.getRow(1).height = 28;

  summarySheet.getCell('A2').value = 'RELATÓRIO';
  summarySheet.getCell('A2').font = { size: 9, color: { argb: XLS.muted }, name: 'Calibri' };
  summarySheet.getCell('B2').value = (settings.storeName || APP_NAME).toUpperCase();
  summarySheet.getCell('B2').font = { bold: true, size: 10, color: { argb: XLS.text }, name: 'Calibri' };
  summarySheet.getCell('B2').alignment = { horizontal: 'right' };

  summarySheet.getCell('A3').value = 'Período';
  summarySheet.getCell('A3').font = { size: 9, color: { argb: XLS.muted }, name: 'Calibri' };
  summarySheet.getCell('B3').value =
    `${formatDateBr(report.period.startDate)} até ${formatDateBr(report.period.endDate)}`;
  summarySheet.getCell('B3').font = { size: 9, color: { argb: XLS.text }, name: 'Calibri' };
  summarySheet.getCell('B3').alignment = { horizontal: 'right' };

  summarySheet.getCell('A4').value = 'Gerado em';
  summarySheet.getCell('A4').font = { size: 9, color: { argb: XLS.muted }, name: 'Calibri' };
  summarySheet.getCell('B4').value = formatDateBr(new Date());
  summarySheet.getCell('B4').font = { size: 9, color: { argb: XLS.text }, name: 'Calibri' };
  summarySheet.getCell('B4').alignment = { horizontal: 'right' };

  const headerRow = summarySheet.getRow(6);
  headerRow.values = ['Indicador', 'Valor'];
  styleHeaderRow(headerRow);

  const mainIds = new Set([
    'received',
    'openFiado',
    'costs',
    'profit',
    'expenses',
    'totalAfterExpenses',
  ]);
  let summaryRowIndex = 7;
  for (const item of report.summary) {
    const row = summarySheet.getRow(summaryRowIndex);
    const isMoney = typeof item.value !== 'number';
    const numeric = typeof item.value === 'number' ? item.value : Number(item.value);
    row.getCell(1).value = item.name;
    row.getCell(2).value = Number.isFinite(numeric) ? numeric : String(item.value);
    if (isMoney && Number.isFinite(numeric)) {
      row.getCell(2).numFmt = '"R$"#,##0.00';
    }
    row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: XLS.text } };
    const valueColor = mainIds.has(item.id)
      ? excelSummaryColor(item.id, item.value)
      : XLS.text;
    row.getCell(2).font = {
      bold: true,
      name: 'Calibri',
      size: 10,
      color: { argb: valueColor },
    };
    row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
    if (mainIds.has(item.id)) {
      row.getCell(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: summaryRowIndex % 2 === 0 ? XLS.tealSoft : XLS.greySoft },
      };
      row.getCell(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: summaryRowIndex % 2 === 0 ? XLS.tealSoft : XLS.greySoft },
      };
    }
    row.eachCell((cell) => {
      cell.border = thinBorder;
    });
    summaryRowIndex += 1;
  }
  summarySheet.columns = [{ width: 32 }, { width: 18 }];

  // —— Detalhamento ——
  const detailName = report.title.slice(0, 31) || 'Detalhamento';
  const sheet = workbook.addWorksheet(detailName, {
    views: [{ showGridLines: false }],
  });

  if (report.rows.length > 0) {
    const columns = Object.keys(report.rows[0]);
    const moneyCols = new Set(
      columns.filter((col) => report.rows.some((row) => isMoneyCell(row[col]))),
    );
    sheet.columns = columns.map((key) => ({
      header: key.toUpperCase(),
      key,
      width: Math.min(36, Math.max(12, key.length + 4)),
    }));
    styleHeaderRow(sheet.getRow(1));

    for (const [index, dataRow] of report.rows.entries()) {
      const excelRow = sheet.addRow(
        Object.fromEntries(
          columns.map((col) => {
            const v = dataRow[col];
            if (isMoneyCell(v)) return [col, Number(v)];
            return [col, v];
          }),
        ),
      );
      const total = isTotalRow(dataRow);
      excelRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const colKey = columns[colNumber - 1];
        cell.border = thinBorder;
        cell.font = {
          bold: total,
          name: 'Calibri',
          size: 10,
          color: { argb: total ? XLS.navy : XLS.text },
        };
        cell.alignment = {
          vertical: 'middle',
          horizontal: moneyCols.has(colKey) ? 'right' : 'left',
        };
        if (moneyCols.has(colKey) && typeof cell.value === 'number') {
          cell.numFmt = '"R$"#,##0.00';
        }
        if (total) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: XLS.tealSoft },
          };
        } else if (index % 2 === 1) {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: XLS.greySoft },
          };
        }
      });
    }
  } else {
    sheet.addRow(['Sem dados para o período']);
    sheet.getCell('A1').font = { italic: true, color: { argb: XLS.muted }, name: 'Calibri' };
  }

  // —— Dados do gráfico ——
  if (report.charts.length > 0) {
    const chartSheet = workbook.addWorksheet('Gráfico', {
      views: [{ showGridLines: false }],
    });
    const isPercent = filters.reportType === 'PRODUCT_MARGINS';
    const isQty = filters.reportType === 'TOP_PRODUCTS';
    const hasSecondary = report.charts.some((c) => Number(c.secondaryValue ?? 0) > 0);
    const valueHeader = isPercent ? 'MARGEM %' : isQty ? 'QUANTIDADE' : 'VALOR';

    chartSheet.getCell('A1').value = 'CATEGORIA';
    chartSheet.getCell('B1').value = valueHeader;
    if (hasSecondary) chartSheet.getCell('C1').value = 'FIADO';
    styleHeaderRow(chartSheet.getRow(1));
    chartSheet.getColumn(1).width = 32;
    chartSheet.getColumn(2).width = 16;
    if (hasSecondary) chartSheet.getColumn(3).width = 16;

    for (const [index, point] of report.charts.entries()) {
      const row = chartSheet.getRow(index + 2);
      row.getCell(1).value = point.label;
      row.getCell(2).value = Number(point.value) || 0;
      if (hasSecondary) row.getCell(3).value = Number(point.secondaryValue ?? 0);

      const zebra = index % 2 === 1 ? XLS.greySoft : undefined;
      const valueColor = (() => {
        if (hasSecondary || isQty || isPercent) return XLS.green;
        const [r, g, b] = pdfBarColor(point.label, Number(point.value) || 0);
        return `FF${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`.toUpperCase();
      })();
      row.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: XLS.text } };
      row.getCell(2).font = { bold: true, name: 'Calibri', size: 10, color: { argb: valueColor } };
      row.getCell(2).alignment = { horizontal: 'right', vertical: 'middle' };
      if (isPercent) row.getCell(2).numFmt = '0.00"%"';
      else if (!isQty) row.getCell(2).numFmt = '"R$"#,##0.00';
      if (hasSecondary) {
        row.getCell(3).numFmt = '"R$"#,##0.00';
        row.getCell(3).font = {
          bold: true,
          name: 'Calibri',
          size: 10,
          color: { argb: XLS.yellow },
        };
        row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };
      }

      const cells = hasSecondary ? [1, 2, 3] : [1, 2];
      for (const col of cells) {
        const cell = row.getCell(col);
        cell.border = thinBorder;
        if (zebra) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: zebra } };
        }
      }
    }
  }

  const defaultPath = path.join(
    getDefaultReportsDir(),
    buildReportExportFileName(report, 'xlsx'),
  );
  const save = await dialog.showSaveDialog({
    title: 'Exportar Excel',
    defaultPath,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  });
  if (save.canceled || !save.filePath) {
    throw new Error('Exportação cancelada.');
  }
  await workbook.xlsx.writeFile(save.filePath);
  return { path: save.filePath };
}
