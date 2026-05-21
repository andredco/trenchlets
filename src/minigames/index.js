// =========================================================
// Trenchlets · Minigame Launcher (v2 — Task Picker + Stages)
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
  easy:   { label: "EASY",   color: "#5cff9a", pct: 2, cooldownMs: 60 * 60 * 1000,     desc: "Relaxed pace. +2% max per stage." },
  medium: { label: "MEDIUM", color: "#ffd84a", pct: 4, cooldownMs: 90 * 60 * 1000,     desc: "Faster and trickier. +4% max per stage." },
  hard:   { label: "HARD",   color: "#ff4a6e", pct: 6, cooldownMs: 2 * 60 * 60 * 1000, desc: "Intense. One mistake costs you. +6% max per stage." },
};

const TOTAL_STAGES = 10;
const COOLDOWN_KEY = "trenchlets-minigame-cooldown";

let activeGame = null;
let overlayEl = null;

// ── Cooldown ────────────────────────────────────────────────
function getCooldownUntil() {
  try {
    const raw = localStorage.getItem(COOLDOWN_KEY);
    if (!raw) return 0;
    const { until } = JSON.parse(raw);
    return typeof until === "number" ? until : 0;
  } catch { return 0; }
}
function setCooldown(ms) {
  localStorage.setItem(COOLDOWN_KEY, JSON.stringify({ until: Date.now() + ms }));
}
export function getMinigameCooldown() {
  return Math.max(0, getCooldownUntil() - Date.now());
}
export function isMinigameActive() {
  return activeGame !== null || overlayEl !== null;
}

// ── Helpers ─────────────────────────────────────────────────
function formatTime(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}
function mkEl(tag, style = {}, html = "") {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (html) e.innerHTML = html;
  return e;
}

// ── Main Export ─────────────────────────────────────────────
export function launchMinigame(communityDef, opts = {}) {
  if (activeGame || overlayEl) return;
  const { onComplete } = opts;
  const houseName = communityDef?.name || "Your House";
  const houseColor = communityDef?.color || "#5cff9a";

  showPicker(houseName, houseColor, (game, diff) => {
    runStages(game, diff, houseColor, (totalPct, stages) => {
      if (onComplete) onComplete(totalPct, stages);
    });
  });
}

