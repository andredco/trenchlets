// =========================================================
// Trenchlets · Minigame Launcher (v3 — per-game cooldown + polish)
// =========================================================

import { mountRhythmRush } from "./rhythm-rush.js";
import { mountMemoryMint } from "./memory-mint.js";
import { mountQuickTap } from "./quick-tap.js";
import { mountPatternMatch } from "./pattern-match.js";
import { mountStackTower } from "./stack-tower.js";

const REGISTRY = [
  { id: "rhythm-rush", name: "Rhythm Rush", desc: "Hit falling notes guitar-hero style.", mount: mountRhythmRush },
  { id: "memory-mint", name: "Memory Mint", desc: "Repeat the flashing pattern — each round adds a step.", mount: mountMemoryMint },
  { id: "quick-tap", name: "Quick Tap", desc: "Tap the highlighted target as fast as you can.", mount: mountQuickTap },
  { id: "pattern-match", name: "Pattern Match", desc: "Match symbol pairs before time runs out.", mount: mountPatternMatch },
  { id: "stack-tower", name: "Stack Tower", desc: "Stack moving blocks — one slip ends the run.", mount: mountStackTower },
];

const DIFFICULTY_META = {
  easy:   { label: "EASY",   color: "#5cff9a", pct: 2, cooldownMs: 60 * 60 * 1000,     desc: "Relaxed pace. ~2 yield max." },
  medium: { label: "MEDIUM", color: "#ffd84a", pct: 4, cooldownMs: 90 * 60 * 1000,     desc: "Faster and trickier. ~4 yield max." },
  hard:   { label: "HARD",   color: "#ff4a6e", pct: 6, cooldownMs: 2 * 60 * 60 * 1000, desc: "Intense. One mistake costs you. ~6 yield max." },
};

const TOTAL_STAGES = 3;
// Per-(game, difficulty) cooldown. Map keyed JSON in localStorage so each
// minigame's cooldown is independent — finishing Rhythm Rush doesn't lock
// Memory Mint, etc.
const COOLDOWN_KEY = "trenchlets-minigame-cooldowns-v2";

let activeGame = null;
let overlayEl = null;

// ── Cooldown helpers ────────────────────────────────────────
function loadCooldowns() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return {};
    return JSON.parse(raw) || {};
  } catch { return {}; }
}
function saveCooldowns(cds) {
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify(cds));
}
function cdKey(gameId, difficulty) {
  return `${gameId}::${difficulty}`;
}
function getCooldownFor(gameId, difficulty) {
  const cds = loadCooldowns();
  const until = cds[cdKey(gameId, difficulty)] || 0;
  return Math.max(0, until - Date.now());
}
function setCooldownFor(gameId, difficulty, ms) {
  const cds = loadCooldowns();
  cds[cdKey(gameId, difficulty)] = Date.now() + ms;
  // Garbage collect old expired entries while we're at it.
  for (const k of Object.keys(cds)) {
    if (cds[k] < Date.now() - 60_000) delete cds[k];
  }
  saveCooldowns(cds);
}

// Returns the EARLIEST time the player can play any combination again.
// Used by the dashboard task button to show a single "next available"
// hint when nothing is playable.
export function getMinigameCooldown() {
  const cds = loadCooldowns();
  const now = Date.now();
  let earliest = Infinity;
  for (const k in cds) {
    if (cds[k] > now && cds[k] < earliest) earliest = cds[k];
  }
  return earliest === Infinity ? 0 : Math.max(0, earliest - now);
}

export function isMinigameActive() {
  return activeGame !== null || overlayEl !== null;
}

// ── Helpers ─────────────────────────────────────────────────
function formatTime(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
function el(tag, attrs = {}) {
  const e = document.createElement(tag);
  for (const k in attrs) {
    if (k === "style") Object.assign(e.style, attrs[k]);
    else if (k === "className") e.className = attrs[k];
    else if (k === "html") e.innerHTML = attrs[k];
    else if (k === "text") e.textContent = attrs[k];
    else e.setAttribute(k, attrs[k]);
  }
  return e;
}
function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}

// ── Public entry ───────────────────────────────────────────
export function launchMinigame(communityDef, opts = {}) {
  if (activeGame || overlayEl) return;
  const { onComplete } = opts;
  const houseName = communityDef?.name || "Your House";
  const houseColor = communityDef?.color || "#1eff8e";

  showPicker(houseName, houseColor, (game, diff) => {
    runStages(game, diff, houseColor, (totalPct, stages) => {
      if (onComplete) onComplete(totalPct, stages);
    });
  });
}

