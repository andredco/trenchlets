// =========================================================
// Trenchlets · landing + docs
// =========================================================

import { COMMUNITIES, VAULT_CONFIG } from "./data.js";

// ---- House grid ----
const grid = document.querySelector("#houseGrid");
if (grid) {
  for (const house of COMMUNITIES) {
    const node = document.createElement("a");
    node.className = "lp-house";
    node.href = house.dex || "#";
    node.target = "_blank";
    node.rel = "noopener";
    node.style.setProperty("--house-color", house.color);
    node.innerHTML = `
      <div class="lp-house-ticker" style="color:${esc(house.color)}">${esc(house.ticker)}</div>
      <div class="lp-house-name">${esc(house.name)}</div>
      <div class="lp-house-tagline">${esc(house.tagline)}</div>
      <div class="lp-house-link">View on DEX →</div>
    `;
    grid.append(node);
  }
}

// ---- Vault address ----
for (const id of ["vaultAddress", "docsVaultAddress"]) {
  const el = document.querySelector(`#${id}`);
  if (el) el.textContent = VAULT_CONFIG.address || "Address pending launch";
}

// ---- Token status ----
// Shows "Not live yet" by default, flips to the contract address (with
// click-to-copy) the moment TRENCHLETS_MINT is set in src/data.js.
const tokenStatusBox = document.querySelector("#tokenStatus");
const tokenStatusValue = document.querySelector("#tokenStatusValue");
if (tokenStatusBox && tokenStatusValue) {
  const mint = VAULT_CONFIG.trenchletsMint;
  if (mint && mint.length > 20) {
    tokenStatusBox.dataset.state = "live";
    tokenStatusValue.textContent = mint;
    tokenStatusValue.style.cursor = "pointer";
    tokenStatusValue.title = "Click to copy";
    tokenStatusValue.addEventListener("click", () => {
      navigator.clipboard?.writeText(mint).then(
        () => {
          const original = tokenStatusValue.textContent;
          tokenStatusValue.textContent = "Copied!";
          setTimeout(() => (tokenStatusValue.textContent = original), 1200);
        },
        () => {},
      );
    });
  }
}

// ---- Ticker marquee ----
const tickerTrack = document.querySelector("#tickerTrack");
if (tickerTrack) {
  const items = COMMUNITIES.map(
    (c) =>
      `<span class="lp-ticker-item" style="color:${esc(c.color)}"><span class="lp-ticker-dot" style="background:${esc(c.color)}"></span>${esc(c.ticker)}</span>`,
  );
  // Tags interspersed between tickers
  const tags = [
    `<span class="lp-ticker-tag">LIVE</span>`,
    `<span class="lp-ticker-tag">6H EPOCH</span>`,
    `<span class="lp-ticker-tag">15% DISTRIBUTION</span>`,
    `<span class="lp-ticker-tag">SKILL-BASED</span>`,
    `<span class="lp-ticker-tag">10 HOUSES</span>`,
    `<span class="lp-ticker-tag">SOLANA</span>`,
  ];
  // Build sequence: ticker, tag, ticker, tag, ...
  const sequence = [];
  let tagIdx = 0;
  for (const item of items) {
    sequence.push(item);
    sequence.push(tags[tagIdx % tags.length]);
    tagIdx++;
  }
  // Duplicate the sequence so the marquee can loop seamlessly via translateX(-50%)
  const html = sequence.join("") + sequence.join("");
  tickerTrack.innerHTML = html;
}

// ---- Scroll reveal ----
const reveals = document.querySelectorAll(".lp-reveal");
if (reveals.length && "IntersectionObserver" in window) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          io.unobserve(entry.target);
        }
      }
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" },
  );
  for (const el of reveals) io.observe(el);
} else {
  // Fallback — show everything immediately
  for (const el of reveals) el.classList.add("is-visible");
}

// ---- Live world preview (lazy-loaded) ----
const previewCanvas = document.querySelector("#worldPreviewCanvas");
const previewLoading = document.querySelector("#worldPreviewLoading");
if (previewCanvas) {
  const start = () => {
    import("./preview.js")
      .then((mod) => {
        mod.mountWorldPreview(previewCanvas);
        if (previewLoading) previewLoading.style.opacity = "0";
        setTimeout(() => previewLoading?.remove(), 400);
      })
      .catch((err) => {
        console.warn("World preview failed to load", err);
        if (previewLoading) previewLoading.querySelector("span").textContent = "Preview unavailable";
      });
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(start, { timeout: 800 });
  } else {
    setTimeout(start, 400);
  }
}

function esc(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
