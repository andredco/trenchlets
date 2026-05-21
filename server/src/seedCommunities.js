// Sync community mint metadata from the static data.js into Postgres
// so the settler service has the addresses it needs without importing
// the frontend bundle. Idempotent — safe to run on every boot.

import { query } from "./db/pool.js";
import { COMMUNITIES } from "./shared-data.js";

export async function seedCommunityMeta() {
  for (const c of COMMUNITIES) {
    const looksReal = typeof c.mint === "string" && !c.mint.includes("placeholder");
    await query(
      `INSERT INTO community_meta (community_id, ticker, mint, decimals)
       VALUES ($1, $2, $3, 6)
       ON CONFLICT (community_id) DO UPDATE SET
         ticker = EXCLUDED.ticker,
         mint = COALESCE(EXCLUDED.mint, community_meta.mint),
         updated_at = now()`,
      [c.id, c.ticker, looksReal ? c.mint : null],
    );
  }
  console.log(`Seeded ${COMMUNITIES.length} community_meta rows`);
}
