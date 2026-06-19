import { config } from './config/env';
import { connectDatabase, disconnectDatabase } from './config/database';
import { getRedisClient, disconnectRedis } from './redis/client';
import app from './app';

// ─────────────────────────────────────────────
// Bootstrap Function
// ─────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  // 1. Connect to MongoDB
  await connectDatabase();

  // 2. Initialize Redis client (triggers connection)
  getRedisClient();

  // 3. Start HTTP server
  const server = app.listen(config.server.port, () => {
    console.log(
      `[Server] Running in ${config.server.nodeEnv} mode on port ${config.server.port}`
    );
    console.log(`[Server] Health check: http://localhost:${config.server.port}/health`);
    console.log(`[Server] API base URL: http://localhost:${config.server.port}/api`);
  });

  // ─────────────────────────────────────────────
  // Graceful Shutdown
  // Ensures in-flight requests complete before closing connections
  // ─────────────────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Server] ${signal} received. Starting graceful shutdown...`);

    server.close(async () => {
      console.log('[Server] HTTP server closed');

      try {
        await disconnectDatabase();
        await disconnectRedis();
        console.log('[Server] All connections closed. Exiting.');
        process.exit(0);
      } catch (err) {
        console.error('[Server] Error during shutdown:', err);
        process.exit(1);
      }
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: unknown) => {
    console.error('[Server] Unhandled promise rejection:', reason);
    shutdown('unhandledRejection').catch(() => process.exit(1));
  });
}

// ─────────────────────────────────────────────
// Start the server
// ─────────────────────────────────────────────
bootstrap().catch((err: Error) => {
  console.error('[Server] Failed to start:', err.message);
  process.exit(1);
});
