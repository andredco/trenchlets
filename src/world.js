// =========================================================
// Trenchlets · world
// Procedural tile map for the town. Districts, plazas,
// paths, vault, decorations, billboards, totems.
// Ground is rendered as ONE pre-baked HD canvas (no tile grid).
// =========================================================

import { TUNING, COMMUNITIES } from "./data.js";

const { TILE, WORLD_TX, WORLD_TY } = TUNING;

// Tile *kinds* are still tracked per-tile so collision and decoration
// scattering work, but rendering uses a single ground canvas painted
// at world resolution with multi-octave noise that crosses tile lines.
export const TILE_TYPES = {
  GRASS: 0,
  GRASS_THICK: 1,
  GRASS_DARK: 2,
  PATH_DIRT: 3,
  PATH_STONE: 4,
  PLAZA: 5,
  SAND: 6,
  WATER: 7,
  MARBLE: 8,
  PAD: 9,
};

// Painted material palettes. 6 shades from deep shadow to bright highlight,
// keyed [0]=darkest .. [5]=brightest. The painter samples by lighting +
// noise rather than picking a single index.
const MATERIAL_PALETTES = {
  // Lush HD grass, vibrant Switch-game greens.
  [TILE_TYPES.GRASS]: ["#0d2410", "#173a1c", "#264e26", "#377a32", "#4ea33c", "#74c54a"],
  [TILE_TYPES.GRASS_THICK]: ["#0a1f0c", "#143318", "#234724", "#326f30", "#4a9a3a", "#6dbe46"],
  [TILE_TYPES.GRASS_DARK]: ["#08180a", "#102a14", "#1c3c1e", "#27562a", "#3b803a", "#5aa742"],
  // Warm sandy path.
  [TILE_TYPES.PATH_DIRT]: ["#2c1b0c", "#3e2a14", "#5e3f1f", "#7a542a", "#9a6e3a", "#b8884a"],
  // Cobblestone street.
  [TILE_TYPES.PATH_STONE]: ["#2a2638", "#3a3550", "#4d4866", "#615c80", "#7a7596", "#9994ac"],
  // Plaza marble.
  [TILE_TYPES.PLAZA]: ["#1a1830", "#262444", "#363456", "#48466a", "#5e5c80", "#7a78a0"],
  [TILE_TYPES.SAND]: ["#5a3e16", "#7a572a", "#996e3a", "#b8854c", "#cf9b5e", "#e2b274"],
  [TILE_TYPES.WATER]: ["#06224a", "#0a3870", "#125a96", "#1f7ec0", "#3aa0db", "#7ec8ee"],
  [TILE_TYPES.MARBLE]: ["#7e7c98", "#9a98b6", "#b6b4d0", "#cdcbe4", "#e0def0", "#f3f2fc"],
  [TILE_TYPES.PAD]: ["#10101a", "#1c1c2c", "#2a2a3e", "#383852", "#48486a", "#5a5a82"],
};

const DISTRICT_PALETTE_CACHE = new Map();

function mulberry(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Build a 6-shade district palette themed on the house body color so each
// trench's plaza pad reads slightly different but still cohesive.
function houseGroundPalette(house) {
  if (DISTRICT_PALETTE_CACHE.has(house.id)) return DISTRICT_PALETTE_CACHE.get(house.id);
  const base = hexToRgb(house.bodyShade);
  const mid = hexToRgb(house.body);
  // Dark base mixed slightly with mid for warmth, then 6 shades from
  // very dark to a soft hint of mid color.
  const palette = [
    rgbToHex(scaleRgb(base, 0.18)),
    rgbToHex(scaleRgb(base, 0.32)),
    rgbToHex(mixRgb(scaleRgb(base, 0.5), scaleRgb(mid, 0.4), 0.4)),
    rgbToHex(mixRgb(scaleRgb(base, 0.65), scaleRgb(mid, 0.55), 0.5)),
    rgbToHex(mixRgb(scaleRgb(base, 0.8), scaleRgb(mid, 0.7), 0.6)),
    rgbToHex(mixRgb(scaleRgb(base, 0.95), scaleRgb(mid, 0.9), 0.7)),
  ];
  DISTRICT_PALETTE_CACHE.set(house.id, palette);
  return palette;
}

function scaleRgb(rgb, k) {
  return [rgb[0] * k, rgb[1] * k, rgb[2] * k];
}
function mixRgb(a, b, t) {
  return [a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t];
}
function rgbToHex([r, g, b]) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}
function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// =================== MAP GENERATION ===================

