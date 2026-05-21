// =========================================================
// Pumpcity · bootstrap
// Wires the engine to the DOM: HUD, panels, chat, tasks,
// wallet, notifications.
// =========================================================

import {
  TUNING,
  COMMUNITIES,
  TASKS,
  TASK_CATEGORIES,
  TIERS,
  RAID,
  CLAIM_LOCK_MS,
  EPOCH_CONFIG,
  VAULT_CONFIG,
  tierIndex,
  tierFor,
} from "./data.js";
import {
  initEngine,
  tick,
  state,
  setPlayerCommunity,
  setWallet,
  setSplash,
  tryInteract,
  sayPlayer,
  spawnSparkleRing,
  spawnFloat,
  emitSparkle,
  applyTaskResolution,
  claimShare,
  claimUnlocked,
  claimUnlockAt,
  addPumptownBalance,
  setPumptownBalance,
  setFirstPlayedAt,
  dousFire,
  executeRaid,
  getEventMultiplier,
} from "./engine.js";
import { SFX, setMuted } from "./audio.js";
import { launchMinigame, isMinigameActive, getMinigameCooldown } from "./minigames/index.js";
import { getMultiplayer, getPlayerId, MSG, saveSession as mpSaveSession, getDisplayName as mpGetDisplayName, setDisplayName as mpSetDisplayName, getMe } from "./multiplayer.js";

const mp = getMultiplayer();

const $ = (sel) => document.querySelector(sel);

const STORAGE_KEY = "pumpcity-state-v3";
const PLAYER_KEY = "pumpcity-player-id";

// =================== DOM ===================

const canvas = $("#gameCanvas");
const minimap = $("#minimap");
const splash = $("#splash");
const enterButton = $("#enterButton");
const guestButton = $("#guestButton");
const walletButton = $("#walletButton");
const walletLabel = $("#walletLabel");
const muteButton = $("#muteButton");
const muteLabel = $("#muteLabel");
const identityName = $("#identityName");
const identityMeta = $("#identityMeta");
const identityDot = $("#identityDot");
const vaultAmount = $("#vaultAmount");
const vaultDelta = $("#vaultDelta");
const eventClock = $("#eventClock");
const eventClockLabel = $("#eventClockLabel");
const eventBanner = $("#eventBanner");
const eventTitle = $("#eventTitle");
const eventDesc = $("#eventDesc");
const notifStack = $("#notifStack");
const chatLog = $("#chatLog");
const chatForm = $("#chatForm");
const chatInput = $("#chatInput");
const chatPrefix = $("#chatPrefix");
const interactPrompt = $("#interactPrompt");
const interactText = $("#interactText");
const taskList = $("#taskList");
const communityList = $("#communityList");
const joystick = $("#joystick");
const joystickKnob = $("#joystickKnob");
const touchActions = $("#touchActions");
const touchInteract = $("#touchInteract");
const touchChat = $("#touchChat");
const tierCard = $("#tierCard");
const tierBadge = $("#tierBadge");
const tierLabel = $("#tierLabel");
const tierBalance = $("#tierBalance");
const shareAmount = $("#shareAmount");
const claimedHint = $("#claimedHint");
const treasuryAmount = $("#treasuryAmount");
const stakeModal = $("#stakeModal");
const tierLadder = $("#tierLadder");
const helpButton = $("#helpButton");
const helpModal = $("#helpModal");
const simpleButton = $("#simpleButton");
const simplePanel = $("#simplePanel");
const simpleBody = $("#simpleBody");
const simpleClose = $("#simpleClose");
const meetingButton = $("#meetingButton");
const meetingModal = $("#meetingModal");
const proposalForm = $("#proposalForm");
const proposalList = $("#proposalList");
const propName = $("#propName");
const propTicker = $("#propTicker");
const propCA = $("#propCA");
const hwidLabel = $("#hwidLabel");
const fullscreenButton = $("#fullscreenButton");
const stage = $("#stage");
const dashboardButton = $("#dashboardButton");
const dashboardModal = $("#dashboardModal");

if (new URLSearchParams(window.location.search).has("reset")) {
  localStorage.removeItem(STORAGE_KEY);
}
let persistent = loadState();
state.audio.muted = !!persistent.muted;
setMuted(state.audio.muted);
syncMuteLabel();

// =================== INIT TASK STATE ===================

function initTasks() {
  for (const community of COMMUNITIES) {
    state.taskState[community.id] ||= {};
    for (const task of TASKS) {
      const existing = persistent.taskState?.[community.id]?.[task.id];
      if (existing) {
        state.taskState[community.id][task.id] = existing;
      } else {
        state.taskState[community.id][task.id] = {
          progress: 12 + Math.random() * 38,
          uniqueCitizens: Math.floor(task.minCitizens * (0.3 + Math.random() * 0.6)),
          startedAt: Date.now() - Math.random() * task.durationMs * 0.4,
          lastContribution: {},
          completedCount: 0,
        };
      }
    }
  }
  const showcase = state.taskState.fartcoin?.[TASKS[0].id];
  if (showcase && showcase.progress < 100) {
    showcase.progress = 100;
    showcase.uniqueCitizens = TASKS[0].minCitizens + 20;
    showcase.startedAt = Date.now() - TASKS[0].durationMs - 60 * 1000;
  }
}

// Resilient defaults: don't let a stale persisted 0 wipe the demo state.
if (typeof persistent.vault === "number" && persistent.vault > 0) state.vault = persistent.vault;
if (persistent.communityVault) Object.assign(state.communityVault, persistent.communityVault);
if (typeof persistent.pumptownTreasury === "number" && persistent.pumptownTreasury > 0) {
  state.pumptownTreasury = persistent.pumptownTreasury;
}

// =================== ENGINE INIT ===================

// Loading bar animation. The world bake is synchronous and blocks for
// a moment (HD ground canvas, sprite atlases, etc.) so we paint the bar
// up to 90% before the bake, then complete it once the engine returns.
const splashLoader = $("#splashLoader");
const splashLoaderFill = $("#splashLoaderFill");
const splashLoaderLabel = $("#splashLoaderLabel");
const splashReady = $("#splashReady");

function setLoadProgress(pct, label) {
  if (splashLoaderFill) splashLoaderFill.style.width = `${Math.min(100, Math.max(0, pct))}%`;
  if (label && splashLoaderLabel) splashLoaderLabel.textContent = label;
}

