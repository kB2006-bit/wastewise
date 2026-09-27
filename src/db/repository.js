import { getDatabase } from './index.js';

export class WasteWiseRepository {
  constructor(db = getDatabase()) {
    this.db = db;
  }

  // --- Categories & Prep Rules ---
  getCategories() {
    const cats = this.db.prepare(`
      SELECT id, name, description, active
      FROM categories
      WHERE active = 1
      ORDER BY name ASC
    `).all();

    const getRules = this.db.prepare(`
      SELECT id, category_id, instruction, required
      FROM prep_rules
      WHERE category_id = ?
      ORDER BY required DESC, id ASC
    `);

    return cats.map(cat => ({
      ...cat,
      rules: getRules.all(cat.id)
    }));
  }

  getCategoryById(id) {
    const cat = this.db.prepare(`
      SELECT id, name, description, active
      FROM categories
      WHERE id = ? AND active = 1
    `).get(id);

    if (!cat) return null;

    cat.rules = this.db.prepare(`
      SELECT id, category_id, instruction, required
      FROM prep_rules
      WHERE category_id = ?
      ORDER BY required DESC, id ASC
    `).all(cat.id);

    return cat;
  }

  getPrepRulesByCategoryId(categoryId) {
    return this.db.prepare(`
      SELECT id, category_id, instruction, required
      FROM prep_rules
      WHERE category_id = ?
      ORDER BY required DESC, id ASC
    `).all(categoryId);
  }

  // --- Zones ---
  getZones() {
    return this.db.prepare(`
      SELECT id, name, description, active
      FROM zones
      WHERE active = 1
      ORDER BY name ASC
    `).all();
  }

  getZoneById(id) {
    return this.db.prepare(`
      SELECT id, name, description, active
      FROM zones
      WHERE id = ? AND active = 1
    `).get(id);
  }

  // --- Collection Windows ---
  getWindowsByZoneId(zoneId) {
    // Calculates booked count for active states (SUBMITTED, READY, SCHEDULED)
    // Collected requests do not count against current capacity.
    const stmt = this.db.prepare(`
      SELECT 
        w.id,
        w.zone_id,
        w.collection_date,
        w.start_time,
        w.end_time,
        w.capacity,
        w.active,
        COUNT(CASE WHEN r.status IN ('SUBMITTED', 'READY', 'SCHEDULED') THEN 1 END) as booked_count
      FROM collection_windows w
      LEFT JOIN pickup_requests r ON w.id = r.requested_window_id
      WHERE w.zone_id = ? AND w.active = 1
      GROUP BY w.id
      ORDER BY w.collection_date ASC, w.start_time ASC
    `);

    const windows = stmt.all(zoneId);
    return windows.map(w => {
      const booked = Number(w.booked_count || 0);
      const cap = Number(w.capacity);
      const available = Math.max(0, cap - booked);
      return {
        id: w.id,
        zone_id: w.zone_id,
        collection_date: w.collection_date,
        start_time: w.start_time,
        end_time: w.end_time,
        capacity: cap,
        booked_count: booked,
        available_slots: available,
        is_available: available > 0
      };
    });
  }

  getWindowById(id) {
    const stmt = this.db.prepare(`
      SELECT 
        w.id,
        w.zone_id,
        w.collection_date,
        w.start_time,
        w.end_time,
        w.capacity,
        w.active,
        COUNT(CASE WHEN r.status IN ('SUBMITTED', 'READY', 'SCHEDULED') THEN 1 END) as booked_count
      FROM collection_windows w
      LEFT JOIN pickup_requests r ON w.id = r.requested_window_id
      WHERE w.id = ?
      GROUP BY w.id
    `);

    const w = stmt.get(id);
    if (!w) return null;

    const booked = Number(w.booked_count || 0);
    const cap = Number(w.capacity);
    const available = Math.max(0, cap - booked);

    return {
      id: w.id,
      zone_id: w.zone_id,
      collection_date: w.collection_date,
      start_time: w.start_time,
      end_time: w.end_time,
      capacity: cap,
      booked_count: booked,
      available_slots: available,
      is_available: available > 0
    };
  }

