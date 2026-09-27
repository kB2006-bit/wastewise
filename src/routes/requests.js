import { Router } from 'express';
import { validateCreateRequest } from '../middleware/validate.js';
import { evaluateReadiness } from '../services/readiness.js';
import { validateScheduling } from '../services/scheduling.js';
import { generateTrackingCode } from '../utils/trackingCode.js';
import { logger } from '../utils/logger.js';

export function createRequestsRouter(repo) {
  const router = Router();

  router.post('/requests', validateCreateRequest, (req, res, next) => {
    try {
      const data = req.cleanBody;

      // 1. Verify Category & Readiness Rules
      const category = repo.getCategoryById(data.category_id);
      const readiness = evaluateReadiness(category, category?.rules, data.prep_confirmed);
      if (!readiness.isReady) {
        return res.status(400).json({
          error: readiness.error,
          message: readiness.message
        });
      }

      // 2. Verify Zone & Scheduling Capacity
      const zone = repo.getZoneById(data.zone_id);
      const window = repo.getWindowById(data.requested_window_id);
      const scheduling = validateScheduling(zone, window);
      if (!scheduling.isValid) {
        const statusCode = scheduling.error === 'CAPACITY_EXHAUSTED' ? 409 : 400;
        return res.status(statusCode).json({
          error: scheduling.error,
          message: scheduling.message
        });
      }

      // 3. Generate Request ID and Unpredictable Tracking Code
      const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const trackingCode = generateTrackingCode();

      // 4. Save Request via Repository (enforces atomic capacity lock)
      const newRequest = repo.createPickupRequest({
        id,
        tracking_code: trackingCode,
        category_id: data.category_id,
        item_description: data.item_description,
        quantity: data.quantity,
        zone_id: data.zone_id,
        address: data.address,
        access_notes: data.access_notes,
        prep_confirmed: true,
        requested_window_id: data.requested_window_id,
        status: 'READY' // Acknowledged prep rules + reserved slot = collection-ready
      });

      logger.info('Pickup request created successfully', {
        id: newRequest.id,
        tracking_code: newRequest.tracking_code,
        category: category.name,
        zone: zone.name,
        collection_date: newRequest.collection_date
      });

      res.status(201).json({
        id: newRequest.id,
        tracking_code: newRequest.tracking_code,
        status: newRequest.status,
        category_name: newRequest.category_name,
        item_description: newRequest.item_description,
        quantity: newRequest.quantity,
        zone_name: newRequest.zone_name,
        collection_date: newRequest.collection_date,
        collection_window: `${newRequest.window_start} - ${newRequest.window_end}`,
        prep_reminder: category.rules.map(r => r.instruction),
        created_at: newRequest.created_at
      });
    } catch (err) {
      if (err.message === 'CAPACITY_EXCEEDED') {
        return res.status(409).json({
          error: 'CAPACITY_EXCEEDED',
          message: 'The selected collection window capacity has been reached. Please select another slot.'
        });
      }
      next(err);
    }
  });

  return router;
}
