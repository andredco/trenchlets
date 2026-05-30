// =========================================================
// Boblets · multiplayer client
// =========================================================
// Single WebSocket connection to /ws on the same origin as the
// page (so trenchlets.fun serves both pages and game). Handles:
//   • HELLO → WELCOME handshake (wallet OR hardware id)
//   • Live presence broadcasts (other players walking around)
//   • Contribution submission with server-side validation
//   • Display name editing
//   • Live price + house standings updates

const WS_URL = computeWsUrl();
const HARDWARE_KEY = "boblets-hardware-id";
const NAME_KEY = "boblets-display-name";
const SESSION_KEY = "boblets-session";

const handlers = {};
let ws = null;
let helloed = false;
let me = null; // { id, displayName, communityId, wallet, authed }
let reconnectTimer = null;
let pendingPresence = null;

function computeWsUrl() {
  if (typeof window === "undefined") return "";
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

function getHardwareId() {
  let id = localStorage.getItem(HARDWARE_KEY);
  if (!id) {
    id = "hw_" + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
    localStorage.setItem(HARDWARE_KEY, id);
  }
  return id;
}

export function getDisplayName() {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setDisplayName(name) {
  localStorage.setItem(NAME_KEY, name);
  // Try to send immediately; if the websocket isn't open or hasn't
  // welcomed us yet, the value lives in localStorage and gets replayed
  // by sendHello() on the next connection.
  send("rename", { name });
}

function getSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.expiresAt && s.expiresAt < Date.now()) return null;
    return s;
  } catch { return null; }
}

export function saveSession(token, wallet, expiresAt) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token, wallet, expiresAt }));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

export function getMe() {
  return me;
}

function connect() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
  try {
    ws = new WebSocket(WS_URL);
  } catch (err) {
    console.warn("ws connect failed:", err);
    scheduleReconnect();
    return;
  }
  ws.addEventListener("open", () => {
    helloed = false;
    sendHello();
  });
  ws.addEventListener("message", (e) => {
    let msg;
    try { msg = JSON.parse(e.data); } catch { return; }
    const { type, payload } = msg;
    if (type === "welcome") {
      me = payload.player;
      helloed = true;
      // Replay any pending presence the moment we're authenticated.
      if (pendingPresence) {
        send("presence", pendingPresence);
        pendingPresence = null;
      }
    }
    const list = handlers[type];
    if (list) for (const cb of list) try { cb(payload); } catch (err) { console.warn(err); }
  });
  ws.addEventListener("close", () => {
    helloed = false;
    scheduleReconnect();
  });
  ws.addEventListener("error", () => {
    try { ws.close(); } catch {}
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, 2000 + Math.random() * 1500);
}

function sendHello() {
  const session = getSession();
  const hardwareId = getHardwareId();
  send("hello", {
    wallet: session?.wallet || null,
    hardwareId,
    sessionToken: session?.token || null,
    displayName: getDisplayName() || undefined,
  });
}

export function send(type, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    if (type === "presence") pendingPresence = payload; // most recent only
    return false;
  }
  if (type !== "hello" && !helloed) {
    if (type === "presence") pendingPresence = payload;
    return false;
  }
  try {
    ws.send(JSON.stringify({ type, payload }));
    return true;
  } catch (err) {
    return false;
  }
}

export function on(type, cb) {
  (handlers[type] ||= []).push(cb);
  return () => { handlers[type] = (handlers[type] || []).filter((h) => h !== cb); };
}

export function off(type, cb) {
  if (handlers[type]) handlers[type] = handlers[type].filter((h) => h !== cb);
}

// Auto-connect on import.
if (typeof window !== "undefined") {
  connect();
}

// Compatibility shim — old code imports getMultiplayer / MSG.
// We expose the same shape but route everything through the new ws layer.
export const MSG = {
  PRESENCE: "presence",
  CONTRIBUTION: "contrib",
  CHAT: "chat",
  TASK_RESOLVED: "house_state",
  EPOCH_STATE: "house_state",
};

export function getMultiplayer() {
  return {
    send,
    on,
    off,
  };
}

export function getPlayerId() {
  return me?.id || getHardwareId();
}
