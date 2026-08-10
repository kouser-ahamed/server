import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { ReviewController } from './review.controller';

const router = Router();

router.get('/vehicle/:vehicleId', ReviewController.getReviewsByVehicle);

router.post('/', authMiddleware, authorizeRoles('CUSTOMER'), ReviewController.createReview);
router.patch('/:id', authMiddleware, ReviewController.updateReview);
router.delete('/:id', authMiddleware, ReviewController.deleteReview);

export default router;
