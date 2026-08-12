import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import { AuthUser } from '../../middlewares/auth.middleware';
import { UserValidation } from './user.validation';

const userSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  profileImage: true,
  role: true,
  authProvider: true,
  isBlocked: true,
  isDeleted: true,
  createdAt: true,
  updatedAt: true,
} as const;

const getAllUsers = async (query: unknown) => {
  const q = UserValidation.getAllUsersQuerySchema.parse(query);

  const page = q.page ?? 1;
  const limit = q.limit ?? 10;

  const where: Prisma.UserWhereInput = { isDeleted: false };

  if (q.role) where.role = q.role;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: 'insensitive' } },
      { email: { contains: q.search, mode: 'insensitive' } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      select: userSelect,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { users, meta: { page, limit, total } };
};

const getUserById = async (userId: string, authUser: AuthUser) => {
  if (authUser.role !== 'ADMIN' && authUser.id !== userId) {
    throw new AppError(403, 'You can only view your own profile.');
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: userSelect,
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  return user;
};

const updateProfile = async (userId: string, authUser: AuthUser, payload: unknown) => {
  if (authUser.id !== userId) {
    throw new AppError(403, 'You can only update your own profile.');
  }

  const data = UserValidation.updateProfileSchema.parse(payload);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: { ...userSelect, password: true },
  });

  const { password, ...safeUser } = updated;

  return { ...safeUser, hasPassword: Boolean(password) };
};

const toggleBlock = async (userId: string, authUser: AuthUser) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  if (userId === authUser.id) {
    throw new AppError(400, 'You cannot block your own account.');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isBlocked: !user.isBlocked },
    select: userSelect,
  });
};

const deleteUser = async (userId: string, authUser: AuthUser) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  if (userId === authUser.id) {
    throw new AppError(400, 'You cannot delete your own account.');
  }

  return prisma.user.update({
    where: { id: userId },
    data: { isDeleted: true },
    select: userSelect,
  });
};

export const UserService = {
  getAllUsers,
  getUserById,
  updateProfile,
  toggleBlock,
  deleteUser,
};
