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
