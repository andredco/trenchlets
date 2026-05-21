// Postgres connection pool. Reads DATABASE_URL from env (Railway provides this).
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set — DB calls will fail until configured.");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export async function query(text, params) {
  const res = await pool.query(text, params);
  return res;
}

export async function getOne(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}
