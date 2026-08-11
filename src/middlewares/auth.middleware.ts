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

const resolveUserFromRequest = (req: Request): AuthUser | undefined => {
  const token = getTokenFromRequest(req);
  if (!token) {
    return undefined;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JWTPayload;
    return {
      id: decoded.userId,
      role: decoded.role,
      email: decoded.email,
    };
  } catch {
    return undefined;
  }
};

const authMiddleware = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const user = resolveUserFromRequest(req);

  if (!user) {
    throw new AppError(401, 'You are not authorized. Please login.');
  }

  req.user = user;

  next();
});

// Attaches the user when a valid token is present, but never rejects the
// request. Used on public read endpoints that enrich their payload with the
// current user's own state (e.g. the logged-in customer's reaction on a review).
const optionalAuthMiddleware = (req: Request, _res: Response, next: NextFunction) => {
  req.user = resolveUserFromRequest(req);
  next();
};

export default authMiddleware;
export { optionalAuthMiddleware };
