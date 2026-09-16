import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { productCreateSchema, type ProductCreateInput, type ProductStatus } from '@shared/schemas';
import { PLAN_DURATION_PRESETS } from '@shared/business-profile';
import type { ProductDto } from '@shared/types';
import { calcProfitMargin } from '@shared/utils/money';
import { ProductPhoto } from '@/components/shared/product-photo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MoneyInput } from '@/components/ui/money-input';
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
import { toast } from '@/hooks/use-toast';
import { toMoneyInput, unwrapApi } from '@/utils';
import { useBusinessProfile } from '@/hooks/use-business-profile';

interface CreateProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (product: ProductDto) => void;
}

export function CreateProductDialog({ open, onOpenChange, onCreated }: CreateProductDialogProps) {
  const queryClient = useQueryClient();
  const { copy, usesInventory, usesCustomerPlans } = useBusinessProfile();
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => unwrapApi(await window.cleideApi.categories.list()),
    enabled: open,
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
      durationDays: 30,
      status: 'ACTIVE',
    },
  });
  const { errors } = form.formState;

  const cost = form.watch('cost');
  const salePrice = form.watch('salePrice');
  const margin = useMemo(() => calcProfitMargin(cost || '0', salePrice || '0'), [cost, salePrice]);

  useEffect(() => {
    if (!open) return;
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
      durationDays: 30,
      status: 'ACTIVE',
    });
  }, [open, categories]);

  const createMutation = useMutation({
    mutationFn: async (values: ProductCreateInput) =>
      unwrapApi(
        await window.cleideApi.products.create({
          ...values,
          photoPath,
          cost: toMoneyInput(values.cost),
          salePrice: toMoneyInput(values.salePrice),
          durationDays: usesCustomerPlans ? values.durationDays ?? 30 : null,
        }),
      ),
    onSuccess: (product) => {
      queryClient.setQueryData(
        ['products-options'],
        (prev: { items: ProductDto[]; total: number; page: number; pageSize: number; totalPages: number } | undefined) => {
          if (!prev) return prev;
          const items = [product, ...prev.items.filter((p) => p.id !== product.id)];
          return { ...prev, items, total: items.length };
        },
      );
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['products-options'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: copy.created });
      onOpenChange(false);
      onCreated?.(product);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{copy.newItem}</DialogTitle>
          <DialogDescription>
            {copy.formCreateHint}
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={form.handleSubmit((values) => createMutation.mutate(values))}
        >
          <div className="flex items-center gap-4 md:col-span-2">
            <ProductPhoto
              src={photoUrl}
              className="h-24 w-24 rounded-xl"
              iconClassName="h-8 w-8"
            />
            <Button type="button" variant="outline" onClick={() => void selectImage()}>
              Selecionar imagem
            </Button>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>Nome</Label>
            <Input {...form.register('name')} invalid={Boolean(errors.name)} />
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
            <Select
              value={form.watch('categoryId')}
              onValueChange={(v) =>
                form.setValue('categoryId', v, { shouldDirty: true, shouldValidate: true })
              }
            >
              <SelectTrigger invalid={Boolean(errors.categoryId)}>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
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
            <Input
              {...form.register('internalCode')}
              invalid={Boolean(errors.internalCode)}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label>Descrição</Label>
            <Textarea {...form.register('description')} />
          </div>
          <div className="space-y-2">
            <Label>Custo</Label>
            <MoneyInput
              value={form.watch('cost')}
              onChange={(cost) => form.setValue('cost', cost, { shouldDirty: true, shouldValidate: true })}
            />
          </div>
          <div className="space-y-2">
            <Label>Preço de venda</Label>
            <MoneyInput
              value={form.watch('salePrice')}
              onChange={(salePrice) =>
                form.setValue('salePrice', salePrice, { shouldDirty: true, shouldValidate: true })
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Margem de lucro</Label>
            <Input value={`${margin}%`} disabled />
          </div>
          {usesCustomerPlans ? (
            <div className="space-y-2">
              <Label>Duração do plano</Label>
              <Select
                value={String(form.watch('durationDays') ?? 30)}
                onValueChange={(v) =>
                  form.setValue('durationDays', Number(v), { shouldDirty: true, shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_DURATION_PRESETS.map((preset) => (
                    <SelectItem key={preset.days} value={String(preset.days)}>
                      {preset.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {usesInventory ? (
            <div className="space-y-2">
              <Label>Estoque mínimo</Label>
              <Input type="number" {...form.register('minStock', { valueAsNumber: true })} />
            </div>
          ) : null}
          {usesInventory ? (
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Ativo</SelectItem>
                <SelectItem value="INACTIVE">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2 md:col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createMutation.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
