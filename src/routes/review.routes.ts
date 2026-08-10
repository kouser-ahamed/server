import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import roleMiddleware from '../middlewares/role.middleware';
import { ReviewService } from '../services/review/review.service';

const router = Router();

router.post(
  '/',
  authMiddleware,
  catchAsync(async (req, res) => {
    const review = await ReviewService.createReview(req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: 'Review submitted successfully',
      data: review,
    });
  })
);

router.get(
  '/my-reviews',
  authMiddleware,
  catchAsync(async (req, res) => {
    const result = await ReviewService.getReviewsByUser(req.user!, req.query as { page?: number; limit?: number });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Your reviews retrieved successfully',
      data: result.reviews,
      meta: result.meta,
    });
  })
);

router.get(
  '/vehicle/:vehicleId',
  catchAsync(async (req, res) => {
    const result = await ReviewService.getReviewsByVehicle(
      req.params.vehicleId,
      req.query as { page?: number; limit?: number }
    );
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Reviews retrieved successfully',
      data: result.reviews,
      meta: result.meta,
    });
  })
);

router.patch(
  '/:reviewId',
  authMiddleware,
  catchAsync(async (req, res) => {
    const review = await ReviewService.updateReview(req.params.reviewId, req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Review updated successfully',
      data: review,
    });
  })
);

router.delete(
  '/:reviewId',
  authMiddleware,
  roleMiddleware('USER', 'HOST', 'ADMIN'),
  catchAsync(async (req, res) => {
    await ReviewService.deleteReview(req.params.reviewId, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Review deleted successfully',
      data: null,
    });
  })
);

export default router;
