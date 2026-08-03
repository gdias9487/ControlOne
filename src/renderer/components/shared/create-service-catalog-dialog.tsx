import { useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  serviceCatalogCreateSchema,
  type ProductStatus,
  type ServiceCatalogCreateInput,
} from '@shared/schemas';
import type { ServiceCatalogDto } from '@shared/types';
import { PRODUCT_STATUS_LABELS } from '@shared/constants';
import { calcProfitMargin } from '@shared/utils/money';
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
import { toast } from '@/hooks/use-toast';
import { formatPercent, toMoneyInput, unwrapApi } from '@/utils';

interface CreateServiceCatalogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: (service: ServiceCatalogDto) => void;
}

export function CreateServiceCatalogDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateServiceCatalogDialogProps) {
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: '',
      description: '',
      cost: '0',
      amount: '0',
      status: 'ACTIVE',
    });
  }, [open, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: ServiceCatalogCreateInput) =>
      unwrapApi(
        await window.cleideApi.serviceCatalogs.create({
          ...values,
          cost: toMoneyInput(values.cost || '0'),
          amount: toMoneyInput(values.amount),
          description: values.description || null,
        }),
      ),
    onSuccess: (created) => {
      void queryClient.invalidateQueries({ queryKey: ['service-catalogs'] });
      void queryClient.invalidateQueries({ queryKey: ['service-catalogs-options'] });
      toast({ title: 'Serviço cadastrado' });
      onOpenChange(false);
      onCreated?.(created);
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo serviço</DialogTitle>
          <DialogDescription>
            Cadastre o serviço para usar neste registro. Defina custo e valor cobrado.
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
            Margem estimada:{' '}
            <span className="font-medium text-foreground">{formatPercent(margin)}</span>
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
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
