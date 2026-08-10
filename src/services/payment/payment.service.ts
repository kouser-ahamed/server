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
    success_url: `${env.CLIENT_URL}/payment/success?bookingId=${booking.id}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel?bookingId=${booking.id}`,
  });

  // Create a UNPAID payment row up front so the success page has a record to
  // poll immediately after Stripe redirects the customer. The webhook updates
  // this row to PAID when the checkout session completes.
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

const handleWebhook = async (rawBody: Buffer, signature: string) => {
  const stripe = getStripe();

  if (!signature) {
    throw new AppError(400, 'Missing Stripe signature.');
  }

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(500, 'Stripe webhook secret is not configured.');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    throw new AppError(400, `Invalid Stripe signature: ${(err as Error).message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const bookingId = session.metadata?.bookingId;

    if (!bookingId) {
      return { received: true };
    }

    const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (!booking) {
      return { received: true };
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null;

    // Payment succeeded: this is a PAYMENT status update only. Mark the booking
    // as PAID and persist the Stripe payment_intent id on the booking record so
    // a later refund can be triggered. The BOOKING status stays PENDING
    // (awaiting vendor action) — it is never auto-confirmed, and a late or
    // replayed webhook never regresses a booking.
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: {
          paymentStatus: 'PAID',
          ...(paymentIntentId && !booking.paymentIntentId
            ? { paymentIntentId }
            : {}),
        },
      }),
      prisma.payment.upsert({
        where: { bookingId },
        update: {
          status: 'PAID',
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
        create: {
          bookingId,
          amount: booking.totalPrice,
          status: 'PAID',
          stripeSessionId: session.id,
          stripePaymentIntentId: paymentIntentId,
        },
      }),
    ]);
  }

  return { received: true };
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
  handleWebhook,
  getPaymentByBooking,
};