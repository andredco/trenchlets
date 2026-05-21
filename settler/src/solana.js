// Solana helpers: load keypair, get balances, compute associated token accounts.
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
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
  let arr;
  try { arr = JSON.parse(VAULT_KEYPAIR_JSON); }
  catch { throw new Error("VAULT_KEYPAIR is not valid JSON (expected array of 64 bytes)"); }
  if (!Array.isArray(arr) || arr.length !== 64) {
    throw new Error("VAULT_KEYPAIR must be a JSON array of 64 bytes");
  }
  _kp = Keypair.fromSecretKey(Uint8Array.from(arr));
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
