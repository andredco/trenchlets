// =========================================================
// Pattern Match — memory card pairs
// =========================================================
// Grid of face-down cards with symbols. Flip two at a time.
// Match all pairs before time runs out. Score = pairs found /
// total pairs, weighted by speed.

export function mountPatternMatch(container, opts) {
  const GRID_COLS = 4;
  const GRID_ROWS = 3;
  const TOTAL_PAIRS = (GRID_COLS * GRID_ROWS) / 2;
  const SYMBOLS = ["★", "♦", "♠", "♣", "♥", "◆"];

  let cards = [];
  let flipped = [];
  let matched = 0;
  let running = true;
  let lockBoard = false;

  // Build shuffled card array
  const pool = SYMBOLS.slice(0, TOTAL_PAIRS);
  const deck = [...pool, ...pool];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  container.innerHTML = `<div class="pattern-grid" style="display:grid;grid-template-columns:repeat(${GRID_COLS},1fr);gap:6px;max-width:280px;margin:0 auto;"></div>`;
  const grid = container.querySelector(".pattern-grid");

  deck.forEach((sym, i) => {
    const card = document.createElement("button");
    card.className = "pattern-card";
    card.dataset.idx = i;
    card.dataset.sym = sym;
    card.textContent = "?";
    card.style.cssText = "width:56px;height:64px;font-size:1.4rem;border-radius:6px;border:2px solid rgba(255,255,255,0.2);background:#1a1a2e;color:#fff;cursor:pointer;transition:background 0.15s;";
    card.addEventListener("click", () => flipCard(card));
    grid.appendChild(card);
    cards.push(card);
  });

  function flipCard(card) {
    if (!running || lockBoard) return;
    if (card.classList.contains("matched") || flipped.includes(card)) return;
    card.textContent = card.dataset.sym;
    card.style.background = opts.color;
    flipped.push(card);
    if (flipped.length === 2) checkMatch();
  }

  function checkMatch() {
    lockBoard = true;
    const [a, b] = flipped;
    if (a.dataset.sym === b.dataset.sym) {
      a.classList.add("matched");
      b.classList.add("matched");
      matched++;
      opts.onScore(matched / TOTAL_PAIRS);
      flipped = [];
      lockBoard = false;
      if (matched >= TOTAL_PAIRS) {
        opts.onFinish(1);
      }
    } else {
      setTimeout(() => {
        a.textContent = "?";
        a.style.background = "#1a1a2e";
        b.textContent = "?";
        b.style.background = "#1a1a2e";
        flipped = [];
        lockBoard = false;
      }, 600);
    }
  }

  return {
    getScore() { return matched / TOTAL_PAIRS; },
    destroy() { running = false; },
  };
}