async function bootEngine() {
  setLoadProgress(8, "Connecting to the trenches…");
  await new Promise(r => setTimeout(r, 80));

  setLoadProgress(22, "Baking world tiles…");
  await new Promise(r => setTimeout(r, 60));

  initEngine(canvas, minimap);

  setLoadProgress(60, "Spawning citizens…");
  await new Promise(r => setTimeout(r, 60));

  initTasks();

  setLoadProgress(82, "Tuning the vault…");
  await new Promise(r => setTimeout(r, 60));

  // Restore persistent state now that state.player exists.
  if (typeof persistent.unclaimedShare === "number") state.player.unclaimedShare = persistent.unclaimedShare;
  if (typeof persistent.totalClaimed === "number") state.player.totalClaimed = persistent.totalClaimed;
  if (typeof persistent.pumptownBalance === "number" && persistent.pumptownBalance > 0) {
    setPumptownBalance(persistent.pumptownBalance);
  }
  if (typeof persistent.firstPlayedAt === "number") setFirstPlayedAt(persistent.firstPlayedAt);
  else {
    persistent.firstPlayedAt = state.player.firstPlayedAt;
    saveState();
  }

  state.hooks.onEvent = handleEvent;
  state.hooks.onChat = handleNPCChat;
  state.hooks.onInteractTarget = handleInteractTarget;
  state.hooks.onPlayerCommunityChange = handleCommunityChange;

  setLoadProgress(100, "Ready.");
  await new Promise(r => setTimeout(r, 200));

  // Reveal controls and hide loader
  if (splashLoader) splashLoader.style.display = "none";
  if (splashReady) splashReady.hidden = false;

  // Start the game loop now that state is fully initialized.
  requestAnimationFrame(loop);
}

bootEngine();

// =================== GAME LOOP ===================

function loop(now) {
  tick(now);
  updateDomLight();
  requestAnimationFrame(loop);
}
// Game loop is started inside bootEngine() after init completes.

// =================== MULTIPLAYER PRESENCE ===================
// Broadcast player position every 200ms so other tabs/clients see us.
setInterval(() => {
  if (state.ui.splashOpen) return;
  if (!state.player) return;
  mp.send(MSG.PRESENCE, {
    x: state.player.x,
    y: state.player.y,
    dir: state.player.dir,
    flipX: state.player.flipX,
    community: state.player.community?.id || null,
    name: state.player.name,
  });
}, 200);

// Listen for other players' presence and contributions.
const remotePlayers = new Map(); // id → { x, y, dir, ... , lastSeen }
mp.on(MSG.PRESENCE, (payload, from) => {
  if (from === getPlayerId()) return;
  remotePlayers.set(from, { ...payload, lastSeen: Date.now() });
});
mp.on(MSG.CONTRIBUTION, (payload, from) => {
  if (from === getPlayerId()) return;
  // Apply remote contribution to local task state so everyone sees progress.
  const { communityId, taskId, percent } = payload;
  const d = state.taskState[communityId]?.[taskId];
  if (d) {
    d.progress = Math.min(100, d.progress + percent);
    d.uniqueCitizens += 1;
  }
});
mp.on(MSG.CHAT, (payload, from) => {
  if (from === getPlayerId()) return;
  appendChat({ who: payload.who || "remote", text: payload.text, cls: "remote" });
});

// Expose remotePlayers for engine to render other players.
export { remotePlayers };

setInterval(() => {
  if (!state.player) return;
  driftTasks();
  renderTasks();
  renderCommunities();
  saveState();
}, 4000);

setInterval(() => {
  if (!state.player) return;
  updateDomFull();
}, 800);

// =================== INPUT ===================

const KEYS_TO_TRACK = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "shift",
]);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA") {
    if (event.target === chatInput && key === "escape") {
      chatInput.blur();
      state.ui.chatFocused = false;
    }
    return;
  }
  if (KEYS_TO_TRACK.has(key)) {
    state.input.keys.add(key);
    event.preventDefault();
    if (state.ui.splashOpen) closeSplash();
  }
  if (key === "e") {
    triggerInteract();
  }
  if (key === "t") {
    event.preventDefault();
    chatInput.focus();
    state.ui.chatFocused = true;
  }
  if (key === "enter" && !state.ui.chatFocused) {
    chatInput.focus();
    state.ui.chatFocused = true;
  }
  if (key === " ") {
    if (state.ui.splashOpen) closeSplash();
  }
});

window.addEventListener("keyup", (event) => {
  const key = event.key.toLowerCase();
  state.input.keys.delete(key);
});

window.addEventListener("blur", () => state.input.keys.clear());

canvas.addEventListener("click", () => {
  canvas.focus();
  if (state.ui.splashOpen) closeSplash();
});

chatInput.addEventListener("focus", () => {
  state.ui.chatFocused = true;
});
chatInput.addEventListener("blur", () => {
  state.ui.chatFocused = false;
});

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendChat(chatInput.value);
  chatInput.value = "";
  canvas.focus();
});

// =================== TOUCH ===================

const isTouch =
  window.matchMedia("(pointer:coarse)").matches && !window.matchMedia("(hover:hover)").matches;
if (isTouch) {
  document.body.classList.add("is-touch");
  joystick.hidden = false;
  touchActions.hidden = false;
  setupJoystick();
  touchInteract.addEventListener("click", triggerInteract);
  touchChat.addEventListener("click", () => {
    chatInput.focus();
  });
}

function setupJoystick() {
  let active = false;
  let center = { x: 0, y: 0 };
  const setKnob = (x, y) => {
    const cap = 32;
    const len = Math.hypot(x, y);
    const cx = len > cap ? (x / len) * cap : x;
    const cy = len > cap ? (y / len) * cap : y;
    joystickKnob.style.transform = `translate(${cx}px, ${cy}px)`;
    state.input.touch.dx = cx / cap;
    state.input.touch.dy = cy / cap;
    state.input.touch.active = true;
  };
  const reset = () => {
    joystickKnob.style.transform = "translate(0, 0)";
    state.input.touch.dx = 0;
    state.input.touch.dy = 0;
    state.input.touch.active = false;
    active = false;
  };
  joystick.addEventListener("touchstart", (e) => {
    e.preventDefault();
    active = true;
    const rect = joystick.getBoundingClientRect();
    center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    if (state.ui.splashOpen) closeSplash();
  });
  window.addEventListener("touchmove", (e) => {
    if (!active) return;
    const t = e.touches[0];
    setKnob(t.clientX - center.x, t.clientY - center.y);
  });
  window.addEventListener("touchend", reset);
  window.addEventListener("touchcancel", reset);
}

