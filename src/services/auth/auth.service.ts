import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import AppError from '../../utils/AppError';
import generateToken from '../../utils/generateToken';
import { AuthUser } from '../../middlewares/auth.middleware';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
  role: z.enum(['USER', 'HOST']).optional(),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const googleLoginSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

const register = async (payload: z.infer<typeof registerSchema>) => {
  const data = registerSchema.parse(payload);

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
      role: data.role ?? 'USER',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileImage: true,
      phone: true,
      createdAt: true,
    },
  });

  const token = generateToken(
    { userId: user.id, role: user.role },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN
  );

  return { user, token };
};

const login = async (payload: z.infer<typeof loginSchema>) => {
  const data = loginSchema.parse(payload);

  const user = await prisma.user.findUnique({ where: { email: data.email } });
  if (!user) {
    throw new AppError(401, 'Invalid email or password.');
  }

  if (!user.password) {
    throw new AppError(401, 'This account uses Google sign-in. Please login with Google.');
  }

  const isPasswordValid = await bcrypt.compare(data.password, user.password);
  if (!isPasswordValid) {
    throw new AppError(401, 'Invalid email or password.');
  }

  if (!user.isActive) {
    throw new AppError(403, 'Your account has been deactivated.');
  }

  const token = generateToken(
    { userId: user.id, role: user.role },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN
  );

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage,
    phone: user.phone,
    createdAt: user.createdAt,
  };

  return { user: safeUser, token };
};

const googleLogin = async (payload: z.infer<typeof googleLoginSchema>) => {
  const { idToken } = googleLoginSchema.parse(payload);

  if (!env.GOOGLE_CLIENT_ID) {
    throw new AppError(500, 'Google authentication is not configured.');
  }

  const client = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET);

  const ticket = await client.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });

  const payloadFromGoogle = ticket.getPayload();
  if (!payloadFromGoogle || !payloadFromGoogle.email) {
    throw new AppError(401, 'Invalid Google token.');
  }

  const { email, name, picture, sub } = payloadFromGoogle;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        name: name ?? email.split('@')[0],
        email,
        profileImage: picture ?? null,
        googleId: sub,
        isVerified: true,
      },
    });
  } else if (!user.googleId) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId: sub, isVerified: true },
    });
  }

  if (!user.isActive) {
    throw new AppError(403, 'Your account has been deactivated.');
  }

  const token = generateToken(
    { userId: user.id, role: user.role },
    env.JWT_SECRET,
    env.JWT_EXPIRES_IN
  );

  const safeUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage,
    phone: user.phone,
    createdAt: user.createdAt,
  };

  return { user: safeUser, token };
};

const getMe = async (authUser: AuthUser) => {
  const user = await prisma.user.findUnique({
    where: { id: authUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileImage: true,
      phone: true,
      address: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    throw new AppError(404, 'User not found.');
  }

  return user;
};

export const AuthService = {
  register,
  login,
  googleLogin,
  getMe,
};
