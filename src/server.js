import { config } from './config.js';
import { getDatabase, closeDatabase } from './db/index.js';
import { seedDatabase } from './db/seed.js';
import { WasteWiseRepository } from './db/repository.js';
import { createApp } from './app.js';
import { logger } from './utils/logger.js';

// 1. Initialize Database & Run Idempotent Seed
const db = getDatabase(config.databasePath);
seedDatabase(db);

// 2. Initialize Repository and Application
const repo = new WasteWiseRepository(db);
const app = createApp(repo);

// 3. Start Server on 0.0.0.0 and PORT
const server = app.listen(config.port, config.host, () => {
  logger.info(`WasteWise server listening on http://${config.host}:${config.port}`, {
    port: config.port,
    env: config.nodeEnv,
    adminKeyConfigured: Boolean(config.adminKey)
  });
});

// 4. Graceful Shutdown
function handleShutdown(signal) {
  logger.info(`Received ${signal}, initiating graceful shutdown...`);
  server.close(() => {
    logger.info('HTTP server closed');
    closeDatabase();
    process.exit(0);
  });

  // Force shutdown after 10s if connections linger
  setTimeout(() => {
    logger.error('Forceful shutdown triggered after timeout');
    process.exit(1);
  }, 10000).unref();
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));
