export const VALID_STATUS_TRANSITIONS = {
  SUBMITTED: ['READY'],
  READY: ['SCHEDULED'],
  SCHEDULED: ['COLLECTED', 'UNSUCCESSFUL'],
  COLLECTED: [], // Terminal
  UNSUCCESSFUL: ['READY', 'SCHEDULED'] // Can be re-opened by operator
};

export const RESOLUTION_INSTRUCTIONS = {
  INACCESSIBLE: 'Ensure gate is unlocked, vehicles are moved, or provide clear access instructions for the next scheduled pickup.',
  NOT_PRESENT: 'Place the item at the curbside or declared pickup location by 07:00 AM on the rescheduled collection date.',
  PREP_INCOMPLETE: 'Complete the required preparation checklist (e.g. tape terminals, drain fluids, wrap item) before requesting re-dispatch.',
  INCORRECT_CATEGORY: 'Re-classify your item under the appropriate waste category or request specialized handling.',
  CAPACITY_UNAVAILABLE: 'Truck capacity was exceeded during this collection run. Your request has priority for the next available window in your zone.',
  OTHER: 'Review operator notes and contact municipal dispatch to coordinate collection requirements.'
};

/**
 * Validates whether a proposed status transition is operationally permitted.
 */
export function isValidStatusTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true;
  const allowed = VALID_STATUS_TRANSITIONS[currentStatus];
  return Boolean(allowed && allowed.includes(targetStatus));
}

/**
 * Checks collection readiness for a waste pickup request.
 */
export function evaluateReadiness(category, requiredRules, prepConfirmed) {
  if (!category) {
    return {
      isReady: false,
      error: 'INVALID_CATEGORY',
      message: 'Waste category does not exist or is inactive.'
    };
  }

  // If there are required rules, resident must explicitly confirm preparation
  const hasMandatoryRules = requiredRules && requiredRules.some(r => r.required === 1);
  if (hasMandatoryRules && !prepConfirmed) {
    return {
      isReady: false,
      error: 'PREP_NOT_CONFIRMED',
      message: 'Mandatory safety and preparation rules must be acknowledged before booking.'
    };
  }

  return {
    isReady: true,
    initialStatus: 'READY'
  };
}

/**
 * Gets the resolution instruction for an exception reason code.
 */
export function getResolutionInstruction(reasonCode) {
  return RESOLUTION_INSTRUCTIONS[reasonCode] || RESOLUTION_INSTRUCTIONS.OTHER;
}