export function generateWorld() {
  const tiles = [];
  const variants = [];
  const collision = [];
  const tilePalette = [];
  for (let y = 0; y < WORLD_TY; y++) {
    tiles.push(new Array(WORLD_TX).fill(TILE_TYPES.GRASS));
    variants.push(new Array(WORLD_TX).fill(0));
    collision.push(new Array(WORLD_TX).fill(0));
    tilePalette.push(new Array(WORLD_TX).fill(null));
  }

  // Base grass stays continuous. Earlier versions flipped individual
  // tiles between grass variants, which made the ground read as a visible
  // checkerboard; the HD painter's world-space noise now carries texture.
  for (let y = 0; y < WORLD_TY; y++) {
    for (let x = 0; x < WORLD_TX; x++) {
      const v = (x * 13 + y * 17) & 3;
      variants[y][x] = v;
    }
  }

  for (const house of COMMUNITIES) {
    paintDistrict(tiles, variants, tilePalette, house.bbox, houseGroundPalette(house));
  }

  const vaultCx = Math.floor(WORLD_TX / 2);
  const vaultCy = Math.floor(WORLD_TY / 2);
  for (let y = vaultCy - 3; y <= vaultCy + 3; y++) {
    for (let x = vaultCx - 3; x <= vaultCx + 3; x++) {
      if (inBounds(x, y)) {
        tiles[y][x] = TILE_TYPES.PLAZA;
        tilePalette[y][x] = null;
      }
    }
  }

  for (const house of COMMUNITIES) {
    carvePath(
      tiles,
      tilePalette,
      house.plaza.tx,
      house.plaza.ty,
      vaultCx,
      vaultCy,
      TILE_TYPES.PATH_STONE,
    );
  }

  if (COMMUNITIES[2]) carvePond(tiles, tilePalette, COMMUNITIES[2].bbox);
  if (COMMUNITIES[7]) carvePond(tiles, tilePalette, COMMUNITIES[7].bbox);

  const decorations = [];
  scatterDecorations(decorations, tiles);

  for (const house of COMMUNITIES) {
    const cx = house.plaza.tx;
    const cy = house.plaza.ty;
    decorations.push({ kind: "totem", x: cx * TILE, y: cy * TILE, community: house });
    decorations.push({
      kind: "billboard",
      x: (cx + 3) * TILE,
      y: (cy - 1) * TILE,
      community: house,
    });
    decorations.push({
      kind: "house",
      x: (cx - 5) * TILE,
      y: (cy + 2) * TILE,
      community: house,
    });
  }

  decorations.push({
    kind: "vault",
    x: vaultCx * TILE - 24,
    y: vaultCy * TILE - 24,
  });

  decorations.push({
    kind: "fountain",
    x: (vaultCx + 5) * TILE,
    y: (vaultCy + 4) * TILE,
  });

  for (const house of COMMUNITIES) {
    const dx = Math.sign(vaultCx - house.plaza.tx);
    const dy = Math.sign(vaultCy - house.plaza.ty);
    for (let step = 2; step < 14; step += 3) {
      const tx = house.plaza.tx + dx * step;
      const ty = house.plaza.ty + dy * step;
      if (!inBounds(tx, ty)) continue;
      decorations.push({ kind: "lamp", x: tx * TILE + 4, y: ty * TILE });
    }
  }

  for (const d of decorations) {
    if (d.kind === "vault") {
      const tx = Math.floor(d.x / TILE);
      const ty = Math.floor(d.y / TILE);
      for (let dy2 = 0; dy2 < 3; dy2++) {
        for (let dx2 = 0; dx2 < 3; dx2++) {
          if (inBounds(tx + dx2, ty + dy2)) collision[ty + dy2][tx + dx2] = 2;
        }
      }
    } else if (d.kind === "house") {
      const tx = Math.floor(d.x / TILE);
      const ty = Math.floor(d.y / TILE);
      for (let dy2 = 0; dy2 < 3; dy2++) {
        for (let dx2 = 0; dx2 < 5; dx2++) {
          if (inBounds(tx + dx2, ty + dy2)) collision[ty + dy2][tx + dx2] = 2;
        }
      }
    } else if (d.kind === "billboard" || d.kind === "totem") {
      const tx = Math.floor(d.x / TILE);
      const ty = Math.floor(d.y / TILE);
      if (inBounds(tx, ty)) collision[ty][tx] = 0;
    } else if (d.kind === "fountain") {
      const tx = Math.floor(d.x / TILE);
      const ty = Math.floor(d.y / TILE);
      for (let dy2 = 0; dy2 < 2; dy2++) {
        for (let dx2 = 0; dx2 < 2; dx2++) {
          if (inBounds(tx + dx2, ty + dy2)) collision[ty + dy2][tx + dx2] = 2;
        }
      }
    } else if (d.kind === "tree") {
      const tx = Math.floor(d.x / TILE);
      const ty = Math.floor(d.y / TILE);
      if (inBounds(tx, ty)) collision[ty][tx] = 2;
    }
  }
  for (let y = 0; y < WORLD_TY; y++) {
    for (let x = 0; x < WORLD_TX; x++) {
      if (tiles[y][x] === TILE_TYPES.WATER) collision[y][x] = 1;
    }
  }

  const world = {
    tiles,
    variants,
    collision,
    decorations,
    tilePalette,
    vault: { cx: vaultCx, cy: vaultCy },
  };
  // Bake the HD ground canvas once. From here on, drawTiles just blits the
  // pre-rendered region into the viewport.
  world.groundCanvas = bakeGroundCanvas(world);
  return world;
}

