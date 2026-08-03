import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { customerCreateSchema, type CustomerCreateInput } from '@shared/schemas';
import { PAYMENT_METHOD_LABELS, SALE_STATUS_LABELS, SERVICE_STATUS_LABELS } from '@shared/constants';
import type { CustomerDto } from '@shared/types';
import { Header } from '@/layouts/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { SettleFiadoDialog } from '@/components/shared/settle-fiado-dialog';
import { toast } from '@/hooks/use-toast';
import {
  FIADO_VALUE_CLASS,
  formatCurrency,
  toMoneyInput,
  transactionAmountClass,
  unwrapApi,
  INCOME_VALUE_CLASS,
} from '@/utils';

type SettleTarget = {
  type: 'sale' | 'service';
  id: string;
  total: string;
  remaining: string;
  alreadyPaid: string;
};

export function CustomersPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [fiadoFilter, setFiadoFilter] = useState<'all' | 'open' | 'clear'>('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null);

  const hasActiveFilters = Boolean(search.trim()) || fiadoFilter !== 'all';

  function clearFilters() {
    setSearch('');
    setFiadoFilter('all');
  }

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, fiadoFilter],
    queryFn: async () =>
      unwrapApi(
        await window.cleideApi.customers.list({
          search: search.trim() || undefined,
          openFiadoOnly: fiadoFilter === 'open' ? true : undefined,
          noOpenFiadoOnly: fiadoFilter === 'clear' ? true : undefined,
          page: 1,
          pageSize: 100,
        }),
      ),
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['customer-history', historyId],
    queryFn: async () => unwrapApi(await window.cleideApi.customers.history(historyId!)),
    enabled: Boolean(historyId),
  });

  const form = useForm<CustomerCreateInput>({
    resolver: zodResolver(customerCreateSchema),
    defaultValues: { name: '' },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerCreateInput) => {
      if (editing) {
        return unwrapApi(
          await window.cleideApi.customers.update({ id: editing.id, ...values }),
        );
      }
      return unwrapApi(await window.cleideApi.customers.create(values));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['customers-options'] });
      toast({ title: editing ? 'Cliente atualizado' : 'Cliente cadastrado' });
      setOpen(false);
      setEditing(null);
      form.reset({ name: '' });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => unwrapApi(await window.cleideApi.customers.delete(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['customers-options'] });
      toast({ title: 'Cliente excluído' });
      setDeleteId(null);
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const settleMutation = useMutation({
    mutationFn: async (payload: { target: SettleTarget; amount: string }) => {
      const input = { id: payload.target.id, amount: toMoneyInput(payload.amount) };
      if (payload.target.type === 'sale') {
        return unwrapApi(await window.cleideApi.sales.settleFiado(input));
      }
      return unwrapApi(await window.cleideApi.services.settleFiado(input));
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['customer-history', historyId] });
      void queryClient.invalidateQueries({ queryKey: ['customers'] });
      void queryClient.invalidateQueries({ queryKey: ['sales'] });
      void queryClient.invalidateQueries({ queryKey: ['services'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const paidAll =
        Number(toMoneyInput(variables.amount)) >= Number(variables.target.remaining);
      toast({ title: paidAll ? 'Fiado quitado' : 'Pagamento parcial registrado' });
      setSettleTarget(null);
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditing(null);
    form.reset({ name: '' });
    setOpen(true);
  }

  function openEdit(customer: CustomerDto) {
    setEditing(customer);
    form.reset({ name: customer.name });
    setOpen(true);
  }

  const items = data?.items ?? [];

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Clientes" subtitle="Histórico de compras e fiados" />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo cliente
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar clientes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={fiadoFilter}
            onValueChange={(v) => setFiadoFilter(v as 'all' | 'open' | 'clear')}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Fiado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os clientes</SelectItem>
              <SelectItem value="open">Com fiado</SelectItem>
              <SelectItem value="clear">Sem pendências</SelectItem>
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
          <p className="text-sm text-muted-foreground">Carregando clientes...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
            description={
              hasActiveFilters
                ? 'Nenhum resultado para os filtros selecionados.'
                : 'Cadastre clientes para registrar vendas e controlar fiado.'
            }
            actionLabel={hasActiveFilters ? undefined : 'Cadastrar cliente'}
            onAction={hasActiveFilters ? undefined : openCreate}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Vendas</th>
                  <th className="p-3">Fiado</th>
                  <th className="p-3">Cadastro</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((customer) => (
                  <tr key={customer.id} className="border-t hover:bg-muted/30">
                    <td className="p-3 font-medium">{customer.name}</td>
                    <td className="p-3">{customer.salesCount ?? 0}</td>
                    <td className="p-3">
                      {Number(customer.openFiadoTotal ?? 0) > 0 ? (
                        <span className={FIADO_VALUE_CLASS}>
                          {formatCurrency(customer.openFiadoTotal ?? '0')}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3">
                      {new Date(customer.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setHistoryId(customer.id)}
                          aria-label="Histórico"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(customer)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(customer.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar cliente' : 'Novo cliente'}</DialogTitle>
            <DialogDescription>Por enquanto, basta informar o nome.</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...form.register('name')} placeholder="Nome do cliente" autoFocus />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                Salvar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(historyId)} onOpenChange={(o) => !o && setHistoryId(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{history?.customer.name ?? 'Histórico do cliente'}</DialogTitle>
            <DialogDescription>
              Vendas, serviços e situação dos fiados.
            </DialogDescription>
          </DialogHeader>

          {loadingHistory || !history ? (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Vendas</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {history.totals.salesCount}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Serviços</CardTitle>
                  </CardHeader>
                  <CardContent className="text-xl font-semibold">
                    {history.totals.servicesCount}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Total</CardTitle>
                  </CardHeader>
                  <CardContent className={`text-xl ${INCOME_VALUE_CLASS}`}>
                    {formatCurrency(
                      (
                        Number(history.totals.salesTotal) + Number(history.totals.servicesTotal)
                      ).toFixed(2),
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-muted-foreground">Fiado</CardTitle>
                  </CardHeader>
                  <CardContent className={`text-xl ${FIADO_VALUE_CLASS}`}>
                    {formatCurrency(history.totals.openFiadoTotal)}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Vendas</h3>
                {history.sales.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma venda vinculada.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="p-3">Venda</th>
                          <th className="p-3">Data</th>
                          <th className="p-3">Pagamento</th>
                          <th className="p-3">Total</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.sales.map((sale) => (
                          <tr key={sale.id} className="border-t">
                            <td className="p-3 font-medium">{sale.saleNumber}</td>
                            <td className="p-3">
                              {new Date(sale.soldAt).toLocaleDateString('pt-BR')}
                            </td>
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
                              {sale.isFiadoOpen && Number(sale.fiadoPaidAmount) > 0 ? (
                                <div className={`text-xs ${FIADO_VALUE_CLASS}`}>
                                  Resta {formatCurrency(sale.fiadoRemaining)}
                                </div>
                              ) : null}
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
                              {sale.isFiadoOpen ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setSettleTarget({
                                      type: 'sale',
                                      id: sale.id,
                                      total: sale.total,
                                      remaining: sale.fiadoRemaining,
                                      alreadyPaid: sale.fiadoPaidAmount,
                                    })
                                  }
                                >
                                  Pagar fiado
                                </Button>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium">Serviços</h3>
                {history.services.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum serviço vinculado.</p>
                ) : (
                  <div className="overflow-hidden rounded-xl border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 text-left text-muted-foreground">
                        <tr>
                          <th className="p-3">Serviço</th>
                          <th className="p-3">Data</th>
                          <th className="p-3">Pagamento</th>
                          <th className="p-3">Valor</th>
                          <th className="p-3">Status</th>
                          <th className="p-3">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.services.map((service) => (
                          <tr key={service.id} className="border-t">
                            <td className="p-3 font-medium">{service.name}</td>
                            <td className="p-3">
                              {new Date(service.performedAt).toLocaleDateString('pt-BR')}
                            </td>
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
                                  {Number(service.fiadoPaidAmount) > 0
                                    ? 'Fiado parcial'
                                    : 'Fiado aberto'}
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
                                    setSettleTarget({
                                      type: 'service',
                                      id: service.id,
                                      total: service.amount,
                                      remaining: service.fiadoRemaining,
                                      alreadyPaid: service.fiadoPaidAmount,
                                    })
                                  }
                                >
                                  Pagar fiado
                                </Button>
                              ) : (
                                '—'
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir cliente?"
        description="Só é possível excluir clientes sem vendas ou serviços vinculados."
        confirmLabel="Excluir"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <SettleFiadoDialog
        open={Boolean(settleTarget)}
        onOpenChange={(o) => !o && setSettleTarget(null)}
        title={settleTarget?.type === 'service' ? 'Pagar fiado do serviço' : 'Pagar fiado da venda'}
        total={settleTarget?.total ?? '0'}
        remaining={settleTarget?.remaining ?? '0'}
        alreadyPaid={settleTarget?.alreadyPaid ?? '0'}
        pending={settleMutation.isPending}
        onConfirm={(amount) => {
          if (!settleTarget) return;
          settleMutation.mutate({ target: settleTarget, amount });
        }}
      />
    </div>
  );
}
