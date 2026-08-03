import type { RecurringExpense } from '@prisma/client';
import type {
  RecurringExpenseConfirmInput,
  RecurringExpenseCreateInput,
  RecurringExpenseUpdateInput,
} from '../../shared/schemas';
import type {
  ExpenseDto,
  PendingRecurringExpenseDto,
  RecurringExpenseDto,
} from '../../shared/types';
import { money } from '../../shared/utils/money';
import { getPrisma } from '../database/client';
import { createExpense } from './expense.service';

function mapRecurring(item: RecurringExpense): RecurringExpenseDto {
  return {
    id: item.id,
    description: item.description,
    category: item.category,
    amount: money(item.amount.toString()),
    paymentMethod: item.paymentMethod,
    dayOfMonth: item.dayOfMonth,
    active: item.active,
    notes: item.notes,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export function currentMonthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthKey(month: string): { year: number; monthIndex: number } {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
    throw new Error('Mês inválido. Use o formato AAAA-MM.');
  }
  return { year, monthIndex };
}

function monthRange(month: string): { start: Date; end: Date } {
  const { year, monthIndex } = parseMonthKey(month);
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export function suggestedDateForMonth(month: string, dayOfMonth: number): string {
  const { year, monthIndex } = parseMonthKey(month);
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const day = Math.min(Math.max(1, dayOfMonth), Math.min(28, lastDay));
  const date = new Date(year, monthIndex, day, 12, 0, 0, 0);
  return date.toISOString();
}

export async function listRecurringExpenses(filters?: {
  activeOnly?: boolean;
}): Promise<RecurringExpenseDto[]> {
  const prisma = getPrisma();
  const items = await prisma.recurringExpense.findMany({
    where: filters?.activeOnly ? { active: true } : undefined,
    orderBy: [{ active: 'desc' }, { dayOfMonth: 'asc' }, { description: 'asc' }],
  });
  return items.map(mapRecurring);
}

export async function getRecurringExpense(id: string): Promise<RecurringExpenseDto> {
  const prisma = getPrisma();
  const item = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!item) throw new Error('Despesa fixa não encontrada.');
  return mapRecurring(item);
}

export async function createRecurringExpense(
  input: RecurringExpenseCreateInput,
): Promise<RecurringExpenseDto> {
  const prisma = getPrisma();
  const item = await prisma.recurringExpense.create({
    data: {
      description: input.description.trim(),
      category: input.category,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      dayOfMonth: input.dayOfMonth,
      active: input.active ?? true,
      notes: input.notes ?? null,
    },
  });
  return mapRecurring(item);
}

export async function updateRecurringExpense(
  input: RecurringExpenseUpdateInput,
): Promise<RecurringExpenseDto> {
  const prisma = getPrisma();
  const current = await prisma.recurringExpense.findUnique({ where: { id: input.id } });
  if (!current) throw new Error('Despesa fixa não encontrada.');

  const item = await prisma.recurringExpense.update({
    where: { id: input.id },
    data: {
      description: input.description?.trim(),
      category: input.category,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      dayOfMonth: input.dayOfMonth,
      active: input.active,
      notes: input.notes === undefined ? undefined : input.notes,
    },
  });
  return mapRecurring(item);
}

export async function deleteRecurringExpense(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const current = await prisma.recurringExpense.findUnique({ where: { id } });
  if (!current) throw new Error('Despesa fixa não encontrada.');

  await prisma.expense.updateMany({
    where: { recurringExpenseId: id },
    data: { recurringExpenseId: null },
  });
  await prisma.recurringExpense.delete({ where: { id } });
  return { id };
}

export async function listPendingRecurringExpenses(
  month?: string,
): Promise<PendingRecurringExpenseDto[]> {
  const prisma = getPrisma();
  const targetMonth = month || currentMonthKey();
  const { start, end } = monthRange(targetMonth);

  const templates = await prisma.recurringExpense.findMany({
    where: { active: true },
    orderBy: [{ dayOfMonth: 'asc' }, { description: 'asc' }],
  });

  const generated = await prisma.expense.findMany({
    where: {
      recurringExpenseId: { in: templates.map((t) => t.id) },
      expenseDate: { gte: start, lte: end },
    },
    select: { recurringExpenseId: true },
  });
  const generatedIds = new Set(
    generated.map((e) => e.recurringExpenseId).filter((id): id is string => Boolean(id)),
  );

  return templates
    .filter((t) => !generatedIds.has(t.id))
    .map((t) => ({
      ...mapRecurring(t),
      month: targetMonth,
      suggestedDate: suggestedDateForMonth(targetMonth, t.dayOfMonth),
    }));
}

export async function confirmPendingRecurringExpenses(
  input: RecurringExpenseConfirmInput,
): Promise<ExpenseDto[]> {
  const prisma = getPrisma();
  const { start, end } = monthRange(input.month);
  const created: ExpenseDto[] = [];

  for (const item of input.items) {
    const template = await prisma.recurringExpense.findUnique({ where: { id: item.id } });
    if (!template) throw new Error('Despesa fixa não encontrada.');
    if (!template.active) throw new Error(`A despesa fixa "${template.description}" está inativa.`);

    const existing = await prisma.expense.findFirst({
      where: {
        recurringExpenseId: template.id,
        expenseDate: { gte: start, lte: end },
      },
    });
    if (existing) {
      throw new Error(`A despesa "${template.description}" já foi gerada neste mês.`);
    }

    const amount = item.amount ?? template.amount.toString();
    const expenseDate =
      item.expenseDate ?? suggestedDateForMonth(input.month, template.dayOfMonth);

    if (item.updateTemplateAmount !== false && item.amount && item.amount !== template.amount.toString()) {
      await prisma.recurringExpense.update({
        where: { id: template.id },
        data: { amount: item.amount },
      });
    }

    const expense = await createExpense({
      description: template.description,
      category: template.category,
      amount,
      paymentMethod: template.paymentMethod,
      notes: template.notes,
      expenseDate,
      recurringExpenseId: template.id,
    });
    created.push(expense);
  }

  return created;
}
