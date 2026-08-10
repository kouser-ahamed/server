import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { BookingService } from './booking.service';

const createBooking = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingService.createBooking(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Booking created successfully',
    data: booking,
  });
});

const getMyBookings = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.getMyBookings(req.user!, req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Your bookings retrieved successfully',
    data: result.bookings,
    meta: result.meta,
  });
});

const getVendorBookings = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.getVendorBookings(req.user!, req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Booking requests retrieved successfully',
    data: result.bookings,
    meta: result.meta,
  });
});

const getAllBookings = catchAsync(async (req: Request, res: Response) => {
  const result = await BookingService.getAllBookings(req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Bookings retrieved successfully',
    data: result.bookings,
    meta: result.meta,
  });
});

const getBookingById = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingService.getBookingById(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Booking retrieved successfully',
    data: booking,
  });
});

const updateBookingStatus = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingService.updateBookingStatus(req.params.id, req.body, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Booking status updated successfully',
    data: booking,
  });
});

const cancelBooking = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingService.cancelBooking(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Booking cancelled successfully',
    data: booking,
  });
});

const deleteBooking = catchAsync(async (req: Request, res: Response) => {
  const booking = await BookingService.deleteBooking(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Booking deleted successfully',
    data: booking,
  });
});

export const BookingController = {
  createBooking,
  getMyBookings,
  getVendorBookings,
  getAllBookings,
  getBookingById,
  updateBookingStatus,
  cancelBooking,
  deleteBooking,
};
