// =========================================================
// Jupiter swap helper (SOL → community token)
// =========================================================
// Uses Jupiter's free v6 swap API. We:
//   1. Quote the swap with our slippage cap
//   2. Get a serialized transaction the vault keypair signs
//   3. Send + confirm
//
// Per-swap failures are isolated — the caller logs them and moves on
// to the next community.

import { Connection, VersionedTransaction, PublicKey } from "@solana/web3.js";
import { connection, vaultKeypair } from "./solana.js";
import { SLIPPAGE_BPS, WSOL_MINT } from "./config.js";

const JUP_BASE = "https://quote-api.jup.ag/v6";

// Quote a swap of `lamportsIn` of SOL into `outputMint`.
// Returns the Jupiter quote object, or throws.
export async function quoteSolToToken(lamportsIn, outputMint) {
  const url = new URL(`${JUP_BASE}/quote`);
  url.searchParams.set("inputMint", WSOL_MINT);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", String(lamportsIn));
  url.searchParams.set("slippageBps", String(SLIPPAGE_BPS));
  url.searchParams.set("onlyDirectRoutes", "false");
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Jupiter quote ${res.status}: ${await res.text()}`);
  const quote = await res.json();
  if (!quote || !quote.outAmount) throw new Error("no route found");
  return quote;
}

// Execute the quote we received. Returns { txid, outAmount } on success.
export async function executeSwap(quote) {
  const kp = vaultKeypair();
  const swapRes = await fetch(`${JUP_BASE}/swap`, {
    method: "POST",
    headers: { "content-type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: kp.publicKey.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!swapRes.ok) throw new Error(`Jupiter swap build ${swapRes.status}: ${await swapRes.text()}`);
  const { swapTransaction } = await swapRes.json();
  if (!swapTransaction) throw new Error("Jupiter returned empty transaction");

  const conn = connection();
  const txBuf = Buffer.from(swapTransaction, "base64");
  const tx = VersionedTransaction.deserialize(txBuf);
  tx.sign([kp]);

  const txid = await conn.sendTransaction(tx, {
    skipPreflight: false,
    maxRetries: 3,
  });
  const latestBlockhash = await conn.getLatestBlockhash();
  await conn.confirmTransaction(
    { signature: txid, ...latestBlockhash },
    "confirmed",
  );
  return { txid, outAmount: Number(quote.outAmount) };
}
