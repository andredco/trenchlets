// =========================================================
// Trenchlets · Live World Preview
// =========================================================
// Mounts a non-interactive snapshot of the actual world onto
// a canvas. Reuses the real engine's world generation, sprite
// pipeline, and render loop so the preview matches the live game
// exactly. The camera auto-pans across landmarks (vault → each
// house → back) on a slow loop. No input, no HUD, no events
// firing — just the visible city breathing.

import {
  initEngine,
  tick,
  state,
  setSplash,
} from "./engine.js";
import { COMMUNITIES } from "./data.js";

export function mountWorldPreview(canvas) {
  // Hidden minimap canvas — engine requires one but we don't show it.
  const fakeMinimap = document.createElement("canvas");
  fakeMinimap.width = 64;
  fakeMinimap.height = 36;

  // Boot the engine on this canvas. It bakes the world ground,
  // spawns NPCs, sets up sprites — same as the real game.
  initEngine(canvas, fakeMinimap);

  // Take the engine out of "splash open" mode so NPCs walk and
  // events tick, but pin the player off-camera so they never appear.
  setSplash(false);
  if (state.player) {
    state.player.x = -10000;
    state.player.y = -10000;
  }

  // Build a tour route: vault → each house plaza → vault, looping.
  const vault = state.world?.vault;
  const dims = state.world ? worldDimsFromState(state) : { w: 1200, h: 600 };
  const stops = [];
  if (vault) stops.push({ x: vault.cx * 16, y: vault.cy * 16 });
  for (const c of COMMUNITIES) {
    stops.push({ x: c.plaza.tx * 16, y: c.plaza.ty * 16 });
  }
  if (vault) stops.push({ x: vault.cx * 16, y: vault.cy * 16 });

  // Camera tour state: ease between consecutive stops on a fixed timer.
  const STOP_MS = 4500; // dwell + travel per stop
  let stopIdx = 0;
  let stopStart = performance.now();

  function updatePreviewCamera(now) {
    if (stops.length < 2) return;
    const elapsed = now - stopStart;
    const t = Math.min(1, elapsed / STOP_MS);
    // smoothstep
    const s = t * t * (3 - 2 * t);
    const a = stops[stopIdx];
    const b = stops[(stopIdx + 1) % stops.length];
    const cx = a.x + (b.x - a.x) * s - 270;   // GAME_W/2 = 540/2
    const cy = a.y + (b.y - a.y) * s - 150;   // GAME_H/2 = 300/2
    state.cam.x = Math.max(0, Math.min(dims.w - 540, cx));
    state.cam.y = Math.max(0, Math.min(dims.h - 300, cy));
    if (t >= 1) {
      stopIdx = (stopIdx + 1) % stops.length;
      stopStart = now;
    }
  }

  let raf = null;
  let stopped = false;
  function loop(now) {
    if (stopped) return;
    tick(now);
    updatePreviewCamera(now);
    raf = requestAnimationFrame(loop);
  }
  raf = requestAnimationFrame(loop);

  return {
    destroy() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

function worldDimsFromState(state) {
  // Best-effort: derive from world tile array if present.
  if (state.world?.tiles) {
    return { w: state.world.tiles[0].length * 16, h: state.world.tiles.length * 16 };
  }
  return { w: 1200, h: 600 };
}
