import type { Customer, Product, Sale, SaleItem, SalePayment } from '@prisma/client';
import type { PaymentMethod, SaleCreateInput, SettleFiadoInput } from '../../shared/schemas';
import type { PaginatedResult, SaleDto, SaleItemDto } from '../../shared/types';
import {
  compareMoney,
  discountFromPercent,
  money,
  multiplyMoney,
  subtractMoney,
  sumMoney,
  toDecimal,
} from '../../shared/utils/money';
import {
  primaryPaymentMethod,
  paymentsSum,
  resolvePayments,
  saleFiadoState,
} from '../../shared/utils/sale-payments';
import { getPrisma } from '../database/client';
import { hasBusinessModule, usesCustomerPlansEnabled } from './business-modules';
import { addDays } from '../../shared/utils/customer-plan';
import { listLowStockForProductIds } from './product.service';

const SALE_INCLUDE = { items: true, customer: true, payments: true } as const;

type SaleWithRelations = Sale & {
  items: (SaleItem & { product?: Product })[];
  customer?: Customer | null;
  payments?: SalePayment[];
};

function fiadoPaidAmountOf(sale: Sale): string {
  const raw = (sale as Sale & { fiadoPaidAmount?: { toString(): string } | string | number | null })
    .fiadoPaidAmount;
  return money(raw?.toString() ?? '0');
}

function mapItem(item: SaleItem): SaleItemDto {
  const discountPercent = money(
    (
      item as SaleItem & { discountPercent?: { toString(): string } }
    ).discountPercent?.toString() ?? '0',
  );
  return {
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: item.quantity,
    unitPrice: money(item.unitPrice.toString()),
    unitCost: money(item.unitCost.toString()),
    discountPercent,
    subtotal: money(item.subtotal.toString()),
  };
}

function mapSale(sale: SaleWithRelations): SaleDto {
  const total = money(sale.total.toString());
  const payments = resolvePayments(
    (sale.payments ?? []).map((payment) => ({
      method: payment.method as PaymentMethod,
      amount: money(payment.amount.toString()),
    })),
    sale.paymentMethod as PaymentMethod,
    total,
  );
  const fiadoPaidAmount = fiadoPaidAmountOf(sale);
  const { fiadoRemaining, isFiadoOpen } = saleFiadoState({
    status: sale.status,
    fiadoPaidAt: sale.fiadoPaidAt,
    fiadoPaidAmount,
    payments,
  });

  return {
    id: sale.id,
    saleNumber: sale.saleNumber,
    customerId: sale.customerId,
    customerName: sale.customer?.name ?? null,
    discount: money(sale.discount.toString()),
    subtotal: money(sale.subtotal.toString()),
    total,
    paymentMethod: primaryPaymentMethod(payments),
    payments,
    status: sale.status,
    fiadoPaidAmount,
    fiadoRemaining,
    fiadoPaidAt: sale.fiadoPaidAt?.toISOString() ?? null,
    isFiadoOpen,
    notes: sale.notes,
    soldAt: sale.soldAt.toISOString(),
    createdAt: sale.createdAt.toISOString(),
    updatedAt: sale.updatedAt.toISOString(),
    items: sale.items.map(mapItem),
  };
}

async function nextSaleNumber(): Promise<string> {
  const prisma = getPrisma();
  const count = await prisma.sale.count();
  const year = new Date().getFullYear();
  return `VD-${year}-${String(count + 1).padStart(5, '0')}`;
}

