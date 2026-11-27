import 'server-only';
import { Pool } from 'pg';

// Supabase is PostgreSQL hosting only. No Supabase Auth, client JWTs or service-role keys.
let pool: Pool | undefined;
export function database(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is required for Vāchaspati custom authentication');
  if (!pool) {
    pool = new Pool({
      connectionString, max: 10, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000,
      ssl: process.env.NODE_ENV !== 'production' && process.env.DATABASE_SSL_MODE === 'disable'
        ? false
        : { rejectUnauthorized: true },
    });
  }
  return pool;
}
