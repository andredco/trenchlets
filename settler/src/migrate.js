// Apply settler-specific migrations to the shared Postgres.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.resolve(__dirname, "../migrations");

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set");
    process.exit(0);
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  const done = new Set((await pool.query("SELECT filename FROM migrations")).rows.map(r => r.filename));
  const files = (await fs.readdir(dir)).filter(f => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) { console.log(`✓ ${f} (applied)`); continue; }
    const sql = await fs.readFile(path.join(dir, f), "utf8");
    console.log(`→ ${f}`);
    await pool.query("BEGIN");
    try {
      await pool.query(sql);
      await pool.query("INSERT INTO migrations(filename) VALUES ($1)", [f]);
      await pool.query("COMMIT");
      console.log(`✓ ${f}`);
    } catch (err) {
      await pool.query("ROLLBACK");
      console.error(`✗ ${f}:`, err.message);
      process.exit(1);
    }
  }
  await pool.end();
}

run().catch(err => { console.error(err); process.exit(1); });
