import { prisma } from '../../lib/prisma';
import { AuthUser } from '../../middlewares/auth.middleware';

const getAdminStats = async () => {
  const [
    totalUsers,
    totalVendors,
    totalCustomers,
    totalVehicles,
    totalBookings,
    revenueAgg,
    pendingBookings,
  ] = await Promise.all([
    prisma.user.count({ where: { isDeleted: false } }),
    prisma.user.count({ where: { role: 'VENDOR', isDeleted: false } }),
    prisma.user.count({ where: { role: 'CUSTOMER', isDeleted: false } }),
    prisma.vehicle.count({ where: { isDeleted: false } }),
    prisma.booking.count({ where: { isDeleted: false } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { isDeleted: false, paymentStatus: 'PAID' },
    }),
    prisma.booking.count({ where: { status: 'PENDING', isDeleted: false } }),
  ]);

  return {
    stats: {
      totalUsers,
      totalVendors,
      totalCustomers,
      totalVehicles,
      totalBookings,
      totalRevenue: revenueAgg._sum.totalPrice ?? 0,
      pendingBookings,
    },
  };
};

const getVendorStats = async (authUser: AuthUser) => {
  const [totalVehicles, totalBookings, earningsAgg, pendingBookings] = await Promise.all([
    prisma.vehicle.count({ where: { vendorId: authUser.id, isDeleted: false } }),
    prisma.booking.count({ where: { vehicle: { vendorId: authUser.id }, isDeleted: false } }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { vehicle: { vendorId: authUser.id }, paymentStatus: 'PAID' },
    }),
    prisma.booking.count({
      where: { vehicle: { vendorId: authUser.id }, status: 'PENDING', isDeleted: false },
    }),
  ]);

  return {
    stats: {
      totalVehicles,
      totalBookings,
      totalEarnings: earningsAgg._sum.totalPrice ?? 0,
      pendingBookings,
    },
  };
};

const getCustomerStats = async (authUser: AuthUser) => {
  const [totalBookings, activeBookings, spentAgg, wishlistCount] = await Promise.all([
    prisma.booking.count({ where: { userId: authUser.id, isDeleted: false } }),
    prisma.booking.count({
      where: { userId: authUser.id, isDeleted: false, status: 'CONFIRMED' },
    }),
    prisma.booking.aggregate({
      _sum: { totalPrice: true },
      where: { userId: authUser.id, paymentStatus: 'PAID' },
    }),
    prisma.wishlist.count({ where: { userId: authUser.id } }),
  ]);

  return {
    stats: {
      totalBookings,
      activeBookings,
      totalSpent: spentAgg._sum.totalPrice ?? 0,
      wishlistCount,
    },
  };
};

export const DashboardService = {
  getAdminStats,
  getVendorStats,
  getCustomerStats,
};
