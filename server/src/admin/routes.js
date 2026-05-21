// =========================================================
// Admin dashboard — read-only DB inspector + a few actions.
// =========================================================
// Mounted under /admin. Auth: ADMIN_TOKEN env var matched against
// the `x-admin-token` header (or `?token=` query param).
//
// Routes (all return JSON unless noted):
//   GET  /admin                       → HTML dashboard
//   GET  /admin/api/players           → all players + last_seen
//   GET  /admin/api/standings         → house_state rows
//   GET  /admin/api/contributions     → last 200 contributions
//   GET  /admin/api/epochs            → epoch summary
//   GET  /admin/api/cooldowns         → active cooldowns
//   GET  /admin/api/proposals         → town meeting proposals
//   POST /admin/api/cooldowns/:playerId/clear   → clears cooldown
//   POST /admin/api/players/:id/rename          → force rename
//   POST /admin/api/contributions/:id/void      → void a bad contribution

import { Router } from "express";
import { query } from "../db/pool.js";

export function adminRouter() {
  const r = Router();

  r.use((req, res, next) => {
    const token = req.headers["x-admin-token"] || req.query.token;
    if (!process.env.ADMIN_TOKEN) {
      return res.status(503).json({ error: "ADMIN_TOKEN not configured" });
    }
    if (token !== process.env.ADMIN_TOKEN) {
      return res.status(401).json({ error: "unauthorized" });
    }
    next();
  });

  r.get("/api/players", async (req, res) => {
    const limit = Math.min(500, parseInt(req.query.limit) || 200);
    const rows = (await query(
      `SELECT id, wallet, hardware_id, display_name, community_id, ip_hash, last_seen, created_at
       FROM players ORDER BY last_seen DESC LIMIT $1`,
      [limit],
    )).rows;
    res.json({ rows, count: rows.length });
  });

  r.get("/api/standings", async (req, res) => {
    const rows = (await query(
      `SELECT community_id, vault_usd, epoch_yield, total_yield, updated_at
       FROM house_state ORDER BY epoch_yield DESC`,
    )).rows;
    res.json({ rows });
  });

  r.get("/api/contributions", async (req, res) => {
    const limit = Math.min(500, parseInt(req.query.limit) || 200);
    const rows = (await query(
      `SELECT c.id, c.community_id, c.task_id, c.minigame_id, c.difficulty,
              c.raw_score, c.percent, c.event_mult, c.duration_ms, c.epoch_idx,
              c.created_at, p.display_name, p.wallet, p.hardware_id
       FROM contributions c JOIN players p ON p.id = c.player_id
       ORDER BY c.created_at DESC LIMIT $1`,
      [limit],
    )).rows;
    res.json({ rows });
  });

  r.get("/api/epochs", async (req, res) => {
    const rows = (await query(
      `SELECT idx, starts_at, ends_at, vault_usd_start, vault_usd_end, drain_usd,
              total_yield, settled_at, settlement_txid
       FROM epochs ORDER BY idx DESC LIMIT 50`,
    )).rows;
    res.json({ rows });
  });

  r.get("/api/cooldowns", async (req, res) => {
    const rows = (await query(
      `SELECT cd.player_id, cd.until_at, cd.reason, p.display_name, p.wallet
       FROM cooldowns cd JOIN players p ON p.id = cd.player_id
       WHERE cd.until_at > now() ORDER BY cd.until_at DESC`,
    )).rows;
    res.json({ rows });
  });

  r.get("/api/proposals", async (req, res) => {
    const rows = (await query(
      `SELECT id, name, ticker, contract, vote_count, created_at, promoted_at
       FROM town_proposals ORDER BY vote_count DESC LIMIT 100`,
    )).rows;
    res.json({ rows });
  });

  r.post("/api/cooldowns/:playerId/clear", async (req, res) => {
    await query(`DELETE FROM cooldowns WHERE player_id = $1`, [req.params.playerId]);
    res.json({ ok: true });
  });

  r.post("/api/players/:id/rename", async (req, res) => {
    const name = String(req.body?.name || "").trim().slice(0, 24);
    if (!name) return res.status(400).json({ error: "name required" });
    await query(`UPDATE players SET display_name = $1 WHERE id = $2`, [name, req.params.id]);
    res.json({ ok: true, name });
  });

  r.post("/api/contributions/:id/void", async (req, res) => {
    const c = (await query(`SELECT community_id, percent FROM contributions WHERE id = $1`, [req.params.id])).rows[0];
    if (!c) return res.status(404).json({ error: "not found" });
    await query("BEGIN");
    try {
      await query(`DELETE FROM contributions WHERE id = $1`, [req.params.id]);
      await query(
        `UPDATE house_state
         SET epoch_yield = GREATEST(0, epoch_yield - $1),
             total_yield = GREATEST(0, total_yield - $1)
         WHERE community_id = $2`,
        [c.percent, c.community_id],
      );
      await query("COMMIT");
      res.json({ ok: true });
    } catch (err) {
      await query("ROLLBACK");
      res.status(500).json({ error: err.message });
    }
  });

  // HTML dashboard
  r.get("/", (req, res) => {
    res.set("content-type", "text/html").send(ADMIN_HTML);
  });

  return r;
}

