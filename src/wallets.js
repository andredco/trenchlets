// =========================================================
// Trenchlets · Solana wallet detection
// =========================================================
// Detects all major Solana wallets injected on the page and
// returns a unified provider interface. Each wallet exposes
// connect() / signMessage() with the same shape, so we just
// pick whichever the user wants.

const WALLETS = [
  {
    id: "phantom",
    name: "Phantom",
    icon: "https://phantom.app/img/phantom-icon-purple.png",
    install: "https://phantom.app/download",
    detect: () => window.phantom?.solana || (window.solana?.isPhantom && window.solana),
  },
  {
    id: "solflare",
    name: "Solflare",
    icon: "https://solflare.com/assets/icon.png",
    install: "https://solflare.com/download",
    detect: () => window.solflare?.isSolflare && window.solflare,
  },
  {
    id: "backpack",
    name: "Backpack",
    icon: "https://www.backpack.app/_next/static/media/backpack.7afb5269.svg",
    install: "https://backpack.app/download",
    detect: () => window.backpack?.isBackpack && window.backpack,
  },
  {
    id: "glow",
    name: "Glow",
    icon: "https://glow.app/img/glow-icon.png",
    install: "https://glow.app/download",
    detect: () => window.glowSolana || window.glow?.solana,
  },
  {
    id: "coin98",
    name: "Coin98",
    icon: "https://coin98.com/static/media/coin98.f57e6cda.svg",
    install: "https://coin98.com/wallet",
    detect: () => window.coin98?.sol,
  },
  {
    id: "nightly",
    name: "Nightly",
    icon: "https://nightly.app/icon.png",
    install: "https://nightly.app/download",
    detect: () => window.nightly?.solana,
  },
];

export function listAvailableWallets() {
  return WALLETS.map((w) => ({
    ...w,
    provider: w.detect(),
    available: !!w.detect(),
  }));
}

export function getWalletList() {
  return WALLETS;
}
