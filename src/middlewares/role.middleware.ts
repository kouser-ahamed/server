import { NextFunction, Request, Response } from 'express';
import AppError from '../utils/AppError';

const roleMiddleware = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      throw new AppError(401, 'You are not authorized. Please login.');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AppError(403, `Access denied. Required role(s): ${allowedRoles.join(', ')}.`);
    }

    next();
  };
};

export default roleMiddleware;
