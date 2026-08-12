import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import generateToken from '../../utils/generateToken';
import { AuthUser } from '../../middlewares/auth.middleware';
import { AuthValidation } from './auth.validation';

const issueToken = (user: { id: string; role: string; email: string }) => {
  return generateToken(
    { userId: user.id, role: user.role, email: user.email },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN
  );
};

const sanitizeUser = (user: {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImage: string | null;
  password: string | null;
  role: string;
  authProvider: string;
  createdAt: Date;
}) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  phone: user.phone,
  profileImage: user.profileImage,
  role: user.role,
  authProvider: user.authProvider,
  hasPassword: Boolean(user.password),
  createdAt: user.createdAt,
});

const register = async (payload: unknown) => {
  const data = AuthValidation.registerSchema.parse(payload);

  const existingUser = await prisma.user.findUnique({ where: { email: data.email } });
  if (existingUser) {
    throw new AppError(409, 'An account with this email already exists.');
  }

  const hashedPassword = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      password: hashedPassword,
      phone: data.phone,
      role: data.role ?? 'CUSTOMER',
      authProvider: 'credentials',
    },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profileImage: true,
      password: true,
      role: true,
      authProvider: true,
      createdAt: true,
    },
  });

  return sanitizeUser(user);
};

const login = async (payload: unknown) => {
  const data = AuthValidation.loginSchema.parse(payload);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new AppError(401, 'Invalid email or password.');
  }

  if (user.isBlocked) {
    throw new AppError(403, 'Your account has been blocked.');
  }

  if (user.isDeleted) {
    throw new AppError(401, 'Invalid email or password.');
  }

  if (!user.password) {
    throw new AppError(
      401,
      "This account doesn't have a password set. Please log in with Google, or set a password from your profile after logging in with Google."
    );
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, 'Invalid email or password.');
  }

  const token = issueToken({ id: user.id, role: user.role, email: user.email });

  return { user: sanitizeUser(user), token };
};

const googleLogin = async (payload: unknown) => {
  const { credential } = AuthValidation.googleLoginSchema.parse(payload);

  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(500, 'Google authentication is not configured.');
  }

  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID);

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID,
    });
  } catch {
    throw new AppError(401, 'Invalid or expired Google token.');
  }

  const payloadFromGoogle = ticket.getPayload();
  if (!payloadFromGoogle || !payloadFromGoogle.email) {
    throw new AppError(401, 'Invalid Google token.');
  }

  const emailVerified = payloadFromGoogle.email_verified;
  if (emailVerified !== true) {
    throw new AppError(400, 'Google email is not verified.');
  }

  const { email, name, picture, sub: googleId } = payloadFromGoogle;

  let user = await prisma.user.findUnique({ where: { email } });

  if (user && user.isBlocked) {
    throw new AppError(403, 'Your account has been blocked.');
  }

  if (user && user.isDeleted) {
    throw new AppError(401, 'This account is no longer active.');
  }

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: name ?? email.split('@')[0],
        email,
        password: null,
        authProvider: 'google',
        googleId,
        profileImage: picture ?? null,
        role: 'CUSTOMER',
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        googleId,
        authProvider: 'google',
        profileImage: user.profileImage ?? picture ?? null,
      },
    });
  }

  const token = issueToken({ id: user.id, role: user.role, email: user.email });

  return { user: sanitizeUser(user), token };
};

const getMe = async (authUser: AuthUser) => {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      profileImage: true,
      password: true,
      role: true,
      authProvider: true,
      isBlocked: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  const { password, ...safeUser } = user;

  return { ...safeUser, hasPassword: Boolean(password) };
};

const changePassword = async (authUser: AuthUser, payload: unknown) => {
  const data = AuthValidation.changePasswordSchema.parse(payload);

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, password: true, isDeleted: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  if (!user.password) {
    throw new AppError(400, 'Your account does not have a password set.');
  }

  const isPasswordValid = await bcrypt.compare(data.currentPassword, user.password);
  if (!isPasswordValid) {
    throw new AppError(400, 'Current password is incorrect.');
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: authUser.id },
    data: { password: hashedPassword },
  });

  return null;
};

const setPassword = async (authUser: AuthUser, payload: unknown) => {
  const data = AuthValidation.setPasswordSchema.parse(payload);

  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: { id: true, password: true, isDeleted: true },
  });

  if (!user || user.isDeleted) {
    throw new AppError(404, 'User not found.');
  }

  if (user.password) {
    throw new AppError(400, 'You already have a password set. Use "Change Password" to update it.');
  }

  const hashedPassword = await bcrypt.hash(data.newPassword, env.BCRYPT_SALT_ROUNDS);

  await prisma.user.update({
    where: { id: authUser.id },
    data: { password: hashedPassword },
  });

  return null;
};

export const AuthService = {
  register,
  login,
  googleLogin,
  getMe,
  changePassword,
  setPassword,
};