export async function listSales(filters?: {
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
}): Promise<PaginatedResult<SaleDto>> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const search = filters?.search?.trim() || undefined;
  const customerName = filters?.customerName?.trim() || undefined;
  const code = filters?.code?.trim() || undefined;
  const paymentMethod =
    filters?.paymentMethod &&
    ['PIX', 'CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'OTHER', 'FIADO'].includes(filters.paymentMethod)
      ? (filters.paymentMethod as Sale['paymentMethod'])
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
    and.push({
      OR: [
        { paymentMethod },
        { payments: { some: { method: paymentMethod } } },
      ],
    });
  }

  if (code) {
    and.push({ saleNumber: { contains: code } });
  }

  if (customerName) {
    and.push({ customer: { name: { contains: customerName } } });
  }

  if (search) {
    and.push({
      OR: [
        { saleNumber: { contains: search } },
        { notes: { contains: search } },
        { customer: { name: { contains: search } } },
        { items: { some: { productName: { contains: search } } } },
      ],
    });
  }

  const soldAt: { gte?: Date; lte?: Date } = {};
  if (filters?.startDate) {
    const start = parseFilterDate(filters.startDate, 'start');
    if (start) soldAt.gte = start;
  }
  if (filters?.endDate) {
    const end = parseFilterDate(filters.endDate, 'end');
    if (end) soldAt.lte = end;
  }
  if (soldAt.gte || soldAt.lte) {
    where.soldAt = soldAt;
  }

  if (and.length) {
    where.AND = and;
  }

  const orderBy = (() => {
    switch (filters?.sort) {
      case 'oldest':
        return { soldAt: 'asc' as const };
      case 'amount_desc':
        return { total: 'desc' as const };
      case 'amount_asc':
        return { total: 'asc' as const };
      case 'newest':
      default:
        return { soldAt: 'desc' as const };
    }
  })();

  const [total, sales] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      include: SALE_INCLUDE,
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: sales.map((sale) => mapSale(sale)),
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
export async function getSale(id: string): Promise<SaleDto> {
  const prisma = getPrisma();
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: SALE_INCLUDE,
  });
  if (!sale) throw new Error('Venda não encontrada.');
  return mapSale(sale);
}

