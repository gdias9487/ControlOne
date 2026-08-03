import type { Customer, Sale, SaleItem, Service } from '@prisma/client';
import type { CustomerCreateInput, CustomerUpdateInput } from '../../shared/schemas';
import type {
  CustomerDto,
  CustomerHistoryDto,
  PaginatedResult,
  SaleDto,
  ServiceDto,
} from '../../shared/types';
import { compareMoney, money, subtractMoney, sumMoney } from '../../shared/utils/money';
import { getPrisma } from '../database/client';

type SaleWithItems = Sale & {
  items: SaleItem[];
  customer?: Customer | null;
};

type ServiceWithCustomer = Service & { customer?: Customer | null };

function paidAmount(value: { toString(): string } | string | number | null | undefined): string {
  return money(value?.toString() ?? '0');
}

function mapSale(sale: SaleWithItems): SaleDto {
  const total = money(sale.total.toString());
  const fiadoPaidAmount = paidAmount(
    (sale as Sale & { fiadoPaidAmount?: { toString(): string } }).fiadoPaidAmount,
  );
  const fiadoRemaining = money(Math.max(0, Number(subtractMoney(total, fiadoPaidAmount))));
  const isFiadoOpen =
    sale.paymentMethod === 'FIADO' &&
    sale.status === 'COMPLETED' &&
    sale.fiadoPaidAt == null &&
    compareMoney(fiadoRemaining, '0') > 0;

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    customerId: sale.customerId,
    customerName: sale.customer?.name ?? null,
    discount: money(sale.discount.toString()),
    subtotal: money(sale.subtotal.toString()),
    total,
    paymentMethod: sale.paymentMethod,
    status: sale.status,
    fiadoPaidAmount,
    fiadoRemaining,
    fiadoPaidAt: sale.fiadoPaidAt?.toISOString() ?? null,
    isFiadoOpen,
    notes: sale.notes,
    soldAt: sale.soldAt.toISOString(),
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    items: sale.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      unitPrice: money(item.unitPrice.toString()),
      unitCost: money(item.unitCost.toString()),
      discountPercent: money(
        (
          item as SaleItem & { discountPercent?: { toString(): string } }
        ).discountPercent?.toString() ?? '0',
      ),
      subtotal: money(item.subtotal.toString()),
    })),
  };
}

