// =========================================================
// Wallet Picker Modal
// =========================================================
// Shows wallets discovered through the Solana Wallet Standard. If
// none are detected, shows install links for the most popular ones.

import { getDetectedWallets, SUGGESTED_INSTALLS } from "./wallets.js";

let openOverlay = null;

export function pickWallet() {
  return new Promise((resolve) => {
    if (openOverlay) {
      openOverlay.remove();
      openOverlay = null;
    }
    let detected = getDetectedWallets();

    // If exactly one wallet is detected, skip the picker and use it directly.
    if (detected.length === 1) {
      resolve(detected[0]);
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "wallet-picker-overlay";
    document.body.appendChild(overlay);
    openOverlay = overlay;

    function render() {
      detected = getDetectedWallets();
      overlay.innerHTML = `
        <div class="wallet-picker-modal" role="dialog" aria-labelledby="wpTitle">
          <header class="wallet-picker-head">
            <h3 id="wpTitle">Connect a wallet</h3>
            <button class="wallet-picker-close" type="button" aria-label="Close">×</button>
          </header>
          ${detected.length > 0 ? `
            <div class="wallet-picker-section">
              <small>DETECTED</small>
              <div class="wallet-picker-list" data-detected></div>
            </div>` : `
            <div class="wallet-picker-empty">
              No Solana wallet detected.<br>
              Install one of these and refresh:
            </div>
          `}
          ${detected.length === 0 ? `
            <div class="wallet-picker-section">
              <div class="wallet-picker-list" data-installs></div>
            </div>` : ""}
        </div>
      `;
      overlay.querySelector(".wallet-picker-close").addEventListener("click", cancel);

      const detList = overlay.querySelector("[data-detected]");
      if (detList) {
        for (const w of detected) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "wallet-picker-row";
          row.innerHTML = `
            <span class="wallet-picker-icon">${
              w.icon ? `<img alt="" src="${w.icon}" />` : escapeHtml(w.name[0] || "?")
            }</span>
            <span class="wallet-picker-name">${escapeHtml(w.name)}</span>
            <span class="wallet-picker-tag">Connect</span>
          `;
          row.addEventListener("click", () => {
            cleanup();
            resolve(w);
          });
          detList.appendChild(row);
        }
      }

      const installList = overlay.querySelector("[data-installs]");
      if (installList) {
        for (const s of SUGGESTED_INSTALLS) {
          const row = document.createElement("button");
          row.type = "button";
          row.className = "wallet-picker-row install";
          row.innerHTML = `
            <span class="wallet-picker-icon">${escapeHtml(s.name[0])}</span>
            <span class="wallet-picker-name">${escapeHtml(s.name)}</span>
            <span class="wallet-picker-tag">Install →</span>
          `;
          row.addEventListener("click", () => {
            window.open(s.url, "_blank", "noopener");
          });
          installList.appendChild(row);
        }
      }
    }

    function cancel() { cleanup(); resolve(null); }
    function cleanup() {
      window.removeEventListener("trenchlets:wallets-changed", render);
      overlay.remove();
      openOverlay = null;
    }
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cancel(); });
    window.addEventListener("trenchlets:wallets-changed", render);
    render();
  });
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}
