// =========================================================
// Pumptown · sprites
// Pixel-perfect sprite definitions plus a palette-aware
// baker that pre-renders each variant to an offscreen canvas
// so the game loop can drawImage instead of per-pixel fill.
// =========================================================

import trenchletAtlasUrl from "./assets/trenchlet-atlas.png";
import trenchletMeta from "./assets/trenchlet-meta.json";
import foliageAtlasUrl from "./assets/foliage-atlas.png";
import foliageMeta from "./assets/foliage-meta.json";
import buildingsAtlasUrl from "./assets/buildings-atlas.png";
import buildingsMeta from "./assets/buildings-meta.json";
import terrainAtlasUrl from "./assets/terrain-atlas.png";
import terrainMeta from "./assets/terrain-meta.json";
import communityLogoAtlasUrl from "./assets/community-logo-atlas.png";
import communityLogoMeta from "./assets/community-logo-meta.json";

const BASE_PALETTE = {
  ".": null,
  " ": null,
  "0": "#10071d",
  n: "#221033",
  x: "rgba(10,4,20,0.55)",
  s: "#ffd2a3",
  S: "#d99a6a",
  E: "#0a0410",
  p: "#1c1234",
  P: "#0d0620",
  f: "#0a0414",
  b: "#5cff9a",
  B: "#2d9a5f",
  h: "#3d2316",
  H: "#5e3a23",
  G: "#52ff9a",
  g: "#46e08a",
  l: "#ffd84a",
  L: "#fff5b0",
  k: "#10071d",
};

function s(rows) {
  return {
    w: rows[0].length,
    h: rows.length,
    rows,
  };
}

// =========== PILL CHARACTER FRAMES (8x14) ============
// pump.fun mascot inspired pill: colored top, white bottom, two eyes,
// little feet popping out for walk frames.
//
//   c -> primary color (community color)
//   C -> primary color highlight
//   w -> white base
//   W -> white highlight
//   o -> dark outline
//   E -> eye (pure black)
//   m -> mouth (very dark)
//   f -> feet

const CHAR_FRAMES = {
  down: [
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCEccEco",
      "oCcccccC",
      "oCcmmccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "..f..f..",
    ]),
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCEccEco",
      "oCcccccC",
      "oCcmmccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      ".f....f.",
    ]),
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCEccEco",
      "oCcccccC",
      "oCcmmccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "..ff....",
    ]),
  ],
  up: [
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCcccccC",
      "oCcccccC",
      "oCcccccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "..f..f..",
    ]),
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCcccccC",
      "oCcccccC",
      "oCcccccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      ".f....f.",
    ]),
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCcccccC",
      "oCcccccC",
      "oCcccccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "....ff..",
    ]),
  ],
  side: [
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCcEcccC",
      "oCcccmcC",
      "oCcccccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "..f..f..",
    ]),
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCcEcccC",
      "oCcccmcC",
      "oCcccccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "...f.f..",
    ]),
    s([
      "..oCCo..",
      ".oCCCCo.",
      "oCCcCcCo",
      "oCcEcccC",
      "oCcccmcC",
      "oCcccccC",
      "oCcccccC",
      "owWwwwwW",
      "owwwwwwo",
      "owwwwwwo",
      "owwwwwwo",
      ".owwwwo.",
      "..oWWo..",
      "..f.f...",
    ]),
  ],
};

// =========== WORLD OBJECT SPRITES ============

export const OBJ_SPRITES = {
  tree: s([
    "...GGG..",
    "..GGgGG.",
    ".GGgGggG",
    "GgGggGgG",
    "GGgGGggG",
    ".GgGggG.",
    "..GggG..",
    "...hh...",
    "...hh...",
    "...hh...",
    "..hHHh..",
    "..hhhh..",
  ]),
  bush: s([
    ".gggg..",
    "ggGggg.",
    "gGgggGg",
    "ggGggGg",
    ".ggggg.",
  ]),
  lamp: s([
    "..lll..",
    ".lLLLl.",
    ".lLLLl.",
    "..lll..",
    "...0...",
    "...0...",
    "...0...",
    "...0...",
    "...0...",
    "..000..",
  ]),
  flower: s([
    ".lLl.",
    "lLLLl",
    ".lLl.",
    "..g..",
    "..g..",
  ]),
  rock: s([
    "..ggg.",
    ".gGGGg",
    "gGGGGG",
    "gGggGg",
    ".gggg.",
  ]),
  fence_h: s(["bBbBbBbB"]),
  coin: s([
    "..lll..",
    ".lLLLl.",
    "lLlLlLl",
    "lLlLlLl",
    "lLlLlLl",
    ".lLLLl.",
    "..lll..",
  ]),
  sparkle: s([
    "..L..",
    ".LlL.",
    "LlLlL",
    ".LlL.",
    "..L..",
  ]),
};

// =========== LARGE STRUCTURES ============

// Vault: 48x48 (3x3 tiles)
export const VAULT_SPRITE = s([
  "................llllllllllllll..................",
  ".............llllLLLLLLLLLLLLllll................",
  "............lLLLLLLLLLLLLLLLLLLlL...............",
  "...........lLLllllllllllllllllllLL..............",
  "..........lLLl00000000000000000lLLl.............",
  "..........lLl0nnnnnnnnnnnnnnnnn0lLl.............",
  "..........lLl0nLLLLLLLLLLLLLLLn0lLl.............",
  "..........lLl0nLLPPPPPPPPPPPLn0lLl..............",
  "..........lLl0nLLP00000000PLLn0lLl..............",
  "..........lLl0nLLP0nnnnnn0PLLn0lLl..............",
  "..........lLl0nLLP0nLLLLnP0LLn0lLl..............",
  "..........lLl0nLLP0nLLLLnP0LLn0lLl..............",
  "..........lLl0nLLP0nLLLLnP0LLn0lLl..............",
  "..........lLl0nLLP0nnnnnn0PLLn0lLl..............",
  "..........lLl0nLLP00000000PLLn0lLl..............",
  "..........lLl0nLLPPPPPPPPPPPLn0lLl..............",
  "..........lLl0nLLLLLLLLLLLLLLn0lLl..............",
  "..........lLl0nnnnnnnnnnnnnnnnn0lLl.............",
  "..........lLl0nLLLLLLLLLLLLLLn0lLl..............",
  "..........lLl0nnnnnnnnnnnnnnnnn0lLl.............",
  "..........lLLl00000000000000000lLLl.............",
  "...........lLLllllllllllllllllllLLl.............",
  "............lLLLLLLLLLLLLLLLLLLLLLl.............",
  ".............lLLLLLLLLLLLLLLLLLLll..............",
  "..............llllllllllllllllll................",
]);

// Totem: 16x32 (1x2 tiles)
export const TOTEM_SPRITE = s([
  "....bbbb........",
  "...bBBBBb.......",
  "..bBBLBBBb......",
  "..bBLLLBLb......",
  "..bBLLLLBb......",
  "..bBBBBBBb......",
  "..bBLLLLBb......",
  "..bBLBLLBb......",
  "..bBBBBBBb......",
  "...bBBBBb.......",
  "....bbbb........",
  "...0000000......",
  "...0HHHHH0......",
  "...0HHHHH0......",
  "...0HHHHH0......",
  "....000000......",
  "....0LLLL0......",
  "....0LLLL0......",
  "....0LLLL0......",
  "....0LLLL0......",
  "....0LLLL0......",
  "....0LLLL0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....0HHHH0......",
  "....HHHHHH......",
]);

// Billboard (task board): 32x32 (2x2 tiles)
export const BILLBOARD_SPRITE = s([
  "................................",
  ".....BBBBBBBBBBBBBBBBBBBBBB.....",
  "....BHHHHHHHHHHHHHHHHHHHHHHB....",
  "...BHL..................LHB....",
  "...BH...llLLLlllLLLLLll.LHB....",
  "...BH...lLllllllllLllL..LHB....",
  "...BH...llLLLlllLLLLLll.LHB....",
  "...BH...lllllllllllllll.LHB....",
  "...BH...lLLLLLllllLLLLl.LHB....",
  "...BH...lllllllllllllll.LHB....",
  "...BH...lllLLLLLLllllLl.LHB....",
  "...BH...lllllllllllllll.LHB....",
  "...BH...lLLLLllllllllll.LHB....",
  "...BH..................LHB.....",
  "....BHHHHHHHHHHHHHHHHHHHHHHB....",
  ".....BBBBBBBBBBBBBBBBBBBBBB.....",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  ".........H..........H...........",
  "........HHH........HHH..........",
  "........HHH........HHH..........",
  ".......0000000....0000000.......",
  "................................",
  "................................",
  "................................",
  "................................",
]);