// =================== INTERACTIONS ===================

function triggerInteract() {
  if (state.ui.splashOpen) {
    closeSplash();
    return;
  }
  const target = tryInteract();
  if (!target) return;
  if (target.kind === "totem") {
    joinCommunity(target.community.id);
  } else if (target.kind === "billboard") {
    contributeAtBoard(target.community.id);
  } else if (target.kind === "raid") {
    triggerRaid(target.community.id);
  } else if (target.kind === "extinguish") {
    extinguishFire(target.community.id);
  } else if (target.kind === "vault") {
    inspectVault();
  } else if (target.kind === "fountain") {
    tossCoin();
  }
}

let lastRaidAt = 0;
function triggerRaid(targetHouseId) {
  const targetHouse = COMMUNITIES.find((c) => c.id === targetHouseId);
  const me = state.player.community;
  if (!me) {
    pushNotification({ type: "event", title: "JOIN A HOUSE FIRST", text: "Raids require a banner." });
    return;
  }
  if (tierIndex(state.player.tier.id) < RAID.tierMin) {
    pushNotification({ type: "event", title: `SHARK+ NEEDED`, text: `Stake more TRENCHLETS to raid.` });
    return;
  }
  const cooldownLeft = lastRaidAt + RAID.cooldownMs - Date.now();
  if (cooldownLeft > 0) {
    pushNotification({
      type: "event",
      title: "RAID ON COOLDOWN",
      text: `Wait ${formatLong(cooldownLeft)}.`,
    });
    return;
  }
  const percent = RAID.stealPercentBands[Math.floor(Math.random() * RAID.stealPercentBands.length)];
  const result = executeRaid(me, targetHouse, percent);
  if (!result) {
    pushNotification({ type: "event", title: "EMPTY POT", text: `${targetHouse.name} has nothing to steal.` });
    return;
  }
  lastRaidAt = Date.now();
  SFX.event();
  spawnSparkleRing(state.player.x, state.player.y - 6, "#ff4a6e", 24);
  spawnFloat(state.player.x, state.player.y - 18, `RAID +${formatCurrency(result.stolen * 0.85)}`, "#ff4a6e");
  pushNotification({
    type: "reward",
    title: `RAID · ${me.name.toUpperCase()} → ${targetHouse.name.toUpperCase()}`,
    text: `Stole ${percent}% (${formatCurrency(result.stolen)}). 85% to your house vault, 10% to your share, 5% to PT.`,
  });
  appendChat({
    who: "system",
    text: `${me.name} raided ${targetHouse.name}: −${formatCurrency(result.stolen)}`,
    cls: "event",
  });
  saveState();
}

function extinguishFire(houseId) {
  if (!dousFire()) return;
  spawnSparkleRing(state.player.x, state.player.y - 6, "#4ff7ff", 22);
  spawnFloat(state.player.x, state.player.y - 18, "−FIRE", "#4ff7ff");
  SFX.click();
  pushNotification({
    type: "community",
    title: "BUCKET BRIGADE",
    text: `Bashed the ${COMMUNITIES.find((c) => c.id === houseId)?.name || "house"} fire by ${(0.18 * 100).toFixed(0)}%.`,
  });
}

function joinCommunity(communityId) {
  const community = COMMUNITIES.find((c) => c.id === communityId);
  if (!community) return;
  if (!state.player.wallet) {
    pushNotification({
      type: "community",
      title: "WALLET REQUIRED",
      text: "Connect a wallet to claim a community. Guests can still play.",
    });
    return;
  }
  if (!community.holding) {
    pushNotification({
      type: "event",
      title: "GATE LOCKED",
      text: `Hold ${community.ticker} to enter ${community.name}.`,
    });
    return;
  }
  setPlayerCommunity(communityId, false);
  pushNotification({
    type: "community",
    title: `JOINED ${community.name.toUpperCase()}`,
    text: `${community.ticker} citizen unlocked.`,
  });
  SFX.join();
  sayPlayer(`for ${community.ticker.toLowerCase()}`);
  appendChat({
    who: "system",
    text: `you joined ${community.name}`,
    cls: "system",
  });
  renderCommunities();
  saveState();
}

function contributeAtBoard(communityId, taskId) {
  if (!state.player.community && !state.player.guest) {
    pushNotification({ type: "event", title: "PICK A SIDE", text: "Press START or enter as guest before contributing." });
    return;
  }
  if (isMinigameActive()) return;

  const community = COMMUNITIES.find((c) => c.id === communityId);
  const owner = pickContributionOwner(community);

  // Launch the full minigame picker → stages → results flow.
  launchMinigame(owner, {
    onComplete(totalPct, stageScores) {
      if (totalPct <= 0) return;

      // Apply world event multiplier (solar eclipse = 2x, raid hour = 1.5x, etc.)
      const eventMult = getEventMultiplier(owner.id);
      const adjustedPct = totalPct * eventMult;

      // Apply contribution to the house's active task.
      const task = pickActiveTask(owner.id);
      if (!task) return;
      const data = state.taskState[owner.id][task.id];
      data.progress = Math.min(100, data.progress + adjustedPct);
      data.uniqueCitizens += 1;
      data.lastContribution[getPlayerId()] = Date.now();

      const cat = TASK_CATEGORIES[task.category];
      const eventNote = eventMult !== 1 ? ` (${eventMult}x event!)` : "";
      spawnFloat(state.player.x, state.player.y - 16, `+${adjustedPct.toFixed(1)}%`, cat.color);
      spawnSparkleRing(state.player.x, state.player.y - 6, owner.color, 12);
      SFX.contribute();
      pushNotification({
        type: "community",
        title: `${owner.name.toUpperCase()} · ${cat.label}`,
        text: `${stageScores.length} stages → +${adjustedPct.toFixed(1)}% house yield${eventNote}`,
      });
      appendChat({
        who: getPlayerHandle(),
        text: `boosted ${owner.ticker.toLowerCase()} yield +${adjustedPct.toFixed(1)}%${eventNote}`,
        cls: "system",
      });

      // Broadcast to other players
      mp.send(MSG.CONTRIBUTION, {
        communityId: owner.id,
        taskId: task.id,
        score: adjustedPct / 100,
        percent: adjustedPct,
      });

      saveState();
      maybeResolveTasks();
    },
    playerTierId: state.player.tier.id,
  });
}

