// =========================================================
// Epoch orchestrator
// =========================================================
// Pulls house yield + carry yield from DB. Reads vault SOL balance.
// Computes spend pool. Walks each community, swaps SOL → community
// token via Jupiter, distributes received tokens to community members
// pro-rata by (contribution × tier_mult). Resets house yield + carry
// yield only on success.

import { q, one } from "./db.js";
import {
  RELEASE_CAP_PCT,
  PROTOCOL_TAKE_PCT,
  DRY_RUN,
  currentEpochIdx,
  epochStartMs,
} from "./config.js";
import { connection, vaultKeypair, getSolBalanceLamports } from "./solana.js";
import { quoteSolToToken, executeSwap } from "./jupiter.js";
import { computePayouts, transferToRecipient, recordPayoutRow } from "./distribute.js";

const LAMPORTS_PER_SOL = 1_000_000_000;

// Communities are read from the live `house_state` table — that gives us
// per-house mint addresses + accumulated yield. We require an `mint` column
// to be set. (The web service writes mint info from data.js on first sync.)
async function loadCommunities() {
  // Pull communities from data.js mirrored into community_meta if available,
  // else fall back to selecting from house_state.
  return await q(`
    SELECT
      hs.community_id,
      cm.mint,
      cm.decimals,
      hs.epoch_yield  AS house_pct,
      COALESCE(cy.yield_pct, 0) AS carry_pct
    FROM house_state hs
    LEFT JOIN community_meta cm ON cm.community_id = hs.community_id
    LEFT JOIN carry_yield cy    ON cy.community_id = hs.community_id
    WHERE hs.community_id IS NOT NULL
  `);
}

