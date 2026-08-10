import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import roleMiddleware from '../middlewares/role.middleware';
import { UserService } from '../services/user/user.service';

const router = Router();

router.patch(
  '/profile',
  authMiddleware,
  catchAsync(async (req, res) => {
    const user = await UserService.updateProfile(req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Profile updated successfully',
      data: user,
    });
  })
);

router.patch(
  '/change-password',
  authMiddleware,
  catchAsync(async (req, res) => {
    await UserService.changePassword(req.user!, req.body);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Password changed successfully',
      data: null,
    });
  })
);

router.get(
  '/refresh-token',
  authMiddleware,
  catchAsync(async (req, res) => {
    const token = UserService.refreshToken(req.user!);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Token refreshed successfully',
      data: { token },
    });
  })
);

router.get(
  '/',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    const result = await UserService.getAllUsers(req.query as { page?: number; limit?: number; search?: string });
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Users retrieved successfully',
      data: result.users,
      meta: result.meta,
    });
  })
);

router.patch(
  '/:userId/role',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    const user = await UserService.updateUserRole(req.params.userId, req.body.role);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'User role updated successfully',
      data: user,
    });
  })
);

router.patch(
  '/:userId/status',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (req, res) => {
    const user = await UserService.toggleUserStatus(req.params.userId);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'User status updated successfully',
      data: user,
    });
  })
);

export default router;
