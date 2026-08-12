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

// COOP must be `same-origin-allow-popups` (not helmet's default `same-origin`) so the
// Google account-chooser popup opened from the frontend can postMessage its credential
// back to the parent window. Only the COOP directive is customized; all other helmet
// security defaults (CSP, X-Frame-Options, HSTS, etc.) are left untouched.
app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  })
);
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
