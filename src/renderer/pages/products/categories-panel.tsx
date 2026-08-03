import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { categoryCreateSchema, type CategoryCreateInput } from '@shared/schemas';
import type { CategoryDto } from '@shared/types';
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
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { toast } from '@/hooks/use-toast';
import { unwrapApi } from '@/utils';

interface CategoriesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CategoriesPanel({ open, onOpenChange }: CategoriesPanelProps) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CategoryDto | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => unwrapApi(await window.cleideApi.categories.list()),
    enabled: open,
  });

  const form = useForm<CategoryCreateInput>({
    resolver: zodResolver(categoryCreateSchema),
    defaultValues: { name: '', description: '' },
  });

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    form.reset({ name: '', description: '' });
  }

  function openCreateForm() {
    setEditing(null);
    form.reset({ name: '', description: '' });
    setFormOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (values: CategoryCreateInput) => {
      if (editing) {
        return unwrapApi(await window.cleideApi.categories.update({ id: editing.id, ...values }));
      }
      return unwrapApi(await window.cleideApi.categories.create(values));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: editing ? 'Categoria atualizada' : 'Categoria criada' });
      closeForm();
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => unwrapApi(await window.cleideApi.categories.delete(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast({ title: 'Categoria excluída' });
      setDeleteId(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) closeForm();
          onOpenChange(next);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Categorias</DialogTitle>
            <DialogDescription>Organize os produtos por tipo de peça.</DialogDescription>
          </DialogHeader>

          {formOpen ? (
            <form
              className="grid gap-3 rounded-xl border p-3"
              onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
            >
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input {...form.register('name')} />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea {...form.register('description')} />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={closeForm}>
                  Cancelar
                </Button>
                <Button type="submit">
                  <Plus className="h-4 w-4" />
                  {editing ? 'Salvar' : 'Adicionar'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex justify-end">
              <Button type="button" onClick={openCreateForm}>
                <Plus className="h-4 w-4" /> Adicionar nova categoria
              </Button>
            </div>
          )}

          <div className="max-h-72 space-y-2 overflow-y-auto">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center justify-between rounded-xl border px-3 py-2">
                <div>
                  <p className="font-medium">{category.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {category.productCount ?? 0} produtos
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(category);
                      form.reset({
                        name: category.name,
                        description: category.description ?? '',
                      });
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => setDeleteId(category.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir categoria?"
        description="Só é possível excluir categorias sem produtos vinculados."
        confirmLabel="Excluir"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />
    </>
  );
}
