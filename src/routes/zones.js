import { Router } from 'express';

export function createZonesRouter(repo) {
  const router = Router();

  router.get('/zones', (req, res, next) => {
    try {
      const zones = repo.getZones();
      res.json(zones);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