export async function runEpoch() {
  const epochIdx = currentEpochIdx();
  const closingEpoch = epochIdx - 1;        // we settle the EPOCH THAT JUST CLOSED
  console.log(`\n=== Settler run for closing epoch ${closingEpoch} ===`);
  console.log(`Mode: ${DRY_RUN ? "DRY RUN" : "EXECUTE"}`);

  const kp = vaultKeypair();
  const vaultPubkey = kp.publicKey.toBase58();
  const lamports = await getSolBalanceLamports(vaultPubkey);
  const vaultSol = lamports / LAMPORTS_PER_SOL;
  console.log(`Vault SOL: ${vaultSol.toFixed(4)}  (${vaultPubkey})`);

  const communities = await loadCommunities();
  if (communities.length === 0) {
    console.log("No communities loaded. Skipping.");
    return;
  }

  // Total yield = sum of (epoch_yield in house_state) + (carry_yield).
  // carry_yield is yield that piled up while the vault was empty.
  const merged = communities.map((c) => ({
    community_id: c.community_id,
    mint: c.mint,
    decimals: c.decimals,
    yieldPct: Number(c.house_pct) + Number(c.carry_pct),
  }));
  const totalYield = merged.reduce((s, c) => s + c.yieldPct, 0);
  console.log(`Total yield (this epoch + carry): ${totalYield.toFixed(2)}%`);

  // ----- start the run row (BEFORE we know if there's anything to do) -----
  const run = await one(
    `INSERT INTO settler_runs
      (epoch_idx, dry_run, vault_sol_start, total_yield, status)
     VALUES ($1, $2, $3, $4, 'running')
     RETURNING id`,
    [closingEpoch, DRY_RUN, vaultSol, totalYield],
  );
  const runId = run.id;

  // ----- short-circuit if nothing to do -----
  if (totalYield <= 0) {
    await q(`UPDATE settler_runs SET status='skipped', finished_at=now(), error=$2 WHERE id=$1`,
      [runId, "no yield"]);
    console.log("No yield accumulated. Nothing to do.");
    return;
  }
  if (vaultSol <= 0.001) {
    // Vault empty: carry every community's yield forward, mark skipped.
    for (const c of merged) {
      await q(
        `INSERT INTO carry_yield (community_id, yield_pct, updated_at)
         VALUES ($1, $2, now())
         ON CONFLICT (community_id) DO UPDATE SET yield_pct = EXCLUDED.yield_pct, updated_at = now()`,
        [c.community_id, c.yieldPct],
      );
    }
    // House yield is reset (it's now in carry).
    if (!DRY_RUN) await q(`UPDATE house_state SET epoch_yield = 0`);
    await q(`UPDATE settler_runs SET status='skipped', finished_at=now(), vault_sol_end=$2, error='vault empty' WHERE id=$1`,
      [runId, vaultSol]);
    console.log("Vault empty — yield carried forward, no swaps executed.");
    return;
  }

  // ----- compute spend pool -----
  // spend = min(vault × yield/100, vault × cap)
  const consumeFraction = Math.min(totalYield / 100, RELEASE_CAP_PCT);
  const spendSol = vaultSol * consumeFraction;
  const protocolSol = spendSol * PROTOCOL_TAKE_PCT;
  const buybackSol = spendSol - protocolSol;
  console.log(`Consume fraction: ${(consumeFraction * 100).toFixed(2)}%`);
  console.log(`Spend SOL: ${spendSol.toFixed(6)} | protocol: ${protocolSol.toFixed(6)} | buybacks: ${buybackSol.toFixed(6)}`);

  await q(
    `UPDATE settler_runs SET spend_sol=$2, buyback_sol=$3, protocol_sol=$4 WHERE id=$1`,
    [runId, spendSol, buybackSol, protocolSol],
  );

  // ----- per-community swaps -----
  for (const c of merged) {
    const houseShare = c.yieldPct / totalYield;
    const houseSol = buybackSol * houseShare;
    const houseLamports = Math.floor(houseSol * LAMPORTS_PER_SOL);

    const swapRow = await one(
      `INSERT INTO settler_swaps (run_id, community_id, yield_pct, sol_input, status)
       VALUES ($1, $2, $3, $4, 'pending') RETURNING id`,
      [runId, c.community_id, c.yieldPct, houseSol],
    );

    if (!c.mint) {
      await q(`UPDATE settler_swaps SET status='skipped', error='no mint configured', finished_at=now() WHERE id=$1`, [swapRow.id]);
      console.log(`  ${c.community_id}: SKIP (no mint configured)`);
      continue;
    }
    if (houseLamports < 10_000) {
      await q(`UPDATE settler_swaps SET status='skipped', error='dust', finished_at=now() WHERE id=$1`, [swapRow.id]);
      console.log(`  ${c.community_id}: SKIP (dust ${houseSol.toFixed(9)} SOL)`);
      continue;
    }

    console.log(`  ${c.community_id}: ${(houseShare * 100).toFixed(2)}% share → ${houseSol.toFixed(6)} SOL`);

    if (DRY_RUN) {
      try {
        const quote = await quoteSolToToken(houseLamports, c.mint);
        const out = Number(quote.outAmount) / Math.pow(10, c.decimals || 6);
        console.log(`    quote: ${out} ${c.community_id} (slippage cap ${quote.slippageBps} bps)`);
        await q(`UPDATE settler_swaps SET tokens_out=$2, status='done', finished_at=now() WHERE id=$1`,
          [swapRow.id, Number(quote.outAmount)]);
      } catch (err) {
        console.warn(`    ${c.community_id} quote failed:`, err.message);
        await q(`UPDATE settler_swaps SET status='failed', error=$2, finished_at=now() WHERE id=$1`,
          [swapRow.id, err.message]);
      }
      continue;
    }

    // EXECUTE path
    let outAmount = 0;
    try {
      const quote = await quoteSolToToken(houseLamports, c.mint);
      const result = await executeSwap(quote);
      outAmount = result.outAmount;
      console.log(`    ✓ swapped: ${result.txid.slice(0,12)}…  out=${outAmount}`);
      await q(`UPDATE settler_swaps SET tokens_out=$2, swap_txid=$3, status='done', finished_at=now() WHERE id=$1`,
        [swapRow.id, outAmount, result.txid]);
    } catch (err) {
      console.warn(`    ✗ ${c.community_id}:`, err.message);
      await q(`UPDATE settler_swaps SET status='failed', error=$2, finished_at=now() WHERE id=$1`,
        [swapRow.id, err.message]);
      continue;
    }

    // ----- distribute -----
    const payouts = await computePayouts({
      communityId: c.community_id,
      epochIdx: closingEpoch,
      totalTokensAtomic: outAmount,
      mintDecimals: c.decimals || 6,
    });
    if (payouts.length === 0) {
      console.log(`    no eligible members — tokens remain in vault as protocol revenue`);
      continue;
    }
    for (const p of payouts) {
      try {
        const txid = await transferToRecipient({
          mint: c.mint,
          recipient: p.wallet,
          amountAtomic: p.tokens_paid_atomic,
        });
        await recordPayoutRow({
          runId, communityId: c.community_id, wallet: p.wallet,
          weight: p.weight, share: p.share, tokensPaid: p.tokens_paid_atomic,
          txid, status: "done",
        });
        console.log(`    → ${p.wallet.slice(0,8)}… ${p.tokens_paid_atomic} (share ${(p.share*100).toFixed(2)}%)`);
      } catch (err) {
        await recordPayoutRow({
          runId, communityId: c.community_id, wallet: p.wallet,
          weight: p.weight, share: p.share, tokensPaid: p.tokens_paid_atomic,
          status: "failed", error: err.message,
        });
        console.warn(`    ✗ ${p.wallet.slice(0,8)}…:`, err.message);
      }
    }
  }

  // ----- finalize: reset yield only if we actually executed -----
  if (!DRY_RUN) {
    await q(`UPDATE house_state SET epoch_yield = 0`);
    await q(`UPDATE carry_yield SET yield_pct = 0`);
  }
  const finalLamports = await getSolBalanceLamports(vaultPubkey);
  await q(
    `UPDATE settler_runs SET status='done', finished_at=now(), vault_sol_end=$2 WHERE id=$1`,
    [runId, finalLamports / LAMPORTS_PER_SOL],
  );
  console.log(`\n=== Run ${runId} done ===\n`);
}