// House: 48x40 (3x2 tiles + roof spill)
export const HOUSE_SPRITE = s([
  "........0000000000000000000000..................",
  "......00bbbbbbbbbbbbbbbbbbbbbb00................",
  "....00bbBBBBBBBBBBBBBBBBBBBBBBbb00..............",
  "..00bbBBBBBBBBBBBBBBBBBBBBBBBBBBbb00............",
  "00bbBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBbb00..........",
  "0HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH0..........",
  "0HhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhH0...........",
  "0Hh000000000000000000000000000000hH0............",
  "0Hh0LL000LL00LL0LL000LL00LL000LL00hH0...........",
  "0Hh0LL000LL00LL0LL000LL00LL000LL00hH0...........",
  "0Hh0000000000000000000000000000000hH0...........",
  "0Hh00000000000000000bbb000000000000hH0..........",
  "0Hh00000000000000000bBB000000000000hH0..........",
  "0Hh00000000000000000bBB000000000000hH0..........",
  "0Hh00000000000000000bbb000000000000hH0..........",
  "0Hh0000000000000000000000000000000hH0...........",
  "0HhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhH0...........",
  "0HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH0..........",
  "0HhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhH0...........",
  "0Hh0000000000000000000000000000000hH0...........",
  "0Hh0LL0000000000000000000000000LL0hH0...........",
  "0Hh0LL0000000000000000000000000LL0hH0...........",
  "0Hh0000000000000000000000000000000hH0...........",
  "0Hh0LL0000000000000000000000000LL0hH0...........",
  "0Hh0LL0000000000000000000000000LL0hH0...........",
  "0Hh0000000000000000000000000000000hH0...........",
  "0HhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhhH0...........",
  "0HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH0..........",
]);

// Fountain: 32x24
export const FOUNTAIN_SPRITE = s([
  "................................",
  "............00000000............",
  ".........00bbbbbbbbbb00.........",
  ".......00bBwwwwwwwwBBbb00.......",
  "......0bBwwwWWWWWwwwwBb0........",
  "......0bwwwWWLLWWwwwwBb0........",
  "......0bwwwWWWWWwwwwwbb0........",
  "......0bwwwwWWWwwwwwwbb0........",
  "......0bbwwwwwwwwwwwbb0.........",
  ".......0bbwwwwwwwwbb0...........",
  "........00bbbbbbbb00............",
  "...........00000000.............",
  "...........00000000.............",
  "..........00bbbbbb00............",
  ".........0bBBBBBBBBb0...........",
  ".........0bBBBBBBBBb0...........",
  "..........0bbbbbbbb0............",
  "...........00000000.............",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
  "................................",
]);

// Whale: 80x32
export const WHALE_SPRITE = s([
  "..................................................................GGGGGG.......",
  "...............................................................GGGggggGGG......",
  "............................................................GGGggwwwggGGG......",
  ".........................................................GGGgggwwwwgggGGG......",
  ".......................................................GGggggwwwwLLwggGGG......",
  ".....................................................GGggwgwwwwwwwggwgGGG......",
  "....................................................GGgwgwgwwLLwwwgwggwGG......",
  "...................................................GGwggwgwwwwwwwwwggwwG.......",
  ".................................................GGwgwwgwwwwwwwwwwwgwwGG.......",
  "...............................................GGgwgwwgwwwwwwwwwwwwgwGG........",
  ".............................................GGggwgwwgwwwwwwwwwwwwwGGG.........",
  "...........................................GGgggwwgwwwwwwwwwwwwwwGGG...........",
  "..........................................GGgggwgwwwwwwwwwwwwwwGGG.............",
  ".........................................GGgggwwwwwwwwwwwwwwwGGG...............",
  ".......................................GGgggwwwwwwwwwwwwwwwGGG.................",
  ".....................................GGgggwwwwwwwwwwwwwwGGGG...................",
  "....................................GGgwwwwwwwwwwwwwGGGGG......................",
  "...................................GgwwwwwwwwwwwGGGGG..........................",
  "..................................GwwwwwwwwwGGGGG..............................",
  ".................................GwwwwwwGGGGG..................................",
  "................................GwwwGGGGG......................................",
  "...............................GGGGGGG.........................................",
  "..............................GGGGG............................................",
]);

// =========== BAKER ============

const cache = new Map();

function applyPalette(key, palette) {
  if (key === "." || key === " ") return null;
  if (palette[key] !== undefined) return palette[key];
  if (BASE_PALETTE[key] !== undefined) return BASE_PALETTE[key];
  return null;
}

function bake(sprite, palette) {
  const cnv = document.createElement("canvas");
  cnv.width = sprite.w;
  cnv.height = sprite.h;
  const ctx = cnv.getContext("2d");
  const img = ctx.createImageData(sprite.w, sprite.h);
  for (let y = 0; y < sprite.h; y++) {
    const row = sprite.rows[y];
    for (let x = 0; x < sprite.w; x++) {
      const ch = row[x];
      const color = applyPalette(ch, palette);
      const i = (y * sprite.w + x) * 4;
      if (!color) {
        img.data[i + 3] = 0;
        continue;
      }
      const rgba = parseColor(color);
      img.data[i] = rgba[0];
      img.data[i + 1] = rgba[1];
      img.data[i + 2] = rgba[2];
      img.data[i + 3] = rgba[3];
    }
  }
  ctx.putImageData(img, 0, 0);
  return cnv;
}

function parseColor(value) {
  if (value.startsWith("rgba")) {
    const m = value.match(/rgba\(([^)]+)\)/);
    if (!m) return [255, 255, 255, 255];
    const parts = m[1].split(",").map((p) => parseFloat(p.trim()));
    return [parts[0], parts[1], parts[2], Math.round(parts[3] * 255)];
  }
  const hex = value.replace("#", "");
  const full = hex.length === 3
    ? hex.split("").map((c) => c + c).join("")
    : hex;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
    255,
  ];
}

export function getBaked(name, palette, getSprite) {
  const key = `${name}|${JSON.stringify(palette)}`;
  if (!cache.has(key)) {
    const sprite = typeof getSprite === "function" ? getSprite() : getSprite;
    cache.set(key, bake(sprite, palette));
  }
  return cache.get(key);
}

export function bakeCharacter(palette) {
  const result = { down: [], up: [], side: [] };
  for (const dir of /** @type {const} */ (["down", "up", "side"])) {
    for (let frame = 0; frame < CHAR_FRAMES[dir].length; frame++) {
      result[dir].push(bake(CHAR_FRAMES[dir][frame], palette));
    }
  }
  return result;
}

export function makeCharacterPalette(community, hair, skin) {
  // Pill palette. `community.color` is the pill top color, white bottom.
  // Hair/skin args kept for compatibility but unused on pill chars.
  const tone = hair?.base || "#1a0d2a";
  void skin;
  void tone;
  return {
    "0": "#06120b",
    o: "#06120b",
    c: community.color,
    C: lighten(community.color, 0.22),
    w: "#f6fffa",
    W: "#cfeedb",
    E: "#000000",
    m: "#06120b",
    f: "#06120b",
    n: "#06120b",
    x: "rgba(6,18,11,0.45)",
    G: "#52ff9a",
    g: "#2c9a5a",
    l: "#ffd84a",
    L: "#fff7c2",
    k: "#06120b",
    b: community.body,
    B: community.bodyShade,
    h: "#06120b",
    H: "#0c1d12",
    s: "#f6fffa",
    S: "#cfeedb",
    p: "#06120b",
    P: "#06120b",
  };
}

function lighten(hex, t) {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * t));
  const lg = Math.min(255, Math.round(g + (255 - g) * t));
  const lb = Math.min(255, Math.round(b + (255 - b) * t));
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

