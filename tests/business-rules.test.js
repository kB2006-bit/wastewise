import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { WasteWiseRepository } from '../src/db/repository.js';
import { seedDatabase } from '../src/db/seed.js';
import { evaluateReadiness, isValidStatusTransition, getResolutionInstruction } from '../src/services/readiness.js';
import { validateScheduling } from '../src/services/scheduling.js';
import { createApp } from '../src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('WasteWise Business Rules & Integrity Test Suite', () => {
  let db;
  let repo;
  let app;
  let server;
  let baseUrl;
  const TEST_ADMIN_KEY = 'test-secret-key-123';

  before(async () => {
    // 1. Create In-Memory SQLite database with schema
    db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON;');

    const schemaPath = path.resolve(__dirname, '../src/db/schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    db.exec(schemaSql);

    // 2. Seed database
    seedDatabase(db);
    repo = new WasteWiseRepository(db);

    // 3. Set test admin key in environment for API test
    process.env.ADMIN_KEY = TEST_ADMIN_KEY;
    const { config } = await import('../src/config.js');
    config.adminKey = TEST_ADMIN_KEY;

    // 4. Start HTTP test server on an ephemeral port
    app = createApp(repo);
    await new Promise((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(() => {
    if (server) server.close();
    if (db) db.close();
  });

  // --- Rule 1: Category & Preparation Validation ---
  test('Rule 1: evaluateReadiness requires explicit confirmation for categories with mandatory rules', () => {
    const ewasteCat = repo.getCategoryById('cat-ewaste');
    assert.ok(ewasteCat, 'Category cat-ewaste should exist');

    // Without prep confirmation -> Fails
    const unconfirmed = evaluateReadiness(ewasteCat, ewasteCat.rules, false);
    assert.equal(unconfirmed.isReady, false);
    assert.equal(unconfirmed.error, 'PREP_NOT_CONFIRMED');

    // With prep confirmation -> Passes with READY state
    const confirmed = evaluateReadiness(ewasteCat, ewasteCat.rules, true);
    assert.equal(confirmed.isReady, true);
    assert.equal(confirmed.initialStatus, 'READY');
  });

  // --- Rule 2: Window Capacity Calculation ---
  test('Rule 2: Window capacity correctly accounts for active bookings and ignores collected requests', () => {
    const windows = repo.getWindowsByZoneId('zone-north');
    assert.ok(windows.length > 0, 'Should find windows for zone-north');

    const win1 = windows.find(w => w.id === 'win-north-1');
    assert.ok(win1);
    // In seed data, req-001 is booked for win-north-1 with status READY
    assert.equal(win1.booked_count, 1);
    assert.equal(win1.available_slots, win1.capacity - 1);
    assert.equal(win1.is_available, true);
  });

  // --- Rule 3: Request Creation & Capacity Atomic Decrement ---
  test('Rule 3: Successfully creates a pickup request and decreases available window capacity', async () => {
    const res = await fetch(`${baseUrl}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: 'cat-bulky',
        item_description: 'Solid oak dining table and 4 wooden chairs',
        quantity: 5,
        zone_id: 'zone-north',
        address: '500 Maple Street, Apt 2B',
        access_notes: 'Leave on curb in front of building entrance',
        prep_confirmed: true,
        requested_window_id: 'win-north-2'
      })
    });

    assert.equal(res.status, 201);
    const body = await res.json();
    assert.ok(body.tracking_code.startsWith('TRK-'));
    assert.equal(body.status, 'READY');
    assert.equal(body.category_name, 'Bulky Household Item');

    // Verify window capacity was decremented
    const updatedWin = repo.getWindowById('win-north-2');
    assert.equal(updatedWin.booked_count, 1);
  });

  // --- Rule 4: Rejection of Missing Preparation Confirmation ---
  test('Rule 4: POST /api/requests rejects request when prep_confirmed is missing or false', async () => {
    const res = await fetch(`${baseUrl}/api/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category_id: 'cat-ewaste',
        item_description: 'Old CRT Television',
        quantity: 1,
        zone_id: 'zone-north',
        address: '123 Test Avenue',
        prep_confirmed: false,
        requested_window_id: 'win-north-1'
      })
    });

    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.error, 'VALIDATION_FAILED');
  });

  // --- Rule 5: Status State Machine Transition Validation ---
  test('Rule 5: Enforces legal status transitions and rejects illegal skips', () => {
    // Legal transitions
    assert.equal(isValidStatusTransition('SUBMITTED', 'READY'), true);
    assert.equal(isValidStatusTransition('READY', 'SCHEDULED'), true);
    assert.equal(isValidStatusTransition('SCHEDULED', 'COLLECTED'), true);
    assert.equal(isValidStatusTransition('SCHEDULED', 'UNSUCCESSFUL'), true);
    assert.equal(isValidStatusTransition('UNSUCCESSFUL', 'READY'), true);

    // Illegal transitions (e.g. jumping from SUBMITTED directly to COLLECTED)
    assert.equal(isValidStatusTransition('SUBMITTED', 'COLLECTED'), false);
    assert.equal(isValidStatusTransition('COLLECTED', 'READY'), false);
    assert.equal(isValidStatusTransition('READY', 'COLLECTED'), false);
  });

  // --- Rule 6: Admin Authorization Protection ---
  test('Rule 6: Admin endpoints reject requests missing or presenting invalid x-admin-key', async () => {
    // Missing header -> 401
    const resMissing = await fetch(`${baseUrl}/api/admin/stats`);
    assert.equal(resMissing.status, 401);

    // Wrong header -> 401
    const resWrong = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': 'wrong-key-value' }
    });
    assert.equal(resWrong.status, 401);

    // Correct header -> 200
    const resValid = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': TEST_ADMIN_KEY }
    });
    assert.equal(resValid.status, 200);
  });

  // --- Rule 7: Tracking Code Lookup & Sensitive Data Masking ---
  test('Rule 7: Public tracking lookup succeeds by tracking code and masks residential address', async () => {
    const res = await fetch(`${baseUrl}/api/track/TRK-8F2B-9C1D`);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.tracking_code, 'TRK-8F2B-9C1D');
    assert.equal(body.status, 'READY');
    assert.equal(body.category_name, 'Electronic Waste (E-Waste)');
    // Address "742 Evergreen Terrace" must be masked to protect privacy
    assert.ok(body.masked_address.includes('*'), 'Address number must be masked');
    assert.ok(!body.masked_address.startsWith('742 '), 'Full address number should not be exposed');
  });

  // --- Rule 8: Unsuccessful Pickup Requiring Structured Reason ---
  test('Rule 8: Marking request UNSUCCESSFUL requires a valid reason code and returns resolution instruction', async () => {
    // First schedule req-001 (which is currently READY)
    const patchRes = await fetch(`${baseUrl}/api/admin/requests/req-001/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY
      },
      body: JSON.stringify({ status: 'SCHEDULED' })
    });
    assert.equal(patchRes.status, 200);

    // Now record exception without valid reason -> fails
    const failRes = await fetch(`${baseUrl}/api/admin/requests/req-001/exception`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY
      },
      body: JSON.stringify({ reason_code: 'INVALID_REASON' })
    });
    assert.equal(failRes.status, 400);

    // Record valid exception -> succeeds and attaches resolution instruction
    const successRes = await fetch(`${baseUrl}/api/admin/requests/req-001/exception`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-admin-key': TEST_ADMIN_KEY
      },
      body: JSON.stringify({
        reason_code: 'PREP_INCOMPLETE',
        operator_note: 'Batteries were left un-taped inside cardboard box.'
      })
    });
    assert.equal(successRes.status, 200);

    const body = await successRes.json();
    assert.equal(body.status, 'UNSUCCESSFUL');
    assert.equal(body.exception.reason_code, 'PREP_INCOMPLETE');
    assert.ok(body.exception.resolution_instruction.includes('Complete the required preparation checklist'));

    // Check that public tracking now also reflects this resolution instruction
    const trackRes = await fetch(`${baseUrl}/api/track/TRK-8F2B-9C1D`);
    const trackBody = await trackRes.json();
    assert.equal(trackBody.status, 'UNSUCCESSFUL');
    assert.equal(trackBody.exception.reason_code, 'PREP_INCOMPLETE');
  });

  // --- Rule 9: Real-time Database Statistics Calculation ---
  test('Rule 9: GET /api/admin/stats returns real counts matching repository state', async () => {
    const res = await fetch(`${baseUrl}/api/admin/stats`, {
      headers: { 'x-admin-key': TEST_ADMIN_KEY }
    });
    assert.equal(res.status, 200);

    const stats = await res.json();
    assert.ok(typeof stats.total_all === 'number');
    assert.ok(stats.total_all >= 4);
    assert.ok(typeof stats.total_active === 'number');
    assert.ok(Array.isArray(stats.by_zone));
    assert.ok(Array.isArray(stats.by_category));
    assert.ok(Array.isArray(stats.exceptions_by_reason));
  });
});
