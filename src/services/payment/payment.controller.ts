import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { PaymentService } from './payment.service';

const createCheckoutSession = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.createCheckoutSession(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Checkout session created successfully',
    data: result,
  });
});

const handleWebhook = catchAsync(async (req: Request, res: Response) => {
  const signature = req.headers['stripe-signature'] as string;
  const result = await PaymentService.handleWebhook(req.body as Buffer, signature);

  res.status(200).json(result);
});

const getPaymentByBooking = catchAsync(async (req: Request, res: Response) => {
  const payment = await PaymentService.getPaymentByBooking(req.params.bookingId, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Payment retrieved successfully',
    data: payment,
  });
});

export const PaymentController = {
  createCheckoutSession,
  handleWebhook,
  getPaymentByBooking,
};
