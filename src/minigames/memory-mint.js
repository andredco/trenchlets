// =========================================================
// Memory Mint — Simon-says pattern recall
// =========================================================
// 4 colored pads flash a sequence. Player repeats it. Each
// round adds one step. Score = rounds completed / max rounds.

export function mountMemoryMint(container, opts) {
  const PADS = 4;
  const COLORS = ["#5cff9a", "#4ff7ff", "#ffd84a", "#ff4a6e"];
  const MAX_ROUNDS = 12;
  const FLASH_MS = 400;
  const GAP_MS = 200;

  let sequence = [];
  let playerIdx = 0;
  let round = 0;
  let showing = false;
  let running = true;

  container.innerHTML = `
    <div class="memory-grid">
      ${COLORS.map((c, i) => `<button class="memory-pad" data-idx="${i}" style="--pad-color:${c}"></button>`).join("")}
    </div>
    <p class="memory-status">Watch...</p>
  `;
  const pads = container.querySelectorAll(".memory-pad");
  const status = container.querySelector(".memory-status");

  function flashPad(idx) {
    pads[idx].classList.add("flash");
    setTimeout(() => pads[idx].classList.remove("flash"), FLASH_MS - 50);
  }

  function showSequence() {
    showing = true;
    status.textContent = "Watch...";
    let i = 0;
    const iv = setInterval(() => {
      if (!running) { clearInterval(iv); return; }
      if (i >= sequence.length) { clearInterval(iv); showing = false; status.textContent = "Your turn!"; return; }
      flashPad(sequence[i]);
      i++;
    }, FLASH_MS + GAP_MS);
  }

  function nextRound() {
    round++;
    sequence.push(Math.floor(Math.random() * PADS));
    playerIdx = 0;
    opts.onScore(round / MAX_ROUNDS);
    if (round > MAX_ROUNDS) { opts.onFinish(1); return; }
    setTimeout(() => showSequence(), 600);
  }

  function handleClick(e) {
    if (!running || showing) return;
    const idx = Number(e.currentTarget.dataset.idx);
    flashPad(idx);
    if (idx === sequence[playerIdx]) {
      playerIdx++;
      if (playerIdx >= sequence.length) nextRound();
    } else {
      // Wrong — game over
      status.textContent = `Round ${round} — wrong!`;
      opts.onFinish(round / MAX_ROUNDS);
    }
  }

  pads.forEach((p) => p.addEventListener("click", handleClick));
  // Also support keyboard 1-4
  function handleKey(e) {
    const n = parseInt(e.key);
    if (n >= 1 && n <= 4) { pads[n - 1].click(); e.preventDefault(); }
  }
  document.addEventListener("keydown", handleKey);

  nextRound();

  return {
    getScore() { return round / MAX_ROUNDS; },
    destroy() {
      running = false;
      document.removeEventListener("keydown", handleKey);
    },
  };
}