function paintDistrict(tiles, variants, tilePalette, bbox, palette) {
  for (let y = bbox.ty; y < bbox.ty + bbox.th; y++) {
    for (let x = bbox.tx; x < bbox.tx + bbox.tw; x++) {
      if (!inBounds(x, y)) continue;
      const distToEdge = Math.min(
        x - bbox.tx,
        bbox.tx + bbox.tw - 1 - x,
        y - bbox.ty,
        bbox.ty + bbox.th - 1 - y,
      );
      if (distToEdge < 2 && Math.random() > 0.5) continue;
      if (distToEdge < 1) continue;
      tiles[y][x] = TILE_TYPES.PAD;
      tilePalette[y][x] = palette;
    }
  }
}

function carvePath(tiles, tilePalette, x1, y1, x2, y2, type) {
  const stepX = Math.sign(x2 - x1) || 1;
  const stepY = Math.sign(y2 - y1) || 1;
  let x = x1;
  while (x !== x2) {
    for (let w = -1; w <= 1; w++) {
      const ty = y1 + w;
      if (inBounds(x, ty)) {
        tiles[ty][x] = type;
        tilePalette[ty][x] = null;
      }
    }
    x += stepX;
  }
  let y = y1;
  while (y !== y2) {
    for (let w = -1; w <= 1; w++) {
      const tx = x2 + w;
      if (inBounds(tx, y)) {
        tiles[y][tx] = type;
        tilePalette[y][tx] = null;
      }
    }
    y += stepY;
  }
  if (inBounds(x2, y2)) {
    tiles[y2][x2] = type;
    tilePalette[y2][x2] = null;
  }
}

function carvePond(tiles, tilePalette, bbox) {
  const cx = bbox.tx + Math.floor(bbox.tw * 0.75);
  const cy = bbox.ty + Math.floor(bbox.th * 0.78);
  for (let y = -2; y <= 2; y++) {
    for (let x = -3; x <= 3; x++) {
      const tx = cx + x;
      const ty = cy + y;
      if (!inBounds(tx, ty)) continue;
      const d = (x * x) / 9 + (y * y) / 4;
      if (d <= 1) {
        tiles[ty][tx] = TILE_TYPES.WATER;
        tilePalette[ty][tx] = null;
      } else if (d <= 1.4) {
        tiles[ty][tx] = TILE_TYPES.SAND;
        tilePalette[ty][tx] = null;
      }
    }
  }
}