export const HAIR_COLORS = [
  { base: "#2b1a14", shade: "#4a2e22" },
  { base: "#7e3a16", shade: "#a5572b" },
  { base: "#d9b15a", shade: "#f1cf85" },
  { base: "#7a1f6c", shade: "#a83ea1" },
  { base: "#1c2e7a", shade: "#3b51b3" },
  { base: "#114a4a", shade: "#1e7b7b" },
  { base: "#6a6a6a", shade: "#9a9a9a" },
  { base: "#e6e6f0", shade: "#bfbfd0" },
];

export const SKIN_TONES = [
  { base: "#ffd4a3", shade: "#c79c66" },
  { base: "#f0b486", shade: "#b07a52" },
  { base: "#caa07b", shade: "#8d6a4f" },
  { base: "#8e6541", shade: "#5d3f23" },
  { base: "#5b3d24", shade: "#3a2412" },
];

export const OBJECT_PALETTE_BASE = {
  G: "#5cff9a",
  g: "#2c9a5a",
  h: "#3b2316",
  H: "#5e3a23",
  l: "#ffd84a",
  L: "#fff7c2",
  b: "#62402a",
  B: "#3a2516",
  P: "#1a0a14",
  w: "#2acaff",
  W: "#aef3ff",
  "0": "#0a0414",
};

export function spriteDef(rows) {
  return s(rows);
}

export function getCharSprite(dir, frame, palette) {
  const def = CHAR_FRAMES[dir][frame];
  return getBaked(`char_${dir}_${frame}`, palette, () => def);
}

// =========== HOUSE LOGO SPRITES (12x12) ============
// Tiny pixel logo per house. `c` = house color, `C` = lighter, `o` = outline,
// `w` = white, `e` = eye/black, `r` = red accent, `y` = yellow accent.
export const HOUSE_LOGOS = {
  // $TripleT — three drum heads stacked
  triplet: s([
    "...oooo.....",
    "..oCCCCo....",
    ".oCccccCo...",
    "oCccCccCCo..",
    "oCccCccCCo..",
    "oCccCccCCo..",
    "oCccCccCCo..",
    ".oCccccCo...",
    "..oCCCCo....",
    "...oooo.....",
    "....oo......",
    "............",
  ]),
  // $Troll — troll grin face
  troll: s([
    "...oooooo...",
    "..oCCCCCCo..",
    ".oCcccccCo..",
    "oCcececcCo..",
    "oCcccccccCo.",
    "oCwwwwwwwCo.",
    "oCwooooowCo.",
    "oCwoeeeowCo.",
    ".oCwwwwwCo..",
    "..oCCCCCo...",
    "...oooooo...",
    "............",
  ]),
  // $Chillhouse — chill house with sunglasses
  chillhouse: s([
    ".....o......",
    "....oCo.....",
    "...oCCCo....",
    "..oCCCCCo...",
    ".oCCCCCCCo..",
    "oooooooooo..",
    "oCccCCCccCo.",
    "oCeeoCoeeCo.",
    "oCccCCCccCo.",
    "oCccccCCccCo",
    "oCcCCcoCCCCo",
    ".oooooooooo.",
  ]),
  // $unc — bald head with mustache
  unc: s([
    "...oCCCo....",
    "..oCccCCo...",
    ".oCccccCCo..",
    "oCccCcCcCCo.",
    "oCceCccecCo.",
    "oCcccwccccCo",
    "oCccwwwwcCCo",
    "oCcoooooocCo",
    ".oCcccccCo..",
    "..oCCCCCo...",
    "...oooo.....",
    "............",
  ]),
  // $NEET — bed with Z
  neet: s([
    "............",
    "...oeeo.....",
    "..oeeo......",
    "..ee........",
    "..oo........",
    ".oeeo.......",
    "oCCCCCCCCCCo",
    "oCwwwwwwwwCo",
    "oCwwwwwwwwCo",
    "oCccccccccCo",
    "oooooooooooo",
    "o..........o",
  ]),
  // $BURNIE — bonfire flame
  burnie: s([
    "....oo......",
    "...oCCo.....",
    "..oCCCCo....",
    ".oCyycyCo...",
    "oCyycccyCo..",
    "oCyccccycCo.",
    "oCyyyyyycCo.",
    "oCyyyyyyCCo.",
    ".oCyyyyCCo..",
    "..oCCCCCo...",
    ".oooooooooo.",
    "ooooooooooo.",
  ]),
  // $我的刀盾 (WTDD) — dog face
  wtdd: s([
    "..o......o..",
    ".oCo....oCo.",
    "oCcCo..oCcCo",
    "oCccCooCccCo",
    ".oCcccccccCo",
    ".oCcecccecCo",
    ".oCcccwcccCo",
    ".oCcwwwwwcCo",
    ".oCccwwwccCo",
    "..oCcoocccCo",
    "...oCCCCCCo.",
    "....oooooo..",
  ]),
  // $Buttcoin — peach with leaf
  buttcoin: s([
    ".....yy.....",
    "....yyo.....",
    "...yyo......",
    "..oCCoCCo...",
    ".oCcccccCo..",
    "oCccccccCCo.",
    "oCccoccoccCo",
    "oCccoCcoccCo",
    "oCcccccccCCo",
    ".oCcccccCo..",
    "..oCCCCCo...",
    "...oooo.....",
  ]),
  // $Wojak — sad bald face
  wojak: s([
    "...oCCCo....",
    "..oCccccCo..",
    ".oCcccccCCo.",
    "oCccccccccCo",
    "oCceccccecCo",
    "oCccccccccCo",
    "oCccwccccCCo",
    "oCcwccccwcCo",
    "oCccwwwwwcCo",
    ".oCccccccCo.",
    "..oCCCCCCCo.",
    "...oooooo...",
  ]),
  // $Fartcoin — fart cloud with sparkles
  fartcoin: s([
    "....oCCo....",
    "..oCCCCCo...",
    ".oCccccccCo.",
    "oCccCccccCCo",
    "oCcccccCccCo",
    "oCccCcccccCo",
    "oCcccccCccCo",
    ".oCccccccCo.",
    "..oCCCCCCo..",
    "..g.g.g.g...",
    "...g.g.g....",
    "............",
  ]),
};

export function logoSpriteFor(houseId) {
  return HOUSE_LOGOS[houseId] || null;
}

export function makeLogoPalette(community) {
  return {
    "0": "#06120b",
    o: "#06120b",
    c: community.body,
    C: community.color,
    w: "#f6fffa",
    e: "#000000",
    y: "#ffd84a",
    r: "#ff5238",
    g: "#9d6bff",
  };
}


// =========================================================
// HD-2D HIGH-RES PROCEDURAL ASSETS
// =========================================================
// These go beyond the small ASCII grids above. Each asset is
// painted per-pixel into an offscreen canvas with a multi-shade
// palette, directional (top-left) lighting, soft AA rim, and a
// seeded sprinkle of darker/lighter pixels for the painterly
// "brush stroke" feel of HD-2D / Octopath / Stardew-painterly art.
// Variants are baked once at startup and cached.

// HD pixel density multiplier for procedural builders. Bumping this paints
// each authored "logical" pixel as DENSITY×DENSITY actual pixels on the
// baked canvas, lighting up real HD detail rather than nearest-neighbor
// upscaling. The engine's drawHD() helper blits these dense canvases at
// logical sizes for native HD output.
export const HD_DENSITY = 2;

function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRgb(hex) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(f.slice(0, 2), 16),
    parseInt(f.slice(2, 4), 16),
    parseInt(f.slice(4, 6), 16),
  ];
}