export async function createSale(input: SaleCreateInput): Promise<SaleDto> {
  const prisma = getPrisma();
  const trackInventory = await hasBusinessModule('inventory');
  const assignPlans = await usesCustomerPlansEnabled();

  const sale = await prisma.$transaction(async (tx) => {
    const usesFiado =
      input.paymentMethod === 'FIADO' ||
      (input.payments ?? []).some((payment) => payment.method === 'FIADO');
    if (!input.customerId) {
      if (assignPlans) {
        throw new Error('Selecione o cliente para vincular o plano.');
      }
      if (usesFiado) {
        throw new Error('Selecione o cliente para venda fiada.');
      }
    } else {
      const customer = await tx.customer.findUnique({ where: { id: input.customerId } });
      if (!customer) throw new Error('Cliente não encontrado.');
    }

    const preparedItems: Array<{
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: string;
      unitCost: string;
      discountPercent: string;
      lineDiscount: string;
      gross: string;
      subtotal: string;
      previousStock: number | null;
      resultingStock: number | null;
      durationDays: number | null;
    }> = [];

    for (const item of input.items) {
      const adHocName = item.productName?.trim() || '';
      const isAdHoc = !item.productId;

      if (isAdHoc) {
        if (!adHocName) {
          throw new Error('Informe o nome do item avulso.');
        }
        if (item.unitPrice == null) {
          throw new Error(`Informe o valor de "${adHocName}".`);
        }
        const unitPrice = item.unitPrice;
        const gross = multiplyMoney(unitPrice, item.quantity);
        const discountPercent = item.discountPercent ?? '0';
        const lineDiscount = discountFromPercent(gross, discountPercent);
        const subtotal = subtractMoney(gross, lineDiscount);

        preparedItems.push({
          productId: null,
          productName: adHocName,
          quantity: item.quantity,
          unitPrice: money(unitPrice),
          unitCost: money(0),
          discountPercent: money(discountPercent),
          lineDiscount,
          gross,
          subtotal,
          previousStock: null,
          resultingStock: null,
          durationDays: null,
        });
        continue;
      }

      const product = await tx.product.findFirst({
        where: { id: item.productId!, deletedAt: null, status: 'ACTIVE' },
      });
      if (!product) {
        throw new Error('Um dos produtos da venda não foi encontrado ou está inativo.');
      }
      if (assignPlans && (!product.durationDays || product.durationDays <= 0)) {
        throw new Error(`Defina a duração do plano "${product.name}" antes de vender.`);
      }

      const unitPrice = item.unitPrice ?? product.salePrice.toString();
      const unitCost = product.cost.toString();
      const gross = multiplyMoney(unitPrice, item.quantity);
      const discountPercent = item.discountPercent ?? '0';
      const lineDiscount = discountFromPercent(gross, discountPercent);
      const subtotal = subtractMoney(gross, lineDiscount);
      const resultingStock = product.stockQuantity - item.quantity;

      if (trackInventory && resultingStock < 0 && !input.allowNegativeStock) {
        throw new Error(
          `Estoque insuficiente para "${product.name}". Confirme para permitir estoque negativo.`,
        );
      }

      preparedItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: money(unitPrice),
        unitCost: money(unitCost),
        discountPercent: money(discountPercent),
        lineDiscount,
        gross,
        subtotal,
        previousStock: trackInventory ? product.stockQuantity : null,
        resultingStock: trackInventory ? resultingStock : null,
        durationDays: product.durationDays ?? null,
      });
    }

    const grossSubtotal = preparedItems
      .reduce((acc, item) => acc.plus(item.gross), toDecimal(0))
      .toFixed(2);
    const itemsNet = preparedItems
      .reduce((acc, item) => acc.plus(item.subtotal), toDecimal(0))
      .toFixed(2);
    const lineDiscountsTotal = preparedItems
      .reduce((acc, item) => acc.plus(item.lineDiscount), toDecimal(0))
      .toFixed(2);
    const generalDiscount = discountFromPercent(itemsNet, input.discountPercent ?? '0');
    const discount = sumMoney([lineDiscountsTotal, generalDiscount]);
    if (toDecimal(discount).greaterThan(grossSubtotal)) {
      throw new Error('O desconto não pode ser maior que o subtotal.');
    }
    const total = subtractMoney(grossSubtotal, discount);
    const payments = resolvePayments(input.payments, input.paymentMethod, total);
    if (compareMoney(paymentsSum(payments), total) !== 0) {
      throw new Error(
        `A soma das formas de pagamento (${paymentsSum(payments)}) deve ser igual ao total (${total}).`,
      );
    }
    const paymentMethod = primaryPaymentMethod(payments);
    const saleNumber = await nextSaleNumber();

    const sale = await tx.sale.create({
      data: {
        saleNumber,
        customerId: input.customerId || null,
        discount,
        subtotal: grossSubtotal,
        total,
        paymentMethod,
        notes: input.notes ?? null,
        soldAt: input.soldAt ? new Date(input.soldAt) : new Date(),
        items: {
          create: preparedItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            subtotal: item.subtotal,
          })),
        },
        payments: {
          create: payments.map((payment) => ({
            method: payment.method,
            amount: payment.amount,
          })),
        },
      },
      include: SALE_INCLUDE,
    });

    for (const created of sale.items) {
      const prepared = preparedItems.find(
        (item) =>
          item.productId === created.productId &&
          item.productName === created.productName &&
          item.quantity === created.quantity &&
          item.unitPrice === money(created.unitPrice.toString()),
      );
      if (!prepared) continue;
      await tx.$executeRawUnsafe(
        `UPDATE "SaleItem" SET "discountPercent" = ? WHERE "id" = ?`,
        prepared.discountPercent,
        created.id,
      );
    }

    for (const item of preparedItems) {
      if (!item.productId || item.previousStock == null || item.resultingStock == null) {
        continue;
      }
      await tx.product.update({
        where: { id: item.productId },
        data: { stockQuantity: item.resultingStock },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: item.productId,
          type: 'SALE',
          quantity: item.quantity,
          reason: `Venda ${saleNumber}`,
          previousStock: item.previousStock,
          resultingStock: item.resultingStock,
          allowNegative: input.allowNegativeStock ?? false,
          saleId: sale.id,
          movedAt: sale.soldAt,
        },
      });
    }

    if (assignPlans && input.customerId) {
      for (const item of preparedItems) {
        if (!item.productId || !item.durationDays || item.durationDays <= 0) continue;
        const days = item.durationDays * item.quantity;
        const startsAt = sale.soldAt;
        await tx.customerPlan.create({
          data: {
            customerId: input.customerId,
            productId: item.productId,
            productName: item.productName,
            saleId: sale.id,
            durationDays: days,
            startsAt,
            expiresAt: addDays(startsAt, days),
          },
        });
      }
    }

    const mapped = mapSale(sale);
    return {
      ...mapped,
      items: mapped.items.map((item) => {
        const prepared = preparedItems.find(
          (p) =>
            p.productId === item.productId &&
            p.productName === item.productName &&
            p.quantity === item.quantity,
        );
        return {
          ...item,
          discountPercent: money(prepared?.discountPercent ?? item.discountPercent),
        };
      }),
    };
  });

  const lowStockTriggered = await listLowStockForProductIds(
    sale.items.map((item) => item.productId).filter((id): id is string => Boolean(id)),
  );
  return { ...sale, lowStockTriggered };
}

