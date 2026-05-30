// =========================================================
// Wallet → Tier resolver via Solana RPC
// =========================================================
// Reads the connected wallet's $BOBLETS token balance and
// maps it to a tier. Cached server-side (table tier_cache) for
// 30s so we don't hammer Helius.

import { Connection, PublicKey } from "@solana/web3.js";
import { query, getOne } from "./db/pool.js";

const TIERS = [
  { id: "shrimp",  label: "SHRIMP",  min: 0 },
  { id: "fish",    label: "FISH",    min: 50_000 },
  { id: "dolphin", label: "DOLPHIN", min: 500_000 },
  { id: "shark",   label: "SHARK",   min: 5_000_000 },
  { id: "whale",   label: "WHALE",   min: 50_000_000 },
];

const CACHE_TTL_MS = 30 * 1000;

let connection = null;
function getConnection() {
  if (connection) return connection;
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    throw new Error("RPC_URL env var not set");
  }
  connection = new Connection(rpcUrl, { commitment: "confirmed" });
  return connection;
}

export function tierFor(balance) {
  let result = TIERS[0];
  for (const t of TIERS) if (balance >= t.min) result = t;
  return result;
}

// Returns { balance, tier_id } for a wallet. Uses tier_cache if fresh.
export async function getTier(wallet) {
  const cached = await getOne(
    "SELECT balance, tier_id, refreshed_at FROM tier_cache WHERE wallet = $1",
    [wallet],
  );
  if (cached && Date.now() - new Date(cached.refreshed_at).getTime() < CACHE_TTL_MS) {
    return { balance: Number(cached.balance), tier_id: cached.tier_id };
  }
  const balance = await fetchBalance(wallet);
  const tier = tierFor(balance);
  await query(
    `INSERT INTO tier_cache (wallet, balance, tier_id, refreshed_at)
     VALUES ($1, $2, $3, now())
     ON CONFLICT (wallet) DO UPDATE SET balance = EXCLUDED.balance, tier_id = EXCLUDED.tier_id, refreshed_at = now()`,
    [wallet, balance, tier.id],
  );
  return { balance, tier_id: tier.id };
}

async function fetchBalance(wallet) {
  const mint = process.env.BOBLETS_MINT;
  if (!mint) {
    // Token not launched yet — everyone is SHRIMP.
    return 0;
  }
  try {
    const conn = getConnection();
    const owner = new PublicKey(wallet);
    const mintKey = new PublicKey(mint);
    const accounts = await conn.getParsedTokenAccountsByOwner(owner, { mint: mintKey });
    let total = 0;
    for (const acc of accounts.value) {
      const ui = acc.account.data.parsed.info.tokenAmount.uiAmount;
      if (typeof ui === "number") total += ui;
    }
    return total;
  } catch (err) {
    console.warn("tier fetch failed for", wallet, err.message);
    return 0;
  }
}