function scatterDecorations(decorations, tiles) {
  const rng = mulberry(424242);
  for (let y = 1; y < WORLD_TY - 1; y++) {
    for (let x = 1; x < WORLD_TX - 1; x++) {
      const t = tiles[y][x];
      if (t === TILE_TYPES.PATH_STONE || t === TILE_TYPES.PATH_DIRT || t === TILE_TYPES.PLAZA)
        continue;
      const r = rng();
      if (t === TILE_TYPES.GRASS_THICK || t === TILE_TYPES.GRASS_DARK || t === TILE_TYPES.GRASS) {
        if (r < 0.007) decorations.push({ kind: "tree", x: x * TILE, y: y * TILE });
        else if (r < 0.028) decorations.push({ kind: "bush", x: x * TILE + 4, y: y * TILE + 5 });
        else if (r < 0.07) decorations.push({ kind: "longgrass", x: x * TILE + 2, y: y * TILE + 2 });
        else if (r < 0.1) decorations.push({ kind: "flower", x: x * TILE + 5, y: y * TILE + 5 });
      }
      if (t === TILE_TYPES.SAND && r < 0.18) {
        decorations.push({ kind: "rock", x: x * TILE + 4, y: y * TILE + 4 });
      }
      if (t === TILE_TYPES.PAD && r < 0.05) {
        decorations.push({ kind: "rock", x: x * TILE + 4, y: y * TILE + 4 });
      }
    }
  }
}

function inBounds(x, y) {
  return x >= 0 && y >= 0 && x < WORLD_TX && y < WORLD_TY;
}

// =========================================================
// HD GROUND PAINTER
// =========================================================
// Bakes the entire world's ground into a single offscreen canvas at
// startup. We sample 2 octaves of value noise at WORLD-pixel coordinates
// (not tile coordinates) so the noise crosses tile boundaries. Then we
// add 3/4-perspective cues: path edge shadows, district pad lift,
// directional grass blade tufts, plaza slab seams, water ripples.

const VALUE_NOISE = (() => {
  // Pre-baked 64x64 value noise table, smoothly interpolated when sampled.
  const N = 64;
  const data = new Float32Array(N * N);
  const rng = mulberry(31337);
  for (let i = 0; i < data.length; i++) data[i] = rng();
  function sample(x, y) {
    const xi = ((x % N) + N) % N;
    const yi = ((y % N) + N) % N;
    const x0 = Math.floor(xi);
    const y0 = Math.floor(yi);
    const x1 = (x0 + 1) % N;
    const y1 = (y0 + 1) % N;
    const fx = xi - x0;
    const fy = yi - y0;
    const a = data[y0 * N + x0];
    const b = data[y0 * N + x1];
    const c = data[y1 * N + x0];
    const d = data[y1 * N + x1];
    const u = fx * fx * (3 - 2 * fx);
    const v = fy * fy * (3 - 2 * fy);
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
  }
  return { sample };
})();

function noise2(x, y) {
  // Two octaves blended — wide soft variation + small high-freq detail.
  const a = VALUE_NOISE.sample(x / 18, y / 18);
  const b = VALUE_NOISE.sample(x / 5, y / 5);
  return a * 0.65 + b * 0.35;
}

// Pick a palette index 0..5 from base lighting + noise.
function pickShade(lit, noise) {
  // lit: 0..1, noise: 0..1
  let v = lit * 0.7 + noise * 0.3;
  // Quantize into 6 bands but with painterly jitter so edges don't band.
  v += (noise - 0.5) * 0.15;
  if (v < 0.16) return 0;
  if (v < 0.32) return 1;
  if (v < 0.5) return 2;
  if (v < 0.68) return 3;
  if (v < 0.85) return 4;
  return 5;
}

