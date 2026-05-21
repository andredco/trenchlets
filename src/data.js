// =========================================================
// Pumpcity · data
// 10 launch houses, task taxonomy, world events including
// natural disasters, tier ladder, tuning constants.
// =========================================================

// HOUSES. Pumpcity is the city, every house is a pump.fun community.
// Each entry stores the ticker exactly as the founder requested
// (with $ prefix, original case), plus the longer formal name.
// The map is a 5x2 grid with the central vault between the rows.
export const COMMUNITIES = [
  {
    id: "triplet",
    name: "Tung Tung Tung Sahur",
    ticker: "$TripleT",
    mint: "TripleT-mint-placeholder",
    dex: "https://dexscreener.com/solana/2kmu2twwkt9k1pkqlvi7ddlrffox7ghezzwakiynqypk",
    color: "#f6c66a",
    accent: "#c98d2b",
    glow: "#ffe3a8",
    body: "#c98d2b",
    bodyShade: "#7c4f10",
    tagline: "Sahur drums never stop. Indo-coded chaos.",
    holding: true,
    score: 92,
    chat: [
      "tung tung tung sahur",
      "drum check",
      "bunyikan!",
      "siaga sahur",
      "saur saur saur",
    ],
    plaza: { tx: 18, ty: 14 },
    bbox: { tx: 6, ty: 5, tw: 24, th: 20 },
  },
  {
    id: "troll",
    name: "Troll",
    ticker: "$Troll",
    mint: "Troll-mint-placeholder",
    dex: "https://dexscreener.com/solana/4w2cysotx6czaugmmwg13hdpy4qemg2czekyeqyk9ama",
    color: "#a7e36a",
    accent: "#5fb228",
    glow: "#d5ffa3",
    body: "#5fb228",
    bodyShade: "#2b6b08",
    tagline: "Internet troll energy, irl manifestation.",
    holding: true,
    score: 90,
    chat: [
      "trolololol",
      "u mad bro?",
      "problem?",
      "back to /b/",
      "you fell for it",
    ],
    plaza: { tx: 49, ty: 14 },
    bbox: { tx: 37, ty: 5, tw: 24, th: 20 },
  },
  {
    id: "chillhouse",
    name: "Chill House",
    ticker: "$Chillhouse",
    mint: "Chillhouse-mint-placeholder",
    dex: "https://dexscreener.com/solana/35tqqmeirwebk6fr5qipwastuaavo32vjnuljpxvsxuk",
    color: "#ff9c52",
    accent: "#d76112",
    glow: "#ffd6ad",
    body: "#d76112",
    bodyShade: "#7b3206",
    tagline: "Slow burn, smooth hands, infinite vibes.",
    holding: true,
    score: 84,
    chat: [
      "stay chill",
      "no rush ever",
      "lofi raid live",
      "sip and hold",
      "vibes only",
    ],
    plaza: { tx: 80, ty: 14 },
    bbox: { tx: 68, ty: 5, tw: 24, th: 20 },
  },
  {
    id: "unc",
    name: "Unc",
    ticker: "$unc",
    mint: "unc-mint-placeholder",
    dex: "https://dexscreener.com/solana/bwfzkx1pmpvwxammwtrizvowzzzgifeyuyw6ee51shly",
    color: "#5fbcff",
    accent: "#1f7ec3",
    glow: "#b0e3ff",
    body: "#1f7ec3",
    bodyShade: "#0a416f",
    tagline: "Uncle energy, dispensing wisdom.",
    holding: false,
    score: 78,
    chat: [
      "trust the unc",
      "back in my day...",
      "kids these days",
      "let unc cook",
      "stay frosty",
    ],
    plaza: { tx: 111, ty: 14 },
    bbox: { tx: 99, ty: 5, tw: 24, th: 20 },
  },
  {
    id: "neet",
    name: "Not Employment Education Training",
    ticker: "$NEET",
    mint: "NEET-mint-placeholder",
    dex: "https://dexscreener.com/solana/5wnu5qhdprgrl37ffcd6tmmqzugqgxwafgz477rshthy",
    color: "#9a99c0",
    accent: "#5a5882",
    glow: "#c4c3df",
    body: "#5a5882",
    bodyShade: "#272538",
    tagline: "Not in employment, education or training.",
    holding: false,
    score: 76,
    chat: [
      "log off",
      "no work today",
      "rent? what rent",
      "back to bed",
      "neet army assemble",
    ],
    plaza: { tx: 142, ty: 14 },
    bbox: { tx: 130, ty: 5, tw: 24, th: 20 },
  },
  {
    id: "burnie",
    name: "Burnie Senders",
    ticker: "$BURNIE",
    mint: "BURNIE-mint-placeholder",
    dex: "https://dexscreener.com/solana/5tyfvifwqrkv9bjsthgitbdqeyc1bgugrudnsaduxqjp",
    color: "#ff5238",
    accent: "#b41e0a",
    glow: "#ffb19d",
    body: "#b41e0a",
    bodyShade: "#5a0a01",
    tagline: "Bonfire of the tokens. Burn rate go brrr.",
    holding: false,
    score: 88,
    chat: [
      "send it to the fire",
      "burn baby burn",
      "supply going down",
      "more fuel",
      "ignite",
    ],
    plaza: { tx: 18, ty: 62 },
    bbox: { tx: 6, ty: 53, tw: 24, th: 20 },
  },
  {
    id: "wtdd",
    name: "What the dog doing?",
    ticker: "$我的刀盾",
    mint: "WTDD-mint-placeholder",
    dex: "https://dexscreener.com/solana/9rpsv1vwy6itwjihsbjrbpw2z36aeicnaiktyqtnxxcr",
    color: "#e5c08a",
    accent: "#b08646",
    glow: "#ffe1b3",
    body: "#b08646",
    bodyShade: "#5e4310",
    tagline: "what the dog doing? a lot apparently.",
    holding: false,
    score: 82,
    chat: [
      "what the dog doing",
      "good boy",
      "tail wagging",
      "rip my shoes",
      "bork bork",
    ],
    plaza: { tx: 49, ty: 62 },
    bbox: { tx: 37, ty: 53, tw: 24, th: 20 },
  },
  {
    id: "buttcoin",
    name: "Buttcoin",
    ticker: "$Buttcoin",
    mint: "Buttcoin-mint-placeholder",
    dex: "https://dexscreener.com/solana/ffcygssgwhfora9rxxka48p8yfoz8tsw85jpo3cqhdys",
    color: "#ff96b6",
    accent: "#d24875",
    glow: "#ffd1de",
    body: "#d24875",
    bodyShade: "#7d1f3f",
    tagline: "Peach perfect. Stack cheeks.",
    holding: false,
    score: 81,
    chat: [
      "stack cheeks",
      "peach mode",
      "rear pump",
      "thicc gains",
      "buns up",
    ],
    plaza: { tx: 80, ty: 62 },
    bbox: { tx: 68, ty: 53, tw: 24, th: 20 },
  },
  {
    id: "wojak",
    name: "Wojak",
    ticker: "$Wojak",
    mint: "Wojak-mint-placeholder",
    dex: "https://dexscreener.com/solana/fdry5i5kuadz1ik8gps26qjj9rw9mpufxmeggc2hnsp7",
    color: "#f6e9b4",
    accent: "#c0a85d",
    glow: "#fff6cc",
    body: "#c0a85d",
    bodyShade: "#6c5a1c",
    tagline: "feel guy. feel something. feel anything.",
    holding: false,
    score: 86,
    chat: [
      "feels bad man",
      "i know that feel",
      "just buy in",
      "haha money go up",
      "no more feel",
    ],
    plaza: { tx: 111, ty: 62 },
    bbox: { tx: 99, ty: 53, tw: 24, th: 20 },
  },
  {
    id: "fartcoin",
    name: "Fartcoin",
    ticker: "$Fartcoin",
    mint: "Fartcoin-mint-placeholder",
    dex: "https://dexscreener.com/solana/bzc9nzfmqkxr6fz1dbph7bdf9broyef6pnzesp7v5iiw",
    color: "#c6ff4d",
    accent: "#8de531",
    glow: "#e6ff86",
    body: "#86b330",
    bodyShade: "#5e8021",
    tagline: "AI meme chaos with relentless gravity.",
    holding: true,
    score: 96,
    chat: [
      "BRAP! the prophecy is real",
      "truth terminal said so",
      "AGI runs on funk fuel",
      "scent of money in the air",
      "the foul wind blows",
    ],
    plaza: { tx: 142, ty: 62 },
    bbox: { tx: 130, ty: 53, tw: 24, th: 20 },
  },
];

