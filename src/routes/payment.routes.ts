import { Router } from 'express';
import type { Request, Response } from 'express';
import authMiddleware from '../middlewares/auth.middleware';
import { PaymentService } from '../services/payment/payment.service';
import { env } from '../config/env';

const router = Router();

router.post(
  '/create-payment-intent',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const result = await PaymentService.createPaymentIntent(req.user!, req.body);
      res.status(200).json({
        success: true,
        message: 'Payment intent created successfully',
        data: result,
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Payment intent creation failed',
        data: null,
      });
    }
  }
);

router.post(
  '/webhook',
  async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature || !env.STRIPE_WEBHOOK_SECRET) {
      res.status(400).json({ success: false, message: 'Missing Stripe signature' });
      return;
    }

    try {
      const result = await PaymentService.handleWebhook(req.body as Buffer, signature);
      res.status(200).json(result);
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Webhook handling failed',
      });
    }
  }
);

router.get(
  '/booking/:bookingId',
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const payment = await PaymentService.getPaymentByBooking(req.params.bookingId, req.user!);
      res.status(200).json({
        success: true,
        message: 'Payment retrieved successfully',
        data: payment,
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        message: err instanceof Error ? err.message : 'Payment retrieval failed',
        data: null,
      });
    }
  }
);

export default router;
