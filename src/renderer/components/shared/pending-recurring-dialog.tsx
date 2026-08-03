import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { PendingRecurringExpenseDto } from '@shared/types';
import { EXPENSE_CATEGORY_LABELS } from '@shared/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { formatCurrency, toMoneyInput, unwrapApi } from '@/utils';
import { dateInputToIso, todayDateInputValue } from '@/components/shared/date-field';

function skipStorageKey(month: string): string {
  return `controlone:recurring-pending-skipped:${month}`;
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function toDateInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return todayDateInputValue();
  return todayDateInputValue(d);
}

function isSkipped(month: string): boolean {
  try {
    return Boolean(localStorage.getItem(skipStorageKey(month)));
  } catch {
    return false;
  }
}

function markSkipped(month: string): void {
  try {
    localStorage.setItem(skipStorageKey(month), '1');
  } catch {
    // ignore
  }
}

type DraftItem = {
  id: string;
  selected: boolean;
  amount: string;
  expenseDate: string;
  updateTemplateAmount: boolean;
};

function buildDrafts(items: PendingRecurringExpenseDto[]): Record<string, DraftItem> {
  const next: Record<string, DraftItem> = {};
  for (const item of items) {
    next[item.id] = {
      id: item.id,
      selected: true,
      amount: item.amount,
      expenseDate: toDateInput(item.suggestedDate),
      updateTemplateAmount: true,
    };
  }
  return next;
}

interface PendingRecurringDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se true, ao fechar/adiar não pergunta de novo neste mês (usado no boot). */
  respectSessionSkip?: boolean;
}

export function PendingRecurringDialog({
  open,
  onOpenChange,
  respectSessionSkip = false,
}: PendingRecurringDialogProps) {
  const queryClient = useQueryClient();
  const month = useMemo(() => currentMonthKey(), []);
  const [drafts, setDrafts] = useState<Record<string, DraftItem>>({});
  const syncedKeyRef = useRef<string>('');

  const { data, isLoading } = useQuery({
    queryKey: ['recurring-expenses-pending', month],
    queryFn: async () =>
      unwrapApi(await window.cleideApi.recurringExpenses.pending({ month })),
    enabled: open,
  });

  const items = data ?? EMPTY_PENDING;

  useEffect(() => {
    if (!open || !respectSessionSkip) return;
    if (isSkipped(month)) {
      onOpenChange(false);
    }
  }, [open, respectSessionSkip, month, onOpenChange]);

  useEffect(() => {
    if (!open || !data) return;
    const key = data.map((item) => item.id).join('|');
    if (key === syncedKeyRef.current) return;
    syncedKeyRef.current = key;
    setDrafts(buildDrafts(data));
  }, [open, data]);

  function dismissForMonth() {
    if (respectSessionSkip) {
      markSkipped(month);
    }
  }

  const confirmMutation = useMutation({
    mutationFn: async () => {
      const selected = Object.values(drafts)
        .filter((d) => d.selected)
        .map((d) => ({
          id: d.id,
          amount: toMoneyInput(d.amount),
          expenseDate: dateInputToIso(d.expenseDate),
          updateTemplateAmount: d.updateTemplateAmount,
        }));
      if (selected.length === 0) {
        throw new Error('Selecione ao menos uma despesa fixa.');
      }
      return unwrapApi(
        await window.cleideApi.recurringExpenses.confirm({ month, items: selected }),
      );
    },
    onSuccess: (created) => {
      syncedKeyRef.current = '';
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      void queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['recurring-expenses-pending'] });
      toast({
        title: 'Despesas fixas geradas',
        description: `${created.length} lançamento(s) no mês.`,
      });
      onOpenChange(false);
    },
    onError: (err: Error) =>
      toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function skip() {
    dismissForMonth();
    onOpenChange(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) {
      dismissForMonth();
    }
    onOpenChange(next);
  }

  function patch(id: string, patchValue: Partial<DraftItem>) {
    setDrafts((prev) => ({ ...prev, [id]: { ...prev[id], ...patchValue } }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirmar despesas fixas</DialogTitle>
          <DialogDescription>
            Há despesas recorrentes pendentes para {month}. Confirme para lançar no financeiro.
            Você pode ajustar o valor antes de gerar.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Verificando pendências...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhuma despesa fixa pendente neste mês.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const draft = drafts[item.id];
              if (!draft) return null;
              return (
                <div key={item.id} className="space-y-2 rounded-xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <label className="flex items-start gap-2 text-sm">
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={draft.selected}
                        onChange={(e) => patch(item.id, { selected: e.target.checked })}
                      />
                      <span>
                        <span className="font-medium">{item.description}</span>
                        <span className="block text-xs text-muted-foreground">
                          Dia {item.dayOfMonth} · {EXPENSE_CATEGORY_LABELS[item.category]} · base{' '}
                          {formatCurrency(item.amount)}
                        </span>
                      </span>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Valor deste mês</Label>
                      <Input
                        value={draft.amount}
                        disabled={!draft.selected}
                        onChange={(e) => patch(item.id, { amount: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Data do lançamento</Label>
                      <Input
                        type="date"
                        value={draft.expenseDate}
                        disabled={!draft.selected}
                        onChange={(e) => patch(item.id, { expenseDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={draft.updateTemplateAmount}
                      disabled={!draft.selected}
                      onChange={(e) =>
                        patch(item.id, { updateTemplateAmount: e.target.checked })
                      }
                    />
                    Atualizar valor base da despesa fixa com este valor
                  </label>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={skip}>
            Agora não
          </Button>
          <Button
            type="button"
            disabled={confirmMutation.isPending || items.length === 0}
            onClick={() => confirmMutation.mutate()}
          >
            Confirmar e gerar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const EMPTY_PENDING: PendingRecurringExpenseDto[] = [];

/** Hook auxiliar para abrir o diálogo no boot quando há pendências. */
export function usePendingRecurringPrompt(enabled: boolean) {
  const month = useMemo(() => currentMonthKey(), []);
  const skipped = isSkipped(month);

  const query = useQuery({
    queryKey: ['recurring-expenses-pending', month, 'boot'],
    queryFn: async () =>
      unwrapApi(await window.cleideApi.recurringExpenses.pending({ month })),
    enabled: enabled && !skipped,
  });

  const pendingCount = query.data?.length ?? 0;

  return {
    month,
    pendingCount,
    shouldPrompt: enabled && !skipped && pendingCount > 0 && !query.isLoading,
    isLoading: query.isLoading,
  };
}
