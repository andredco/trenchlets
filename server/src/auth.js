// =========================================================
// Wallet signature verification (Solana Ed25519)
// =========================================================
// Pattern:
//   1. Client requests a nonce from /api/auth/nonce?wallet=<pubkey>
//   2. Server returns { nonce, message } where message includes the nonce
//   3. Client signs `message` with Phantom (signMessage), sends signature
//   4. Server verifies signature against pubkey, issues a session token
//
// Sessions are short-lived (1h), refreshed silently when WS reconnects.
// We use anonymous browse + sign-for-actions: a session is only required
// when the player submits a contribution, raid, vote, or claims.

import nacl from "tweetnacl";
import bs58 from "bs58";
import crypto from "node:crypto";
import { query, getOne } from "./db/pool.js";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 60 * 60 * 1000;
const nonces = new Map(); // wallet -> { nonce, expiresAt }
const sessions = new Map(); // token -> { wallet, expiresAt, playerId }

export function newNonce(wallet) {
  const nonce = crypto.randomBytes(16).toString("hex");
  const message = `Sign in to Trenchlets\n\nWallet: ${wallet}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`;
  nonces.set(wallet, { nonce, message, expiresAt: Date.now() + NONCE_TTL_MS });
  return { nonce, message };
}

export async function verifySignature(wallet, signatureBase58) {
  const entry = nonces.get(wallet);
  if (!entry || entry.expiresAt < Date.now()) {
    throw new Error("nonce expired or missing");
  }
  let signature;
  let pubkey;
  try {
    signature = bs58.decode(signatureBase58);
    pubkey = bs58.decode(wallet);
  } catch {
    throw new Error("invalid encoding");
  }
  const messageBytes = new TextEncoder().encode(entry.message);
  const ok = nacl.sign.detached.verify(messageBytes, signature, pubkey);
  if (!ok) throw new Error("invalid signature");

  // Sig valid — burn nonce, create or update player, mint session.
  nonces.delete(wallet);

  // Upsert player
  await query(
    `INSERT INTO players (wallet, display_name)
     VALUES ($1, COALESCE((SELECT display_name FROM players WHERE wallet = $1), $2))
     ON CONFLICT (wallet) DO UPDATE SET last_seen = now()`,
    [wallet, defaultName()],
  );
  const player = await getOne("SELECT id, display_name, community_id FROM players WHERE wallet = $1", [wallet]);

  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { wallet, playerId: player.id, expiresAt: Date.now() + SESSION_TTL_MS });
  return { token, player };
}

export function getSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return s;
}

export function refreshSession(token) {
  const s = sessions.get(token);
  if (!s) return null;
  s.expiresAt = Date.now() + SESSION_TTL_MS;
  return s;
}

export function revoke(token) {
  sessions.delete(token);
}

function defaultName() {
  const adj = ["lucky", "chubby", "tiny", "calm", "bold", "spicy", "sleepy", "swift"];
  const noun = ["frog", "cat", "owl", "fox", "wolf", "bear", "lynx", "moth"];
  return `${adj[Math.floor(Math.random() * adj.length)]}_${noun[Math.floor(Math.random() * noun.length)]}_${Math.floor(Math.random() * 99)}`;
}

// Periodically purge expired nonces and sessions.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonces) if (v.expiresAt < now) nonces.delete(k);
  for (const [k, v] of sessions) if (v.expiresAt < now) sessions.delete(k);
}, 60_000);
