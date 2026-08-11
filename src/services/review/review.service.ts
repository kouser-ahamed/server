import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { ReviewValidation } from './review.validation';

const reviewDetailInclude = {
  user: { select: { id: true, name: true, profileImage: true } },
  reply: { include: { vendor: { select: { id: true, name: true } } } },
  reactions: {
    select: {
      id: true,
      type: true,
      userId: true,
      user: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.ReviewInclude;

type ReviewWithDetail = Prisma.ReviewGetPayload<{ include: typeof reviewDetailInclude }>;

const reviewAdminInclude = {
  ...reviewDetailInclude,
  vehicle: { select: { id: true, name: true } },
} satisfies Prisma.ReviewInclude;

type ReviewWithAdminDetail = Prisma.ReviewGetPayload<{ include: typeof reviewAdminInclude }>;

// Public shape: exposes reaction counts and the caller's own reaction, but not
// the full reaction list.
const formatPublicReview = (review: ReviewWithDetail, authUserId?: string) => {
  const likeCount = review.reactions.filter((r) => r.type === 'LIKE').length;
  const dislikeCount = review.reactions.length - likeCount;
  const myReaction = authUserId
    ? (review.reactions.find((r) => r.userId === authUserId) ?? null)
    : null;

  const { reactions, ...rest } = review;

  return {
    ...rest,
    likeCount,
    dislikeCount,
    myReaction: myReaction ? { id: myReaction.id, type: myReaction.type } : null,
  };
};

// Admin shape: keeps the full reaction list so individual reactions can be
// viewed and moderated.
const formatAdminReview = (review: ReviewWithAdminDetail) => {
  const likeCount = review.reactions.filter((r) => r.type === 'LIKE').length;
  const dislikeCount = review.reactions.length - likeCount;

  return { ...review, likeCount, dislikeCount };
};

const createReview = async (authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.createReviewSchema.parse(payload);

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.vendorId === authUser.id) {
    throw new AppError(400, 'You cannot review your own vehicle.');
  }

  const existingReview = await prisma.review.findUnique({
    where: { userId_vehicleId: { userId: authUser.id, vehicleId: data.vehicleId } },
  });

  if (existingReview) {
    throw new AppError(409, 'You have already reviewed this vehicle.');
  }

  const created = await prisma.review.create({
    data: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      rating: data.rating,
      comment: data.comment,
    },
    include: reviewDetailInclude,
  });

  return formatPublicReview(created, authUser.id);
};

const getReviewsByVehicle = async (vehicleId: string, query: unknown, authUser?: AuthUser) => {
  const page = Number((query as { page?: string }).page) || 1;
  const limit = Number((query as { limit?: string }).limit) || 10;

  const where: Prisma.ReviewWhereInput = { vehicleId, isDeleted: false };

  const [reviews, total, ratingAgg] = await Promise.all([
    prisma.review.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: reviewDetailInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.count({ where }),
    prisma.review.aggregate({ where, _avg: { rating: true } }),
  ]);

  return {
    reviews: reviews.map((review) => formatPublicReview(review, authUser?.id)),
    meta: {
      page,
      limit,
      total,
      averageRating: ratingAgg._avg.rating ?? 0,
    },
  };
};

const getAllReviews = async (query: unknown) => {
  const q = ReviewValidation.listReviewsQuerySchema.parse(query);
  const page = q.page;
  const limit = q.limit;

  const where: Prisma.ReviewWhereInput = { isDeleted: false };

  const [reviews, total] = await Promise.all([
    prisma.review.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: reviewAdminInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.review.count({ where }),
  ]);

  return {
    reviews: reviews.map((review) => formatAdminReview(review)),
    meta: { page, limit, total },
  };
};

const getReviewById = async (reviewId: string) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: reviewAdminInclude,
  });

  if (!review || review.isDeleted) {
    throw new AppError(404, 'Review not found.');
  }

  return formatAdminReview(review);
};

const updateReview = async (reviewId: string, authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.updateReviewSchema.parse(payload);

  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review || review.isDeleted) {
    throw new AppError(404, 'Review not found.');
  }

  if (review.userId !== authUser.id && authUser.role !== 'ADMIN') {
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

const createReply = async (reviewId: string, authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.replySchema.parse(payload);

  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: { vehicle: { select: { vendorId: true } } },
  });
  if (!review || review.isDeleted) {
    throw new AppError(404, 'Review not found.');
  }

  if (review.vehicle.vendorId !== authUser.id) {
    throw new AppError(403, 'You can only reply to reviews on your own vehicles.');
  }

  const existing = await prisma.reviewReply.findUnique({ where: { reviewId } });
  if (existing) {
    throw new AppError(409, 'You have already replied to this review.');
  }

  return prisma.reviewReply.create({
    data: { reviewId, vendorId: authUser.id, content: data.content },
  });
};

