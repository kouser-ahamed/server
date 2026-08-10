import Stripe from 'stripe';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';

const getStripe = () => {
  if (!env.STRIPE_SECRET_KEY) {
    throw new AppError(500, 'Stripe is not configured.');
  }
  return new Stripe(env.STRIPE_SECRET_KEY);
};

const createCheckoutSessionSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
});

const createCheckoutSession = async (
  authUser: AuthUser,
  payload: z.infer<typeof createCheckoutSessionSchema>
) => {
  const { bookingId } = createCheckoutSessionSchema.parse(payload);
  const stripe = getStripe();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: true },
  });

  if (!booking || booking.isDeleted) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.userId !== authUser.id) {
    throw new AppError(403, 'You can only pay for your own bookings.');
  }

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
    metadata: { bookingId },
    success_url: `${env.CLIENT_URL}/payment/success?bookingId=${bookingId}`,
    cancel_url: `${env.CLIENT_URL}/payment/cancel?bookingId=${bookingId}`,
  });

  return { url: session.url };
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
  } catch {
    throw new AppError(400, 'Invalid Stripe signature.');
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

    await prisma.$transaction([
      prisma.payment.upsert({
        where: { bookingId },
        update: { status: 'PAID', stripeSessionId: session.id },
        create: {
          bookingId,
          amount: booking.totalPrice,
          status: 'PAID',
          stripeSessionId: session.id,
          stripePaymentIntentId:
            typeof session.payment_intent === 'string' ? session.payment_intent : null,
        },
      }),
      prisma.booking.update({
        where: { id: bookingId },
        data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
      }),
      prisma.vehicle.update({
        where: { id: booking.vehicleId },
        data: { status: 'BOOKED' },
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
