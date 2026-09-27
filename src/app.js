import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHealthRouter } from './routes/health.js';
import { createCategoriesRouter } from './routes/categories.js';
import { createZonesRouter } from './routes/zones.js';
import { createWindowsRouter } from './routes/windows.js';
import { createRequestsRouter } from './routes/requests.js';
import { createTrackingRouter } from './routes/tracking.js';
import { createAdminRouter } from './routes/admin.js';
import { errorHandler } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(repo) {
  const app = express();

  // Basic security and parsing middlewares
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: false, limit: '100kb' }));

  // Root health probe for Cloud Run compatibility
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'wastewise',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API routers
  app.use('/api', createHealthRouter());
  app.use('/api', createCategoriesRouter(repo));
  app.use('/api', createZonesRouter(repo));
  app.use('/api', createWindowsRouter(repo));
  app.use('/api', createRequestsRouter(repo));
  app.use('/api', createTrackingRouter(repo));
  app.use('/api', createAdminRouter(repo));

  // Serve static public assets
  const publicDir = path.resolve(__dirname, '../public');
  app.use(express.static(publicDir));

  // Handle unhandled API routes with 404
  app.use('/api', (req, res) => {
    res.status(404).json({
      error: 'ENDPOINT_NOT_FOUND',
      message: `Cannot ${req.method} ${req.originalUrl}`
    });
  });

  // Fallback for HTML page navigation
  app.get('/track', (req, res) => {
    res.sendFile(path.join(publicDir, 'track.html'));
  });

  app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin.html'));
  });

  // Global safe error handler
  app.use(errorHandler);

  return app;
}