// Task categories control where each reward stream lands.
//   buyback  -> house vault grows (the whole house wins)
//   claim    -> goes into the player's unclaimed share
//   protocol -> sent to the Pumpcity protocol treasury
export const TASKS = [
  {
    id: "buyback-rally",
    title: "Buyback Rally",
    category: "buyback",
    short: "Pool fees to buy the house token straight into their vault.",
    durationMs: 3 * 60 * 60 * 1000,
    cooldownMs: 18 * 60 * 1000,
    minCitizens: 40,
    rewardBands: [5, 7, 9, 11],
    difficulty: "3H window",
    tierMin: 0,
    split: { vault: 85, player: 10, treasury: 5 },
  },
  {
    id: "citizen-bounty",
    title: "Citizen Bounty",
    category: "claim",
    short: "Citizens earn a personal slice (subject to the 12h claim lock).",
    durationMs: 5 * 60 * 60 * 1000,
    cooldownMs: 28 * 60 * 1000,
    minCitizens: 70,
    rewardBands: [8, 12, 16, 20],
    difficulty: "5H window",
    tierMin: 1,
    split: { vault: 35, player: 60, treasury: 5 },
  },
  {
    id: "treasury-tribute",
    title: "Treasury Tribute",
    category: "protocol",
    short: "Tax raid that fuels the Trenchlets treasury for the next pool.",
    durationMs: 6 * 60 * 60 * 1000,
    cooldownMs: 40 * 60 * 1000,
    minCitizens: 100,
    rewardBands: [10, 14, 18, 22],
    difficulty: "6H window",
    tierMin: 2,
    split: { vault: 40, player: 15, treasury: 45 },
  },
];

