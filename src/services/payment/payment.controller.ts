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

const verifySession = catchAsync(async (req: Request, res: Response) => {
  const result = await PaymentService.verifySession(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Payment verified successfully',
    data: result,
  });
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
  verifySession,
  getPaymentByBooking,
};
