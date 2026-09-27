import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let dbInstance = null;

export function getDatabase(dbPath = config.databasePath) {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists if using a file path
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  dbInstance = new DatabaseSync(dbPath);

  // Enable WAL and foreign key constraints
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  if (dbPath !== ':memory:') {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }

  // Initialize schema
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  dbInstance.exec(schemaSql);

  logger.info('Database initialized successfully', { path: dbPath });
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    logger.info('Database connection closed');
  }
}
