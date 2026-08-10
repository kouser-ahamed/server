import { Router } from 'express';
import authRoutes from '../services/auth/auth.route';
import categoryRoutes from '../services/category/category.route';
import vehicleRoutes from '../services/vehicle/vehicle.route';
import reviewRoutes from '../services/review/review.route';
import wishlistRoutes from '../services/wishlist/wishlist.route';
import userRoutes from '../services/user/user.route';
import bookingRoutes from '../services/booking/booking.route';
import paymentRoutes from '../services/payment/payment.route';
import dashboardRoutes from '../services/dashboard/dashboard.route';

const router = Router();

const moduleRoutes = [
  { path: '/auth', route: authRoutes },
  { path: '/categories', route: categoryRoutes },
  { path: '/vehicles', route: vehicleRoutes },
  { path: '/reviews', route: reviewRoutes },
  { path: '/wishlist', route: wishlistRoutes },
  { path: '/users', route: userRoutes },
  { path: '/bookings', route: bookingRoutes },
  { path: '/payments', route: paymentRoutes },
  { path: '/dashboard', route: dashboardRoutes },
];

moduleRoutes.forEach(({ path, route }) => {
  router.use(path, route);
});

export default router;
