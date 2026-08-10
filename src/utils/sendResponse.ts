import { Response } from 'express';

interface TMeta {
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
}

interface TSuccessResponse<T> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T;
  meta?: TMeta;
}

const sendResponse = <T>(res: Response, payload: TSuccessResponse<T>) => {
  const response: Record<string, unknown> = {
    success: payload.success,
    message: payload.message,
    data: payload.data,
  };

  if (payload.meta) {
    response.meta = payload.meta;
  }

  res.status(payload.statusCode).json(response);
};

export default sendResponse;
