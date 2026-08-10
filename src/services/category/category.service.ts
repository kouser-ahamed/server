import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { CategoryValidation } from './category.validation';

const createCategory = async (payload: unknown) => {
  const data = CategoryValidation.createCategorySchema.parse(payload);

  const existing = await prisma.category.findUnique({ where: { name: data.name } });
  if (existing) {
    throw new AppError(409, 'A category with this name already exists.');
  }

  return prisma.category.create({ data });
};

const getAllCategories = async (query: unknown) => {
  const page = Number((query as { page?: string }).page) || 1;
  const limit = Number((query as { limit?: string }).limit) || 20;

  const where = { isDeleted: false };

  const [categories, total] = await Promise.all([
    prisma.category.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { _count: { select: { vehicles: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.category.count({ where }),
  ]);

  return { categories, meta: { page, limit, total } };
};

const getCategoryById = async (categoryId: string) => {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    include: { vehicles: { where: { isDeleted: false } } },
  });

  if (!category || category.isDeleted) {
    throw new AppError(404, 'Category not found.');
  }

  return category;
};

const updateCategory = async (categoryId: string, payload: unknown) => {
  const data = CategoryValidation.updateCategorySchema.parse(payload);

  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing || existing.isDeleted) {
    throw new AppError(404, 'Category not found.');
  }

  return prisma.category.update({ where: { id: categoryId }, data });
};

const deleteCategory = async (categoryId: string) => {
  const existing = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!existing || existing.isDeleted) {
    throw new AppError(404, 'Category not found.');
  }

  const vehicleCount = await prisma.vehicle.count({
    where: { categoryId, isDeleted: false },
  });

  if (vehicleCount > 0) {
    throw new AppError(400, 'Cannot delete a category that still has vehicles.');
  }

  return prisma.category.update({
    where: { id: categoryId },
    data: { isDeleted: true },
  });
};

export const CategoryService = {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
