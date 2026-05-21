// Shared Postgres pool for the settler service.
import pg from "pg";
const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.warn("DATABASE_URL not set — settler cannot start");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : undefined,
  max: 5,
});

export async function q(text, params) {
  const r = await pool.query(text, params);
  return r.rows;
}
export async function one(text, params) {
  const r = await pool.query(text, params);
  return r.rows[0] || null;
}
