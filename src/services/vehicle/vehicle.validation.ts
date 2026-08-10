import { z } from 'zod';

const createVehicleSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  name: z.string().min(3, 'Name must be at least 3 characters'),
  brand: z.string().min(1, 'Brand is required'),
  model: z.string().min(1, 'Model is required'),
  images: z.array(z.string().url('Invalid image URL')).min(1, 'At least one image is required'),
  pricePerDay: z.coerce.number().positive('Price must be positive'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE', 'INACTIVE']).optional(),
  location: z.string().optional(),
});

const updateVehicleSchema = createVehicleSchema.partial();

const listVehiclesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().nonnegative().optional(),
  maxPrice: z.coerce.number().nonnegative().optional(),
  status: z.enum(['AVAILABLE', 'BOOKED', 'MAINTENANCE', 'INACTIVE']).optional(),
  search: z.string().optional(),
  sort: z.enum(['price_asc', 'price_desc', 'newest']).optional(),
});

export const VehicleValidation = {
  createVehicleSchema,
  updateVehicleSchema,
  listVehiclesQuerySchema,
};
