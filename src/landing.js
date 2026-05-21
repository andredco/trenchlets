// =========================================================
// Trenchlets · landing + docs
// =========================================================
// Fetches /api/config from the server so values like TRENCHLETS_MINT
// and the vault address come straight from Railway env vars. Set them
// ONCE in Railway, no code changes needed at launch.

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

// ---- Live config from server (mint + vault address) ----
// Pull once on load. If the request fails (offline, server down), fall
// back to whatever's compiled into data.js — which during development is
// the placeholder values, in production gets overridden anyway.
async function loadConfig() {
  try {
    const r = await fetch("/api/config", { headers: { Accept: "application/json" } });
    if (!r.ok) throw new Error(`config ${r.status}`);
    return await r.json();
  } catch (err) {
    console.warn("config fetch failed; using compiled defaults:", err);
    return {
      trenchletsMint: VAULT_CONFIG.trenchletsMint || "",
      vaultAddress: VAULT_CONFIG.address || "",
    };
  }
}

loadConfig().then((cfg) => {
  // ---- Vault address (landing + docs) ----
  for (const id of ["vaultAddress", "docsVaultAddress"]) {
    const elById = document.querySelector(`#${id}`);
    if (elById) elById.textContent = cfg.vaultAddress || "Address pending launch";
  }

  // ---- Token status banner ----
  // Shows "Not live yet" until the server returns a real mint address
  // (which happens the moment TRENCHLETS_MINT is set in Railway env).
  const tokenStatusBox = document.querySelector("#tokenStatus");
  const tokenStatusValue = document.querySelector("#tokenStatusValue");
  if (tokenStatusBox && tokenStatusValue) {
    const mint = cfg.trenchletsMint;
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
});

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
    `<span class="lp-ticker-tag">3H EPOCH</span>`,
    `<span class="lp-ticker-tag">50% DISTRIBUTION</span>`,
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
