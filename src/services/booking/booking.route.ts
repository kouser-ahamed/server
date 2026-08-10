import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { BookingController } from './booking.controller';

const router = Router();

router.get('/my-bookings', authMiddleware, authorizeRoles('CUSTOMER'), BookingController.getMyBookings);
router.get('/vendor-bookings', authMiddleware, authorizeRoles('VENDOR'), BookingController.getVendorBookings);
router.get('/', authMiddleware, authorizeRoles('ADMIN'), BookingController.getAllBookings);
router.get('/:id', authMiddleware, BookingController.getBookingById);

router.post('/', authMiddleware, authorizeRoles('CUSTOMER'), BookingController.createBooking);
router.patch('/:id/status', authMiddleware, authorizeRoles('VENDOR', 'ADMIN'), BookingController.updateBookingStatus);
router.patch('/:id/cancel', authMiddleware, authorizeRoles('CUSTOMER'), BookingController.cancelBooking);
router.delete('/:id', authMiddleware, authorizeRoles('ADMIN'), BookingController.deleteBooking);

export default router;
