import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  logger.error('Unhandled application error', {
    error: err.message,
    path: req.originalUrl,
    method: req.method
  });

  // Handle malformed JSON body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'MALFORMED_JSON',
      message: 'The request payload contains malformed JSON syntax.'
    });
  }

  // Handle custom known errors
  if (err.message === 'CAPACITY_EXCEEDED') {
    return res.status(409).json({
      error: 'CAPACITY_EXCEEDED',
      message: 'The selected collection window capacity has been reached. Please select another slot.'
    });
  }

  if (err.message === 'WINDOW_NOT_FOUND') {
    return res.status(404).json({
      error: 'WINDOW_NOT_FOUND',
      message: 'The requested collection window was not found.'
    });
  }

  // Generic safe 500 error - never leak stack traces
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected internal error occurred while processing the request.'
  });
}
