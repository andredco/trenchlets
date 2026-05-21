// =========================================================
// Quick Tap — reaction speed test
// =========================================================
// A target appears at random positions. Tap/click it as fast
// as you can. Score = successful taps / total spawns. Faster
// taps give bonus weight.

export function mountQuickTap(container, opts) {
  const TOTAL_TARGETS = 20;
  const SPAWN_DELAY_MIN = 400;
  const SPAWN_DELAY_MAX = 1200;
  const TARGET_LIFETIME = 1200; // ms before it disappears

  let spawned = 0;
  let hits = 0;
  let weightedScore = 0;
  let running = true;
  let timeout = null;

  container.innerHTML = `<div class="quicktap-area"></div>`;
  const area = container.querySelector(".quicktap-area");
  area.style.cssText = "position:relative;width:100%;height:260px;overflow:hidden;";

  function spawnTarget() {
    if (!running || spawned >= TOTAL_TARGETS) {
      finish();
      return;
    }
    spawned++;
    const x = 10 + Math.random() * 80; // %
    const y = 10 + Math.random() * 75;
    const el = document.createElement("button");
    el.className = "quicktap-target";
    el.style.cssText = `position:absolute;left:${x}%;top:${y}%;width:36px;height:36px;border-radius:50%;background:${opts.color};border:2px solid #fff;cursor:pointer;transition:transform 0.08s;`;
    area.appendChild(el);
    const spawnTime = Date.now();

    el.addEventListener("click", () => {
      if (!running) return;
      const reaction = Date.now() - spawnTime;
      hits++;
      // Faster = more weight (max 1.0 at 0ms, min 0.4 at TARGET_LIFETIME)
      const speed = 1 - (reaction / TARGET_LIFETIME) * 0.6;
      weightedScore += Math.max(0.4, speed);
      el.style.transform = "scale(0)";
      setTimeout(() => el.remove(), 100);
      opts.onScore(weightedScore / TOTAL_TARGETS);
      scheduleNext();
    });

    // Auto-remove after lifetime
    timeout = setTimeout(() => {
      if (!el.parentNode) return;
      el.remove();
      scheduleNext();
    }, TARGET_LIFETIME);
  }

  function scheduleNext() {
    if (!running) return;
    const delay = SPAWN_DELAY_MIN + Math.random() * (SPAWN_DELAY_MAX - SPAWN_DELAY_MIN);
    timeout = setTimeout(spawnTarget, delay);
  }

  function finish() {
    running = false;
    const final = TOTAL_TARGETS > 0 ? weightedScore / TOTAL_TARGETS : 0;
    opts.onFinish(Math.min(1, final));
  }

  spawnTarget();

  return {
    getScore() { return TOTAL_TARGETS > 0 ? weightedScore / TOTAL_TARGETS : 0; },
    destroy() {
      running = false;
      clearTimeout(timeout);
    },
  };
}
