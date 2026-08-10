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
import { PaymentController } from './services/payment/payment.controller';

const app: Application = express();

// IMPORTANT: The Stripe webhook MUST be registered as the very first route, using
// express.raw({ type: 'application/json' }) so signature verification runs against the
// untouched raw body. It must come BEFORE any app.use(express.json()) or body-parsing
// middleware, which would otherwise consume the raw body before constructEvent sees it.
app.post('/api/payments/webhook', express.raw({ type: 'application/json' }), PaymentController.handleWebhook);

app.use(helmet());
app.use(
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
  })
);

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
