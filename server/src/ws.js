// =========================================================
// WebSocket multiplayer server
// =========================================================
// Handles presence, contributions, chat, and price broadcasts.
// Each connection authenticates as either:
//   • wallet + session token  → full powers
//   • hardware id              → guest, can browse and play
//
// Presence is in-memory (lost on restart, fine — clients reconnect and
// re-broadcast). Contributions, cooldowns, house yield are durable in DB.

import { WebSocketServer } from "ws";
import { resolvePlayer, setDisplayName, setCommunity } from "./players.js";
import { getSession } from "./auth.js";
import { getTier } from "./tier.js";
import {
  submitContribution,
  getCooldown,
  getHouseStandings,
  getLeaderboard,
  currentEpochIdx,
} from "./contributions.js";
import { subscribe as subscribePrices, getSnapshot as priceSnapshot } from "./prices.js";
import { subscribeVault, getVaultSnapshot } from "./vaultWatcher.js";

const TYPES = {
  HELLO: "hello",        // client → server: { wallet?, hardwareId, sessionToken? }
  WELCOME: "welcome",    // server → client: { player, tier, snapshot }
  PRESENCE: "presence",  // bidirectional: { x, y, dir, flipX, community, name }
  PRESENCE_LEAVE: "presence_leave",
  CHAT: "chat",          // bidirectional: { text }
  CONTRIB: "contrib",    // client → server: minigame result
  CONTRIB_OK: "contrib_ok",
  CONTRIB_ERR: "contrib_err",
  RENAME: "rename",      // client → server: { name }
  RENAME_OK: "rename_ok",
  JOIN_HOUSE: "join_house", // client → server: { communityId }
  HOUSE_STATE: "house_state",
  PRICES: "prices",
  VAULT: "vault",
  ERROR: "error",
};

