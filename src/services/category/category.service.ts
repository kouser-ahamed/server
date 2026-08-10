import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';

const categorySchema = z.object({
  name: z.string().min(2, 'Category name must be at least 2 characters'),
  description: z.string().optional(),
  image: z.string().url().optional(),
});

const createCategory = async (payload: z.infer<typeof categorySchema>) => {
  const data = categorySchema.parse(payload);

  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new AppError(409, 'A category with this name already exists.');
  }

  return prisma.category.create({ data });
};

const getAllCategories = async (query: { page?: number; limit?: number }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where: { isActive: true },
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { vehicles: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.category.count({ where: { isActive: true } }),
  ]);

  return { categories, meta: { page, limit, total } };
};

const getCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { vehicles: true },
  });

  if (!category) {
    throw new AppError(404, 'Category not found.');
  }

  return category;
};

const updateCategory = async (categoryId: string, payload: z.infer<typeof categorySchema>) => {
  const data = categorySchema.partial().parse(payload);

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new AppError(404, 'Category not found.');
  }

  return prisma.category.update({ where: { id: categoryId }, data });
};

const deleteCategory = async (categoryId: string) => {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing) {
    throw new AppError(404, 'Category not found.');
  }

  const vehicleCount = await prisma.vehicle.count({ where: { categoryId } });
  if (vehicleCount > 0) {
    throw new AppError(400, 'Cannot delete a category that still has vehicles.');
  }

  await prisma.category.delete({ where: { id: categoryId } });

  return null;
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
