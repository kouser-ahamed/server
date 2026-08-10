import { z } from 'zod';

const addToWishlistSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
});

export const WishlistValidation = {
  addToWishlistSchema,
};
