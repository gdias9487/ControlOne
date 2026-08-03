import type { Customer, Service } from '@prisma/client';
import type {
  ServiceCreateInput,
  ServiceUpdateInput,
  SettleFiadoInput,
} from '../../shared/schemas';
import type { PaginatedResult, ServiceDto } from '../../shared/types';
import {
  applyPercentDiscount,
  compareMoney,
  money,
  subtractMoney,
  sumMoney,
} from '../../shared/utils/money';
import { getPrisma } from '../database/client';

type ServiceWithCustomer = Service & { customer?: Customer | null };

function fiadoPaidAmountOf(service: Service): string {
  const raw = (
    service as Service & { fiadoPaidAmount?: { toString(): string } | string | number | null }
  ).fiadoPaidAmount;
  return money(raw?.toString() ?? '0');
}

function mapService(service: ServiceWithCustomer): ServiceDto {
  const amount = money(service.amount.toString());
  const fiadoPaidAmount = fiadoPaidAmountOf(service);
  const fiadoRemaining = money(
    Math.max(0, Number(subtractMoney(amount, fiadoPaidAmount))),
  );
  const isFiadoOpen =
    service.paymentMethod === 'FIADO' &&
    service.status === 'COMPLETED' &&
    service.fiadoPaidAt == null &&
    compareMoney(fiadoRemaining, '0') > 0;

  return {
    id: service.id,
    catalogId: service.catalogId,
    customerId: service.customerId,
    customerName: service.customer?.name ?? null,
    name: service.name,
    description: service.description,
    amount,
    cost: money(service.cost.toString()),
    paymentMethod: service.paymentMethod,
    status: service.status,
    fiadoPaidAmount,
    fiadoRemaining,
    fiadoPaidAt: service.fiadoPaidAt?.toISOString() ?? null,
    isFiadoOpen,
    notes: service.notes,
    performedAt: service.performedAt.toISOString(),
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

async function assertCustomer(customerId: string | null | undefined, requireForFiado: boolean) {
  const prisma = getPrisma();
  if (!customerId) {
    if (requireForFiado) {
      throw new Error('Selecione o cliente para serviço fiado.');
    }
    return;
  }
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) throw new Error('Cliente não encontrado.');
}

export async function listServices(filters?: {
  page?: number;
  pageSize?: number;
  search?: string;
  customerName?: string;
  code?: string;
  status?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
}): Promise<PaginatedResult<ServiceDto>> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const search = filters?.search?.trim() || undefined;
  const customerName = filters?.customerName?.trim() || undefined;
  const code = filters?.code?.trim() || undefined;
  const paymentMethod =
    filters?.paymentMethod &&
    ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER', 'FIADO'].includes(filters.paymentMethod)
      ? (filters.paymentMethod as Service['paymentMethod'])
      : undefined;

  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (filters?.status === 'CANCELLED') {
    where.status = 'CANCELLED';
  } else if (filters?.status === 'COMPLETED') {
    and.push({
      status: 'COMPLETED',
      OR: [{ paymentMethod: { not: 'FIADO' } }, { fiadoPaidAt: { not: null } }],
    });
  } else if (filters?.status === 'FIADO_OPEN') {
    and.push({
      paymentMethod: 'FIADO',
      status: 'COMPLETED',
      fiadoPaidAt: null,
    });
  }

  if (paymentMethod) {
    where.paymentMethod = paymentMethod;
  }

  if (search) {
    and.push({
      OR: [
        { name: { contains: search } },
        { description: { contains: search } },
        { notes: { contains: search } },
        { id: { contains: search } },
        { customer: { name: { contains: search } } },
      ],
    });
  }

  if (code) {
    and.push({
      OR: [{ id: { contains: code } }, { name: { contains: code } }],
    });
  }

  if (customerName) {
    and.push({ customer: { name: { contains: customerName } } });
  }

  const performedAt: { gte?: Date; lte?: Date } = {};
  if (filters?.startDate) {
    const start = parseFilterDate(filters.startDate, 'start');
    if (start) performedAt.gte = start;
  }
  if (filters?.endDate) {
    const end = parseFilterDate(filters.endDate, 'end');
    if (end) performedAt.lte = end;
  }
  if (performedAt.gte || performedAt.lte) {
    where.performedAt = performedAt;
  }

  if (and.length) {
    where.AND = and;
  }

  const orderBy = (() => {
    switch (filters?.sort) {
      case 'oldest':
        return { performedAt: 'asc' as const };
      case 'amount_desc':
        return { amount: 'desc' as const };
      case 'amount_asc':
        return { amount: 'asc' as const };
      case 'newest':
      default:
        return { performedAt: 'desc' as const };
    }
  })();

  const [total, services] = await Promise.all([
    prisma.service.count({ where }),
    prisma.service.findMany({
      where,
      include: { customer: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: services.map(mapService),
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
export async function getService(id: string): Promise<ServiceDto> {
  const prisma = getPrisma();
  const service = await prisma.service.findUnique({
    where: { id },
    include: { customer: true },
  });
  if (!service) throw new Error('Serviço não encontrado.');
  return mapService(service);
}

export async function createService(input: ServiceCreateInput): Promise<ServiceDto> {
  const prisma = getPrisma();

  let name = input.name.trim();
  let description = input.description ?? null;
  let amount = input.amount;
  let cost = input.cost ?? '0';
  const catalogId = input.catalogId ?? null;
  const customerId = input.customerId || null;

  await assertCustomer(customerId, input.paymentMethod === 'FIADO');

  if (catalogId) {
    const catalog = await prisma.serviceCatalog.findUnique({ where: { id: catalogId } });
    if (!catalog) throw new Error('Serviço do catálogo não encontrado.');
    if (catalog.status !== 'ACTIVE') throw new Error('Este serviço está inativo.');
    name = catalog.name;
    if (input.description === undefined) description = catalog.description;
    amount = input.amount || catalog.amount.toString();
    cost = input.cost ?? catalog.cost.toString();
  }

  amount = applyPercentDiscount(amount, input.discountPercent ?? '0');

  const service = await prisma.service.create({
    data: {
      catalogId,
      customerId,
      name,
      description,
      amount,
      cost,
      paymentMethod: input.paymentMethod,
      status: input.status ?? 'COMPLETED',
      notes: input.notes ?? null,
      performedAt: input.performedAt ? new Date(input.performedAt) : new Date(),
    },
    include: { customer: true },
  });
  return mapService(service);
}

export async function updateService(input: ServiceUpdateInput): Promise<ServiceDto> {
  const prisma = getPrisma();
  const current = await prisma.service.findUnique({ where: { id: input.id } });
  if (!current) throw new Error('Serviço não encontrado.');

  const paymentMethod = input.paymentMethod ?? current.paymentMethod;
  const customerId =
    input.customerId === undefined ? current.customerId : input.customerId || null;
  await assertCustomer(customerId, paymentMethod === 'FIADO');

  const service = await prisma.service.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description,
      amount: input.amount,
      cost: input.cost,
      paymentMethod: input.paymentMethod,
      customerId: input.customerId === undefined ? undefined : customerId,
      status: input.status,
      notes: input.notes === undefined ? undefined : input.notes,
      performedAt: input.performedAt ? new Date(input.performedAt) : undefined,
    },
    include: { customer: true },
  });
  return mapService(service);
}

export async function settleFiado(input: SettleFiadoInput): Promise<ServiceDto> {
  const prisma = getPrisma();
  const service = await prisma.service.findUnique({
    where: { id: input.id },
    include: { customer: true },
  });
  if (!service) throw new Error('Serviço não encontrado.');
  if (service.status !== 'COMPLETED') {
    throw new Error('Só é possível baixar fiado de serviços concluídos.');
  }
  if (service.paymentMethod !== 'FIADO') {
    throw new Error('Este serviço não é fiado.');
  }
  if (service.fiadoPaidAt) {
    throw new Error('Este fiado já foi quitado.');
  }

  const amount = money(service.amount.toString());
  const alreadyPaid = fiadoPaidAmountOf(service);
  const remaining = money(Math.max(0, Number(subtractMoney(amount, alreadyPaid))));
  if (compareMoney(remaining, '0') <= 0) {
    throw new Error('Este fiado já foi quitado.');
  }

  const payAmount = money(input.amount);
  if (compareMoney(payAmount, '0') <= 0) {
    throw new Error('Informe um valor maior que zero.');
  }
  if (compareMoney(payAmount, remaining) > 0) {
    throw new Error(`Valor maior que o restante em aberto (${remaining}).`);
  }

  const newPaid = sumMoney([alreadyPaid, payAmount]);
  const fullyPaid = compareMoney(newPaid, amount) >= 0;

  const updated = await prisma.service.update({
    where: { id: input.id },
    data: {
      fiadoPaidAmount: newPaid,
      fiadoPaidAt: fullyPaid ? new Date() : null,
    },
    include: { customer: true },
  });

  return mapService(updated);
}

export async function deleteService(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const service = await prisma.service.findUnique({ where: { id } });
  if (!service) throw new Error('Serviço não encontrado.');
  await prisma.service.delete({ where: { id } });
  return { id };
}
