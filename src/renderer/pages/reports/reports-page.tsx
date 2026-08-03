import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FileDown, FileSpreadsheet } from 'lucide-react';
import type { PeriodPreset, ReportFiltersInput } from '@shared/schemas';
import { Header } from '@/layouts/header';
import { PeriodFilter } from '@/components/shared/period-filter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import {
  EXPENSE_VALUE_CLASS,
  FIADO_VALUE_CLASS,
  formatCurrency,
  INCOME_VALUE_CLASS,
  unwrapApi,
} from '@/utils';
import { CHART_OPACITY, getChartColors } from '@/utils/chart-colors';
import { useTheme } from '@/contexts/theme-context';

const PRODUCT_MARGINS_CHART_PREVIEW = 12;

type ChartPalette = ReturnType<typeof getChartColors>;

/** Cores do gráfico alinhadas aos cards (recebido/margem=verde, custos/despesas=vermelho, fiado=amarelo). */
function chartBarColor(
  colors: ChartPalette,
  label: string,
  value: number,
  opts?: { expenseCategories?: boolean },
): string {
  if (opts?.expenseCategories) return colors.saidasSoft;
  const l = label.toLowerCase();
  if (l.includes('fiado')) return colors.fiadoSoft;
  if (l.includes('custo') || l.includes('despesa') || l.includes('saíd')) {
    return colors.saidasSoft;
  }
  if (
    l.includes('recebido') ||
    l.includes('margem') ||
    l.includes('saldo') ||
    l.includes('lucro') ||
    l.includes('faturamento') ||
    l.includes('receita') ||
    l.includes('entrada')
  ) {
    return value < 0 ? colors.saidasSoft : colors.entradasSoft;
  }
  return colors.faturamentoSoft;
}

const MAIN_SUMMARY_IDS = [
  'received',
  'openFiado',
  'costs',
  'profit',
  'expenses',
  'totalAfterExpenses',
] as const;

const REPORTS_WITHOUT_FINANCIAL_CARDS = new Set<
  NonNullable<ReportFiltersInput['reportType']>
>(['TOP_PRODUCTS', 'STALE_PRODUCTS', 'INVENTORY_HISTORY', 'STOCK_VALUE']);

const QUANTITY_CHART_REPORTS = new Set<NonNullable<ReportFiltersInput['reportType']>>([
  'TOP_PRODUCTS',
]);

const PERCENT_CHART_REPORTS = new Set<NonNullable<ReportFiltersInput['reportType']>>([
  'PRODUCT_MARGINS',
]);

function summaryValueClass(id: string, value: string | number): string | undefined {
  if (id === 'received' || id === 'stock') return INCOME_VALUE_CLASS;
  if (id === 'openFiado') return FIADO_VALUE_CLASS;
  if (id === 'expenses' || id === 'costs') return EXPENSE_VALUE_CLASS;
  if (id === 'profit' || id === 'totalAfterExpenses') {
    const n = Number(value);
    if (Number.isFinite(n) && n < 0) return EXPENSE_VALUE_CLASS;
    if (Number.isFinite(n) && n > 0) return INCOME_VALUE_CLASS;
  }
  return undefined;
}

const REPORT_TYPES: Array<{
  value: NonNullable<ReportFiltersInput['reportType']>;
  label: string;
}> = [
  { value: 'DAILY_REVENUE', label: 'Faturamento por dia' },
  { value: 'MONTHLY_REVENUE', label: 'Faturamento do período' },
  { value: 'MONTHLY_EXPENSES', label: 'Despesas do período' },
  { value: 'TOP_PRODUCTS', label: 'Produtos mais vendidos' },
  { value: 'STALE_PRODUCTS', label: 'Produtos parados' },
  { value: 'PAYMENT_METHODS', label: 'Vendas por forma de pagamento' },
  { value: 'INVENTORY_HISTORY', label: 'Histórico de movimentações' },
  { value: 'STOCK_VALUE', label: 'Valor total do estoque' },
  { value: 'PRODUCT_MARGINS', label: 'Margem de lucro por produto' },
  { value: 'SERVICE_REVENUE', label: 'Receita com serviços' },
];

