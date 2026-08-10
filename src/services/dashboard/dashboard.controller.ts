import { Request, Response } from 'express';
import catchAsync from '../../utils/catchAsync';
import sendResponse from '../../utils/sendResponse';
import { DashboardService } from './dashboard.service';

const getAdminStats = catchAsync(async (_req: Request, res: Response) => {
  const result = await DashboardService.getAdminStats();

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Admin dashboard data retrieved successfully',
    data: result,
  });
});

const getVendorStats = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getVendorStats(req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Vendor dashboard data retrieved successfully',
    data: result,
  });
});

const getCustomerStats = catchAsync(async (req: Request, res: Response) => {
  const result = await DashboardService.getCustomerStats(req.user!);

  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Customer dashboard data retrieved successfully',
    data: result,
  });
});

export const DashboardController = {
  getAdminStats,
  getVendorStats,
  getCustomerStats,
};
