// =========================================================
// Trenchlets · epoch anchor (runtime mutable)
// =========================================================
// The anchor is the UTC ms at which epoch 0 starts. Every 3 hours
// after the anchor a new epoch begins. The anchor lives in the
// `settings` table so the admin "Reset world" action can move it
// forward to "now", restarting epoch numbering at 0.
//
// We keep an in-memory cache so currentEpochIdx() stays synchronous
// (it's called from hot paths like every WS broadcast). The cache
// refreshes every minute and immediately after setEpochAnchor().

import { query, getOne } from "./db/pool.js";

export const EPOCH_LENGTH_MS = 3 * 60 * 60 * 1000;

// Default fallback if the DB hasn't been initialized yet — matches the
// constant we shipped originally so old behaviour is preserved.
const DEFAULT_ANCHOR_MS = Date.UTC(2026, 4, 21, 0, 0, 0);

let cached = DEFAULT_ANCHOR_MS;
let lastFetched = 0;

export async function loadEpochAnchor() {
  try {
    const row = await getOne(
      `SELECT value FROM settings WHERE key = 'epoch_anchor_ms'`,
    );
    if (row?.value) {
      const ms = Number(row.value);
      if (Number.isFinite(ms) && ms > 0) {
        cached = ms;
      }
    } else {
      // First run — write the default so the admin UI shows it.
      await query(
        `INSERT INTO settings (key, value) VALUES ('epoch_anchor_ms', $1)
         ON CONFLICT (key) DO NOTHING`,
        [String(DEFAULT_ANCHOR_MS)],
      );
    }
    lastFetched = Date.now();
  } catch (err) {
    console.warn("loadEpochAnchor failed:", err.message);
  }
  return cached;
}

export function getEpochAnchor() {
  return cached;
}

export async function setEpochAnchor(ms) {
  if (!Number.isFinite(ms) || ms <= 0) throw new Error("invalid anchor");
  await query(
    `INSERT INTO settings (key, value, updated_at) VALUES ('epoch_anchor_ms', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [String(ms)],
  );
  cached = ms;
  lastFetched = Date.now();
  return cached;
}

export function currentEpochIdx(now = Date.now()) {
  return Math.floor((now - cached) / EPOCH_LENGTH_MS);
}

export function epochStartMs(idx) {
  return cached + idx * EPOCH_LENGTH_MS;
}

// Refresh the cache periodically so multi-instance deploys (if you ever
// scale horizontally) eventually agree on the anchor.
setInterval(() => {
  if (Date.now() - lastFetched > 55_000) {
    loadEpochAnchor().catch(() => {});
  }
}, 60_000);
