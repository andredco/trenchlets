// =========================================================
// Boblets Settler — entry point
// =========================================================
// Two run modes:
//   --once          run a single epoch then exit (for cron / manual)
//   (default)       loop forever, sleeping until the next 6h boundary
//
// DRY_RUN=true      log everything but never sign on-chain. Always run
//                   with this on for a few cycles before flipping to live.

import { runEpoch } from "./epoch.js";
import { EPOCH_LENGTH_MS, EPOCH_ANCHOR_MS, RUN_ONCE, DRY_RUN } from "./config.js";
import { pool } from "./db.js";

async function main() {
  console.log(`Boblets settler starting (DRY_RUN=${DRY_RUN}, RUN_ONCE=${RUN_ONCE})`);

  if (RUN_ONCE) {
    try { await runEpoch(); }
    catch (err) { console.error("epoch failed:", err); process.exitCode = 1; }
    finally { await pool.end(); }
    return;
  }

  // Loop: sleep until next epoch boundary, then settle.
  while (true) {
    const now = Date.now();
    const nextBoundary = EPOCH_ANCHOR_MS + Math.ceil((now - EPOCH_ANCHOR_MS) / EPOCH_LENGTH_MS) * EPOCH_LENGTH_MS;
    const wait = Math.max(1000, nextBoundary - now + 5000); // +5s buffer for any in-flight contributions
    const waitH = (wait / 3_600_000).toFixed(2);
    console.log(`Next settlement at ${new Date(nextBoundary + 5000).toISOString()} (in ${waitH}h)`);
    await sleep(wait);
    try { await runEpoch(); }
    catch (err) { console.error("epoch failed:", err); }
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, async () => {
    console.log(`Received ${sig}, shutting down`);
    try { await pool.end(); } catch {}
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("fatal:", err);
  process.exit(1);
});
