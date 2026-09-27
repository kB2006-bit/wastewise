import { Router } from 'express';

export function createTrackingRouter(repo) {
  const router = Router();

  router.get('/track/:trackingCode', (req, res, next) => {
    try {
      const { trackingCode } = req.params;

      if (!trackingCode || typeof trackingCode !== 'string') {
        return res.status(400).json({
          error: 'INVALID_TRACKING_CODE',
          message: 'Tracking code is required.'
        });
      }

      const cleanCode = trackingCode.trim().toUpperCase();
      const request = repo.getPickupRequestByTrackingCode(cleanCode);

      if (!request) {
        return res.status(404).json({
          error: 'REQUEST_NOT_FOUND',
          message: `No waste pickup request found matching tracking code '${cleanCode}'.`
        });
      }

      res.json(request);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
