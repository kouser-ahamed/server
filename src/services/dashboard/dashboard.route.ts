import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { DashboardController } from './dashboard.controller';

const router = Router();

router.get(
  '/admin-stats',
  authMiddleware,
  authorizeRoles('ADMIN'),
  DashboardController.getAdminStats
);
router.get(
  '/vendor-stats',
  authMiddleware,
  authorizeRoles('VENDOR'),
  DashboardController.getVendorStats
);
router.get(
  '/customer-stats',
  authMiddleware,
  authorizeRoles('CUSTOMER'),
  DashboardController.getCustomerStats
);

export default router;
