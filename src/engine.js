// =========================================================
// Pumpcity · engine
// Renderer, game loop, player, NPCs, particles, events.
// =========================================================

import {
  TUNING,
  COMMUNITIES,
  WORLD_EVENTS,
  GENERIC_CHAT,
  STARTING_PUMPTOWN,
  CLAIM_LOCK_MS,
  tierFor,
} from "./data.js";
import {
  bakeCharacterHD,
  makeCharacterPalette,
  HAIR_COLORS,
  SKIN_TONES,
  OBJ_SPRITES,
  VAULT_SPRITE,
  TOTEM_SPRITE,
  BILLBOARD_SPRITE,
  HOUSE_SPRITE,
  FOUNTAIN_SPRITE,
  WHALE_SPRITE,
  OBJECT_PALETTE_BASE,
  getBaked,
  getTreeVariant,
  HD_TREE,
  getHDVault,
  HD_VAULT,
  HD_CHAR,
  TRENCHLET_ATLAS,
  getTrenchletAtlasFrame,
  getTrenchletAtlasImage,
  getGeneratedAtlasImage,
  getGeneratedFrame,
  getHDHouse,
  getHDTotem,
  getHDBillboard,
  getHDFountain,
  getHDLamp,
  getHDBush,
  getHDRock,
  getHDFlower,
  HD_HOUSE,
  HD_TOTEM,
  HD_BILLBOARD,
  HD_FOUNTAIN,
  HD_LAMP,
  HD_BUSH,
  HD_ROCK,
  HD_FLOWER,
} from "./sprites.js";
import {
  drawTiles,
  generateWorld,
  isBlocked,
  clampToWorld,
  worldDimensions,
  TILE_TYPES,
} from "./world.js";

const { GAME_W, GAME_H, TILE } = TUNING;

// =================== STATE ===================

export const state = {
  world: null,
  player: null,
  npcs: [],
  particles: [],
  floats: [],
  coins: [],
  whale: null,
  cam: { x: 0, y: 0 },
  time: { totalMs: 0, dayPhase: 0 },
  event: { active: null, until: 0, nextAt: 0, communityId: null },
  // disasters carry richer metadata than boon events (target house, hp, etc.)
  disaster: { active: null, until: 0, targetId: null, hp: 1 },
  // Vault, treasury, and per-house balances all start at 0. Real values
  // come from on-chain reads (vault wallet) and player contributions.
  // `vault` is the USD figure shown in the HUD; `vaultSol` is the raw
  // SOL balance (both arrive on the WS "vault" + "welcome" payloads).
  vault: 0,
  vaultSol: 0,
  vaultRate: 0,
  communityVault: Object.fromEntries(COMMUNITIES.map((c) => [c.id, 0])),
  pumptownTreasury: 0,
  taskState: {},
  raidLog: [],
  // Remote players (other connected wallets). Populated by main.js from
  // websocket presence broadcasts. id → { x, y, dir, flipX, displayName,
  // communityId, sprites, lastSeen }
  remotePlayers: new Map(),
  ui: {
    splashOpen: true,
    chatFocused: false,
    promptKind: null,
    promptText: "",
    promptTarget: null,
    interactCooldown: 0,
  },
  input: {
    keys: new Set(),
    touch: { dx: 0, dy: 0, active: false },
  },
  audio: { ctx: null, muted: false },
  rng: 1234567,
  lastFrame: 0,
  hooks: {
    onContribute: () => {},
    onResolve: () => {},
    onEvent: () => {},
    onPlayerCommunityChange: () => {},
    onChat: () => {},
    onInteractTarget: () => {},
    onResolveSplit: () => {},
    onClaim: () => {},
  },
};

let displayCanvas;
let ctx;
let minimapCanvas;
let minimapCtx;

// HD super-sampling: the on-screen canvas is HD_SCALE× the logical render
// resolution. The main 2D context applies a 3x transform so existing draw
// code keeps using logical (540x300) coordinates — those drawings get
// crisp pixel scaling automatically. HD assets (ground, tree, vault,
// character) bake at HD_SCALE× their logical size and use drawHD() to
// blit at native HD pixel density. That's where the extra pixel budget
// actually lives.
export const HD_SCALE = 3;

function drawHD(cnv, lx, ly, lw, lh) {
  // Draw a HD-density canvas at logical (lx,ly) of logical size (lw,lh)
  // bypassing the HD ctx transform so its native pixels map 1:1 to
  // backing-store HD pixels.
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(
    cnv,
    0,
    0,
    cnv.width,
    cnv.height,
    Math.floor(lx * HD_SCALE),
    Math.floor(ly * HD_SCALE),
    lw * HD_SCALE,
    lh * HD_SCALE,
  );
  ctx.restore();
}

// =================== INIT ===================

export function initEngine(canvas, minimap) {
  displayCanvas = canvas;
  displayCanvas.width = GAME_W * HD_SCALE;
  displayCanvas.height = GAME_H * HD_SCALE;
  ctx = displayCanvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.setTransform(HD_SCALE, 0, 0, HD_SCALE, 0, 0);
  minimapCanvas = minimap;
  minimapCtx = minimap.getContext("2d");
  minimapCtx.imageSmoothingEnabled = false;
  state.world = generateWorld();
  initPlayer();
  spawnNPCs();
  scheduleNextEvent();
}

function initPlayer() {
  const spawn = pickSpawn();
  const palette = makeCharacterPalette(
    { color: "#1ec77d", accent: "#15945d", body: "#1ec77d", bodyShade: "#0a4a2a" },
    HAIR_COLORS[3],
    SKIN_TONES[0],
  );
  state.player = {
    x: spawn.x,
    y: spawn.y,
    vx: 0,
    vy: 0,
    dir: "up",
    flipX: false,
    moving: false,
    animFrame: 0,
    animTimer: 0,
    name: "trenchlet",
    community: null,
    wallet: null,
    palette,
    sprites: bakeCharacterHD(palette),
    bubble: null,
    glow: 600,
    pumptownBalance: STARTING_PUMPTOWN,
    tier: tierFor(STARTING_PUMPTOWN),
    unclaimedShare: 0,
    totalClaimed: 0,
    contribCount: 0,
    firstPlayedAt: Date.now(),
  };
  state.cam.x = state.player.x - GAME_W / 2;
  state.cam.y = state.player.y - GAME_H / 2;
}

function pickSpawn() {
  const dims = worldDimensions();
  return { x: dims.w / 2, y: dims.h / 2 + 30 };
}

function spawnNPCs() {
  // Multiplayer-only: the world only renders real players received via
  // the websocket. No mock NPCs walking around any more.
  state.npcs = [];
}

function makeNPC(community) {
  const hair = HAIR_COLORS[Math.floor(Math.random() * HAIR_COLORS.length)];
  const skin = SKIN_TONES[Math.floor(Math.random() * SKIN_TONES.length)];
  const palette = makeCharacterPalette(community, hair, skin);
  const bx = community.bbox.tx * TILE + Math.random() * community.bbox.tw * TILE;
  const by = community.bbox.ty * TILE + Math.random() * community.bbox.th * TILE;
  return {
    x: bx,
    y: by,
    vx: 0,
    vy: 0,
    dir: ["down", "up", "side"][Math.floor(Math.random() * 3)],
    flipX: Math.random() > 0.5,
    moving: false,
    animFrame: 0,
    animTimer: Math.random() * 1000,
    community,
    palette,
    sprites: bakeCharacterHD(palette),
    target: { x: bx, y: by },
    targetTimer: Math.random() * 3000,
    bubble: null,
    bubbleTimer: 5000 + Math.random() * 8000,
    name: nameForCommunity(community),
    mood: "wander",
  };
}

