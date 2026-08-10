import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { ReviewService } from './review.service';

const createReview = catchAsync(async (req: Request, res: Response) => {
  const review = await ReviewService.createReview(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Review submitted successfully',
    data: review,
  });
});

const getReviewsByVehicle = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getReviewsByVehicle(req.params.vehicleId, req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reviews retrieved successfully',
    data: result.reviews,
    meta: result.meta,
  });
});

const updateReview = catchAsync(async (req: Request, res: Response) => {
  const review = await ReviewService.updateReview(req.params.id, req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Review updated successfully',
    data: review,
  });
});

const deleteReview = catchAsync(async (req: Request, res: Response) => {
  const review = await ReviewService.deleteReview(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Review deleted successfully',
    data: review,
  });
});

export const ReviewController = {
  createReview,
  getReviewsByVehicle,
  updateReview,
  deleteReview,
};
