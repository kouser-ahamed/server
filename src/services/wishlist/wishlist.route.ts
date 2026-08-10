import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import authorizeRoles from '../../middlewares/role.middleware';
import { WishlistController } from './wishlist.controller';

const router = Router();

router.post('/', authMiddleware, authorizeRoles('CUSTOMER'), WishlistController.addToWishlist);
router.get('/my-wishlist', authMiddleware, authorizeRoles('CUSTOMER'), WishlistController.getMyWishlist);
router.delete('/:id', authMiddleware, authorizeRoles('CUSTOMER'), WishlistController.removeFromWishlist);

export default router;