// Tiny pixel-painter wrapper. Operates on raw ImageData for speed.
// Allocates a (W*HD_DENSITY)×(H*HD_DENSITY) canvas internally so every
// authored pixel becomes a HD_DENSITY×HD_DENSITY block of HD pixels —
// the asset is rendered at native HD resolution while builder code keeps
// using logical coordinates. set(x, y, ...) fills the whole block.
function makePainter(W, H) {
  const D = HD_DENSITY;
  const PW = W * D;
  const PH = H * D;
  const cnv = document.createElement("canvas");
  cnv.width = PW;
  cnv.height = PH;
  const ctx = cnv.getContext("2d");
  const img = ctx.createImageData(PW, PH);
  const data = img.data;
  function setPixel(px, py, r, g, b, a) {
    if (px < 0 || py < 0 || px >= PW || py >= PH) return;
    const i = (py * PW + px) * 4;
    if (a >= 255 || data[i + 3] === 0) {
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = a;
      return;
    }
    const aa = a / 255;
    data[i] = Math.round(data[i] * (1 - aa) + r * aa);
    data[i + 1] = Math.round(data[i + 1] * (1 - aa) + g * aa);
    data[i + 2] = Math.round(data[i + 2] * (1 - aa) + b * aa);
    if (a > data[i + 3]) data[i + 3] = a;
  }
  function set(x, y, hex, alpha = 255) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const [r, g, b] = hexRgb(hex);
    const px0 = x * D;
    const py0 = y * D;
    for (let dy = 0; dy < D; dy++) {
      for (let dx = 0; dx < D; dx++) {
        setPixel(px0 + dx, py0 + dy, r, g, b, alpha);
      }
    }
  }
  function getA(x, y) {
    if (x < 0 || y < 0 || x >= W || y >= H) return 0;
    return data[(y * D * PW + x * D) * 4 + 3];
  }
  function darken(x, y, factor) {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const px0 = x * D;
    const py0 = y * D;
    for (let dy = 0; dy < D; dy++) {
      for (let dx = 0; dx < D; dx++) {
        const i = ((py0 + dy) * PW + (px0 + dx)) * 4;
        if (data[i + 3] === 0) continue;
        data[i] = Math.round(data[i] * factor);
        data[i + 1] = Math.round(data[i + 1] * factor);
        data[i + 2] = Math.round(data[i + 2] * factor);
      }
    }
  }
  function commit() {
    ctx.putImageData(img, 0, 0);
    return cnv;
  }
  // Logical authored width/height — engine calls drawHD with these.
  return { set, getA, darken, commit, W, H };
}

// =========== HD TREE ============
// 64x80 apple tree, 3-lobe canopy, painted greens, three apples,
// trunk with bark texture, grass tuft base.

const HD_TREE_W = 64;
const HD_TREE_H = 80;
const HD_TREE_FOOT_X = 32;
const HD_TREE_FOOT_Y = 78;
const HD_TREE_VARIANT_COUNT = 4;

const TREE_LEAF_SHADES = [
  "#0f2810", // 0 — deep shadow
  "#1c3d1c", // 1
  "#2c5524", // 2 — base
  "#3e7a30", // 3
  "#56a13d", // 4
  "#74c54a", // 5 — bright
];
const TREE_RIM = "#0a1808";
const TREE_TRUNK_RIM = "#180a04";
const TREE_TRUNK_DARK = "#2c1a0e";
const TREE_TRUNK_MID = "#4a2e18";
const TREE_TRUNK_LIGHT = "#6a4528";
const TREE_TRUNK_HL = "#8a5e36";
const APPLE_DARK = "#5a0e10";
const APPLE_MID = "#9e1818";
const APPLE_LIGHT = "#cf2828";
const APPLE_SPEC = "#ffb0a0";
const APPLE_STEM = "#241408";
const TUFT_DARK = "#1f3d1a";
const TUFT_MID = "#3e7a30";
const TUFT_LIGHT = "#74c54a";

function paintCanopyLobe(p, rng, cx, cy, rx, ry) {
  for (let y = -ry - 2; y <= ry + 2; y++) {
    for (let x = -rx - 2; x <= rx + 2; x++) {
      const norm = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      const px = cx + x;
      const py = cy + y;
      if (norm <= 1) {
        // light direction: top-left brighter
        const lit = (-x / rx + -y / ry) * 0.5;
        let idx;
        if (lit > 0.55) idx = 5;
        else if (lit > 0.25) idx = 4;
        else if (lit > -0.05) idx = 3;
        else if (lit > -0.35) idx = 2;
        else idx = 1;
        // painterly noise
        const n = rng();
        if (n < 0.16) idx = Math.max(0, idx - 1);
        else if (n > 0.84) idx = Math.min(TREE_LEAF_SHADES.length - 1, idx + 1);
        p.set(px, py, TREE_LEAF_SHADES[idx]);
      } else if (norm <= 1.18 && p.getA(px, py) === 0) {
        // soft AA rim
        if (rng() < 0.6) p.set(px, py, TREE_RIM, 220);
      }
    }
  }
}

function paintApple(p, rng, cx, cy) {
  // soft cast shadow into canopy beneath the fruit
  for (let dy = 0; dy <= 5; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx * dx + dy * dy <= 18) p.darken(cx + dx, cy + dy + 3, 0.78);
    }
  }
  const ar = 4;
  for (let dy = -ar; dy <= ar; dy++) {
    for (let dx = -ar; dx <= ar; dx++) {
      const dd = dx * dx + dy * dy;
      if (dd > ar * ar + 1) continue;
      let color = APPLE_MID;
      if (dx <= 0 && dy <= -1 && dd <= 8) color = APPLE_LIGHT;
      if (dx > 1 && dy > 0) color = APPLE_DARK;
      if (dd >= ar * ar - 1) color = APPLE_DARK;
      p.set(cx + dx, cy + dy, color);
    }
  }
  // specular highlight
  p.set(cx - 2, cy - 2, APPLE_SPEC);
  p.set(cx - 1, cy - 2, APPLE_SPEC);
  p.set(cx - 2, cy - 1, APPLE_SPEC);
  // stem
  p.set(cx, cy - 4, APPLE_STEM);
  p.set(cx, cy - 5, APPLE_STEM);
  p.set(cx + 1, cy - 5, APPLE_STEM);
  void rng;
}

export function buildTreeCanvas(seed) {
  const p = makePainter(HD_TREE_W, HD_TREE_H);
  const rng = mulberry32((seed | 0) * 9301 + 49297);

  // 3-lobe canopy + a centre filler lobe to merge silhouettes
  paintCanopyLobe(p, rng, 32, 18, 18, 16); // top
  paintCanopyLobe(p, rng, 18, 30, 16, 14); // lower-left
  paintCanopyLobe(p, rng, 46, 30, 16, 14); // lower-right
  paintCanopyLobe(p, rng, 32, 30, 18, 14); // mid filler

  // canopy bottom shadow band where leaves meet trunk
  for (let x = 12; x <= 52; x++) {
    for (let y = 40; y <= 46; y++) {
      if (p.getA(x, y) > 0 && rng() < 0.55) p.darken(x, y, 0.78);
    }
  }

  // Trunk — cylindrical shading with bark streaks
  const tx0 = 27;
  const tx1 = 36;
  const tyTop = 40;
  const tyBot = 76;
  for (let y = tyTop; y < tyBot; y++) {
    const flare = Math.max(0, Math.floor((y - 62) / 3));
    const x0 = tx0 - flare;
    const x1 = tx1 + flare;
    const w = Math.max(1, x1 - x0);
    for (let x = x0; x <= x1; x++) {
      const r = (x - x0) / w;
      let color;
      if (r < 0.18) color = TREE_TRUNK_LIGHT;
      else if (r < 0.45) color = TREE_TRUNK_MID;
      else if (r < 0.85) color = TREE_TRUNK_DARK;
      else color = TREE_TRUNK_RIM;
      const n = rng();
      if (n < 0.1) color = TREE_TRUNK_DARK;
      else if (n > 0.93) color = TREE_TRUNK_HL;
      p.set(x, y, color);
    }
  }
  // bark vertical streaks
  for (let i = 0; i < 18; i++) {
    const sx = tx0 + 1 + Math.floor(rng() * (tx1 - tx0 - 1));
    const sy = tyTop + 2 + Math.floor(rng() * (tyBot - tyTop - 6));
    const len = 2 + Math.floor(rng() * 3);
    for (let k = 0; k < len; k++) p.set(sx, sy + k, TREE_TRUNK_DARK);
  }
  // root flare nubs
  p.set(24, 73, TREE_TRUNK_DARK);
  p.set(25, 74, TREE_TRUNK_MID);
  p.set(24, 74, TREE_TRUNK_RIM);
  p.set(39, 73, TREE_TRUNK_DARK);
  p.set(38, 74, TREE_TRUNK_MID);
  p.set(39, 74, TREE_TRUNK_RIM);

  // Three apples — slightly jittered per seed so each variant looks unique
  const appleSpots = [
    [32 + Math.floor(rng() * 5 - 2), 22 + Math.floor(rng() * 3 - 1)],
    [17 + Math.floor(rng() * 5 - 2), 30 + Math.floor(rng() * 3 - 1)],
    [44 + Math.floor(rng() * 5 - 2), 32 + Math.floor(rng() * 3 - 1)],
  ];
  for (const [ax, ay] of appleSpots) paintApple(p, rng, ax, ay);

  // Grass tuft base — flat ellipse, painterly noise, blade tips
  const baseCX = 32;
  const baseCY = 76;
  for (let y = 70; y <= 79; y++) {
    for (let x = 14; x <= 50; x++) {
      const dx = x - baseCX;
      const dy = y - baseCY;
      const norm = (dx * dx) / (18 * 18) + (dy * dy) / (4 * 4);
      if (norm > 1) continue;
      // skip pure trunk interior
      if (x >= tx0 - 1 && x <= tx1 + 1 && y >= 68 && y < 75) continue;
      let color = TUFT_MID;
      const n = rng();
      if (n < 0.22) color = TUFT_DARK;
      else if (n > 0.72) color = TUFT_LIGHT;
      p.set(x, y, color);
    }
  }
  // grass blade tips poking up
  for (let i = 0; i < 14; i++) {
    const x = 15 + Math.floor(rng() * 34);
    const y = 71 + Math.floor(rng() * 2);
    p.set(x, y, TUFT_LIGHT);
    p.set(x, y + 1, TUFT_MID);
  }

  return p.commit();
}

