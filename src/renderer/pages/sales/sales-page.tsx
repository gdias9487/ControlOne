import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Search, Trash2, X, XCircle } from 'lucide-react';
import type { PaymentMethod, SaleCreateInput, SalesListSort } from '@shared/schemas';
import type { SaleDto, ServiceDto } from '@shared/types';
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS, SERVICE_STATUS_LABELS } from '@shared/constants';
import { Header } from '@/layouts/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { CustomerSearchSelect } from '@/components/shared/customer-search-select';
import { CreateProductDialog } from '@/components/shared/create-product-dialog';
import { CreateServiceCatalogDialog } from '@/components/shared/create-service-catalog-dialog';
import { dateInputToIso, todayDateInputValue } from '@/components/shared/date-field';
import { SettleFiadoDialog } from '@/components/shared/settle-fiado-dialog';
import { SaleDetailDialog } from '@/components/shared/sale-detail-dialog';
import { toast } from '@/hooks/use-toast';
import {
  FIADO_VALUE_CLASS,
  formatCurrency,
  toMoneyInput,
  transactionAmountClass,
  unwrapApi,
} from '@/utils';

const NEW_PRODUCT_VALUE = '__new_product__';
const NEW_SERVICE_VALUE = '__new_service__';

type SaleLine = {
  productId: string;
  quantity: number;
  unitPrice: string;
  discountPercent: string;
};

type ServiceLine = {
  catalogId: string;
  name: string;
  description: string;
  amount: string;
  cost: string;
  discountPercent: string;
};

const emptyServiceLine = (): ServiceLine => ({
  catalogId: '',
  name: '',
  description: '',
  amount: '0',
  cost: '0',
  discountPercent: '0',
});

