import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { AuthService } from './auth.service';

const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const register = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthService.register(req.body);

  sendResponse(res, {
    success: true,
    statusCode: 201,
    message: 'Account created successfully',
    data: { user },
  });
});

const login = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await AuthService.login(req.body);

  res.cookie('token', token, cookieOptions);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Login successful',
    data: { user, token },
  });
});

const googleLogin = catchAsync(async (req: Request, res: Response) => {
  const { user, token } = await AuthService.googleLogin(req.body);

  res.cookie('token', token, cookieOptions);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Google login successful',
    data: { user, token },
  });
});

const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await AuthService.getMe(req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Profile retrieved successfully',
    data: { user },
  });
});

const logout = catchAsync(async (_req: Request, res: Response) => {
  res.clearCookie('token');

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Logged out successfully',
    data: null,
  });
});

export const AuthController = {
  register,
  login,
  googleLogin,
  getMe,
  logout,
};
