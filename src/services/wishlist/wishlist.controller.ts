import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { WishlistService } from './wishlist.service';

const addToWishlist = catchAsync(async (req: Request, res: Response) => {
  const item = await WishlistService.addToWishlist(req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Added to wishlist successfully',
    data: item,
  });
});

const getMyWishlist = catchAsync(async (req: Request, res: Response) => {
  const result = await WishlistService.getMyWishlist(req.user!, req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Wishlist retrieved successfully',
    data: result.items,
    meta: result.meta,
  });
});

const removeFromWishlist = catchAsync(async (req: Request, res: Response) => {
  await WishlistService.removeFromWishlist(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Removed from wishlist successfully',
    data: null,
  });
});

export const WishlistController = {
  addToWishlist,
  getMyWishlist,
  removeFromWishlist,
};
