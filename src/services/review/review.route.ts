import { Router } from 'express';
import authMiddleware, { optionalAuthMiddleware } from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { ReviewController } from './review.controller';

const router = Router();

router.get('/vehicle/:vehicleId', optionalAuthMiddleware, ReviewController.getReviewsByVehicle);
router.get('/', authMiddleware, authorizeRoles('ADMIN'), ReviewController.getAllReviews);
router.get('/:id', authMiddleware, authorizeRoles('ADMIN'), ReviewController.getReviewById);

router.post('/', authMiddleware, authorizeRoles('CUSTOMER'), ReviewController.createReview);
router.patch('/:id', authMiddleware, ReviewController.updateReview);
router.delete('/:id', authMiddleware, ReviewController.deleteReview);

router.post('/:id/reply', authMiddleware, authorizeRoles('VENDOR'), ReviewController.createReply);
router.patch('/:id/reply', authMiddleware, authorizeRoles('VENDOR'), ReviewController.updateReply);
router.delete('/:id/reply', authMiddleware, authorizeRoles('VENDOR', 'ADMIN'), ReviewController.deleteReply);

router.post('/:id/react', authMiddleware, authorizeRoles('CUSTOMER'), ReviewController.react);
router.delete('/:id/react/:reactionId', authMiddleware, authorizeRoles('ADMIN'), ReviewController.deleteReaction);

export default router;
