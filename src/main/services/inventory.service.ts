import type { InventoryMovement, Product } from '@prisma/client';
import type { InventoryCreateInput } from '../../shared/schemas';
import type { InventoryMovementDto, PaginatedResult } from '../../shared/types';
import { getPrisma } from '../database/client';

type MovementWithProduct = InventoryMovement & { product: Product };

function mapMovement(movement: MovementWithProduct): InventoryMovementDto {
  return {
    id: movement.id,
    productId: movement.productId,
    productName: movement.product.name,
    type: movement.type,
    quantity: movement.quantity,
    reason: movement.reason,
    notes: movement.notes,
    previousStock: movement.previousStock,
    resultingStock: movement.resultingStock,
    allowNegative: movement.allowNegative,
    saleId: movement.saleId,
    movedAt: movement.movedAt.toISOString(),
    createdAt: movement.createdAt.toISOString(),
  };
}

function resolveStockDelta(
  type: InventoryCreateInput['type'],
  quantity: number,
): number {
  switch (type) {
    case 'ENTRY':
    case 'RETURN':
      return quantity;
    case 'EXIT':
    case 'LOSS':
      return -quantity;
    case 'ADJUSTMENT':
      return quantity;
    default:
      return 0;
  }
}

export async function listMovements(filters?: {
  productId?: string;
  search?: string;
  type?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}): Promise<PaginatedResult<InventoryMovementDto>> {
  const prisma = getPrisma();
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const search = filters?.search?.trim() || undefined;
  const where: Record<string, unknown> = {};
  const and: Record<string, unknown>[] = [];

  if (filters?.productId) {
    where.productId = filters.productId;
  }

  if (
    filters?.type &&
    ['ENTRY', 'EXIT', 'LOSS', 'ADJUSTMENT', 'RETURN', 'SALE'].includes(filters.type)
  ) {
    where.type = filters.type;
  }

  if (search) {
    and.push({ product: { name: { contains: search } } });
  }

  const movedAt: { gte?: Date; lte?: Date } = {};
  if (filters?.startDate) {
    const start = parseFilterDate(filters.startDate, 'start');
    if (start) movedAt.gte = start;
  }
  if (filters?.endDate) {
    const end = parseFilterDate(filters.endDate, 'end');
    if (end) movedAt.lte = end;
  }
  if (movedAt.gte || movedAt.lte) {
    where.movedAt = movedAt;
  }

  if (and.length) {
    where.AND = and;
  }

  const [total, movements] = await Promise.all([
    prisma.inventoryMovement.count({ where }),
    prisma.inventoryMovement.findMany({
      where,
      include: { product: true },
      orderBy: { movedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: movements.map(mapMovement),
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

export async function createMovement(
  input: InventoryCreateInput,
): Promise<InventoryMovementDto> {
  const prisma = getPrisma();

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findFirst({
      where: { id: input.productId, deletedAt: null },
    });
    if (!product) throw new Error('Produto não encontrado.');

    const previousStock = product.stockQuantity;
    let resultingStock: number;

    if (input.type === 'ADJUSTMENT') {
      resultingStock = input.quantity;
    } else {
      resultingStock = previousStock + resolveStockDelta(input.type, input.quantity);
    }

    if (resultingStock < 0 && !input.allowNegative) {
      throw new Error(
        'Estoque insuficiente. Confirme explicitamente para permitir estoque negativo.',
      );
    }

    await tx.product.update({
      where: { id: product.id },
      data: { stockQuantity: resultingStock },
    });

    const movement = await tx.inventoryMovement.create({
      data: {
        productId: product.id,
        type: input.type,
        quantity:
          input.type === 'ADJUSTMENT'
            ? Math.abs(resultingStock - previousStock) || input.quantity
            : input.quantity,
        reason: input.reason ?? null,
        notes: input.notes ?? null,
        previousStock,
        resultingStock,
        allowNegative: input.allowNegative ?? false,
        movedAt: input.movedAt ? new Date(input.movedAt) : new Date(),
      },
      include: { product: true },
    });

    return mapMovement(movement);
  });
}
