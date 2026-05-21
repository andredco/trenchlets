// =========================================================
// Trenchlets · Solana Wallet Standard discovery
// =========================================================
// The Solana Wallet Standard is the official cross-wallet protocol.
// Phantom, Solflare, Backpack, Glow, Coin98, Nightly, OKX, Trust, etc.
// all expose themselves through it. We discover wallets by dispatching
// `wallet-standard:app-ready` and listening for `wallet-standard:register`
// events that wallets respond with. Each registered wallet provides a
// uniform interface for connect, disconnect, signMessage, etc.
//
// Reference: https://github.com/wallet-standard/wallet-standard
//
// We keep a local mirror of registered wallets and a tiny adapter that
// maps the standard's feature names to the legacy {connect, signMessage}
// shape our app expects.

const SOLANA_FEATURE_CONNECT = "standard:connect";
const SOLANA_FEATURE_DISCONNECT = "standard:disconnect";
const SOLANA_FEATURE_SIGN_MESSAGE = "solana:signMessage";
const SOLANA_CHAIN = "solana:mainnet";

const wallets = []; // [{ name, icon, accounts, features, raw }]

if (typeof window !== "undefined") {
  // Listen for wallets registering themselves.
  window.addEventListener("wallet-standard:register-wallet", (e) => {
    e.detail((api) => registerWallet(api));
  });

  // Tell already-loaded wallets we're ready to receive their registration.
  // (The event-driven flow handles ones loaded later automatically.)
  window.dispatchEvent(
    new CustomEvent("wallet-standard:app-ready", {
      detail: ((api) => registerWallet(api)),
    }),
  );

  // Also include any wallets that registered before our listener attached
  // by reading the navigator.wallets registry if present.
  const navWallets = (typeof navigator !== "undefined" && navigator.wallets) || null;
  if (navWallets && typeof navWallets.get === "function") {
    try { for (const w of navWallets.get()) registerWallet(w); } catch {}
  }
}

function registerWallet(walletInfo) {
  if (!walletInfo || typeof walletInfo !== "object") return;
  // Avoid duplicates by name+chain
  const existing = wallets.find((w) => w.raw === walletInfo || w.name === walletInfo.name);
  if (existing) return;
  // Confirm it supports Solana mainnet.
  const chains = walletInfo.chains || [];
  const supportsSolana = chains.some((c) => typeof c === "string" && c.startsWith("solana:"));
  if (!supportsSolana) return;
  wallets.push({
    name: walletInfo.name,
    icon: walletInfo.icon, // typically a data:image URL
    raw: walletInfo,
  });
  // Notify listeners (so the picker can refresh if open).
  window.dispatchEvent(new CustomEvent("trenchlets:wallets-changed"));
}

// Legacy fallback detection — for wallets that DON'T implement Wallet Standard.
// Right now (2026), Phantom and Solflare both implement it. But older versions
// or niche wallets may still only inject window.<name>. We map those manually
// as a safety net so users on older extensions still work.
function legacyDetect() {
  const list = [];
  const phantom = window.phantom?.solana || (window.solana?.isPhantom && window.solana);
  if (phantom && !wallets.find((w) => /phantom/i.test(w.name))) {
    list.push({ name: "Phantom", icon: null, legacy: phantom, raw: null });
  }
  const solflare = window.solflare?.isSolflare && window.solflare;
  if (solflare && !wallets.find((w) => /solflare/i.test(w.name))) {
    list.push({ name: "Solflare", icon: null, legacy: solflare, raw: null });
  }
  const backpack = window.backpack?.isBackpack && window.backpack;
  if (backpack && !wallets.find((w) => /backpack/i.test(w.name))) {
    list.push({ name: "Backpack", icon: null, legacy: backpack, raw: null });
  }
  return list;
}

export function getDetectedWallets() {
  return [...wallets, ...legacyDetect()];
}

// Recommended install URLs for wallets a user might want when nothing is detected.
export const SUGGESTED_INSTALLS = [
  { name: "Phantom",  url: "https://phantom.app/download" },
  { name: "Solflare", url: "https://solflare.com/download" },
  { name: "Backpack", url: "https://backpack.app/downloads" },
];

// =========================================================
// Adapter — connect / signMessage in a uniform shape.
// =========================================================
// Returns { connect(), signMessage(bytes), disconnect() } regardless of
// whether the underlying wallet is Wallet Standard or legacy injected.

export async function adapter(walletEntry) {
  // Wallet Standard path
  if (walletEntry.raw) {
    const features = walletEntry.raw.features || {};
    const connectFeat = features[SOLANA_FEATURE_CONNECT];
    const signFeat = features[SOLANA_FEATURE_SIGN_MESSAGE];
    if (!connectFeat?.connect) throw new Error("wallet missing connect");
    if (!signFeat?.signMessage) throw new Error("wallet missing signMessage");
    return {
      connect: async () => {
        const res = await connectFeat.connect();
        const account = res?.accounts?.[0] || walletEntry.raw.accounts?.[0];
        if (!account) throw new Error("no account returned");
        const pubkey = account.address; // base58 string in Wallet Standard
        return pubkey;
      },
      signMessage: async (messageBytes) => {
        const account = walletEntry.raw.accounts?.[0];
        if (!account) throw new Error("not connected");
        const res = await signFeat.signMessage({ account, message: messageBytes });
        const first = Array.isArray(res) ? res[0] : res;
        const sig = first?.signature || first;
        return sig instanceof Uint8Array ? sig : new Uint8Array(sig);
      },
      disconnect: async () => {
        const dc = features[SOLANA_FEATURE_DISCONNECT];
        if (dc?.disconnect) await dc.disconnect();
      },
    };
  }
  // Legacy path
  const provider = walletEntry.legacy;
  return {
    connect: async () => {
      const resp = await provider.connect();
      const pk = resp?.publicKey || provider.publicKey;
      const str = pk?.toString?.() || pk;
      if (!str) throw new Error("no public key returned");
      return str;
    },
    signMessage: async (messageBytes) => {
      const signed = await provider.signMessage(messageBytes, "utf8");
      const sig = signed?.signature || signed;
      return sig instanceof Uint8Array ? sig : new Uint8Array(sig);
    },
    disconnect: async () => {
      try { await provider.disconnect(); } catch {}
    },
  };
}
