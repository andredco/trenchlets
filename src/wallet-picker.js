// =========================================================
// Wallet Picker Modal
// =========================================================
// Shows installed Solana wallets first, then "install" links for
// the rest. Returns the chosen provider, or null if cancelled.

import { listAvailableWallets } from "./wallets.js";

let openOverlay = null;

export function pickWallet() {
  return new Promise((resolve) => {
    if (openOverlay) {
      openOverlay.remove();
      openOverlay = null;
    }
    const wallets = listAvailableWallets();
    const installed = wallets.filter((w) => w.available);
    const others = wallets.filter((w) => !w.available);

    // If exactly one wallet is installed, skip the picker UI and use it directly.
    if (installed.length === 1) {
      resolve({ wallet: installed[0], provider: installed[0].provider });
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
            No Solana wallet detected. Install one to enter Trenchlets.
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

    function buildRow(w, isInstall) {
      const row = document.createElement("button");
      row.type = "button";
      row.className = "wallet-picker-row" + (isInstall ? " install" : "");
      row.innerHTML = `
        <span class="wallet-picker-icon">${
          // SVG fallback for icons that fail to load
          `<img alt="" src="${w.icon}" onerror="this.style.display='none';this.parentElement.textContent='${w.name[0]}'"/>`
        }</span>
        <span class="wallet-picker-name">${w.name}</span>
        <span class="wallet-picker-tag">${isInstall ? "Install →" : "Connect"}</span>
      `;
      row.addEventListener("click", () => {
        if (isInstall) {
          window.open(w.install, "_blank", "noopener");
          return;
        }
        cleanup();
        resolve({ wallet: w, provider: w.provider });
      });
      return row;
    }

    const installedList = overlay.querySelector("[data-installed]");
    if (installedList) for (const w of installed) installedList.appendChild(buildRow(w, false));
    const othersList = overlay.querySelector("[data-others]");
    if (othersList) for (const w of others) othersList.appendChild(buildRow(w, true));

    overlay.querySelector(".wallet-picker-close").addEventListener("click", () => {
      cleanup();
      resolve(null);
    });
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        cleanup();
        resolve(null);
      }
    });

    function cleanup() {
      overlay.remove();
      openOverlay = null;
    }
  });
}