export function attachWS(server) {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const clients = new Map(); // ws -> { player, hardwareId, wallet, presence }

  // Broadcast helpers
  function broadcast(type, payload, exceptWs) {
    const msg = JSON.stringify({ type, payload, ts: Date.now() });
    for (const ws of clients.keys()) {
      if (ws === exceptWs) continue;
      if (ws.readyState === ws.OPEN) ws.send(msg);
    }
  }
  function send(ws, type, payload) {
    if (ws.readyState !== ws.OPEN) return;
    ws.send(JSON.stringify({ type, payload, ts: Date.now() }));
  }

  // Periodic price + house broadcasts
  subscribePrices((snap) => broadcast(TYPES.PRICES, snap));
  subscribeVault((snap) => broadcast(TYPES.VAULT, snap));
  setInterval(async () => {
    try {
      const standings = await getHouseStandings();
      broadcast(TYPES.HOUSE_STATE, { standings, epoch: currentEpochIdx() });
    } catch (err) {
      console.warn("house broadcast failed:", err.message);
    }
  }, 5000);

  wss.on("connection", (ws, req) => {
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
      .toString()
      .split(",")[0]
      .trim();
    const ctx = { ip, player: null, ws };
    clients.set(ws, ctx);

    ws.on("message", async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return send(ws, TYPES.ERROR, { reason: "bad json" });
      }
      try {
        await handleMessage(msg, ctx);
      } catch (err) {
        console.warn("ws message error:", err.message);
        send(ws, TYPES.ERROR, { reason: err.message });
      }
    });

    ws.on("close", () => {
      const c = clients.get(ws);
      if (c?.player) {
        broadcast(TYPES.PRESENCE_LEAVE, { id: c.player.id }, ws);
      }
      clients.delete(ws);
    });

    async function handleMessage(msg, ctx) {
      const { type, payload } = msg;

      // HELLO must come first.
      if (type === TYPES.HELLO) {
        const { wallet, hardwareId, sessionToken, displayName } = payload || {};
        let authed = null;
        if (wallet && sessionToken) {
          const s = getSession(sessionToken);
          if (s && s.wallet === wallet) authed = s;
        }
        const player = await resolvePlayer({
          wallet: authed ? authed.wallet : null,
          hardwareId,
          ip: ctx.ip,
        });
        // If the client sent a displayName (e.g. guest typed one before WS
        // was even welcomed), apply it now. setDisplayName sanitizes input.
        if (displayName && typeof displayName === "string") {
          try {
            const clean = await setDisplayName(player.id, displayName);
            player.display_name = clean;
          } catch {
            /* ignore invalid name; keep the existing one */
          }
        }
        ctx.player = player;
        ctx.authed = !!authed;

        let tier = { tier_id: "shrimp", balance: 0 };
        if (player.wallet) {
          try { tier = await getTier(player.wallet); } catch {}
        }
        const cooldown = await getCooldown(player.id);
        const standings = await getHouseStandings();
        const prices = priceSnapshot();
        send(ws, TYPES.WELCOME, {
          player: {
            id: player.id,
            displayName: player.display_name,
            communityId: player.community_id,
            wallet: player.wallet,
            authed: !!authed,
          },
          tier,
          cooldownMs: cooldown,
          standings,
          prices,
          vault: getVaultSnapshot(),
          epoch: currentEpochIdx(),
        });
        return;
      }

      if (!ctx.player) {
        return send(ws, TYPES.ERROR, { reason: "not_hello" });
      }

      switch (type) {
        case TYPES.PRESENCE: {
          // Throttle is up to the client; we just rebroadcast.
          const presence = {
            id: ctx.player.id,
            displayName: ctx.player.display_name,
            communityId: ctx.player.community_id,
            x: Number(payload.x) || 0,
            y: Number(payload.y) || 0,
            dir: payload.dir || "down",
            flipX: !!payload.flipX,
          };
          ctx.presence = presence;
          broadcast(TYPES.PRESENCE, presence, ws);
          return;
        }

        case TYPES.CHAT: {
          const text = String(payload.text || "").slice(0, 140).trim();
          if (!text) return;
          // Persist last 200, broadcast.
          broadcast(TYPES.CHAT, {
            playerId: ctx.player.id,
            displayName: ctx.player.display_name,
            communityId: ctx.player.community_id,
            text,
          });
          return;
        }

        case TYPES.RENAME: {
          const cleanName = await setDisplayName(ctx.player.id, payload.name);
          ctx.player.display_name = cleanName;
          send(ws, TYPES.RENAME_OK, { displayName: cleanName });
          return;
        }

        case TYPES.JOIN_HOUSE: {
          const communityId = String(payload.communityId || "").slice(0, 32);
          await setCommunity(ctx.player.id, communityId);
          ctx.player.community_id = communityId;
          send(ws, TYPES.WELCOME, {
            player: {
              id: ctx.player.id,
              displayName: ctx.player.display_name,
              communityId,
              wallet: ctx.player.wallet,
              authed: !!ctx.authed,
            },
          });
          return;
        }

        case TYPES.CONTRIB: {
          // Both authed wallets and guests can submit. Tier multiplier
          // only applies if a wallet is signed in. Guests run at SHRIMP
          // tier (1.0x), no airdrop weight downstream.
          let tierId = "shrimp";
          if (ctx.authed && ctx.player.wallet) {
            try { tierId = (await getTier(ctx.player.wallet)).tier_id; } catch {}
          }
          try {
            const result = await submitContribution({
              playerId: ctx.player.id,
              communityId: payload.communityId,
              taskId: payload.taskId,
              minigameId: payload.minigameId,
              difficulty: payload.difficulty,
              rawScore: Number(payload.rawScore),
              durationMs: Number(payload.durationMs),
              eventMult: Number(payload.eventMult) || 1,
              tierId,
            });
            send(ws, TYPES.CONTRIB_OK, result);
            // Refresh standings broadcast immediately.
            const standings = await getHouseStandings();
            broadcast(TYPES.HOUSE_STATE, { standings, epoch: currentEpochIdx() });
          } catch (err) {
            send(ws, TYPES.CONTRIB_ERR, { reason: err.message });
          }
          return;
        }

        default:
          send(ws, TYPES.ERROR, { reason: "unknown_type" });
      }
    }
  });

  return { wss, clients };
}