const NAME_PARTS = [
  "neo",
  "kid",
  "lord",
  "wizard",
  "ape",
  "sniper",
  "frog",
  "deg",
  "sigma",
  "boss",
  "shrimp",
  "whale",
  "trench",
  "raid",
  "boss",
  "ghost",
  "owl",
  "fox",
  "rat",
];

function nameForCommunity(community) {
  const a = NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)];
  const b = NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)];
  return `${community.ticker.toLowerCase()}_${a}${b}${Math.floor(Math.random() * 99)}`;
}

// =================== UPDATE ===================

export function tick(now) {
  const dt = Math.min(48, now - state.lastFrame || 16);
  state.lastFrame = now;
  state.time.totalMs += dt;
  state.time.dayPhase = ((state.time.totalMs / 1000) % 240) / 240;

  if (!state.ui.splashOpen) updatePlayer(dt);
  updateNPCs(dt);
  updateCamera(dt);
  updateParticles(dt);
  updateFloats(dt);
  updateCoins(dt);
  updateWhale(dt);
  updateEvents(dt);
  updateInteraction(dt);
  updateBubbles(dt);
  vaultAccrue(dt);

  render();
  drawMinimap();
}

function updatePlayer(dt) {
  const p = state.player;
  const speed = (state.event.active?.id === "raid-hour" ? 110 : 88) / 1000; // px per ms
  let dx = 0;
  let dy = 0;
  if (state.input.keys.has("w") || state.input.keys.has("arrowup")) dy -= 1;
  if (state.input.keys.has("s") || state.input.keys.has("arrowdown")) dy += 1;
  if (state.input.keys.has("a") || state.input.keys.has("arrowleft")) dx -= 1;
  if (state.input.keys.has("d") || state.input.keys.has("arrowright")) dx += 1;
  if (state.input.touch.active) {
    dx += state.input.touch.dx;
    dy += state.input.touch.dy;
  }

  const len = Math.hypot(dx, dy);
  if (len > 0) {
    dx /= len;
    dy /= len;
  }
  p.moving = len > 0.05;

  if (p.moving) {
    const nx = p.x + dx * speed * dt;
    const ny = p.y + dy * speed * dt;
    if (!isBlocked(state.world, nx, p.y - 2)) p.x = nx;
    if (!isBlocked(state.world, p.x, ny - 2)) p.y = ny;
    const clamped = clampToWorld(p.x, p.y, 6);
    p.x = clamped.x;
    p.y = clamped.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      p.dir = "side";
      p.flipX = dx < 0;
    } else if (dy < 0) {
      p.dir = "up";
      p.flipX = false;
    } else {
      p.dir = "down";
      p.flipX = false;
    }
    p.animTimer += dt;
    while (p.animTimer > 82) {
      p.animTimer -= 82;
      p.animFrame = nextWalkFrame(p.animFrame);
    }
  } else {
    p.animFrame = 0;
    p.animTimer = 0;
  }
  if (p.glow > 0) p.glow -= dt;
}

function updateNPCs(dt) {
  const playerCharging = state.event.active?.id === "raid-hour";
  const eclipse = state.event.active?.id === "solar-eclipse";
  const speedMul = playerCharging ? 1.6 : eclipse ? 0.7 : 1;
  for (const n of state.npcs) {
    n.targetTimer -= dt;
    if (n.targetTimer <= 0) {
      pickNewTarget(n);
      n.targetTimer = 1800 + Math.random() * 3200;
    }
    const tx = n.target.x;
    const ty = n.target.y;
    const dx = tx - n.x;
    const dy = ty - n.y;
    const dist = Math.hypot(dx, dy);
    const speed = (TUNING.NPC_SPEED * 36 * speedMul) / 1000;
    if (dist > 2) {
      const stepX = (dx / dist) * speed * dt;
      const stepY = (dy / dist) * speed * dt;
      const nx = n.x + stepX;
      const ny = n.y + stepY;
      if (!isBlocked(state.world, nx, n.y - 2)) n.x = nx;
      else n.targetTimer = 0;
      if (!isBlocked(state.world, n.x, ny - 2)) n.y = ny;
      else n.targetTimer = 0;
      n.moving = true;
      if (Math.abs(stepX) > Math.abs(stepY)) {
        n.dir = "side";
        n.flipX = stepX < 0;
      } else if (stepY < 0) {
        n.dir = "up";
        n.flipX = false;
      } else {
        n.dir = "down";
        n.flipX = false;
      }
      n.animTimer += dt;
      while (n.animTimer > 110) {
        n.animTimer -= 110;
        n.animFrame = nextWalkFrame(n.animFrame);
      }
    } else {
      n.moving = false;
      n.animFrame = 0;
    }
    // Idle chatter
    n.bubbleTimer -= dt;
    if (n.bubbleTimer <= 0) {
      maybeNPCSay(n);
      n.bubbleTimer = 11000 + Math.random() * 14000;
    }
    if (n.bubble && n.bubble.until < state.time.totalMs) n.bubble = null;
  }
}

function nextWalkFrame(frame) {
  const walk = Array.from({ length: TRENCHLET_ATLAS.frameCount }, (_, i) => i);
  const idx = walk.indexOf(frame);
  return walk[(idx + 1) % walk.length] ?? 0;
}

function pickNewTarget(n) {
  // During raid-hour, target the vault
  if (state.event.active?.id === "raid-hour") {
    const v = state.world.vault;
    n.target.x = v.cx * TILE + (Math.random() - 0.5) * 80;
    n.target.y = v.cy * TILE + (Math.random() - 0.5) * 80;
    return;
  }
  // During spotlight on a specific community: that community walks to center
  if (
    state.event.active?.id === "spotlight" &&
    state.event.communityId === n.community.id
  ) {
    const v = state.world.vault;
    n.target.x = v.cx * TILE + (Math.random() - 0.5) * 60;
    n.target.y = v.cy * TILE + (Math.random() - 0.5) * 60;
    return;
  }
  // Default: wander within bbox
  const b = n.community.bbox;
  n.target.x = (b.tx + 1 + Math.random() * (b.tw - 2)) * TILE;
  n.target.y = (b.ty + 1 + Math.random() * (b.th - 2)) * TILE;
}

function maybeNPCSay(n) {
  const r = Math.random();
  let text;
  if (r < 0.6) text = n.community.chat[Math.floor(Math.random() * n.community.chat.length)];
  else text = GENERIC_CHAT[Math.floor(Math.random() * GENERIC_CHAT.length)];
  n.bubble = { text, until: state.time.totalMs + 3600 };
  state.hooks.onChat?.({
    who: n.name,
    text,
    color: n.community.color,
    communityId: n.community.id,
    npc: true,
  });
}

function updateCamera(dt) {
  void dt;
  const targetX = state.player.x - GAME_W / 2;
  const targetY = state.player.y - GAME_H / 2;
  const dims = worldDimensions();
  state.cam.x = Math.max(0, Math.min(dims.w - GAME_W, targetX));
  state.cam.y = Math.max(0, Math.min(dims.h - GAME_H, targetY));
  if (state.event.active?.id === "earthquake") {
    state.cam.x += (Math.random() - 0.5) * 2.4;
    state.cam.y += (Math.random() - 0.5) * 2.4;
  }
}

function updateParticles(dt) {
  for (const p of state.particles) {
    p.x += p.vx * dt * 0.06;
    p.y += p.vy * dt * 0.06;
    p.vy += p.gravity * dt * 0.06;
    p.life -= dt;
  }
  state.particles = state.particles.filter((p) => p.life > 0);
}

function updateFloats(dt) {
  for (const f of state.floats) {
    f.y += f.vy * dt * 0.06;
    f.life -= dt;
  }
  state.floats = state.floats.filter((f) => f.life > 0);
}

