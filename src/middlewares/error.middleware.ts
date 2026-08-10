import { NextFunction, Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import AppError from '../utils/AppError';

const errorMiddleware = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500;
  let message = 'Something went wrong on the server.';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof ZodError) {
    statusCode = 400;
    message = 'Validation error.';
  } else if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      statusCode = 409;
      message = 'Duplicate entry: a record with this value already exists.';
    } else if (err.code === 'P2025') {
      statusCode = 404;
      message = 'Record not found.';
    } else {
      message = 'Database error.';
    }
  } else if (err instanceof Error) {
    message = err.message;
  }

  if (statusCode === 500) {
    console.error('💥 Unhandled error:', err);
  }

  const response: Record<string, unknown> = {
    success: false,
    message,
    data: null,
    statusCode,
  };

  if (err instanceof ZodError) {
    response.errors = err.errors;
  }

  res.status(statusCode).json(response);
};

export default errorMiddleware;
