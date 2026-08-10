import Stripe from 'stripe';
import { Booking, Payment, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { env } from '../../config/env';
import { AuthUser } from '../../middlewares/auth.middleware';
import { BookingValidation } from './booking.validation';

const getStripe = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(500, 'Stripe is not configured.');
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
};

const getDaysBetween = (start: Date, end: Date) => {
  const msPerDay = 24 * 60 * 60 * 1000;
  const days = Math.ceil((end.getTime() - start.getTime()) / msPerDay);
  return days > 0 ? days : 1;
};

const releaseVehicleIfFree = async (vehicleId: string) => {
  const activeCount = await prisma.booking.count({
    where: { vehicleId, isDeleted: false, status: 'CONFIRMED' },
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
      status: 'CONFIRMED',
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
        vehicle: { include: { category: true, vendor: { select: { id: true, name: true } } } },
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

const refundStripePayment = async (
  booking: Booking & { payment: Payment | null }
) => {
  if (booking.payment?.stripeRefundId) {
    // Already refunded (e.g. a retried request) — nothing to do.
    return;
  }

  const paymentIntentId = booking.paymentIntentId ?? booking.payment?.stripePaymentIntentId;
  if (!paymentIntentId) {
    throw new AppError(
      400,
      'No Stripe payment intent found for this booking; the refund cannot be processed.'
    );
  }

  const stripe = getStripe();
  let refund: Stripe.Refund;
  try {
    refund = await stripe.refunds.create({ payment_intent: paymentIntentId });
  } catch (err) {
    console.error(`[refund] Stripe refund failed for booking ${booking.id}:`, err);
    throw new AppError(
      502,
      'The refund could not be processed by the payment provider. The booking was NOT rejected; please try again.'
    );
  }

  await prisma.payment.update({
    where: { bookingId: booking.id },
    data: { stripeRefundId: refund.id },
  });
};

const updateBookingStatus = async (bookingId: string, payload: unknown, authUser: AuthUser) => {
  const { status } = BookingValidation.updateStatusSchema.parse(payload);

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });
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
    throw new AppError(400, 'Only pending bookings awaiting approval can be approved or rejected.');
  }

  if (status === 'CONFIRMED') {
    if (booking.paymentStatus !== 'PAID') {
      throw new AppError(400, 'Only paid bookings can be approved.');
    }

    const overlapping = await prisma.booking.findFirst({
      where: {
        vehicleId: booking.vehicleId,
        isDeleted: false,
        status: 'CONFIRMED',
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

  // REJECTED: refund the customer first if they have paid, then update the
  // statuses. The booking is only marked REJECTED once the refund actually
  // succeeds. An UNPAID booking can be rejected without a refund (nothing was
  // charged), so it stays UNPAID.
  if (booking.paymentStatus === 'PAID') {
    await refundStripePayment(booking);
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: 'REJECTED' } }),
    ...(booking.paymentStatus === 'PAID'
      ? [prisma.payment.update({ where: { bookingId }, data: { status: 'REFUNDED' } })]
      : []),
  ]);

  await releaseVehicleIfFree(booking.vehicleId);

  return updated;
};

const cancelBooking = async (bookingId: string, authUser: AuthUser) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { payment: true },
  });
  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.userId !== authUser.id) {
    throw new AppError(403, 'You can only cancel your own bookings.');
  }

  if (booking.status !== 'PENDING') {
    throw new AppError(400, 'Only pending bookings can be cancelled.');
  }

  // If the customer already paid, refund the full amount before cancelling.
  // Like reject, the booking is only cancelled once the refund succeeds.
  if (booking.paymentStatus === 'PAID') {
    await refundStripePayment(booking);
  }

  const [updated] = await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED' },
    }),
    ...(booking.paymentStatus === 'PAID'
      ? [
          prisma.payment.update({
            where: { bookingId },
            data: { status: 'REFUNDED' },
          }),
        ]
      : []),
  ]);

  await releaseVehicleIfFree(booking.vehicleId);

  return updated;
};

const updateBookingDetails = async (bookingId: string, payload: unknown, authUser: AuthUser) => {
  const data = BookingValidation.updateBookingDatesSchema.parse(payload);

  if (data.endDate <= data.startDate) {
    throw new AppError(400, 'End date must be after the start date.');
  }

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: true },
  });
  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  const isOwner = booking.userId === authUser.id;
  const isVendor = booking.vehicle.vendorId === authUser.id;

  if (!isOwner && !isVendor) {
    throw new AppError(403, 'You can only edit your own bookings or bookings on your own vehicles.');
  }

  if (booking.status !== 'PENDING') {
    throw new AppError(400, 'Only pending bookings can be edited.');
  }

  const overlapping = await prisma.booking.findFirst({
    where: {
      vehicleId: booking.vehicleId,
      isDeleted: false,
      status: 'CONFIRMED',
      NOT: { id: bookingId },
      AND: [{ startDate: { lt: data.endDate } }, { endDate: { gt: data.startDate } }],
    },
  });

  if (overlapping) {
    throw new AppError(409, 'This vehicle is already booked for the selected dates.');
  }

  const totalDays = getDaysBetween(data.startDate, data.endDate);
  const totalPrice = Number(booking.vehicle.pricePerDay) * totalDays;

  return prisma.booking.update({
    where: { id: bookingId },
    data: {
      startDate: data.startDate,
      endDate: data.endDate,
      totalPrice,
    },
    include: { vehicle: true },
  });
};

const deleteBooking = async (bookingId: string, authUser: AuthUser) => {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: true },
  });
  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  const isVendor = booking.vehicle.vendorId === authUser.id;
  if (authUser.role !== 'ADMIN' && !isVendor) {
    throw new AppError(403, 'Only an admin or the vendor who owns the vehicle can delete this booking.');
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
  updateBookingDetails,
  deleteBooking,
};