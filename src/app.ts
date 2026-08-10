import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env';
import routes from './routes';
import notFoundMiddleware from './middlewares/notFound.middleware';
import errorMiddleware from './middlewares/error.middleware';
import sendResponse from './utils/sendResponse';

const app: Application = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

// IMPORTANT: The Stripe webhook route MUST be mounted with express.raw({ type: 'application/json' })
// BEFORE express.json(). Stripe signs the raw request body, so if express.json() parses it first
// the body will be an object (not a Buffer) and signature verification will fail.
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  sendResponse(res, {
    success: true,
    statusCode: 200,
    message: 'Wheelio server is running',
    data: { uptime: process.uptime(), timestamp: new Date().toISOString() },
  });
});

app.use('/api', routes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

export default app;
