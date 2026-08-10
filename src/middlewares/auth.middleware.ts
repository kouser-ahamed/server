import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import { prisma } from '../lib/prisma';
import AppError from '../utils/AppError';
import catchAsync from '../utils/catchAsync';

export interface JWTPayload extends JwtPayload {
  userId: string;
  role: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  profileImage: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const getTokenFromRequest = (req: Request): string | undefined => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }
  return req.cookies?.token as string | undefined;
};

const authMiddleware = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const token = getTokenFromRequest(req);

  if (!token) {
    throw new AppError(401, 'You are not authorized. Please login.');
  }

  let decoded: JWTPayload;
  try {
    decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
  } catch {
    throw new AppError(401, 'Invalid or expired token. Please login again.');
  }

  const user = await prisma.user.findUnique({
    where: { id: decoded.userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      profileImage: true,
      isActive: true,
    },
  });

  if (!user) {
    throw new AppError(401, 'User not found. Please login again.');
  }

  if (!user.isActive) {
    throw new AppError(403, 'Your account has been deactivated.');
  }

  req.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImage: user.profileImage,
  };

  next();
});

export default authMiddleware;
