// =========================================================
// Pumptown · audio
// Tiny chiptune-ish helper using oscillators.
// =========================================================

let ctx = null;
let muted = false;

export function setMuted(value) {
  muted = !!value;
}

function ensure() {
  if (ctx) return ctx;
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    ctx = null;
  }
  return ctx;
}

function envelope(node, time, peak = 0.06, sustain = 0, release = 0.08) {
  const now = ctx.currentTime;
  node.gain.cancelScheduledValues(now);
  node.gain.setValueAtTime(0.0001, now);
  node.gain.exponentialRampToValueAtTime(peak, now + 0.005);
  node.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak * 0.4), now + time * 0.6 + sustain);
  node.gain.exponentialRampToValueAtTime(0.0001, now + time + release);
}

function tone(freq, time = 0.12, type = "square", peak = 0.05, slide = 0) {
  if (muted) return;
  const c = ensure();
  if (!c) return;
  if (c.state === "suspended") c.resume();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, c.currentTime);
  if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, c.currentTime + time);
  envelope(gain, time, peak);
  osc.connect(gain).connect(c.destination);
  osc.start();
  osc.stop(c.currentTime + time + 0.12);
}

export const SFX = {
  click: () => tone(660, 0.06, "square", 0.04),
  step: () => tone(180 + Math.random() * 40, 0.04, "triangle", 0.025),
  contribute: () => {
    tone(440, 0.08, "square", 0.04);
    setTimeout(() => tone(660, 0.1, "square", 0.04, 200), 80);
  },
  reward: () => {
    tone(523, 0.1, "square", 0.05);
    setTimeout(() => tone(659, 0.12, "square", 0.05), 90);
    setTimeout(() => tone(784, 0.18, "square", 0.05), 200);
  },
  event: () => {
    tone(220, 0.18, "square", 0.05, 220);
  },
  join: () => {
    tone(523, 0.12, "triangle", 0.05);
    setTimeout(() => tone(784, 0.16, "triangle", 0.05), 120);
  },
  chat: () => tone(880, 0.05, "square", 0.03),
  splash: () => {
    tone(330, 0.1, "square", 0.05, 120);
    setTimeout(() => tone(660, 0.18, "square", 0.05), 110);
  },
  coin: () => {
    tone(988, 0.05, "square", 0.05);
    setTimeout(() => tone(1318, 0.12, "square", 0.05), 50);
  },
  wallet: () => {
    tone(440, 0.06, "square", 0.05);
    setTimeout(() => tone(660, 0.08, "square", 0.05), 70);
    setTimeout(() => tone(880, 0.12, "square", 0.05), 150);
  },
};
