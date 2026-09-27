import { Router } from 'express';

export function createWindowsRouter(repo) {
  const router = Router();

  router.get('/windows', (req, res, next) => {
    try {
      const { zoneId } = req.query;

      if (!zoneId) {
        return res.status(400).json({
          error: 'MISSING_ZONE_ID',
          message: 'Query parameter zoneId is required.'
        });
      }

      const zone = repo.getZoneById(zoneId);
      if (!zone) {
        return res.status(404).json({
          error: 'ZONE_NOT_FOUND',
          message: `Zone with ID '${zoneId}' not found.`
        });
      }

      const windows = repo.getWindowsByZoneId(zoneId);
      res.json(windows);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
