import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import categoryRoutes from './category.routes';
import vehicleRoutes from './vehicle.routes';
import bookingRoutes from './booking.routes';
import reviewRoutes from './review.routes';
import wishlistRoutes from './wishlist.routes';
import paymentRoutes from './payment.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/users', route: userRoutes },
  { path: '/categories', route: categoryRoutes },
  { path: '/vehicles', route: vehicleRoutes },
  { path: '/bookings', route: bookingRoutes },
  { path: '/reviews', route: reviewRoutes },
  { path: '/wishlist', route: wishlistRoutes },
  { path: '/payments', route: paymentRoutes },
  { path: '/dashboard', route: dashboardRoutes },
];

moduleRoutes.forEach(({ path, route }) => {
  router.use(path, route);
});

export default router;