function updateCoins(dt) {
  for (const c of state.coins) {
    c.y += c.vy * dt * 0.06;
    c.vy += 0.04 * dt * 0.06;
    c.spin += dt * 0.01;
    if (c.y > c.targetY) {
      c.y = c.targetY;
      c.vy *= -0.3;
      if (Math.abs(c.vy) < 0.4) c.vy = 0;
    }
  }
  // Coin collection
  const px = state.player.x;
  const py = state.player.y;
  for (let i = state.coins.length - 1; i >= 0; i--) {
    const c = state.coins[i];
    if (Math.hypot(c.x - px, c.y - py + 6) < 10) {
      state.coins.splice(i, 1);
      emitSparkle(c.x, c.y, "#ffd84a", 8);
      onCoinCollected();
    }
  }
  state.coins = state.coins.filter((c) => state.time.totalMs - c.spawnedAt < 26000);
}

function onCoinCollected() {
  // No-op. Coins used to add USD to the central vault during the
  // vault-overflow event, which doesn't fit the real economy (vault
  // grows from on-chain creator rewards, not in-game pickups).
  // Function is kept so any stray references don't crash.
}

function updateWhale(dt) {
  if (!state.whale) return;
  state.whale.x += state.whale.vx * dt * 0.06;
  const dims = worldDimensions();
  if (state.whale.x > dims.w + 80 || state.whale.x < -200) {
    state.whale = null;
  }
}

function updateEvents(dt) {
  if (state.event.active && state.time.totalMs > state.event.until) {
    const ended = state.event.active;
    state.event.active = null;
    state.event.communityId = null;
    state.disaster.active = null;
    state.disaster.targetId = null;
    state.disaster.hp = 1;
    state.hooks.onEvent?.({ type: "end", event: ended });
  }
  if (!state.event.active && state.time.totalMs >= state.event.nextAt) {
    startRandomEvent();
  }
  // (vault-overflow event removed — no more coin rain into the central vault)
  if (state.event.active?.kind === "disaster") {
    tickDisaster(dt);
  }
}

function tickDisaster(dt) {
  const event = state.event.active;
  if (event.id === "house-fire") {
    const target = COMMUNITIES.find((c) => c.id === state.disaster.targetId);
    if (target) {
      const drain = (event.drainPerSec || 0.02) * (dt / 1000);
      state.communityVault[target.id] = Math.max(0, state.communityVault[target.id] - state.communityVault[target.id] * drain * state.disaster.hp);
      // Spawn fire particles around the house plaza
      if (Math.random() < 0.6) {
        const cx = target.plaza.tx * 16;
        const cy = target.plaza.ty * 16;
        state.particles.push({
          x: cx + (Math.random() - 0.5) * 60,
          y: cy + (Math.random() - 0.5) * 40,
          vx: (Math.random() - 0.5) * 0.6,
          vy: -1.6 - Math.random() * 1.5,
          gravity: -0.02,
          life: 600 + Math.random() * 400,
          maxLife: 900,
          color: Math.random() > 0.5 ? "#ff8a3d" : "#ffd84a",
          size: 1 + Math.floor(Math.random() * 2),
          shape: "square",
        });
      }
    }
  } else if (event.id === "lightning-storm") {
    if (Math.random() < 0.018) {
      // Strike a random house plaza for flash effect.
      const house = COMMUNITIES[Math.floor(Math.random() * COMMUNITIES.length)];
      const cx = house.plaza.tx * 16;
      const cy = house.plaza.ty * 16;
      for (let i = 0; i < 18; i++) {
        state.particles.push({
          x: cx + (Math.random() - 0.5) * 50,
          y: cy + (Math.random() - 0.5) * 50,
          vx: 0,
          vy: 0,
          gravity: 0,
          life: 220,
          maxLife: 220,
          color: "#fff5fb",
          size: 1,
          shape: "square",
        });
      }
    }
  } else if (event.id === "locust-swarm") {
    if (Math.random() < 0.4) {
      state.particles.push({
        x: state.cam.x + Math.random() * TUNING.GAME_W,
        y: state.cam.y - 8 + Math.random() * (TUNING.GAME_H + 16),
        vx: -1.4 + Math.random() * 0.4,
        vy: (Math.random() - 0.5) * 0.6,
        gravity: 0,
        life: 1200,
        maxLife: 1200,
        color: "#7a8e21",
        size: 1,
        shape: "square",
      });
    }
  }
}

function startRandomEvent() {
  const totalWeight = WORLD_EVENTS.reduce((a, b) => a + b.weight, 0);
  let r = Math.random() * totalWeight;
  let event = WORLD_EVENTS[0];
  for (const e of WORLD_EVENTS) {
    r -= e.weight;
    if (r <= 0) {
      event = e;
      break;
    }
  }
  state.event.active = event;
  state.event.until = state.time.totalMs + event.durationMs;
  if (event.id === "spotlight") {
    const community = COMMUNITIES[Math.floor(Math.random() * COMMUNITIES.length)];
    state.event.communityId = community.id;
  }
  if (event.id === "whale-visit") {
    spawnWhale();
  }
  if (event.kind === "disaster") {
    const target = COMMUNITIES[Math.floor(Math.random() * COMMUNITIES.length)];
    state.disaster.active = event.id;
    state.disaster.targetId = target.id;
    state.disaster.hp = 1;
    state.event.communityId = target.id;
  }
  scheduleNextEvent();
  state.hooks.onEvent?.({ type: "start", event, communityId: state.event.communityId });
}

export function dousFire() {
  if (state.event.active?.id !== "house-fire") return false;
  const event = state.event.active;
  state.disaster.hp = Math.max(0, state.disaster.hp - (event.extinguishPerHit || 0.2));
  if (state.disaster.hp <= 0.01) {
    state.event.until = state.time.totalMs;
  }
  return true;
}

export function executeRaid(attackerHouse, targetHouse, percent) {
  const targetPot = state.communityVault[targetHouse.id] || 0;
  const stolen = targetPot * (percent / 100);
  if (stolen <= 0) return null;
  state.communityVault[targetHouse.id] = targetPot - stolen;
  state.communityVault[attackerHouse.id] = (state.communityVault[attackerHouse.id] || 0) + stolen * 0.85;
  state.player.unclaimedShare += stolen * 0.1;
  state.pumptownTreasury += stolen * 0.05;
  state.raidLog.unshift({
    at: Date.now(),
    attacker: attackerHouse.id,
    target: targetHouse.id,
    amount: stolen,
  });
  state.raidLog = state.raidLog.slice(0, 20);
  return { stolen, attacker: attackerHouse, target: targetHouse };
}

function scheduleNextEvent() {
  const span = TUNING.WORLD_EVENT_MAX_MS - TUNING.WORLD_EVENT_MIN_MS;
  state.event.nextAt = state.time.totalMs + TUNING.WORLD_EVENT_MIN_MS + Math.random() * span;
}

function spawnCoin() {
  const v = state.world.vault;
  const cx = v.cx * TILE + (Math.random() - 0.5) * 160;
  const targetY = v.cy * TILE + 12 + (Math.random() - 0.5) * 80;
  state.coins.push({
    x: cx,
    y: targetY - 60,
    vy: 0,
    spin: Math.random() * Math.PI,
    targetY,
    spawnedAt: state.time.totalMs,
  });
}

function spawnWhale() {
  const dims = worldDimensions();
  state.whale = {
    x: -180,
    y: 30 + Math.random() * 40,
    vx: 36,
    width: WHALE_SPRITE.w,
    height: WHALE_SPRITE.h,
  };
}