// Pre-baked ground canvas is rendered at HD_DENSITY× world resolution so
// the ground exposes real HD detail when blitted via drawHD. All paint
// operations (per-pixel, tufts, specks, foam) are scaled by D.
const GROUND_DENSITY = 3;

function bakeGroundCanvas(world) {
  const D = GROUND_DENSITY;
  const W = WORLD_TX * TILE * D;
  const H = WORLD_TY * TILE * D;
  const cnv = document.createElement("canvas");
  cnv.width = W;
  cnv.height = H;
  const ctx = cnv.getContext("2d");
  const img = ctx.createImageData(W, H);
  const data = img.data;

  // Pre-resolve palettes per tile into RGB arrays for speed.
  const paletteByTile = new Array(WORLD_TY);
  for (let ty = 0; ty < WORLD_TY; ty++) {
    paletteByTile[ty] = new Array(WORLD_TX);
    for (let tx = 0; tx < WORLD_TX; tx++) {
      const t = world.tiles[ty][tx];
      const customHexes = world.tilePalette[ty][tx];
      let hexes = customHexes;
      if (!hexes) hexes = MATERIAL_PALETTES[t] || MATERIAL_PALETTES[TILE_TYPES.GRASS];
      if (hexes.length === 4) {
        const a = hexToRgb(hexes[0]);
        const e = hexToRgb(hexes[3]);
        hexes = [
          rgbToHex([a[0] * 0.7, a[1] * 0.7, a[2] * 0.7]),
          hexes[0],
          hexes[1],
          hexes[2],
          hexes[3],
          rgbToHex([Math.min(255, e[0] * 1.18), Math.min(255, e[1] * 1.18), Math.min(255, e[2] * 1.18)]),
        ];
      }
      paletteByTile[ty][tx] = hexes.map(hexToRgb);
    }
  }

  function kindAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= WORLD_TX || ty >= WORLD_TY) return -1;
    return world.tiles[ty][tx];
  }
  function isPath(k) {
    return k === TILE_TYPES.PATH_STONE || k === TILE_TYPES.PATH_DIRT || k === TILE_TYPES.PLAZA;
  }
  function isPad(k) {
    return k === TILE_TYPES.PAD;
  }
  function isWater(k) {
    return k === TILE_TYPES.WATER;
  }

  // Per-pixel paint pass, at HD density. Coordinates inside the loop are
  // HD pixels; we convert back to world tiles via /(TILE*D).
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Tile lookup uses world (logical) tile coords.
      const tx = (x / (TILE * D)) | 0;
      const ty = (y / (TILE * D)) | 0;
      const t = world.tiles[ty][tx];
      const palette = paletteByTile[ty][tx];

      // Convert HD pixel to logical coords for noise sampling so noise
      // octaves stay tuned to a sensible scale at any density.
      const lx = x / D;
      const ly = y / D;

      const globalLit = 0.5 + ((y / H) - 0.5) * 0.08;
      let n = noise2(lx, ly);

      // ---- PATH EDGE SHADOW ----
      let pathShadow = 0;
      if (isPath(t)) {
        const localX = lx - tx * TILE;
        const localY = ly - ty * TILE;
        const upN = !isPath(kindAt(tx, ty - 1));
        const dnN = !isPath(kindAt(tx, ty + 1));
        const lfN = !isPath(kindAt(tx - 1, ty));
        const rtN = !isPath(kindAt(tx + 1, ty));
        const distUp = upN ? localY : 99;
        const distDn = dnN ? TILE - 1 - localY : 99;
        const distLf = lfN ? localX : 99;
        const distRt = rtN ? TILE - 1 - localX : 99;
        const minD = Math.min(distUp, distDn, distLf, distRt);
        if (minD <= 1) pathShadow = -0.18;
      }

      // ---- DISTRICT PAD LIFT ----
      let padLift = 0;
      if (isPad(t)) {
        const localX = lx - tx * TILE;
        const localY = ly - ty * TILE;
        const upN = !isPad(kindAt(tx, ty - 1));
        const dnN = !isPad(kindAt(tx, ty + 1));
        const lfN = !isPad(kindAt(tx - 1, ty));
        const rtN = !isPad(kindAt(tx + 1, ty));
        if (upN && localY < 1) padLift = 0.22;
        if (lfN && localX < 1) padLift = 0.14;
        if (dnN && localY >= TILE - 2) padLift = -0.22;
        if (rtN && localX >= TILE - 2) padLift = -0.14;
        if (dnN && localY >= TILE - 1) padLift = -0.32;
      }

      // ---- PLAZA SLAB SEAMS ----
      let plazaSeam = 0;
      if (t === TILE_TYPES.PLAZA) {
        const sx = lx % (TILE * 2);
        const sy = ly % (TILE * 2);
        if (sx < 1 || sy < 1) plazaSeam = -0.18;
        else if (sx < 2 || sy < 2) plazaSeam = -0.06;
      }

      // ---- WATER RIPPLES ----
      let waterTouch = 0;
      if (isWater(t)) {
        const ripple = Math.sin((lx * 0.4 + ly * 0.7) * 0.5 + n * 4) * 0.5 + 0.5;
        waterTouch = ripple * 0.18 - 0.02;
      }

      const lit = clamp01(globalLit + pathShadow + padLift + plazaSeam + waterTouch);
      const idx = pickShade(lit, n);
      const rgb = palette[idx];

      const i = (y * W + x) * 4;
      data[i] = rgb[0];
      data[i + 1] = rgb[1];
      data[i + 2] = rgb[2];
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);

  paintGrassTufts(ctx, world, D);
  paintPathDetails(ctx, world, D);
  paintWaterFoam(ctx, world, D);

  return cnv;
}

