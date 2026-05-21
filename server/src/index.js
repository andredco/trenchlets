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
import { startPriceFeed, getSnapshot } from "./prices.js";
import { attachWS } from "./ws.js";

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

// ---- STATIC FRONTEND ----
// Serve the Vite build (../dist). Falls back to index.html only for
// genuine SPA routes — /play.html and /docs.html serve their own files.
app.use(express.static(DIST_DIR, { extensions: ["html"] }));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/ws")) return next();
  if (req.path.endsWith(".html") || req.path.includes(".")) return next();
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

// ---- HTTP + WS ----
const server = http.createServer(app);
attachWS(server);
server.listen(PORT, () => {
  console.log(`Trenchlets server listening on :${PORT}`);
  console.log(`Static frontend: ${DIST_DIR}`);
  console.log(`Epoch: ${currentEpochIdx()}`);
  if (TRACK_MINTS.length > 0) {
    console.log(`Tracking ${TRACK_MINTS.length} token mints for prices`);
    startPriceFeed(TRACK_MINTS);
  } else {
    console.log("No TRACK_MINTS configured — price feed idle until tokens are configured");
  }
});

// Graceful shutdown
for (const sig of ["SIGTERM", "SIGINT"]) {
  process.on(sig, () => {
    console.log(`Received ${sig}, closing server`);
    server.close(() => process.exit(0));
  });
}
