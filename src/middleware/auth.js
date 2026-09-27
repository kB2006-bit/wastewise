import { config } from '../config.js';
import { logger } from '../utils/logger.js';

/**
 * Middleware enforcing x-admin-key authentication on administrative routes.
 * Never hardcodes the key; validates against process.env.ADMIN_KEY via config.
 */
export function requireAdminKey(req, res, next) {
  const configuredKey = config.adminKey;

  // If no admin key configured in environment, fail securely
  if (!configuredKey) {
    logger.warn('Admin route accessed, but ADMIN_KEY is not configured in environment');
    return res.status(500).json({
      error: 'SERVER_CONFIGURATION_ERROR',
      message: 'Administrative authentication is not configured on this server.'
    });
  }

  const providedKey = req.headers['x-admin-key'];

  if (!providedKey || providedKey !== configuredKey) {
    logger.warn('Unauthorized admin access attempt', { ip: req.ip, path: req.originalUrl });
    return res.status(401).json({
      error: 'UNAUTHORIZED',
      message: 'Invalid or missing x-admin-key header.'
    });
  }

  next();
}
