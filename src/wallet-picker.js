// =========================================================
// Wallet Picker Modal
// =========================================================

import { getDetectedWallets } from "./wallets.js";

let openOverlay = null;

export function pickWallet() {
  return new Promise((resolve) => {
    if (openOverlay) {
      openOverlay.remove();
      openOverlay = null;
    }
    const all = getDetectedWallets();
    const installed = all.filter((w) => w.installed);
    const others = all.filter((w) => !w.installed);

    // Auto-pick if exactly one installed.
    if (installed.length === 1) {
      resolve(installed[0]);
      return;
    }

    const overlay = document.createElement("div");
    overlay.className = "wallet-picker-overlay";
    overlay.innerHTML = `
      <div class="wallet-picker-modal" role="dialog" aria-labelledby="wpTitle">
        <header class="wallet-picker-head">
          <h3 id="wpTitle">Connect a wallet</h3>
          <button class="wallet-picker-close" type="button" aria-label="Close">×</button>
        </header>
        ${installed.length > 0 ? `
          <div class="wallet-picker-section">
            <small>DETECTED</small>
            <div class="wallet-picker-list" data-installed></div>
          </div>` : `
          <div class="wallet-picker-empty">
            No Solana wallet detected. Install one to enter.
          </div>
        `}
        ${others.length > 0 ? `
          <div class="wallet-picker-section">
            <small>${installed.length > 0 ? "MORE OPTIONS" : "INSTALL A WALLET"}</small>
            <div class="wallet-picker-list" data-others></div>
          </div>` : ""}
      </div>
    `;
    document.body.appendChild(overlay);
    openOverlay = overlay;

    function row(w, isInstall) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "wallet-picker-row" + (isInstall ? " install" : "");
      btn.innerHTML = `
        <span class="wallet-picker-icon">${
          w.icon
            ? `<img alt="" src="${esc(w.icon)}" />`
            : esc((w.name || "?")[0])
        }</span>
        <span class="wallet-picker-name">${esc(w.name)}</span>
        <span class="wallet-picker-tag">${isInstall ? "Install →" : "Connect"}</span>
      `;
      btn.addEventListener("click", () => {
        if (isInstall) {
          window.open(w.url, "_blank", "noopener");
          return;
        }
        cleanup();
        resolve(w);
      });
      return btn;
    }

    const installedList = overlay.querySelector("[data-installed]");
    if (installedList) for (const w of installed) installedList.appendChild(row(w, false));
    const othersList = overlay.querySelector("[data-others]");
    if (othersList) for (const w of others) othersList.appendChild(row(w, true));

    overlay.querySelector(".wallet-picker-close").addEventListener("click", cancel);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) cancel(); });

    function cancel() { cleanup(); resolve(null); }
    function cleanup() { overlay.remove(); openOverlay = null; }
  });
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = String(s ?? "");
  return d.innerHTML;
}