// ── Picker ──────────────────────────────────────────────────
function showPicker(houseName, houseColor, onStart) {
  const overlay = el("div", { className: "mg-overlay" });
  const modal = el("div", { className: "mg-modal" });
  modal.innerHTML = `
    <header class="mg-head">
      <div>
        <h2 class="mg-title" style="color:${esc(houseColor)}">${esc(houseName)}</h2>
        <p class="mg-sub">Pick a game and difficulty. Each combination has its own cooldown.</p>
      </div>
      <button class="mg-close" type="button" aria-label="Close">×</button>
    </header>
    <div class="mg-body">
      <h4 class="mg-section-label">Select a game</h4>
      <div class="mg-game-list" id="mgGameList"></div>
      <h4 class="mg-section-label">Difficulty</h4>
      <div class="mg-diff-row" id="mgDiffRow"></div>
      <p class="mg-foot">Cooldown shown per game/difficulty. Finish other games to keep contributing while one's on cooldown.</p>
    </div>
  `;

  let selectedGameId = null;

  // Game cards
  const gameList = modal.querySelector("#mgGameList");
  for (const g of REGISTRY) {
    const card = el("button", { className: "mg-game-card", type: "button" });
    card.dataset.id = g.id;
    card.innerHTML = `
      <div class="mg-game-card-text">
        <strong>${esc(g.name)}</strong>
        <span>${esc(g.desc)}</span>
      </div>
      <span class="mg-game-card-cd"></span>
    `;
    card.addEventListener("click", () => {
      selectedGameId = g.id;
      gameList.querySelectorAll(".mg-game-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      renderDiffRow();
    });
    gameList.appendChild(card);
  }

  // Diff buttons
  const diffRow = modal.querySelector("#mgDiffRow");
  function renderDiffRow() {
    diffRow.innerHTML = "";
    for (const diff of ["easy", "medium", "hard"]) {
      const m = DIFFICULTY_META[diff];
      const btn = el("button", { className: `mg-diff-btn diff-${diff}`, type: "button" });
      btn.style.setProperty("--diff-color", m.color);

      let cdMs = 0;
      let disabled = false;
      if (selectedGameId) {
        cdMs = getCooldownFor(selectedGameId, diff);
        disabled = cdMs > 0;
      } else {
        disabled = true;
      }

      btn.disabled = disabled;
      btn.innerHTML = `
        <span class="mg-diff-label">${m.label}</span>
        <span class="mg-diff-desc">${esc(m.desc)}</span>
        ${cdMs > 0 ? `<span class="mg-diff-cd">⏳ ${formatTime(cdMs)}</span>` : ""}
      `;
      btn.addEventListener("click", () => {
        if (btn.disabled) return;
        const game = REGISTRY.find((r) => r.id === selectedGameId);
        if (!game) return;
        cleanup();
        onStart(game, diff);
      });
      diffRow.appendChild(btn);
    }
  }
  renderDiffRow();

  // Live tick: refresh cooldown timers in the diff row + per-card hints.
  function tick() {
    if (selectedGameId) renderDiffRow();
    // Per-game-card cooldown hint (shows the smallest active cooldown for that game)
    for (const card of gameList.querySelectorAll(".mg-game-card")) {
      const id = card.dataset.id;
      const cdEl = card.querySelector(".mg-game-card-cd");
      const allCds = ["easy", "medium", "hard"]
        .map((d) => ({ d, cd: getCooldownFor(id, d) }))
        .filter((x) => x.cd > 0);
      if (allCds.length === 0) {
        cdEl.textContent = "";
        cdEl.classList.remove("active");
      } else {
        // Show the cooldown closest to expiring.
        allCds.sort((a, b) => a.cd - b.cd);
        cdEl.textContent = `${allCds.length} cd · next ${formatTime(allCds[0].cd)}`;
        cdEl.classList.add("active");
      }
    }
  }
  tick();
  const tickInterval = setInterval(tick, 500);

  function cleanup() {
    clearInterval(tickInterval);
    overlay.remove();
    overlayEl = null;
  }
  modal.querySelector(".mg-close").addEventListener("click", cleanup);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cleanup(); });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;
}