function pickContributionOwner(community) {
  if (state.player.community) return state.player.community;
  if (state.player.guest) {
    const pool = COMMUNITIES.filter((c) => c.id !== community.id || COMMUNITIES.length === 1);
    return pool[Math.floor(Math.random() * pool.length)] || community;
  }
  return community;
}

function pickActiveTask(communityId) {
  const candidates = TASKS.filter((task) => {
    const d = state.taskState[communityId][task.id];
    return d.progress < 100 || Date.now() >= d.startedAt + task.durationMs;
  });
  return candidates[0] || TASKS[0];
}

function inspectVault() {
  const share = state.player.unclaimedShare;
  if (share > 0 && !claimUnlocked()) {
    const remaining = claimUnlockAt() - Date.now();
    pushNotification({
      type: "event",
      title: "CLAIM LOCKED",
      text: `Trenchlets enforces a 12h first-play lock. Unlocks in ${formatLong(remaining)}.`,
    });
    emitSparkle(state.player.x, state.player.y - 10, "#ff4a6e", 12);
    SFX.click();
    return;
  }
  if (share > 0) {
    const claimed = claimShare();
    pushNotification({
      type: "reward",
      title: `CLAIMED ${formatCurrency(claimed)}`,
      text: `Total earned · ${formatCurrency(state.player.totalClaimed)}.`,
    });
    appendChat({
      who: "system",
      text: `you claimed ${formatCurrency(claimed)} from the vault`,
      cls: "system",
    });
    SFX.coin();
    return;
  }
  const totalHouse = Object.values(state.communityVault).reduce((a, b) => a + b, 0);
  pushNotification({
    type: "reward",
    title: `CENTRAL VAULT ${formatCurrency(state.vault)}`,
    text: `15 house vaults ${formatCurrency(totalHouse)} · PT treasury ${formatCurrency(state.pumptownTreasury)}.`,
  });
  emitSparkle(state.player.x, state.player.y - 10, "#ffd84a", 18);
  SFX.click();
}

function tossCoin() {
  if (state.vault < 5) return;
  state.vault -= 5;
  spawnFloat(state.player.x, state.player.y - 16, "WISH", "#aef3ff");
  emitSparkle(state.player.x, state.player.y - 6, "#aef3ff", 18);
  SFX.coin();
  pushNotification({
    type: "event",
    title: "COIN TOSSED",
    text: "Trenchlets thanks you. Tiny luck buff applied.",
  });
  appendChat({ who: "system", text: "you tossed a coin in the fountain.", cls: "system" });
}

function maybeResolveTasks() {
  for (const community of COMMUNITIES) {
    for (const task of TASKS) {
      const d = state.taskState[community.id][task.id];
      if (d.progress >= 100 && Date.now() >= d.startedAt + task.durationMs) {
        resolveTask(community, task);
      }
    }
  }
}

setInterval(maybeResolveTasks, 7500);

function resolveTask(community, task) {
  const d = state.taskState[community.id][task.id];
  const percent = task.rewardBands[Math.floor(Math.random() * task.rewardBands.length)];
  const result = applyTaskResolution({
    communityId: community.id,
    percent,
    split: task.split,
  });
  community.score += Math.round(percent * 1.5);
  d.completedCount += 1;
  d.progress = 12 + Math.random() * 22;
  d.uniqueCitizens = Math.floor(20 + Math.random() * 22);
  d.startedAt = Date.now();
  d.lastContribution = {};
  const cat = TASK_CATEGORIES[task.category];
  pushNotification({
    type: "reward",
    title: `${community.name.toUpperCase()} · ${task.title.toUpperCase()}`,
    text: `${percent}% released · vault +${formatCurrency(result.vaultPart)} · share +${formatCurrency(result.playerPart)} · PT +${formatCurrency(result.treasuryPart)}.`,
  });
  appendChat({
    who: "system",
    text: `${community.name} resolved ${task.title}: ${cat.label} split ${task.split.vault}/${task.split.player}/${task.split.treasury} on ${formatCurrency(result.released)}`,
    cls: "system",
  });
  SFX.reward();
  spawnSparkleRing(
    state.world.vault.cx * 16,
    state.world.vault.cy * 16,
    community.glow,
    36,
  );
  setTimeout(() => spawnSparkleRing(state.world.vault.cx * 16, state.world.vault.cy * 16, "#ffd84a", 24), 220);
  if (result.playerPart > 0) {
    setTimeout(() => spawnFloat(state.player.x, state.player.y - 22, `+${formatCurrency(result.playerPart)} share`, "#ffd84a"), 400);
  }
  saveState();
}

function driftTasks() {
  // No more mock auto-progress. Tasks only advance from real player
  // minigame contributions (local or received via multiplayer).
  // This function is kept as a no-op so the setInterval call doesn't break.
}

// =================== EVENTS UI ===================

function handleEvent({ type, event, communityId }) {
  if (type === "start") {
    SFX.event();
    eventBanner.hidden = false;
    eventTitle.textContent = event.title;
    let desc = event.desc;
    if (event.id === "spotlight" && communityId) {
      const c = COMMUNITIES.find((c) => c.id === communityId);
      desc = `${c.name.toUpperCase()} is spotlit. Contributions for them count 3×.`;
    }
    eventDesc.textContent = desc;
    eventBanner.style.borderColor = event.color;
    eventBanner.style.boxShadow = `0 0 0 1px rgba(0,0,0,0.5), 0 0 26px ${event.color}66`;
    pushNotification({
      type: "event",
      title: event.title,
      text: desc,
    });
    appendChat({
      who: "WORLD",
      text: `${event.title}: ${desc}`,
      cls: "event",
    });
  } else if (type === "end") {
    eventBanner.hidden = true;
  }
}

function handleNPCChat({ who, text, color }) {
  appendChat({ who, text, color });
}

function handleInteractTarget(target) {
  if (target) {
    interactPrompt.hidden = false;
    interactText.textContent = target.label;
  } else {
    interactPrompt.hidden = true;
  }
}

function handleCommunityChange(community) {
  renderCommunities();
  updateIdentityHud();
}

// =================== HUD / DOM SYNC ===================

