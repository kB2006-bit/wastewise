import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const config = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : 8080,
  host: '0.0.0.0',
  nodeEnv: process.env.NODE_ENV || 'development',
  adminKey: process.env.ADMIN_KEY || '',
  databasePath: process.env.DATABASE_PATH || path.resolve(__dirname, '../data/wastewise.db'),
  isProduction: process.env.NODE_ENV === 'production'
};
