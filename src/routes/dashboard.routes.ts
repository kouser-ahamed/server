import { Router } from 'express';
import catchAsync from '../utils/catchAsync';
import sendResponse from '../utils/sendResponse';
import authMiddleware from '../middlewares/auth.middleware';
import roleMiddleware from '../middlewares/role.middleware';
import { DashboardService } from '../services/dashboard/dashboard.service';

const router = Router();

router.get(
  '/admin',
  authMiddleware,
  roleMiddleware('ADMIN'),
  catchAsync(async (_req, res) => {
    const result = await DashboardService.getAdminStats();
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Admin dashboard data retrieved successfully',
      data: result,
    });
  })
);

router.get(
  '/host',
  authMiddleware,
  roleMiddleware('HOST', 'ADMIN'),
  catchAsync(async (req, res) => {
    const result = await DashboardService.getHostStats(req.user!);
    sendResponse(res, {
      success: true,
      statusCode: 200,
      message: 'Host dashboard data retrieved successfully',
      data: result,
    });
  })
);

export default router;
