// =========================================================
// Price feed via DexScreener public API
// =========================================================
// Polls DexScreener every 30 seconds for the 10 launch tokens
// plus $BOBLETS once it launches. Caches result in memory and
// broadcasts updates to all WS clients.
//
// Endpoint: https://api.dexscreener.com/latest/dex/tokens/{mints}
// Multiple mints can be batched comma-separated. Free, no key.

const POLL_INTERVAL_MS = 30 * 1000;
const STALE_AFTER_MS = 5 * 60 * 1000;

let listeners = [];
let prices = new Map(); // mint -> { priceUsd, marketCap, volume24h, fetchedAt }

export function subscribe(cb) {
  listeners.push(cb);
  // Send current snapshot
  cb(getSnapshot());
  return () => { listeners = listeners.filter((l) => l !== cb); };
}

export function getSnapshot() {
  const out = {};
  for (const [mint, data] of prices) {
    if (Date.now() - data.fetchedAt > STALE_AFTER_MS) continue;
    out[mint] = {
      priceUsd: data.priceUsd,
      marketCap: data.marketCap,
      volume24h: data.volume24h,
    };
  }
  return out;
}

export function startPriceFeed(mints) {
  if (!Array.isArray(mints) || mints.length === 0) {
    console.warn("price feed started with no mints");
    return;
  }
  const cleanMints = mints.filter((m) => m && !m.includes("placeholder"));
  if (cleanMints.length === 0) {
    console.log("price feed: no real mints yet (all placeholders)");
    return;
  }
  pollOnce(cleanMints);
  setInterval(() => pollOnce(cleanMints), POLL_INTERVAL_MS);
}

async function pollOnce(mints) {
  // DexScreener accepts up to 30 comma-separated mints per call.
  const chunks = [];
  for (let i = 0; i < mints.length; i += 30) chunks.push(mints.slice(i, i + 30));
  for (const chunk of chunks) {
    try {
      const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`;
      const r = await fetch(url, { headers: { Accept: "application/json" } });
      if (!r.ok) {
        console.warn("dexscreener", r.status);
        continue;
      }
      const data = await r.json();
      const pairs = data?.pairs || [];
      for (const mint of chunk) {
        // Pick the highest-liquidity pair for this mint.
        const candidates = pairs.filter(
          (p) => p.baseToken?.address === mint || p.quoteToken?.address === mint,
        );
        if (candidates.length === 0) continue;
        candidates.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const top = candidates[0];
        const isBase = top.baseToken?.address === mint;
        prices.set(mint, {
          priceUsd: Number(top.priceUsd) || 0,
          marketCap: top.fdv || top.marketCap || 0,
          volume24h: top.volume?.h24 || 0,
          fetchedAt: Date.now(),
        });
        void isBase;
      }
    } catch (err) {
      console.warn("price poll failed:", err.message);
    }
  }
  const snap = getSnapshot();
  for (const cb of listeners) {
    try { cb(snap); } catch {}
  }
}
