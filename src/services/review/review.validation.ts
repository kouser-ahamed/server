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

export const ReviewValidation = {
  createReviewSchema,
  updateReviewSchema,
};
