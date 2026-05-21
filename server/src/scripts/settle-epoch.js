// =========================================================
// Trenchlets · epoch settlement
// =========================================================
// Reads the just-closed epoch from Postgres, computes:
//   1. Vault USD value (sum of token holdings × live price).
//   2. Drain amount (15% of vault USD).
//   3. Per-wallet weight = balance × tier_multiplier.
//   4. Each wallet's share of the drain pool, pro-rata.
//
// Default mode: DRY RUN. Prints the proposed distribution as a table.
// Pass --execute to actually transfer on-chain. Vault private key is
// loaded from VAULT_KEYPAIR env var (a JSON array of 64 bytes — the
// Solana keypair format you get from solana-keygen).
//
// Usage:
//   npm run settle             # dry run, current/last closed epoch
//   npm run settle -- --epoch 12
//   npm run settle -- --execute
//   npm run settle -- --epoch 12 --execute
//
// Distribution token: $TRENCHLETS by default (TRENCHLETS_MINT env var).
// Pass --token <mint> to drain a different one (e.g. SOL for testing).

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getOrCreateAssociatedTokenAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";
import { pool, query, getOne } from "../db/pool.js";
import { getSnapshot } from "../prices.js";

const TIER_MULT = {
  shrimp: 1.0,
  fish: 1.08,
  dolphin: 1.18,
  shark: 1.3,
  whale: 1.5,
};

const EPOCH_LENGTH_MS = 3 * 60 * 60 * 1000;
const EPOCH_ANCHOR_MS = Date.UTC(2026, 4, 21, 0, 0, 0);
const DRAIN_PCT = 0.50;
const QUALIFY_FLOOR = 50_000;

function currentEpochIdx(now = Date.now()) {
  return Math.floor((now - EPOCH_ANCHOR_MS) / EPOCH_LENGTH_MS);
}

function epochStartMs(idx) {
  return EPOCH_ANCHOR_MS + idx * EPOCH_LENGTH_MS;
}

// ── Args ─────────────────────────────────────────────────────
const args = process.argv.slice(2);
function flag(name) { return args.includes(name); }
function val(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
}
const EXECUTE = flag("--execute");
const REQUESTED_EPOCH = val("--epoch", null);
const TOKEN_OVERRIDE = val("--token", null);