const treeVariantCache = new Map();

export function getTreeVariant(idx) {
  const k = (((idx | 0) % HD_TREE_VARIANT_COUNT) + HD_TREE_VARIANT_COUNT) % HD_TREE_VARIANT_COUNT;
  if (!treeVariantCache.has(k)) {
    treeVariantCache.set(k, buildTreeCanvas(k + 1));
  }
  return treeVariantCache.get(k);
}

export const HD_TREE = {
  W: HD_TREE_W,
  H: HD_TREE_H,
  footX: HD_TREE_FOOT_X,
  footY: HD_TREE_FOOT_Y,
  variants: HD_TREE_VARIANT_COUNT,
};


// =========================================================
// HD TRENCHLET CHARACTER
// =========================================================
// Chibi blob with explorer hat, big sparkle eyes, stubby arms,
// brown boots that swap to fake a walk cycle. Built procedurally
// so we can reuse the same baker for the player + every NPC, and
// recolor per community via the existing character palette.

const HD_CHAR_W = 36;
const HD_CHAR_H = 42;
const HD_CHAR_BAKED_W = 36;
const HD_CHAR_BAKED_H = 42;

// Palette keys we read from the existing character palette so this rig
// works for the player and every community-recolored NPC for free.
function trenchletColors(palette) {
  // Body skin: warm tan. The community color tints the hat band and a
  // shoulder shadow so each trench reads slightly different.
  const accent = palette.c || "#1ec77d";
  const accentDark = palette.C || accent;
  return {
    skinHL: "#f0d4a3", // top-left lit skin
    skinMid: "#d4a86a", // base
    skinShade: "#a07a44", // bottom-right shadow
    skinDark: "#5c401e",
    skinRim: "#2a1808",
    bootHL: "#7a4a26",
    bootMid: "#4a2a14",
    bootDark: "#28140a",
    eyeWhite: "#fff5e6",
    eyeDark: "#1a0e08",
    mouth: "#3a2010",
    hatHL: "#c9a062",
    hatMid: "#8a6a3c",
    hatShade: "#5a4424",
    hatRim: "#241808",
    accent,
    accentDark,
  };
}

function fillEllipse(p, cx, cy, rx, ry, color) {
  for (let y = -Math.ceil(ry); y <= Math.ceil(ry); y++) {
    for (let x = -Math.ceil(rx); x <= Math.ceil(rx); x++) {
      if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) {
        p.set(cx + x, cy + y, color);
      }
    }
  }
}

function ellipseNorm(x, y, cx, cy, rx, ry) {
  return ((x - cx) * (x - cx)) / (rx * rx) + ((y - cy) * (y - cy)) / (ry * ry);
}

function paintBoot(p, c, x, y, dir, lift = 0) {
  const yy = y + lift;
  const forward = dir === "side";
  const w = forward ? 5 : 4;
  const h = 4;
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const edge = px === 0 || px === w - 1 || py === h - 1;
      p.set(x + px, yy + py, edge ? c.bootDark : py === 0 ? c.bootHL : c.bootMid);
    }
  }
  if (forward) p.set(x + w, yy + h - 2, c.bootDark);
}

function paintEye(p, c, x, y, side = false) {
  const w = side ? 3 : 4;
  for (let py = 0; py < 5; py++) {
    for (let px = 0; px < w; px++) {
      p.set(x + px, y + py, c.eyeDark);
    }
  }
  p.set(x + 1, y + 1, c.eyeWhite);
  if (!side) p.set(x + 2, y + 1, "#6b5b74");
}

function buildTrenchletFrame(palette, dir, frame) {
  const c = trenchletColors(palette);
  const p = makePainter(HD_CHAR_BAKED_W, HD_CHAR_BAKED_H);
  const bob = frame === 1 || frame === 3 ? -1 : 0;
  const side = dir === "side";
  const bodyCx = side ? 18 : 18;
  const bodyCy = 25 + bob;
  const bodyRx = side ? 8 : 10;
  const bodyRy = 13;

  for (let y = 10 + bob; y <= 37 + bob; y++) {
    for (let x = 5; x <= 31; x++) {
      const n = ellipseNorm(x, y, bodyCx, bodyCy, bodyRx, bodyRy);
      if (n > 1.12) continue;
      let color = c.skinRim;
      if (n <= 1) {
        const lit = 1 - ((x - (bodyCx - bodyRx)) / (bodyRx * 2)) * 0.45 - ((y - (bodyCy - bodyRy)) / (bodyRy * 2)) * 0.5;
        if (lit > 0.72) color = c.skinHL;
        else if (lit > 0.47) color = c.skinMid;
        else if (lit > 0.24) color = c.skinShade;
        else color = c.skinDark;
        if (n > 0.84) color = c.skinRim;
        if (((x * 5 + y * 7) & 15) === 0 && n < 0.82) color = lit > 0.5 ? "#e4bd7d" : "#bd8f51";
      }
      p.set(x, y, color);
    }
  }

  const armSwing = frame === 1 ? -1 : frame === 3 ? 1 : 0;
  if (side) {
    fillEllipse(p, 10, 25 + bob - armSwing, 2.2, 5, c.skinRim);
    fillEllipse(p, 11, 24 + bob - armSwing, 2, 4, c.skinShade);
    p.set(10, 21 + bob - armSwing, c.skinHL);
  } else {
    fillEllipse(p, 7, 25 + bob + armSwing, 2.3, 5, c.skinRim);
    fillEllipse(p, 8, 24 + bob + armSwing, 2, 4, c.skinMid);
    fillEllipse(p, 29, 25 + bob - armSwing, 2.3, 5, c.skinRim);
    fillEllipse(p, 28, 24 + bob - armSwing, 2, 4, c.skinShade);
  }

  const leftLift = frame === 1 ? -2 : frame === 3 ? 1 : 0;
  const rightLift = frame === 3 ? -2 : frame === 1 ? 1 : 0;
  if (side) {
    paintBoot(p, c, 13 + (frame === 1 ? 1 : 0), 35, dir, rightLift);
    paintBoot(p, c, 19 + (frame === 3 ? 1 : 0), 35, dir, leftLift);
  } else {
    paintBoot(p, c, 12, 35, dir, leftLift);
    paintBoot(p, c, 20, 35, dir, rightLift);
  }

  if (dir !== "up") {
    if (side) {
      paintEye(p, c, 21, 20 + bob, true);
      p.set(20, 26 + bob, c.mouth);
      p.set(21, 26 + bob, c.mouth);
    } else {
      paintEye(p, c, 11, 20 + bob);
      paintEye(p, c, 22, 20 + bob);
      p.set(17, 27 + bob, c.mouth);
      p.set(18, 28 + bob, c.mouth);
      p.set(19, 28 + bob, c.mouth);
      p.set(20, 27 + bob, c.mouth);
    }
  } else {
    for (let x = 10; x <= 26; x++) {
      if ((x & 1) === 0) p.set(x, 21 + bob, c.skinShade);
    }
  }

  const hatCx = side ? 19 : 18;
  const hatCy = 10 + bob;
  for (let y = 3 + bob; y <= 14 + bob; y++) {
    for (let x = 7; x <= 29; x++) {
      const n = ellipseNorm(x, y, hatCx, hatCy, side ? 8 : 9, 7);
      if (n > 1.08 || y > 13 + bob) continue;
      let color = c.hatRim;
      if (n <= 1) {
        const lit = 1 - ((x - 8) / 20) * 0.35 - ((y - (3 + bob)) / 11) * 0.62;
        color = lit > 0.73 ? c.hatHL : lit > 0.43 ? c.hatMid : c.hatShade;
        if (n > 0.88) color = c.hatRim;
        if (((x * 3 + y * 11) & 13) === 0 && n < 0.82) color = c.hatShade;
      }
      p.set(x, y, color);
    }
  }
  for (let x = 5; x <= 31; x++) {
    p.set(x, 14 + bob, c.hatRim);
    if (x >= 6 && x <= 30) p.set(x, 13 + bob, x < 14 ? c.hatHL : x < 24 ? c.hatMid : c.hatShade);
  }
  for (let x = 9; x <= 27; x++) p.set(x, 12 + bob, x < 21 ? c.accentDark : c.hatShade);
  p.set(11, 5 + bob, "#f4dda7");
  p.set(12, 5 + bob, "#f4dda7");
  p.set(10, 6 + bob, c.hatHL);
  p.set(11, 7 + bob, c.hatHL);

  return p.commit();
}
const hdCharCache = new Map();

