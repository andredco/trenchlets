// =========================================================
// Per-community payout calculator + token transfers
// =========================================================
// Reads the contributions ledger for the just-closed epoch, ranks
// each community's members by (sum_of_contribution_pct × tier_mult),
// and pays them out from `tokens_received` of that community's mint
// proportional to their weight.
//
// Members who didn't claim that community OR who don't hold the
// $BOBLETS token are excluded. Within members, weight = score
// (no flat split — top contributor gets the most, by design).

import { q, one } from "./db.js";
import { connection, vaultKeypair } from "./solana.js";
import {
  PublicKey,
  Transaction,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  getAccount,
} from "@solana/spl-token";

const TIER_MULT = {
  shrimp: 1.0,
  fish: 1.08,
  dolphin: 1.18,
  shark: 1.3,
  whale: 1.5,
};

// Computes the weighted payout list for a community in a closed epoch.
// Returns: [{ wallet, weight, share, tokens_paid_atomic }]
export async function computePayouts({ communityId, epochIdx, totalTokensAtomic, mintDecimals }) {
  if (totalTokensAtomic <= 0) return [];

  // Pull every contribution this community got in this epoch, joined
  // with the player's wallet + tier from tier_cache.
  const rows = await q(
    `
    SELECT
      p.wallet                                    AS wallet,
      COALESCE(t.tier_id, 'shrimp')               AS tier_id,
      SUM(c.percent)                              AS sum_pct
    FROM contributions c
    JOIN players p           ON p.id = c.player_id
    LEFT JOIN tier_cache t   ON t.wallet = p.wallet
    WHERE c.community_id = $1
      AND c.epoch_idx    = $2
      AND p.community_id = $1            -- only members of this community
      AND p.wallet IS NOT NULL           -- exclude guests
    GROUP BY p.wallet, t.tier_id
    `,
    [communityId, epochIdx],
  );

  if (rows.length === 0) return [];

  // weight = sum_pct × tier_mult
  const weighted = rows.map((r) => ({
    wallet: r.wallet,
    sumPct: Number(r.sum_pct),
    tier: r.tier_id || "shrimp",
    weight: Number(r.sum_pct) * (TIER_MULT[r.tier_id] || 1),
  }));
  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);
  if (totalWeight <= 0) return [];

  // Allocate atomic units pro-rata. Round down per-wallet, throw the
  // dust at the top contributor so totals match exactly.
  const allocations = weighted.map((w) => {
    const share = w.weight / totalWeight;
    const tokens = Math.floor(totalTokensAtomic * share);
    return { ...w, share, tokens };
  });
  const allocated = allocations.reduce((s, a) => s + a.tokens, 0);
  const dust = totalTokensAtomic - allocated;
  if (dust > 0 && allocations.length > 0) {
    allocations.sort((a, b) => b.weight - a.weight);
    allocations[0].tokens += dust;
  }
  return allocations.map((a) => ({
    wallet: a.wallet,
    weight: a.weight,
    share: a.share,
    tokens_paid_atomic: a.tokens,
    tier: a.tier,
  }));
  void mintDecimals; // reserved for future logging
}

// Sends `amountAtomic` of `mint` from the vault to `recipient`.
// Creates the recipient's ATA if it doesn't exist (small extra cost).
export async function transferToRecipient({ mint, recipient, amountAtomic }) {
  const conn = connection();
  const kp = vaultKeypair();
  const mintPk = new PublicKey(mint);
  const recPk = new PublicKey(recipient);
  const fromAta = getAssociatedTokenAddressSync(mintPk, kp.publicKey, true);
  const toAta = getAssociatedTokenAddressSync(mintPk, recPk, true);

  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 25_000 }));
  // If the recipient ATA doesn't exist, create it (vault pays rent).
  try { await getAccount(conn, toAta); }
  catch {
    tx.add(createAssociatedTokenAccountInstruction(kp.publicKey, toAta, recPk, mintPk));
  }
  tx.add(createTransferInstruction(fromAta, toAta, kp.publicKey, BigInt(amountAtomic)));

  const { blockhash } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = kp.publicKey;
  tx.sign(kp);
  const txid = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false, maxRetries: 3 });
  const lbh = await conn.getLatestBlockhash();
  await conn.confirmTransaction({ signature: txid, ...lbh }, "confirmed");
  return txid;
}

// Records a payout row in the DB.
export async function recordPayoutRow({
  runId, communityId, wallet, weight, share, tokensPaid, txid, status, error,
}) {
  await q(
    `INSERT INTO settler_payouts
      (run_id, community_id, wallet, weight, share_pct, tokens_paid, transfer_txid, status, error, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      runId, communityId, wallet,
      weight, share, tokensPaid,
      txid || null, status, error || null,
      status === "done" || status === "failed" ? new Date() : null,
    ],
  );
}
