import { Router } from 'express';
import { requireAdminKey } from '../middleware/auth.js';
import { validateUpdateStatus, validateCreateException } from '../middleware/validate.js';
import { isValidStatusTransition, getResolutionInstruction } from '../services/readiness.js';
import { logger } from '../utils/logger.js';

export function createAdminRouter(repo) {
  const router = Router();

  // Protect all admin endpoints with x-admin-key middleware
  router.use(requireAdminKey);

  // 1. List requests with operational filters
  router.get('/admin/requests', (req, res, next) => {
    try {
      const { status, zone_id, category_id, window_id } = req.query;
      const filters = {};

      if (status) filters.status = String(status).trim();
      if (zone_id) filters.zone_id = String(zone_id).trim();
      if (category_id) filters.category_id = String(category_id).trim();
      if (window_id) filters.window_id = String(window_id).trim();

      const requests = repo.listRequests(filters);
      res.json(requests);
    } catch (err) {
      next(err);
    }
  });

  // 2. Real-time aggregated database statistics
  router.get('/admin/stats', (req, res, next) => {
    try {
      const stats = repo.getStats();
      res.json(stats);
    } catch (err) {
      next(err);
    }
  });

  // 3. Update request status with state-machine transition validation
  router.patch('/admin/requests/:id/status', validateUpdateStatus, (req, res, next) => {
    try {
      const { id } = req.params;
      const targetStatus = req.cleanStatus;

      const current = repo.getPickupRequestById(id);
      if (!current) {
        return res.status(404).json({
          error: 'REQUEST_NOT_FOUND',
          message: `Pickup request '${id}' not found.`
        });
      }

      // Check operational state machine transition rules
      if (!isValidStatusTransition(current.status, targetStatus)) {
        return res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: `Illegal transition from '${current.status}' to '${targetStatus}'.`
        });
      }

      const updated = repo.updateRequestStatus(id, targetStatus);
      logger.info('Request status updated', {
        id,
        from: current.status,
        to: targetStatus
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  // 4. Mark request UNSUCCESSFUL and record exception details
  router.post('/admin/requests/:id/exception', validateCreateException, (req, res, next) => {
    try {
      const { id } = req.params;
      const { reason_code, operator_note } = req.cleanException;

      const current = repo.getPickupRequestById(id);
      if (!current) {
        return res.status(404).json({
          error: 'REQUEST_NOT_FOUND',
          message: `Pickup request '${id}' not found.`
        });
      }

      // Only requests in SCHEDULED (or READY) can be marked UNSUCCESSFUL
      if (current.status === 'COLLECTED') {
        return res.status(400).json({
          error: 'INVALID_STATUS_TRANSITION',
          message: 'Cannot record exception on an already COLLECTED request.'
        });
      }

      const resolutionInstruction = getResolutionInstruction(reason_code);
      const updated = repo.createExceptionRecord(
        id,
        reason_code,
        operator_note,
        resolutionInstruction
      );

      logger.info('Collection exception recorded', {
        id,
        reason_code,
        previous_status: current.status
      });

      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
