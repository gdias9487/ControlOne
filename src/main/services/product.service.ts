import type { Product, Category } from '@prisma/client';
import type { ProductCreateInput, ProductListFilters, ProductUpdateInput } from '../../shared/schemas';
import type { LowStockProductDto, PaginatedResult, ProductDto } from '../../shared/types';
import { calcProfitMargin, money } from '../../shared/utils/money';
import { getPrisma } from '../database/client';
import { toAppImageUrl } from '../utils/paths';

type ProductWithCategory = Product & { category: Category };

function mapProduct(product: ProductWithCategory): ProductDto {
  return {
    id: product.id,
    name: product.name,
    categoryId: product.categoryId,
    categoryName: product.category.name,
    internalCode: product.internalCode,
    description: product.description,
    photoPath: product.photoPath,
    photoUrl: toAppImageUrl(product.photoPath),
    cost: money(product.cost.toString()),
    salePrice: money(product.salePrice.toString()),
    profitMargin: money(product.profitMargin.toString()),
    stockQuantity: product.stockQuantity,
    minStock: product.minStock,
    status: product.status,
    createdAt: product.createdAt.toISOString(),
    updatedAt: product.updatedAt.toISOString(),
    isLowStock: isProductLowStock(product.stockQuantity, product.minStock),
  };
}

/** Zerado sempre alerta; abaixo do mínimo só se minStock > 0. */
export function isProductLowStock(stockQuantity: number, minStock: number): boolean {
  if (stockQuantity <= 0) return true;
  if (minStock <= 0) return false;
  return stockQuantity <= minStock;
}

function toLowStockDto(
  product: ProductWithCategory,
  highDemandIds: Set<string>,
): LowStockProductDto {
  const base = mapProduct(product);
  const urgency: LowStockProductDto['urgency'] =
    product.stockQuantity <= 0 ? 'critical' : 'warning';
  const unitsShort =
    product.minStock > 0
      ? Math.max(0, product.minStock - product.stockQuantity)
      : product.stockQuantity <= 0
        ? 1
        : 0;
  return {
    ...base,
    urgency,
    unitsShort,
    isHighDemand: highDemandIds.has(product.id),
  };
}

async function loadHighDemandProductIds(limit = 10): Promise<Set<string>> {
  const prisma = getPrisma();
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const items = await prisma.saleItem.groupBy({
    by: ['productId'],
    where: {
      sale: { status: 'COMPLETED', soldAt: { gte: since } },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: 'desc' } },
    take: limit,
  });
  return new Set(
    items.map((i) => i.productId).filter((id): id is string => Boolean(id)),
  );
}

function sortLowStock(a: LowStockProductDto, b: LowStockProductDto): number {
  if (a.urgency !== b.urgency) return a.urgency === 'critical' ? -1 : 1;
  if (a.isHighDemand !== b.isHighDemand) return a.isHighDemand ? -1 : 1;
  if (a.unitsShort !== b.unitsShort) return b.unitsShort - a.unitsShort;
  return a.stockQuantity - b.stockQuantity;
}

export async function listProducts(
  filters: ProductListFilters,
): Promise<PaginatedResult<ProductDto>> {
  const prisma = getPrisma();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const where = {
    deletedAt: null,
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search } },
            { internalCode: { contains: filters.search } },
            { description: { contains: filters.search } },
          ],
        }
      : {}),
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
  };

  const orderBy =
    filters.sortBy === 'stock'
      ? { stockQuantity: filters.sortOrder }
      : filters.sortBy === 'price'
        ? { salePrice: filters.sortOrder }
        : filters.sortBy === 'createdAt'
          ? { createdAt: filters.sortOrder }
          : { name: filters.sortOrder };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: products.map(mapProduct),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getProduct(id: string): Promise<ProductDto> {
  const prisma = getPrisma();
  const product = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: { category: true },
  });
  if (!product) throw new Error('Produto não encontrado.');
  return mapProduct(product);
}

