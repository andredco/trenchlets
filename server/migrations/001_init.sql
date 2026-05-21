-- =========================================================
-- Trenchlets · initial schema
-- =========================================================

-- PLAYERS
-- Identified by either a wallet pubkey (signed in) or a hardware id
-- (guest). Display name is editable, sticks to the identity.
CREATE TABLE IF NOT EXISTS players (
  id           BIGSERIAL PRIMARY KEY,
  wallet       TEXT UNIQUE,                 -- Solana pubkey, NULL for guests
  hardware_id  TEXT UNIQUE,                 -- 16-char client-generated id, NULL for wallets
  display_name TEXT NOT NULL DEFAULT 'guest',
  ip_hash      TEXT,                        -- sha256(ip + salt) for soft sybil resistance
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT now(),
  community_id TEXT,                        -- which house they joined (nullable)
  CHECK (wallet IS NOT NULL OR hardware_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_players_wallet     ON players(wallet);
CREATE INDEX IF NOT EXISTS idx_players_hardware   ON players(hardware_id);
CREATE INDEX IF NOT EXISTS idx_players_last_seen  ON players(last_seen DESC);

-- HOUSE STATE
-- Per-house accumulated yield within the current epoch and persistent vault.
CREATE TABLE IF NOT EXISTS house_state (
  community_id   TEXT PRIMARY KEY,
  vault_usd      NUMERIC(20, 4) NOT NULL DEFAULT 0,
  epoch_yield    NUMERIC(20, 4) NOT NULL DEFAULT 0,  -- resets at epoch close
  total_yield    NUMERIC(20, 4) NOT NULL DEFAULT 0,  -- lifetime
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CONTRIBUTIONS
-- Append-only ledger of every minigame submission. Survives restarts so we
-- can recompute leaderboards, audit yields, and settle epochs deterministically.
CREATE TABLE IF NOT EXISTS contributions (
  id            BIGSERIAL PRIMARY KEY,
  player_id     BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  community_id  TEXT NOT NULL,
  task_id       TEXT NOT NULL,
  minigame_id   TEXT NOT NULL,
  difficulty    TEXT NOT NULL,                       -- easy | medium | hard
  raw_score     NUMERIC(6, 4) NOT NULL,              -- 0..1
  percent       NUMERIC(8, 4) NOT NULL,              -- contribution % awarded
  event_mult    NUMERIC(4, 2) NOT NULL DEFAULT 1.00, -- world-event multiplier at submission
  duration_ms   INTEGER NOT NULL,
  epoch_idx     INTEGER NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contrib_player    ON contributions(player_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contrib_community ON contributions(community_id, epoch_idx);
CREATE INDEX IF NOT EXISTS idx_contrib_epoch     ON contributions(epoch_idx);

-- COOLDOWNS
-- Server-authoritative cooldown after a minigame session. Replaces the
-- localStorage version so users can't bypass it by clearing storage.
CREATE TABLE IF NOT EXISTS cooldowns (
  player_id  BIGINT PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
  until_at   TIMESTAMPTZ NOT NULL,
  reason     TEXT NOT NULL DEFAULT 'minigame'
);

-- EPOCHS
-- Records each 6-hour window's total drain, contributions, and settlement state.
CREATE TABLE IF NOT EXISTS epochs (
  idx              INTEGER PRIMARY KEY,
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL,
  vault_usd_start  NUMERIC(20, 4) NOT NULL DEFAULT 0,
  vault_usd_end    NUMERIC(20, 4),                   -- set on close
  drain_usd        NUMERIC(20, 4),                   -- 15% of end vault
  total_yield      NUMERIC(20, 4),                   -- sum of all house yield
  settled_at       TIMESTAMPTZ,                      -- when on-chain settlement signed
  settlement_txid  TEXT
);
CREATE INDEX IF NOT EXISTS idx_epochs_window ON epochs(starts_at, ends_at);

-- TOWN VOTES
CREATE TABLE IF NOT EXISTS town_proposals (
  id          BIGSERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  ticker      TEXT NOT NULL,
  contract    TEXT NOT NULL UNIQUE,
  submitter   BIGINT REFERENCES players(id) ON DELETE SET NULL,
  vote_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  promoted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS town_votes (
  proposal_id  BIGINT NOT NULL REFERENCES town_proposals(id) ON DELETE CASCADE,
  player_id    BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  voted_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, player_id)
);

-- CHAT (lightweight, recent only)
-- We trim to the last 200 messages globally so the table doesn't bloat.
CREATE TABLE IF NOT EXISTS chat_messages (
  id          BIGSERIAL PRIMARY KEY,
  player_id   BIGINT REFERENCES players(id) ON DELETE SET NULL,
  display_name TEXT NOT NULL,
  community_id TEXT,
  text        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_recent ON chat_messages(created_at DESC);

-- TIER CACHE
-- Cached wallet → tier lookup so we don't hammer Helius on every action.
CREATE TABLE IF NOT EXISTS tier_cache (
  wallet      TEXT PRIMARY KEY,
  balance     NUMERIC(20, 4) NOT NULL,
  tier_id     TEXT NOT NULL,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
