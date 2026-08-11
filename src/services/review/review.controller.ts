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
  const result = await ReviewService.getReviewsByVehicle(
    req.params.vehicleId,
    req.query,
    req.user
  );

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reviews retrieved successfully',
    data: result.reviews,
    meta: result.meta,
  });
});

const getAllReviews = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.getAllReviews(req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reviews retrieved successfully',
    data: result.reviews,
    meta: result.meta,
  });
});

const getReviewById = catchAsync(async (req: Request, res: Response) => {
  const review = await ReviewService.getReviewById(req.params.id);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Review retrieved successfully',
    data: review,
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

const createReply = catchAsync(async (req: Request, res: Response) => {
  const reply = await ReviewService.createReply(req.params.id, req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Reply submitted successfully',
    data: reply,
  });
});

const updateReply = catchAsync(async (req: Request, res: Response) => {
  const reply = await ReviewService.updateReply(req.params.id, req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reply updated successfully',
    data: reply,
  });
});

const deleteReply = catchAsync(async (req: Request, res: Response) => {
  const reply = await ReviewService.deleteReply(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reply deleted successfully',
    data: reply,
  });
});

const react = catchAsync(async (req: Request, res: Response) => {
  const result = await ReviewService.reactToReview(req.params.id, req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reaction updated successfully',
    data: result,
  });
});

const deleteReaction = catchAsync(async (req: Request, res: Response) => {
  await ReviewService.deleteReaction(req.params.id, req.params.reactionId);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Reaction deleted successfully',
    data: null,
  });
});

export const ReviewController = {
  createReview,
  getReviewsByVehicle,
  getAllReviews,
  getReviewById,
  updateReview,
  deleteReview,
  createReply,
  updateReply,
  deleteReply,
  react,
  deleteReaction,
};