  // --- Pickup Requests ---
  createPickupRequest(data) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      // Re-verify window capacity atomically
      const windowStmt = this.db.prepare(`
        SELECT 
          w.capacity,
          COUNT(CASE WHEN r.status IN ('SUBMITTED', 'READY', 'SCHEDULED') THEN 1 END) as booked_count
        FROM collection_windows w
        LEFT JOIN pickup_requests r ON w.id = r.requested_window_id
        WHERE w.id = ?
        GROUP BY w.id
      `);

      const win = windowStmt.get(data.requested_window_id);
      if (!win) {
        throw new Error('WINDOW_NOT_FOUND');
      }

      const booked = Number(win.booked_count || 0);
      const cap = Number(win.capacity);
      if (booked >= cap) {
        throw new Error('CAPACITY_EXCEEDED');
      }

      const now = new Date().toISOString();
      const insert = this.db.prepare(`
        INSERT INTO pickup_requests (
          id, tracking_code, category_id, item_description, quantity,
          zone_id, address, access_notes, prep_confirmed, requested_window_id,
          status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      insert.run(
        data.id,
        data.tracking_code,
        data.category_id,
        data.item_description,
        data.quantity || 1,
        data.zone_id,
        data.address,
        data.access_notes || '',
        data.prep_confirmed ? 1 : 0,
        data.requested_window_id,
        data.status || 'READY',
        now,
        now
      );

      this.db.exec('COMMIT;');
      return this.getPickupRequestById(data.id);
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getPickupRequestById(id) {
    const req = this.db.prepare(`
      SELECT 
        r.*,
        c.name as category_name,
        z.name as zone_name,
        w.collection_date,
        w.start_time as window_start,
        w.end_time as window_end
      FROM pickup_requests r
      JOIN categories c ON r.category_id = c.id
      JOIN zones z ON r.zone_id = z.id
      JOIN collection_windows w ON r.requested_window_id = w.id
      WHERE r.id = ?
    `).get(id);

    if (!req) return null;

    req.exception = this.db.prepare(`
      SELECT id, reason_code, operator_note, resolution_instruction, created_at
      FROM exception_records
      WHERE pickup_request_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(id);

    return req;
  }

