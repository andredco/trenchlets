-- =========================================================
-- Settler tables — written by settler service, read by web service
-- =========================================================
-- Tracks per-epoch buyback execution, per-community swap results,
-- per-wallet payouts. Carries unsettled yield forward when there's
-- nothing in the vault to spend.

-- One row per (epoch_idx, run). settler_runs gives us a primary key
-- separate from the existing epochs table so dry-runs don't collide
-- with real settlements.
CREATE TABLE IF NOT EXISTS settler_runs (
  id              BIGSERIAL PRIMARY KEY,
  epoch_idx       INTEGER NOT NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at     TIMESTAMPTZ,
  dry_run         BOOLEAN NOT NULL DEFAULT FALSE,
  vault_sol_start NUMERIC(20, 9) NOT NULL DEFAULT 0,
  vault_sol_end   NUMERIC(20, 9),
  total_yield     NUMERIC(20, 4) NOT NULL DEFAULT 0,
  spend_sol       NUMERIC(20, 9) NOT NULL DEFAULT 0,
  buyback_sol     NUMERIC(20, 9) NOT NULL DEFAULT 0,
  protocol_sol    NUMERIC(20, 9) NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'running',  -- running | done | failed | skipped
  error           TEXT
);
CREATE INDEX IF NOT EXISTS idx_settler_runs_epoch ON settler_runs(epoch_idx);

-- Per-community swap result. One row per (run_id, community_id).
CREATE TABLE IF NOT EXISTS settler_swaps (
  id            BIGSERIAL PRIMARY KEY,
  run_id        BIGINT NOT NULL REFERENCES settler_runs(id) ON DELETE CASCADE,
  community_id  TEXT NOT NULL,
  yield_pct     NUMERIC(10, 4) NOT NULL,
  sol_input     NUMERIC(20, 9) NOT NULL,
  tokens_out    NUMERIC(30, 9),
  swap_txid     TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',    -- pending | done | skipped | failed
  error         TEXT,
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_settler_swaps_run ON settler_swaps(run_id);

-- Per-wallet payout. One row per (run_id, wallet, community_id).
CREATE TABLE IF NOT EXISTS settler_payouts (
  id            BIGSERIAL PRIMARY KEY,
  run_id        BIGINT NOT NULL REFERENCES settler_runs(id) ON DELETE CASCADE,
  community_id  TEXT NOT NULL,
  wallet        TEXT NOT NULL,
  weight        NUMERIC(20, 6) NOT NULL,
  share_pct     NUMERIC(10, 6) NOT NULL,
  tokens_paid   NUMERIC(30, 9) NOT NULL,
  transfer_txid TEXT,
  status        TEXT NOT NULL DEFAULT 'pending',    -- pending | done | failed
  error         TEXT,
  finished_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_settler_payouts_run    ON settler_payouts(run_id);
CREATE INDEX IF NOT EXISTS idx_settler_payouts_wallet ON settler_payouts(wallet);

-- carry_yield holds yield that piled up while the vault was empty.
-- Reset to 0 only when a successful run drains it.
CREATE TABLE IF NOT EXISTS carry_yield (
  community_id  TEXT PRIMARY KEY,
  yield_pct     NUMERIC(20, 6) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- community_meta — mint addresses + decimals for each launch community.
-- Populated by the web service from data.js on startup. Settler reads
-- it to know which mint to swap into for each community.
CREATE TABLE IF NOT EXISTS community_meta (
  community_id  TEXT PRIMARY KEY,
  ticker        TEXT NOT NULL,
  mint          TEXT,
  decimals      INTEGER NOT NULL DEFAULT 6,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