export async function cancelSale(id: string): Promise<SaleDto> {
  const prisma = getPrisma();
  const trackInventory = await hasBusinessModule('inventory');

  return prisma.$transaction(async (tx) => {
    const sale = await tx.sale.findUnique({
      where: { id },
      include: SALE_INCLUDE,
    });
    if (!sale) throw new Error('Venda não encontrada.');
    if (sale.status === 'CANCELLED') throw new Error('Esta venda já está cancelada.');

    await tx.customerPlan.updateMany({
      where: { saleId: sale.id, cancelledAt: null },
      data: { cancelledAt: new Date() },
    });

    for (const item of sale.items) {
      if (!trackInventory || !item.productId) continue;
      const product = await tx.product.findUnique({ where: { id: item.productId } });
      if (!product) continue;
      const previousStock = product.stockQuantity;
      const resultingStock = previousStock + item.quantity;
      await tx.product.update({
        where: { id: product.id },
        data: { stockQuantity: resultingStock },
      });
      await tx.inventoryMovement.create({
        data: {
          productId: product.id,
          type: 'RETURN',
          quantity: item.quantity,
          reason: `Cancelamento da venda ${sale.saleNumber}`,
          previousStock,
          resultingStock,
          saleId: sale.id,
        },
      });
    }

    const updated = await tx.sale.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: SALE_INCLUDE,
    });

    return mapSale(updated);
  });
}

export async function settleFiado(input: SettleFiadoInput): Promise<SaleDto> {
  const prisma = getPrisma();
  const sale = await prisma.sale.findUnique({
    where: { id: input.id },
    include: SALE_INCLUDE,
  });
  if (!sale) throw new Error('Venda não encontrada.');
  if (sale.status !== 'COMPLETED') {
    throw new Error('Só é possível baixar fiado de vendas concluídas.');
  }
  const mapped = mapSale(sale);
  if (!mapped.isFiadoOpen && compareMoney(mapped.fiadoRemaining, '0') <= 0) {
    throw new Error('Esta venda não tem fiado em aberto.');
  }
  if (sale.fiadoPaidAt) {
    throw new Error('Este fiado já foi quitado.');
  }

  const alreadyPaid = fiadoPaidAmountOf(sale);
  const remaining = mapped.fiadoRemaining;
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
  const fullyPaid = compareMoney(payAmount, remaining) >= 0;

  const updated = await prisma.sale.update({
    where: { id: input.id },
    data: {
      fiadoPaidAmount: newPaid,
      fiadoPaidAt: fullyPaid ? new Date() : null,
    },
    include: SALE_INCLUDE,
  });

  return mapSale(updated);
}
