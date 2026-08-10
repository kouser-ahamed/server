import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { UserController } from './user.controller';

const router = Router();

router.get('/', authMiddleware, authorizeRoles('ADMIN'), UserController.getAllUsers);
router.get('/:id', authMiddleware, UserController.getUserById);
router.patch('/:id/block', authMiddleware, authorizeRoles('ADMIN'), UserController.toggleBlock);
router.patch('/:id', authMiddleware, UserController.updateProfile);
router.delete('/:id', authMiddleware, authorizeRoles('ADMIN'), UserController.deleteUser);

export default router;