export function bakeCharacterHD(palette) {
  // Cache key built from the bits of palette that actually affect the sprite.
  const k = `${palette.c || ""}|${palette.C || ""}`;
  if (hdCharCache.has(k)) return hdCharCache.get(k);
  const result = { down: [], up: [], side: [] };
  for (const dir of ["down", "up", "side"]) {
    for (let f = 0; f < 4; f++) {
      result[dir].push(buildTrenchletFrame(palette, dir, f));
    }
  }
  hdCharCache.set(k, result);
  return result;
}

export const HD_CHAR = {
  W: HD_CHAR_BAKED_W,
  H: HD_CHAR_BAKED_H,
  footX: 18,
  footY: 39,
  frameCount: 4,
};

// =========================================================
// GENERATED ATLAS ASSETS
// =========================================================

const generatedAtlases = {
  trenchlet: { url: trenchletAtlasUrl, meta: trenchletMeta },
  foliage: { url: foliageAtlasUrl, meta: foliageMeta },
  buildings: { url: buildingsAtlasUrl, meta: buildingsMeta },
  terrain: { url: terrainAtlasUrl, meta: terrainMeta },
  communityLogos: { url: communityLogoAtlasUrl, meta: communityLogoMeta },
};

const generatedImageCache = new Map();

function loadGeneratedImage(name) {
  const atlas = generatedAtlases[name];
  if (!atlas) return null;
  if (!generatedImageCache.has(name)) {
    const image = new Image();
    const record = { image, ready: false };
    image.decoding = "async";
    image.onload = () => {
      record.ready = true;
    };
    image.src = atlas.url;
    generatedImageCache.set(name, record);
  }
  const record = generatedImageCache.get(name);
  return record.ready ? record.image : null;
}

export const TRENCHLET_ATLAS = trenchletMeta;

export function getTrenchletAtlasImage() {
  return loadGeneratedImage("trenchlet");
}

export function getTrenchletAtlasFrame(dir, frame) {
  const row = TRENCHLET_ATLAS.rowsByDir[dir] ?? TRENCHLET_ATLAS.rowsByDir.down;
  const col = Math.max(0, Math.min(TRENCHLET_ATLAS.cols - 1, frame | 0));
  return {
    x: col * TRENCHLET_ATLAS.cell,
    y: row * TRENCHLET_ATLAS.cell,
    w: TRENCHLET_ATLAS.cell,
    h: TRENCHLET_ATLAS.cell,
  };
}

export function getGeneratedAtlasImage(name) {
  return loadGeneratedImage(name);
}

export function getGeneratedFrame(atlasName, frameName) {
  return generatedAtlases[atlasName]?.meta?.[frameName] || null;
}


// =========================================================
// HD VAULT (stone cave with iron-bar gate over glowing gold)
// =========================================================

const HD_VAULT_W = 96;
const HD_VAULT_H = 80;

const VAULT_STONE_HL = "#9a9a8e";
const VAULT_STONE_MID = "#6e6e62";
const VAULT_STONE_SHADE = "#4a4a3e";
const VAULT_STONE_DARK = "#2c2c24";
const VAULT_STONE_RIM = "#1a1a14";
const VAULT_GROUND_DIRT = "#3a3528";
const VAULT_GRASS_DARK = "#1f3d1a";
const VAULT_GRASS_MID = "#3e7a30";
const VAULT_GRASS_LIGHT = "#74c54a";
const VAULT_BAR_DARK = "#1a1a1a";
const VAULT_BAR_MID = "#3a3a3a";
const VAULT_BAR_HL = "#6a6a6a";
const VAULT_GOLD_DARK = "#7a4a08";
const VAULT_GOLD_MID = "#d49018";
const VAULT_GOLD_LIGHT = "#fbd84a";
const VAULT_GOLD_GLOW = "#fff3b8";
const VAULT_INTERIOR = "#0a0500";

function paintVaultStone(p, rng) {
  // Big rounded boulder silhouette. Wider at the base, peaks slightly off-center.
  // Footprint: x = 6..89, y = 14..62 (then grass at 62..70).
  const cx = 48;
  const baseY = 62;
  const peakY = 14;
  for (let y = peakY; y <= baseY; y++) {
    const t = (y - peakY) / (baseY - peakY);
    // Width grows from 14 at peak to 38 at base (rounded shoulders).
    const half = Math.round(14 + Math.sin(t * Math.PI * 0.55) * 30);
    const xL = cx - half;
    const xR = cx + half;
    for (let x = xL; x <= xR; x++) {
      const dx = (x - cx) / half;
      // Lighting: top-left bright, bottom-right shadow.
      const lit = 1 - (dx * 0.45 + t * 0.5);
      let color;
      if (lit > 0.85) color = VAULT_STONE_HL;
      else if (lit > 0.55) color = VAULT_STONE_MID;
      else if (lit > 0.3) color = VAULT_STONE_SHADE;
      else color = VAULT_STONE_DARK;
      // Rocky noise (paint chunky 2x2 patches so it reads as carved stone).
      if (((x ^ y) & 3) === 0 && rng() < 0.18) {
        color = VAULT_STONE_DARK;
      }
      p.set(x, y, color);
    }
    // Outline
    p.set(xL - 1, y, VAULT_STONE_RIM);
    p.set(xR + 1, y, VAULT_STONE_RIM);
  }
  // Top cap rim
  for (let x = cx - 14; x <= cx + 14; x++) {
    if (p.getA(x, peakY) > 0 && p.getA(x, peakY - 1) === 0) {
      p.set(x, peakY - 1, VAULT_STONE_RIM);
    }
  }

  // Carved cracks and seams — chunky dark lines following the rock contour.
  const cracks = [
    [22, 22, 30, 26],
    [60, 18, 70, 24],
    [38, 32, 48, 36],
    [68, 38, 78, 44],
    [18, 44, 28, 48],
    [54, 50, 66, 54],
  ];
  for (const [x0, y0, x1, y1] of cracks) {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = Math.round(x0 + (x1 - x0) * t + (rng() - 0.5));
      const y = Math.round(y0 + (y1 - y0) * t + (rng() - 0.5));
      if (p.getA(x, y) > 0) {
        p.set(x, y, VAULT_STONE_DARK);
        if (rng() < 0.4 && p.getA(x, y + 1) > 0) p.set(x, y + 1, VAULT_STONE_RIM);
      }
    }
  }

  // Plate highlights — small light pixels on top edges of "boulders"
  for (let i = 0; i < 60; i++) {
    const x = 14 + Math.floor(rng() * 68);
    const y = 16 + Math.floor(rng() * 30);
    if (p.getA(x, y) > 0 && p.getA(x, y - 1) === 0) {
      p.set(x, y, VAULT_STONE_HL);
    }
  }
}

