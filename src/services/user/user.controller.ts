import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { UserService } from './user.service';

const getAllUsers = catchAsync(async (req: Request, res: Response) => {
  const result = await UserService.getAllUsers(req.query);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Users retrieved successfully',
    data: result.users,
    meta: result.meta,
  });
});

const getUserById = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.getUserById(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'User retrieved successfully',
    data: user,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.updateProfile(req.params.id, req.user!, req.body);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Profile updated successfully',
    data: user,
  });
});

const toggleBlock = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.toggleBlock(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'User block status updated successfully',
    data: user,
  });
});

const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const user = await UserService.deleteUser(req.params.id, req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'User deleted successfully',
    data: user,
  });
});

export const UserController = {
  getAllUsers,
  getUserById,
  updateProfile,
  toggleBlock,
  deleteUser,
};