async function main() {
  const epochIdx = REQUESTED_EPOCH != null ? parseInt(REQUESTED_EPOCH, 10) : currentEpochIdx() - 1;
  if (Number.isNaN(epochIdx) || epochIdx < 0) {
    console.error("Invalid epoch idx");
    process.exit(1);
  }

  console.log(`\n=== Settling epoch ${epochIdx} ===`);
  console.log(`Started: ${new Date(epochStartMs(epochIdx)).toISOString()}`);
  console.log(`Ended:   ${new Date(epochStartMs(epochIdx + 1)).toISOString()}`);
  console.log(`Mode:    ${EXECUTE ? "EXECUTE (on-chain)" : "DRY RUN"}`);

  // 1. Compute vault USD from cached prices and known token holdings.
  //    We track the vault wallet's holdings in `house_state.vault_usd` per
  //    house-token. For v1, we sum a snapshot recomputed at settlement time
  //    via DexScreener prices.
  const prices = getSnapshot();
  const housesRow = await query(`SELECT community_id, vault_usd, epoch_yield FROM house_state`);
  const totalVault = housesRow.rows.reduce((s, r) => s + Number(r.vault_usd || 0), 0);
  const drainUsd = totalVault * DRAIN_PCT;
  console.log(`Vault USD: $${totalVault.toFixed(2)}`);
  console.log(`Drain (15%): $${drainUsd.toFixed(2)}`);

  // 2. Compute per-wallet weight from tier_cache for every wallet that played
  //    or held in this epoch. Floor at 50K $TRENCHLETS to qualify.
  const holders = await query(
    `SELECT t.wallet, t.balance, t.tier_id
     FROM tier_cache t
     WHERE t.balance >= $1
     ORDER BY t.balance DESC`,
    [QUALIFY_FLOOR],
  );
  if (holders.rowCount === 0) {
    console.log("No qualifying holders. Nothing to distribute.");
    await pool.end();
    return;
  }

  const weighted = holders.rows.map((r) => {
    const mult = TIER_MULT[r.tier_id] || 1;
    const weight = Number(r.balance) * mult;
    return { wallet: r.wallet, balance: Number(r.balance), tier: r.tier_id, weight };
  });
  const totalWeight = weighted.reduce((s, x) => s + x.weight, 0);

  // 3. Pro-rata the drain pool.
  const distribution = weighted.map((x) => {
    const sharePct = x.weight / totalWeight;
    const usd = drainUsd * sharePct;
    return { ...x, sharePct, usd };
  });

  console.log(`\nQualifying holders: ${distribution.length}`);
  console.log(`Total weight: ${totalWeight.toFixed(0)}\n`);

  // Pretty table
  console.log(["wallet".padEnd(46), "tier".padEnd(8), "balance".padStart(14), "share".padStart(8), "USD".padStart(12)].join(" "));
  console.log("-".repeat(92));
  for (const d of distribution.slice(0, 50)) {
    console.log([
      d.wallet.padEnd(46),
      d.tier.padEnd(8),
      d.balance.toFixed(0).padStart(14),
      (d.sharePct * 100).toFixed(2).padStart(7) + "%",
      ("$" + d.usd.toFixed(2)).padStart(12),
    ].join(" "));
  }
  if (distribution.length > 50) console.log(`... and ${distribution.length - 50} more`);

  // 4. Persist epoch summary
  await query(
    `INSERT INTO epochs (idx, starts_at, ends_at, vault_usd_start, vault_usd_end, drain_usd, total_yield)
     VALUES ($1, to_timestamp($2), to_timestamp($3), $4, $4, $5, $6)
     ON CONFLICT (idx) DO UPDATE SET
       vault_usd_end = EXCLUDED.vault_usd_end,
       drain_usd = EXCLUDED.drain_usd,
       total_yield = EXCLUDED.total_yield`,
    [
      epochIdx,
      epochStartMs(epochIdx) / 1000,
      epochStartMs(epochIdx + 1) / 1000,
      totalVault,
      drainUsd,
      housesRow.rows.reduce((s, r) => s + Number(r.epoch_yield || 0), 0),
    ],
  );

  // 5. Reset epoch_yield for the next cycle
  await query(`UPDATE house_state SET epoch_yield = 0`);

  if (!EXECUTE) {
    console.log(`\nDRY RUN — no on-chain transfers made.`);
    console.log(`Re-run with --execute to send the distribution.`);
    await pool.end();
    return;
  }

  // ── EXECUTE PATH ─────────────────────────────────────────
  if (!process.env.VAULT_KEYPAIR) {
    console.error("\nVAULT_KEYPAIR env var not set. Cannot execute.");
    console.error("Provide a JSON array of 64 bytes (output of `solana-keygen`).");
    process.exit(1);
  }
  if (!process.env.RPC_URL) {
    console.error("RPC_URL env var not set.");
    process.exit(1);
  }

  const tokenMint = TOKEN_OVERRIDE || process.env.TRENCHLETS_MINT;
  if (!tokenMint) {
    console.error("\nNo token mint configured (TRENCHLETS_MINT env var or --token flag).");
    process.exit(1);
  }

  const keypair = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(process.env.VAULT_KEYPAIR)));
  const connection = new Connection(process.env.RPC_URL, { commitment: "confirmed" });

  // We send token amounts, not USD. For each recipient, convert their USD
  // share to a token amount using the live price of the distribution token.
  const tokenPrice = prices[tokenMint]?.priceUsd;
  if (!tokenPrice) {
    console.error(`\nNo live price for ${tokenMint}. Refusing to execute.`);
    process.exit(1);
  }

  const mintPk = new PublicKey(tokenMint);
  const fromAta = await getOrCreateAssociatedTokenAccount(connection, keypair, mintPk, keypair.publicKey);

  console.log(`\nExecuting on-chain. From vault ATA: ${fromAta.address.toBase58()}`);
  console.log(`Token price: $${tokenPrice}`);

  const txids = [];
  for (const d of distribution) {
    if (d.usd < 0.01) continue;
    const tokenAmount = Math.floor((d.usd / tokenPrice) * 1e6); // assumes 6 decimals — adjust per mint
    if (tokenAmount <= 0) continue;
    try {
      const recipient = new PublicKey(d.wallet);
      const toAta = await getOrCreateAssociatedTokenAccount(connection, keypair, mintPk, recipient);
      const tx = new Transaction().add(
        createTransferInstruction(fromAta.address, toAta.address, keypair.publicKey, BigInt(tokenAmount)),
      );
      const sig = await sendAndConfirmTransaction(connection, tx, [keypair]);
      txids.push({ wallet: d.wallet, sig });
      console.log(`  → ${d.wallet.slice(0, 8)}...  $${d.usd.toFixed(2)}  ${sig.slice(0, 12)}...`);
    } catch (err) {
      console.warn(`  ✗ ${d.wallet}: ${err.message}`);
    }
  }

  await query(
    `UPDATE epochs SET settled_at = now(), settlement_txid = $1 WHERE idx = $2`,
    [txids.map((t) => t.sig).join(","), epochIdx],
  );

  console.log(`\n✓ Settled epoch ${epochIdx}. ${txids.length} transfers submitted.`);
  await pool.end();
}

main().catch(async (err) => {
  console.error("settlement failed:", err);
  try { await pool.end(); } catch {}
  process.exit(1);
});