function updateInteraction() {
  const p = state.player;
  const interactables = collectInteractables();
  let best = null;
  let bestDist = Infinity;
  for (const obj of interactables) {
    const cx = obj.bbox.x + obj.bbox.w / 2;
    const cy = obj.bbox.y + obj.bbox.h / 2;
    const d = Math.hypot(cx - p.x, cy - p.y);
    if (d < obj.bbox.radius && d < bestDist) {
      best = obj;
      bestDist = d;
    }
  }
  if (best) {
    state.ui.promptKind = best.kind;
    state.ui.promptText = best.label;
    state.ui.promptTarget = best;
  } else {
    state.ui.promptKind = null;
    state.ui.promptText = "";
    state.ui.promptTarget = null;
  }
  state.hooks.onInteractTarget?.(best);
}

function collectInteractables() {
  const list = [];
  for (const d of state.world.decorations) {
    if (d.kind === "totem") {
      list.push({
        kind: "totem",
        community: d.community,
        bbox: { x: d.x, y: d.y, w: 16, h: 32, radius: 36 },
        label: d.community.holding
          ? `Join ${d.community.name.toUpperCase()}`
          : `${d.community.name.toUpperCase()} (locked: hold ${d.community.ticker})`,
      });
    } else if (d.kind === "billboard") {
      const isOwn = state.player.community?.id === d.community.id;
      const fireHere = state.event.active?.id === "house-fire" && state.disaster.targetId === d.community.id;
      let label;
      let kind = "billboard";
      if (fireHere) {
        label = `Extinguish ${d.community.name.toUpperCase()} fire`;
        kind = "extinguish";
      } else if (isOwn || !state.player.community) {
        label = `Contribute to ${d.community.name.toUpperCase()}`;
      } else {
        label = `Raid ${d.community.name.toUpperCase()} (SHARK+ tier)`;
        kind = "raid";
      }
      list.push({
        kind,
        community: d.community,
        bbox: { x: d.x, y: d.y, w: 32, h: 32, radius: 36 },
        label,
      });
    } else if (d.kind === "vault") {
      const share = state.player.unclaimedShare;
      const now = Date.now();
      const unlocked = now - state.player.firstPlayedAt >= CLAIM_LOCK_MS;
      let label;
      if (share > 0 && unlocked) {
        label = `Claim ${formatShort(share)} share`;
      } else if (share > 0 && !unlocked) {
        label = `Vault locked · share ${formatShort(share)}`;
      } else {
        label = "Inspect the vault";
      }
      list.push({
        kind: "vault",
        bbox: { x: d.x, y: d.y, w: 48, h: 48, radius: 60 },
        label,
      });
    } else if (d.kind === "fountain") {
      list.push({
        kind: "fountain",
        bbox: { x: d.x, y: d.y, w: 32, h: 24, radius: 32 },
        label: "Toss a coin",
      });
    }
  }
  return list;
}

function updateBubbles() {
  if (state.player.bubble && state.player.bubble.until < state.time.totalMs) {
    state.player.bubble = null;
  }
}

function vaultAccrue(dt) {
  // Vault no longer grows from a synthetic rate. It only grows from
  // real player contributions (minigame scores → applyTaskResolution).
  // The vaultRate display is kept for the HUD delta indicator but set
  // to 0 unless a live on-chain feed is wired.
  state.vaultRate = 0;
  void dt;
}

export function claimUnlockAt() {
  return state.player.firstPlayedAt + CLAIM_LOCK_MS;
}

export function claimUnlocked() {
  return Date.now() >= claimUnlockAt();
}

// =================== INTERACTION API (called by main) ===================

export function tryInteract() {
  const target = state.ui.promptTarget;
  if (!target) return null;
  return target;
}

export function setPlayerCommunity(communityId) {
  const community = communityId ? COMMUNITIES.find((c) => c.id === communityId) : null;
  const p = state.player;
  p.community = community;
  if (community) {
    const palette = makeCharacterPalette(community, HAIR_COLORS[3], SKIN_TONES[0]);
    p.palette = palette;
    p.sprites = bakeCharacterHD(palette);
    p.glow = 1200;
    spawnSparkleRing(p.x, p.y - 6, community.glow, 20);
    p.name = community.ticker.toLowerCase() + "_you";
  } else {
    const palette = makeCharacterPalette(
      { color: "#1ec77d", accent: "#15945d", body: "#1ec77d", bodyShade: "#0a4a2a" },
      HAIR_COLORS[3],
      SKIN_TONES[0],
    );
    p.palette = palette;
    p.sprites = bakeCharacterHD(palette);
    p.name = "guest";
  }
  state.hooks.onPlayerCommunityChange?.(community);
}

export function setPumptownBalance(value) {
  state.player.pumptownBalance = Math.max(0, value);
  state.player.tier = tierFor(state.player.pumptownBalance);
}

export function addPumptownBalance(delta) {
  setPumptownBalance(state.player.pumptownBalance + delta);
}

export function claimShare(force = false) {
  if (!force && !claimUnlocked()) return 0;
  const amount = state.player.unclaimedShare;
  if (amount <= 0) return 0;
  state.player.unclaimedShare = 0;
  state.player.totalClaimed += amount;
  state.hooks.onClaim?.({ amount });
  spawnSparkleRing(state.player.x, state.player.y - 8, "#ffd84a", 28);
  spawnFloat(state.player.x, state.player.y - 16, `+${formatShort(amount)}`, "#ffd84a");
  return amount;
}

export function setFirstPlayedAt(ms) {
  state.player.firstPlayedAt = ms;
}

export function applyTaskResolution({ communityId, percent, split }) {
  const released = state.vault * (percent / 100);
  const vaultPart = released * (split.vault / 100);
  const playerPart = released * (split.player / 100);
  const treasuryPart = released * (split.treasury / 100);
  state.vault = Math.max(0, state.vault - released);
  state.communityVault[communityId] = (state.communityVault[communityId] || 0) + vaultPart;
  state.pumptownTreasury += treasuryPart;
  // Player share: only your own house earns into your personal share.
  const eligible = state.player.community?.id === communityId;
  let actualPlayerPart = 0;
  if (eligible) {
    actualPlayerPart = playerPart;
    state.player.unclaimedShare += playerPart;
    state.player.contribCount += 1;
  }
  state.hooks.onResolveSplit?.({
    communityId,
    released,
    vaultPart,
    playerPart: actualPlayerPart,
    treasuryPart,
  });
  return { released, vaultPart, playerPart: actualPlayerPart, treasuryPart };
}

