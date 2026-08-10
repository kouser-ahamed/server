import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { VehicleValidation } from './vehicle.validation';

const createVehicle = async (authUser: AuthUser, payload: unknown) => {
  const data = VehicleValidation.createVehicleSchema.parse(payload);

  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category || category.isDeleted) {
    throw new AppError(404, 'Category not found.');
  }

  return prisma.vehicle.create({
    data: {
      vendorId: authUser.id,
      categoryId: data.categoryId,
      name: data.name,
      brand: data.brand,
      model: data.model,
      images: data.images,
      pricePerDay: data.pricePerDay,
      description: data.description,
      status: data.status ?? 'AVAILABLE',
      location: data.location,
    },
    include: { category: true },
  });
};

const getAllVehicles = async (query: unknown) => {
  const q = VehicleValidation.listVehiclesQuerySchema.parse(query);

  const page = q.page ?? 1;
  const limit = q.limit ?? 10;

  const where: Prisma.VehicleWhereInput = { isDeleted: false };

  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.status) where.status = q.status;
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where.pricePerDay = { gte: q.minPrice, lte: q.maxPrice };
  }
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { brand: { contains: q.search, mode: 'insensitive' } },
      { model: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const orderBy: Prisma.VehicleOrderByWithRelationInput =
    q.sort === 'price_asc'
      ? { pricePerDay: 'asc' }
      : q.sort === 'price_desc'
        ? { pricePerDay: 'desc' }
        : { createdAt: 'desc' };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true },
      orderBy,
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { vehicles, meta: { page, limit, total } };
};

const getVehicleById = async (vehicleId: string) => {
  const vehicle = await prisma.vehicle.findUnique({
    where: { id: vehicleId },
    include: {
      category: true,
      vendor: {
        select: {
          id: true,
          profileImage: true,
          role: true,
          authProvider: true,
          isBlocked: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      reviews: {
        where: { isDeleted: false },
        include: { user: { select: { id: true, name: true, profileImage: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  const reviewCount = vehicle.reviews.length;
  const averageRating = reviewCount
    ? +(vehicle.reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount).toFixed(2)
    : 0;

  return { ...vehicle, averageRating, reviewCount };
};

const getMyVehicles = async (authUser: AuthUser, query: unknown) => {
  const page = Number((query as { page?: string }).page) || 1;
  const limit = Number((query as { limit?: string }).limit) || 10;

  const where: Prisma.VehicleWhereInput = { vendorId: authUser.id, isDeleted: false };

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true, _count: { select: { bookings: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.vehicle.count({ where }),
  ]);

  return { vehicles, meta: { page, limit, total } };
};

const updateVehicle = async (vehicleId: string, authUser: AuthUser, payload: unknown) => {
  const data = VehicleValidation.updateVehicleSchema.parse(payload);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.vendorId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only update your own vehicles.');
  }

  return prisma.vehicle.update({ where: { id: vehicleId }, data });
};

const deleteVehicle = async (vehicleId: string, authUser: AuthUser) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.vendorId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only delete your own vehicles.');
  }

  const activeBookings = await prisma.booking.count({
    where: { vehicleId, status: { in: ['PENDING', 'CONFIRMED', 'ONGOING'] } },
  });

  if (activeBookings > 0) {
    throw new AppError(400, 'Cannot delete a vehicle with active bookings.');
  }

  return prisma.vehicle.update({
    where: { id: vehicleId },
    data: { isDeleted: true },
  });
};

export const VehicleService = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  getMyVehicles,
  updateVehicle,
  deleteVehicle,
};
