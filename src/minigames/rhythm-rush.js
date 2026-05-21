// =========================================================
// Rhythm Rush — Guitar Hero style falling notes
// =========================================================
// 4 lanes. Notes fall from top. Player hits the matching key
// (D, F, J, K) when the note crosses the hit zone. Timing
// determines points: perfect > good > miss.

export function mountRhythmRush(container, opts) {
  const LANES = 4;
  const KEYS = ["d", "f", "j", "k"];
  const LANE_W = 60;
  const HIT_Y = 260;
  const NOTE_SPEED = 180; // px per second
  const SPAWN_INTERVAL = 600; // ms between notes
  const PERFECT_WINDOW = 30; // px from hit zone center
  const GOOD_WINDOW = 60;

  let score = 0;
  let totalNotes = 0;
  let hits = 0;
  let running = true;
  let notes = [];
  let lastSpawn = 0;
  let animFrame = null;

  container.innerHTML = `
    <canvas class="minigame-canvas" width="${LANES * LANE_W}" height="300"></canvas>
    <div class="rhythm-keys">${KEYS.map((k, i) => `<span class="rhythm-key" data-lane="${i}">${k.toUpperCase()}</span>`).join("")}</div>
  `;
  const canvas = container.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  function spawnNote() {
    const lane = Math.floor(Math.random() * LANES);
    notes.push({ lane, y: -20, hit: false, missed: false });
    totalNotes++;
  }

  function handleKey(e) {
    if (!running) return;
    const idx = KEYS.indexOf(e.key.toLowerCase());
    if (idx === -1) return;
    e.preventDefault();
    // Find closest unhit note in this lane near the hit zone
    let best = null;
    let bestDist = Infinity;
    for (const n of notes) {
      if (n.lane !== idx || n.hit || n.missed) continue;
      const dist = Math.abs(n.y - HIT_Y);
      if (dist < bestDist) { bestDist = dist; best = n; }
    }
    if (best && bestDist <= GOOD_WINDOW) {
      best.hit = true;
      hits++;
      if (bestDist <= PERFECT_WINDOW) score += 1;
      else score += 0.6;
      opts.onScore(totalNotes > 0 ? score / totalNotes : 0);
    }
    // Flash the key
    const el = container.querySelector(`[data-lane="${idx}"]`);
    if (el) { el.classList.add("active"); setTimeout(() => el.classList.remove("active"), 120); }
  }

  function loop(ts) {
    if (!running) return;
    const dt = 16; // approx
    // Spawn
    if (ts - lastSpawn > SPAWN_INTERVAL) { spawnNote(); lastSpawn = ts; }
    // Update
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      n.y += NOTE_SPEED * (dt / 1000);
      if (n.y > HIT_Y + GOOD_WINDOW + 20) { n.missed = true; }
    }
    // Prune old notes
    notes = notes.filter((n) => n.y < 320);
    // Draw
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Lanes
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(i * LANE_W, 0, LANE_W - 2, 300);
    }
    // Hit zone
    ctx.fillStyle = "rgba(92,255,154,0.15)";
    ctx.fillRect(0, HIT_Y - GOOD_WINDOW, canvas.width, GOOD_WINDOW * 2);
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HIT_Y); ctx.lineTo(canvas.width, HIT_Y);
    ctx.stroke();
    // Notes
    for (const n of notes) {
      if (n.hit) continue;
      ctx.fillStyle = n.missed ? "#ff4a6e" : opts.color;
      ctx.beginPath();
      ctx.arc(n.lane * LANE_W + LANE_W / 2, n.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
    animFrame = requestAnimationFrame(loop);
  }

  document.addEventListener("keydown", handleKey);
  animFrame = requestAnimationFrame(loop);

  return {
    getScore() { return totalNotes > 0 ? score / totalNotes : 0; },
    destroy() {
      running = false;
      cancelAnimationFrame(animFrame);
      document.removeEventListener("keydown", handleKey);
    },
  };
}
