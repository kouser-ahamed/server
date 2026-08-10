import { NextFunction, Request, Response } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { env } from '../config/env';
import AppError from '../utils/AppError';
import catchAsync from '../utils/catchAsync';

export interface JWTPayload extends JwtPayload {
  userId: string;
  role: string;
  email: string;
}

export interface AuthUser {
  id: string;
  role: string;
  email: string;
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

  req.user = {
    id: decoded.userId,
    role: decoded.role,
    email: decoded.email,
  };

  next();
});

export default authMiddleware;
