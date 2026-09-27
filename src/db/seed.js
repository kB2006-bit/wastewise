import { logger } from '../utils/logger.js';

export function seedDatabase(db) {
  // Check if categories already seeded
  const existingCat = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (existingCat && existingCat.count > 0) {
    logger.info('Database already contains seed data, skipping');
    return;
  }

  logger.info('Seeding database with deterministic operational data...');

  // Helper for dynamic future dates (YYYY-MM-DD)
  const getFutureDate = (daysAhead) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().split('T')[0];
  };

  // Begin Transaction
  db.exec('BEGIN TRANSACTION;');

  try {
    // 1. Insert Categories
    const insertCat = db.prepare(`
      INSERT INTO categories (id, name, description, active)
      VALUES (?, ?, ?, 1)
    `);
    insertCat.run('cat-ewaste', 'Electronic Waste (E-Waste)', 'Computers, televisions, circuit boards, batteries, and consumer electronics.');
    insertCat.run('cat-bulky', 'Bulky Household Item', 'Furniture, mattresses, large tables, and disassembled cabinetry.');
    insertCat.run('cat-recyclable', 'Dry Recyclable Material', 'Clean cardboard bundles, bulk plastics, and scrap aluminum.');
    insertCat.run('cat-organic', 'Organic & Yard Waste', 'Tree limbs, yard trimmings, untreated garden waste, and landscape debris.');

    // 2. Insert Preparation Rules
    const insertRule = db.prepare(`
      INSERT INTO prep_rules (id, category_id, instruction, required)
      VALUES (?, ?, ?, ?)
    `);
    // E-Waste
    insertRule.run('rule-ew-1', 'cat-ewaste', 'Tape all exposed battery terminals with non-conductive electrical tape.', 1);
    insertRule.run('rule-ew-2', 'cat-ewaste', 'Remove all ink/toner cartridges and package them in sealed bags.', 1);
    insertRule.run('rule-ew-3', 'cat-ewaste', 'Coil and securely bundle all detached power cables and wires.', 0);
    // Bulky
    insertRule.run('rule-bk-1', 'cat-bulky', 'Wrap mattresses and upholstered couches in plastic protective sheeting.', 1);
    insertRule.run('rule-bk-2', 'cat-bulky', 'Remove or hammer flat any protruding nails, sharp brackets, or glass panels.', 1);
    insertRule.run('rule-bk-3', 'cat-bulky', 'Disassemble multi-piece furniture into units under 70kg / 150lbs for two-person lift.', 1);
    // Dry Recyclable
    insertRule.run('rule-rc-1', 'cat-recyclable', 'Flatten all corrugated cardboard boxes and bind into bundles under 3 feet high.', 1);
    insertRule.run('rule-rc-2', 'cat-recyclable', 'Rinse and dry all rigid plastic/metal containers; zero residual food or liquid.', 1);
    // Organic
    insertRule.run('rule-og-1', 'cat-organic', 'Cut tree limbs to under 4 feet in length and tie securely with hemp twine.', 1);
    insertRule.run('rule-og-2', 'cat-organic', 'Ensure zero treated lumber, painted wood, or synthetic garden plastics are mixed in.', 1);

    // 3. Insert Zones
    const insertZone = db.prepare(`
      INSERT INTO zones (id, name, description, active)
      VALUES (?, ?, ?, 1)
    `);
    insertZone.run('zone-north', 'Sector North (Wards 1-4)', 'Northern residential and civic corridor; Monday & Thursday focus.');
    insertZone.run('zone-south', 'Sector South (Wards 5-8)', 'Southern suburban valley corridor; Tuesday & Friday focus.');
    insertZone.run('zone-east', 'Sector East (Wards 9-12)', 'Eastern waterfront and commercial district; Monday & Thursday focus.');
    insertZone.run('zone-west', 'Sector West (Wards 13-16)', 'Western hills and university district; Tuesday & Friday focus.');

    // 4. Insert Collection Windows
    const insertWin = db.prepare(`
      INSERT INTO collection_windows (id, zone_id, collection_date, start_time, end_time, capacity, active)
      VALUES (?, ?, ?, ?, ?, ?, 1)
    `);
    const d1 = getFutureDate(1);
    const d2 = getFutureDate(2);
    const d3 = getFutureDate(3);
    const d4 = getFutureDate(4);
    const d5 = getFutureDate(5);
    const d7 = getFutureDate(7);

    insertWin.run('win-north-1', 'zone-north', d1, '08:00', '12:00', 5);
    insertWin.run('win-north-2', 'zone-north', d3, '13:00', '17:00', 8);
    insertWin.run('win-south-1', 'zone-south', d1, '13:00', '17:00', 6);
    insertWin.run('win-south-2', 'zone-south', d4, '08:00', '12:00', 10);
    insertWin.run('win-east-1', 'zone-east', d2, '08:00', '12:00', 5);
    insertWin.run('win-east-2', 'zone-east', d5, '13:00', '17:00', 7);
    insertWin.run('win-west-1', 'zone-west', d2, '13:00', '17:00', 4);
    insertWin.run('win-west-2', 'zone-west', d7, '08:00', '12:00', 6);

    // 5. Insert Realistic Demonstrative Requests Across States
    const insertReq = db.prepare(`
      INSERT INTO pickup_requests (
        id, tracking_code, category_id, item_description, quantity,
        zone_id, address, access_notes, prep_confirmed, requested_window_id,
        status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const now = new Date().toISOString();
    // Sample 1: READY
    insertReq.run(
      'req-001', 'TRK-8F2B-9C1D', 'cat-ewaste', '2 Dell desktop monitors and 1 uninterruptible power supply',
      3, 'zone-north', '742 Evergreen Terrace', 'Placed at front porch beside recycling bins',
      1, 'win-north-1', 'READY', now, now
    );

    // Sample 2: SCHEDULED
    insertReq.run(
      'req-002', 'TRK-4A7E-1B8F', 'cat-bulky', 'Queen size mattress and box spring frame',
      2, 'zone-south', '1040 Ocean Boulevard', 'Driveway apron, clearly visible from street',
      1, 'win-south-1', 'SCHEDULED', now, now
    );

    // Sample 3: COLLECTED
    insertReq.run(
      'req-003', 'TRK-3C9D-6E2A', 'cat-recyclable', '8 flattened corrugated appliance boxes bundled with twine',
      1, 'zone-east', '221 Baker Street', 'Placed by curb near mailbox',
      1, 'win-east-1', 'COLLECTED', now, now
    );

    // Sample 4: UNSUCCESSFUL (with ExceptionRecord)
    insertReq.run(
      'req-004', 'TRK-7B1A-5D3C', 'cat-bulky', 'Three-seater reclining living room sofa',
      1, 'zone-west', '42 Wallaby Way', 'Behind side gate on left of house',
      1, 'win-west-1', 'UNSUCCESSFUL', now, now
    );

    const insertExp = db.prepare(`
      INSERT INTO exception_records (
        id, pickup_request_id, reason_code, operator_note, resolution_instruction, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertExp.run(
      'exp-001', 'req-004', 'INACCESSIBLE',
      'Side gate was secured with a padlock. Driver was unable to access property safely.',
      'Ensure gate is unlocked, vehicles are moved, or provide clear access instructions for the next scheduled pickup.',
      now
    );

    db.exec('COMMIT;');
    logger.info('Database seeding completed successfully');
  } catch (err) {
    db.exec('ROLLBACK;');
    logger.error('Failed to seed database', { error: err.message });
    throw err;
  }
}