const ADMIN_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trenchlets · Admin</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg:#0a0a0a; --bg2:#111; --bg3:#181818;
      --line:rgba(255,255,255,0.08); --line2:rgba(255,255,255,0.16);
      --text:#fff; --text2:#a3a3a3; --text3:#6b6b6b;
      --green:#1eff8e; --pink:#ff4a6e; --gold:#ffd84a;
    }
    *,*::before,*::after{box-sizing:border-box;}
    body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased;}
    .topbar{display:flex;align-items:center;justify-content:space-between;padding:14px 24px;border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(10,10,10,0.92);backdrop-filter:blur(12px);z-index:10;}
    .brand{display:flex;align-items:center;gap:10px;}
    .brand-mark{width:28px;height:28px;background:var(--green);color:#000;display:grid;place-items:center;border-radius:6px;font-weight:800;font-size:0.7rem;}
    .brand strong{font-size:0.92rem;letter-spacing:-0.01em;}
    .brand small{display:block;color:var(--text3);font-family:JetBrains Mono,monospace;font-size:0.65rem;}
    .auth-area{display:flex;align-items:center;gap:8px;}
    .auth-area input{background:var(--bg2);border:1px solid var(--line);color:var(--text);padding:6px 10px;border-radius:6px;font-family:JetBrains Mono,monospace;font-size:0.78rem;width:240px;}
    .auth-area button{background:var(--green);color:#000;border:none;padding:6px 14px;border-radius:6px;font-weight:700;font-size:0.78rem;cursor:pointer;}
    main{max-width:1400px;margin:0 auto;padding:24px;}
    .stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:24px;}
    .stat{background:var(--bg2);border:1px solid var(--line);border-radius:10px;padding:16px 18px;}
    .stat small{display:block;color:var(--text3);font-family:JetBrains Mono,monospace;font-size:0.65rem;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:6px;}
    .stat strong{font-size:1.4rem;font-weight:800;letter-spacing:-0.02em;}
    .tabs{display:flex;gap:4px;border-bottom:1px solid var(--line);margin-bottom:18px;flex-wrap:wrap;}
    .tab{background:none;border:none;color:var(--text2);padding:10px 18px;font-family:Inter,sans-serif;font-size:0.85rem;font-weight:500;cursor:pointer;border-bottom:2px solid transparent;margin-bottom:-1px;}
    .tab:hover{color:var(--text);}
    .tab.active{color:var(--green);border-bottom-color:var(--green);}
    table{width:100%;border-collapse:collapse;background:var(--bg2);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:0.82rem;}
    th{text-align:left;padding:10px 14px;background:var(--bg3);color:var(--text3);font-family:JetBrains Mono,monospace;font-size:0.7rem;letter-spacing:0.08em;text-transform:uppercase;font-weight:600;border-bottom:1px solid var(--line);}
    td{padding:10px 14px;border-bottom:1px solid var(--line);color:var(--text2);font-family:JetBrains Mono,monospace;font-size:0.78rem;}
    td.action button{background:var(--bg3);border:1px solid var(--line2);color:var(--text);padding:4px 10px;border-radius:4px;font-size:0.7rem;cursor:pointer;}
    td.action button:hover{background:var(--pink);color:#000;border-color:var(--pink);}
    .pill{padding:2px 8px;border-radius:999px;font-size:0.7rem;font-weight:600;}
    .pill.green{background:rgba(30,255,142,0.15);color:var(--green);}
    .pill.gold{background:rgba(255,216,74,0.15);color:var(--gold);}
    .pill.pink{background:rgba(255,74,110,0.15);color:var(--pink);}
    .empty{padding:32px;text-align:center;color:var(--text3);}
    .refresh{background:var(--bg2);border:1px solid var(--line);color:var(--text);padding:6px 12px;border-radius:6px;font-size:0.78rem;cursor:pointer;margin-left:auto;}
    .refresh:hover{border-color:var(--green);color:var(--green);}
    .table-head{display:flex;align-items:center;margin-bottom:10px;gap:10px;}
    .table-head h2{margin:0;font-size:1rem;font-weight:700;}
    .truncate{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:inline-block;vertical-align:middle;}
  </style>
</head>
<body>
  <header class="topbar">
    <div class="brand">
      <span class="brand-mark">T</span>
      <div><strong>Trenchlets Admin</strong><small>v0.4 · DB inspector</small></div>
    </div>
    <div class="auth-area">
      <input type="password" id="tokenInput" placeholder="Admin token" />
      <button id="loadBtn">Load</button>
    </div>
  </header>

  <main>
    <section class="stats" id="stats">
      <div class="stat"><small>Vault USD</small><strong id="statVault">—</strong></div>
      <div class="stat"><small>Players</small><strong id="statPlayers">—</strong></div>
      <div class="stat"><small>Contributions</small><strong id="statContribs">—</strong></div>
      <div class="stat"><small>Active cooldowns</small><strong id="statCooldowns">—</strong></div>
      <div class="stat"><small>Current epoch</small><strong id="statEpoch">—</strong></div>
    </section>

    <div class="tabs" id="tabs">
      <button class="tab active" data-tab="standings">Standings</button>
      <button class="tab" data-tab="players">Players</button>
      <button class="tab" data-tab="contributions">Contributions</button>
      <button class="tab" data-tab="cooldowns">Cooldowns</button>
      <button class="tab" data-tab="epochs">Epochs</button>
      <button class="tab" data-tab="proposals">Proposals</button>
    </div>

    <div class="table-head">
      <h2 id="tableTitle">Standings</h2>
      <button class="refresh" id="refreshBtn">↻ Refresh</button>
    </div>
    <div id="tableContainer"></div>
  </main>

  <script>
    const API = (path) => fetch('/admin/api' + path, {
      headers: { 'x-admin-token': sessionStorage.getItem('admin-token') || '' }
    }).then(r => r.ok ? r.json() : Promise.reject(r.status));

    let activeTab = 'standings';

    document.querySelectorAll('.tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activeTab = btn.dataset.tab;
        loadTab();
      });
    });

    document.getElementById('loadBtn').addEventListener('click', () => {
      const t = document.getElementById('tokenInput').value.trim();
      if (!t) return;
      sessionStorage.setItem('admin-token', t);
      loadAll();
    });

    document.getElementById('refreshBtn').addEventListener('click', loadAll);

    document.getElementById('tokenInput').value = sessionStorage.getItem('admin-token') || '';
    if (sessionStorage.getItem('admin-token')) loadAll();

    async function loadAll() { await loadStats(); await loadTab(); }

    async function loadStats() {
      try {
        const [s, c, p, cd, e] = await Promise.all([
          API('/standings'), API('/contributions?limit=1'),
          API('/players?limit=1'), API('/cooldowns'), API('/epochs'),
        ]);
        const vault = s.rows.reduce((sum, r) => sum + Number(r.vault_usd), 0);
        document.getElementById('statVault').textContent = '$' + vault.toFixed(2);
        document.getElementById('statPlayers').textContent = p.count != null ? '~' + p.count + '+' : '—';
        document.getElementById('statContribs').textContent = c.rows.length > 0 ? c.rows[0].id : 0;
        document.getElementById('statCooldowns').textContent = cd.rows.length;
        document.getElementById('statEpoch').textContent = e.rows[0]?.idx ?? '—';
      } catch (err) {
        showError(err);
      }
    }

    async function loadTab() {
      const titleMap = {
        standings: 'House Standings', players: 'Players',
        contributions: 'Recent Contributions', cooldowns: 'Active Cooldowns',
        epochs: 'Epochs', proposals: 'Town Proposals',
      };
      document.getElementById('tableTitle').textContent = titleMap[activeTab];
      try {
        const data = await API('/' + activeTab);
        renderTable(activeTab, data.rows || []);
      } catch (err) { showError(err); }
    }

    function renderTable(tab, rows) {
      const c = document.getElementById('tableContainer');
      if (rows.length === 0) { c.innerHTML = '<div class="empty">No rows</div>'; return; }
      let html = '<table>';
      const renderers = {
        standings: () => {
          html += '<thead><tr><th>House</th><th>Vault USD</th><th>Epoch yield</th><th>Lifetime yield</th><th>Updated</th></tr></thead><tbody>';
          for (const r of rows) {
            html += '<tr>';
            html += '<td><strong style="color:#fff">' + r.community_id + '</strong></td>';
            html += '<td>$' + Number(r.vault_usd).toFixed(2) + '</td>';
            html += '<td><span class="pill green">' + Number(r.epoch_yield).toFixed(2) + '%</span></td>';
            html += '<td>' + Number(r.total_yield).toFixed(2) + '%</td>';
            html += '<td>' + fmtDate(r.updated_at) + '</td>';
            html += '</tr>';
          }
        },
        players: () => {
          html += '<thead><tr><th>ID</th><th>Display name</th><th>Wallet/HW</th><th>House</th><th>Last seen</th></tr></thead><tbody>';
          for (const r of rows) {
            html += '<tr>';
            html += '<td>' + r.id + '</td>';
            html += '<td><strong style="color:#fff">' + esc(r.display_name) + '</strong></td>';
            html += '<td><span class="truncate" title="' + (r.wallet || r.hardware_id) + '">' + (r.wallet ? '🔑 ' + short(r.wallet) : '👤 ' + short(r.hardware_id)) + '</span></td>';
            html += '<td>' + (r.community_id || '—') + '</td>';
            html += '<td>' + fmtDate(r.last_seen) + '</td>';
            html += '</tr>';
          }
        },
        contributions: () => {
          html += '<thead><tr><th>When</th><th>Player</th><th>House</th><th>Game</th><th>Diff</th><th>Score</th><th>%</th><th>Action</th></tr></thead><tbody>';
          for (const r of rows) {
            html += '<tr>';
            html += '<td>' + fmtDate(r.created_at) + '</td>';
            html += '<td>' + esc(r.display_name) + '</td>';
            html += '<td>' + r.community_id + '</td>';
            html += '<td>' + r.minigame_id + '</td>';
            html += '<td><span class="pill ' + (r.difficulty === 'hard' ? 'pink' : r.difficulty === 'medium' ? 'gold' : 'green') + '">' + r.difficulty + '</span></td>';
            html += '<td>' + (Number(r.raw_score) * 100).toFixed(0) + '%</td>';
            html += '<td><strong>+' + Number(r.percent).toFixed(2) + '</strong></td>';
            html += '<td class="action"><button onclick="voidContrib(' + r.id + ')">Void</button></td>';
            html += '</tr>';
          }
        },
        cooldowns: () => {
          html += '<thead><tr><th>Player</th><th>Until</th><th>Reason</th><th>Action</th></tr></thead><tbody>';
          for (const r of rows) {
            html += '<tr>';
            html += '<td>' + esc(r.display_name) + ' (' + (r.wallet ? short(r.wallet) : 'guest') + ')</td>';
            html += '<td>' + fmtDate(r.until_at) + '</td>';
            html += '<td>' + r.reason + '</td>';
            html += '<td class="action"><button onclick="clearCooldown(' + r.player_id + ')">Clear</button></td>';
            html += '</tr>';
          }
        },
        epochs: () => {
          html += '<thead><tr><th>#</th><th>Started</th><th>Ended</th><th>Vault start</th><th>Vault end</th><th>Distribution</th><th>Settled</th></tr></thead><tbody>';
          for (const r of rows) {
            html += '<tr>';
            html += '<td><strong style="color:#fff">' + r.idx + '</strong></td>';
            html += '<td>' + fmtDate(r.starts_at) + '</td>';
            html += '<td>' + fmtDate(r.ends_at) + '</td>';
            html += '<td>' + (r.vault_usd_start != null ? '$' + Number(r.vault_usd_start).toFixed(2) : '—') + '</td>';
            html += '<td>' + (r.vault_usd_end != null ? '$' + Number(r.vault_usd_end).toFixed(2) : '—') + '</td>';
            html += '<td>' + (r.drain_usd != null ? '$' + Number(r.drain_usd).toFixed(2) : '—') + '</td>';
            html += '<td>' + (r.settled_at ? '<span class="pill green">' + fmtDate(r.settled_at) + '</span>' : '<span class="pill gold">pending</span>') + '</td>';
            html += '</tr>';
          }
        },
        proposals: () => {
          html += '<thead><tr><th>Name</th><th>Ticker</th><th>Contract</th><th>Votes</th><th>Created</th><th>Promoted</th></tr></thead><tbody>';
          for (const r of rows) {
            html += '<tr>';
            html += '<td><strong style="color:#fff">' + esc(r.name) + '</strong></td>';
            html += '<td>' + esc(r.ticker) + '</td>';
            html += '<td><span class="truncate" title="' + r.contract + '">' + short(r.contract) + '</span></td>';
            html += '<td>' + r.vote_count + '</td>';
            html += '<td>' + fmtDate(r.created_at) + '</td>';
            html += '<td>' + (r.promoted_at ? fmtDate(r.promoted_at) : '—') + '</td>';
            html += '</tr>';
          }
        },
      };
      renderers[tab]();
      html += '</tbody></table>';
      c.innerHTML = html;
    }

    window.voidContrib = async (id) => {
      if (!confirm('Void contribution #' + id + '? This subtracts the % from house yield.')) return;
      const r = await fetch('/admin/api/contributions/' + id + '/void', {
        method: 'POST', headers: { 'x-admin-token': sessionStorage.getItem('admin-token') }
      });
      if (r.ok) { loadAll(); } else { alert('Failed: ' + r.status); }
    };

    window.clearCooldown = async (id) => {
      const r = await fetch('/admin/api/cooldowns/' + id + '/clear', {
        method: 'POST', headers: { 'x-admin-token': sessionStorage.getItem('admin-token') }
      });
      if (r.ok) { loadAll(); } else { alert('Failed: ' + r.status); }
    };

    function fmtDate(s) {
      if (!s) return '—';
      const d = new Date(s);
      const diff = Date.now() - d.getTime();
      if (diff < 60_000) return Math.floor(diff/1000) + 's ago';
      if (diff < 3600_000) return Math.floor(diff/60_000) + 'm ago';
      if (diff < 86400_000) return Math.floor(diff/3600_000) + 'h ago';
      return d.toISOString().slice(0, 16).replace('T', ' ');
    }
    function short(s) { if (!s) return '—'; return s.slice(0, 6) + '…' + s.slice(-4); }
    function esc(s) { const d = document.createElement('div'); d.textContent = String(s ?? ''); return d.innerHTML; }
    function showError(err) {
      document.getElementById('tableContainer').innerHTML = '<div class="empty">Error: ' + (err.status === 401 ? 'invalid token' : err) + '</div>';
    }
  </script>
</body>
</html>`;
