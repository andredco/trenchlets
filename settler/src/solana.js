// Solana helpers: load keypair, get balances, compute associated token accounts.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import bs58 from "bs58";
import { RPC_URL, VAULT_KEYPAIR_JSON } from "./config.js";

let _conn = null;
export function connection() {
  if (_conn) return _conn;
  if (!RPC_URL) throw new Error("RPC_URL not set");
  _conn = new Connection(RPC_URL, { commitment: "confirmed" });
  return _conn;
}

let _kp = null;
export function vaultKeypair() {
  if (_kp) return _kp;
  if (!VAULT_KEYPAIR_JSON) throw new Error("VAULT_KEYPAIR not set");
  const raw = VAULT_KEYPAIR_JSON.trim();
  let secret;
  // Accept either format:
  //   1. JSON array of 64 bytes: [12,34,...,89]   (output of `solana-keygen new`)
  //   2. Base58 string                            (what Phantom exports)
  if (raw.startsWith("[")) {
    let arr;
    try { arr = JSON.parse(raw); }
    catch { throw new Error("VAULT_KEYPAIR looks like JSON but is not parseable"); }
    if (!Array.isArray(arr) || arr.length !== 64) {
      throw new Error("VAULT_KEYPAIR JSON must be a 64-byte array");
    }
    secret = Uint8Array.from(arr);
  } else {
    // Base58 — Phantom export format. Decode and validate length.
    try {
      secret = bs58.decode(raw);
    } catch {
      throw new Error("VAULT_KEYPAIR is not valid base58");
    }
    if (secret.length !== 64) {
      throw new Error(`VAULT_KEYPAIR base58 decoded to ${secret.length} bytes, expected 64`);
    }
  }
  _kp = Keypair.fromSecretKey(secret);
  return _kp;
}

export async function getSolBalanceLamports(pubkey) {
  return await connection().getBalance(new PublicKey(pubkey));
}

export async function getTokenBalance(walletPubkey, mintPubkey) {
  // Returns { uiAmount, decimals, atomic } or null if no account.
  const ata = getAssociatedTokenAddressSync(
    new PublicKey(mintPubkey),
    new PublicKey(walletPubkey),
    true,
  );
  try {
    const acc = await getAccount(connection(), ata);
    const mintInfo = await connection().getParsedAccountInfo(new PublicKey(mintPubkey));
    const decimals = mintInfo.value?.data?.parsed?.info?.decimals ?? 6;
    const atomic = Number(acc.amount);
    return {
      ata,
      atomic,
      decimals,
      uiAmount: atomic / Math.pow(10, decimals),
    };
  } catch {
    return null;
  }
}

export { Keypair, Connection, PublicKey, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync, createAssociatedTokenAccountInstruction };