function paintVaultArch(p) {
  // Hollow out an arched gate centered horizontally.
  const archCX = 48;
  const archTop = 30;
  const archBot = 60;
  const archHalfW = 13;
  const archHalfH = (archBot - archTop) / 2;
  const archCY = (archTop + archBot) / 2;
  for (let y = archTop; y <= archBot; y++) {
    for (let x = archCX - archHalfW; x <= archCX + archHalfW; x++) {
      const dx = x - archCX;
      const dyTop = y - archCY;
      // Rounded arch: full ellipse for top half, straight sides for bottom.
      let inside;
      if (y < archCY) {
        inside =
          (dx * dx) / (archHalfW * archHalfW) +
            (dyTop * dyTop) / (archHalfH * archHalfH) <=
          1;
      } else {
        inside = Math.abs(dx) <= archHalfW - 1;
      }
      if (inside) {
        p.set(x, y, VAULT_INTERIOR);
      }
    }
  }
  // Arch rim — darker stone band hugging the opening.
  for (let y = archTop - 1; y <= archBot; y++) {
    for (let x = archCX - archHalfW - 2; x <= archCX + archHalfW + 2; x++) {
      const dx = x - archCX;
      const dyTop = y - archCY;
      let onRim = false;
      if (y < archCY) {
        const norm =
          (dx * dx) / ((archHalfW + 2) * (archHalfW + 2)) +
          (dyTop * dyTop) / ((archHalfH + 2) * (archHalfH + 2));
        const innerNorm =
          (dx * dx) / (archHalfW * archHalfW) + (dyTop * dyTop) / (archHalfH * archHalfH);
        if (norm <= 1 && innerNorm > 1) onRim = true;
      } else {
        if (Math.abs(dx) >= archHalfW - 1 && Math.abs(dx) <= archHalfW + 2) onRim = true;
      }
      if (onRim && p.getA(x, y) > 0 && (x < archCX - archHalfW + 1 || x > archCX + archHalfW - 1 || y < archTop + 1)) {
        p.set(x, y, VAULT_STONE_DARK);
      }
    }
  }
}

function paintVaultGold(p, rng) {
  // Gold pile inside the arch, glowing brightest near top.
  const archCX = 48;
  const goldTop = 38;
  const goldBot = 59;
  const archHalfW = 12;
  for (let y = goldTop; y <= goldBot; y++) {
    const t = (y - goldTop) / (goldBot - goldTop);
    const half = Math.round(archHalfW - Math.abs(t - 0.5) * 4);
    for (let x = archCX - half; x <= archCX + half; x++) {
      const lit = 1 - t * 0.6 - (Math.abs(x - archCX) / half) * 0.3;
      let color;
      if (lit > 0.85) color = VAULT_GOLD_GLOW;
      else if (lit > 0.6) color = VAULT_GOLD_LIGHT;
      else if (lit > 0.35) color = VAULT_GOLD_MID;
      else color = VAULT_GOLD_DARK;
      // Coin chunk noise
      const n = rng();
      if (n < 0.25) color = VAULT_GOLD_MID;
      else if (n > 0.85) color = VAULT_GOLD_LIGHT;
      p.set(x, y, color);
    }
  }
  // Sparkle pixels
  const sparkles = [
    [44, 41],
    [52, 39],
    [48, 46],
    [54, 50],
    [42, 52],
  ];
  for (const [sx, sy] of sparkles) {
    p.set(sx, sy, VAULT_GOLD_GLOW);
    p.set(sx + 1, sy, VAULT_GOLD_LIGHT);
    p.set(sx, sy + 1, VAULT_GOLD_LIGHT);
  }
}

function paintVaultBars(p) {
  // Iron grid: 4 vertical bars + 3 horizontal bars over the arch interior.
  const archCX = 48;
  const archTop = 32;
  const archBot = 60;
  const archHalfW = 12;
  // Vertical bars
  const vXs = [archCX - 9, archCX - 3, archCX + 3, archCX + 9];
  for (const x of vXs) {
    for (let y = archTop; y <= archBot; y++) {
      // Stop verticals when they exit the arch interior
      const dy = y - ((archTop + archBot) / 2);
      const halfH = (archBot - archTop) / 2;
      const norm = ((x - archCX) * (x - archCX)) / (archHalfW * archHalfW) + (dy * dy) / (halfH * halfH);
      if (y < (archTop + archBot) / 2 && norm > 1) continue;
      p.set(x, y, VAULT_BAR_DARK);
      p.set(x + 1, y, VAULT_BAR_MID);
      // Specular dot every few rows
      if ((y & 3) === 0) p.set(x, y, VAULT_BAR_HL);
    }
  }
  // Horizontal bars
  const hYs = [archTop + 6, archTop + 14, archTop + 22];
  for (const y of hYs) {
    for (let x = archCX - archHalfW; x <= archCX + archHalfW; x++) {
      // Confine to interior shape
      const halfH = (archBot - archTop) / 2;
      const dy = y - ((archTop + archBot) / 2);
      const norm = ((x - archCX) * (x - archCX)) / (archHalfW * archHalfW) + (dy * dy) / (halfH * halfH);
      if (y < (archTop + archBot) / 2 && norm > 1) continue;
      p.set(x, y, VAULT_BAR_DARK);
      p.set(x, y + 1, VAULT_BAR_MID);
    }
  }
  // Bar rivets where verticals cross horizontals
  for (const x of vXs) {
    for (const y of hYs) {
      p.set(x, y, VAULT_BAR_HL);
      p.set(x + 1, y, VAULT_BAR_HL);
      p.set(x, y + 1, VAULT_BAR_DARK);
    }
  }
}

function paintVaultBase(p, rng) {
  // Grass apron + dirt path leading to the gate.
  const groundY = 62;
  const groundBot = 70;
  for (let y = groundY; y <= groundBot; y++) {
    const t = (y - groundY) / (groundBot - groundY);
    const halfBase = 40 - Math.round(t * 18);
    for (let x = 48 - halfBase; x <= 48 + halfBase; x++) {
      const dx = (x - 48) / halfBase;
      const ellipseY = (y - groundY) / (groundBot - groundY);
      if (dx * dx + ellipseY * ellipseY > 1.05) continue;
      let color = VAULT_GRASS_MID;
      const n = rng();
      if (n < 0.22) color = VAULT_GRASS_DARK;
      else if (n > 0.72) color = VAULT_GRASS_LIGHT;
      p.set(x, y, color);
    }
  }
  // Dirt path stub leading into the arch.
  for (let y = groundY; y <= groundBot - 1; y++) {
    for (let x = 44; x <= 52; x++) {
      const dx = (x - 48) / 5;
      const dy = (y - groundY) / 7;
      if (dx * dx + dy * dy > 1) continue;
      let color = VAULT_GROUND_DIRT;
      if (rng() < 0.25) color = VAULT_STONE_SHADE;
      p.set(x, y, color);
    }
  }
  // Pebbles flanking the path
  const pebbles = [
    [38, 64],
    [42, 67],
    [56, 65],
    [60, 68],
  ];
  for (const [px, py] of pebbles) {
    p.set(px, py, VAULT_STONE_MID);
    p.set(px + 1, py, VAULT_STONE_HL);
    p.set(px, py + 1, VAULT_STONE_SHADE);
    p.set(px + 1, py + 1, VAULT_STONE_DARK);
  }
  // Grass blade tips
  for (let i = 0; i < 14; i++) {
    const x = 12 + Math.floor(rng() * 72);
    const y = groundY + Math.floor(rng() * 2);
    p.set(x, y, VAULT_GRASS_LIGHT);
    p.set(x, y + 1, VAULT_GRASS_DARK);
  }
}

let hdVaultCache = null;

