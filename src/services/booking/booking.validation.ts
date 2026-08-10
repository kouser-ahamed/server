import { z } from 'zod';

const createBookingSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  startDate: z.coerce.date().refine((d) => d >= new Date(), 'Start date must be in the future'),
  endDate: z.coerce.date(),
});

const updateStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'REJECTED']),
});

const listBookingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(['PENDING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'REJECTED']).optional(),
});

export const BookingValidation = {
  createBookingSchema,
  updateStatusSchema,
  listBookingsQuerySchema,
};
