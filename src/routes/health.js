import { Router } from 'express';

export function createHealthRouter() {
  const router = Router();

  router.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'wastewise',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime())
    });
  });

  return router;
}
