import { prisma } from '../../lib/prisma';
import { AuthUser } from '../../middlewares/auth.middleware';

const getAdminStats = async () => {
  const [
    totalUsers,
    totalHosts,
    totalVehicles,
    totalBookings,
    totalRevenue,
    pendingBookings,
    recentBookings,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: 'HOST' } }),
    prisma.vehicle.count(),
    prisma.booking.count(),
    prisma.booking.aggregate({
      _sum: { totalAmount: true },
      where: { status: 'COMPLETED' },
    }),
    prisma.booking.count({ where: { status: 'PENDING' } }),
    prisma.booking.findMany({
      take: 10,
      include: {
        user: { select: { name: true, email: true } },
        vehicle: { select: { title: true, brand: true, model: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    stats: {
      totalUsers,
      totalHosts,
      totalVehicles,
      totalBookings,
      totalRevenue: totalRevenue._sum.totalAmount ?? 0,
      pendingBookings,
    },
    recentBookings,
  };
};

const getHostStats = async (authUser: AuthUser) => {
  const [totalVehicles, availableVehicles, totalBookings, completedBookings, totalEarnings] =
    await Promise.all([
      prisma.vehicle.count({ where: { hostId: authUser.id } }),
      prisma.vehicle.count({ where: { hostId: authUser.id, isAvailable: true } }),
      prisma.booking.count({ where: { vehicle: { hostId: authUser.id } } }),
      prisma.booking.count({
        where: { vehicle: { hostId: authUser.id }, status: 'COMPLETED' },
      }),
      prisma.booking.aggregate({
        _sum: { totalAmount: true },
        where: { vehicle: { hostId: authUser.id }, status: 'COMPLETED' },
      }),
    ]);

  return {
    stats: {
      totalVehicles,
      availableVehicles,
      totalBookings,
      completedBookings,
      totalEarnings: totalEarnings._sum.totalAmount ?? 0,
    },
  };
};

export const DashboardService = {
  getAdminStats,
  getHostStats,
};
