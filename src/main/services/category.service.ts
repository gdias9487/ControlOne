import type { CategoryCreateInput, CategoryUpdateInput } from '../../shared/schemas';
import type { CategoryDto } from '../../shared/types';
import { getPrisma } from '../database/client';

function mapCategory(
  category: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count?: { products: number };
  },
): CategoryDto {
  return {
    id: category.id,
    name: category.name,
    description: category.description,
    createdAt: category.createdAt.toISOString(),
    updatedAt: category.updatedAt.toISOString(),
    productCount: category._count?.products,
  };
}

export async function listCategories(): Promise<CategoryDto[]> {
  const prisma = getPrisma();
  const categories = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { products: true } } },
  });
  return categories.map(mapCategory);
}

export async function getCategory(id: string): Promise<CategoryDto> {
  const prisma = getPrisma();
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw new Error('Categoria não encontrada.');
  return mapCategory(category);
}

export async function createCategory(input: CategoryCreateInput): Promise<CategoryDto> {
  const prisma = getPrisma();
  const existing = await prisma.category.findUnique({ where: { name: input.name } });
  if (existing) throw new Error('Já existe uma categoria com este nome.');

  const category = await prisma.category.create({
    data: {
      name: input.name,
      description: input.description ?? null,
    },
    include: { _count: { select: { products: true } } },
  });
  return mapCategory(category);
}

export async function updateCategory(input: CategoryUpdateInput): Promise<CategoryDto> {
  const prisma = getPrisma();
  const current = await prisma.category.findUnique({ where: { id: input.id } });
  if (!current) throw new Error('Categoria não encontrada.');

  if (input.name && input.name !== current.name) {
    const duplicate = await prisma.category.findUnique({ where: { name: input.name } });
    if (duplicate) throw new Error('Já existe uma categoria com este nome.');
  }

  const category = await prisma.category.update({
    where: { id: input.id },
    data: {
      name: input.name,
      description: input.description === undefined ? undefined : input.description,
    },
    include: { _count: { select: { products: true } } },
  });
  return mapCategory(category);
}

export async function deleteCategory(id: string): Promise<{ id: string }> {
  const prisma = getPrisma();
  const category = await prisma.category.findUnique({
    where: { id },
    include: { _count: { select: { products: true } } },
  });
  if (!category) throw new Error('Categoria não encontrada.');
  if (category._count.products > 0) {
    throw new Error('Não é possível excluir uma categoria com produtos vinculados.');
  }
  await prisma.category.delete({ where: { id } });
  return { id };
}