function mapService(service: ServiceWithCustomer): ServiceDto {
  const amount = money(service.amount.toString());
  const fiadoPaidAmount = paidAmount(
    (service as Service & { fiadoPaidAmount?: { toString(): string } }).fiadoPaidAmount,
  );
  const fiadoRemaining = money(Math.max(0, Number(subtractMoney(amount, fiadoPaidAmount))));
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

async function openFiadoTotalForCustomer(customerId: string): Promise<string> {
  const prisma = getPrisma();
  const [openSales, openServices] = await Promise.all([
    prisma.sale.findMany({
      where: {
        customerId,
        paymentMethod: 'FIADO',
        status: 'COMPLETED',
        fiadoPaidAt: null,
      },
      select: { total: true, fiadoPaidAmount: true },
    }),
    prisma.service.findMany({
      where: {
        customerId,
        paymentMethod: 'FIADO',
        status: 'COMPLETED',
        fiadoPaidAt: null,
      },
      select: { amount: true, fiadoPaidAmount: true },
    }),
  ]);
  return sumMoney([
    ...openSales.map((s) =>
      money(Math.max(0, Number(subtractMoney(s.total.toString(), paidAmount(s.fiadoPaidAmount))))),
    ),
    ...openServices.map((s) =>
      money(
        Math.max(0, Number(subtractMoney(s.amount.toString(), paidAmount(s.fiadoPaidAmount)))),
      ),
    ),
  ]);
}

function mapCustomer(
  customer: Customer & { _count?: { sales: number; services?: number } },
  openFiadoTotal?: string,
): CustomerDto {
  return {
    id: customer.id,
    name: customer.name,
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    salesCount: (customer._count?.sales ?? 0) + (customer._count?.services ?? 0),
    openFiadoTotal,
  };
}

export async function listCustomers(filters?: {
  search?: string;
  openFiadoOnly?: boolean;
  noOpenFiadoOnly?: boolean;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<CustomerDto>> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 50;
  const openFiadoCondition = {
    paymentMethod: 'FIADO' as const,
    status: 'COMPLETED' as const,
    fiadoPaidAt: null,
  };
  const where = {
    ...(filters?.search ? { name: { contains: filters.search } } : {}),
    ...(filters?.openFiadoOnly
      ? {
          OR: [
            { sales: { some: openFiadoCondition } },
            { services: { some: openFiadoCondition } },
          ],
        }
      : {}),
    ...(filters?.noOpenFiadoOnly
      ? {
          AND: [
            { sales: { none: openFiadoCondition } },
            { services: { none: openFiadoCondition } },
          ],
        }
      : {}),
  };

  const [total, customers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      include: { _count: { select: { sales: true, services: true } } },
      orderBy: { name: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const items: CustomerDto[] = [];
  for (const customer of customers) {
    const openFiadoTotal = await openFiadoTotalForCustomer(customer.id);
    items.push(mapCustomer(customer, openFiadoTotal));
  }

  return {
    items,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getCustomer(id: string): Promise<CustomerDto> {
  const prisma = getPrisma();
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { sales: true, services: true } } },
  });
  if (!customer) throw new Error('Cliente não encontrado.');
  const openFiadoTotal = await openFiadoTotalForCustomer(id);
  return mapCustomer(customer, openFiadoTotal);
}

export async function getCustomerHistory(id: string): Promise<CustomerHistoryDto> {
  const prisma = getPrisma();
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { sales: true, services: true } } },
  });
  if (!customer) throw new Error('Cliente não encontrado.');

  const [sales, services] = await Promise.all([
    prisma.sale.findMany({
      where: { customerId: id },
      include: { items: true, customer: true },
      orderBy: { soldAt: 'desc' },
    }),
    prisma.service.findMany({
      where: { customerId: id },
      include: { customer: true },
      orderBy: { performedAt: 'desc' },
    }),
  ]);

  const completedSales = sales.filter((s) => s.status === 'COMPLETED');
  const completedServices = services.filter((s) => s.status === 'COMPLETED');
  const openFiadoSales = completedSales.filter(
    (s) => s.paymentMethod === 'FIADO' && s.fiadoPaidAt == null,
  );
  const openFiadoServices = completedServices.filter(
    (s) => s.paymentMethod === 'FIADO' && s.fiadoPaidAt == null,
  );
  const paidFiadoSales = completedSales.filter(
    (s) => s.paymentMethod === 'FIADO' && s.fiadoPaidAt != null,
  );
  const paidFiadoServices = completedServices.filter(
    (s) => s.paymentMethod === 'FIADO' && s.fiadoPaidAt != null,
  );

  const openFiadoTotal = sumMoney([
    ...openFiadoSales.map((s) =>
      money(
        Math.max(
          0,
          Number(subtractMoney(s.total.toString(), paidAmount(s.fiadoPaidAmount))),
        ),
      ),
    ),
    ...openFiadoServices.map((s) =>
      money(
        Math.max(
          0,
          Number(subtractMoney(s.amount.toString(), paidAmount(s.fiadoPaidAmount))),
        ),
      ),
    ),
  ]);

  return {
    customer: mapCustomer(customer, openFiadoTotal),
    sales: sales.map(mapSale),
    services: services.map(mapService),
    totals: {
      salesCount: completedSales.length,
      salesTotal: sumMoney(completedSales.map((s) => s.total.toString())),
      servicesCount: completedServices.length,
      servicesTotal: sumMoney(completedServices.map((s) => s.amount.toString())),
      openFiadoTotal,
      openFiadoCount: openFiadoSales.length + openFiadoServices.length,
      paidFiadoTotal: sumMoney([
        ...paidFiadoSales.map((s) => paidAmount(s.fiadoPaidAmount)),
        ...paidFiadoServices.map((s) => paidAmount(s.fiadoPaidAmount)),
        ...openFiadoSales.map((s) => paidAmount(s.fiadoPaidAmount)),
        ...openFiadoServices.map((s) => paidAmount(s.fiadoPaidAmount)),
      ]),
    },
  };
}

export async function createCustomer(input: CustomerCreateInput): Promise<CustomerDto> {
  const prisma = getPrisma();
  const customer = await prisma.customer.create({
    data: { name: input.name.trim() },
    include: { _count: { select: { sales: true, services: true } } },
  });
  return mapCustomer(customer, '0.00');
}

export async function updateCustomer(input: CustomerUpdateInput): Promise<CustomerDto> {
  const prisma = getPrisma();
  const current = await prisma.customer.findUnique({ where: { id: input.id } });
  if (!current) throw new Error('Cliente não encontrado.');

  const customer = await prisma.customer.update({
    where: { id: input.id },
    data: { name: input.name?.trim() },
    include: { _count: { select: { sales: true, services: true } } },
  });
  const openFiadoTotal = await openFiadoTotalForCustomer(customer.id);
  return mapCustomer(customer, openFiadoTotal);
}

export async function deleteCustomer(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: { _count: { select: { sales: true, services: true } } },
  });
  if (!customer) throw new Error('Cliente não encontrado.');
  if (customer._count.sales > 0 || customer._count.services > 0) {
    throw new Error('Não é possível excluir um cliente com vendas ou serviços vinculados.');
  }
  await prisma.customer.delete({ where: { id } });
  return { id };
}
