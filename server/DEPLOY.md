# Trenchlets · Railway deployment

This is a **single Railway service** that hosts:
- The static frontend (Vite build output from `../dist`)
- HTTP REST API at `/api/*`
- WebSocket multiplayer at `/ws`
- Postgres for durable state

## One-time setup

### 1. Create the Railway project

1. Sign in at railway.com and create a new project from this repo.
2. When asked which directory contains the code, point it at `server/`.
   Railway will detect Node from `package.json`.

### 2. Add a Postgres plugin

1. In the Railway project, click **+ New → Database → PostgreSQL**.
2. Once provisioned, click the Postgres service, go to **Connect**,
   copy the `DATABASE_URL` connection string (or use the **Connect**
   tab's "Variable" reference).
3. In your Trenchlets service's **Variables** tab, add:
   - `DATABASE_URL` → reference the Postgres plugin's connection string
     (Railway can do this automatically: type `${{Postgres.DATABASE_URL}}`).

### 3. Set the environment variables

In the Trenchlets service's **Variables** tab:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `RPC_URL` | Your Helius RPC URL |
| `TRENCHLETS_MINT` | Empty for now — fill once token launches |
| `TRACK_MINTS` | Empty for now — fill with comma-separated mints |
| `IP_SALT` | Generate a random string with `openssl rand -hex 32` |

### 4. Set the custom domain

In the service's **Settings → Networking**:
1. Click **Generate Domain** to get a `*.up.railway.app` for testing.
2. To use `trenchlets.fun`:
   - Click **Custom Domain** → enter `trenchlets.fun`
   - Railway will give you a CNAME target.
   - In your domain registrar's DNS, add a CNAME record pointing
     `trenchlets.fun` (or `www.trenchlets.fun`) at the Railway target.
   - Railway provisions Let's Encrypt SSL automatically.

### 5. Deploy

Push to your main branch. Railway watches the repo and rebuilds.

The build runs:
1. `cd .. && npm install && npm run build` — builds the Vite frontend
2. `cd server && npm install` — installs server deps
3. `npm run migrate && npm start` — runs DB migrations, starts server

## Verifying the deploy

After the deploy finishes:

- `https://trenchlets.fun/health` → should return `{ "ok": true, "epoch": <int> }`
- `https://trenchlets.fun/api/standings` → should return `{ "epoch": <int>, "standings": [] }` (empty until players contribute)
- `https://trenchlets.fun/` → loads the landing page
- Open the browser dev tools network tab, navigate to `/play.html`, and
  confirm a websocket connects to `wss://trenchlets.fun/ws`

## Migrations

`server/migrations/*.sql` are applied in alphabetical order on every deploy
via `npm run migrate`. Already-applied files are tracked in the `migrations`
table so they don't re-run.

To add a new migration, drop a new file like `002_add_raids.sql` in
`server/migrations/` and push.

## Restarts and durability

You can restart the Railway service anytime. Postgres holds:
- Player records and display names
- Vault, house yield, contributions ledger
- Cooldowns
- Epoch boundaries
- Town meeting proposals and votes

Presence (who's online + their position) is in-memory. On restart, all
clients reconnect and re-broadcast within a second.

## Logs

Railway exposes structured logs from `console.log` / `console.warn`.
Useful searches:
- `migrations done` — confirms DB is ready
- `Trenchlets server listening on` — confirms HTTP is up
- `Tracking N token mints` — confirms price feed started

## Rollback

Railway keeps the last several deploys. Click **Deployments → restore**
on a previous build if a release is bad.


## Admin dashboard

A read-only DB inspector at `/admin` lets you watch the live world without
writing SQL. Tables: standings, players, contributions, cooldowns, epochs,
proposals. Plus two write actions: clear a player's cooldown, void a bad
contribution.

### Enable it

In Railway service Variables, add:

| Variable | Value |
|---|---|
| `ADMIN_TOKEN` | Any long random string. **Keep secret.** |

Redeploy. Visit `https://trenchlets.fun/admin`. Paste the token in the input
at the top right, click Load. The token is held in `sessionStorage` so it
persists per browser session but clears on tab close.

If `ADMIN_TOKEN` is not set, `/admin` returns 503 — by design, so admin
isn't accidentally exposed before you're ready.

## Epoch settlement

Every 6 hours the vault should distribute 15% to qualifying $TRENCHLETS holders.
The settlement script computes the math from the contributions ledger and
optionally executes the on-chain transfers.

### Dry run (always do this first)

From your local machine (NOT Railway), with `DATABASE_URL` and `RPC_URL`
pointing at the production DB and Helius:

\`\`\`sh
cd server
npm run settle              # settles the previous epoch
npm run settle -- --epoch 5 # settles a specific epoch
\`\`\`

This prints a table of every qualifying holder, their tier, weight, and
USD share. Nothing is sent on-chain. The epochs row is upserted in the DB
so you can re-run anytime to inspect.

### Execute (sends real money)

\`\`\`sh
VAULT_KEYPAIR='[12,34,56,...]' npm run settle -- --execute
\`\`\`

Where `VAULT_KEYPAIR` is the JSON array output of `solana-keygen new`
(or `solana-keygen recover`). The script signs every transfer with this
keypair and uses the live $TRENCHLETS price (from the price feed) to
convert each holder's USD share into token amounts.

**Operational rules I'd recommend:**

1. Keep `VAULT_KEYPAIR` only on the machine that runs settlement, never
   in Railway's env. The web service should never have signing power.
2. Always run a dry run first, eyeball the distribution, then re-run
   with `--execute`.
3. After execution, confirm the `epochs` row's `settlement_txid` is set
   in the admin dashboard.
4. Set up a calendar reminder every 6h, or wire a cron job on a separate
   machine that runs the dry run and emails you the table for review.
