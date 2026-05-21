# Trenchlets Settler

Background service that runs every 6h. Reads accumulated house yield + carry yield, swaps SOL → community tokens via Jupiter, distributes to community members weighted by `contribution × tier_multiplier`. Resets house yield on success.

## Why a separate service?

It holds the vault keypair. The web service never sees it. If the web service is ever compromised, the vault is untouched.

## Economics (locked)

- **Release cap:** ≤40% of vault SOL drains per epoch
- **Protocol take:** 30% of the spend stays in vault
- **Buybacks:** 70% becomes community swaps
- **Per-swap slippage cap:** 5%
- **Distribution weight:** `Σ(player contribution %) × tier_multiplier`
- **Tier multipliers:** SHRIMP 1.0 / FISH 1.08 / DOLPHIN 1.18 / SHARK 1.3 / WHALE 1.5

## Carry yield

If the vault is empty when an epoch closes, every community's accumulated yield rolls into `carry_yield`. The next epoch with SOL adds carry to current yield before computing the spend pool.

## Deploying on Railway

1. Push this repo. In Railway, click **+ New Service → GitHub repo → trenchlets**.
2. Set the service **Root Directory** to `settler`.
3. Set environment variables (see `.env.example`):
   - `DATABASE_URL` → `${{Postgres.DATABASE_URL}}` (same Postgres as the web service)
   - `RPC_URL` → Helius RPC
   - `VAULT_KEYPAIR` → JSON array of 64 bytes
   - `DRY_RUN=true` (start in dry-run for the first few cycles)
4. Service has **no inbound routes**. Don't set a custom domain.
5. Deploy. Logs will show the first run scheduling.

## Operating

- Watch dry-run logs in Railway for the first 1–2 cycles. Confirm the math, the swap quotes look reasonable, the distribution weights make sense.
- When confident, set `DRY_RUN=false`. Service redeploys automatically.
- All actions are persisted to `settler_runs`, `settler_swaps`, `settler_payouts`. Visible in the admin dashboard.

## Manual run

From your local machine, with `.env` populated:

```sh
npm install
npm run dry      # one cycle, dry-run
npm run once     # one cycle, executes (uses DRY_RUN env var)
```
