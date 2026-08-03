import type { ReactNode } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertTriangle,
  Boxes,
  HandCoins,
  Package,
  Plus,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { PeriodPreset } from '@shared/schemas';
import type { MetricBreakdown } from '@shared/types';
import {
  INVENTORY_MOVEMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  EXPENSE_CATEGORY_LABELS,
} from '@shared/constants';
import { Header } from '@/layouts/header';
import { PeriodFilter } from '@/components/shared/period-filter';
import { StatCard } from '@/components/shared/stat-card';
import { MetricBreakdownDialog } from '@/components/shared/metric-breakdown-dialog';
import { LowStockPanel } from '@/components/shared/low-stock-panel';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { FIADO_VALUE_CLASS, formatCurrency, transactionAmountClass, unwrapApi } from '@/utils';
import { CHART_OPACITY, getChartColors } from '@/utils/chart-colors';
import { filterVisibleLowStock } from '@/utils/low-stock-dismiss';
import { useTheme } from '@/contexts/theme-context';

export function DashboardPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const CHART_COLORS = getChartColors(theme);
  const [range, setRange] = useState<{
    preset: PeriodPreset;
    startDate?: string;
    endDate?: string;
  }>({ preset: 'CURRENT_MONTH' });
  const [breakdown, setBreakdown] = useState<MetricBreakdown | null>(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', range],
    queryFn: async () => unwrapApi(await window.cleideApi.dashboard.get(range)),
  });

  function openBreakdown(key: keyof NonNullable<typeof data>['breakdowns']) {
    if (!data) return;
    setBreakdown(data.breakdowns[key]);
  }

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header
        title="Dashboard"
        subtitle="Visão geral da loja em tempo real"
        actions={
          <Button onClick={() => navigate('/vendas?nova=1')}>
            <Plus className="h-4 w-4" /> Nova venda
          </Button>
        }
      />
      <div className="space-y-6 p-6">
        <PeriodFilter
          preset={range.preset}
          startDate={range.startDate}
          endDate={range.endDate}
          onChange={setRange}
        />

        {error ? (
          <Card>
            <CardContent className="p-6 text-destructive">
              {(error as Error).message}
            </CardContent>
          </Card>
        ) : null}

        {isLoading || !data ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <Skeleton className="h-6 w-28" />
              <div className="grid gap-4 sm:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <Skeleton className="h-6 w-28" />
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-28" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Financeiro</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <StatCard
                  title="Faturamento recebido"
                  value={data.cards.monthlyRevenue}
                  money
                  icon={TrendingUp}
                  tone="success"
                  titleBold
                  hint="Clique para detalhar"
                  onClick={() => openBreakdown('monthlyRevenue')}
                />
                <StatCard
                  title="Fiado"
                  value={data.cards.openFiado}
                  money
                  icon={HandCoins}
                  tone="warning"
                  titleBold
                  hint="Clique para detalhar"
                  onClick={() => openBreakdown('openFiado')}
                />
                <div className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-card/90 shadow-soft">
                  <button
                    type="button"
                    className="border-r p-5 text-left transition-colors hover:bg-muted/40"
                    onClick={() => openBreakdown('monthlyExpenses')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Despesas do mês</p>
                        <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-rose-600 dark:text-rose-400">
                          {formatCurrency(data.cards.monthlyExpenses)}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">Clique para detalhar</p>
                      </div>
                      <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                        <TrendingDown className="h-5 w-5" />
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="p-5 text-left transition-colors hover:bg-muted/40"
                    onClick={() => openBreakdown('soldCosts')}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground">Custos</p>
                        <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-rose-600 dark:text-rose-400">
                          {formatCurrency(data.cards.soldCosts)}
                        </p>
                        {Number(data.cards.soldCostsFiado) > 0 ? (
                          <p
                            role="link"
                            tabIndex={0}
                            className="mt-1 text-sm font-semibold text-amber-600 underline-offset-2 hover:underline dark:text-amber-400"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBreakdown('soldCostsFiado');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                e.stopPropagation();
                                openBreakdown('soldCostsFiado');
                              }
                            }}
                          >
                            Em fiado (não pago) {formatCurrency(data.cards.soldCostsFiado)}
                          </p>
                        ) : null}
                        <p className="mt-1 text-xs text-muted-foreground">Clique para detalhar</p>
                      </div>
                      <div className="rounded-xl bg-rose-100 p-2.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-200">
                        <Package className="h-5 w-5" />
                      </div>
                    </div>
                  </button>
                </div>
                <StatCard
                  title="Saldo final"
                  value={data.cards.totalAfterExpenses}
                  money
                  icon={Wallet}
                  tone="silver"
                  titleBold
                  hint="Clique para detalhar"
                  profitWhenPositive
                  pendingValue={data.cards.openFiado}
                  onClick={() => openBreakdown('totalAfterExpenses')}
                />
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight">Produtos</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  title="Produtos cadastrados"
                  value={data.cards.productsCount}
                  icon={Package}
                  hint="Clique para detalhar"
                  onClick={() => navigate('/produtos')}
                />
                <StatCard
                  title="Produtos vendidos"
                  value={data.cards.productsSold}
                  icon={ShoppingBag}
                  hint="Clique para detalhar"
                  onClick={() => navigate('/vendas')}
                />
                <StatCard
                  title="Valor total do estoque"
                  value={data.cards.stockValue}
                  money
                  icon={Boxes}
                  hint="Clique para detalhar"
                  onClick={() => navigate('/estoque')}
                />
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard title="Vendas por período">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={data.charts.salesByPeriod.map((point) => ({
                      ...point,
                      value: Number(point.value),
                      secondaryValue: Number(point.secondaryValue ?? 0),
                    }))}
                  >
                    <defs>
                      <linearGradient id="salesReceived" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.vendas}
                          stopOpacity={CHART_OPACITY.areaStop}
                        />
                        <stop offset="95%" stopColor={CHART_COLORS.vendas} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="salesFiado" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={CHART_COLORS.fiado}
                          stopOpacity={CHART_OPACITY.areaFiadoStop}
                        />
                        <stop offset="95%" stopColor={CHART_COLORS.fiado} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" opacity={CHART_OPACITY.grid} />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(v: number | string, name: string) => [
                        formatCurrency(v),
                        name === 'value' ? 'Valor' : name,
                      ]}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Recebido"
                      stackId="sales"
                      stroke={CHART_COLORS.vendas}
                      fill="url(#salesReceived)"
                      strokeOpacity={CHART_OPACITY.stroke}
                    />
                    <Area
                      type="monotone"
                      dataKey="secondaryValue"
                      name="Fiado pendente"
                      stackId="sales"
                      stroke={CHART_COLORS.fiado}
                      fill="url(#salesFiado)"
                      strokeOpacity={CHART_OPACITY.stroke}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Faturamento mensal">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.charts.monthlyRevenue.map((point) => ({
                      ...point,
                      value: Number(point.value),
                      secondaryValue: Number(point.secondaryValue ?? 0),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={CHART_OPACITY.grid} />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(v: number | string, name: string) => [
                        formatCurrency(v),
                        name === 'value' || name === 'secondaryValue' ? 'Valor' : name,
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Recebido"
                      stackId="revenue"
                      fill={CHART_COLORS.faturamentoSoft}
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar
                      dataKey="secondaryValue"
                      name="Fiado pendente"
                      stackId="revenue"
                      fill={CHART_COLORS.fiadoSoft}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Margem e saldo final">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart
                    data={data.charts.monthlyProfit.map((point) => ({
                      ...point,
                      value: Number(point.value),
                      secondaryValue: Number(point.secondaryValue ?? 0),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={CHART_OPACITY.grid} />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip
                      formatter={(v: number | string, name: string) => [
                        formatCurrency(v),
                        name === 'value'
                          ? 'Margem'
                          : name === 'secondaryValue'
                            ? 'Saldo final'
                            : name,
                      ]}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="value"
                      name="Margem"
                      stroke={CHART_COLORS.lucro}
                      fill={CHART_COLORS.lucroFill}
                      strokeOpacity={CHART_OPACITY.stroke}
                    />
                    <Area
                      type="monotone"
                      dataKey="secondaryValue"
                      name="Saldo final"
                      stroke={CHART_COLORS.faturamento}
                      fill={`${CHART_COLORS.faturamento}33`}
                      strokeOpacity={CHART_OPACITY.stroke}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="Entradas e saídas">
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart
                    data={data.charts.cashFlow.map((point) => ({
                      ...point,
                      value: Number(point.value),
                      secondaryValue: Number(point.secondaryValue ?? 0),
                    }))}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={CHART_OPACITY.grid} />
                    <XAxis dataKey="label" />
                    <YAxis domain={[0, 'auto']} />
                    <Tooltip
                      formatter={(v: number | string, name: string) => [
                        formatCurrency(v),
                        name === 'value'
                          ? 'Entradas'
                          : name === 'secondaryValue'
                            ? 'Saídas'
                            : name,
                      ]}
                    />
                    <Legend />
                    <Bar
                      dataKey="value"
                      name="Entradas"
                      fill={CHART_COLORS.entradasSoft}
                      radius={[8, 8, 0, 0]}
                    />
                    <Bar
                      dataKey="secondaryValue"
                      name="Saídas"
                      fill={CHART_COLORS.saidasSoft}
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <ListCard
                title="Mais vendidos"
                items={data.widgets.topProducts.map((p) => ({
                  id: p.id,
                  title: p.name,
                  meta: `${p.value} un.`,
                  value: p.extra ? formatCurrency(p.extra) : undefined,
                }))}
              />
              <ListCard
                title="Menos vendidos"
                items={data.widgets.bottomProducts.map((p) => ({
                  id: p.id,
                  title: p.name,
                  meta: `${p.value} un.`,
                  value: p.extra ? formatCurrency(p.extra) : undefined,
                }))}
              />
              {filterVisibleLowStock(data.widgets.lowStock).length > 0 ? (
                <LowStockPanel
                  items={data.widgets.lowStock}
                  compact
                  showViewAll
                />
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Estoque baixo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">Nenhum alerta no momento.</p>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid gap-4 xl:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Últimas vendas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.widgets.recentSales.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma venda no período.</p>
                  ) : (
                    data.widgets.recentSales.map((sale) => (
                      <div key={sale.id} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{sale.saleNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {PAYMENT_METHOD_LABELS[sale.paymentMethod]}
                            {sale.isFiadoOpen ? (
                              <span className={FIADO_VALUE_CLASS}>
                                {` · resta ${formatCurrency(sale.fiadoRemaining)}`}
                              </span>
                            ) : null}
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <p
                            className={`text-sm ${transactionAmountClass({
                              isFiadoOpen: sale.isFiadoOpen,
                              status: sale.status,
                            })}`}
                          >
                            {formatCurrency(sale.total)}
                          </p>
                          {sale.isFiadoOpen ? (
                            <Badge className="border-amber-300 bg-amber-100 text-amber-900 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100">
                              Fiado
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Movimentações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.widgets.recentMovements.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{m.productName}</p>
                        <p className="text-xs text-muted-foreground">
                          {INVENTORY_MOVEMENT_LABELS[m.type]}
                        </p>
                      </div>
                      <Badge>{m.quantity}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Despesas recentes</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data.widgets.recentExpenses.map((expense) => (
                    <div key={expense.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <div>
                        <p className="text-sm font-medium">{expense.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {EXPENSE_CATEGORY_LABELS[expense.category]}
                        </p>
                      </div>
                      <p className="text-sm font-semibold">{formatCurrency(expense.amount)}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>

      <MetricBreakdownDialog
        open={Boolean(breakdown)}
        onOpenChange={(open) => {
          if (!open) setBreakdown(null);
        }}
        breakdown={breakdown}
      />
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; meta?: string; value?: string; warning?: boolean }>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem dados no período.</p>
        ) : (
          items.map((item) => (
            <div key={item.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                {item.meta ? <p className="text-xs text-muted-foreground">{item.meta}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                {item.warning ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : null}
                {item.value ? <span className="text-sm font-semibold">{item.value}</span> : null}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
