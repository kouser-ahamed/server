import { Server } from 'http';
import app from './app';
import { env } from './config/env';
import { prisma } from './lib/prisma';

let server: Server;

const startServer = async () => {
  try {
    await prisma.$connect();
    console.log('✅ Connected to database');

    server = app.listen(env.PORT, () => {
      console.log(`🚀 Wheelio server is running on http://localhost:${env.PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
};

startServer();

const shutdown = (signal: string) => {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
