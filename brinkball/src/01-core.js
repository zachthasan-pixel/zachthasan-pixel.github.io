// ---------------------------------------------------------------------------
// Core helpers: maths, seeded random, safe storage, save data, settings.
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const hyp = Math.hypot;
const angDiff = (a, b) => { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const easeOut = t => 1 - (1 - t) * (1 - t);

// Small deterministic PRNG (mulberry32) for the daily challenge and missions.
function makeRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function todayKey(d) {
  d = d || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function dayNumber(key) { // days since epoch for streak maths
  const y = Math.floor(key / 10000), m = Math.floor(key / 100) % 100, d = key % 100;
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

// localStorage can throw (incognito, blocked cookies, sandboxed iframes).
const Store = {
  ok: true,
  get(k) { try { return window.localStorage.getItem(k); } catch (e) { this.ok = false; return null; } },
  set(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { this.ok = false; } },
};

const SAVE_KEY = 'brinkball-v1';
const Save = {
  d: null,
  defaults() {
    return {
      rp: 0, coins: 0, skin: 'tomato', hat: 'none', ability: 'shock',
      owned: { tomato: 1, none: 1 }, abilitiesSeen: {}, arenasSeen: {},
      stats: { matches: 0, wins: 0, kos: 0, bestStreak: 0, streak: 0 },
      missions: null, daily: { day: 0, best: 0, streak: 0, lastDay: 0, played: 0 },
      gift: 0, tutorial: 0, muted: 0, music: 1, partyBots: 2,
    };
  },
  load() {
    const def = this.defaults();
    let d = null;
    try { d = JSON.parse(Store.get(SAVE_KEY) || 'null'); } catch (e) { d = null; }
    if (!d || typeof d !== 'object') d = {};
    for (const k in def) if (!(k in d)) d[k] = def[k];
    for (const k in def.stats) if (!(k in d.stats)) d.stats[k] = def.stats[k];
    for (const k in def.daily) if (!(k in d.daily)) d.daily[k] = def.daily[k];
    this.d = d;
  },
  write() { Store.set(SAVE_KEY, JSON.stringify(this.d)); },
};