function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function paintGrassTufts(ctx, world, D = 1) {
  const rng = mulberry(98765);
  const W = WORLD_TX * TILE * D;
  const H = WORLD_TY * TILE * D;
  for (let ty = 0; ty < WORLD_TY; ty++) {
    for (let tx = 0; tx < WORLD_TX; tx++) {
      const t = world.tiles[ty][tx];
      let density;
      if (t === TILE_TYPES.GRASS) density = 0.85;
      else if (t === TILE_TYPES.GRASS_THICK) density = 1.25;
      else if (t === TILE_TYPES.GRASS_DARK) density = 0.55;
      else continue;
      const count = Math.floor(density + rng() * 1.35);
      for (let placed = 0; placed < count; placed++) {
        const px = (tx * TILE + 1) * D + Math.floor(rng() * (TILE - 2) * D);
        const py = (ty * TILE + 1) * D + Math.floor(rng() * (TILE - 2) * D);
        if (px < 0 || py < 0 || px >= W || py >= H - D) {
          continue;
        }
        const dark = "#0c1f0a";
        const mid = "#3e7a30";
        const tip = "#9be07a";
        // Draw a slightly taller blade at HD density: 2D-tall stem, 1D tip.
        ctx.fillStyle = dark;
        ctx.fillRect(px, py + D, D, D);
        ctx.fillStyle = mid;
        ctx.fillRect(px, py, D, D);
        ctx.fillStyle = tip;
        ctx.fillRect(px - 1, py - 1, D, D);
        if (rng() > 0.6 && px + D < W) {
          ctx.fillStyle = mid;
          ctx.fillRect(px + D, py, D, D);
          ctx.fillStyle = dark;
          ctx.fillRect(px + D, py + D, D, D);
        }
      }
    }
  }
}

