import { z } from 'zod';

const createReviewSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  rating: z.coerce.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comment: z.string().optional(),
});

const updateReviewSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5).optional(),
  comment: z.string().optional(),
});

const replySchema = z.object({
  content: z.string().min(1, 'Reply cannot be empty').max(2000, 'Reply is too long'),
});

const reactSchema = z.object({
  type: z.enum(['LIKE', 'DISLIKE']),
});

const listReviewsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const ReviewValidation = {
  createReviewSchema,
  updateReviewSchema,
  replySchema,
  reactSchema,
  listReviewsQuerySchema,
};