function formatShort(value) {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${Math.round(value)}`;
}

export function setWallet(wallet) {
  state.player.wallet = wallet;
}

export function setSplash(open) {
  state.ui.splashOpen = open;
}

export function spawnSparkleRing(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
    const speed = 0.8 + Math.random() * 1.2;
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      gravity: 0,
      life: 600 + Math.random() * 400,
      maxLife: 900,
      color,
      size: 1 + Math.floor(Math.random() * 2),
      shape: "square",
    });
  }
}

export function emitSparkle(x, y, color, count = 6) {
  for (let i = 0; i < count; i++) {
    state.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 1.4,
      vy: -0.6 - Math.random() * 1.4,
      gravity: 0.05,
      life: 400 + Math.random() * 400,
      maxLife: 800,
      color,
      size: 1,
      shape: "square",
    });
  }
}

export function spawnFloat(x, y, text, color) {
  state.floats.push({
    x,
    y,
    text,
    vy: -0.7,
    life: 1200,
    maxLife: 1200,
    color,
  });
}

export function sayPlayer(text) {
  state.player.bubble = { text, until: state.time.totalMs + 4200 };
}

export function getPlayer() {
  return state.player;
}

// =================== RENDER ===================

function render() {
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  drawSky();
  drawTiles(ctx, state.world, state.cam);
  drawTileEffects();
  drawObjectsAndEntities();
  drawCoins();
  drawWhale();
  drawParticles();
  drawFloats();
  drawBubbles();
  drawWeatherOverlay();
  drawLightingOverlay();
}

function drawSky() {
  ctx.fillStyle = "#050210";
  ctx.fillRect(0, 0, GAME_W, GAME_H);
}

function drawTileEffects() {
  // Water shimmer overlay
  for (let ty = Math.floor(state.cam.y / TILE); ty < Math.ceil((state.cam.y + GAME_H) / TILE); ty++) {
    for (let tx = Math.floor(state.cam.x / TILE); tx < Math.ceil((state.cam.x + GAME_W) / TILE); tx++) {
      if (ty < 0 || tx < 0 || ty >= state.world.tiles.length || tx >= state.world.tiles[0].length)
        continue;
      if (state.world.tiles[ty][tx] === TILE_TYPES.WATER) {
        const wave = Math.sin(state.time.totalMs / 400 + tx + ty) * 0.5 + 0.5;
        ctx.fillStyle = `rgba(255,255,255,${0.05 + wave * 0.05})`;
        ctx.fillRect(tx * TILE - state.cam.x, ty * TILE - state.cam.y + 2, TILE, 2);
      }
    }
  }
}

function drawObjectsAndEntities() {
  // Build draw list, sort by Y
  const list = [];
  for (const d of state.world.decorations) {
    list.push({
      y: d.y + objectYOffset(d.kind),
      draw: () => drawDecoration(d),
    });
  }
  // Player
  list.push({
    y: state.player.y,
    draw: () => drawCharacter(state.player),
  });
  // NPCs (always empty — kept for legacy compatibility, real players
  // come through state.remotePlayers).
  for (const n of state.npcs) {
    list.push({
      y: n.y,
      draw: () => drawCharacter(n),
    });
  }
  // Remote players via websocket
  for (const rp of state.remotePlayers.values()) {
    if (!rp.sprites) continue; // not yet baked
    list.push({
      y: rp.y,
      draw: () => drawCharacter(rp),
    });
  }
  list.sort((a, b) => a.y - b.y);
  for (const item of list) item.draw();
}

function objectYOffset(kind) {
  if (kind === "tree") return 16;
  if (kind === "totem") return 30;
  if (kind === "billboard") return 24;
  if (kind === "house") return 58;
  if (kind === "vault") return 38;
  if (kind === "fountain") return 22;
  if (kind === "longgrass") return 12;
  return 8;
}

function drawDecoration(d) {
  const screenX = d.x - state.cam.x;
  const screenY = d.y - state.cam.y;
  if (screenX < -128 || screenY < -128 || screenX > GAME_W + 128 || screenY > GAME_H + 128)
    return;
  if (d.kind === "tree") {
    const idx = stableVariant(d, 4);
    if (!drawGeneratedSprite("foliage", `tree${idx}`, screenX + 8, screenY + 16)) {
      drawHDTree(d, screenX, screenY);
    }
  } else if (d.kind === "bush") {
    if (!drawGeneratedSprite("foliage", `bush${stableVariant(d, 4)}`, screenX + 8, screenY + 14)) {
      drawAnchoredHD(getHDBush(d.x + d.y), screenX + 4, screenY + 12, HD_BUSH);
    }
  } else if (d.kind === "flower") {
    if (!drawGeneratedSprite("foliage", `flower${stableVariant(d, 4)}`, screenX + 8, screenY + 14)) {
      drawAnchoredHD(getHDFlower(d.x + d.y), screenX + 6, screenY + 13, HD_FLOWER);
    }
  } else if (d.kind === "rock") {
    if (!drawGeneratedSprite("foliage", `rock${stableVariant(d, 6)}`, screenX + 8, screenY + 12)) {
      drawAnchoredHD(getHDRock(d.x + d.y), screenX + 8, screenY + 12, HD_ROCK);
    }
  } else if (d.kind === "longgrass") {
    const frame = Math.floor(state.time.totalMs / 160 + stableVariant(d, 8)) % 8;
    drawGeneratedSprite("terrain", `longgrass${frame}`, screenX + 8, screenY + 15);
  } else if (d.kind === "lamp") {
    if (!drawGeneratedSprite("foliage", `lamp${stableVariant(d, 2)}`, screenX + 8, screenY + 16)) {
      drawAnchoredHD(getHDLamp(), screenX + 4, screenY + 16, HD_LAMP);
    }
    // Light glow at night
    const night = nightAmount();
    if (night > 0.1) {
      ctx.save();
      const grd = ctx.createRadialGradient(screenX + 4, screenY + 2, 0, screenX + 4, screenY + 2, 36);
      grd.addColorStop(0, `rgba(255,216,74,${0.45 * night})`);
      grd.addColorStop(1, "rgba(255,216,74,0)");
      ctx.fillStyle = grd;
      ctx.fillRect(screenX - 32, screenY - 36, 76, 80);
      ctx.restore();
    }
  } else if (d.kind === "vault") {
    if (!drawGeneratedSprite("buildings", `vault${stableVariant(d, 2)}`, screenX + 24, screenY + 42)) {
      drawHDVault(d, screenX, screenY);
    }
    // Floating arrow
    const bob = Math.sin(state.time.totalMs / 280) * 1.2;
    drawText(
      ctx,
      "VAULT",
      Math.floor(screenX + 24 - 9),
      Math.floor(screenY - 8 + bob),
      "#ffd84a",
      true,
    );
  } else if (d.kind === "totem") {
    const houseIdx = Math.max(0, COMMUNITIES.findIndex((c) => c.id === d.community.id));
    if (!drawGeneratedSprite("buildings", `totem${houseIdx % 4}`, screenX + 8, screenY + 16)) {
      drawAnchoredHD(getHDTotem(d.community), screenX + 8, screenY + 16, HD_TOTEM);
    }
  } else if (d.kind === "billboard") {
    const houseIdx = Math.max(0, COMMUNITIES.findIndex((c) => c.id === d.community.id));
    if (!drawGeneratedSprite("buildings", `billboard${houseIdx % 4}`, screenX + 16, screenY + 24)) {
      drawAnchoredHD(getHDBillboard(d.community), screenX + 16, screenY + 24, HD_BILLBOARD);
    }
  } else if (d.kind === "house") {
    const houseIdx = Math.max(0, COMMUNITIES.findIndex((c) => c.id === d.community.id));
    const footX = screenX + 40;
    const footY = screenY + 50;
    if (!drawGeneratedSprite("buildings", `house${houseIdx % 6}`, footX, footY)) {
      drawAnchoredHD(getHDHouse(d.community), footX, footY, HD_HOUSE);
    }
    drawGeneratedSprite("communityLogos", d.community.id, footX, footY - 22);
    drawHouseNameplate(d.community, footX, footY - 92);
  } else if (d.kind === "fountain") {
    if (!drawGeneratedSprite("buildings", `fountain${stableVariant(d, 2)}`, screenX + 16, screenY + 24)) {
      drawAnchoredHD(getHDFountain(), screenX + 16, screenY + 24, HD_FOUNTAIN);
    }
    // Water particles
    if (Math.random() > 0.7) {
      state.particles.push({
        x: d.x + 16,
        y: d.y - 2,
        vx: (Math.random() - 0.5) * 0.6,
        vy: -1.4,
        gravity: 0.08,
        life: 600,
        maxLife: 800,
        color: "#aef3ff",
        size: 1,
        shape: "square",
      });
    }
  }
}

function drawObj(name, sprite, palette, x, y) {
  const canvas = getBaked(name, palette, () => sprite);
  ctx.drawImage(canvas, Math.floor(x), Math.floor(y));
}

function stableVariant(d, count) {
  return Math.abs(((d.x * 73856093) ^ (d.y * 19349663)) | 0) % count;
}

function houseLabelText(community) {
  const ticker = community.ticker.replace(/^\$/, "").replace(/[^a-z0-9]/gi, "");
  const text = ticker.length >= 2 ? `$${ticker}` : community.id;
  return text.slice(0, 11).toUpperCase();
}

function drawHouseNameplate(community, centerX, y) {
  const text = houseLabelText(community);
  const width = text.length * 4 + 8;
  const x = Math.floor(centerX - width / 2);
  const yy = Math.floor(y);
  ctx.save();
  ctx.globalAlpha = 0.94;
  ctx.fillStyle = "rgba(4, 8, 10, 0.84)";
  ctx.fillRect(x, yy, width, 10);
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(x + 1, yy + 10, width - 2, 2);
  ctx.strokeStyle = community.color;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, yy + 0.5, width - 1, 9);
  ctx.globalAlpha = 1;
  drawText(ctx, text, x + 4, yy + 2, "#f1fff7", true);
  ctx.restore();
}

function drawGeneratedSprite(atlasName, frameName, footX, footY) {
  const image = getGeneratedAtlasImage(atlasName);
  const frame = getGeneratedFrame(atlasName, frameName);
  if (!image || !frame) return false;
  const x = Math.floor(footX - frame.footX);
  const y = Math.floor(footY - frame.footY);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, frame.drawW, frame.drawH);
  ctx.restore();
  return true;
}

function drawAnchoredHD(canvas, footX, footY, spec) {
  drawHD(
    canvas,
    Math.floor(footX - spec.footX),
    Math.floor(footY - spec.footY),
    spec.W,
    spec.H,
  );
}

function drawHDTree(d, screenX, screenY) {
  // Pick a stable variant per tree from its world position so a forest
  // doesn't look cloned but the same tree always looks the same.
  if (d.variant === undefined) {
    d.variant = ((d.x * 73856093) ^ (d.y * 19349663)) >>> 0;
  }
  const cnv = getTreeVariant(d.variant);
  // Anchor the tree's foot to its decoration position so y-sort is honest.
  const drawX = Math.floor(screenX + 8 - HD_TREE.footX);
  const drawY = Math.floor(screenY + 16 - HD_TREE.footY);
  // Soft elliptical ground shadow (drawn live so it can react to lighting later)
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.32)";
  ctx.beginPath();
  ctx.ellipse(
    Math.floor(screenX + 8),
    Math.floor(screenY + 16),
    16,
    4,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
  // Native HD blit — cnv is at HD_DENSITY× of HD_TREE.W/H, drawn at logical size.
  drawHD(cnv, drawX, drawY, HD_TREE.W, HD_TREE.H);
}

function drawHDVault(d, screenX, screenY) {
  // World decoration is anchored at its top-left (the old 48x48 vault was
  // placed at (vaultCx*TILE - 24, vaultCy*TILE - 24) so its centre matched
  // the vault tile). The HD vault is 96x80 — we centre it on the same
  // vault tile so the plaza tile alignment is unchanged.
  const cnv = getHDVault();
  const drawX = Math.floor(screenX + 24 - HD_VAULT.W / 2);
  const drawY = Math.floor(screenY + 24 - HD_VAULT.H + 12);
  // Soft ground shadow under the boulder
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.ellipse(
    Math.floor(screenX + 24),
    Math.floor(screenY + 24 + 14),
    44,
    8,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
  ctx.restore();
  drawHD(cnv, drawX, drawY, HD_VAULT.W, HD_VAULT.H);
  // Live sparkles inside the gate to sell the "glowing gold" feel
  if (Math.random() < 0.18) {
    // Sprite top-left in world space: (d.x - 24, d.y - 44).
    const sxLocal = 36 + Math.random() * 24;
    const syLocal = 38 + Math.random() * 16;
    state.particles.push({
      x: d.x - 24 + sxLocal,
      y: d.y - 44 + syLocal,
      vx: 0,
      vy: -0.3 - Math.random() * 0.3,
      gravity: 0,
      life: 600,
      maxLife: 600,
      color: "#fff3b8",
      size: 1,
      shape: "square",
    });
  }
}

function drawCharacter(entity) {
  const dir = entity.dir;
  const frame = entity.animFrame;
  const atlasImage = getTrenchletAtlasImage();
  const usingAtlas = !!atlasImage;
  const cw = usingAtlas ? TRENCHLET_ATLAS.drawW : HD_CHAR.W;
  const ch = usingAtlas ? TRENCHLET_ATLAS.drawH : HD_CHAR.H;
  const footX = usingAtlas ? TRENCHLET_ATLAS.footX : HD_CHAR.footX;
  const footY = usingAtlas ? TRENCHLET_ATLAS.footY : HD_CHAR.footY;
  // HD characters are foot-anchored: entity (x,y) corresponds to the
  // bottom-center of the sprite (boots on the ground).
  const screenX = Math.floor(entity.x - state.cam.x - footX);
  const baseY = Math.floor(entity.y - state.cam.y - footY);
  const footScreenX = Math.floor(entity.x - state.cam.x);
  const footScreenY = Math.floor(entity.y - state.cam.y);
  // Shadow under the boots
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.beginPath();
  ctx.ellipse(footScreenX, footScreenY, Math.max(7, cw * 0.24), 2.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Spotlight halo on community (drawn BEFORE character so it's behind)
  if (
    state.event.active?.id === "spotlight" &&
    entity.community &&
    state.event.communityId === entity.community.id
  ) {
    const haloPulse = (Math.sin(state.time.totalMs / 300) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.25 + haloPulse * 0.35;
    const grd = ctx.createRadialGradient(
      footScreenX,
      footScreenY - 8,
      2,
      footScreenX,
      footScreenY - 8,
      26,
    );
    grd.addColorStop(0, "#5cff9a");
    grd.addColorStop(1, "rgba(92,255,154,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(screenX - 8, baseY - 4, cw + 16, ch + 12);
    ctx.restore();
  }
  // Player glow ring
  if (entity === state.player && entity.glow > 0 && entity.community) {
    const t = entity.glow / 1200;
    ctx.save();
    ctx.globalAlpha = t * 0.5;
    const grd = ctx.createRadialGradient(
      footScreenX,
      footScreenY - ch / 2,
      2,
      footScreenX,
      footScreenY - ch / 2,
      28,
    );
    grd.addColorStop(0, entity.community.glow);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.fillRect(screenX - 12, baseY - 6, cw + 24, ch + 12);
    ctx.restore();
  }
  if (usingAtlas) {
    const src = getTrenchletAtlasFrame(dir, frame);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (entity.flipX) {
      ctx.translate(screenX + cw, baseY);
      ctx.scale(-1, 1);
      ctx.drawImage(atlasImage, src.x, src.y, src.w, src.h, 0, 0, cw, ch);
    } else {
      ctx.drawImage(atlasImage, src.x, src.y, src.w, src.h, screenX, baseY, cw, ch);
    }
    ctx.restore();
  } else {
    const frames = entity.sprites[dir] || entity.sprites.down;
    const canvas = frames[frame % frames.length] || frames[0];
    if (entity.flipX) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const dx = Math.floor(screenX * HD_SCALE);
      const dy = Math.floor(baseY * HD_SCALE);
      ctx.translate(dx + canvas.width, dy);
      ctx.scale(-1, 1);
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();
    } else {
      drawHD(canvas, screenX, baseY, cw, ch);
    }
  }
  // Player marker
  if (entity === state.player) {
    const bob = Math.sin(state.time.totalMs / 220) * 1;
    const arrowY = baseY - 6 + bob;
    drawArrow(ctx, footScreenX, arrowY, entity.community ? entity.community.color : "#4ff7ff");
  }
  // Name tag above the head — visible for the player AND every remote
  // player so everyone can see who they're walking next to.
  drawNameTag(entity, footScreenX, baseY);
  // Speed lines while moving fast (raid hour)
  if (entity.moving && state.event.active?.id === "raid-hour" && Math.random() > 0.7) {
    state.particles.push({
      x: entity.x + (Math.random() - 0.5) * 4,
      y: entity.y - 4 + Math.random() * 4,
      vx: entity.dir === "side" && entity.flipX ? 1.2 : entity.dir === "side" ? -1.2 : 0,
      vy: entity.dir === "up" ? 1.2 : entity.dir === "down" ? -1.2 : 0,
      gravity: 0,
      life: 200,
      maxLife: 200,
      color: "#ffffff",
      size: 1,
      shape: "square",
    });
  }
}

function drawArrow(ctx, x, y, color) {
  // Black outlined pixel arrow pointing down
  ctx.fillStyle = "#0a0414";
  ctx.fillRect(x - 3, y - 4, 7, 1);
  ctx.fillRect(x - 3, y, 7, 1);
  ctx.fillRect(x - 3, y - 4, 1, 5);
  ctx.fillRect(x + 3, y - 4, 1, 5);
  ctx.fillRect(x - 2, y + 1, 5, 1);
  ctx.fillRect(x - 1, y + 2, 3, 1);
  ctx.fillRect(x, y + 3, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(x - 2, y - 3, 5, 3);
  ctx.fillRect(x - 1, y, 3, 1);
  ctx.fillRect(x, y + 1, 1, 1);
}

// Floats above each character. Local player gets their stored name from
// localStorage, remote players get the displayName the server attached
// to their presence packet. Drawn with the in-canvas pixel font with a
// dark backdrop so it's readable on any ground color.
function drawNameTag(entity, footX, baseY) {
  let name = "";
  if (entity === state.player) {
    name = (typeof localStorage !== "undefined" && localStorage.getItem("trenchlets-display-name")) || entity.name || "";
  } else {
    name = entity.displayName || entity.name || "";
  }
  if (!name) return;
  // Sanitize + uppercase for the pixel font (3x5 only has uppercase).
  const text = String(name).toUpperCase().slice(0, 16);
  const charW = 4;
  const padding = 2;
  const w = text.length * charW + padding * 2 - 1;
  const h = 5 + padding * 2;
  // Anchor a bit above the head (above the player arrow if present).
  const tagY = baseY - 14;
  const tagX = Math.floor(footX - w / 2);
  // Background pill
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.fillRect(tagX, tagY, w, h);
  // Text — green for the local player, white for everyone else
  const color = entity === state.player ? "#1eff8e" : "#ffffff";
  drawText(ctx, text, tagX + padding, tagY + padding, color, false);
}

function drawCoins() {
  for (const c of state.coins) {
    const sx = c.x - state.cam.x;
    const sy = c.y - state.cam.y;
    const wobble = Math.abs(Math.sin(c.spin));
    const w = 7 * (0.4 + wobble * 0.6);
    ctx.fillStyle = "#1a0f04";
    ctx.fillRect(sx - w / 2, sy + 4, w, 1);
    ctx.fillStyle = "#ffd84a";
    ctx.fillRect(sx - w / 2, sy - 3, w, 6);
    ctx.fillStyle = "#fff5b0";
    ctx.fillRect(sx - w / 2 + 1, sy - 2, 1, 1);
  }
}

function drawWhale() {
  if (!state.whale) return;
  const palette = {
    ...OBJECT_PALETTE_BASE,
    g: "#3a5ec1",
    G: "#214288",
    w: "#5fbcff",
    W: "#aee6ff",
    L: "#ffffff",
  };
  const cnv = getBaked("whale", palette, () => WHALE_SPRITE);
  ctx.save();
  ctx.globalAlpha = 0.92;
  ctx.drawImage(cnv, Math.floor(state.whale.x - state.cam.x * 0.4), Math.floor(state.whale.y));
  ctx.restore();
  // Shadow on the ground following the whale
  const shadowY = GAME_H - 30;
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(
    state.whale.x - state.cam.x * 0.4 + 40,
    shadowY,
    36,
    6,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();
}

function drawParticles() {
  for (const p of state.particles) {
    const alpha = Math.min(1, p.life / p.maxLife);
    ctx.fillStyle = colorWithAlpha(p.color, alpha);
    const sx = Math.floor(p.x - state.cam.x);
    const sy = Math.floor(p.y - state.cam.y);
    ctx.fillRect(sx, sy, p.size, p.size);
  }
}

function drawFloats() {
  for (const f of state.floats) {
    const alpha = Math.min(1, f.life / f.maxLife);
    const sx = Math.floor(f.x - state.cam.x);
    const sy = Math.floor(f.y - state.cam.y);
    ctx.save();
    ctx.globalAlpha = alpha;
    drawText(ctx, f.text, sx, sy, f.color || "#fff5b0", true);
    ctx.restore();
  }
}

function drawBubbles() {
  const everyone = [state.player, ...state.npcs];
  for (const e of everyone) {
    if (!e.bubble) continue;
    const sx = e.x - state.cam.x;
    const sy = e.y - state.cam.y - 26;
    drawBubble(sx, sy, e.bubble.text, e === state.player);
  }
}

function drawBubble(cx, cy, text, isPlayer) {
  const padding = 3;
  const charW = 4;
  const lines = wrapText(text, 22);
  const lineH = 7;
  const w = Math.min(140, Math.max(...lines.map((l) => l.length)) * charW + padding * 2);
  const h = lines.length * lineH + padding * 2;
  const x = Math.floor(cx - w / 2);
  const y = Math.floor(cy - h);
  // Drop shadow
  ctx.fillStyle = "rgba(0,0,0,0.6)";
  ctx.fillRect(x + 1, y + 1, w, h);
  ctx.fillStyle = isPlayer ? "#fff5fb" : "#dfe9f7";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#10071d";
  ctx.fillRect(x, y, w, 1);
  ctx.fillRect(x, y + h - 1, w, 1);
  ctx.fillRect(x, y, 1, h);
  ctx.fillRect(x + w - 1, y, 1, h);
  // Tail
  ctx.fillStyle = isPlayer ? "#fff5fb" : "#dfe9f7";
  ctx.fillRect(Math.floor(cx) - 1, y + h, 3, 2);
  ctx.fillStyle = "#10071d";
  ctx.fillRect(Math.floor(cx) - 2, y + h, 1, 2);
  ctx.fillRect(Math.floor(cx) + 2, y + h, 1, 2);
  // Text
  for (let i = 0; i < lines.length; i++) {
    drawText(ctx, lines[i], x + padding, y + padding + i * lineH, "#10071d", false);
  }
}

function wrapText(text, max) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    if ((line + " " + w).trim().length > max) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line ? line + " " : "") + w;
    }
  }
  if (line) lines.push(line);
  return lines.slice(0, 3);
}

// Tiny in-canvas pixel font (3x5)
const FONT = {
  A: ["010", "101", "111", "101", "101"],
  B: ["110", "101", "110", "101", "110"],
  C: ["011", "100", "100", "100", "011"],
  D: ["110", "101", "101", "101", "110"],
  E: ["111", "100", "111", "100", "111"],
  F: ["111", "100", "110", "100", "100"],
  G: ["011", "100", "101", "101", "011"],
  H: ["101", "101", "111", "101", "101"],
  I: ["111", "010", "010", "010", "111"],
  J: ["111", "001", "001", "101", "010"],
  K: ["101", "110", "100", "110", "101"],
  L: ["100", "100", "100", "100", "111"],
  M: ["101", "111", "111", "101", "101"],
  N: ["101", "111", "111", "111", "101"],
  O: ["010", "101", "101", "101", "010"],
  P: ["110", "101", "110", "100", "100"],
  Q: ["010", "101", "101", "111", "011"],
  R: ["110", "101", "110", "101", "101"],
  S: ["011", "100", "010", "001", "110"],
  T: ["111", "010", "010", "010", "010"],
  U: ["101", "101", "101", "101", "010"],
  V: ["101", "101", "101", "010", "010"],
  W: ["101", "101", "111", "111", "101"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  Z: ["111", "001", "010", "100", "111"],
  "0": ["010", "101", "101", "101", "010"],
  "1": ["010", "110", "010", "010", "111"],
  "2": ["110", "001", "010", "100", "111"],
  "3": ["110", "001", "010", "001", "110"],
  "4": ["101", "101", "111", "001", "001"],
  "5": ["111", "100", "110", "001", "110"],
  "6": ["011", "100", "110", "101", "010"],
  "7": ["111", "001", "010", "010", "010"],
  "8": ["010", "101", "010", "101", "010"],
  "9": ["010", "101", "011", "001", "110"],
  " ": ["000", "000", "000", "000", "000"],
  ".": ["000", "000", "000", "000", "100"],
  ",": ["000", "000", "000", "010", "100"],
  "!": ["010", "010", "010", "000", "010"],
  "?": ["110", "001", "010", "000", "010"],
  "+": ["000", "010", "111", "010", "000"],
  "-": ["000", "000", "111", "000", "000"],
  "%": ["101", "001", "010", "100", "101"],
  "$": ["011", "110", "011", "110", "010"],
  ":": ["000", "010", "000", "010", "000"],
  "/": ["001", "001", "010", "100", "100"],
  "'": ["010", "010", "000", "000", "000"],
};

function drawText(ctx, text, x, y, color, shadow = false) {
  const str = String(text).toUpperCase();
  let cx = Math.floor(x);
  const cy = Math.floor(y);
  for (const ch of str) {
    const glyph = FONT[ch] || FONT["?"];
    for (let py = 0; py < 5; py++) {
      for (let px = 0; px < 3; px++) {
        if (glyph[py][px] === "1") {
          if (shadow) {
            ctx.fillStyle = "rgba(0,0,0,0.7)";
            ctx.fillRect(cx + px + 1, cy + py + 1, 1, 1);
          }
          ctx.fillStyle = color;
          ctx.fillRect(cx + px, cy + py, 1, 1);
        }
      }
    }
    cx += 4;
  }
}

export { drawText };

function nightAmount() {
  // dayPhase 0 = morning, 0.5 = noon, 0.75 = sunset, 1 = midnight
  const phase = state.time.dayPhase;
  if (phase < 0.6) return 0;
  if (phase < 0.7) return (phase - 0.6) * 10;
  if (phase < 0.95) return 1;
  return (1 - phase) * 20;
}

function drawLightingOverlay() {
  let alpha = nightAmount() * 0.55;
  if (state.event.active?.id === "solar-eclipse") alpha = Math.min(0.7, alpha + 0.55);
  if (alpha <= 0.001) return;
  ctx.save();
  ctx.fillStyle = `rgba(8,4,32,${alpha})`;
  ctx.globalCompositeOperation = "multiply";
  ctx.fillRect(0, 0, GAME_W, GAME_H);
  ctx.restore();
}

function drawWeatherOverlay() {
  // (vault-overflow confetti removed with the event)
}

function colorWithAlpha(color, alpha) {
  if (color.startsWith("rgba")) return color;
  const hex = color.replace("#", "");
  const full = hex.length === 3
    ? hex.split("").map((c) => c + c).join("")
    : hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha.toFixed(3)})`;
}

