import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { CategoryController } from './category.controller';

const router = Router();

router.post('/', authMiddleware, authorizeRoles('ADMIN'), CategoryController.createCategory);
router.get('/', CategoryController.getAllCategories);
router.get('/:id', CategoryController.getCategoryById);
router.patch('/:id', authMiddleware, authorizeRoles('ADMIN'), CategoryController.updateCategory);
router.delete('/:id', authMiddleware, authorizeRoles('ADMIN'), CategoryController.deleteCategory);

export default router;
