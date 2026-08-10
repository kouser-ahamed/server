import bcrypt from 'bcrypt';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import generateToken from '../../utils/generateToken';

const updateProfileSchema = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  profileImage: z.string().url().optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
});

const updateProfile = async (authUser: AuthUser, payload: z.infer<typeof updateProfileSchema>) => {
  const data = updateProfileSchema.parse(payload);

  const user = await prisma.user.update({
    where: { id: authUser.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileImage: true,
      phone: true,
      address: true,
      updatedAt: true,
    },
  });

  return user;
};

const changePassword = async (
  authUser: AuthUser,
  payload: z.infer<typeof changePasswordSchema>
) => {
  const data = changePasswordSchema.parse(payload);

  const user = await prisma.user.findUnique({ where: { id: authUser.id } });
  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  if (!user.password) {
    throw new AppError(400, 'You signed up with Google and do not have a password set.');
  }

  const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, 'Current password is incorrect.');
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: authUser.id },
    data: { password: hashedPassword },
  });

  return null;
};

const getAllUsers = async (query: { page?: number; limit?: number; search?: string }) => {
  const page = query.page ?? 1;
  const limit = query.limit ?? 10;

  const where = query.search
    ? {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' as const } },
          { email: { contains: query.search, mode: 'insensitive' as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        profileImage: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: { page, limit, total } };
};

const updateUserRole = async (userId: string, role: string) => {
  if (!['USER', 'HOST', 'ADMIN'].includes(role)) {
    throw new AppError(400, 'Invalid role. Allowed roles: USER, HOST, ADMIN.');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { role: role as 'USER' | 'HOST' | 'ADMIN' },
    select: { id: true, name: true, email: true, role: true },
  });

  return updated;
};

const toggleUserStatus = async (userId: string) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { isActive: !user.isActive },
    select: { id: true, name: true, email: true, isActive: true },
  });

  return updated;
};

const refreshToken = (authUser: AuthUser) => {
  return generateToken({ userId: authUser.id, role: authUser.role }, env.JWT_SECRET, env.JWT_EXPIRES_IN);
};

export const UserService = {
  updateProfile,
  changePassword,
  getAllUsers,
  updateUserRole,
  toggleUserStatus,
  refreshToken,
};
