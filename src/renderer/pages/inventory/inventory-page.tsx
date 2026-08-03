import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Search, X } from 'lucide-react';
import {
  inventoryCreateSchema,
  type InventoryCreateInput,
  type InventoryListFilters,
} from '@shared/schemas';
import type { SaleDto } from '@shared/types';
import { INVENTORY_MOVEMENT_LABELS } from '@shared/constants';
import { Header } from '@/layouts/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { DateField, dateInputToIso, todayDateInputValue } from '@/components/shared/date-field';
import {
  InventoryReasonCell,
  SaleDetailDialog,
} from '@/components/shared/sale-detail-dialog';
import { LowStockPanel } from '@/components/shared/low-stock-panel';
import { toast } from '@/hooks/use-toast';
import { filterVisibleLowStock } from '@/utils/low-stock-dismiss';
import { unwrapApi } from '@/utils';

const MOVEMENT_TYPES = Object.keys(INVENTORY_MOVEMENT_LABELS) as Array<
  keyof typeof INVENTORY_MOVEMENT_LABELS
>;

export function InventoryPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('all');
  const [open, setOpen] = useState(false);
  const [pendingNegative, setPendingNegative] = useState<InventoryCreateInput | null>(null);
  const [movedAt, setMovedAt] = useState(todayDateInputValue());
  const [detailSale, setDetailSale] = useState<SaleDto | null>(null);
  const [detailSaleLoading, setDetailSaleLoading] = useState(false);
  const [detailSaleOpen, setDetailSaleOpen] = useState(false);
  const [highlightLowStock, setHighlightLowStock] = useState(false);

  const form = useForm<InventoryCreateInput>({
    resolver: zodResolver(inventoryCreateSchema),
    defaultValues: {
      productId: '',
      type: 'ENTRY',
      quantity: 1,
      reason: '',
      notes: '',
      allowNegative: false,
    },
  });

  function openRestock(productId: string) {
    form.reset({
      productId,
      type: 'ENTRY',
      quantity: 1,
      reason: 'Reposição de estoque',
      notes: '',
      allowNegative: false,
    });
    setMovedAt(todayDateInputValue());
    setOpen(true);
  }

  useEffect(() => {
    const productId = searchParams.get('produto');
    const openEntry = searchParams.get('entrada') === '1';
    const showLow = searchParams.get('estoqueBaixo') === '1';
    if (!productId && !openEntry && !showLow) return;

    if (showLow) setHighlightLowStock(true);
    if (openEntry && productId) {
      form.reset({
        productId,
        type: 'ENTRY',
        quantity: 1,
        reason: 'Reposição de estoque',
        notes: '',
        allowNegative: false,
      });
      setMovedAt(todayDateInputValue());
      setOpen(true);
    }

    const next = new URLSearchParams(searchParams);
    next.delete('produto');
    next.delete('entrada');
    next.delete('estoqueBaixo');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, form]);

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

  const { data: lowStock = [] } = useQuery({
    queryKey: ['low-stock'],
    queryFn: async () => unwrapApi(await window.cleideApi.inventory.lowStock()),
  });

  const listFilters = useMemo(
    () =>
      ({
        page,
        pageSize: 20,
        search: search.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        type:
          type === 'all'
            ? undefined
            : (type as NonNullable<InventoryListFilters['type']>),
      }) satisfies InventoryListFilters,
    [page, search, startDate, endDate, type],
  );

  const hasActiveFilters =
    Boolean(search.trim()) || Boolean(startDate) || Boolean(endDate) || type !== 'all';

  function clearFilters() {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setType('all');
    setPage(1);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['inventory', listFilters],
    queryFn: async () => unwrapApi(await window.cleideApi.inventory.list(listFilters)),
  });

  const createMutation = useMutation({
    mutationFn: async (values: InventoryCreateInput) =>
      unwrapApi(
        await window.cleideApi.inventory.create({
          ...values,
          movedAt: values.movedAt ?? dateInputToIso(movedAt),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['inventory'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['low-stock'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Movimentação registrada' });
      setOpen(false);
      setPendingNegative(null);
      setMovedAt(todayDateInputValue());
      form.reset({
        productId: '',
        type: 'ENTRY',
        quantity: 1,
        reason: '',
        notes: '',
        allowNegative: false,
      });
    },
    onError: (err: Error, values) => {
      if (err.message.includes('estoque negativo') || err.message.includes('Estoque insuficiente')) {
        setPendingNegative(values);
        return;
      }
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    },
  });

  async function openSaleDetail(saleId: string) {
    setDetailSale(null);
    setDetailSaleOpen(true);
    setDetailSaleLoading(true);
    try {
      const sale = unwrapApi(await window.cleideApi.sales.get(saleId));
      setDetailSale(sale);
    } catch (err) {
      setDetailSaleOpen(false);
      toast({
        title: 'Erro',
        description: (err as Error).message || 'Não foi possível abrir a venda.',
        variant: 'destructive',
      });
    } finally {
      setDetailSaleLoading(false);
    }
  }

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Histórico de estoque" subtitle="Entradas, saídas, perdas e ajustes" />
      <div className="space-y-4 p-6">
        {filterVisibleLowStock(lowStock).length > 0 ? (
          <div className={highlightLowStock ? 'ring-2 ring-amber-400/60 rounded-2xl' : undefined}>
            <LowStockPanel items={lowStock} onRestock={openRestock} />
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> Nova movimentação
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Buscar por nome do produto..."
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
            value={type}
            onValueChange={(v) => {
              setType(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[170px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {MOVEMENT_TYPES.map((movementType) => (
                <SelectItem key={movementType} value={movementType}>
                  {INVENTORY_MOVEMENT_LABELS[movementType]}
                </SelectItem>
              ))}
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

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : !data?.items.length ? (
          <EmptyState
            title={hasActiveFilters ? 'Nenhuma movimentação encontrada' : 'Nenhuma movimentação'}
            description={
              hasActiveFilters
                ? 'Nenhum resultado para os filtros selecionados.'
                : 'Registre entradas e saídas para acompanhar o estoque.'
            }
            actionLabel={hasActiveFilters ? undefined : 'Nova movimentação'}
            onAction={hasActiveFilters ? undefined : () => setOpen(true)}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Data</th>
                  <th className="p-3">Produto</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Qtd</th>
                  <th className="p-3">Motivo</th>
                  <th className="p-3">Estoque Anterior</th>
                  <th className="p-3">Estoque Atual</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="p-3">{new Date(m.movedAt).toLocaleString('pt-BR')}</td>
                    <td className="p-3 font-medium">{m.productName}</td>
                    <td className="p-3">{INVENTORY_MOVEMENT_LABELS[m.type]}</td>
                    <td className="p-3">{m.quantity}</td>
                    <td className="p-3">
                      <InventoryReasonCell
                        reason={m.reason}
                        saleId={m.saleId}
                        onSaleClick={openSaleDetail}
                      />
                    </td>
                    <td className="p-3">{m.previousStock}</td>
                    <td className="p-3">{m.resultingStock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data && data.totalPages > 1 ? (
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Anterior</Button>
            <span className="text-sm text-muted-foreground">Página {page} de {data.totalPages}</span>
            <Button variant="outline" disabled={page >= data.totalPages} onClick={() => setPage((p) => p + 1)}>Próxima</Button>
          </div>
        ) : null}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova movimentação</DialogTitle>
            <DialogDescription>
              Para ajuste, informe a quantidade final desejada no estoque.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-3"
            onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label>Produto</Label>
              <Select
                value={form.watch('productId')}
                onValueChange={(v) => form.setValue('productId', v)}
              >
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {(productsData?.items ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.stockQuantity})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.watch('type')}
                onValueChange={(v) => form.setValue('type', v as InventoryCreateInput['type'])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENTRY">Entrada</SelectItem>
                  <SelectItem value="EXIT">Saída</SelectItem>
                  <SelectItem value="LOSS">Perda</SelectItem>
                  <SelectItem value="ADJUSTMENT">Ajuste</SelectItem>
                  <SelectItem value="RETURN">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantidade</Label>
              <Input type="number" {...form.register('quantity', { valueAsNumber: true })} />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Input {...form.register('reason')} />
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea {...form.register('notes')} />
            </div>
            <DateField
              value={movedAt}
              onChange={setMovedAt}
              label="Data da movimentação"
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(pendingNegative)}
        onOpenChange={(o) => !o && setPendingNegative(null)}
        title="Permitir estoque negativo?"
        description="A movimentação deixará o estoque abaixo de zero. Deseja continuar mesmo assim?"
        confirmLabel="Permitir negativo"
        onConfirm={() => {
          if (!pendingNegative) return;
          createMutation.mutate({
            ...pendingNegative,
            allowNegative: true,
            movedAt: pendingNegative.movedAt ?? dateInputToIso(movedAt),
          });
        }}
      />

      <SaleDetailDialog
        sale={detailSale}
        open={detailSaleOpen}
        loading={detailSaleLoading}
        onOpenChange={(open) => {
          setDetailSaleOpen(open);
          if (!open) {
            setDetailSale(null);
            setDetailSaleLoading(false);
          }
        }}
      />
    </div>
  );
}
