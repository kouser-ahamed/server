import { Router } from 'express';
import authMiddleware from '../../middlewares/auth.middleware';
import { AuthController } from './auth.controller';

const router = Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/google-login', AuthController.googleLogin);
router.post('/logout', AuthController.logout);

router.get('/me', authMiddleware, AuthController.getMe);

export default router;
