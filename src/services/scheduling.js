/**
 * Validates scheduling constraints for a pickup request.
 */
export function validateScheduling(zone, window) {
  if (!zone) {
    return {
      isValid: false,
      error: 'INVALID_ZONE',
      message: 'Collection zone does not exist or is inactive.'
    };
  }

  if (!window) {
    return {
      isValid: false,
      error: 'INVALID_WINDOW',
      message: 'Collection window does not exist or is inactive.'
    };
  }

  if (window.zone_id !== zone.id) {
    return {
      isValid: false,
      error: 'WINDOW_ZONE_MISMATCH',
      message: 'The selected collection window does not belong to the selected zone.'
    };
  }

  if (window.available_slots <= 0) {
    return {
      isValid: false,
      error: 'CAPACITY_EXHAUSTED',
      message: 'The selected collection window has reached its maximum vehicle capacity.'
    };
  }

  return {
    isValid: true
  };
}