function chartTitleFor(
  reportType: ReportFiltersInput['reportType'],
  reportTitle: string,
): string {
  switch (reportType) {
    case 'DAILY_REVENUE':
      return 'Recebido e fiado por dia';
    case 'MONTHLY_REVENUE':
    case 'SERVICE_REVENUE':
      return 'Indicadores do período';
    case 'MONTHLY_EXPENSES':
      return 'Despesas por categoria';
    case 'PAYMENT_METHODS':
      return 'Distribuição por forma de pagamento';
    case 'TOP_PRODUCTS':
      return 'Quantidade vendida por produto';
    case 'PRODUCT_MARGINS':
      return 'Margem de lucro (%) por produto';
    case 'STOCK_VALUE':
      return 'Valor em estoque';
    case 'INVENTORY_HISTORY':
      return 'Movimentações do período';
    case 'STALE_PRODUCTS':
      return 'Produtos sem saída';
    default:
      return reportTitle;
  }
}

function formatCell(value: string | number): string {
  if (typeof value === 'number') return String(value);
  if (/^\d+\.\d{2}$/.test(value)) return formatCurrency(value);
  return value;
}

function isMoneySummary(name: string): boolean {
  const lower = name.toLowerCase();
  return !(
    lower.includes('vendas') ||
    lower.includes('serviços') ||
    lower.includes('itens') ||
    lower.includes('parados') ||
    lower.includes('moviment')
  );
}

