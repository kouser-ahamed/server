import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';

const vehicleSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  type: z.enum(['CAR', 'BIKE']),
  transmission: z.enum(['MANUAL', 'AUTOMATIC']).optional(),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  year: z.coerce.number().int().min(1950).max(new Date().getFullYear() + 1),
  images: z.array(z.string().url()).min(1, 'At least one image is required'),
  pricePerDay: z.coerce.number().positive(),
  securityDeposit: z.coerce.number().nonnegative(),
  location: z.string().min(2, 'Location is required'),
  seats: z.coerce.number().int().min(1).optional(),
  isFeatured: z.boolean().optional(),
});

const listVehicleQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  search: z.string().optional(),
  type: z.enum(['CAR', 'BIKE']).optional(),
  categoryId: z.string().optional(),
  brand: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  location: z.string().optional(),
  isAvailable: z.enum(['true', 'false']).optional(),
  sortBy: z.enum(['pricePerDay', 'rating', 'createdAt']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

const createVehicle = async (authUser: AuthUser, payload: z.infer<typeof vehicleSchema>) => {
  const data = vehicleSchema.parse(payload);

  const category = await prisma.category.findUnique({ where: { id: data.categoryId } });
  if (!category) {
    throw new AppError(404, 'Category not found.');
  }

  const vehicle = await prisma.vehicle.create({
    data: {
      hostId: authUser.id,
      categoryId: data.categoryId,
      title: data.title,
      description: data.description,
      type: data.type,
      transmission: data.transmission ?? 'MANUAL',
      brand: data.brand,
      model: data.model,
      year: data.year,
      images: data.images,
      pricePerDay: data.pricePerDay,
      securityDeposit: data.securityDeposit,
      location: data.location,
      seats: data.seats ?? (data.type === 'CAR' ? 4 : 2),
      isFeatured: data.isFeatured ?? false,
    },
    include: { category: true },
  });

  return vehicle;
};

const getAllVehicles = async (query: z.infer<typeof listVehicleQuerySchema>) => {
  const q = listVehicleQuerySchema.parse(query);

  const page = q.page ?? 1;
  const limit = q.limit ?? 10;

  const where: Prisma.VehicleWhereInput = {};

  if (q.search) {
    where.OR = [
      { title: { contains: q.search, mode: 'insensitive' } },
      { brand: { contains: q.search, mode: 'insensitive' } },
      { model: { contains: q.search, mode: 'insensitive' } },
      { location: { contains: q.search, mode: 'insensitive' } },
    ];
  }
  if (q.type) where.type = q.type;
  if (q.categoryId) where.categoryId = q.categoryId;
  if (q.brand) where.brand = { contains: q.brand, mode: 'insensitive' };
  if (q.location) where.location = { contains: q.location, mode: 'insensitive' };
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    where.pricePerDay = {
      gte: q.minPrice,
      lte: q.maxPrice,
    };
  }
  if (q.isAvailable !== undefined) {
    where.isAvailable = q.isAvailable === 'true';
  }

  const orderBy: Prisma.VehicleOrderByWithRelationInput = {};
  if (q.sortBy) {
    orderBy[q.sortBy] = q.sortOrder ?? 'desc';
  }

  const [vehicles, total] = await Promise.all([
    prisma.vehicle.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { category: true },
      orderBy: Object.keys(orderBy).length ? orderBy : { createdAt: 'desc' },
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
      host: { select: { id: true, name: true, email: true, profileImage: true } },
      reviews: {
        include: { user: { select: { id: true, name: true, profileImage: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!vehicle) {
    throw new AppError(404, 'Vehicle not found.');
  }

  return vehicle;
};

const getHostVehicles = async (authUser: AuthUser, query: { page?: number; limit?: number }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where: Prisma.VehicleWhereInput = { hostId: authUser.id };

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

const updateVehicle = async (
  vehicleId: string,
  authUser: AuthUser,
  payload: Partial<z.infer<typeof vehicleSchema>>
) => {
  const data = vehicleSchema.partial().parse(payload);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.hostId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only update your own vehicles.');
  }

  return prisma.vehicle.update({ where: { id: vehicleId }, data });
};

const deleteVehicle = async (vehicleId: string, authUser: AuthUser) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.hostId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only delete your own vehicles.');
  }

  const activeBookings = await prisma.booking.count({
    where: { vehicleId, status: { in: ['PENDING', 'CONFIRMED'] } },
  });

  if (activeBookings > 0) {
    throw new AppError(400, 'Cannot delete a vehicle with active bookings.');
  }

  await prisma.vehicle.delete({ where: { id: vehicleId } });

  return null;
};

const toggleVehicleAvailability = async (vehicleId: string, authUser: AuthUser) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.hostId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only update your own vehicles.');
  }

  return prisma.vehicle.update({
    where: { id: vehicleId },
    data: { isAvailable: !vehicle.isAvailable },
  });
};

export const VehicleService = {
  createVehicle,
  getAllVehicles,
  getVehicleById,
  getHostVehicles,
  updateVehicle,
  deleteVehicle,
  toggleVehicleAvailability,
};
