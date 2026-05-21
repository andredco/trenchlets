// =========================================================
// Stack Tower — precision stacking
// =========================================================
// A block slides left-right. Press SPACE or click to drop it.
// If it overlaps the previous block, the overlap becomes the
// new platform. Miss = game over. Score = layers / max layers.

export function mountStackTower(container, opts) {
  const MAX_LAYERS = 15;
  const CANVAS_W = 240;
  const CANVAS_H = 300;
  const BLOCK_H = 16;
  const START_W = 80;
  const BASE_SPEED = 120; // px/s, increases per layer

  let layers = [];
  let currentBlock = null;
  let running = true;
  let animFrame = null;
  let lastTs = 0;

  container.innerHTML = `<canvas class="minigame-canvas" width="${CANVAS_W}" height="${CANVAS_H}"></canvas><p class="stack-hint">SPACE or CLICK to drop</p>`;
  const canvas = container.querySelector("canvas");
  const ctx = canvas.getContext("2d");

  // Base platform
  layers.push({ x: (CANVAS_W - START_W) / 2, w: START_W });
  spawnBlock();

  function spawnBlock() {
    if (layers.length > MAX_LAYERS) { finish(); return; }
    const prev = layers[layers.length - 1];
    const speed = BASE_SPEED + layers.length * 12;
    currentBlock = {
      x: 0,
      w: prev.w,
      dir: 1,
      speed,
    };
  }

  function drop() {
    if (!running || !currentBlock) return;
    const prev = layers[layers.length - 1];
    const overlapStart = Math.max(currentBlock.x, prev.x);
    const overlapEnd = Math.min(currentBlock.x + currentBlock.w, prev.x + prev.w);
    const overlapW = overlapEnd - overlapStart;
    if (overlapW <= 0) {
      // Miss — game over
      finish();
      return;
    }
    layers.push({ x: overlapStart, w: overlapW });
    opts.onScore(layers.length / MAX_LAYERS);
    currentBlock = null;
    setTimeout(() => { if (running) spawnBlock(); }, 200);
  }

  function finish() {
    running = false;
    const s = Math.min(1, (layers.length - 1) / MAX_LAYERS);
    opts.onFinish(s);
  }

  function loop(ts) {
    if (!running) return;
    const dt = lastTs ? (ts - lastTs) / 1000 : 0.016;
    lastTs = ts;
    // Move current block
    if (currentBlock) {
      currentBlock.x += currentBlock.dir * currentBlock.speed * dt;
      if (currentBlock.x + currentBlock.w > CANVAS_W) { currentBlock.dir = -1; }
      if (currentBlock.x < 0) { currentBlock.dir = 1; }
    }
    // Draw
    ctx.fillStyle = "#0a0a14";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    // Draw layers from bottom up
    for (let i = 0; i < layers.length; i++) {
      const l = layers[i];
      const y = CANVAS_H - (i + 1) * BLOCK_H;
      const hue = (i * 25) % 360;
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.fillRect(l.x, y, l.w, BLOCK_H - 1);
    }
    // Draw current block
    if (currentBlock) {
      const y = CANVAS_H - (layers.length + 1) * BLOCK_H;
      ctx.fillStyle = opts.color;
      ctx.fillRect(currentBlock.x, y, currentBlock.w, BLOCK_H - 1);
    }
    animFrame = requestAnimationFrame(loop);
  }

  function handleInput(e) {
    if (e.type === "keydown" && e.code === "Space") { e.preventDefault(); drop(); }
    if (e.type === "click") drop();
  }

  document.addEventListener("keydown", handleInput);
  canvas.addEventListener("click", handleInput);
  animFrame = requestAnimationFrame(loop);

  return {
    getScore() { return Math.min(1, (layers.length - 1) / MAX_LAYERS); },
    destroy() {
      running = false;
      cancelAnimationFrame(animFrame);
      document.removeEventListener("keydown", handleInput);
    },
  };
}
