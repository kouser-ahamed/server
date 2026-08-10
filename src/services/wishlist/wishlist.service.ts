import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { WishlistValidation } from './wishlist.validation';

const addToWishlist = async (authUser: AuthUser, payload: unknown) => {
  const { vehicleId } = WishlistValidation.addToWishlistSchema.parse(payload);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });
  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  const existing = await prisma.wishlist.findUnique({
    where: { userId_vehicleId: { userId: authUser.id, vehicleId } },
  });

  if (existing) {
    throw new AppError(409, 'This vehicle is already in your wishlist.');
  }

  return prisma.wishlist.create({
    data: { userId: authUser.id, vehicleId },
    include: { vehicle: { include: { category: true } } },
  });
};

const getMyWishlist = async (authUser: AuthUser, query: unknown) => {
  const page = Number((query as { page?: string }).page) || 1;
  const limit = Number((query as { limit?: string }).limit) || 10;

  const where = { userId: authUser.id };

  const [items, total] = await Promise.all([
    prisma.wishlist.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        vehicle: {
          include: { category: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.wishlist.count({ where }),
  ]);

  return { items, meta: { page, limit, total } };
};

const removeFromWishlist = async (wishlistId: string, authUser: AuthUser) => {
  const item = await prisma.wishlist.findUnique({ where: { id: wishlistId } });
  if (!item) {
    throw new AppError(404, 'Wishlist item not found.');
  }

  if (item.userId !== authUser.id) {
    throw new AppError(403, 'You can only remove your own wishlist items.');
  }

  await prisma.wishlist.delete({ where: { id: wishlistId } });

  return null;
};

export const WishlistService = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
};
