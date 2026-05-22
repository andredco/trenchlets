// =========================================================
// Trenchlets · server entry
// =========================================================
// Single Railway service. Serves the Vite-built frontend
// (../dist) at /, REST auth + leaderboard at /api/*, and the
// multiplayer websocket at /ws.

import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

import { newNonce, verifySignature, refreshSession, revoke } from "./auth.js";
import { getTier } from "./tier.js";
import { getLeaderboard, getHouseStandings, currentEpochIdx } from "./contributions.js";
import { loadEpochAnchor, getEpochAnchor, EPOCH_LENGTH_MS } from "./epoch.js";
import { startPriceFeed, getSnapshot } from "./prices.js";
import { attachWS } from "./ws.js";
import { adminRouter } from "./admin/routes.js";
import { seedCommunityMeta } from "./seedCommunities.js";
import { startVaultWatcher, getVaultSnapshot } from "./vaultWatcher.js";
import { startWorldEvents } from "./worldEvents.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3000;
const DIST_DIR = path.resolve(__dirname, "../../dist");

// Token mints to track for live prices. Replace with real mints once tokens deploy.
const TRACK_MINTS = (process.env.TRACK_MINTS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const app = express();
app.use(express.json({ limit: "32kb" }));
app.set("trust proxy", 1); // Railway puts us behind a proxy

// ---- HEALTH ----
app.get("/health", (req, res) => res.json({ ok: true, epoch: currentEpochIdx() }));

// ---- PUBLIC CONFIG ----
// Single source of truth for "what is the current state of the world" that
// the frontend can poll. Lets you set TRENCHLETS_MINT (and other launch
// params) ONCE in Railway env vars and have every page reflect it without
// any code changes.
app.get("/api/config", (req, res) => {
  res.set("Cache-Control", "public, max-age=30"); // brief cache, fast updates
  res.json({
    trenchletsMint: process.env.TRENCHLETS_MINT || "",
    vaultAddress: process.env.VAULT_ADDRESS || "CHAcAiFhnfrKwZ22DmsTu2WVeMaym466n3hWPBWPFGNZ",
    epochLengthMs: EPOCH_LENGTH_MS,
    epochAnchorMs: getEpochAnchor(),
    distributionPct: 50,
    epoch: currentEpochIdx(),
  });
});

// ---- AUTH ----
app.get("/api/auth/nonce", (req, res) => {
  const wallet = String(req.query.wallet || "");
  if (!wallet) return res.status(400).json({ error: "wallet required" });
  const { nonce, message } = newNonce(wallet);
  res.json({ nonce, message });
});

app.post("/api/auth/verify", async (req, res) => {
  try {
    const { wallet, signature } = req.body || {};
    if (!wallet || !signature) return res.status(400).json({ error: "wallet + signature required" });
    const result = await verifySignature(wallet, signature);
    res.json(result);
  } catch (err) {
    res.status(401).json({ error: err.message });
  }
});

app.post("/api/auth/refresh", (req, res) => {
  const { token } = req.body || {};
  const s = refreshSession(token);
  if (!s) return res.status(401).json({ error: "invalid token" });
  res.json({ ok: true, expiresAt: s.expiresAt });
});

app.post("/api/auth/logout", (req, res) => {
  revoke(req.body?.token);
  res.json({ ok: true });
});

// ---- READ-ONLY DATA ----
app.get("/api/standings", async (req, res) => {
  const standings = await getHouseStandings();
  res.json({ epoch: currentEpochIdx(), standings });
});

app.get("/api/leaderboard/:communityId", async (req, res) => {
  const board = await getLeaderboard(req.params.communityId, 25);
  res.json({ board });
});

app.get("/api/tier/:wallet", async (req, res) => {
  try {
    const t = await getTier(req.params.wallet);
    res.json(t);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/prices", (req, res) => {
  res.json(getSnapshot());
});

// Live vault balance (SOL + USD) — polled every 30s from chain.
app.get("/api/vault", (req, res) => {
  res.json(getVaultSnapshot());
});

// ---- TOWN MEETING PROPOSALS ----
// Players submit through the in-game meeting tab. Stored in Postgres
// so the admin dashboard can review every proposal across all clients.
app.get("/api/proposals", async (req, res) => {
  try {
    const { query } = await import("./db/pool.js");
    const rows = (await query(
      `SELECT id, name, ticker, contract, vote_count, created_at, promoted_at
       FROM town_proposals
       ORDER BY vote_count DESC, created_at DESC LIMIT 100`,
    )).rows;
    res.json({ proposals: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/proposals/:id/vote", async (req, res) => {
  try {
    const { hardwareId, wallet } = req.body || {};
    const { resolvePlayer } = await import("./players.js");
    const { query, getOne } = await import("./db/pool.js");
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
    const submitter = await resolvePlayer({ wallet, hardwareId, ip });
    const proposalId = parseInt(req.params.id, 10);
    if (!Number.isFinite(proposalId)) return res.status(400).json({ error: "bad id" });
    await query(
      `INSERT INTO town_votes (proposal_id, player_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [proposalId, submitter.id],
    );
    await query(
      `UPDATE town_proposals
       SET vote_count = (SELECT COUNT(*) FROM town_votes WHERE proposal_id = $1)
       WHERE id = $1`,
      [proposalId],
    );
    const fresh = await getOne("SELECT vote_count FROM town_proposals WHERE id = $1", [proposalId]);
    res.json({ ok: true, voteCount: fresh?.vote_count ?? 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/proposals", async (req, res) => {
  try {
    const { name, ticker, contract, hardwareId, wallet } = req.body || {};
    if (!name || !ticker || !contract) {
      return res.status(400).json({ error: "name, ticker, contract required" });
    }
    if (!/^[A-Za-z0-9]{8,64}$/.test(contract)) {
      return res.status(400).json({ error: "invalid contract address" });
    }
    // Resolve or create the submitter player so we can foreign-key to them.
    const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").toString().split(",")[0].trim();
    const { resolvePlayer } = await import("./players.js");
    const submitter = await resolvePlayer({ wallet, hardwareId, ip });
    // Insert proposal (or accept existing). Auto-vote +1 from the submitter.
    const { query, getOne } = await import("./db/pool.js");
    const existing = await getOne("SELECT id, vote_count FROM town_proposals WHERE contract = $1", [contract]);
    let proposalId;
    if (existing) {
      proposalId = existing.id;
    } else {
      const inserted = await getOne(
        `INSERT INTO town_proposals (name, ticker, contract, submitter, vote_count)
         VALUES ($1, $2, $3, $4, 1) RETURNING id`,
        [name.slice(0, 64), ticker.slice(0, 16), contract, submitter.id],
      );
      proposalId = inserted.id;
    }
    // Record the vote (one per player). Idempotent.
    await query(
      `INSERT INTO town_votes (proposal_id, player_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [proposalId, submitter.id],
    );
    // Recompute vote count from the votes table (source of truth).
    await query(
      `UPDATE town_proposals
       SET vote_count = (SELECT COUNT(*) FROM town_votes WHERE proposal_id = $1)
       WHERE id = $1`,
      [proposalId],
    );
    res.json({ ok: true, proposalId });
  } catch (err) {
    console.warn("proposal submit failed:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- ADMIN ----
// Mount the router (handles /admin/api/*, /admin/, etc).
app.use("/admin", adminRouter());

// ---- LEGACY REDIRECT ----
// /play.html (and bare /play) → /world. Keeps old bookmarks/shares working.
app.get(["/play", "/play.html"], (req, res) => res.redirect(301, "/world"));

// ---- STATIC FRONTEND ----
// Serve the Vite build (../dist). Falls back to index.html only for
// genuine SPA routes — /world.html and /docs.html serve their own files.
// Express's static middleware with `extensions: ["html"]` resolves /world
// → world.html, /docs → docs.html automatically.
app.use(express.static(DIST_DIR, { extensions: ["html"] }));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws") || req.path.startsWith("/admin")) return next();
  if (req.path.endsWith(".html") || req.path.includes(".")) return next();
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// ---- HTTP + WS ----
const server = http.createServer(app);
attachWS(server);
server.listen(PORT, async () => {
  console.log(`Trenchlets server listening on :${PORT}`);
  console.log(`Static frontend: ${DIST_DIR}`);
  try { await loadEpochAnchor(); }
  catch (err) { console.warn("loadEpochAnchor failed:", err.message); }
  console.log(`Epoch: ${currentEpochIdx()} (anchor=${new Date(getEpochAnchor()).toISOString()})`);
  try { await seedCommunityMeta(); }
  catch (err) { console.warn("seed community_meta failed:", err.message); }
  if (TRACK_MINTS.length > 0) {
    console.log(`Tracking ${TRACK_MINTS.length} token mints for prices`);
    startPriceFeed(TRACK_MINTS);
  } else {
    console.log("No TRACK_MINTS configured — price feed idle until tokens are configured");
  }
  startVaultWatcher();
  startWorldEvents();
});

// Graceful shutdown
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`Received ${sig}, closing server`);
    server.close(() => process.exit(0));
  });
}
