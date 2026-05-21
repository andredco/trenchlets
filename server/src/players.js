// =========================================================
// Player identity (wallet OR hardware id) + display name
// =========================================================
// Display name is editable, sticks to the player record. For
// guests, the hardware id is the stable identifier — they can
// change their name and it persists across sessions on the same
// device.

import crypto from "node:crypto";
import { query, getOne } from "./db/pool.js";

const NAME_MAX = 24;
const NAME_BAN = /[<>"'\\]/;

// Resolves or creates a player by wallet (signed in) or hardware id (guest).
// Returns { id, display_name, community_id, wallet, hardware_id }.
export async function resolvePlayer({ wallet, hardwareId, ip }) {
  if (wallet) {
    let p = await getOne(
      "SELECT id, display_name, community_id, wallet, hardware_id FROM players WHERE wallet = $1",
      [wallet],
    );
    if (!p) {
      p = await getOne(
        `INSERT INTO players (wallet, display_name, ip_hash)
         VALUES ($1, $2, $3) RETURNING id, display_name, community_id, wallet, hardware_id`,
        [wallet, defaultName(), hashIp(ip)],
      );
    } else {
      await query("UPDATE players SET last_seen = now() WHERE id = $1", [p.id]);
    }
    return p;
  }
  if (hardwareId) {
    let p = await getOne(
      "SELECT id, display_name, community_id, wallet, hardware_id FROM players WHERE hardware_id = $1",
      [hardwareId],
    );
    if (!p) {
      p = await getOne(
        `INSERT INTO players (hardware_id, display_name, ip_hash)
         VALUES ($1, $2, $3) RETURNING id, display_name, community_id, wallet, hardware_id`,
        [hardwareId, defaultName(), hashIp(ip)],
      );
    } else {
      await query("UPDATE players SET last_seen = now() WHERE id = $1", [p.id]);
    }
    return p;
  }
  throw new Error("must provide wallet or hardwareId");
}

export async function setDisplayName(playerId, name) {
  const clean = sanitizeName(name);
  if (!clean) throw new Error("invalid name");
  // Names don't need to be globally unique — easier UX. We just store and serve.
  await query("UPDATE players SET display_name = $1 WHERE id = $2", [clean, playerId]);
  return clean;
}

export async function setCommunity(playerId, communityId) {
  await query("UPDATE players SET community_id = $1 WHERE id = $2", [communityId, playerId]);
}

export function sanitizeName(raw) {
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (t.length === 0 || t.length > NAME_MAX) return null;
  if (NAME_BAN.test(t)) return null;
  return t;
}

function hashIp(ip) {
  if (!ip) return null;
  const salt = process.env.IP_SALT || "trenchlets-default-salt-rotate-me";
  return crypto.createHash("sha256").update(salt + ip).digest("hex");
}

function defaultName() {
  const adj = ["lucky", "chubby", "tiny", "calm", "bold", "spicy", "sleepy", "swift"];
  const noun = ["frog", "cat", "owl", "fox", "wolf", "bear", "lynx", "moth"];
  return `${adj[Math.floor(Math.random() * adj.length)]}_${noun[Math.floor(Math.random() * noun.length)]}_${Math.floor(Math.random() * 99)}`;
}
