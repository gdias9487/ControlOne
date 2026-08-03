import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, TrendingDown, X } from 'lucide-react';
import type { ExpenseCategory, PaymentMethod } from '@shared/schemas';
import {
  EXPENSE_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
} from '@shared/constants';
import type { RecurringExpenseDto } from '@shared/types';
import { Header } from '@/layouts/header';
import { StatCard } from '@/components/shared/stat-card';
import { EmptyState } from '@/components/shared/empty-state';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import { DateField, dateInputToIso, todayDateInputValue } from '@/components/shared/date-field';
import { PendingRecurringDialog } from '@/components/shared/pending-recurring-dialog';
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
import { toast } from '@/hooks/use-toast';
import { EXPENSE_VALUE_CLASS, formatCurrency, toMoneyInput, unwrapApi } from '@/utils';

type Tab = 'expenses' | 'fixed';
type ExpenseListSort = 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';

const emptyExpenseForm = () => ({
  description: '',
  category: 'OTHER' as ExpenseCategory,
  amount: '0',
  paymentMethod: 'PIX' as PaymentMethod,
  notes: '',
  expenseDate: todayDateInputValue(),
});

const emptyFixedForm = () => ({
  description: '',
  category: 'OTHER' as ExpenseCategory,
  amount: '0',
  paymentMethod: 'PIX' as PaymentMethod,
  dayOfMonth: 5,
  notes: '',
  active: true,
});

