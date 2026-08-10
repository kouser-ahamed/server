import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { BookingValidation } from './booking.validation';

const getDaysBetween = (start: Date, end: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((end.getTime() - start.getTime()) / msPerDay);
  return days > 0 ? days : 1;
};

const releaseVehicleIfFree = async (vehicleId: string) => {
  const activeCount = await prisma.booking.count({
    where: { vehicleId, isDeleted: false, status: { in: ['CONFIRMED', 'ONGOING'] } },
  });

  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } });

  if (activeCount === 0 && vehicle && vehicle.status === 'BOOKED') {
    await prisma.vehicle.update({ where: { id: vehicleId }, data: { status: 'AVAILABLE' } });
  }
};

const createBooking = async (authUser: AuthUser, payload: unknown) => {
  const data = BookingValidation.createBookingSchema.parse(payload);

  if (data.endDate <= data.startDate) {
    throw new AppError(400, 'End date must be after the start date.');
  }

  const vehicle = await prisma.vehicle.findUnique({ where: { id: data.vehicleId } });
  if (!vehicle || vehicle.isDeleted) {
    throw new AppError(404, 'Vehicle not found.');
  }

  if (vehicle.status !== 'AVAILABLE') {
    throw new AppError(400, 'This vehicle is not available for booking.');
  }

  const overlapping = await prisma.booking.findFirst({
    where: {
      vehicleId: data.vehicleId,
      isDeleted: false,
      status: { in: ['CONFIRMED', 'ONGOING'] },
      AND: [{ startDate: { lt: data.endDate } }, { endDate: { gt: data.startDate } }],
    },
  });

  if (overlapping) {
    throw new AppError(409, 'This vehicle is already booked for the selected dates.');
  }

  const totalDays = getDaysBetween(data.startDate, data.endDate);
  const totalPrice = Number(vehicle.pricePerDay) * totalDays;

  return prisma.booking.create({
    data: {
      userId: authUser.id,
      vehicleId: data.vehicleId,
      startDate: data.startDate,
      endDate: data.endDate,
      totalPrice,
    },
    include: { vehicle: true },
  });
};

const getMyBookings = async (authUser: AuthUser, query: unknown) => {
  const q = BookingValidation.listBookingsQuerySchema.partial().parse(query);

  const page = q.page ?? 1;
  const limit = q.limit ?? 10;

  const where: Prisma.BookingWhereInput = { userId: authUser.id, isDeleted: false };
  if (q.status) where.status = q.status;

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

const getVendorBookings = async (authUser: AuthUser, query: unknown) => {
  const q = BookingValidation.listBookingsQuerySchema.partial().parse(query);

  const page = q.page ?? 1;
  const limit = q.limit ?? 10;

  const where: Prisma.BookingWhereInput = {
    vehicle: { vendorId: authUser.id },
    isDeleted: false,
  };
  if (q.status) where.status = q.status;

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

const getAllBookings = async (query: unknown) => {
  const q = BookingValidation.listBookingsQuerySchema.partial().parse(query);

  const page = q.page ?? 1;
  const limit = q.limit ?? 10;

  const where: Prisma.BookingWhereInput = { isDeleted: false };
  if (q.status) where.status = q.status;

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
      vehicle: { include: { category: true, vendor: { select: { id: true, name: true } } } },
    },
  });

  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  const isOwner = booking.userId === authUser.id;
  const isVendor = booking.vehicle.vendorId === authUser.id;

  if (!isOwner && !isVendor && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You are not allowed to view this booking.');
  }

  return booking;
};

const updateBookingStatus = async (bookingId: string, payload: unknown, authUser: AuthUser) => {
  const { status } = BookingValidation.updateStatusSchema.parse(payload);

  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  if (authUser.role === 'VENDOR') {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: booking.vehicleId } });
    if (vehicle?.vendorId !== authUser.id) {
      throw new AppError(403, 'You can only manage bookings on your own vehicles.');
    }
  }

  if (booking.status !== 'PENDING') {
    throw new AppError(400, 'Only PENDING bookings can be confirmed or rejected.');
  }

  if (status === 'CONFIRMED') {
    const overlapping = await prisma.booking.findFirst({
      where: {
        vehicleId: booking.vehicleId,
        isDeleted: false,
        status: { in: ['CONFIRMED', 'ONGOING'] },
        NOT: { id: bookingId },
        AND: [{ startDate: { lt: booking.endDate } }, { endDate: { gt: booking.startDate } }],
      },
    });

    if (overlapping) {
      throw new AppError(409, 'This vehicle is already booked for the selected dates.');
    }

    const [updated] = await prisma.$transaction([
      prisma.booking.update({ where: { id: bookingId }, data: { status: 'CONFIRMED' } }),
      prisma.vehicle.update({ where: { id: booking.vehicleId }, data: { status: 'BOOKED' } }),
    ]);

    return updated;
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'REJECTED' },
  });

  await releaseVehicleIfFree(booking.vehicleId);

  return updated;
};

const cancelBooking = async (bookingId: string, authUser: AuthUser) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.userId !== authUser.id) {
    throw new AppError(403, 'You can only cancel your own bookings.');
  }

  if (!['PENDING', 'CONFIRMED'].includes(booking.status)) {
    throw new AppError(400, 'Only PENDING or CONFIRMED bookings can be cancelled.');
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: 'CANCELLED' },
  });

  await releaseVehicleIfFree(booking.vehicleId);

  return updated;
};

const deleteBooking = async (bookingId: string) => {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { isDeleted: true },
  });

  await releaseVehicleIfFree(booking.vehicleId);

  return updated;
};

export const BookingService = {
  createBooking,
  getMyBookings,
  getVendorBookings,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
};