// Raid is an instant action triggered at an enemy house billboard.
// SHARK+ tier required. Cooldown ladder keeps it strategic.
export const RAID = {
  tierMin: 3,
  cooldownMs: 12 * 60 * 1000,
  stealPercentBands: [3, 5, 8, 12],
};

export const TASK_CATEGORIES = {
  buyback: {
    label: "BUYBACK",
    color: "#1ec77d",
    blurb: "House vault swells. Everyone in the house shares the pie.",
  },
  claim: {
    label: "CITIZEN",
    color: "#4ff7ff",
    blurb: "Active players earn personal share (12h lock on first play).",
  },
  protocol: {
    label: "PROTOCOL",
    color: "#ffd84a",
    blurb: "Trenchlets treasury fuels future pool expansions.",
  },
  raid: {
    label: "RAID",
    color: "#ff4a6e",
    blurb: "Steal a slice from a rival house. High risk, high tier.",
  },
};

// World events. Disasters hurt houses until citizens organize.
export const WORLD_EVENTS = [
  {
    id: "vault-overflow",
    title: "VAULT OVERFLOW",
    desc: "Coins rain over the plaza. Collect them for bonus vault progress.",
    durationMs: 28000,
    color: "#ffd84a",
    weight: 3,
    kind: "boon",
  },
  {
    id: "solar-eclipse",
    title: "SOLAR ECLIPSE",
    desc: "Twilight blankets the city. Task progress is doubled.",
    durationMs: 32000,
    color: "#9d6bff",
    weight: 3,
    kind: "boon",
  },
  {
    id: "raid-hour",
    title: "RAID HOUR",
    desc: "All citizens march on the vault. Speed up. Contributions hit hard.",
    durationMs: 36000,
    color: "#1ec77d",
    weight: 3,
    kind: "boon",
  },
  {
    id: "spotlight",
    title: "HOUSE SPOTLIGHT",
    desc: "A surprise house is haloed. Contributions for them count 3x.",
    durationMs: 30000,
    color: "#5cff9a",
    weight: 2,
    kind: "boon",
  },
  {
    id: "whale-visit",
    title: "WHALE VISIT",
    desc: "A whale crosses Trenchlets. Walk under it for a vault tip.",
    durationMs: 24000,
    color: "#4ff7ff",
    weight: 2,
    kind: "boon",
  },
  {
    id: "house-fire",
    title: "HOUSE FIRE",
    desc: "A house is burning. Run there and press E to bucket-brigade.",
    durationMs: 42000,
    color: "#ff5238",
    weight: 3,
    kind: "disaster",
    drainPerSec: 0.018,
    extinguishPerHit: 0.18,
  },
  {
    id: "earthquake",
    title: "EARTHQUAKE",
    desc: "Tectonic shake. Vault accrual halts. NPCs panic-walk.",
    durationMs: 26000,
    color: "#b1683a",
    weight: 2,
    kind: "disaster",
  },
  {
    id: "lightning-storm",
    title: "LIGHTNING STORM",
    desc: "Bolts strike random houses. Their task progress freezes.",
    durationMs: 30000,
    color: "#9d6bff",
    weight: 2,
    kind: "disaster",
  },
  {
    id: "locust-swarm",
    title: "LOCUST SWARM",
    desc: "Pests cloud the sky. NPC chatter dims, treasury rate halves.",
    durationMs: 28000,
    color: "#7a8e21",
    weight: 1,
    kind: "disaster",
  },
];

