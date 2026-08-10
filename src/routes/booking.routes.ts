import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import roleMiddleware from '../middlewares/role.middleware';
import { BookingService } from '../services/booking/booking.service';

const router = Router();

router.post(
  '/',
  authMiddleware,
  catchAsync(async (req, res) => {
    const booking = await BookingService.createBooking(req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: 'Booking created successfully',
      data: booking,
    });
  })
);

router.get(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    const result = await BookingService.getAllBookings(
      req.query as { page?: number; limit?: number; status?: string; vehicleId?: string; userId?: string }
    );
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Bookings retrieved successfully',
      data: result.bookings,
      meta: result.meta,
    });
  })
);

router.get(
  '/my-bookings',
  authMiddleware,
  catchAsync(async (req, res) => {
    const result = await BookingService.getMyBookings(req.user!, req.query as { page?: number; limit?: number });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Your bookings retrieved successfully',
      data: result.bookings,
      meta: result.meta,
    });
  })
);

router.get(
  '/host-bookings',
  authMiddleware,
  roleMiddleware('HOST', 'ADMIN'),
  catchAsync(async (req, res) => {
    const result = await BookingService.getHostBookings(req.user!, req.query as { page?: number; limit?: number });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Booking requests retrieved successfully',
      data: result.bookings,
      meta: result.meta,
    });
  })
);

router.get(
  '/:bookingId',
  authMiddleware,
  catchAsync(async (req, res) => {
    const booking = await BookingService.getBookingById(req.params.bookingId, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Booking retrieved successfully',
      data: booking,
    });
  })
);

router.patch(
  '/:bookingId/status',
  authMiddleware,
  catchAsync(async (req, res) => {
    const booking = await BookingService.updateBookingStatus(req.params.bookingId, req.body, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Booking status updated successfully',
      data: booking,
    });
  })
);

router.patch(
  '/:bookingId/cancel',
  authMiddleware,
  catchAsync(async (req, res) => {
    const booking = await BookingService.cancelBooking(req.params.bookingId, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Booking cancelled successfully',
      data: booking,
    });
  })
);

export default router;
