import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { PaymentController } from './payment.controller';

const router = Router();

router.post(
  '/create-checkout-session',
  authMiddleware,
  authorizeRoles('CUSTOMER'),
  PaymentController.createCheckoutSession
);
router.post(
  '/verify-session',
  authMiddleware,
  authorizeRoles('CUSTOMER', 'ADMIN'),
  PaymentController.verifySession
);
router.get('/:bookingId', authMiddleware, PaymentController.getPaymentByBooking);

export default router;
