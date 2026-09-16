import type { Customer, CustomerPlan, Product, Sale } from '@prisma/client';
import type { CustomerPlanListFilters } from '../../shared/schemas';
import type { CustomerPlanDto, PaginatedResult } from '../../shared/types';
import {
  customerPlanStatus,
  type CustomerPlanLifeStatus,
} from '../../shared/utils/customer-plan';
import { getPrisma } from '../database/client';

type PlanWithRelations = CustomerPlan & {
  customer?: Customer | null;
  product?: Product | null;
  sale?: Sale | null;
};

export function mapCustomerPlan(plan: PlanWithRelations, now = new Date()): CustomerPlanDto {
  return {
    id: plan.id,
    customerId: plan.customerId,
    customerName: plan.customer?.name ?? '',
    productId: plan.productId,
    productName: plan.productName,
    saleId: plan.saleId,
    durationDays: plan.durationDays,
    startsAt: plan.startsAt.toISOString(),
    expiresAt: plan.expiresAt.toISOString(),
    cancelledAt: plan.cancelledAt?.toISOString() ?? null,
    status: customerPlanStatus(plan, now),
    createdAt: plan.createdAt.toISOString(),
  };
}

function statusWhere(status: CustomerPlanLifeStatus | 'ALL' | undefined, now: Date) {
  if (!status || status === 'ALL') return {};
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const inSevenDays = new Date(today);
  inSevenDays.setDate(inSevenDays.getDate() + 8);

  if (status === 'CANCELLED') return { cancelledAt: { not: null } };
  if (status === 'EXPIRED') {
    return { cancelledAt: null, expiresAt: { lt: today } };
  }
  if (status === 'EXPIRING') {
    return { cancelledAt: null, expiresAt: { gte: today, lt: inSevenDays } };
  }
  return { cancelledAt: null, expiresAt: { gte: today } };
}

export async function listCustomerPlans(
  filters: CustomerPlanListFilters = {},
): Promise<PaginatedResult<CustomerPlanDto>> {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const now = new Date();
  const search = filters.search?.trim();

  const where = {
    ...(filters.customerId ? { customerId: filters.customerId } : {}),
    ...statusWhere(filters.status, now),
    ...(search
      ? {
          OR: [
            { productName: { contains: search } },
            { customer: { name: { contains: search } } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.customerPlan.count({ where }),
    prisma.customerPlan.findMany({
      where,
      include: { customer: true, product: true },
      orderBy: [{ expiresAt: 'asc' }, { createdAt: 'desc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: items.map((plan) => mapCustomerPlan(plan, now)),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function listExpiringCustomerPlans(days = 7): Promise<CustomerPlanDto[]> {
  const prisma = getPrisma();
  const now = new Date();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const until = new Date(today);
  until.setDate(until.getDate() + days + 1);

  const items = await prisma.customerPlan.findMany({
    where: {
      cancelledAt: null,
      expiresAt: { gte: today, lt: until },
    },
    include: { customer: true },
    orderBy: { expiresAt: 'asc' },
    take: 20,
  });
  return items.map((plan) => mapCustomerPlan(plan, now));
}

export async function listPlansForCustomer(customerId: string): Promise<CustomerPlanDto[]> {
  const prisma = getPrisma();
  const now = new Date();
  const items = await prisma.customerPlan.findMany({
    where: { customerId },
    include: { customer: true },
    orderBy: { expiresAt: 'desc' },
  });
  return items.map((plan) => mapCustomerPlan(plan, now));
}
