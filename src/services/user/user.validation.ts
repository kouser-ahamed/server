import { z } from 'zod';

const getAllUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  role: z.enum(['CUSTOMER', 'VENDOR', 'ADMIN']).optional(),
  search: z.string().optional(),
});

const updateProfileSchema = z
  .object({
    name: z.string().min(2, 'Name must be at least 2 characters').optional(),
    phone: z.string().optional(),
    profileImage: z.string().url('Invalid profile image URL').optional(),
  })
  .strict();

export const UserValidation = {
  getAllUsersQuerySchema,
  updateProfileSchema,
};