// ── Task Picker ─────────────────────────────────────────────
function showPicker(houseName, houseColor, onStart) {
  const cooldownMs = getMinigameCooldown();
  const onCooldown = cooldownMs > 0;

  const overlay = mkEl("div", { position: "fixed", inset: "0", zIndex: "9999", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,4,12,0.92)", fontFamily: "inherit" });
  const modal = mkEl("div", { background: "#0c0c1a", border: "1px solid #222", borderRadius: "12px", width: "min(94vw,520px)", maxHeight: "90vh", overflowY: "auto", padding: "24px", color: "#eee", position: "relative" });

  modal.innerHTML = `
    <h2 style="margin:0 0 4px;font-size:1.3rem;color:${houseColor};letter-spacing:1px">${houseName}</h2>
    <p style="margin:0 0 16px;font-size:0.78rem;color:#999;line-height:1.5">
      Complete minigames to boost your house's vault yield. Higher difficulty = bigger contribution.<br>
      Each game has <strong>10 stages</strong> that get progressively harder. After completing a game you'll be on cooldown for 1–2 hours.<br>
      <em>This is a team effort — every member's contribution stacks.</em>
    </p>
    <h4 style="margin:0 0 8px;font-size:0.8rem;color:#888;text-transform:uppercase;letter-spacing:1px">Select a game</h4>
  `;

  // Game list
  let selectedId = null;
  const list = mkEl("div", { marginBottom: "14px" });
  REGISTRY.forEach(g => {
    const item = mkEl("div", { padding: "10px 12px", marginBottom: "6px", borderRadius: "6px", border: "1px solid #333", cursor: "pointer", transition: "border-color .15s" });
    item.innerHTML = `<strong style="font-size:0.85rem">${g.name}</strong><br><span style="color:#888;font-size:0.72rem">${g.desc}</span>`;
    item.addEventListener("click", () => {
      selectedId = g.id;
      list.querySelectorAll("div").forEach(d => { d.style.borderColor = "#333"; d.style.background = "transparent"; });
      item.style.borderColor = houseColor;
      item.style.background = "rgba(255,255,255,0.03)";
    });
    list.appendChild(item);
  });
  modal.appendChild(list);

  // Difficulty row
  const diffLabel = mkEl("h4", { margin: "0 0 8px", fontSize: "0.8rem", color: "#888", textTransform: "uppercase", letterSpacing: "1px" }, "Choose difficulty");
  modal.appendChild(diffLabel);
  const diffRow = mkEl("div", { display: "flex", gap: "8px" });
  ["easy", "medium", "hard"].forEach(diff => {
    const m = DIFFICULTY_META[diff];
    const btn = mkEl("button", { flex: "1", padding: "12px 6px", border: "none", borderRadius: "6px", cursor: onCooldown ? "not-allowed" : "pointer", fontFamily: "inherit", fontSize: "0.8rem", fontWeight: "700", color: "#0c0c1a", background: m.color, opacity: onCooldown ? "0.3" : "1", transition: "opacity .15s" });
    btn.innerHTML = `${m.label}<br><span style="font-size:0.62rem;font-weight:400;opacity:0.8">${m.desc}</span>`;
    btn.disabled = onCooldown;
    btn.addEventListener("click", () => {
      if (onCooldown || !selectedId) return;
      const game = REGISTRY.find(g => g.id === selectedId);
      if (!game) return;
      overlay.remove();
      overlayEl = null;
      onStart(game, diff);
    });
    diffRow.appendChild(btn);
  });
  modal.appendChild(diffRow);

  // Cooldown banner
  if (onCooldown) {
    const banner = mkEl("div", { textAlign: "center", padding: "12px", background: "#1a1020", borderRadius: "8px", marginTop: "14px", color: "#ff6b8a", fontSize: "0.85rem" });
    banner.textContent = `⏳ On cooldown — ${formatTime(cooldownMs)} remaining`;
    modal.appendChild(banner);
    const iv = setInterval(() => {
      const rem = getMinigameCooldown();
      if (rem <= 0) { clearInterval(iv); overlay.remove(); overlayEl = null; showPicker(houseName, houseColor, onStart); return; }
      banner.textContent = `⏳ On cooldown — ${formatTime(rem)} remaining`;
    }, 1000);
  }

  // Close on backdrop click
  overlay.addEventListener("click", e => { if (e.target === overlay) { overlay.remove(); overlayEl = null; } });
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
    const overlay = mkEl("div", { position: "fixed", inset: "0", zIndex: "9999", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,4,12,0.92)", fontFamily: "inherit" });
    const modal = mkEl("div", { background: "#0c0c1a", border: "1px solid #222", borderRadius: "12px", width: "min(94vw,440px)", maxHeight: "90vh", overflowY: "auto", padding: "16px 20px", color: "#eee", position: "relative" });

    // Top bar
    const top = mkEl("div", { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" });
    const stageEl = mkEl("span", { fontSize: "0.9rem", fontWeight: "700", color: houseColor }, `STAGE ${num}/${TOTAL_STAGES}`);
    const scoreEl = mkEl("span", { fontSize: "0.85rem", color: "#aaa" }, `SCORE: ${totalPts}`);
    top.appendChild(stageEl);
    top.appendChild(scoreEl);
    modal.appendChild(top);

    // Quit
    const quitBtn = mkEl("button", { position: "absolute", top: "12px", right: "14px", background: "none", border: "1px solid #444", borderRadius: "6px", color: "#ccc", padding: "4px 12px", cursor: "pointer", fontFamily: "inherit", fontSize: "0.72rem" }, "QUIT");
    quitBtn.addEventListener("click", () => {
      quit = true;
      if (activeGame?.destroy) activeGame.destroy();
      activeGame = null;
      overlay.remove();
      overlayEl = null;
      showResults(stageScores, difficulty, houseColor, onAllDone);
    });
    modal.appendChild(quitBtn);

    // Game area
    const area = mkEl("div", { minHeight: "260px", position: "relative" });
    modal.appendChild(area);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlayEl = overlay;

    // Time decreases per stage (harder)
    const baseMs = 28000;
    const stageMs = Math.max(12000, baseMs - (num - 1) * 1400);

    activeGame = gameDef.mount(area, {
      stage: num,
      difficulty,
      color: houseColor,
      maxMs: stageMs,
      onScore: (s) => { scoreEl.innerHTML = `SCORE: ${totalPts + Math.round(s * 100)}`; },
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
          showResults(stageScores, difficulty, houseColor, onAllDone);
        } else {
          setTimeout(() => startStage(currentStage), 500);
        }
      },
    });
  }

  startStage(1);
}

// ── Results ─────────────────────────────────────────────────
function showResults(stageScores, difficulty, houseColor, onAllDone) {
  const diffMeta = DIFFICULTY_META[difficulty];
  const maxPossible = TOTAL_STAGES * 100;
  const rawTotal = stageScores.reduce((a, b) => a + b, 0);
  const totalContrib = ((rawTotal / maxPossible) * diffMeta.pct * stageScores.length).toFixed(2);

  setCooldown(diffMeta.cooldownMs);

  const overlay = mkEl("div", { position: "fixed", inset: "0", zIndex: "9999", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(4,4,12,0.92)", fontFamily: "inherit" });
  const modal = mkEl("div", { background: "#0c0c1a", border: "1px solid #222", borderRadius: "12px", width: "min(94vw,420px)", maxHeight: "90vh", overflowY: "auto", padding: "24px", color: "#eee" });

  modal.innerHTML = `<h2 style="text-align:center;font-size:1.2rem;color:${houseColor};margin:0 0 14px;letter-spacing:1px">RESULTS</h2>`;

  // Breakdown
  const breakdown = mkEl("div", { marginBottom: "12px" });
  stageScores.forEach((pts, i) => {
    const row = mkEl("div", { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "0.78rem", borderBottom: "1px solid #1a1a2e" });
    row.innerHTML = `<span>Stage ${i + 1}</span><span style="color:${houseColor}">${pts} pts</span>`;
    breakdown.appendChild(row);
  });
  modal.appendChild(breakdown);

  modal.innerHTML += `
    <div style="text-align:center;font-size:1rem;font-weight:700;color:${houseColor};margin:14px 0">${rawTotal} / ${maxPossible} total</div>
    <div style="text-align:center;font-size:0.88rem;color:#ccc;margin:6px 0">Your house vault yield increased by <strong style="color:${houseColor}">${totalContrib}%</strong></div>
    <div style="text-align:center;font-size:0.75rem;color:#888;margin:10px 0">Cooldown: ${formatTime(diffMeta.cooldownMs)} — come back and play again!</div>
  `;

  const closeBtn = mkEl("button", { display: "block", margin: "18px auto 0", padding: "10px 32px", border: "none", borderRadius: "6px", background: houseColor, color: "#0c0c1a", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem", fontWeight: "700" }, "DONE");
  closeBtn.addEventListener("click", () => { overlay.remove(); overlayEl = null; });
  modal.appendChild(closeBtn);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  overlayEl = overlay;

  if (onAllDone) onAllDone(parseFloat(totalContrib), stageScores);
}
