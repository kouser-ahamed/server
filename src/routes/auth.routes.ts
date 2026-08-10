import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import { AuthService } from '../services/auth/auth.service';

const router = Router();

router.post(
  '/register',
  catchAsync(async (req, res) => {
    const result = await AuthService.register(req.body);
    sendResponse(res, {
      success: true,
      statusCode: 201,
      message: 'Account created successfully',
      data: result,
    });
  })
);

router.post(
  '/login',
  catchAsync(async (req, res) => {
    const result = await AuthService.login(req.body);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Login successful',
      data: result,
    });
  })
);

router.post(
  '/google',
  catchAsync(async (req, res) => {
    const result = await AuthService.googleLogin(req.body);

    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Google login successful',
      data: result,
    });
  })
);

router.get(
  '/me',
  authMiddleware,
  catchAsync(async (req, res) => {
    const user = await AuthService.getMe(req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Profile retrieved successfully',
      data: user,
    });
  })
);

router.post(
  '/logout',
  catchAsync(async (_req, res) => {
    res.clearCookie('token');
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Logged out successfully',
      data: null,
    });
  })
);

export default router;