  getPickupRequestByTrackingCode(trackingCode) {
    const req = this.db.prepare(`
      SELECT 
        r.id,
        r.tracking_code,
        r.status,
        r.created_at,
        r.item_description,
        r.quantity,
        r.prep_confirmed,
        c.name as category_name,
        c.id as category_id,
        z.name as zone_name,
        w.collection_date,
        w.start_time as window_start,
        w.end_time as window_end,
        r.address
      FROM pickup_requests r
      JOIN categories c ON r.category_id = c.id
      JOIN zones z ON r.zone_id = z.id
      JOIN collection_windows w ON r.requested_window_id = w.id
      WHERE r.tracking_code = ?
    `).get(trackingCode);

    if (!req) return null;

    // Mask the address for public privacy: e.g. "742 Evergreen Terrace" -> "74* Evergreen Terrace"
    const parts = req.address.split(' ');
    let maskedAddress = req.address;
    if (parts.length > 1) {
      const num = parts[0];
      const maskedNum = num.length > 2 ? num.slice(0, 2) + '*'.repeat(num.length - 2) : '**';
      maskedAddress = `${maskedNum} ${parts.slice(1).join(' ')}`;
    }

    // Include preparation rules for this category so resident has reminder
    const rules = this.getPrepRulesByCategoryId(req.category_id);

    // If status is UNSUCCESSFUL, include exception details
    let exception = null;
    if (req.status === 'UNSUCCESSFUL') {
      exception = this.db.prepare(`
        SELECT reason_code, resolution_instruction, created_at
        FROM exception_records
        WHERE pickup_request_id = ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(req.id);
    }

    return {
      tracking_code: req.tracking_code,
      status: req.status,
      created_at: req.created_at,
      category_name: req.category_name,
      item_description: req.item_description,
      quantity: req.quantity,
      zone_name: req.zone_name,
      collection_date: req.collection_date,
      collection_window: `${req.window_start} - ${req.window_end}`,
      masked_address: maskedAddress,
      prep_confirmed: Boolean(req.prep_confirmed),
      prep_rules: rules.map(r => r.instruction),
      exception: exception || null
    };
  }

  // --- Admin Queries ---
  listRequests(filters = {}) {
    let sql = `
      SELECT 
        r.id,
        r.tracking_code,
        r.category_id,
        c.name as category_name,
        r.item_description,
        r.quantity,
        r.zone_id,
        z.name as zone_name,
        r.address,
        r.access_notes,
        r.prep_confirmed,
        r.requested_window_id,
        w.collection_date,
        w.start_time as window_start,
        w.end_time as window_end,
        r.status,
        r.created_at,
        r.updated_at,
        e.reason_code as exception_reason,
        e.operator_note as exception_operator_note,
        e.resolution_instruction as exception_resolution
      FROM pickup_requests r
      JOIN categories c ON r.category_id = c.id
      JOIN zones z ON r.zone_id = z.id
      JOIN collection_windows w ON r.requested_window_id = w.id
      LEFT JOIN exception_records e ON r.id = e.pickup_request_id
      WHERE 1=1
    `;

    const params = [];

    if (filters.status) {
      sql += ' AND r.status = ?';
      params.push(filters.status);
    }
    if (filters.zone_id) {
      sql += ' AND r.zone_id = ?';
      params.push(filters.zone_id);
    }
    if (filters.category_id) {
      sql += ' AND r.category_id = ?';
      params.push(filters.category_id);
    }
    if (filters.window_id) {
      sql += ' AND r.requested_window_id = ?';
      params.push(filters.window_id);
    }

    sql += ' ORDER BY r.created_at DESC';

    return this.db.prepare(sql).all(...params);
  }

  updateRequestStatus(id, newStatus) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE pickup_requests
      SET status = ?, updated_at = ?
      WHERE id = ?
    `).run(newStatus, now, id);

    if (result.changes === 0) {
      return null;
    }
    return this.getPickupRequestById(id);
  }

  createExceptionRecord(requestId, reasonCode, operatorNote, resolutionInstruction) {
    this.db.exec('BEGIN IMMEDIATE TRANSACTION;');

    try {
      const now = new Date().toISOString();
      const expId = `exp-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

      // Insert exception record
      this.db.prepare(`
        INSERT INTO exception_records (
          id, pickup_request_id, reason_code, operator_note, resolution_instruction, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
      `).run(expId, requestId, reasonCode, operatorNote || '', resolutionInstruction, now);

      // Transition request status to UNSUCCESSFUL
      this.db.prepare(`
        UPDATE pickup_requests
        SET status = 'UNSUCCESSFUL', updated_at = ?
        WHERE id = ?
      `).run(now, requestId);

      this.db.exec('COMMIT;');
      return this.getPickupRequestById(requestId);
    } catch (err) {
      this.db.exec('ROLLBACK;');
      throw err;
    }
  }

  getStats() {
    const counts = this.db.prepare(`
      SELECT 
        COUNT(*) as total_all,
        COUNT(CASE WHEN status IN ('SUBMITTED', 'READY', 'SCHEDULED') THEN 1 END) as total_active,
        COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as submitted,
        COUNT(CASE WHEN status = 'READY' THEN 1 END) as ready,
        COUNT(CASE WHEN status = 'SCHEDULED' THEN 1 END) as scheduled,
        COUNT(CASE WHEN status = 'COLLECTED' THEN 1 END) as collected,
        COUNT(CASE WHEN status = 'UNSUCCESSFUL' THEN 1 END) as unsuccessful
      FROM pickup_requests
    `).get();

    const byZone = this.db.prepare(`
      SELECT z.id, z.name, COUNT(r.id) as request_count
      FROM zones z
      LEFT JOIN pickup_requests r ON z.id = r.zone_id
      GROUP BY z.id
    `).all();

    const byCategory = this.db.prepare(`
      SELECT c.id, c.name, COUNT(r.id) as request_count
      FROM categories c
      LEFT JOIN pickup_requests r ON c.id = r.category_id
      GROUP BY c.id
    `).all();

    const exceptionsByReason = this.db.prepare(`
      SELECT reason_code, COUNT(*) as count
      FROM exception_records
      GROUP BY reason_code
    `).all();

    return {
      total_all: Number(counts.total_all || 0),
      total_active: Number(counts.total_active || 0),
      submitted: Number(counts.submitted || 0),
      ready: Number(counts.ready || 0),
      scheduled: Number(counts.scheduled || 0),
      collected: Number(counts.collected || 0),
      unsuccessful: Number(counts.unsuccessful || 0),
      by_zone: byZone,
      by_category: byCategory,
      exceptions_by_reason: exceptionsByReason
    };
  }
}
