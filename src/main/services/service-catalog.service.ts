import type { ServiceCatalog } from '@prisma/client';
import type {
  ServiceCatalogCreateInput,
  ServiceCatalogListFilters,
  ServiceCatalogUpdateInput,
} from '../../shared/schemas';
import type { PaginatedResult, ServiceCatalogDto } from '../../shared/types';
import { calcProfitMargin, money } from '../../shared/utils/money';
import { getPrisma } from '../database/client';

function mapCatalog(item: ServiceCatalog): ServiceCatalogDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    cost: money(item.cost.toString()),
    amount: money(item.amount.toString()),
    status: item.status,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

export async function listServiceCatalogs(
  filters?: ServiceCatalogListFilters,
): Promise<PaginatedResult<ServiceCatalogDto>> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const sortBy = filters?.sortBy ?? 'name';
  const sortOrder = filters?.sortOrder ?? 'asc';
  const where = {
    ...(filters?.status ? { status: filters.status } : {}),
    ...(filters?.search
      ? { name: { contains: filters.search } }
      : {}),
  };

  if (sortBy === 'margin') {
    const all = await prisma.serviceCatalog.findMany({ where });
    const mapped = all.map(mapCatalog);
    mapped.sort((a, b) => {
      const marginA = Number(calcProfitMargin(a.cost, a.amount));
      const marginB = Number(calcProfitMargin(b.cost, b.amount));
      return sortOrder === 'asc' ? marginA - marginB : marginB - marginA;
    });
    const total = mapped.length;
    const items = mapped.slice((page - 1) * pageSize, page * pageSize);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  const orderBy =
    sortBy === 'cost'
      ? { cost: sortOrder }
      : sortBy === 'amount'
        ? { amount: sortOrder }
        : { name: sortOrder };

  const [total, items] = await Promise.all([
    prisma.serviceCatalog.count({ where }),
    prisma.serviceCatalog.findMany({
      where,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: items.map(mapCatalog),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getServiceCatalog(id: string): Promise<ServiceCatalogDto> {
  const prisma = getPrisma();
  const item = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!item) throw new Error('Serviço não encontrado.');
  return mapCatalog(item);
}

export async function createServiceCatalog(
  input: ServiceCatalogCreateInput,
): Promise<ServiceCatalogDto> {
  const prisma = getPrisma();
  const item = await prisma.serviceCatalog.create({
    data: {
      name: input.name.trim(),
      description: input.description?.trim() || null,
      cost: input.cost ?? '0',
      amount: input.amount,
      status: input.status ?? 'ACTIVE',
    },
  });
  return mapCatalog(item);
}

export async function updateServiceCatalog(
  input: ServiceCatalogUpdateInput,
): Promise<ServiceCatalogDto> {
  const prisma = getPrisma();
  const current = await prisma.serviceCatalog.findUnique({ where: { id: input.id } });
  if (!current) throw new Error('Serviço não encontrado.');

  const item = await prisma.serviceCatalog.update({
    where: { id: input.id },
    data: {
      name: input.name?.trim(),
      description:
        input.description === undefined ? undefined : input.description?.trim() || null,
      cost: input.cost,
      amount: input.amount,
      status: input.status,
    },
  });
  return mapCatalog(item);
}

export async function deleteServiceCatalog(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const item = await prisma.serviceCatalog.findUnique({
    where: { id },
    include: { _count: { select: { services: true } } },
  });
  if (!item) throw new Error('Serviço não encontrado.');

  if (item._count.services > 0) {
    await prisma.serviceCatalog.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return { id };
  }

  await prisma.serviceCatalog.delete({ where: { id } });
  return { id };
}
