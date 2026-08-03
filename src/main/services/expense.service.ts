import type { Expense } from '@prisma/client';
import type { ExpenseCreateInput, ExpenseUpdateInput } from '../../shared/schemas';
import type { ExpenseDto, PaginatedResult } from '../../shared/types';
import { money } from '../../shared/utils/money';
import { getPrisma } from '../database/client';

function mapExpense(expense: Expense): ExpenseDto {
  return {
    id: expense.id,
    description: expense.description,
    category: expense.category,
    amount: money(expense.amount.toString()),
    paymentMethod: expense.paymentMethod,
    notes: expense.notes,
    expenseDate: expense.expenseDate.toISOString(),
    recurringExpenseId: expense.recurringExpenseId,
    isFixed: Boolean(expense.recurringExpenseId),
    createdAt: expense.createdAt.toISOString(),
    updatedAt: expense.updatedAt.toISOString(),
  };
}

export async function listExpenses(filters?: {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  sort?: 'newest' | 'oldest' | 'amount_desc' | 'amount_asc';
}): Promise<PaginatedResult<ExpenseDto>> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const expenseDate: { gte?: Date; lte?: Date } = {};
  if (filters?.startDate) {
    const start = parseFilterDate(filters.startDate, 'start');
    if (start) expenseDate.gte = start;
  }
  if (filters?.endDate) {
    const end = parseFilterDate(filters.endDate, 'end');
    if (end) expenseDate.lte = end;
  }
  const where = expenseDate.gte || expenseDate.lte ? { expenseDate } : {};

  const orderBy = (() => {
    switch (filters?.sort) {
      case 'oldest':
        return { expenseDate: 'asc' as const };
      case 'amount_desc':
        return { amount: 'desc' as const };
      case 'amount_asc':
        return { amount: 'asc' as const };
      case 'newest':
      default:
        return { expenseDate: 'desc' as const };
    }
  })();

  const [total, expenses] = await Promise.all([
    prisma.expense.count({ where }),
    prisma.expense.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: expenses.map(mapExpense),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

function parseFilterDate(value: string, bound: 'start' | 'end'): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T${bound === 'start' ? '00:00:00.000' : '23:59:59.999'}`);
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export async function createExpense(input: ExpenseCreateInput): Promise<ExpenseDto> {
  const prisma = getPrisma();
  const expense = await prisma.expense.create({
    data: {
      description: input.description,
      category: input.category,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      notes: input.notes ?? null,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : new Date(),
      recurringExpenseId: input.recurringExpenseId ?? null,
    },
  });
  return mapExpense(expense);
}

export async function updateExpense(input: ExpenseUpdateInput): Promise<ExpenseDto> {
  const prisma = getPrisma();
  const current = await prisma.expense.findUnique({ where: { id: input.id } });
  if (!current) throw new Error('Despesa não encontrada.');

  const expense = await prisma.expense.update({
    where: { id: input.id },
    data: {
      description: input.description,
      category: input.category,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      notes: input.notes === undefined ? undefined : input.notes,
      expenseDate: input.expenseDate ? new Date(input.expenseDate) : undefined,
    },
  });
  return mapExpense(expense);
}

export async function deleteExpense(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) throw new Error('Despesa não encontrada.');
  await prisma.expense.delete({ where: { id } });
  return { id };
}
