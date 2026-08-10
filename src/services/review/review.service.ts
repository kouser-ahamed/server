import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';

const createReviewSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().optional(),
});

const updateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});

const recalculateVehicleRating = async (vehicleId: string) => {
  const agg = await prisma.review.aggregate({
    where: { vehicleId },
    _avg: { rating: true },
    _count: { rating: true },
  });

  await prisma.vehicle.update({
    where: { id: vehicleId },
    data: {
      rating: agg._avg.rating ?? 0,
      ratingCount: agg._count.rating,
    },
  });
};

const createReview = async (authUser: AuthUser, payload: z.infer<typeof createReviewSchema>) => {
  const data = createReviewSchema.parse(payload);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.hostId === authUser.id) {
    throw new AppError(400, 'You cannot review your own vehicle.');
  }

  const completedBooking = await prisma.booking.findFirst({
    where: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      status: 'COMPLETED',
    },
  });

  if (!completedBooking) {
    throw new AppError(400, 'You can only review a vehicle you have completed a booking for.');
  }

  const existingReview = await prisma.review.findUnique({
    where: { userId_vehicleId: { userId: authUser.id, vehicleId: data.vehicleId } },
  });

  if (existingReview) {
    throw new AppError(409, 'You have already reviewed this vehicle.');
  }

  const review = await prisma.review.create({
    data: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      rating: data.rating,
      comment: data.comment,
    },
    include: { user: { select: { id: true, name: true, profileImage: true } } },
  });

  await recalculateVehicleRating(data.vehicleId);

  return review;
};

const getReviewsByVehicle = async (vehicleId: string, query: { page?: number; limit?: number }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where = { vehicleId };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { user: { select: { id: true, name: true, profileImage: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, meta: { page, limit, total } };
};

const getReviewsByUser = async (authUser: AuthUser, query: { page?: number; limit?: number }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where = { userId: authUser.id };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { vehicle: { select: { id: true, title: true, images: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.count({ where }),
  ]);

  return { reviews, meta: { page, limit, total } };
};

const updateReview = async (
  reviewId: string,
  authUser: AuthUser,
  payload: z.infer<typeof updateReviewSchema>
) => {
  const data = updateReviewSchema.parse(payload);

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new AppError(404, 'Review not found.');
  }

  if (review.userId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only update your own reviews.');
  }

  const updated = await prisma.review.update({ where: { id: reviewId }, data });

  await recalculateVehicleRating(review.vehicleId);

  return updated;
};

const deleteReview = async (reviewId: string, authUser: AuthUser) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) {
    throw new AppError(404, 'Review not found.');
  }

  if (review.userId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only delete your own reviews.');
  }

  await prisma.review.delete({ where: { id: reviewId } });

  await recalculateVehicleRating(review.vehicleId);

  return null;
};

export const ReviewService = {
  createReview,
  getReviewsByVehicle,
  getReviewsByUser,
  updateReview,
  deleteReview,
};