const updateReply = async (reviewId: string, authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.replySchema.parse(payload);

  const reply = await prisma.reviewReply.findUnique({
    where: { reviewId },
    include: { review: { include: { vehicle: { select: { vendorId: true } } } } },
  });
  if (!reply) {
    throw new AppError(404, 'No vendor reply found on this review.');
  }

  if (reply.vendorId !== authUser.id || reply.review.vehicle.vendorId !== authUser.id) {
    throw new AppError(403, 'You can only edit your own reply.');
  }

  return prisma.reviewReply.update({
    where: { id: reply.id },
    data: { content: data.content },
  });
};

const deleteReply = async (reviewId: string, authUser: AuthUser) => {
  const reply = await prisma.reviewReply.findUnique({
    where: { reviewId },
    include: { review: { include: { vehicle: { select: { vendorId: true } } } } },
  });
  if (!reply) {
    throw new AppError(404, 'No vendor reply found on this review.');
  }

  const isOwnReply =
    reply.vendorId === authUser.id && reply.review.vehicle.vendorId === authUser.id;
  if (!isOwnReply && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only delete your own reply.');
  }

  await prisma.reviewReply.delete({ where: { id: reply.id } });
  return null;
};

const MAX_REACT_RETRIES = 3;

// Toggle/switch like<->dislike atomically:
// - no reaction  -> create the requested type
// - same type    -> remove it (toggle off)
// - other type   -> switch to the requested type
// A Serializable transaction makes rapid-click reads consistent; P2034 (write
// conflict) and P2002 (concurrent create) are retried so the user never gets
// a spurious error.
const reactToReview = async (reviewId: string, authUser: AuthUser, payload: unknown) => {
  const data = ReviewValidation.reactSchema.parse(payload);

  for (let attempt = 0; attempt < MAX_REACT_RETRIES; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          const review = await tx.review.findUnique({
            where: { id: reviewId },
            select: { id: true, isDeleted: true, userId: true },
          });
          if (!review || review.isDeleted) {
            throw new AppError(404, 'Review not found.');
          }
          if (review.userId === authUser.id) {
            throw new AppError(400, 'You cannot react to your own review.');
          }

          const existing = await tx.reviewReaction.findUnique({
            where: { reviewId_userId: { reviewId, userId: authUser.id } },
          });

          let reaction: { id: string; type: 'LIKE' | 'DISLIKE' } | null = null;

          if (!existing) {
            const created = await tx.reviewReaction.create({
              data: { reviewId, userId: authUser.id, type: data.type },
              select: { id: true, type: true },
            });
            reaction = created;
          } else if (existing.type === data.type) {
            await tx.reviewReaction.delete({ where: { id: existing.id } });
            reaction = null;
          } else {
            const updated = await tx.reviewReaction.update({
              where: { id: existing.id },
              data: { type: data.type },
              select: { id: true, type: true },
            });
            reaction = updated;
          }

          const [likeCount, dislikeCount] = await Promise.all([
            tx.reviewReaction.count({ where: { reviewId, type: 'LIKE' } }),
            tx.reviewReaction.count({ where: { reviewId, type: 'DISLIKE' } }),
          ]);

          return { reaction, likeCount, dislikeCount };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
      );
    } catch (err) {
      const prismaErr = err as Prisma.PrismaClientKnownRequestError;
      if (
        (prismaErr?.code === 'P2034' || prismaErr?.code === 'P2002') &&
        attempt < MAX_REACT_RETRIES - 1
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new AppError(409, 'Could not update your reaction. Please try again.');
};

const deleteReaction = async (reviewId: string, reactionId: string) => {
  const reaction = await prisma.reviewReaction.findUnique({ where: { id: reactionId } });
  if (!reaction) {
    throw new AppError(404, 'Reaction not found.');
  }

  if (reaction.reviewId !== reviewId) {
    throw new AppError(404, 'Reaction not found on this review.');
  }

  await prisma.reviewReaction.delete({ where: { id: reactionId } });
  return null;
};

export const ReviewService = {
  createReview,
  getReviewsByVehicle,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  createReply,
  updateReply,
  deleteReply,
  reactToReview,
  deleteReaction,
};