// ── Stage Runner ────────────────────────────────────────────
function runStages(gameDef, difficulty, houseColor, onAllDone) {
  const diffMeta = DIFFICULTY_META[difficulty];
  const stageScores = [];
  let currentStage = 1;
  let totalPts = 0;
  let quit = false;

  function startStage(num) {
    if (quit) return;
    const overlay = el("div", { className: "mg-overlay" });
    const modal = el("div", { className: "mg-modal mg-stage-modal" });
    modal.innerHTML = `
      <header class="mg-stage-head">
        <span class="mg-stage-counter" style="color:${esc(houseColor)}">STAGE ${num}/${TOTAL_STAGES}</span>
        <span class="mg-stage-score">${totalPts} pts</span>
        <button class="mg-quit" type="button">QUIT</button>
      </header>
      <div class="mg-stage-body" id="mgStageArea"></div>
      <footer class="mg-stage-foot">
        <span class="mg-stage-title">${esc(gameDef.name)}</span>
        <span class="mg-stage-diff diff-${difficulty}">${diffMeta.label}</span>
      </footer>
    `;
    const area = modal.querySelector("#mgStageArea");
    const scoreEl = modal.querySelector(".mg-stage-score");

    modal.querySelector(".mg-quit").addEventListener("click", () => {
      quit = true;
      if (activeGame?.destroy) activeGame.destroy();
      activeGame = null;
      overlay.remove();
      overlayEl = null;
      showResults(stageScores, gameDef.id, difficulty, houseColor, onAllDone);
    });

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlayEl = overlay;

    // Slightly more time at lower stages, tighter as you climb.
    const baseMs = 28000;
    const stageMs = Math.max(12000, baseMs - (num - 1) * 1400);

    activeGame = gameDef.mount(area, {
      stage: num,
      difficulty,
      color: houseColor,
      maxMs: stageMs,
      onScore: (s) => { scoreEl.textContent = `${totalPts + Math.round(s * 100)} pts`; },
      onFinish: (s) => {
        const pts = Math.round(Math.max(0, Math.min(1, s)) * 100);
        stageScores.push(pts);
        totalPts += pts;
        if (activeGame?.destroy) activeGame.destroy();
        activeGame = null;
        overlay.remove();
        overlayEl = null;
        currentStage++;
        if (currentStage > TOTAL_STAGES || quit) {
          showResults(stageScores, gameDef.id, difficulty, houseColor, onAllDone);
        } else {
          setTimeout(() => startStage(currentStage), 500);
        }
      },
    });
  }

  startStage(1);
}

// ── Results ─────────────────────────────────────────────────
function showResults(stageScores, gameId, difficulty, houseColor, onAllDone) {
  const diffMeta = DIFFICULTY_META[difficulty];
  // Average score across stages (0..1), then scale by difficulty's max yield.
  // A perfect easy run = +2 yield, perfect medium = +4, perfect hard = +6.
  // No stage-count multiplier — adding stages doesn't inflate the cap.
  const stageCount = Math.max(1, stageScores.length);
  const avgScore = stageScores.reduce((a, b) => a + b, 0) / (stageCount * 100);
  const totalContrib = (avgScore * diffMeta.pct).toFixed(2);

  // Cooldown applies ONLY to this (game, difficulty) pair.
  setCooldownFor(gameId, difficulty, diffMeta.cooldownMs);

  const overlay = el("div", { className: "mg-overlay" });
  const modal = el("div", { className: "mg-modal mg-results-modal" });

  let breakdownHtml = "";
  for (let i = 0; i < stageScores.length; i++) {
    breakdownHtml += `
      <div class="mg-result-row">
        <span>Stage ${i + 1}</span>
        <span style="color:${esc(houseColor)}">${stageScores[i]} pts</span>
      </div>`;
  }

  modal.innerHTML = `
    <header class="mg-head">
      <div>
        <h2 class="mg-title" style="color:${esc(houseColor)}">RESULTS</h2>
        <p class="mg-sub">${esc(diffMeta.label)} · ${stageScores.length} stages</p>
      </div>
    </header>
    <div class="mg-body">
      <div class="mg-result-breakdown">${breakdownHtml}</div>
      <div class="mg-result-total" style="color:${esc(houseColor)}">${rawTotal} / ${maxPossible} total</div>
      <div class="mg-result-yield">House vault yield <strong style="color:${esc(houseColor)}">+${totalContrib}%</strong></div>
      <div class="mg-result-cd">This game on cooldown: ${formatTime(diffMeta.cooldownMs)}<br><small>Other games + difficulties are still available.</small></div>
      <button class="mg-done-btn" style="background:${esc(houseColor)}">DONE</button>
    </div>
  `;
  modal.querySelector(".mg-done-btn").addEventListener("click", () => {
    overlay.remove();
    overlayEl = null;
  });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  if (onAllDone) onAllDone(parseFloat(totalContrib), stageScores);
}
