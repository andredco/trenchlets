// Runs every .sql file in /migrations in alphabetical order.
// Tracks applied migrations in a `migrations` table so we don't re-run them.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../migrations");

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function applied() {
  const r = await pool.query("SELECT filename FROM migrations");
  return new Set(r.rows.map((r) => r.filename));
}

async function run() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL not set. Skipping migrate.");
    process.exit(0);
  }
  await ensureTable();
  const done = await applied();
  const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    if (done.has(f)) {
      console.log(`✓ ${f} (already applied)`);
      continue;
    }
    const sql = await fs.readFile(path.join(migrationsDir, f), "utf8");
    console.log(`→ applying ${f} ...`);
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
  console.log("migrations done");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
