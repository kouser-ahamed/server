import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { BookingService } from '../booking/booking.service';

const getStripe = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(500, 'Stripe is not configured.');
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
};

// Either an existing booking can be paid (retry path) or a brand-new booking is
// created from the vehicle + dates in the same request as the checkout session.
const createCheckoutSessionSchema = z.object({
  bookingId: z.string().optional(),
  vehicleId: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const verifySessionSchema = z.object({
  session_id: z.string().min(1, 'session_id is required'),
});

const resolveBooking = async (
  authUser: AuthUser,
  payload: z.infer<typeof createCheckoutSessionSchema>
) => {
  const hasNewBookingInput =
    payload.vehicleId !== undefined || payload.startDate !== undefined || payload.endDate !== undefined;

  if (!payload.bookingId && !hasNewBookingInput) {
    throw new AppError(400, 'Provide a bookingId or vehicle details to check out.');
  }

  if (payload.bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: payload.bookingId },
      include: { vehicle: true },
    });

    if (!booking || booking.isDeleted) {
      throw new AppError(404, 'Booking not found.');
    }

    if (booking.userId !== authUser.id) {
      throw new AppError(403, 'You can only pay for your own bookings.');
    }

    return booking;
  }

  // New booking flow: create the booking record FIRST (UNPAID + PENDING, the
  // schema defaults), then immediately take the customer to Stripe.
  return BookingService.createBooking(authUser, {
    vehicleId: payload.vehicleId,
    startDate: payload.startDate,
    endDate: payload.endDate,
  });
};

const createCheckoutSession = async (
  authUser: AuthUser,
  payload: unknown
) => {
  const data = createCheckoutSessionSchema.parse(payload);
  const stripe = getStripe();

  const booking = await resolveBooking(authUser, data);

  if (booking.paymentStatus === 'PAID') {
    throw new AppError(400, 'This booking is already paid.');
  }

  const unitAmount = Math.round(Number(booking.totalPrice) * 100);

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: unitAmount,
          product_data: {
            name: booking.vehicle.name,
          },
        },
      },
    ],
    metadata: { bookingId: booking.id },
    // {CHECKOUT_SESSION_ID} is replaced by Stripe with the real session id on
    // redirect, so the success page can verify the payment directly without a
    // webhook. bookingId is kept for display links / fallback.
    success_url: `${env.CLIENT_URL}/payment/success?bookingId=${booking.id}&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel?bookingId=${booking.id}`,
  });

  // Create a UNPAID payment row up front so the session has a persisted
  // stripeSessionId to look up in verify-session. The verify endpoint flips it
  // to PAID once the customer returns from Stripe.
  await prisma.payment.upsert({
    where: { bookingId: booking.id },
    update: {
      status: 'UNPAID',
      amount: booking.totalPrice,
      stripeSessionId: session.id,
    },
    create: {
      bookingId: booking.id,
      amount: booking.totalPrice,
      status: 'UNPAID',
      stripeSessionId: session.id,
    },
  });

  return { url: session.url, bookingId: booking.id };
};

const getPaymentIntentId = (session: Stripe.Checkout.Session): string | null => {
  if (typeof session.payment_intent === 'string') {
    return session.payment_intent;
  }
  return session.payment_intent?.id ?? null;
};

// Direct verification of a Checkout Session — replaces the Stripe webhook. The
// customer lands on the success page with the real session id in the URL and
// this endpoint asks Stripe directly whether the payment completed, then flips
// the booking to PAID. No webhook, no signature, no STRIPE_WEBHOOK_SECRET, and
// it works identically in local dev and in production.
//
// Idempotent: verifying an already-PAID booking is a no-op that returns the
// current state, and an already-REFUNDED booking is never regressed.
const verifySession = async (authUser: AuthUser, payload: unknown) => {
  const { session_id } = verifySessionSchema.parse(payload);
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.retrieve(session_id, {
    expand: ['payment_intent'],
  });

  // Resolve the booking for this session. Prefer the metadata we stamped at
  // session creation, falling back to the UNPAID payment row stored with the
  // same stripeSessionId.
  const booking =
    session.metadata?.bookingId
      ? await prisma.booking.findUnique({ where: { id: session.metadata.bookingId } })
      : await prisma.booking.findFirst({
          where: { payment: { stripeSessionId: session_id } },
        });

  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'No booking found for this payment session.');
  }

  if (booking.userId !== authUser.id && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You can only verify payments for your own bookings.');
  }

  const paymentIntentId = getPaymentIntentId(session);
  const paidOnStripe = session.payment_status === 'paid';

  // Idempotent: nothing to do if the booking is already settled.
  if (booking.paymentStatus === 'PAID' || booking.paymentStatus === 'REFUNDED') {
    const current = await prisma.booking.findUnique({
      where: { id: booking.id },
      include: { vehicle: { select: { name: true } } },
    });
    return { paid: booking.paymentStatus === 'PAID', booking: current };
  }

  if (paidOnStripe) {
    // Payment succeeded: this is a PAYMENT status update only. Mark the booking
    // as PAID and persist the Stripe payment_intent id on the booking record so
    // a later refund can be triggered. The BOOKING status stays PENDING
    // (awaiting vendor action) — it is never auto-confirmed.
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          paymentStatus: 'PAID',
          ...(paymentIntentId && !booking.paymentIntentId
            ? { paymentIntentId }
            : {}),
        },
      }),
      prisma.payment.upsert({
        where: { bookingId: booking.id },
        update: {
          status: 'PAID',
          stripeSessionId: session_id,
          ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
        },
        create: {
          bookingId: booking.id,
          amount: booking.totalPrice,
          status: 'PAID',
          stripeSessionId: session_id,
          stripePaymentIntentId: paymentIntentId,
        },
      }),
    ]);
  }

  const updated = await prisma.booking.findUnique({
    where: { id: booking.id },
    include: { vehicle: { select: { name: true } } },
  });

  return { paid: paidOnStripe, booking: updated };
};

const getPaymentByBooking = async (bookingId: string, authUser: AuthUser) => {
  const payment = await prisma.payment.findUnique({
    where: { bookingId },
    include: { booking: true },
  });

  if (!payment) {
    throw new AppError(404, 'Payment not found.');
  }

  const isOwner = payment.booking.userId === authUser.id;
  if (!isOwner && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You are not allowed to view this payment.');
  }

  return payment;
};

export const PaymentService = {
  createCheckoutSession,
  verifySession,
  getPaymentByBooking,
};