export function FinancePage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('expenses');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sort, setSort] = useState<ExpenseListSort>('newest');
  const [open, setOpen] = useState(false);
  const [openFixed, setOpenFixed] = useState(false);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteFixedId, setDeleteFixedId] = useState<string | null>(null);
  const [editingFixed, setEditingFixed] = useState<RecurringExpenseDto | null>(null);
  const [form, setForm] = useState(emptyExpenseForm);
  const [fixedForm, setFixedForm] = useState(emptyFixedForm);

  const expenseFilters = useMemo(
    () => ({
      page: 1,
      pageSize: 100,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      sort,
    }),
    [startDate, endDate, sort],
  );

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', expenseFilters],
    queryFn: async () => unwrapApi(await window.cleideApi.expenses.list(expenseFilters)),
  });

  const periodExpenseTotal = useMemo(() => {
    const items = expenses?.items ?? [];
    return items.reduce((acc, item) => acc + Number(item.amount), 0).toFixed(2);
  }, [expenses]);

  const hasActiveFilters = Boolean(startDate) || Boolean(endDate) || sort !== 'newest';

  function clearFilters() {
    setStartDate('');
    setEndDate('');
    setSort('newest');
  }

  const { data: recurring = [], isLoading: loadingFixed } = useQuery({
    queryKey: ['recurring-expenses'],
    queryFn: async () => unwrapApi(await window.cleideApi.recurringExpenses.list()),
  });

  const { data: pending = [] } = useQuery({
    queryKey: ['recurring-expenses-pending'],
    queryFn: async () => unwrapApi(await window.cleideApi.recurringExpenses.pending()),
  });

  const createMutation = useMutation({
    mutationFn: async () =>
      unwrapApi(
        await window.cleideApi.expenses.create({
          description: form.description,
          category: form.category,
          amount: toMoneyInput(form.amount),
          paymentMethod: form.paymentMethod,
          notes: form.notes,
          expenseDate: dateInputToIso(form.expenseDate),
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Despesa registrada' });
      setOpen(false);
      setForm(emptyExpenseForm());
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => unwrapApi(await window.cleideApi.expenses.delete(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast({ title: 'Despesa excluída' });
      setDeleteId(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const saveFixedMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        description: fixedForm.description,
        category: fixedForm.category,
        amount: toMoneyInput(fixedForm.amount),
        paymentMethod: fixedForm.paymentMethod,
        dayOfMonth: Number(fixedForm.dayOfMonth),
        notes: fixedForm.notes || null,
        active: fixedForm.active,
      };
      if (editingFixed) {
        return unwrapApi(
          await window.cleideApi.recurringExpenses.update({ id: editingFixed.id, ...payload }),
        );
      }
      return unwrapApi(await window.cleideApi.recurringExpenses.create(payload));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['recurring-expenses-pending'] });
      toast({ title: editingFixed ? 'Despesa fixa atualizada' : 'Despesa fixa cadastrada' });
      setOpenFixed(false);
      setEditingFixed(null);
      setFixedForm(emptyFixedForm());
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  const deleteFixedMutation = useMutation({
    mutationFn: async (id: string) => unwrapApi(await window.cleideApi.recurringExpenses.delete(id)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['recurring-expenses'] });
      void queryClient.invalidateQueries({ queryKey: ['recurring-expenses-pending'] });
      toast({ title: 'Despesa fixa removida' });
      setDeleteFixedId(null);
    },
    onError: (err: Error) => toast({ title: 'Erro', description: err.message, variant: 'destructive' }),
  });

  function openCreateFixed() {
    setEditingFixed(null);
    setFixedForm(emptyFixedForm());
    setOpenFixed(true);
  }

  function openEditFixed(item: RecurringExpenseDto) {
    setEditingFixed(item);
    setFixedForm({
      description: item.description,
      category: item.category,
      amount: item.amount,
      paymentMethod: item.paymentMethod,
      dayOfMonth: item.dayOfMonth,
      notes: item.notes ?? '',
      active: item.active,
    });
    setOpenFixed(true);
  }

  return (
    <div className="page-enter flex min-h-full flex-col">
      <Header title="Despesas" subtitle="Cadastro e controle de despesas" />
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={tab === 'expenses' ? 'accent' : 'outline'} onClick={() => setTab('expenses')}>
            Despesas
          </Button>
          <Button variant={tab === 'fixed' ? 'accent' : 'outline'} onClick={() => setTab('fixed')}>
            Despesas fixas
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            {pending.length > 0 ? (
              <Button variant="outline" onClick={() => setPendingOpen(true)}>
                Confirmar pendências ({pending.length})
              </Button>
            ) : null}
            {tab === 'expenses' ? (
              <Button onClick={() => { setForm(emptyExpenseForm()); setOpen(true); }}>
                <Plus className="h-4 w-4" /> Nova despesa
              </Button>
            ) : (
              <Button onClick={openCreateFixed}>
                <Plus className="h-4 w-4" /> Nova despesa fixa
              </Button>
            )}
          </div>
        </div>

        {tab === 'expenses' ? (
          <div className="flex flex-wrap items-start gap-4">
            <div className="w-full max-w-sm">
              <StatCard
                title="Total filtrado"
                value={periodExpenseTotal}
                money
                icon={TrendingDown}
                tone="danger"
                hint={`${expenses?.total ?? 0} lançamento(s)`}
              />
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <Input
                className="w-[150px]"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                title="Data inicial"
                aria-label="Data inicial"
              />
              <Input
                className="w-[150px]"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                title="Data final"
                aria-label="Data final"
              />
              <Select value={sort} onValueChange={(v) => setSort(v as ExpenseListSort)}>
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
              {hasActiveFilters ? (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4" /> Limpar
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {tab === 'expenses' ? (
          isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !expenses?.items.length ? (
            <EmptyState
              title={hasActiveFilters ? 'Nenhuma despesa nos filtros' : 'Nenhuma despesa'}
              description="Registre compras, embalagens, transporte e outros gastos."
              actionLabel="Nova despesa"
              onAction={() => setOpen(true)}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-muted-foreground">
                  <tr>
                    <th className="p-3">Data</th>
                    <th className="p-3">Descrição</th>
                    <th className="p-3">Categoria</th>
                    <th className="p-3">Pagamento</th>
                    <th className="p-3">Valor</th>
                    <th className="p-3">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.items.map((expense) => (
                    <tr key={expense.id} className="border-t">
                      <td className="p-3">{new Date(expense.expenseDate).toLocaleDateString('pt-BR')}</td>
                      <td className="p-3 font-medium">
                        <span className="inline-flex items-center gap-2">
                          {expense.description}
                          {expense.isFixed ? <Badge variant="muted">Fixa</Badge> : null}
                        </span>
                      </td>
                      <td className="p-3">{EXPENSE_CATEGORY_LABELS[expense.category]}</td>
                      <td className="p-3">{PAYMENT_METHOD_LABELS[expense.paymentMethod]}</td>
                      <td className={`p-3 ${EXPENSE_VALUE_CLASS}`}>
                        {formatCurrency(expense.amount)}
                      </td>
                      <td className="p-3">
                        <Button size="icon" variant="ghost" onClick={() => setDeleteId(expense.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : loadingFixed ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : recurring.length === 0 ? (
          <EmptyState
            title="Nenhuma despesa fixa"
            description="Cadastre aluguel, internet e outros gastos mensais. Todo mês o app pede confirmação antes de lançar."
            actionLabel="Nova despesa fixa"
            onAction={openCreateFixed}
          />
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-muted-foreground">
                <tr>
                  <th className="p-3">Descrição</th>
                  <th className="p-3">Dia</th>
                  <th className="p-3">Categoria</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {recurring.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3 font-medium">{item.description}</td>
                    <td className="p-3">Todo dia {item.dayOfMonth}</td>
                    <td className="p-3">{EXPENSE_CATEGORY_LABELS[item.category]}</td>
                    <td className={`p-3 ${EXPENSE_VALUE_CLASS}`}>{formatCurrency(item.amount)}</td>
                    <td className="p-3">
                      <Badge variant={item.active ? 'success' : 'muted'}>
                        {item.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditFixed(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteFixedId(item.id)}>
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
            <DialogTitle>Nova despesa</DialogTitle>
            <DialogDescription>Despesas afetam o lucro estimado do mês.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v as ExpenseCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor</Label>
                <Input value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <DateField
                value={form.expenseDate}
                onChange={(expenseDate) => setForm((f) => ({ ...f, expenseDate }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select value={form.paymentMethod} onValueChange={(v) => setForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS)
                    .filter(([value]) => value !== 'FIADO')
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>Salvar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openFixed} onOpenChange={setOpenFixed}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFixed ? 'Editar despesa fixa' : 'Nova despesa fixa'}</DialogTitle>
            <DialogDescription>
              Todo mês o app avisa e pede confirmação antes de lançar. O valor pode ser ajustado na hora.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={fixedForm.description}
                onChange={(e) => setFixedForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Ex.: Aluguel"
              />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Select
                value={fixedForm.category}
                onValueChange={(v) => setFixedForm((f) => ({ ...f, category: v as ExpenseCategory }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(EXPENSE_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Valor base</Label>
                <Input
                  value={fixedForm.amount}
                  onChange={(e) => setFixedForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Dia do mês (1–28)</Label>
                <Input
                  type="number"
                  min={1}
                  max={28}
                  value={fixedForm.dayOfMonth}
                  onChange={(e) =>
                    setFixedForm((f) => ({ ...f, dayOfMonth: Number(e.target.value) || 1 }))
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Pagamento</Label>
              <Select
                value={fixedForm.paymentMethod}
                onValueChange={(v) => setFixedForm((f) => ({ ...f, paymentMethod: v as PaymentMethod }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS)
                    .filter(([value]) => value !== 'FIADO')
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Observação</Label>
              <Textarea
                value={fixedForm.notes}
                onChange={(e) => setFixedForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={fixedForm.active}
                onChange={(e) => setFixedForm((f) => ({ ...f, active: e.target.checked }))}
              />
              Ativa (entra nas confirmações mensais)
            </label>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpenFixed(false)}>Cancelar</Button>
              <Button onClick={() => saveFixedMutation.mutate()} disabled={saveFixedMutation.isPending}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PendingRecurringDialog open={pendingOpen} onOpenChange={setPendingOpen} />

      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(o) => !o && setDeleteId(null)}
        title="Excluir despesa?"
        description="Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        onConfirm={() => deleteId && deleteMutation.mutate(deleteId)}
      />

      <ConfirmDialog
        open={Boolean(deleteFixedId)}
        onOpenChange={(o) => !o && setDeleteFixedId(null)}
        title="Excluir despesa fixa?"
        description="Os lançamentos já gerados permanecem no histórico."
        confirmLabel="Excluir"
        onConfirm={() => deleteFixedId && deleteFixedMutation.mutate(deleteFixedId)}
      />
    </div>
  );
}
