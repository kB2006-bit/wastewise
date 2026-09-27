-- WasteWise Relational Schema (SQLite)

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS prep_rules (
  id TEXT PRIMARY KEY,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  instruction TEXT NOT NULL,
  required INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS zones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS collection_windows (
  id TEXT PRIMARY KEY,
  zone_id TEXT NOT NULL REFERENCES zones(id) ON DELETE CASCADE,
  collection_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  capacity INTEGER NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS pickup_requests (
  id TEXT PRIMARY KEY,
  tracking_code TEXT UNIQUE NOT NULL,
  category_id TEXT NOT NULL REFERENCES categories(id),
  item_description TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  zone_id TEXT NOT NULL REFERENCES zones(id),
  address TEXT NOT NULL,
  access_notes TEXT,
  prep_confirmed INTEGER NOT NULL DEFAULT 0,
  requested_window_id TEXT NOT NULL REFERENCES collection_windows(id),
  status TEXT NOT NULL DEFAULT 'SUBMITTED',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS exception_records (
  id TEXT PRIMARY KEY,
  pickup_request_id TEXT NOT NULL REFERENCES pickup_requests(id) ON DELETE CASCADE,
  reason_code TEXT NOT NULL,
  operator_note TEXT,
  resolution_instruction TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Performance and integrity indexes
CREATE INDEX IF NOT EXISTS idx_requests_tracking ON pickup_requests(tracking_code);
CREATE INDEX IF NOT EXISTS idx_requests_status ON pickup_requests(status);
CREATE INDEX IF NOT EXISTS idx_requests_window ON pickup_requests(requested_window_id);
CREATE INDEX IF NOT EXISTS idx_requests_zone ON pickup_requests(zone_id);
CREATE INDEX IF NOT EXISTS idx_windows_zone_date ON collection_windows(zone_id, collection_date);
CREATE INDEX IF NOT EXISTS idx_exceptions_request ON exception_records(pickup_request_id);
