// =========================================================
// Live vault balance watcher
// =========================================================
// Polls the dev wallet's SOL balance every POLL_MS via Helius RPC,
// reads the SOL/USD price from DexScreener, and broadcasts the
// resulting USD figure to every connected websocket client.
//
// This is the source of truth for the "CENTRAL VAULT" number shown
// in the in-game HUD. Vault grows when pump.fun creator rewards
// land in the wallet; the watcher reflects that on the next poll.

import { Connection, PublicKey } from "@solana/web3.js";

const POLL_MS = 30 * 1000;
const SOL_MINT = "So11111111111111111111111111111111111111112";
const LAMPORTS_PER_SOL = 1_000_000_000;

let listeners = [];
let snapshot = { sol: 0, solPriceUsd: 0, usd: 0, address: null, fetchedAt: 0 };

export function getVaultSnapshot() {
  return snapshot;
}

export function subscribeVault(cb) {
  listeners.push(cb);
  cb(snapshot);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

// Default vault address baked in so the watcher works without env config.
// Override via VAULT_ADDRESS env var if you ever rotate wallets.
const DEFAULT_VAULT_ADDRESS = "9skP9HNkMs1gfu7w27hkZTm88YnoMNxWbWaiXeDv7hgd";

export function startVaultWatcher() {
  const address = process.env.VAULT_ADDRESS || DEFAULT_VAULT_ADDRESS;
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.warn("vault watcher: RPC_URL not set, vault USD will stay at $0");
    return;
  }
  let pubkey;
  try { pubkey = new PublicKey(address); }
  catch (err) {
    console.warn("vault watcher: invalid VAULT_ADDRESS:", err.message);
    return;
  }
  const conn = new Connection(rpcUrl, { commitment: "confirmed" });
  console.log(`vault watcher: tracking ${address}`);
  pollOnce(conn, pubkey, address);
  setInterval(() => pollOnce(conn, pubkey, address), POLL_MS);
}

async function pollOnce(conn, pubkey, address) {
  try {
    // Concurrent fetches — RPC for SOL balance, DexScreener for SOL/USD.
    const [lamports, solPriceUsd] = await Promise.all([
      conn.getBalance(pubkey),
      fetchSolPrice(),
    ]);
    const sol = lamports / LAMPORTS_PER_SOL;
    const usd = sol * (solPriceUsd || 0);
    snapshot = {
      sol,
      solPriceUsd,
      usd,
      address,
      fetchedAt: Date.now(),
    };
    for (const cb of listeners) {
      try { cb(snapshot); } catch (err) { console.warn(err); }
    }
  } catch (err) {
    console.warn("vault watcher poll failed:", err.message);
  }
}

async function fetchSolPrice() {
  try {
    const r = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${SOL_MINT}`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return 0;
    const data = await r.json();
    const pairs = data?.pairs || [];
    // Use the highest-liquidity pair (typically USDC).
    pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
    const top = pairs[0];
    return Number(top?.priceUsd) || 0;
  } catch {
    return 0;
  }
}
