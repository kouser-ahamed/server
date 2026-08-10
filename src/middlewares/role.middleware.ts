import { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import AppError from '../utils/AppError';

const authorizeRoles = (...allowedRoles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      throw new AppError(401, 'You are not authorized. Please login.');
    }

    if (!allowedRoles.includes(user.role as UserRole)) {
      throw new AppError(403, `Access denied. Required role(s): ${allowedRoles.join(', ')}.`);
    }

    next();
  };
};

export default authorizeRoles;