export async function createProduct(input: ProductCreateInput): Promise<ProductDto> {
  const prisma = getPrisma();
  const codeExists = await prisma.product.findUnique({
    where: { internalCode: input.internalCode },
  });
  if (codeExists) throw new Error('Já existe um produto com este código interno.');

  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category) throw new Error('Categoria inválida.');

  const profitMargin = calcProfitMargin(input.cost, input.salePrice);

  const product = await prisma.product.create({
    data: {
      name: input.name,
      categoryId: input.categoryId,
      internalCode: input.internalCode,
      description: input.description ?? null,
      photoPath: input.photoPath ?? null,
      cost: input.cost,
      salePrice: input.salePrice,
      profitMargin,
      stockQuantity: input.stockQuantity ?? 0,
      minStock: input.minStock ?? 0,
      status: input.status ?? 'ACTIVE',
    },
    include: { category: true },
  });

  if ((input.stockQuantity ?? 0) > 0) {
    await prisma.inventoryMovement.create({
      data: {
        productId: product.id,
        type: 'ENTRY',
        quantity: input.stockQuantity ?? 0,
        reason: 'Estoque inicial',
        previousStock: 0,
        resultingStock: input.stockQuantity ?? 0,
      },
    });
  }

  return mapProduct(product);
}

export async function updateProduct(input: ProductUpdateInput): Promise<ProductDto> {
  const prisma = getPrisma();
  const current = await prisma.product.findFirst({
    where: { id: input.id, deletedAt: null },
  });
  if (!current) throw new Error('Produto não encontrado.');

  if (input.internalCode && input.internalCode !== current.internalCode) {
    const duplicate = await prisma.product.findUnique({
      where: { internalCode: input.internalCode },
    });
    if (duplicate) throw new Error('Já existe um produto com este código interno.');
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category) throw new Error('Categoria inválida.');
  }

  const cost = input.cost ?? current.cost.toString();
  const salePrice = input.salePrice ?? current.salePrice.toString();
  const profitMargin = calcProfitMargin(cost, salePrice);

  const product = await prisma.product.update({
    where: { id: input.id },
    data: {
      name: input.name,
      categoryId: input.categoryId,
      internalCode: input.internalCode,
      description: input.description === undefined ? undefined : input.description,
      photoPath: input.photoPath === undefined ? undefined : input.photoPath,
      cost: input.cost,
      salePrice: input.salePrice,
      profitMargin,
      minStock: input.minStock,
      status: input.status,
    },
    include: { category: true },
  });

  return mapProduct(product);
}

export async function deleteProduct(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const product = await prisma.product.findFirst({ where: { id, deletedAt: null } });
  if (!product) throw new Error('Produto não encontrado.');

  const saleItems = await prisma.saleItem.count({ where: { productId: id } });
  if (saleItems > 0) {
    await prisma.product.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'INACTIVE' },
    });
  } else {
    await prisma.inventoryMovement.deleteMany({ where: { productId: id } });
    await prisma.product.delete({ where: { id } });
  }

  return { id };
}

export async function listLowStockProducts(): Promise<LowStockProductDto[]> {
  const prisma = getPrisma();
  const [products, highDemandIds] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, status: 'ACTIVE' },
      include: { category: true },
    }),
    loadHighDemandProductIds(),
  ]);

  return products
    .filter((p) => isProductLowStock(p.stockQuantity, p.minStock))
    .map((p) => toLowStockDto(p, highDemandIds))
    .sort(sortLowStock);
}

export async function listLowStockForProductIds(
  productIds: string[],
): Promise<LowStockProductDto[]> {
  if (productIds.length === 0) return [];
  const prisma = getPrisma();
  const uniqueIds = [...new Set(productIds)];
  const [products, highDemandIds] = await Promise.all([
    prisma.product.findMany({
      where: { id: { in: uniqueIds }, deletedAt: null, status: 'ACTIVE' },
      include: { category: true },
    }),
    loadHighDemandProductIds(),
  ]);
  return products
    .filter((p) => isProductLowStock(p.stockQuantity, p.minStock))
    .map((p) => toLowStockDto(p, highDemandIds))
    .sort(sortLowStock);
}