function updateDomLight() {
  vaultAmount.textContent = formatCurrency(state.vault);
  const delta = state.vaultRate >= 0 ? `+${state.vaultRate.toFixed(2)} /s` : `${state.vaultRate.toFixed(2)} /s`;
  vaultDelta.textContent = delta;
  shareAmount.textContent = formatCurrency(state.player.unclaimedShare);
  const unlocked = claimUnlocked();
  if (state.player.unclaimedShare > 0 && unlocked) {
    claimedHint.textContent = "Walk to vault → press E";
    claimedHint.classList.add("hot");
  } else if (state.player.unclaimedShare > 0 && !unlocked) {
    const remaining = claimUnlockAt() - Date.now();
    claimedHint.textContent = `Locked · ${formatLong(remaining)}`;
    claimedHint.classList.remove("hot");
  } else if (state.player.totalClaimed > 0) {
    claimedHint.textContent = `Total claimed ${formatCurrency(state.player.totalClaimed)}`;
    claimedHint.classList.remove("hot");
  } else if (!unlocked) {
    const remaining = claimUnlockAt() - Date.now();
    claimedHint.textContent = `Unlocks in ${formatLong(remaining)}`;
    claimedHint.classList.remove("hot");
  } else {
    claimedHint.textContent = "Earn share by contributing";
    claimedHint.classList.remove("hot");
  }
  treasuryAmount.textContent = formatCurrency(state.pumptownTreasury);
  if (state.event.active) {
    const remaining = Math.max(0, state.event.until - state.time.totalMs);
    eventClockLabel.textContent = "EVENT ENDS IN";
    eventClock.textContent = formatTimeShort(remaining);
    eventClockLabel.style.color = "var(--gold)";
  } else {
    const left = Math.max(0, state.event.nextAt - state.time.totalMs);
    eventClockLabel.textContent = "NEXT EVENT";
    eventClockLabel.style.color = "var(--muted)";
    eventClock.textContent = formatTimeShort(left);
  }
  updateTierHud();
}

function updateTierHud() {
  const tier = state.player.tier;
  tierLabel.textContent = tier.label;
  tierBadge.textContent = tier.glyph;
  tierBadge.style.background = tier.color;
  tierBalance.textContent = `${formatHuman(state.player.pumptownBalance)} TRENCHLETS`;
}

function updateDomFull() {
  renderTasks();
  renderCommunities();
  updateIdentityHud();
}

function updateIdentityHud() {
  const p = state.player;
  if (p.community) {
    identityName.textContent = p.community.name.toUpperCase();
    identityMeta.textContent = p.wallet
      ? `${p.community.ticker} · ${shortWallet(p.wallet)}`
      : `${p.community.ticker} citizen`;
    identityDot.style.background = p.community.color;
    chatPrefix.textContent = `${p.community.ticker.toLowerCase()}>`;
    chatPrefix.style.color = p.community.color;
  } else if (p.guest) {
    identityName.textContent = "GUEST";
    identityMeta.textContent = "Boosting a random community";
    identityDot.style.background = "#4ff7ff";
    chatPrefix.textContent = "guest>";
    chatPrefix.style.color = "#4ff7ff";
  } else {
    identityName.textContent = "SELECT IDENTITY";
    identityMeta.textContent = "Press START or ENTER AS GUEST";
    identityDot.style.background = "#9d6bff";
    chatPrefix.textContent = "?>";
    chatPrefix.style.color = "var(--muted)";
  }
  if (p.wallet) {
    walletButton.classList.add("connected");
    walletLabel.textContent = shortWallet(p.wallet);
  } else {
    walletButton.classList.remove("connected");
    walletLabel.textContent = "CONNECT WALLET";
  }
}

function renderTasks() {
  const owner = state.player.community || COMMUNITIES[0];
  taskList.innerHTML = "";

  // Update dashboard stats strip
  const dashVault = $("#dashVaultAmount");
  const dashEpoch = $("#dashEpochTimer");
  const dashYield = $("#dashHouseYield");
  const dashTier = $("#dashTier");
  if (dashVault) dashVault.textContent = formatCurrency(state.vault);
  if (dashEpoch) dashEpoch.textContent = formatEpochCountdown();
  if (dashYield) {
    const totalYield = TASKS.reduce(
      (sum, t) => sum + (state.taskState[owner.id]?.[t.id]?.progress || 0),
      0,
    );
    dashYield.textContent = `+${(totalYield / TASKS.length).toFixed(1)}%`;
  }
  if (dashTier) dashTier.textContent = state.player.tier.label;

  for (const task of TASKS) {
    const data = state.taskState[owner.id][task.id];
    const progress = Math.min(100, Math.floor(data.progress));
    const cat = TASK_CATEGORIES[task.category];
    const required = TIERS[task.tierMin];
    const tierOk = tierIndex(state.player.tier.id) >= task.tierMin;
    const cooldown = getMinigameCooldown ? getMinigameCooldown() : 0;

    const card = document.createElement("article");
    card.className = `task-card-v2 cat-${task.category} ${tierOk ? "" : "tier-locked"}`;
    card.style.setProperty("--cat-color", cat.color);
    card.innerHTML = `
      <div class="task-card-v2-head">
        <span class="task-cat" style="background:${cat.color}1f;color:${cat.color};border-color:${cat.color}55">${cat.label}</span>
        <h3>${task.title}</h3>
        ${tierOk ? "" : `<span class="task-pill tier-pill" style="border-color:${required.color}66;color:${required.color}">${required.label}+</span>`}
      </div>
      <p class="task-card-v2-desc">${task.short}</p>
      <div class="progress-shell"><div class="progress-fill" style="width:${progress}%;background:${cat.color}"></div></div>
      <div class="task-card-v2-foot">
        <span class="task-meta-v2">${owner.name} · ${progress}% complete</span>
        <button type="button" class="task-play-btn" ${tierOk && cooldown <= 0 ? "" : "disabled"}>
          ${cooldown > 0 ? `🕒 ${formatLong(cooldown)}` : tierOk ? "PLAY ▶" : `${required.label}+ LOCKED`}
        </button>
      </div>
    `;
    const button = card.querySelector("button");
    button.addEventListener("click", () => {
      if (!tierOk || cooldown > 0) return;
      // Close dashboard, then open minigame
      $("#dashboardModal").hidden = true;
      contributeAtBoard(owner.id, task.id);
    });
    taskList.append(card);
  }
}