function pulseColor(a, b, period) {
  const t = (Math.sin((state.time.totalMs / period) * Math.PI * 2) + 1) / 2;
  return mixColor(a, b, t);
}

function mixColor(a, b, t) {
  const ca = parseHex(a);
  const cb = parseHex(b);
  const r = Math.round(ca[0] + (cb[0] - ca[0]) * t);
  const g = Math.round(ca[1] + (cb[1] - ca[1]) * t);
  const bl = Math.round(ca[2] + (cb[2] - ca[2]) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bl.toString(16).padStart(2, "0")}`;
}

function parseHex(color) {
  const hex = color.replace("#", "");
  const full = hex.length === 3
    ? hex.split("").map((c) => c + c).join("")
    : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

// =================== MINIMAP ===================

function drawMinimap() {
  if (!minimapCtx) return;
  const w = minimapCanvas.width;
  const h = minimapCanvas.height;
  const dims = worldDimensions();
  const scaleX = w / dims.w;
  const scaleY = h / dims.h;
  minimapCtx.fillStyle = "#0a0418";
  minimapCtx.fillRect(0, 0, w, h);
  // Tiles
  for (let ty = 0; ty < state.world.tiles.length; ty++) {
    for (let tx = 0; tx < state.world.tiles[0].length; tx++) {
      const t = state.world.tiles[ty][tx];
      let color = null;
      if (t === TILE_TYPES.PLAZA || t === TILE_TYPES.PATH_STONE) color = "#5b5887";
      else if (t === TILE_TYPES.PATH_DIRT) color = "#5e4426";
      else if (t === TILE_TYPES.WATER) color = "#1a72b8";
      else if (t === TILE_TYPES.PAD_FART) color = "#7e9b3e";
      else if (t === TILE_TYPES.PAD_MOO) color = "#a14a72";
      else if (t === TILE_TYPES.PAD_PNUT) color = "#7c5230";
      else if (t === TILE_TYPES.PAD_GOAT) color = "#4f2c78";
      else if (t === TILE_TYPES.PAD_ACT) color = "#bcbbe1";
      else color = "#1c3a20";
      if (color) {
        minimapCtx.fillStyle = color;
        minimapCtx.fillRect(tx * TILE * scaleX, ty * TILE * scaleY, Math.ceil(TILE * scaleX), Math.ceil(TILE * scaleY));
      }
    }
  }
  // Vault marker
  const v = state.world.vault;
  minimapCtx.fillStyle = "#ffd84a";
  minimapCtx.fillRect(v.cx * TILE * scaleX - 2, v.cy * TILE * scaleY - 2, 4, 4);
  // Player marker
  minimapCtx.fillStyle = "#ff3ec8";
  minimapCtx.fillRect(state.player.x * scaleX - 1, state.player.y * scaleY - 1, 3, 3);
  // NPCs
  for (const n of state.npcs) {
    minimapCtx.fillStyle = n.community.color;
    minimapCtx.fillRect(n.x * scaleX, n.y * scaleY, 1, 1);
  }
  // Camera box
  minimapCtx.strokeStyle = "#ffffff";
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(
    state.cam.x * scaleX,
    state.cam.y * scaleY,
    GAME_W * scaleX,
    GAME_H * scaleY,
  );
}

// =================== UTIL ===================

export function isPlayerNear(x, y, radius = 28) {
  return Math.hypot(state.player.x - x, state.player.y - y) <= radius;
}

// Returns a multiplier (1.0 = normal) based on active world events.
// Used by the minigame results to scale contribution.
export function getEventMultiplier(communityId) {
  const ev = state.event.active;
  if (!ev) return 1;
  if (ev.id === "solar-eclipse") return 2.0;       // 2x all contributions
  if (ev.id === "raid-hour") return 1.5;            // 1.5x speed bonus
  if (ev.id === "spotlight" && state.event.communityId === communityId) return 3.0; // 3x for spotlighted house
  if (ev.id === "earthquake") return 0.5;           // halved during quake
  if (ev.id === "locust-swarm") return 0.7;         // reduced during locusts
  if (ev.id === "lightning-storm") return 0.6;      // frozen progress
  if (ev.id === "house-fire" && state.disaster.targetId === communityId) return 0.3; // burning house barely earns
  return 1;
}