export function SalesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<'sales' | 'services'>('sales');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<SalesListSort>('newest');
  const [status, setStatus] = useState('all');
  const [openSale, setOpenSale] = useState(false);

  useEffect(() => {
    if (searchParams.get('nova') !== '1') return;
    setTab('sales');
    setOpenSale(true);
    const next = new URLSearchParams(searchParams);
    next.delete('nova');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [openService, setOpenService] = useState(false);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [pendingSale, setPendingSale] = useState<SaleCreateInput | null>(null);
  const [createProductOpen, setCreateProductOpen] = useState(false);
  const [createProductLineIndex, setCreateProductLineIndex] = useState<number | null>(null);
  const [createServiceOpen, setCreateServiceOpen] = useState(false);
  const [createServiceLineIndex, setCreateServiceLineIndex] = useState<number | null>(null);

  const [lines, setLines] = useState<SaleLine[]>([
    { productId: '', quantity: 1, unitPrice: '0', discountPercent: '0' },
  ]);
  const [discountPercent, setDiscountPercent] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PIX');
  const [customerId, setCustomerId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [soldAt, setSoldAt] = useState(todayDateInputValue());

  const [serviceLines, setServiceLines] = useState<ServiceLine[]>([emptyServiceLine()]);
  const [serviceDiscountPercent, setServiceDiscountPercent] = useState('0');
  const [servicePaymentMethod, setServicePaymentMethod] = useState<PaymentMethod>('PIX');
  const [serviceCustomerId, setServiceCustomerId] = useState('');
  const [serviceNotes, setServiceNotes] = useState('');
  const [servicePerformedAt, setServicePerformedAt] = useState(todayDateInputValue());
  const [settleService, setSettleService] = useState<{
    id: string;
    total: string;
    remaining: string;
    alreadyPaid: string;
  } | null>(null);
  const [detailSale, setDetailSale] = useState<SaleDto | null>(null);
  const [detailService, setDetailService] = useState<ServiceDto | null>(null);

  const { data: productsData } = useQuery({
    queryKey: ['products-options'],
    queryFn: async () =>
      unwrapApi(
        await window.cleideApi.products.list({
          page: 1,
          pageSize: 100,
          sortBy: 'name',
          sortOrder: 'asc',
          status: 'ACTIVE',
        }),
      ),
  });

  const { data: catalogData } = useQuery({
    queryKey: ['service-catalogs-options'],
    queryFn: async () =>
      unwrapApi(
        await window.cleideApi.serviceCatalogs.list({
          page: 1,
          pageSize: 100,
          status: 'ACTIVE',
        }),
      ),
  });

  const listQueryFilters = useMemo(
    () => ({
      page,
      pageSize: 20,
      search: search.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sort,
      status:
        status === 'all'
          ? undefined
          : (status as 'COMPLETED' | 'CANCELLED' | 'FIADO_OPEN'),
    }),
    [page, search, startDate, endDate, sort, status],
  );

  const { data: sales, isLoading: loadingSales } = useQuery({
    queryKey: ['sales', listQueryFilters],
    queryFn: async () => unwrapApi(await window.cleideApi.sales.list(listQueryFilters)),
    enabled: tab === 'sales',
  });

  const { data: services, isLoading: loadingServices } = useQuery({
    queryKey: ['services', listQueryFilters],
    queryFn: async () => unwrapApi(await window.cleideApi.services.list(listQueryFilters)),
    enabled: tab === 'services',
  });

  const hasActiveFilters =
    Boolean(search.trim()) ||
    Boolean(startDate) ||
    Boolean(endDate) ||
    sort !== 'newest' ||
    status !== 'all';

  function clearFilters() {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setSort('newest');
    setStatus('all');
    setPage(1);
  }

  const products = productsData?.items ?? [];
  const catalog = catalogData?.items ?? [];

  const totals = useMemo(() => {
    let gross = 0;
    let lineDiscounts = 0;
    for (const line of lines) {
      const price = Number(toMoneyInput(line.unitPrice));
      const lineGross = price * line.quantity;
      const linePercent = Math.min(100, Math.max(0, Number(toMoneyInput(line.discountPercent))));
      const lineDisc = (lineGross * linePercent) / 100;
      gross += lineGross;
      lineDiscounts += lineDisc;
    }
    const afterLines = Math.max(0, gross - lineDiscounts);
    const generalPercent = Math.min(100, Math.max(0, Number(toMoneyInput(discountPercent))));
    const generalDisc = (afterLines * generalPercent) / 100;
    const discount = lineDiscounts + generalDisc;
    return {
      subtotal: gross.toFixed(2),
      lineDiscount: lineDiscounts.toFixed(2),
      generalDiscount: generalDisc.toFixed(2),
      discount: discount.toFixed(2),
      total: Math.max(0, gross - discount).toFixed(2),
    };
  }, [lines, discountPercent]);

  const serviceTotals = useMemo(() => {
    let gross = 0;
    let lineDiscounts = 0;
    const lineNets: number[] = [];
    for (const line of serviceLines) {
      const amount = Number(toMoneyInput(line.amount));
      const linePercent = Math.min(100, Math.max(0, Number(toMoneyInput(line.discountPercent))));
      const lineDisc = (amount * linePercent) / 100;
      const net = Math.max(0, amount - lineDisc);
      gross += amount;
      lineDiscounts += lineDisc;
      lineNets.push(net);
    }
    const afterLines = Math.max(0, gross - lineDiscounts);
    const generalPercent = Math.min(100, Math.max(0, Number(toMoneyInput(serviceDiscountPercent))));
    const generalDisc = (afterLines * generalPercent) / 100;
    const discount = lineDiscounts + generalDisc;
    const finalAmounts = lineNets.map((net) => {
      if (afterLines <= 0) return 0;
      const share = (net / afterLines) * generalDisc;
      return Math.max(0, net - share);
    });
    return {
      subtotal: gross.toFixed(2),
      lineDiscount: lineDiscounts.toFixed(2),
      generalDiscount: generalDisc.toFixed(2),
      discount: discount.toFixed(2),
      total: Math.max(0, gross - discount).toFixed(2),
      finalAmounts,
    };
  }, [serviceLines, serviceDiscountPercent]);

  const saleMutation = useMutation({
    mutationFn: async (payload: SaleCreateInput) =>
      unwrapApi(await window.cleideApi.sales.create(payload)),
    onSuccess: (sale) => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      toast({ title: 'Venda registrada' });
      const triggered = sale.lowStockTriggered ?? [];
      if (triggered.length > 0) {
        const critical = triggered.filter((p) => p.urgency === 'critical');
        const names = triggered
          .slice(0, 3)
          .map((p) => p.name)
          .join(', ');
        toast({
          title:
            critical.length > 0
              ? 'Estoque zerado após a venda'
              : 'Estoque baixo após a venda',
          description:
            triggered.length > 3
              ? `${names} e mais ${triggered.length - 3}. Reabasteça em Estoque.`
              : `${names}. Reabasteça em Estoque.`,
          variant: 'destructive',
        });
      }
      setOpenSale(false);
      setPendingSale(null);
      setLines([{ productId: '', quantity: 1, unitPrice: '0', discountPercent: '0' }]);
      setDiscountPercent('0');
      setPaymentMethod('PIX');
      setCustomerId('');
      setNotes('');
      setSoldAt(todayDateInputValue());
    },
    onError: (err: Error, values) => {
      if (err.message.includes('Estoque insuficiente')) {
        setPendingSale(values);
        return;
      }
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => unwrapApi(await window.cleideApi.sales.cancel(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast({ title: 'Venda cancelada e estoque devolvido' });
      setCancelId(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const serviceMutation = useMutation({
    mutationFn: async () => {
      const validLines = serviceLines.filter((line) => line.catalogId);
      if (validLines.length === 0) {
        throw new Error('Adicione ao menos um serviço.');
      }
      if (servicePaymentMethod === 'FIADO' && !serviceCustomerId) {
        throw new Error('Selecione o cliente para serviço fiado.');
      }

      const results = [];
      for (let i = 0; i < serviceLines.length; i += 1) {
        const line = serviceLines[i];
        if (!line.catalogId) continue;
        const finalAmount = serviceTotals.finalAmounts[i] ?? 0;
        results.push(
          await unwrapApi(
            await window.cleideApi.services.create({
              catalogId: line.catalogId,
              name: line.name,
              description: line.description || null,
              amount: finalAmount.toFixed(2),
              cost: toMoneyInput(line.cost),
              discountPercent: '0',
              paymentMethod: servicePaymentMethod,
              customerId: serviceCustomerId || null,
              notes: serviceNotes || null,
              performedAt: dateInputToIso(servicePerformedAt, { preferNowIfToday: true }),
              status: 'COMPLETED',
            }),
          ),
        );
      }
      return results;
    },
    onSuccess: (results) => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({
        title: results.length > 1 ? `${results.length} serviços registrados` : 'Serviço registrado',
      });
      setOpenService(false);
      setServiceLines([emptyServiceLine()]);
      setServiceDiscountPercent('0');
      setServicePaymentMethod('PIX');
      setServiceCustomerId('');
      setServiceNotes('');
      setServicePerformedAt(todayDateInputValue());
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const settleServiceMutation = useMutation({
    mutationFn: async (payload: { id: string; amount: string; remaining: string }) =>
      unwrapApi(
        await window.cleideApi.services.settleFiado({
          id: payload.id,
          amount: toMoneyInput(payload.amount),
        }),
      ),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const paidAll =
        Number(toMoneyInput(variables.amount)) >= Number(variables.remaining);
      toast({ title: paidAll ? 'Fiado quitado' : 'Pagamento parcial registrado' });
      setSettleService(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function updateServiceLine(index: number, patch: Partial<ServiceLine>) {
    setServiceLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function onCatalogSelect(index: number, catalogId: string) {
    if (catalogId === NEW_SERVICE_VALUE) {
      setCreateServiceLineIndex(index);
      setCreateServiceOpen(true);
      return;
    }
    const item = catalog.find((c) => c.id === catalogId);
    updateServiceLine(index, {
      catalogId,
      name: item?.name ?? '',
      description: item?.description ?? '',
      amount: item?.amount ?? '0',
      cost: item?.cost ?? '0',
    });
  }

  function resetServiceForm() {
    setServiceLines([emptyServiceLine()]);
    setServiceDiscountPercent('0');
    setServicePaymentMethod('PIX');
    setServiceCustomerId('');
    setServiceNotes('');
    setServicePerformedAt(todayDateInputValue());
  }

  function updateLine(index: number, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function onProductSelect(index: number, productId: string) {
    if (productId === NEW_PRODUCT_VALUE) {
      setCreateProductLineIndex(index);
      setCreateProductOpen(true);
      return;
    }
    const product = products.find((p) => p.id === productId);
    updateLine(index, {
      productId,
      unitPrice: product?.salePrice ?? '0',
    });
  }

  function submitSale(allowNegativeStock = false) {
    if (paymentMethod === 'FIADO' && !customerId) {
      toast({
        title: 'Cliente obrigatório',
        description: 'Selecione o cliente para venda fiada.',
        variant: 'destructive',
      });
      return;
    }
    if (lines.some((l) => !l.productId)) {
      toast({
        title: 'Produto obrigatório',
        description: 'Selecione o produto em todas as linhas antes de finalizar.',
        variant: 'destructive',
      });
      return;
    }
    const items = lines
      .filter((l) => l.productId && l.quantity > 0)
      .map((l) => ({
        productId: l.productId,
        quantity: l.quantity,
        unitPrice: toMoneyInput(l.unitPrice),
        discountPercent: toMoneyInput(l.discountPercent),
      }));
    if (items.length === 0) {
      toast({
        title: 'Nenhum produto',
        description: 'Adicione ao menos um produto para finalizar a venda.',
        variant: 'destructive',
      });
      return;
    }
    saleMutation.mutate({
      items,
      discountPercent: toMoneyInput(discountPercent),
      paymentMethod,
      customerId: customerId || null,
      notes,
      soldAt: dateInputToIso(soldAt, { preferNowIfToday: true }),
      allowNegativeStock,
    });
  }

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Vendas" subtitle="Vendas de produtos e serviços prestados" />
      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant={tab === 'sales' ? 'accent' : 'outline'}
            onClick={() => {
              setTab('sales');
              setPage(1);
            }}
          >
            Vendas
          </Button>
          <Button
            variant={tab === 'services' ? 'accent' : 'outline'}
            onClick={() => {
              setTab('services');
              setPage(1);
            }}
          >
            Serviços prestados
          </Button>
          <div className="ml-auto">
            {tab === 'sales' ? (
              <Button onClick={() => setOpenSale(true)}><Plus className="h-4 w-4" /> Nova venda</Button>
            ) : (
              <Button onClick={() => setOpenService(true)}><Plus className="h-4 w-4" /> Registrar serviço</Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder={
                tab === 'sales'
                  ? 'Buscar por código, cliente ou produto...'
                  : 'Buscar por serviço, código ou cliente...'
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Input
            className="w-[150px]"
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              setPage(1);
            }}
            title="Data inicial"
            aria-label="Data inicial"
          />
          <Input
            className="w-[150px]"
            type="date"
            value={endDate}
            onChange={(e) => {
              setEndDate(e.target.value);
              setPage(1);
            }}
            title="Data final"
            aria-label="Data final"
          />
          <Select
            value={sort}
            onValueChange={(v) => {
              setSort(v as SalesListSort);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Ordenação" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigas</SelectItem>
              <SelectItem value="amount_desc">Valor decrescente</SelectItem>
              <SelectItem value="amount_asc">Valor crescente</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="COMPLETED">
                {tab === 'sales' ? 'Concluída' : 'Concluído'}
              </SelectItem>
              <SelectItem value="CANCELLED">
                {tab === 'sales' ? 'Cancelada' : 'Cancelado'}
              </SelectItem>
              <SelectItem value="FIADO_OPEN">Fiado</SelectItem>
            </SelectContent>
          </Select>
          {hasActiveFilters ? (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              onClick={clearFilters}
              aria-label="Limpar filtros"
              title="Limpar filtros"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        {tab === 'sales' ? (
          loadingSales ? (
            <p className="text-sm text-muted-foreground">Carregando vendas...</p>
          ) : !sales?.items.length ? (
            <EmptyState
              title="Nenhuma venda"
              description={
                hasActiveFilters
                  ? 'Nenhum resultado para os filtros selecionados.'
                  : 'Registre a primeira venda da loja.'
              }
              actionLabel={hasActiveFilters ? undefined : 'Nova venda'}
              onAction={hasActiveFilters ? undefined : () => setOpenSale(true)}
            />
          ) : (
            <>
              <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="p-3">Número</th>
                      <th className="p-3">Data</th>
                      <th className="p-3">Cliente</th>
                      <th className="p-3">Pagamento</th>
                      <th className="p-3">Total</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.items.map((sale) => (
                      <tr key={sale.id} className="border-t">
                        <td className="p-3 font-medium">
                          <button
                            type="button"
                            className="text-left text-primary underline-offset-2 hover:underline"
                            onClick={() => setDetailSale(sale)}
                          >
                            {sale.saleNumber}
                          </button>
                        </td>
                        <td className="p-3">{new Date(sale.soldAt).toLocaleString('pt-BR')}</td>
                        <td className="p-3">{sale.customerName ?? '—'}</td>
                        <td className="p-3">{PAYMENT_METHOD_LABELS[sale.paymentMethod]}</td>
                        <td className="p-3">
                          <div
                            className={transactionAmountClass({
                              isFiadoOpen: sale.isFiadoOpen,
                              status: sale.status,
                            })}
                          >
                            {formatCurrency(sale.total)}
                          </div>
                        </td>
                        <td className="p-3">
                          {sale.isFiadoOpen ? (
                            <Badge variant="warning">
                              {Number(sale.fiadoPaidAmount) > 0 ? 'Fiado parcial' : 'Fiado aberto'}
                            </Badge>
                          ) : sale.paymentMethod === 'FIADO' && sale.fiadoPaidAt ? (
                            <Badge variant="success">Fiado pago</Badge>
                          ) : (
                            <Badge variant={sale.status === 'COMPLETED' ? 'success' : 'muted'}>
                              {SALE_STATUS_LABELS[sale.status]}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3">
                          {sale.status === 'COMPLETED' ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                              onClick={() => setCancelId(sale.id)}
                            >
                              <XCircle className="h-4 w-4" /> Cancelar
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {sales.totalPages > 1 ? (
                <div className="flex items-center justify-center gap-3">
                  <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    Anterior
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Página {page} de {sales.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= sales.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              ) : null}
            </>
          )
        ) : loadingServices ? (
          <p className="text-sm text-muted-foreground">Carregando serviços...</p>
        ) : !services?.items.length ? (
          <EmptyState
            title="Nenhum serviço prestado"
            description={
              hasActiveFilters
                ? 'Nenhum resultado para os filtros selecionados.'
                : 'Registre aqui os serviços prestados. Se o serviço ainda não existir, você pode cadastrá-lo na hora.'
            }
            actionLabel={hasActiveFilters ? undefined : 'Registrar serviço'}
            onAction={hasActiveFilters ? undefined : () => setOpenService(true)}
          />
        ) : (
          <>
            <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3">Serviço</th>
                    <th className="p-3">Data</th>
                    <th className="p-3">Cliente</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {services.items.map((service) => (
                    <tr key={service.id} className="border-t">
                      <td className="p-3 font-medium">
                        <button
                          type="button"
                          className="text-left text-primary underline-offset-2 hover:underline"
                          onClick={() => setDetailService(service)}
                        >
                          {service.name}
                        </button>
                      </td>
                      <td className="p-3">{new Date(service.performedAt).toLocaleString('pt-BR')}</td>
                      <td className="p-3">{service.customerName ?? '—'}</td>
                      <td className="p-3">{PAYMENT_METHOD_LABELS[service.paymentMethod]}</td>
                      <td className="p-3">
                        <div
                          className={transactionAmountClass({
                            isFiadoOpen: service.isFiadoOpen,
                            status: service.status,
                          })}
                        >
                          {formatCurrency(service.amount)}
                        </div>
                        {service.isFiadoOpen && Number(service.fiadoPaidAmount) > 0 ? (
                          <div className={`text-xs ${FIADO_VALUE_CLASS}`}>
                            Resta {formatCurrency(service.fiadoRemaining)}
                          </div>
                        ) : null}
                      </td>
                      <td className="p-3">
                        {service.isFiadoOpen ? (
                          <Badge variant="warning">
                            {Number(service.fiadoPaidAmount) > 0 ? 'Fiado parcial' : 'Fiado aberto'}
                          </Badge>
                        ) : service.paymentMethod === 'FIADO' && service.fiadoPaidAt ? (
                          <Badge variant="success">Fiado pago</Badge>
                        ) : (
                          <Badge variant={service.status === 'COMPLETED' ? 'success' : 'muted'}>
                            {SERVICE_STATUS_LABELS[service.status]}
                          </Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {service.isFiadoOpen ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSettleService({
                                id: service.id,
                                total: service.amount,
                                remaining: service.fiadoRemaining,
                                alreadyPaid: service.fiadoPaidAmount,
                              })
                            }
                          >
                            Pagar fiado
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {services.totalPages > 1 ? (
              <div className="flex items-center justify-center gap-3">
                <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {page} de {services.totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= services.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Dialog open={openSale} onOpenChange={setOpenSale}>
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Nova venda</DialogTitle>
            <DialogDescription>
              Os preços ficam salvos mesmo se o produto mudar depois. Você também pode aplicar um
              desconto geral na compra.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="hidden shrink-0 gap-2 px-3 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1fr_70px_100px_90px_40px]">
              <span>Nome do produto</span>
              <span>Qntd.</span>
              <span>Valor</span>
              <span>Desconto (%)</span>
              <span className="sr-only">Remover</span>
            </div>
            <div className="max-h-[28rem] min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {lines.map((line, index) => {
                const selectedElsewhere = new Set(
                  lines
                    .filter((_, i) => i !== index)
                    .map((l) => l.productId)
                    .filter(Boolean),
                );
                const availableProducts = products.filter(
                  (p) => p.id === line.productId || !selectedElsewhere.has(p.id),
                );

                return (
                  <div
                    key={index}
                    className="grid gap-2 rounded-xl border bg-muted/20 p-3 md:grid-cols-[1fr_70px_100px_90px_40px] md:items-center"
                  >
                    <div className="space-y-1">
                      <Label className="md:hidden">Nome do produto</Label>
                      <Select value={line.productId} onValueChange={(v) => onProductSelect(index, v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Produto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NEW_PRODUCT_VALUE}>
                            <span className="flex items-center gap-2 text-primary">
                              <Plus className="h-3.5 w-3.5" />
                              Cadastrar novo produto
                            </span>
                          </SelectItem>
                          {availableProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="md:hidden">Qntd.</Label>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) => updateLine(index, { quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="md:hidden">Valor</Label>
                      <Input
                        value={line.unitPrice}
                        onChange={(e) => updateLine(index, { unitPrice: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="md:hidden">Desconto (%)</Label>
                      <Input
                        value={line.discountPercent}
                        onChange={(e) => updateLine(index, { discountPercent: e.target.value })}
                        inputMode="decimal"
                        placeholder="0"
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="justify-self-end text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 md:justify-self-center"
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                      disabled={lines.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <div className="shrink-0 space-y-3 border-t pt-3">
            <Button
              variant="outline"
              onClick={() =>
                setLines((prev) => [
                  ...prev,
                  { productId: '', quantity: 1, unitPrice: '0', discountPercent: '0' },
                ])
              }
              disabled={products.length > 0 && lines.filter((l) => l.productId).length >= products.length}
            >
              Adicionar item
            </Button>
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-[4.25rem_9.5rem_9.5rem_minmax(0,1fr)]">
              <div className="space-y-1">
                <Label className="text-xs">Desc. (%)</Label>
                <Input
                  className="h-9 px-1.5 text-center text-sm"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(e.target.value)}
                  inputMode="decimal"
                  placeholder="0"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Pagamento</Label>
                <Select
                  value={paymentMethod}
                  onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                >
                  <SelectTrigger className="h-9 px-2 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Data</Label>
                <Input
                  className="h-9 px-2 text-sm"
                  type="date"
                  value={soldAt}
                  onChange={(e) => setSoldAt(e.target.value)}
                />
              </div>
              <CustomerSearchSelect
                compact
                value={customerId}
                onChange={setCustomerId}
                required={paymentMethod === 'FIADO'}
                label="Cliente"
              />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="rounded-xl bg-muted/50 p-3 text-sm">
              <p>Subtotal: {formatCurrency(totals.subtotal)}</p>
              {Number(totals.lineDiscount) > 0 ? (
                <p>Desconto por produto: −{formatCurrency(totals.lineDiscount)}</p>
              ) : null}
              {Number(totals.generalDiscount) > 0 ? (
                <p>
                  Desconto geral: −{formatCurrency(totals.generalDiscount)} (
                  {toMoneyInput(discountPercent)}%)
                </p>
              ) : null}
              <p className="font-semibold">Total: {formatCurrency(totals.total)}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenSale(false)}>Cancelar</Button>
              <Button
                onClick={() => submitSale(false)}
                disabled={lines.some((l) => !l.productId) || lines.every((l) => l.quantity <= 0)}
              >
                Finalizar venda
              </Button>
            </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <CreateProductDialog
        open={createProductOpen}
        onOpenChange={(open) => {
          setCreateProductOpen(open);
          if (!open) setCreateProductLineIndex(null);
        }}
        onCreated={(product) => {
          if (createProductLineIndex == null) return;
          updateLine(createProductLineIndex, {
            productId: product.id,
            unitPrice: product.salePrice,
          });
          setCreateProductLineIndex(null);
        }}
      />

      <CreateServiceCatalogDialog
        open={createServiceOpen}
        onOpenChange={(open) => {
          setCreateServiceOpen(open);
          if (!open) setCreateServiceLineIndex(null);
        }}
        onCreated={(service) => {
          if (createServiceLineIndex == null) return;
          updateServiceLine(createServiceLineIndex, {
            catalogId: service.id,
            name: service.name,
            description: service.description ?? '',
            amount: service.amount,
            cost: service.cost,
          });
          setCreateServiceLineIndex(null);
        }}
      />

      <Dialog
        open={openService}
        onOpenChange={(open) => {
          setOpenService(open);
          if (!open) resetServiceForm();
        }}
      >
        <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-4 overflow-hidden">
          <DialogHeader className="shrink-0">
            <DialogTitle>Registrar serviços prestados</DialogTitle>
            <DialogDescription>
              Você pode registrar mais de um serviço de uma vez. Se o serviço não existir, cadastre
              na hora. O valor vem do cadastro e pode ser ajustado.
            </DialogDescription>
          </DialogHeader>
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="hidden shrink-0 gap-2 px-3 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1fr_100px_100px_90px_40px]">
              <span>Serviço</span>
              <span>Valor</span>
              <span>Custo</span>
              <span>Desconto (%)</span>
              <span className="sr-only">Remover</span>
            </div>
            <div className="max-h-[28rem] min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {serviceLines.map((line, index) => (
                <div
                  key={index}
                  className="grid gap-2 rounded-xl border bg-muted/20 p-3 md:grid-cols-[1fr_100px_100px_90px_40px] md:items-center"
                >
                  <div className="space-y-1">
                    <Label className="md:hidden">Serviço</Label>
                    <Select
                      value={line.catalogId}
                      onValueChange={(v) => onCatalogSelect(index, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NEW_SERVICE_VALUE}>
                          <span className="flex items-center gap-2 text-primary">
                            <Plus className="h-3.5 w-3.5" />
                            Cadastrar novo serviço
                          </span>
                        </SelectItem>
                        {catalog.map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.name} — {formatCurrency(item.amount)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden">Valor</Label>
                    <Input
                      value={line.amount}
                      onChange={(e) => updateServiceLine(index, { amount: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden">Custo</Label>
                    <Input
                      value={line.cost}
                      onChange={(e) => updateServiceLine(index, { cost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="md:hidden">Desconto (%)</Label>
                    <Input
                      value={line.discountPercent}
                      onChange={(e) =>
                        updateServiceLine(index, { discountPercent: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="justify-self-end text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:text-rose-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300 md:justify-self-center"
                    onClick={() =>
                      setServiceLines((prev) => prev.filter((_, i) => i !== index))
                    }
                    disabled={serviceLines.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="shrink-0 space-y-3 border-t pt-3">
              <Button
                variant="outline"
                onClick={() => setServiceLines((prev) => [...prev, emptyServiceLine()])}
              >
                Adicionar serviço
              </Button>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-[4.25rem_9.5rem_9.5rem_minmax(0,1fr)]">
                <div className="space-y-1">
                  <Label className="text-xs">Desc. (%)</Label>
                  <Input
                    className="h-9 px-1.5 text-center text-sm"
                    value={serviceDiscountPercent}
                    onChange={(e) => setServiceDiscountPercent(e.target.value)}
                    inputMode="decimal"
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Pagamento</Label>
                  <Select
                    value={servicePaymentMethod}
                    onValueChange={(v) => setServicePaymentMethod(v as PaymentMethod)}
                  >
                    <SelectTrigger className="h-9 px-2 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data</Label>
                  <Input
                    className="h-9 px-2 text-sm"
                    type="date"
                    value={servicePerformedAt}
                    onChange={(e) => setServicePerformedAt(e.target.value)}
                  />
                </div>
                <CustomerSearchSelect
                  compact
                  value={serviceCustomerId}
                  onChange={setServiceCustomerId}
                  required={servicePaymentMethod === 'FIADO'}
                  label="Cliente"
                />
              </div>
              <div className="space-y-2">
                <Label>Observação</Label>
                <Textarea
                  value={serviceNotes}
                  onChange={(e) => setServiceNotes(e.target.value)}
                />
              </div>
              <div className="rounded-xl bg-muted/50 p-3 text-sm">
                <p>Subtotal: {formatCurrency(serviceTotals.subtotal)}</p>
                {Number(serviceTotals.lineDiscount) > 0 ? (
                  <p>Desconto por serviço: −{formatCurrency(serviceTotals.lineDiscount)}</p>
                ) : null}
                {Number(serviceTotals.generalDiscount) > 0 ? (
                  <p>
                    Desconto geral: −{formatCurrency(serviceTotals.generalDiscount)} (
                    {toMoneyInput(serviceDiscountPercent)}%)
                  </p>
                ) : null}
                <p className="font-semibold">Total: {formatCurrency(serviceTotals.total)}</p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setOpenService(false)}>
                  Cancelar
                </Button>
                <Button
                  onClick={() => serviceMutation.mutate()}
                  disabled={
                    serviceMutation.isPending || serviceLines.some((l) => !l.catalogId)
                  }
                >
                  Registrar
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(cancelId)}
        onOpenChange={(o) => !o && setCancelId(null)}
        title="Cancelar venda?"
        description="Os itens voltarão automaticamente para o estoque."
        confirmLabel="Cancelar venda"
        onConfirm={() => cancelId && cancelMutation.mutate(cancelId)}
      />

      <ConfirmDialog
        open={Boolean(pendingSale)}
        onOpenChange={(o) => !o && setPendingSale(null)}
        title="Estoque insuficiente"
        description="Deseja concluir a venda mesmo com estoque negativo?"
        confirmLabel="Permitir negativo"
        onConfirm={() => pendingSale && saleMutation.mutate({ ...pendingSale, allowNegativeStock: true })}
      />

      <SaleDetailDialog
        sale={detailSale}
        open={Boolean(detailSale)}
        onOpenChange={(o) => !o && setDetailSale(null)}
      />

      <Dialog open={Boolean(detailService)} onOpenChange={(o) => !o && setDetailService(null)}>        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Detalhes do serviço
              {detailService ? (
                detailService.isFiadoOpen ? (
                  <Badge variant="warning">
                    {Number(detailService.fiadoPaidAmount) > 0 ? 'Fiado parcial' : 'Fiado aberto'}
                  </Badge>
                ) : detailService.paymentMethod === 'FIADO' && detailService.fiadoPaidAt ? (
                  <Badge variant="success">Fiado pago</Badge>
                ) : (
                  <Badge variant={detailService.status === 'COMPLETED' ? 'success' : 'muted'}>
                    {SERVICE_STATUS_LABELS[detailService.status]}
                  </Badge>
                )
              ) : null}
            </DialogTitle>
            <DialogDescription>
              {detailService
                ? `${new Date(detailService.performedAt).toLocaleString('pt-BR')} · ${
                    detailService.customerName ?? 'Sem cliente'
                  } · ${PAYMENT_METHOD_LABELS[detailService.paymentMethod]}`
                : null}
            </DialogDescription>
          </DialogHeader>
          {detailService ? (
            <div className="space-y-4">
              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-muted-foreground">
                    <tr>
                      <th className="p-3">Serviço</th>
                      <th className="p-3">Custo</th>
                      <th className="p-3">Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-t">
                      <td className="p-3 font-medium">{detailService.name}</td>
                      <td className="p-3">{formatCurrency(detailService.cost)}</td>
                      <td className="p-3">{formatCurrency(detailService.amount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div
                className={
                  detailService.isFiadoOpen
                    ? 'space-y-1 rounded-xl bg-amber-200 p-3 text-sm text-amber-950 dark:bg-amber-700/50 dark:text-amber-50'
                    : detailService.status === 'COMPLETED'
                      ? 'space-y-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
                      : 'space-y-1 rounded-xl bg-muted/50 p-3 text-sm'
                }
              >
                <p
                  className={transactionAmountClass({
                    isFiadoOpen: detailService.isFiadoOpen,
                    status: detailService.status,
                  })}
                >
                  Total: {formatCurrency(detailService.amount)}
                </p>
                {detailService.isFiadoOpen ? (
                  <p className={FIADO_VALUE_CLASS}>
                    Resta {formatCurrency(detailService.fiadoRemaining)}
                    {Number(detailService.fiadoPaidAmount) > 0
                      ? ` · Já pago ${formatCurrency(detailService.fiadoPaidAmount)}`
                      : ''}
                  </p>
                ) : null}
                {detailService.description ? (
                  <p className="opacity-80">{detailService.description}</p>
                ) : null}
                {detailService.notes ? (
                  <p className="opacity-80">Obs.: {detailService.notes}</p>
                ) : null}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <SettleFiadoDialog
        open={Boolean(settleService)}
        onOpenChange={(o) => !o && setSettleService(null)}
        title="Pagar fiado do serviço"
        total={settleService?.total ?? '0'}
        remaining={settleService?.remaining ?? '0'}
        alreadyPaid={settleService?.alreadyPaid ?? '0'}
        pending={settleServiceMutation.isPending}
        onConfirm={(amount) => {
          if (!settleService) return;
          settleServiceMutation.mutate({
            id: settleService.id,
            amount,
            remaining: settleService.remaining,
          });
        }}
      />
    </div>
  );
}