// Format the next epoch countdown using EPOCH_CONFIG.
function formatEpochCountdown() {
  const nowMs = Date.now();
  const sinceAnchor = nowMs - EPOCH_CONFIG.anchorMs;
  const intoEpoch = ((sinceAnchor % EPOCH_CONFIG.lengthMs) + EPOCH_CONFIG.lengthMs) % EPOCH_CONFIG.lengthMs;
  const remaining = EPOCH_CONFIG.lengthMs - intoEpoch;
  const h = Math.floor(remaining / 3600000);
  const m = Math.floor((remaining % 3600000) / 60000);
  const s = Math.floor((remaining % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function renderCommunities() {
  communityList.innerHTML = "";
  for (const community of COMMUNITIES) {
    const card = document.createElement("button");
    card.className = "community-card";
    if (state.player.community?.id === community.id) card.classList.add("active");
    if (!community.holding && state.player.wallet) card.classList.add("locked");
    const total = TASKS.reduce(
      (sum, t) => sum + (state.taskState[community.id]?.[t.id]?.progress || 0),
      0,
    );
    const vaultValue = state.communityVault[community.id] || 0;
    const status = state.player.community?.id === community.id
      ? '<span class="pill green">JOINED</span>'
      : community.holding
        ? '<span class="pill">CLAIMABLE</span>'
        : '<span class="pill muted">LOCKED</span>';
    card.innerHTML = `
      <div class="community-card-head">
        <div class="community-icon" style="background:linear-gradient(135deg, ${community.color}, ${community.accent})">${community.ticker.slice(0, 3)}</div>
        <span class="community-name">${community.name}</span>
        <span class="pill gold">${community.score}</span>
      </div>
      <p>${community.tagline}</p>
      <div class="community-vault-row">
        <span class="vault-label">HOUSE VAULT</span>
        <strong class="vault-value">${formatCurrency(vaultValue)}</strong>
      </div>
      <div class="community-card-meta">
        ${status}
        <span class="pill">${Math.round(total)} pulse</span>
      </div>
    `;
    card.addEventListener("click", () => {
      joinCommunity(community.id);
    });
    communityList.append(card);
  }
}

// =================== CHAT ===================

const channel = "BroadcastChannel" in window ? new BroadcastChannel("pumpcity-live") : null;
if (channel) {
  channel.addEventListener("message", (event) => {
    if (event.data?.type === "chat") {
      appendChat({
        who: event.data.who,
        text: event.data.text,
        color: event.data.color || "#4ff7ff",
      });
    }
  });
}

function sendChat(rawText) {
  const text = (rawText || "").trim();
  if (!text) return;
  sayPlayer(text);
  const who = getPlayerHandle();
  const color = state.player.community?.color || "#4ff7ff";
  appendChat({ who, text, color, cls: "self" });
  SFX.chat();
  if (channel) channel.postMessage({ type: "chat", who, text, color });
}

function appendChat({ who, text, color, cls = "" }) {
  const line = document.createElement("div");
  line.className = `chat-line ${cls}`.trim();
  const whoEl = document.createElement("span");
  whoEl.className = "who";
  whoEl.textContent = who + ":";
  if (color) whoEl.style.color = color;
  const textEl = document.createElement("span");
  textEl.className = "text";
  textEl.textContent = text;
  line.append(whoEl, textEl);
  chatLog.append(line);
  while (chatLog.children.length > 60) chatLog.firstChild.remove();
  chatLog.scrollTop = chatLog.scrollHeight;
}

// =================== NOTIFICATIONS ===================

function pushNotification({ type = "event", title, text }) {
  const node = document.createElement("div");
  node.className = `notif ${type}`;
  node.innerHTML = `<strong>${escape(title)}</strong>${escape(text)}`;
  notifStack.append(node);
  setTimeout(() => node.remove(), 5200);
}

function escape(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

// =================== WALLET ===================

walletButton.addEventListener("click", connectWallet);

async function connectWallet() {
  const provider = window.solana;
  if (!provider?.isPhantom) {
    setWallet(`demo-${Math.random().toString(16).slice(2, 8)}`);
    SFX.wallet();
    pushNotification({ type: "community", title: "DEMO WALLET", text: "No Phantom found · using demo wallet for the showcase." });
    updateIdentityHud();
    saveState();
    return;
  }
  try {
    const resp = await provider.connect();
    const wallet = resp.publicKey.toString();
    setWallet(wallet);
    // Server-side sign-in: request a nonce, sign it, post the signature.
    try {
      const nonceRes = await fetch(`/api/auth/nonce?wallet=${encodeURIComponent(wallet)}`);
      if (!nonceRes.ok) throw new Error("nonce fetch failed");
      const { message } = await nonceRes.json();
      const encoded = new TextEncoder().encode(message);
      const signed = await provider.signMessage(encoded, "utf8");
      // Phantom returns signature as Uint8Array — base58 encode.
      const sigB58 = bs58Encode(signed.signature);
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ wallet, signature: sigB58 }),
      });
      if (!verifyRes.ok) throw new Error("signature rejected");
      const { token, player } = await verifyRes.json();
      const expiresAt = Date.now() + 60 * 60 * 1000;
      mpSaveSession(token, wallet, expiresAt);
      // Re-handshake the websocket with the new session so server upgrades us
      // from guest to authed.
      mp.send("hello", { wallet, hardwareId: null, sessionToken: token });
      pushNotification({
        type: "community",
        title: "SIGNED IN",
        text: `Welcome, ${player.display_name}.`,
      });
    } catch (err) {
      pushNotification({
        type: "event",
        title: "SIGN-IN SKIPPED",
        text: "Connected, but you didn't sign the message. Browse-only.",
      });
    }
    SFX.wallet();
  } catch {
    pushNotification({ type: "event", title: "WALLET CANCELLED", text: "Guest mode is still open." });
  }
  updateIdentityHud();
  saveState();
}

// Tiny base58 encoder so we don't pull a whole bs58 dep into the client.
function bs58Encode(bytes) {
  const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;
  const digits = [0];
  for (let i = zeros; i < bytes.length; i++) {
    let carry = bytes[i];
    for (let j = 0; j < digits.length; j++) {
      carry += digits[j] << 8;
      digits[j] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) { digits.push(carry % 58); carry = (carry / 58) | 0; }
  }
  let out = "";
  for (let i = 0; i < zeros; i++) out += "1";
  for (let i = digits.length - 1; i >= 0; i--) out += ALPHABET[digits[i]];
  return out;
}

// =================== SPLASH / ENTER ===================

enterButton.addEventListener("click", () => {
  closeSplash();
  if (!state.player.community && !state.player.guest) {
    setPlayerCommunity(null, true);
  }
});
guestButton.addEventListener("click", () => {
  setPlayerCommunity(null, true);
  closeSplash();
});

