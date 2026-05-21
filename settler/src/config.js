// Settler economic constants. Tunable via env if you want to A/B
// later, but the defaults reflect the locked-in economics:
//   - 40% per-epoch release cap on vault SOL
//   - 30% protocol take of whatever drains
//   - 70% goes to community buybacks
//   - 6h epoch
//   - 5% max slippage per Jupiter swap

export const RELEASE_CAP_PCT  = numEnv("RELEASE_CAP_PCT",  0.40); // ≤ 40% drains per epoch
export const PROTOCOL_TAKE_PCT = numEnv("PROTOCOL_TAKE_PCT", 0.30); // 30% stays in vault
export const SLIPPAGE_BPS     = numEnv("SLIPPAGE_BPS", 500); // 5%
export const EPOCH_LENGTH_MS  = 6 * 60 * 60 * 1000;
export const EPOCH_ANCHOR_MS  = Date.UTC(2026, 4, 21, 0, 0, 0); // matches client + web

export const DRY_RUN = process.env.DRY_RUN === "true" || process.env.DRY_RUN === "1";
export const RUN_ONCE = process.argv.includes("--once");

// Helius / mainnet RPC. Required.
export const RPC_URL = process.env.RPC_URL || "";

// Vault keypair as a JSON array of 64 bytes.
// On Railway: paste the output of `solana-keygen new` (the entire array).
export const VAULT_KEYPAIR_JSON = process.env.VAULT_KEYPAIR || "";

// Wrapped SOL mint — used as the input token for Jupiter swaps.
export const WSOL_MINT = "So11111111111111111111111111111111111111112";

function numEnv(name, def) {
  const v = process.env[name];
  if (v == null || v === "") return def;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : def;
}

export function currentEpochIdx(now = Date.now()) {
  return Math.floor((now - EPOCH_ANCHOR_MS) / EPOCH_LENGTH_MS);
}
export function epochStartMs(idx) { return EPOCH_ANCHOR_MS + idx * EPOCH_LENGTH_MS; }