function paintPathDetails(ctx, world, D = 1) {
  const rng = mulberry(13579);
  for (let ty = 0; ty < WORLD_TY; ty++) {
    for (let tx = 0; tx < WORLD_TX; tx++) {
      const t = world.tiles[ty][tx];
      if (t === TILE_TYPES.PATH_STONE) {
        for (let i = 0; i < 6; i++) {
          if (rng() > 0.6) continue;
          const px = (tx * TILE + 1) * D + Math.floor(rng() * (TILE - 2) * D);
          const py = (ty * TILE + 1) * D + Math.floor(rng() * (TILE - 2) * D);
          ctx.fillStyle = "#1c1830";
          ctx.fillRect(px, py + D, 2 * D, D);
          ctx.fillStyle = "#7a7596";
          ctx.fillRect(px, py, D, D);
        }
      } else if (t === TILE_TYPES.PLAZA) {
        if (rng() > 0.8) {
          const px = tx * TILE * D + Math.floor(rng() * TILE * D);
          const py = ty * TILE * D + Math.floor(rng() * TILE * D);
          ctx.fillStyle = "#a09cc8";
          ctx.fillRect(px, py, D, D);
        }
      } else if (t === TILE_TYPES.PATH_DIRT) {
        for (let i = 0; i < 4; i++) {
          if (rng() > 0.6) continue;
          const px = tx * TILE * D + Math.floor(rng() * TILE * D);
          const py = ty * TILE * D + Math.floor(rng() * TILE * D);
          ctx.fillStyle = "#3a2a14";
          ctx.fillRect(px, py, D, D);
        }
      }
    }
  }
}

function paintWaterFoam(ctx, world, D = 1) {
  for (let ty = 0; ty < WORLD_TY; ty++) {
    for (let tx = 0; tx < WORLD_TX; tx++) {
      const t = world.tiles[ty][tx];
      if (t !== TILE_TYPES.WATER) continue;
      const upN = ty > 0 && world.tiles[ty - 1][tx] !== TILE_TYPES.WATER;
      const lfN = tx > 0 && world.tiles[ty][tx - 1] !== TILE_TYPES.WATER;
      const dnN = ty < WORLD_TY - 1 && world.tiles[ty + 1][tx] !== TILE_TYPES.WATER;
      const rtN = tx < WORLD_TX - 1 && world.tiles[ty][tx + 1] !== TILE_TYPES.WATER;
      ctx.fillStyle = "#aef3ff";
      const PX = TILE * D;
      const PY = TILE * D;
      const X = tx * PX;
      const Y = ty * PY;
      if (upN) ctx.fillRect(X, Y, PX, D);
      if (lfN) ctx.fillRect(X, Y, D, PY);
      if (dnN) ctx.fillRect(X, Y + PY - D, PX, D);
      if (rtN) ctx.fillRect(X + PX - D, Y, D, PY);
    }
  }
}

// =================== TILE RENDERING ===================
// One drawImage per frame. The pre-baked ground canvas is at HD density;
// we bypass the engine's HD logical transform so its native pixels map
// 1:1 to backing-store HD pixels.

const HD_SCALE = 3; // matches engine HD_SCALE

export function drawTiles(ctx, world, cam) {
  const D = GROUND_DENSITY;
  const lsx = Math.max(0, Math.floor(cam.x));
  const lsy = Math.max(0, Math.floor(cam.y));
  const lsw = Math.min(WORLD_TX * TILE - lsx, TUNING.GAME_W);
  const lsh = Math.min(WORLD_TY * TILE - lsy, TUNING.GAME_H);
  if (lsw <= 0 || lsh <= 0) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    world.groundCanvas,
    lsx * D,
    lsy * D,
    lsw * D,
    lsh * D,
    Math.floor((lsx - cam.x) * HD_SCALE),
    Math.floor((lsy - cam.y) * HD_SCALE),
    lsw * HD_SCALE,
    lsh * HD_SCALE,
  );
  ctx.restore();

}

export function tileAt(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (!inBounds(tx, ty)) return null;
  return world.tiles[ty][tx];
}

export function isBlocked(world, x, y) {
  const tx = Math.floor(x / TILE);
  const ty = Math.floor(y / TILE);
  if (!inBounds(tx, ty)) return true;
  return world.collision[ty][tx] > 0;
}

export function clampToWorld(x, y, padding = 4) {
  return {
    x: Math.max(padding, Math.min(WORLD_TX * TILE - padding, x)),
    y: Math.max(padding, Math.min(WORLD_TY * TILE - padding, y)),
  };
}

export function worldDimensions() {
  return { w: WORLD_TX * TILE, h: WORLD_TY * TILE };
}