function closeSplash() {
  if (!state.ui.splashOpen) return;
  state.ui.splashOpen = false;
  setSplash(false);
  splash.classList.add("hidden");
  setTimeout(() => splash.remove(), 350);
  if (!state.player.guest && !state.player.community) {
    setPlayerCommunity(null, true);
  }
  SFX.splash();
  pushNotification({
    type: "event",
    title: "WELCOME TO TRENCHLETS",
    text: "Walk to a totem and press E to join. Find the billboard to contribute.",
  });
  appendChat({
    who: "system",
    text: "world online. find totems, push tasks, catch events.",
    cls: "system",
  });
  canvas.focus();
}

// =================== NAME TAG ===================
// Top-bar identity badge — click to edit. Sticks to the player's
// hardware id (guests) or wallet (signed in) on the server.

const nameTagButton = $("#nameTagButton");
const nameTagLabel = $("#nameTagLabel");

function syncNameTag() {
  const me = getMe();
  const stored = mpGetDisplayName();
  const name = stored || me?.displayName || "guest";
  if (nameTagLabel) nameTagLabel.textContent = name;
}

nameTagButton?.addEventListener("click", () => {
  const current = mpGetDisplayName() || getMe()?.displayName || "";
  const next = window.prompt("Pick a display name (max 24 chars):", current);
  if (!next) return;
  const clean = next.trim().slice(0, 24);
  if (!clean) return;
  mpSetDisplayName(clean);
  if (nameTagLabel) nameTagLabel.textContent = clean;
});

// Refresh the name tag once the websocket welcomes us.
mp.on?.("welcome", () => syncNameTag());
mp.on?.("rename_ok", () => syncNameTag());
syncNameTag();
setInterval(syncNameTag, 4000);

// =================== MUTE ===================

muteButton.addEventListener("click", () => {
  state.audio.muted = !state.audio.muted;
  setMuted(state.audio.muted);
  persistent.muted = state.audio.muted;
  syncMuteLabel();
  saveState();
});

function syncMuteLabel() {
  muteLabel.textContent = state.audio.muted ? "SOUND OFF" : "SOUND ON";
  muteButton.setAttribute("aria-pressed", String(!state.audio.muted));
}

// =================== UTILITIES ===================

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatCurrency(value) {
  return currency.format(value);
}

