import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';

const createBookingSchema = z.object({
  vehicleId: z.string().min(1, 'Vehicle is required'),
  startDate: z.coerce.date().refine((d) => d >= new Date(), 'Start date must be in the future'),
  endDate: z.coerce.date(),
  pickupLocation: z.string().optional(),
  notes: z.string().optional(),
});

const statusUpdateSchema = z.object({
  status: z.enum(['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED']),
});

const getDaysBetween = (start: Date, end: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((end.getTime() - start.getTime()) / msPerDay);
  return days > 0 ? days : 1;
};

const createBooking = async (authUser: AuthUser, payload: z.infer<typeof createBookingSchema>) => {
  const data = createBookingSchema.parse(payload);

  if (data.endDate <= data.startDate) {
    throw new AppError(400, 'End date must be after the start date.');
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (!vehicle.isAvailable) {
    throw new AppError(400, 'This vehicle is not available for booking.');
  }

  if (vehicle.hostId === authUser.id) {
    throw new AppError(400, 'You cannot book your own vehicle.');
  }

  const overlapping = await prisma.booking.findFirst({
    where: {
      vehicleId: data.vehicleId,
      status: { in: ['PENDING', 'CONFIRMED'] },
      AND: [
        { startDate: { lt: data.endDate } },
        { endDate: { gt: data.startDate } },
      ],
    },
  });

  if (overlapping) {
    throw new AppError(409, 'This vehicle is already booked for the selected dates.');
  }

  const totalDays = getDaysBetween(data.startDate, data.endDate);
  const totalAmount = Number(vehicle.pricePerDay) * totalDays;

  const booking = await prisma.booking.create({
    data: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays,
      totalAmount,
      pickupLocation: data.pickupLocation,
      notes: data.notes,
    },
    include: { vehicle: true },
  });

  return booking;
};

const getAllBookings = async (query: {
  page?: number;
  limit?: number;
  status?: string;
  vehicleId?: string;
  userId?: string;
}) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where: Prisma.BookingWhereInput = {};
  if (query.status) where.status = query.status as Prisma.BookingWhereInput['status'];
  if (query.vehicleId) where.vehicleId = query.vehicleId;
  if (query.userId) where.userId = query.userId;

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, meta: { page, limit, total } };
};

const getMyBookings = async (authUser: AuthUser, query: { page?: number; limit?: number }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where: Prisma.BookingWhereInput = { userId: authUser.id };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: { vehicle: { include: { category: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, meta: { page, limit, total } };
};

const getHostBookings = async (authUser: AuthUser, query: { page?: number; limit?: number }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where: Prisma.BookingWhereInput = { vehicle: { hostId: authUser.id } };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true, phone: true } },
        vehicle: { include: { category: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({ where }),
  ]);

  return { bookings, meta: { page, limit, total } };
};

const getBookingById = async (bookingId: string, authUser: AuthUser) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      user: { select: { id: true, name: true, email: true, phone: true } },
      vehicle: { include: { category: true, host: { select: { id: true, name: true } } } },
    },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  const isOwner = booking.userId === authUser.id;
  const isHost = booking.vehicle.hostId === authUser.id;

  if (!isOwner && !isHost && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You are not allowed to view this booking.');
  }

  return booking;
};

const updateBookingStatus = async (
  bookingId: string,
  payload: z.infer<typeof statusUpdateSchema>,
  authUser: AuthUser
) => {
  const { status } = statusUpdateSchema.parse(payload);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  const isHost = booking.vehicleId
    ? (await prisma.vehicle.findUnique({ where: { id: booking.vehicleId } }))?.hostId ===
      authUser.id
    : false;

  if (!isHost && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'Only the vehicle host can update booking status.');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });
};

const cancelBooking = async (bookingId: string, authUser: AuthUser) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.userId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only cancel your own bookings.');
  }

  if (booking.status === 'COMPLETED') {
    throw new AppError(400, 'Completed bookings cannot be cancelled.');
  }

  return prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
  });
};

export const BookingService = {
  createBooking,
  getAllBookings,
  getMyBookings,
  getHostBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
};
