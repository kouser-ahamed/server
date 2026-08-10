import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import { WishlistService } from '../services/wishlist/wishlist.service';

const router = Router();

router.post(
  '/',
  authMiddleware,
  catchAsync(async (req, res) => {
    const item = await WishlistService.addToWishlist(req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: 'Added to wishlist successfully',
      data: item,
    });
  })
);

router.get(
  '/',
  authMiddleware,
  catchAsync(async (req, res) => {
    const result = await WishlistService.getWishlist(req.user!, req.query as { page?: number; limit?: number });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Wishlist retrieved successfully',
      data: result.items,
      meta: result.meta,
    });
  })
);

router.get(
  '/:vehicleId/check',
  authMiddleware,
  catchAsync(async (req, res) => {
    const exists = await WishlistService.isInWishlist(req.user!, req.params.vehicleId);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Wishlist status retrieved successfully',
      data: { isInWishlist: exists },
    });
  })
);

router.delete(
  '/:wishlistId',
  authMiddleware,
  catchAsync(async (req, res) => {
    await WishlistService.removeFromWishlist(req.params.wishlistId, req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Removed from wishlist successfully',
      data: null,
    });
  })
);

export default router;