export function getHDVault() {
  if (hdVaultCache) return hdVaultCache;
  const p = makePainter(HD_VAULT_W, HD_VAULT_H);
  const rng = mulberry32(1729);
  paintVaultStone(p, rng);
  paintVaultArch(p);
  paintVaultGold(p, rng);
  paintVaultBars(p);
  paintVaultBase(p, rng);
  hdVaultCache = p.commit();
  return hdVaultCache;
}

export const HD_VAULT = {
  W: HD_VAULT_W,
  H: HD_VAULT_H,
  // Anchor: dirt path entry at the front-center of the base.
  footX: 48,
  footY: 70,
};

// =========================================================
// HD WORLD PROPS
// =========================================================

function shadeHex(hex, k) {
  const [r, g, b] = hexRgb(hex);
  const c = (n) => Math.max(0, Math.min(255, Math.round(n * k))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`;
}

function rect(p, x, y, w, h, color) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) p.set(xx, yy, color);
  }
}

function frameRect(p, x, y, w, h, rim, fill) {
  rect(p, x, y, w, h, rim);
  rect(p, x + 1, y + 1, w - 2, h - 2, fill);
}

const hdPropCache = new Map();

export const HD_HOUSE = { W: 68, H: 58, footX: 34, footY: 55 };
export const HD_TOTEM = { W: 28, H: 54, footX: 14, footY: 52 };
export const HD_BILLBOARD = { W: 52, H: 42, footX: 26, footY: 40 };
export const HD_FOUNTAIN = { W: 44, H: 36, footX: 22, footY: 32 };
export const HD_LAMP = { W: 18, H: 34, footX: 9, footY: 32 };
export const HD_BUSH = { W: 22, H: 16, footX: 11, footY: 14 };
export const HD_ROCK = { W: 18, H: 13, footX: 9, footY: 11 };
export const HD_FLOWER = { W: 12, H: 16, footX: 6, footY: 14 };

export function getHDHouse(community) {
  const key = `house:${community.id}`;
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_HOUSE.W, HD_HOUSE.H);
  const rim = "#160a08";
  const wall = shadeHex(community.body, 0.72);
  const wallHL = lighten(community.body, 0.25);
  const wallDark = shadeHex(community.bodyShade, 0.7);
  const roof = community.bodyShade;
  const roofHL = lighten(community.accent, 0.18);

  for (let y = 10; y < 27; y++) {
    const t = (y - 10) / 17;
    const half = Math.round(8 + t * 27);
    const x0 = 34 - half;
    const x1 = 34 + half;
    for (let x = x0; x <= x1; x++) {
      const edge = x === x0 || x === x1 || y === 10 || y === 26;
      p.set(x, y, edge ? rim : x < 34 ? roofHL : roof);
    }
  }
  rect(p, 6, 26, 56, 4, rim);
  rect(p, 8, 26, 52, 3, roofHL);
  frameRect(p, 10, 29, 48, 23, rim, wall);
  rect(p, 12, 31, 44, 2, wallHL);
  rect(p, 11, 48, 46, 4, wallDark);
  frameRect(p, 17, 35, 9, 8, rim, "#f5dd95");
  frameRect(p, 42, 35, 9, 8, rim, "#f5dd95");
  rect(p, 21, 35, 1, 8, "#7a4a16");
  rect(p, 46, 35, 1, 8, "#7a4a16");
  frameRect(p, 30, 39, 9, 13, rim, "#4a2710");
  p.set(37, 45, "#ffd84a");
  for (let i = 0; i < 12; i++) p.set(13 + i * 3, 32 + (i % 2), wallHL);
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDTotem(community) {
  const key = `totem:${community.id}`;
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_TOTEM.W, HD_TOTEM.H);
  const rim = "#120804";
  const wood = community.bodyShade;
  const woodHL = lighten(community.body, 0.22);
  const glow = community.glow;
  fillEllipse(p, 14, 11, 10, 8, rim);
  fillEllipse(p, 14, 11, 8, 6, woodHL);
  rect(p, 9, 17, 10, 29, rim);
  rect(p, 10, 18, 8, 27, wood);
  rect(p, 12, 18, 2, 26, woodHL);
  rect(p, 8, 44, 13, 4, rim);
  p.set(11, 10, glow);
  p.set(17, 10, glow);
  p.set(12, 14, rim);
  p.set(13, 15, rim);
  p.set(14, 15, rim);
  p.set(15, 15, rim);
  p.set(16, 14, rim);
  rect(p, 11, 25, 6, 2, community.color);
  rect(p, 11, 32, 6, 2, community.accent);
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDBillboard(community) {
  const key = `billboard:${community.id}`;
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_BILLBOARD.W, HD_BILLBOARD.H);
  const rim = "#160a08";
  rect(p, 9, 25, 4, 14, rim);
  rect(p, 39, 25, 4, 14, rim);
  frameRect(p, 5, 5, 42, 24, rim, shadeHex(community.bodyShade, 0.75));
  rect(p, 8, 8, 36, 3, lighten(community.body, 0.2));
  rect(p, 8, 13, 28, 2, community.glow);
  rect(p, 8, 18, 33, 2, community.accent);
  rect(p, 8, 23, 22, 2, lighten(community.body, 0.35));
  rect(p, 4, 29, 44, 3, "#2a1608");
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDFountain() {
  const key = "fountain";
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_FOUNTAIN.W, HD_FOUNTAIN.H);
  const rim = "#151821";
  const stone = "#687080";
  const stoneHL = "#aeb6c7";
  fillEllipse(p, 22, 24, 20, 7, rim);
  fillEllipse(p, 22, 23, 17, 5, stone);
  fillEllipse(p, 22, 21, 13, 4, "#2aa8d8");
  fillEllipse(p, 22, 20, 8, 2, "#aef3ff");
  rect(p, 17, 11, 10, 9, rim);
  rect(p, 18, 12, 8, 8, stone);
  rect(p, 20, 5, 4, 10, "#7ec8ee");
  p.set(19, 4, "#e8ffff");
  p.set(24, 4, "#e8ffff");
  rect(p, 13, 28, 18, 3, stoneHL);
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDLamp() {
  const key = "lamp";
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_LAMP.W, HD_LAMP.H);
  const rim = "#0a0414";
  fillEllipse(p, 9, 7, 6, 5, rim);
  fillEllipse(p, 9, 7, 4, 3, "#fff3a8");
  rect(p, 8, 11, 2, 17, rim);
  rect(p, 7, 28, 4, 4, rim);
  rect(p, 5, 31, 8, 2, rim);
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDBush(seed = 0) {
  const key = `bush:${seed & 3}`;
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_BUSH.W, HD_BUSH.H);
  const colors = ["#0a1808", "#1f4a20", "#3f8c35", "#74c54a"];
  fillEllipse(p, 7, 10, 6, 5, colors[0]);
  fillEllipse(p, 15, 9, 6, 5, colors[0]);
  fillEllipse(p, 11, 7, 7, 5, colors[1]);
  fillEllipse(p, 7, 9, 4, 3, colors[2]);
  fillEllipse(p, 14, 7, 4, 3, colors[3]);
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDRock(seed = 0) {
  const key = `rock:${seed & 3}`;
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_ROCK.W, HD_ROCK.H);
  fillEllipse(p, 9, 8, 8, 5, "#1a1a14");
  fillEllipse(p, 8, 7, 6, 4, "#5e6258");
  p.set(5, 5, "#a0a690");
  p.set(6, 5, "#a0a690");
  p.set(12, 9, "#34382f");
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}

export function getHDFlower(seed = 0) {
  const key = `flower:${seed & 7}`;
  if (hdPropCache.has(key)) return hdPropCache.get(key);
  const p = makePainter(HD_FLOWER.W, HD_FLOWER.H);
  const bloom = ["#ffd84a", "#ff8ac8", "#aef3ff", "#f6ff7a"][seed & 3];
  rect(p, 5, 7, 2, 7, "#1f7a30");
  p.set(4, 10, "#4ac45a");
  p.set(7, 9, "#4ac45a");
  fillEllipse(p, 6, 5, 4, 3, "#0a0414");
  p.set(6, 3, bloom);
  p.set(4, 5, bloom);
  p.set(8, 5, bloom);
  p.set(6, 7, bloom);
  p.set(6, 5, "#fff7c2");
  const cnv = p.commit();
  hdPropCache.set(key, cnv);
  return cnv;
}
