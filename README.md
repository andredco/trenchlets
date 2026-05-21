# PUMPTOWN

A pixel-art live arcade for pump.fun communities. Walk the town as a citizen,
contribute to multi-hour community tasks, catch random world events, and watch
the vault roll random reward percentages into the community that earned them.

## Run It

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Press `PRESS START`, then use `W A S D` (or arrows)
to walk, `E` to interact with totems / billboards / the vault, and `T` to chat.

## What It Has

- **Custom pixel-art engine** rendered at 384×216 and CSS-scaled, with a
  procedural sprite baker, palette-aware character variants, and a small
  in-canvas pixel font.
- **Walkable town** with five district biomes (Fartcoin, Moo Deng, Peanut,
  Goatseus, Act I), a central vault plaza, paths, lamps that glow at night,
  fountains with water particles, trees, and bushes.
- **Live citizens** — dozens of NPCs roam their districts, drop themed
  speech bubbles, react to world events, and contribute pulse to their tasks.
- **Player avatar** with directional walk cycles, shadow, community glow, and
  a floating chevron marker so you always know where you are.
- **Interact system** with on-canvas highlights and an in-HUD `E` prompt:
  - Totems join communities (wallet + held token required).
  - Billboards push contributions to that community's active task.
  - Vault tells you the current pool and accrual rate.
  - Fountain accepts wishes.
- **Anti-bot economy** — tasks need multi-hour windows, minimum unique
  citizens, and per-wallet cooldowns. Completion rolls a random reward band
  (10–50%) from the vault and pays the community.
- **World events** that change the arena live: vault overflow (rains coins
  you can pick up), solar eclipse (2× progress), raid hour (NPCs sprint to
  vault, speed boost), whale visit (a whale floats over the town), and
  community spotlight (3× progress for a random town).
- **Day / night cycle** with lamps lighting up after dusk.
- **Chat** with in-canvas speech bubbles, a scrolling log on the HUD, and
  `BroadcastChannel` so two tabs in the same browser can chat.
- **Wallet** integration via Phantom (`window.solana`) with a demo wallet
  fallback so the arcade always works.
- **Minimap** showing districts, the vault, the player, and NPCs in real
  time.
- **Chiptune audio** — small oscillator-based SFX for interactions, joins,
  rewards, events, and chat. Mutable from the top bar.

## Project Layout

```
index.html
src/
  main.js       bootstrap, HUD/DOM sync, wallet, chat, notifications
  engine.js     game loop, player, NPCs, particles, events, render
  world.js      tile map gen, tile baker, decorations, collision
  sprites.js    sprite definitions, palette baker, character builder
  data.js       communities, tasks, events, tuning
  audio.js      chiptune SFX helpers
  styles.css    arcade CRT theme
```

## Production Next Steps

- Plug `joinCommunity` into a real Solana SPL token holdings check.
- Move task progress and vault accounting to a backend so multiple browsers
  share one world.
- Replace `BroadcastChannel` chat with a websocket so real players see each
  other walk around in real time.
- Wire vault distribution to an on-chain treasury and use verifiable
  randomness for reward percentage rolls.
- Add a Phantom wallet handshake that confirms which mints the wallet holds
  and unlocks the matching totems automatically.
