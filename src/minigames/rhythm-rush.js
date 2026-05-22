// =========================================================
// Rhythm Rush — Guitar Hero style falling notes
// =========================================================
// 4 lanes. Notes fall from top. Player hits the matching key
// (D, F, J, K) when the note crosses the hit zone. Timing
// determines points: perfect > good > miss.
//
// One round = TARGET_NOTES notes spawned. Round ends as soon as
// the last note is resolved (hit or missed past the zone) so the
// stage doesn't drag past its intended length.

export function mountRhythmRush(container, opts) {
  const LANES = 4;
  const KEYS = ["d", "f", "j", "k"];
  const LANE_W = 60;
  const HIT_Y = 240;
  const NOTE_SPEED = 280;     // px per second — was 180, felt sluggish
  const SPAWN_INTERVAL = 380; // ms between notes — was 600
  const TARGET_NOTES = 14;    // round ends after this many notes
  const PERFECT_WINDOW = 28;
  const GOOD_WINDOW = 56;
  const MAX_MS = Math.max(8000, Math.min(15000, opts.maxMs || 12000));

  let score = 0;
  let totalNotes = 0;
  let hits = 0;
  let running = true;
  let notes = [];
  let spawned = 0;
  let lastSpawn = 0;
  let startedAt = performance.now();
  let lastFrame = startedAt;
  let animFrame = null;
  let finished = false;

  container.innerHTML = `
    <canvas class="minigame-canvas" width="${LANES * LANE_W}" height="280"></canvas>
    <div class="rhythm-keys">${KEYS.map((k, i) => `<span class="rhythm-key" data-lane="${i}">${k.toUpperCase()}</span>`).join("")}</div>
  `;
  const canvas = container.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  function spawnNote() {
    if (spawned >= TARGET_NOTES) return;
    const lane = Math.floor(Math.random() * LANES);
    notes.push({ lane, y: -20, hit: false, missed: false });
    spawned++;
    totalNotes++;
  }

  function handleKey(e) {
    if (!running) return;
    const idx = KEYS.indexOf(e.key.toLowerCase());
    if (idx === -1) return;
    e.preventDefault();
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
      opts.onScore(spawned > 0 ? score / spawned : 0);
    }
    const el = container.querySelector(`[data-lane="${idx}"]`);
    if (el) { el.classList.add("active"); setTimeout(() => el.classList.remove("active"), 100); }
  }

  function endRound() {
    if (finished) return;
    finished = true;
    running = false;
    const final = totalNotes > 0 ? score / totalNotes : 0;
    if (opts.onFinish) opts.onFinish(final);
  }

  function loop(ts) {
    if (!running) return;
    const dt = ts - lastFrame;
    lastFrame = ts;
    const elapsed = ts - startedAt;

    // Spawn cadence
    if (spawned < TARGET_NOTES && ts - lastSpawn > SPAWN_INTERVAL) {
      spawnNote();
      lastSpawn = ts;
    }

    // Move notes
    for (const n of notes) {
      if (n.hit || n.missed) continue;
      n.y += NOTE_SPEED * (dt / 1000);
      if (n.y > HIT_Y + GOOD_WINDOW + 20) n.missed = true;
    }

    // Prune
    notes = notes.filter((n) => n.y < 320);

    // End conditions: all notes resolved, or hard time cap.
    const allResolved = spawned >= TARGET_NOTES && notes.every((n) => n.hit || n.missed);
    if (allResolved || elapsed > MAX_MS) {
      drawFrame();
      endRound();
      return;
    }

    drawFrame();
    animFrame = requestAnimationFrame(loop);
  }

  function drawFrame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < LANES; i++) {
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(i * LANE_W, 0, LANE_W - 2, canvas.height);
    }
    ctx.fillStyle = "rgba(92,255,154,0.15)";
    ctx.fillRect(0, HIT_Y - GOOD_WINDOW, canvas.width, GOOD_WINDOW * 2);
    ctx.strokeStyle = opts.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, HIT_Y); ctx.lineTo(canvas.width, HIT_Y);
    ctx.stroke();
    for (const n of notes) {
      if (n.hit) continue;
      ctx.fillStyle = n.missed ? "#ff4a6e" : opts.color;
      ctx.beginPath();
      ctx.arc(n.lane * LANE_W + LANE_W / 2, n.y, 12, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  document.addEventListener("keydown", handleKey);
  animFrame = requestAnimationFrame(loop);

  return {
    getScore() { return totalNotes > 0 ? score / totalNotes : 0; },
    destroy() {
      running = false;
      finished = true;
      cancelAnimationFrame(animFrame);
      document.removeEventListener("keydown", handleKey);
    },
  };
}
