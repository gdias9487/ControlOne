import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Search, Trash2, Wrench, X } from 'lucide-react';
import {
  serviceCatalogCreateSchema,
  type ProductStatus,
  type ServiceCatalogCreateInput,
  type ServiceCatalogListFilters,
} from '@shared/schemas';
import { PRODUCT_STATUS_LABELS } from '@shared/constants';
import type { ServiceCatalogDto } from '@shared/types';
import { calcProfitMargin } from '@shared/utils/money';
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
import { toast } from '@/hooks/use-toast';
import { formatCurrency, formatPercent, toMoneyInput, unwrapApi } from '@/utils';

type SortKey =
  | 'name_asc'
  | 'cost_asc'
  | 'cost_desc'
  | 'amount_asc'
  | 'amount_desc'
  | 'margin_asc'
  | 'margin_desc';

function sortKeyToFilters(sort: SortKey): Pick<ServiceCatalogListFilters, 'sortBy' | 'sortOrder'> {
  switch (sort) {
    case 'cost_asc':
      return { sortBy: 'cost', sortOrder: 'asc' };
    case 'cost_desc':
      return { sortBy: 'cost', sortOrder: 'desc' };
    case 'amount_asc':
      return { sortBy: 'amount', sortOrder: 'asc' };
    case 'amount_desc':
      return { sortBy: 'amount', sortOrder: 'desc' };
    case 'margin_asc':
      return { sortBy: 'margin', sortOrder: 'asc' };
    case 'margin_desc':
      return { sortBy: 'margin', sortOrder: 'desc' };
    case 'name_asc':
    default:
      return { sortBy: 'name', sortOrder: 'asc' };
  }
}

export function ServicesPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [sort, setSort] = useState<SortKey>('name_asc');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ServiceCatalogDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filters = useMemo(() => {
    const sortFilters = sortKeyToFilters(sort);
    return {
      search: search.trim() || undefined,
      status: status === 'all' ? undefined : (status as ProductStatus),
      sortBy: sortFilters.sortBy,
      sortOrder: sortFilters.sortOrder,
      page: 1,
      pageSize: 100,
    } satisfies ServiceCatalogListFilters;
  }, [search, status, sort]);

  const hasActiveFilters =
    Boolean(search.trim()) || status !== 'all' || sort !== 'name_asc';

  function clearFilters() {
    setSearch('');
    setStatus('all');
    setSort('name_asc');
  }

  const { data, isLoading } = useQuery({
    queryKey: ['service-catalogs', filters],
    queryFn: async () => unwrapApi(await window.cleideApi.serviceCatalogs.list(filters)),
  });

  const form = useForm<ServiceCatalogCreateInput>({
    resolver: zodResolver(serviceCatalogCreateSchema),
    defaultValues: {
      name: '',
      description: '',
      cost: '0',
      amount: '0',
      status: 'ACTIVE',
    },
  });

  const cost = form.watch('cost');
  const amount = form.watch('amount');
  const margin = useMemo(
    () => calcProfitMargin(cost || '0', amount || '0'),
    [cost, amount],
  );

  const saveMutation = useMutation({
    mutationFn: async (values: ServiceCatalogCreateInput) => {
      const payload = {
        ...values,
        cost: toMoneyInput(values.cost || '0'),
        amount: toMoneyInput(values.amount),
        description: values.description || null,
      };
      if (editing) {
        return unwrapApi(
          await window.cleideApi.serviceCatalogs.update({ id: editing.id, ...payload }),
        );
      }
      return unwrapApi(await window.cleideApi.serviceCatalogs.create(payload));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['service-catalogs'] });
      toast({ title: editing ? 'Serviço atualizado' : 'Serviço cadastrado' });
      setOpen(false);
      setEditing(null);
      form.reset({
        name: '',
        description: '',
        cost: '0',
        amount: '0',
        status: 'ACTIVE',
      });
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      unwrapApi(await window.cleideApi.serviceCatalogs.delete(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['service-catalogs'] });
      toast({
        title: 'Serviço removido',
        description: 'Se já foi usado em vendas, ele foi apenas desativado.',
      });
      setDeleteId(null);
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      name: '',
      description: '',
      cost: '0',
      amount: '0',
      status: 'ACTIVE',
    });
    setOpen(true);
  }

  function openEdit(item: ServiceCatalogDto) {
    setEditing(item);
    form.reset({
      name: item.name,
      description: item.description ?? '',
      cost: item.cost,
      amount: item.amount,
      status: item.status,
    });
    setOpen(true);
  }

  const items = data?.items ?? [];

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Serviços" subtitle="Cadastro de serviços com valores fixos" />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> Novo serviço
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar serviços..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ACTIVE">Ativos</SelectItem>
              <SelectItem value="INACTIVE">Inativos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name_asc">Nome</SelectItem>
              <SelectItem value="cost_asc">Custo crescente</SelectItem>
              <SelectItem value="cost_desc">Custo decrescente</SelectItem>
              <SelectItem value="amount_asc">Valor crescente</SelectItem>
              <SelectItem value="amount_desc">Valor decrescente</SelectItem>
              <SelectItem value="margin_asc">Margem crescente</SelectItem>
              <SelectItem value="margin_desc">Margem decrescente</SelectItem>
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
          <p className="text-sm text-muted-foreground">Carregando serviços...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title={hasActiveFilters ? 'Nenhum serviço encontrado' : 'Nenhum serviço cadastrado'}
            description={
              hasActiveFilters
                ? 'Nenhum resultado para os filtros selecionados.'
                : 'Cadastre serviços com preço fixo, como limpeza, conserto ou banho de prata.'
            }
            actionLabel={hasActiveFilters ? undefined : 'Cadastrar serviço'}
            onAction={hasActiveFilters ? undefined : openCreate}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Custo</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Margem</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="rounded-lg bg-secondary p-1.5">
                          <Wrench className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="font-medium">{item.name}</p>
                          {item.description ? (
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td className="p-3">{formatCurrency(item.cost)}</td>
                    <td className="p-3 font-semibold">{formatCurrency(item.amount)}</td>
                    <td className="p-3">
                      {formatPercent(calcProfitMargin(item.cost, item.amount))}
                    </td>
                    <td className="p-3">
                      <Badge variant={item.status === 'ACTIVE' ? 'success' : 'muted'}>
                        {PRODUCT_STATUS_LABELS[item.status]}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(item.id)}>
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
            <DialogTitle>{editing ? 'Editar serviço' : 'Novo serviço'}</DialogTitle>
            <DialogDescription>
              Defina o valor fixo cobrado e o custo estimado do serviço.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          >
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input {...form.register('name')} placeholder="Ex.: Banho de prata" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea {...form.register('description')} placeholder="Opcional" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Custo</Label>
                <Input {...form.register('cost')} />
              </div>
              <div className="space-y-2">
                <Label>Valor cobrado</Label>
                <Input {...form.register('amount')} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Margem estimada: <span className="font-medium text-foreground">{formatPercent(margin)}</span>
            </p>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as ProductStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir serviço?"
        description="Se o serviço já foi prestado alguma vez, ele será apenas desativado."
        confirmLabel="Excluir"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </div>
  );
}
