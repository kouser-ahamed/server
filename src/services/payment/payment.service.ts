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

const createPaymentIntentSchema = z.object({
  bookingId: z.string().min(1, 'Booking is required'),
});

const createPaymentIntent = async (
  authUser: AuthUser,
  payload: z.infer<typeof createPaymentIntentSchema>
) => {
  const { bookingId } = createPaymentIntentSchema.parse(payload);
  const stripe = getStripe();

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { vehicle: true, payment: true },
  });

  if (!booking) {
    throw new AppError(404, 'Booking not found.');
  }

  if (booking.userId !== authUser.id) {
    throw new AppError(403, 'You can only pay for your own bookings.');
  }

  if (booking.payment?.status === 'PAID') {
    throw new AppError(400, 'This booking is already paid.');
  }

  const amount = Number(booking.totalAmount) + Number(booking.vehicle.securityDeposit);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Math.round(amount * 100),
    currency: 'usd',
    metadata: { bookingId, userId: authUser.id },
    automatic_payment_methods: { enabled: true },
  });

  await prisma.payment.upsert({
    where: { bookingId },
    update: { stripePaymentIntentId: paymentIntent.id },
    create: {
      bookingId,
      userId: authUser.id,
      amount,
      status: 'PENDING',
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amount,
  };
};

const confirmPayment = async (paymentIntentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { stripePaymentIntentId: paymentIntentId },
  });

  if (!payment) {
    throw new AppError(404, 'Payment not found.');
  }

  if (payment.status === 'PAID') {
    return payment;
  }

  return prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'PAID' },
    }),
    prisma.booking.update({
      where: { id: payment.bookingId },
      data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
    }),
  ]);
};

const handleWebhook = async (rawBody: Buffer, signature: string) => {
  const stripe = getStripe();

  if (!env.STRIPE_WEBHOOK_SECRET) {
    throw new AppError(500, 'Stripe webhook secret is not configured.');
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    throw new AppError(400, 'Invalid Stripe signature.');
  }

  switch (event.type) {
    case 'payment_intent.succeeded': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await confirmPayment(paymentIntent.id);
      break;
    }
    case 'payment_intent.payment_failed': {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      await prisma.payment.updateMany({
        where: { stripePaymentIntentId: paymentIntent.id },
        data: { status: 'FAILED' },
      });
      break;
    }
    default:
      break;
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

  const isOwner = payment.userId === authUser.id;
  const isHost =
    payment.booking.vehicleId &&
    (await prisma.vehicle.findUnique({ where: { id: payment.booking.vehicleId } }))?.hostId ===
      authUser.id;

  if (!isOwner && !isHost && authUser.role !== 'ADMIN') {
    throw new AppError(403, 'You are not allowed to view this payment.');
  }

  return payment;
};

export const PaymentService = {
  createPaymentIntent,
  confirmPayment,
  handleWebhook,
  getPaymentByBooking,
};