function formatLong(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}H ${minutes}M`;
  if (minutes > 0) return `${minutes}M ${seconds}S`;
  return `${seconds}S`;
}

function formatTimeShort(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatHuman(value) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(Math.round(value));
}

// getPlayerId is now imported from multiplayer.js

function getPlayerHandle() {
  if (state.player.community) return state.player.community.ticker.toLowerCase() + "_you";
  return state.player.guest ? "guest" : "anon";
}

function shortWallet(wallet) {
  if (!wallet) return "";
  if (wallet.startsWith("demo-")) return "DEMO WALLET";
  return `${wallet.slice(0, 4)}…${wallet.slice(-4)}`;
}

// =================== PERSISTENCE ===================

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveState() {
  persistent = {
    muted: state.audio.muted,
    vault: state.vault,
    taskState: state.taskState,
    pumptownBalance: state.player.pumptownBalance,
    communityVault: state.communityVault,
    pumptownTreasury: state.pumptownTreasury,
    unclaimedShare: state.player.unclaimedShare,
    totalClaimed: state.player.totalClaimed,
    firstPlayedAt: state.player.firstPlayedAt,
    proposals: persistent.proposals,
    votes: persistent.votes,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(persistent));
}

window.addEventListener("beforeunload", saveState);

// =================== STAKE MODAL ===================

tierCard.addEventListener("click", openStakeModal);

stakeModal.querySelectorAll("[data-close]").forEach((node) => {
  node.addEventListener("click", closeStakeModal);
});

// Staking is gone — tier is read live from the wallet's $TRENCHLETS balance.
// Old [data-stake] buttons were removed from the markup; nothing to wire here.

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !stakeModal.hidden) {
    closeStakeModal();
  }
});

function openStakeModal() {
  renderTierLadder();
  stakeModal.hidden = false;
}

function closeStakeModal() {
  stakeModal.hidden = true;
  canvas.focus();
}

function renderTierLadder() {
  tierLadder.innerHTML = "";
  const currentIdx = tierIndex(state.player.tier.id);
  for (let i = 0; i < TIERS.length; i++) {
    const tier = TIERS[i];
    const node = document.createElement("div");
    node.className = "ladder-row";
    if (i === currentIdx) node.classList.add("current");
    if (i < currentIdx) node.classList.add("done");
    node.innerHTML = `
      <span class="ladder-glyph" style="background:${tier.color}">${tier.glyph}</span>
      <div class="ladder-text">
        <strong>${tier.label}</strong>
        <small>${tier.min === 0 ? "No TRENCHLETS" : `${formatHuman(tier.min)} TRENCHLETS`}</small>
      </div>
      <span class="ladder-state">${
        i === currentIdx ? "YOU" : i < currentIdx ? "DONE" : "LOCKED"
      }</span>
    `;
    tierLadder.append(node);
  }
}

// =================== DASHBOARD ===================

if (dashboardButton && dashboardModal) {
  dashboardButton.addEventListener("click", () => {
    renderTasks();
    renderCommunities();
    dashboardModal.hidden = false;
  });
  dashboardModal.querySelectorAll("[data-close]").forEach((node) => {
    node.addEventListener("click", () => {
      dashboardModal.hidden = true;
    });
  });
}

// =================== HELP / ONBOARDING ===================

helpButton.addEventListener("click", () => {
  helpModal.hidden = false;
});
helpModal.querySelectorAll("[data-close]").forEach((node) => {
  node.addEventListener("click", () => {
    helpModal.hidden = true;
  });
});
// Auto-open the first time the player visits.
if (!persistent.onboarded) {
  helpModal.hidden = false;
  persistent.onboarded = true;
  saveState();
}

// =================== SIMPLE VIEW ===================

simpleButton.addEventListener("click", () => {
  simplePanel.hidden = !simplePanel.hidden;
  simpleButton.setAttribute("aria-pressed", String(!simplePanel.hidden));
  if (!simplePanel.hidden) renderSimpleView();
});
simpleClose.addEventListener("click", () => {
  simplePanel.hidden = true;
  simpleButton.setAttribute("aria-pressed", "false");
});

setInterval(() => {
  if (!simplePanel.hidden) renderSimpleView();
}, 1500);

function renderSimpleView() {
  const lines = [];
  const player = state.player;
  const tier = player.tier;
  const remaining = Math.max(0, claimUnlockAt() - Date.now());
  lines.push("== YOU ==");
  lines.push(`Identity: ${player.community ? player.community.name : (player.guest ? "GUEST" : "WAITING")}`);
  lines.push(`Wallet: ${player.wallet ? shortWallet(player.wallet) : "—"}`);
  lines.push(`Tier: ${tier.label} (${formatHuman(player.pumptownBalance)} TRENCHLETS)`);
  lines.push(`Unclaimed share: ${formatCurrency(player.unclaimedShare)}`);
  lines.push(`Total claimed: ${formatCurrency(player.totalClaimed)}`);
  lines.push(`Claim unlock: ${claimUnlocked() ? "OPEN" : `in ${formatLong(remaining)}`}`);
  lines.push("");
  lines.push("== CENTRAL VAULT ==");
  lines.push(`Pool: ${formatCurrency(state.vault)} (${state.vaultRate >= 0 ? "+" : ""}${state.vaultRate.toFixed(2)}/s)`);
  lines.push(`PT Treasury: ${formatCurrency(state.pumptownTreasury)}`);
  lines.push("");
  lines.push("== HOUSE VAULTS ==");
  for (const c of COMMUNITIES) {
    lines.push(` ${c.ticker.padEnd(10, " ")} ${formatCurrency(state.communityVault[c.id] || 0)}`);
  }
  lines.push("");
  if (state.event.active) {
    const ev = state.event.active;
    const left = Math.max(0, state.event.until - state.time.totalMs);
    lines.push("== WORLD EVENT ==");
    lines.push(`${ev.title} (${ev.kind || "boon"})`);
    lines.push(ev.desc);
    if (state.event.communityId) {
      const target = COMMUNITIES.find((c) => c.id === state.event.communityId);
      if (target) lines.push(`Target: ${target.name}`);
    }
    lines.push(`Ends in: ${formatTimeShort(left)}`);
  } else {
    const next = Math.max(0, state.event.nextAt - state.time.totalMs);
    lines.push(`Next event in ${formatTimeShort(next)}`);
  }
  lines.push("");
  lines.push("== TASKS (active for your house) ==");
  const owner = player.community || COMMUNITIES[0];
  for (const task of TASKS) {
    const data = state.taskState[owner.id][task.id];
    const progress = Math.min(100, Math.floor(data.progress));
    lines.push(` ${task.title}: ${progress}% (${TASK_CATEGORIES[task.category].label})`);
  }
  lines.push("");
  if (state.raidLog.length) {
    lines.push("== RECENT RAIDS ==");
    for (const r of state.raidLog.slice(0, 5)) {
      const a = COMMUNITIES.find((c) => c.id === r.attacker)?.ticker || r.attacker;
      const t = COMMUNITIES.find((c) => c.id === r.target)?.ticker || r.target;
      lines.push(` ${a} raided ${t}: ${formatCurrency(r.amount)}`);
    }
  }
  simpleBody.textContent = lines.join("\n");
}

// =================== FULLSCREEN ===================

fullscreenButton.addEventListener("click", () => {
  if (document.fullscreenElement) {
    document.exitFullscreen?.();
  } else {
    document.documentElement.requestFullscreen?.();
  }
  document.body.classList.toggle("max-stage");
});

// =================== TOWN MEETING ===================

meetingButton.addEventListener("click", () => {
  hwidLabel.textContent = getHwid();
  renderProposals();
  meetingModal.hidden = false;
});
meetingModal.querySelectorAll("[data-close]").forEach((node) => {
  node.addEventListener("click", () => {
    meetingModal.hidden = true;
  });
});

proposalForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = propName.value.trim();
  const ticker = propTicker.value.trim().toUpperCase();
  const ca = propCA.value.trim();
  if (!name || !ticker || !ca) return;
  if (!/^[A-Za-z0-9]{8,64}$/.test(ca)) {
    pushNotification({ type: "event", title: "INVALID CA", text: "Must be alphanumeric (8–64 chars)." });
    return;
  }
  persistent.proposals = persistent.proposals || {};
  const id = ca.toLowerCase();
  if (persistent.proposals[id]) {
    pushNotification({ type: "event", title: "DUPLICATE", text: "That CA is already a proposal." });
    return;
  }
  persistent.proposals[id] = {
    id,
    name,
    ticker,
    ca,
    submittedAt: Date.now(),
    submittedBy: getHwid(),
    votes: { [getHwid()]: 1 },
  };
  saveState();
  propName.value = "";
  propTicker.value = "";
  propCA.value = "";
  renderProposals();
  pushNotification({ type: "community", title: "PROPOSAL FILED", text: `${ticker} is now up for vote.` });
});

function renderProposals() {
  const proposals = Object.values(persistent.proposals || {}).sort(
    (a, b) => Object.values(b.votes || {}).reduce((x, y) => x + y, 0) - Object.values(a.votes || {}).reduce((x, y) => x + y, 0),
  );
  if (proposals.length === 0) {
    proposalList.innerHTML = `<p class="modal-foot">No proposals yet. Be the first.</p>`;
    return;
  }
  proposalList.innerHTML = "";
  const hwid = getHwid();
  for (const p of proposals) {
    const tally = Object.values(p.votes || {}).reduce((x, y) => x + y, 0);
    const voted = !!p.votes?.[hwid];
    const node = document.createElement("article");
    node.className = "proposal-row";
    node.innerHTML = `
      <div class="proposal-row-text">
        <strong>${escape(p.ticker)}</strong>
        <span>${escape(p.name)}</span>
        <small>CA · ${escape(p.ca.slice(0, 6))}…${escape(p.ca.slice(-4))}</small>
      </div>
      <div class="proposal-vote">
        <span class="vote-tally">${tally}</span>
        <button type="button" class="vote-button ${voted ? "voted" : ""}" data-vote="${p.id}">
          ${voted ? "VOTED" : "VOTE"}
        </button>
      </div>
    `;
    const button = node.querySelector("[data-vote]");
    button.addEventListener("click", () => {
      if (voted) return;
      p.votes = p.votes || {};
      p.votes[hwid] = 1;
      saveState();
      renderProposals();
      SFX.click();
      pushNotification({ type: "community", title: "VOTE CAST", text: `${p.ticker} now at ${tally + 1}.` });
    });
    proposalList.append(node);
  }
}

function getHwid() {
  let id = localStorage.getItem("pumpcity-hwid");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `hw-${Math.random().toString(16).slice(2, 14)}`;
    localStorage.setItem("pumpcity-hwid", id);
  }
  return id;
}

// Initial DOM paint
updateIdentityHud();
renderTasks();
renderCommunities();
updateTierHud();