export function ReportsPage() {
  const { theme } = useTheme();
  const CHART_COLORS = getChartColors(theme);
  const [filters, setFilters] = useState<ReportFiltersInput>({
    preset: 'CURRENT_MONTH',
    reportType: 'MONTHLY_REVENUE',
  });
  const [showAllProducts, setShowAllProducts] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['reports', filters],
    queryFn: async () => unwrapApi(await window.cleideApi.reports.get(filters)),
  });

  const exportPdf = useMutation({
    mutationFn: async () => unwrapApi(await window.cleideApi.reports.exportPdf(filters)),
    onSuccess: (result) => toast({ title: 'PDF exportado', description: result.path }),
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const exportExcel = useMutation({
    mutationFn: async () => unwrapApi(await window.cleideApi.reports.exportExcel(filters)),
    onSuccess: (result) => toast({ title: 'Excel exportado', description: result.path }),
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const isProductMargins = filters.reportType === 'PRODUCT_MARGINS';
  const columns = data?.rows[0] ? Object.keys(data.rows[0]) : [];
  const chartDataFull =
    data?.charts.map((point) => ({
      label: point.label,
      valor: Number(point.value),
      secundario: Number(point.secondaryValue ?? 0),
    })) ?? [];
  const chartData =
    isProductMargins && !showAllProducts
      ? chartDataFull.slice(0, PRODUCT_MARGINS_CHART_PREVIEW)
      : chartDataFull;
  const showSecondary = chartData.some((p) => p.secundario > 0);
  const expenseCategories = filters.reportType === 'MONTHLY_EXPENSES';
  const quantityChart = QUANTITY_CHART_REPORTS.has(
    filters.reportType ?? 'MONTHLY_REVENUE',
  );
  const percentChart = PERCENT_CHART_REPORTS.has(filters.reportType ?? 'MONTHLY_REVENUE');

  function formatChartValue(v: number | string): string {
    if (quantityChart) return String(v);
    if (percentChart) {
      const n = Number(v);
      return Number.isFinite(n) ? `${n.toFixed(2)}%` : `${v}%`;
    }
    return formatCurrency(v);
  }

  const primaryBarName = showSecondary
    ? 'Recebido'
    : quantityChart
      ? 'Quantidade'
      : percentChart
        ? 'Margem %'
        : 'Valor';
  const chartHeight = isProductMargins && showAllProducts && chartData.length > 12 ? 360 : 280;

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Relatórios" subtitle="Análises e exportação PDF/Excel" />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filters.reportType ?? 'MONTHLY_REVENUE'}
            onValueChange={(v) => {
              const reportType = v as ReportFiltersInput['reportType'];
              setFilters((f) => ({ ...f, reportType }));
              if (reportType !== 'PRODUCT_MARGINS') setShowAllProducts(false);
            }}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REPORT_TYPES.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => void refetch()}>
            Atualizar
          </Button>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => exportPdf.mutate()}>
              <FileDown className="h-4 w-4" /> PDF
            </Button>
            <Button variant="secondary" onClick={() => exportExcel.mutate()}>
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </div>
        </div>
        <PeriodFilter
          preset={filters.preset ?? 'CURRENT_MONTH'}
          startDate={filters.startDate}
          endDate={filters.endDate}
          onChange={(range) =>
            setFilters((f) => ({
              ...f,
              preset: range.preset as PeriodPreset,
              startDate: range.startDate,
              endDate: range.endDate,
            }))
          }
        />

        {isLoading || !data ? (
          <p className="text-sm text-muted-foreground">Gerando relatório...</p>
        ) : (
          <>
            {!REPORTS_WITHOUT_FINANCIAL_CARDS.has(filters.reportType ?? 'MONTHLY_REVENUE') ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
                {data.summary
                  .filter((item) =>
                    (MAIN_SUMMARY_IDS as readonly string[]).includes(item.id),
                  )
                  .map((item) => (
                  <Card key={item.id} className="border-border/80 bg-card/90 shadow-soft">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {item.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent
                      className={`text-xl tracking-tight ${summaryValueClass(item.id, item.value) ?? 'font-semibold'}`}
                    >
                      {typeof item.value === 'number' || !isMoneySummary(item.name)
                        ? item.value
                        : formatCurrency(item.value)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {data.summary
                .filter(
                  (item) => !(MAIN_SUMMARY_IDS as readonly string[]).includes(item.id),
                )
                .slice(0, 4)
                .map((item) => (
                  <Card key={item.id} className="border-border/80 bg-card/90 shadow-soft">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        {item.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent
                      className={`text-xl tracking-tight ${summaryValueClass(item.id, item.value) ?? 'font-semibold'}`}
                    >
                      {typeof item.value === 'number' || !isMoneySummary(item.name)
                        ? item.value
                        : formatCurrency(item.value)}
                    </CardContent>
                  </Card>
                ))}
            </div>

            {chartData.length > 0 ? (
              <Card className="border-border/80 bg-card/90 shadow-soft">
                <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
                  <CardTitle>
                    {chartTitleFor(filters.reportType, data.title)}
                  </CardTitle>
                  {isProductMargins ? (
                    <div className="flex items-center gap-2">
                      <Switch
                        id="show-all-products"
                        checked={showAllProducts}
                        onCheckedChange={setShowAllProducts}
                      />
                      <Label htmlFor="show-all-products" className="text-sm font-normal">
                        Listar todos os produtos
                        {!showAllProducts && chartDataFull.length > PRODUCT_MARGINS_CHART_PREVIEW
                          ? ` (top ${PRODUCT_MARGINS_CHART_PREVIEW})`
                          : ` (${chartDataFull.length})`}
                      </Label>
                    </div>
                  ) : null}
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={chartHeight}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={CHART_OPACITY.grid} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: chartData.length > 16 ? 9 : 11 }}
                        interval={0}
                        angle={chartData.length > 12 ? -35 : 0}
                        textAnchor={chartData.length > 12 ? 'end' : 'middle'}
                        height={chartData.length > 12 ? 70 : 30}
                      />
                      <YAxis
                        domain={[0, 'auto']}
                        tick={{ fontSize: 11 }}
                        tickFormatter={
                          percentChart ? (v: number) => `${v}%` : undefined
                        }
                      />
                      <Tooltip
                        formatter={(v: number | string, name: string) => [
                          formatChartValue(v),
                          name,
                        ]}
                      />
                      {showSecondary ? <Legend /> : null}
                      <Bar
                        dataKey="valor"
                        name={primaryBarName}
                        fill={CHART_COLORS.faturamentoSoft}
                        stackId={showSecondary ? 'day' : undefined}
                        radius={showSecondary ? [0, 0, 0, 0] : [8, 8, 0, 0]}
                      >
                        {chartData.map((point) => (
                          <Cell
                            key={point.label}
                            fill={
                              showSecondary || quantityChart || percentChart
                                ? CHART_COLORS.entradasSoft
                                : chartBarColor(CHART_COLORS, point.label, point.valor, {
                                    expenseCategories,
                                  })
                            }
                          />
                        ))}
                      </Bar>
                      {showSecondary ? (
                        <Bar
                          dataKey="secundario"
                          name="Fiado"
                          stackId="day"
                          fill={CHART_COLORS.fiadoSoft}
                          radius={[8, 8, 0, 0]}
                        />
                      ) : null}
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            ) : null}

            <Card className="border-border/80 bg-card/90 shadow-soft">
              <CardHeader>
                <CardTitle>Detalhamento</CardTitle>
              </CardHeader>
              <CardContent>
                {data.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados para o período.</p>
                ) : (
                  <div className="overflow-auto rounded-xl border bg-background/60">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          {columns.map((col) => (
                            <th key={col} className="p-3 font-medium">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.rows.map((row, index) => (
                          <tr key={index} className="border-t">
                            {columns.map((col) => (
                              <td key={col} className="p-3">
                                {formatCell(row[col])}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