export const GENERIC_CHAT = [
  "gm trenchlets",
  "vault hitting different today",
  "anyone seeing the pump?",
  "running it",
  "lfg",
  "wen reward window",
  "this city is alive",
  "saw a whale earlier",
  "the houses are restless",
  "town meeting soon",
];

// PUMPCITY holder tiers. Higher tier unlocks more task types.
// SHARK+ unlocks the raid action.
export const TIERS = [
  { id: "shrimp", label: "SHRIMP", min: 0, color: "#9d6bff", glyph: "S" },
  { id: "fish", label: "FISH", min: 50_000, color: "#4ff7ff", glyph: "F" },
  { id: "dolphin", label: "DOLPHIN", min: 500_000, color: "#5cff9a", glyph: "D" },
  { id: "shark", label: "SHARK", min: 5_000_000, color: "#ffd84a", glyph: "SH" },
  { id: "whale", label: "WHALE", min: 50_000_000, color: "#1ec77d", glyph: "W" },
];

export function tierFor(balance) {
  let current = TIERS[0];
  for (const tier of TIERS) {
    if (balance >= tier.min) current = tier;
  }
  return current;
}

export function tierIndex(tierId) {
  return TIERS.findIndex((t) => t.id === tierId);
}

export const STARTING_PUMPTOWN = 25_000;

// 12h first-play lock on personal share claims.
export const CLAIM_LOCK_MS = 12 * 60 * 60 * 1000;

// =========================================================
// VAULT + EPOCH (real economy parameters, no mocks)
// =========================================================
// VAULT_CONFIG.address is the developer wallet that the $TRENCHLETS
// token launches through. Until the on-chain reader is wired (see
// FEEDS.solana below), vault USD displays as "live feed pending"
// rather than synthetic numbers. Users still play and accumulate
// pending contributions; settlement happens on-chain post-launch.
export const VAULT_CONFIG = {
  // PUBLIC vault address (founder's multisig). Wallet ONLY receives —
  // the client cannot withdraw from it. Replace at launch.
  address: "TRENCH1eTSMu1tisigPlace1101111111111111111111",
  // Solana RPC endpoint used to read SOL + token balances. Plug in
  // mainnet-beta or a private RPC at deploy.
  rpcUrl: "",
  // The $TRENCHLETS token mint (launched on pump.fun). Empty until launch.
  trenchletsMint: "",
};

