import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Grid2X2, LayoutList, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  productCreateSchema,
  type ProductCreateInput,
  type ProductStatus,
} from '@shared/schemas';
import { PRODUCT_STATUS_LABELS } from '@shared/constants';
import type { ProductDto } from '@shared/types';
import { Header } from '@/layouts/header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
import { calcProfitMargin } from '@shared/utils/money';
import { CategoriesPanel } from './categories-panel';

type SortBy = 'name' | 'stock' | 'price' | 'createdAt';
type ViewMode = 'table' | 'cards';

export function ProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [view, setView] = useState<ViewMode>('table');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProductDto | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const filters = {
    search: search || undefined,
    categoryId: categoryId === 'all' ? undefined : categoryId,
    status: status === 'all' ? undefined : (status as ProductStatus),
    sortBy,
    sortOrder,
    page,
    pageSize: 12,
  };

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => unwrapApi(await window.cleideApi.categories.list()),
  });

  const { data, isLoading } = useQuery({
    queryKey: ['products', filters],
    queryFn: async () => unwrapApi(await window.cleideApi.products.list(filters)),
  });

  const form = useForm<ProductCreateInput>({
    resolver: zodResolver(productCreateSchema),
    defaultValues: {
      name: '',
      categoryId: '',
      internalCode: '',
      description: '',
      cost: '0',
      salePrice: '0',
      stockQuantity: 0,
      minStock: 5,
      status: 'ACTIVE',
    },
  });

  const cost = form.watch('cost');
  const salePrice = form.watch('salePrice');
  const margin = useMemo(() => calcProfitMargin(cost || '0', salePrice || '0'), [cost, salePrice]);

  const saveMutation = useMutation({
    mutationFn: async (values: ProductCreateInput) => {
      const payload = { ...values, photoPath, cost: toMoneyInput(values.cost), salePrice: toMoneyInput(values.salePrice) };
      if (editing) {
        return unwrapApi(await window.cleideApi.products.update({ id: editing.id, ...payload }));
      }
      return unwrapApi(await window.cleideApi.products.create(payload));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: editing ? 'Produto atualizado' : 'Produto cadastrado' });
      setOpen(false);
      setEditing(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => unwrapApi(await window.cleideApi.products.delete(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Produto removido' });
      setDeleteId(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) =>
      unwrapApi(await window.cleideApi.categories.create({ name })),
    onSuccess: async (category) => {
      queryClient.setQueryData<typeof categories>(['categories'], (prev) => {
        const list = prev ?? [];
        if (list.some((c) => c.id === category.id)) return list;
        return [...list, category].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      });
      await queryClient.invalidateQueries({ queryKey: ['categories'] });
      form.setValue('categoryId', category.id);
      setNewCategoryName('');
      setCreatingCategory(false);
      toast({ title: 'Categoria criada', description: category.name });
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function openCreate() {
    setEditing(null);
    setPhotoPath(null);
    setPhotoUrl(null);
    setCreatingCategory(false);
    setNewCategoryName('');
    form.reset({
      name: '',
      categoryId: categories[0]?.id ?? '',
      internalCode: '',
      description: '',
      cost: '0',
      salePrice: '0',
      stockQuantity: 0,
      minStock: 5,
      status: 'ACTIVE',
    });
    setOpen(true);
  }

  function openEdit(product: ProductDto) {
    setEditing(product);
    setPhotoPath(product.photoPath);
    setPhotoUrl(product.photoUrl);
    setCreatingCategory(false);
    setNewCategoryName('');
    form.reset({
      name: product.name,
      categoryId: product.categoryId,
      internalCode: product.internalCode,
      description: product.description ?? '',
      cost: product.cost,
      salePrice: product.salePrice,
      stockQuantity: product.stockQuantity,
      minStock: product.minStock,
      status: product.status,
    });
    setOpen(true);
  }

  async function selectImage() {
    try {
      const result = unwrapApi(await window.cleideApi.products.selectImage());
      if (!result) return;
      setPhotoPath(result.relativePath);
      setPhotoUrl(result.url);
    } catch (err) {
      toast({ title: 'Erro', description: (err as Error).message, variant: 'destructive' });
    }
  }

  const items = data?.items ?? [];

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Produtos" subtitle="Cadastro, fotos, preços e margens" />

      <div className="space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => setCategoriesOpen(true)}>Categorias</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" /> Novo produto</Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Pesquisar produtos..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPage(1); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorias</SelectItem>
              {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos status</SelectItem>
              <SelectItem value="ACTIVE">Ativo</SelectItem>
              <SelectItem value="INACTIVE">Inativo</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="stock">Estoque</SelectItem>
              <SelectItem value="price">Preço</SelectItem>
              <SelectItem value="createdAt">Data</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}>
            {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
          </Button>

          <div className="ml-auto flex gap-2">
            <Button variant="outline" size="icon" onClick={() => setView('table')} aria-label="Tabela">
              <LayoutList className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setView('cards')} aria-label="Cards">
              <Grid2X2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando produtos...</p>
        ) : items.length === 0 ? (
          <EmptyState
            title="Nenhum produto cadastrado"
            description="Comece cadastrando anéis, colares, brincos e outras peças."
            actionLabel="Cadastrar produto"
            onAction={openCreate}
          />
        ) : view === 'table' ? (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Foto</th>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Código</th>
                  <th className="p-3">Estoque</th>
                  <th className="p-3">Custo</th>
                  <th className="p-3">Venda</th>
                  <th className="p-3">Margem</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((product) => (
                  <tr key={product.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <img
                        src={product.photoUrl ?? undefined}
                        alt=""
                        className="h-10 w-10 rounded-lg object-cover bg-muted"
                      />
                    </td>
                    <td className="p-3 font-medium">{product.name}</td>
                    <td className="p-3">{product.categoryName}</td>
                    <td className="p-3">{product.internalCode}</td>
                    <td className="p-3">
                      <span className={product.isLowStock ? 'text-amber-700 font-semibold' : ''}>
                        {product.stockQuantity}
                      </span>
                    </td>
                    <td className="p-3">{formatCurrency(product.cost)}</td>
                    <td className="p-3 font-bold">{formatCurrency(product.salePrice)}</td>
                    <td className="p-3">{formatPercent(product.profitMargin)}</td>
                    <td className="p-3">
                      <Badge variant={product.status === 'ACTIVE' ? 'success' : 'muted'}>
                        {PRODUCT_STATUS_LABELS[product.status]}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(product)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(product.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {items.map((product) => (
              <Card key={product.id} className="overflow-hidden transition hover:-translate-y-0.5 hover:shadow-elev">
                <div className="aspect-[4/3] bg-muted">
                  {product.photoUrl ? (
                    <img src={product.photoUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.categoryName} · {product.internalCode}</p>
                    </div>
                    <Badge variant={product.status === 'ACTIVE' ? 'success' : 'muted'}>
                      {PRODUCT_STATUS_LABELS[product.status]}
                    </Badge>
                  </div>
                  <p className="text-lg font-semibold">{formatCurrency(product.salePrice)}</p>
                  <p className="text-xs text-muted-foreground">
                    Estoque {product.stockQuantity} · Margem {formatPercent(product.profitMargin)}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(product)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(product.id)}>Excluir</Button>
                  </div>
                </CardContent>
              </Card>
            ))}
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
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar produto' : 'Novo produto'}</DialogTitle>
            <DialogDescription>Preencha os dados da peça. A margem é calculada automaticamente.</DialogDescription>
          </DialogHeader>
          <form
            className="grid gap-4 md:grid-cols-2"
            onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
          >
            <div className="md:col-span-2 flex items-center gap-4">
              <div className="h-24 w-24 overflow-hidden rounded-xl bg-muted">
                {photoUrl ? <img src={photoUrl} alt="" className="h-full w-full object-cover" /> : null}
              </div>
              <Button type="button" variant="outline" onClick={() => void selectImage()}>
                Selecionar imagem
              </Button>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Nome</Label>
              <Input {...form.register('name')} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Categoria</Label>
                {!creatingCategory ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setCreatingCategory(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Criar categoria
                  </Button>
                ) : null}
              </div>
              <Select value={form.watch('categoryId')} onValueChange={(v) => form.setValue('categoryId', v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {creatingCategory ? (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    placeholder="Nome da nova categoria"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const name = newCategoryName.trim();
                        if (name) createCategoryMutation.mutate(name);
                      }
                      if (e.key === 'Escape') {
                        setCreatingCategory(false);
                        setNewCategoryName('');
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={!newCategoryName.trim() || createCategoryMutation.isPending}
                    onClick={() => {
                      const name = newCategoryName.trim();
                      if (name) createCategoryMutation.mutate(name);
                    }}
                  >
                    Criar
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setCreatingCategory(false);
                      setNewCategoryName('');
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>Código interno</Label>
              <Input {...form.register('internalCode')} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Descrição</Label>
              <Textarea {...form.register('description')} />
            </div>
            <div className="space-y-2">
              <Label>Custo</Label>
              <Input {...form.register('cost')} />
            </div>
            <div className="space-y-2">
              <Label>Preço de venda</Label>
              <Input {...form.register('salePrice')} />
            </div>
            <div className="space-y-2">
              <Label>Margem de lucro</Label>
              <Input value={`${margin}%`} disabled />
            </div>
            <div className="space-y-2">
              <Label>Estoque mínimo</Label>
              <Input type="number" {...form.register('minStock', { valueAsNumber: true })} />
            </div>
            {!editing ? (
              <div className="space-y-2">
                <Label>Estoque inicial</Label>
                <Input type="number" {...form.register('stockQuantity', { valueAsNumber: true })} />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.watch('status')}
                onValueChange={(v) => form.setValue('status', v as ProductStatus)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Ativo</SelectItem>
                  <SelectItem value="INACTIVE">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending}>Salvar</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir produto?"
        description="Se houver histórico de vendas, o produto será apenas desativado."
        confirmLabel="Excluir"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <CategoriesPanel open={categoriesOpen} onOpenChange={setCategoriesOpen} />
    </div>
  );
}
