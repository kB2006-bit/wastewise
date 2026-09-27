export function validateCreateRequest(req, res, next) {
  const {
    category_id,
    item_description,
    quantity,
    zone_id,
    address,
    access_notes,
    prep_confirmed,
    requested_window_id
  } = req.body || {};

  const errors = [];

  if (!category_id || typeof category_id !== 'string' || !category_id.trim()) {
    errors.push('category_id is required');
  }

  if (!item_description || typeof item_description !== 'string' || item_description.trim().length < 3) {
    errors.push('item_description is required (minimum 3 characters)');
  } else if (item_description.length > 200) {
    errors.push('item_description cannot exceed 200 characters');
  }

  if (quantity !== undefined) {
    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1 || q > 50) {
      errors.push('quantity must be an integer between 1 and 50');
    }
  }

  if (!zone_id || typeof zone_id !== 'string' || !zone_id.trim()) {
    errors.push('zone_id is required');
  }

  if (!address || typeof address !== 'string' || address.trim().length < 5) {
    errors.push('address is required (minimum 5 characters)');
  } else if (address.length > 250) {
    errors.push('address cannot exceed 250 characters');
  }

  if (access_notes && (typeof access_notes !== 'string' || access_notes.length > 500)) {
    errors.push('access_notes cannot exceed 500 characters');
  }

  if (!requested_window_id || typeof requested_window_id !== 'string' || !requested_window_id.trim()) {
    errors.push('requested_window_id is required');
  }

  if (prep_confirmed !== true && prep_confirmed !== 1 && prep_confirmed !== 'true') {
    errors.push('prep_confirmed must be explicitly confirmed as true');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'VALIDATION_FAILED',
      message: 'Invalid request payload',
      details: errors
    });
  }

  // Sanitize payload on req.cleanBody
  req.cleanBody = {
    category_id: category_id.trim(),
    item_description: item_description.trim(),
    quantity: quantity ? parseInt(quantity, 10) : 1,
    zone_id: zone_id.trim(),
    address: address.trim(),
    access_notes: access_notes ? access_notes.trim() : '',
    prep_confirmed: true,
    requested_window_id: requested_window_id.trim()
  };

  next();
}

export function validateUpdateStatus(req, res, next) {
  const { status } = req.body || {};
  const validStatuses = ['SUBMITTED', 'READY', 'SCHEDULED', 'COLLECTED', 'UNSUCCESSFUL'];

  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'INVALID_STATUS',
      message: `Status must be one of: ${validStatuses.join(', ')}`
    });
  }

  req.cleanStatus = status;
  next();
}

export function validateCreateException(req, res, next) {
  const { reason_code, operator_note } = req.body || {};
  const validReasons = [
    'INACCESSIBLE',
    'NOT_PRESENT',
    'PREP_INCOMPLETE',
    'INCORRECT_CATEGORY',
    'CAPACITY_UNAVAILABLE',
    'OTHER'
  ];

  if (!reason_code || !validReasons.includes(reason_code)) {
    return res.status(400).json({
      error: 'INVALID_REASON_CODE',
      message: `reason_code must be one of: ${validReasons.join(', ')}`
    });
  }

  if (operator_note && (typeof operator_note !== 'string' || operator_note.length > 500)) {
    return res.status(400).json({
      error: 'INVALID_OPERATOR_NOTE',
      message: 'operator_note cannot exceed 500 characters'
    });
  }

  req.cleanException = {
    reason_code,
    operator_note: operator_note ? operator_note.trim() : ''
  };

  next();
}
