// =========================================================
// Contribution + cooldown logic (server-authoritative)
// =========================================================

import { query, getOne } from "./db/pool.js";
import { tierFor } from "./tier.js";
import { currentEpochIdx } from "./epoch.js";

// Re-export so existing callers (server/index.js, ws.js) keep working.
export { currentEpochIdx };

const TIER_MULT = {
  shrimp: 1.0,
  fish: 1.08,
  dolphin: 1.18,
  shark: 1.3,
  whale: 1.5,
};

const DIFFICULTY_MULT = {
  easy: 2,
  medium: 4,
  hard: 6,
};

const DIFFICULTY_COOLDOWN_MS = {
  easy: 60 * 60 * 1000,
  medium: 90 * 60 * 1000,
  hard: 2 * 60 * 60 * 1000,
};

const MIN_DURATION_MS = 10_000; // shorter sessions are rejected
const MAX_DURATION_MS = 30 * 60 * 1000;

// Submit a contribution. Validates against cooldown, duration bounds,
// and score bounds. Returns the awarded percent or throws.
export async function submitContribution({
  playerId,
  communityId,
  taskId,
  minigameId,
  difficulty,
  rawScore,
  durationMs,
  eventMult = 1,
  tierId = "shrimp",
}) {
  // Anti-cheat sanity
  if (typeof rawScore !== "number" || rawScore < 0 || rawScore > 1) {
    throw new Error("invalid score");
  }
  if (typeof durationMs !== "number" || durationMs < MIN_DURATION_MS || durationMs > MAX_DURATION_MS) {
    throw new Error("invalid duration");
  }
  if (!DIFFICULTY_MULT[difficulty]) {
    throw new Error("invalid difficulty");
  }
  if (typeof eventMult !== "number" || eventMult < 0 || eventMult > 5) {
    eventMult = 1;
  }

  // Cooldown check
  const cd = await getOne("SELECT until_at FROM cooldowns WHERE player_id = $1", [playerId]);
  if (cd && new Date(cd.until_at).getTime() > Date.now()) {
    throw new Error("on cooldown");
  }

  // Compute % awarded.
  // Same formula as the client preview: avgScore × difficulty.pct × tier × event.
  // No stage-count multiplier — yield does NOT scale with how many stages we run.
  const tierMul = TIER_MULT[tierId] || 1;
  const diffMul = DIFFICULTY_MULT[difficulty];
  const percent = rawScore * diffMul * tierMul * eventMult;

  // Insert ledger + update house yield + set cooldown atomically
  await query("BEGIN");
  try {
    const epoch = currentEpochIdx();
    await query(
      `INSERT INTO contributions
        (player_id, community_id, task_id, minigame_id, difficulty,
         raw_score, percent, event_mult, duration_ms, epoch_idx)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [playerId, communityId, taskId, minigameId, difficulty, rawScore, percent, eventMult, durationMs, epoch],
    );

    await query(
      `INSERT INTO house_state (community_id, epoch_yield, total_yield, updated_at)
       VALUES ($1, $2, $2, now())
       ON CONFLICT (community_id) DO UPDATE SET
         epoch_yield = house_state.epoch_yield + EXCLUDED.epoch_yield,
         total_yield = house_state.total_yield + EXCLUDED.total_yield,
         updated_at = now()`,
      [communityId, percent],
    );

    const cdMs = DIFFICULTY_COOLDOWN_MS[difficulty];
    await query(
      `INSERT INTO cooldowns (player_id, until_at, reason)
       VALUES ($1, now() + INTERVAL '${cdMs} milliseconds', 'minigame')
       ON CONFLICT (player_id) DO UPDATE SET until_at = EXCLUDED.until_at, reason = EXCLUDED.reason`,
      [playerId],
    );

    await query("COMMIT");
  } catch (err) {
    await query("ROLLBACK");
    throw err;
  }

  return { percent, epoch: currentEpochIdx() };
}

export async function getCooldown(playerId) {
  const cd = await getOne("SELECT until_at FROM cooldowns WHERE player_id = $1", [playerId]);
  if (!cd) return 0;
  return Math.max(0, new Date(cd.until_at).getTime() - Date.now());
}

export async function getHouseStandings() {
  const r = await query(
    `SELECT community_id, vault_usd, epoch_yield, total_yield
     FROM house_state ORDER BY epoch_yield DESC`,
  );
  return r.rows;
}

export async function getLeaderboard(communityId, limit = 10) {
  const r = await query(
    `SELECT p.display_name, SUM(c.percent) AS total
     FROM contributions c JOIN players p ON p.id = c.player_id
     WHERE c.community_id = $1 AND c.epoch_idx = $2
     GROUP BY p.display_name
     ORDER BY total DESC LIMIT $3`,
    [communityId, currentEpochIdx(), limit],
  );
  return r.rows;
}
