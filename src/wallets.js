// =========================================================
// Boblets · Solana wallet adapters (official packages)
// =========================================================
// Uses @solana/wallet-adapter-* directly. Each adapter speaks the
// same Adapter interface defined in @solana/wallet-adapter-base, so
// the rest of the app talks to one shape regardless of wallet.

import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { BackpackWalletAdapter } from "@solana/wallet-adapter-backpack";
import { WalletReadyState } from "@solana/wallet-adapter-base";

// Build adapter instances once and cache them.
let adapters = null;
function getAdapters() {
  if (adapters) return adapters;
  adapters = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
    new BackpackWalletAdapter(),
  ];
  return adapters;
}

// =========================================================
// Discovery
// =========================================================
// Returns adapters split into installed (ready to connect) vs not
// installed (we show install link for these).
export function getDetectedWallets() {
  const all = getAdapters();
  return all.map((a) => ({
    name: a.name,
    icon: a.icon,
    url: a.url,
    readyState: a.readyState,
    adapter: a,
    installed:
      a.readyState === WalletReadyState.Installed ||
      a.readyState === WalletReadyState.Loadable,
  }));
}

// Returns ONLY installed wallets ready to use right now.
export function getInstalledWallets() {
  return getDetectedWallets().filter((w) => w.installed);
}
