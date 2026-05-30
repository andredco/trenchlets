# Boblets · Railway deployment

Two Railway services, one shared Postgres. Read top to bottom.

---

## 1. Add Postgres

Railway dashboard → New → Database → PostgreSQL. That's it. You'll
reference its `DATABASE_URL` from the other services as
`${{Postgres.DATABASE_URL}}`.

---

## 2. Web service (the game + API + WebSocket + admin)

This is the service users hit at `boblets.fun`.

**Add the service:**

Railway → New → GitHub Repo → pick `andredco/trenchlets`.

**Settings:**

- Settings → Source → **Root Directory: leave blank** (root of repo).
- The repo's root `railway.toml` and `nixpacks.toml` handle the rest:
  build runs `npm install` (which also installs `server/` deps via
  postinstall) then `npm run build`; start runs migrations then
  starts the Node server, which serves the Vite-built frontend AND
  the websocket AND the API.

**Variables (Variables tab):**

| Name | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `RPC_URL` | `https://mainnet.helius-rpc.com/?api-key=...` |
| `VAULT_ADDRESS` | `9skP9HNkMs1gfu7w27hkZTm88YnoMNxWbWaiXeDv7hgd` |
| `BOBLETS_MINT` | leave empty until token launches |
| `TRACK_MINTS` | leave empty until tokens launch |
| `IP_SALT` | random hex string (e.g. `openssl rand -hex 32`) |
| `ADMIN_TOKEN` | random string, this is what unlocks `/admin` |

**Custom domain:**

Settings → Networking → Custom Domain → add `boblets.fun` and
`www.boblets.fun`. Railway gives you a CNAME target. Set the DNS:

- `www.boblets.fun` → CNAME to the target.
- `boblets.fun` (apex) → use ALIAS/ANAME to the target. If your
  registrar can't, use the A records Railway lists.

**Leave the port field empty.** Railway routes 443 → your `PORT`.

**Smoke test:**

- `https://boblets.fun/health` → `{"ok":true,"epoch":0}`
- `https://boblets.fun/admin` → admin shell page.
- Open the world page in two different browsers, both should see
  each other walking around.

---

## 3. Settler service (3-hour epoch buybacks, runs in the background)

Optional until the token launches. No public network needed; it just
reads the DB, signs Solana txns, sleeps, repeats.

**Add the service:**

Railway → in the SAME project → New → GitHub Repo → same repo.

**Settings:**

- Settings → Source → **Root Directory: `settler`** ← this is the
  one knob that's different from the web service.
- That folder's own `railway.toml` and `nixpacks.toml` handle build
  + start.

**Variables (Variables tab):**

| Name | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `RPC_URL` | same Helius URL as the web service |
| `VAULT_KEYPAIR` | base58 from `solana-keygen` or the JSON byte array. **Settler-only, never on the web service.** |
| `DRY_RUN` | `true` for the first day, then remove to go live |

The settler will boot, run any migrations it needs, then loop
sleeping until the next epoch boundary. Logs show every cycle.

---

## 4. Updates after deploy

Push to GitHub → both services auto-rebuild on the same commit.
Migrations are idempotent (the `migrations` table tracks what's
applied), so re-deploys are safe.

---

## 5. Common things that go wrong

- **Domain shows the landing page but `/admin` doesn't work**: you
  deployed only the frontend, not the server. The root
  `railway.toml` makes this impossible going forward — Railway
  should always pick up the Node process. If you see this again,
  check the Deployments tab → latest build → did `npm install`
  show server deps installing? Did it print
  `Boblets server listening on :PORT`? If not, the build picked
  the wrong directory.
- **Multiplayer doesn't work, players don't see each other**: open
  DevTools Network tab, refresh `/world`, look for a WebSocket
  connection to `/ws`. Status should be 101. If it's 404, the
  Node server isn't running. If it's pending forever, Railway's
  proxy isn't passing through (rare).
- **`/api/vault` returns zero forever**: `RPC_URL` not set, or
  `VAULT_ADDRESS` is wrong. Server logs print
  `vault watcher: tracking <address>` on boot.
- **Reset world button errors**: you skipped migrations. Set the
  service's pre-deploy command to `npm run migrate` (already done
  by the root `railway.toml`).

---

## 6. Local dev

From the repo root:

```
npm install        # installs root + server deps via postinstall
npm run dev        # vite dev server at :5175
```

In another terminal, optionally run the server:

```
cd server
DATABASE_URL=postgres://... npm start
```

The Vite dev server proxies `/api` and `/ws` to the local server if
you set up a proxy, or just hit the deployed Railway URL for the
backend while iterating on UI.

