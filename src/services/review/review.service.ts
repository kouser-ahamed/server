import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { ReviewValidation } from './review.validation';

const createReview = async (authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.createReviewSchema.parse(payload);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.vendorId === authUser.id) {
    throw new AppError(400, 'You cannot review your own vehicle.');
  }

  const completedBooking = await prisma.booking.findFirst({
    where: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      paymentStatus: 'PAID',
      endDate: { lt: new Date() },
      isDeleted: false,
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

  return prisma.review.create({
    data: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      rating: data.rating,
      comment: data.comment,
    },
    include: { user: { select: { id: true, name: true, profileImage: true } } },
  });
};

const getReviewsByVehicle = async (vehicleId: string, query: unknown) => {
  const page = Number((query as { page?: string }).page) || 1;
  const limit = Number((query as { limit?: string }).limit) || 10;

  const where = { vehicleId, isDeleted: false };

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

const updateReview = async (reviewId: string, authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.updateReviewSchema.parse(payload);

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.isDeleted) {
    throw new AppError(404, 'Review not found.');
  }

  if (review.userId !== authUser.id) {
    throw new AppError(403, 'You can only update your own reviews.');
  }

  return prisma.review.update({ where: { id: reviewId }, data });
};

const deleteReview = async (reviewId: string, authUser: AuthUser) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.isDeleted) {
    throw new AppError(404, 'Review not found.');
  }

  if (review.userId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only delete your own reviews.');
  }

  return prisma.review.update({
    where: { id: reviewId },
    data: { isDeleted: true },
  });
};

export const ReviewService = {
  createReview,
  getReviewsByVehicle,
  updateReview,
  deleteReview,
};
