// =========================================================
// Global world events (server-authoritative)
// =========================================================
// Keeps every connected client in sync on which event is currently
// active. Picks a new event somewhere between MIN_GAP and MAX_GAP
// after the previous one ends, broadcasts the start + end via the
// websocket, and surfaces a helper for new clients joining mid-event.
//
// Mirrors data.js WORLD_EVENTS — when you add an event there, also
// add it here (or import the same module). Keeping them in two
// places to avoid the server importing client-only files (engine
// hooks, sprite atlases, etc).

const WORLD_EVENTS = [
  { id: "solar-eclipse",  title: "SOLAR ECLIPSE",  desc: "Twilight blankets the city. Task progress is doubled.",                    durationMs: 32000, color: "#9d6bff", weight: 3, kind: "boon" },
  { id: "raid-hour",      title: "RAID HOUR",      desc: "All citizens march on the vault. Speed up. Contributions hit hard.",       durationMs: 36000, color: "#1ec77d", weight: 3, kind: "boon" },
  { id: "spotlight",      title: "HOUSE SPOTLIGHT",desc: "A surprise house is haloed. Contributions for them count 3x.",             durationMs: 30000, color: "#5cff9a", weight: 2, kind: "boon", picksHouse: true },
  { id: "whale-visit",    title: "WHALE VISIT",    desc: "A whale crosses Boblets. Walk under it for a vault tip.",               durationMs: 24000, color: "#4ff7ff", weight: 2, kind: "boon" },
  { id: "house-fire",     title: "HOUSE FIRE",     desc: "A house is burning. Run there and press E to bucket-brigade.",             durationMs: 42000, color: "#ff5238", weight: 3, kind: "disaster", picksHouse: true },
  { id: "earthquake",     title: "EARTHQUAKE",     desc: "Tectonic shake. Vault accrual halts. NPCs panic-walk.",                    durationMs: 26000, color: "#b1683a", weight: 2, kind: "disaster" },
  { id: "lightning-storm",title: "LIGHTNING STORM",desc: "Bolts strike random houses. Their task progress freezes.",                 durationMs: 30000, color: "#9d6bff", weight: 2, kind: "disaster" },
  { id: "locust-swarm",   title: "LOCUST SWARM",   desc: "Pests cloud the sky. NPC chatter dims, treasury rate halves.",             durationMs: 28000, color: "#7a8e21", weight: 1, kind: "disaster" },
];

const COMMUNITY_IDS = [
  "triplet","troll","chillhouse","unc","neet",
  "burnie","wtdd","buttcoin","wojak","fartcoin",
];

const MIN_GAP_MS = 12 * 60 * 1000; // 12 minutes between events
const MAX_GAP_MS = 18 * 60 * 1000; // up to 18 — averages ~15

let active = null;          // { id, title, desc, color, durationMs, kind, communityId, startedAt, until }
// First event ~60s after boot so testers don't wait 15 min for the first one.
let nextAt = Date.now() + 60 * 1000;
let listeners = [];

export function getActiveEvent() {
  if (!active) return null;
  // Has it expired? Then it's no longer active.
  if (Date.now() > active.until) return null;
  return active;
}

export function getEventSnapshot() {
  return {
    active: getActiveEvent(),
    nextAt,
    serverNow: Date.now(),
  };
}

export function subscribeEvents(cb) {
  listeners.push(cb);
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

function pickWeighted() {
  const total = WORLD_EVENTS.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * total;
  for (const e of WORLD_EVENTS) {
    r -= e.weight;
    if (r <= 0) return e;
  }
  return WORLD_EVENTS[0];
}

function startEvent() {
  const def = pickWeighted();
  const communityId = def.picksHouse
    ? COMMUNITY_IDS[Math.floor(Math.random() * COMMUNITY_IDS.length)]
    : null;
  const startedAt = Date.now();
  active = {
    id: def.id,
    title: def.title,
    desc: def.desc,
    color: def.color,
    durationMs: def.durationMs,
    kind: def.kind,
    communityId,
    startedAt,
    until: startedAt + def.durationMs,
  };
  // Schedule the next one after this one finishes + a random gap.
  nextAt = active.until + MIN_GAP_MS + Math.floor(Math.random() * (MAX_GAP_MS - MIN_GAP_MS));
  for (const cb of listeners) {
    try { cb({ type: "start", event: active, nextAt, serverNow: Date.now() }); }
    catch (err) { console.warn(err); }
  }
}

function endEvent() {
  const ended = active;
  active = null;
  for (const cb of listeners) {
    try { cb({ type: "end", event: ended, nextAt, serverNow: Date.now() }); }
    catch (err) { console.warn(err); }
  }
}

// Tick every second. Cheap, predictable, no drift.
let interval = null;
export function startWorldEvents() {
  if (interval) return;
  interval = setInterval(() => {
    const now = Date.now();
    if (active && now > active.until) {
      endEvent();
    } else if (!active && now >= nextAt) {
      startEvent();
    }
  }, 1000);
  console.log("world events: scheduler started");
}

export function stopWorldEvents() {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}