export const EPOCH_CONFIG = {
  // 6h airdrop epoch.
  lengthMs: 6 * 60 * 60 * 1000,
  // % of vault USD that drains to airdrop pool each epoch.
  drainPct: 0.15,
  // Minimum $TRENCHLETS held to qualify for airdrop weight.
  qualifyFloor: 50_000,
  // Anchor epoch start so all clients agree on epoch boundaries
  // without needing the server. Epoch 0 starts at this UTC ms.
  // Pick a fixed launch timestamp at deploy so countdowns line up.
  anchorMs: Date.UTC(2026, 4, 21, 0, 0, 0),
};

// =========================================================
// MINIGAMES (real player skill drives contribution percent)
// =========================================================
// Each minigame returns a normalized score 0..1. Contribution percent
// is derived from score × tier bonus × event modifiers, capped per
// task. Minimum play time is enforced server-side ready: a session
// shorter than `minMs` is rejected. The multiplayer layer broadcasts
// the resolved contribution after server-side validation (or local
// validation in single-player).

export const MINIGAMES = [
  {
    id: "rhythm-rush",
    title: "Rhythm Rush",
    blurb: "Hit the falling notes in time — guitar-hero style.",
    minMs: 18 * 1000,
    maxMs: 35 * 1000,
    // Maps to which task category fills.
    taskId: "buyback-rally",
    color: "#5cff9a",
  },
  {
    id: "memory-mint",
    title: "Memory Mint",
    blurb: "Repeat the flashing pattern. Each round adds a step.",
    minMs: 12 * 1000,
    maxMs: 30 * 1000,
    taskId: "buyback-rally",
    color: "#4ff7ff",
  },
  {
    id: "quick-tap",
    title: "Quick Tap",
    blurb: "Tap the highlighted board key as fast as you can.",
    minMs: 10 * 1000,
    maxMs: 20 * 1000,
    taskId: "citizen-bounty",
    color: "#ffd84a",
  },
  {
    id: "pattern-match",
    title: "Pattern Match",
    blurb: "Match the symbol pairs before the timer runs out.",
    minMs: 14 * 1000,
    maxMs: 30 * 1000,
    taskId: "citizen-bounty",
    color: "#ff8e3a",
  },
  {
    id: "stack-tower",
    title: "Stack Tower",
    blurb: "Stack the moving blocks. One slip and the run ends.",
    minMs: 12 * 1000,
    maxMs: 30 * 1000,
    taskId: "treasury-tribute",
    color: "#ff4a6e",
  },
];

// Map minigame -> task category contribution behaves like.
export const MINIGAME_BY_TASK = MINIGAMES.reduce((acc, m) => {
  acc[m.taskId] ||= [];
  acc[m.taskId].push(m);
  return acc;
}, {});

// Per-task contribution caps (so a single play can never resolve a task
// alone). Values are % of the task progress bar a perfect 1.0 score
// would push at SHRIMP tier with no event modifiers.
export const CONTRIBUTION_CAPS = {
  "buyback-rally": 6, // 17 perfect plays minimum to fill a 100% rally
  "citizen-bounty": 4,
  "treasury-tribute": 3,
};

// Per-tier multiplier applied to minigame contribution.
export const TIER_CONTRIBUTION_MULT = {
  shrimp: 1.0,
  fish: 1.08,
  dolphin: 1.18,
  shark: 1.3,
  whale: 1.5,
};

export const TUNING = {
  // Logical render resolution. Drawing code uses these as pixel units.
  // The canvas itself is 2x larger (HD), so 640x360 becomes a crisp
  // 1280x720 backing buffer while also showing more of the town.
  GAME_W: 720,
  GAME_H: 405,
  TILE: 16,
  WORLD_TX: 160,
  WORLD_TY: 76,
  PLAYER_SPEED: 1.65,
  NPC_SPEED: 0.9,
  WORLD_EVENT_MIN_MS: 80 * 1000,
  WORLD_EVENT_MAX_MS: 130 * 1000,
  CHAT_COOLDOWN_MS: 2500,
  VAULT_BASE_RATE: 0.6,
};
