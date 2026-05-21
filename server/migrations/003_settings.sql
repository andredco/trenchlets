-- =========================================================
-- Trenchlets · settings (mutable runtime config)
-- =========================================================
-- Holds key/value pairs the admin can change at runtime, like
-- the epoch anchor. The "Reset world" admin action writes a new
-- anchor here (= now in ms), which restarts epoch numbering at 0
-- and shifts the next 3-hour window to start immediately.

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
