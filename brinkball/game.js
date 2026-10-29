/* Brinkball (c) 2026 Dr. Zahir Hasan. Built from src/ by build.sh (web) */
(function () {
'use strict';
// ---------------------------------------------------------------------------
// Portal layer. build.sh stamps PORTAL as 'web' (itch.io + own site, no ads),
// 'crazygames' or 'poki'. If a portal SDK is missing (adblock, offline, wrong
// domain) every call quietly falls through and the game plays normally.
// ---------------------------------------------------------------------------
const PORTAL = 'web';
const Portal = {
  name: PORTAL, ready: false, playing: false, adActive: false, sdkMute: false, log: [],
  get cg() { return window.CrazyGames && window.CrazyGames.SDK; },
  get poki() { return window.PokiSDK; },
  init() {
    const done = ok => { this.ready = !!ok; };
    try {
      if (PORTAL === 'crazygames' && this.cg) {
        return this.cg.init().then(() => {
          const env = this.cg.environment;
          done(env === 'crazygames' || env === 'local');
          if (!this.ready) return;
          const apply = s => { this.sdkMute = !!(s && s.muteAudio); AU.applyGain(); };
          apply(this.cg.game.settings);
          this.cg.game.addSettingsChangeListener(apply);
        }).catch(() => done(false));
      }
      if (PORTAL === 'poki' && this.poki) {
        // Poki: continue to the game whether init resolves or rejects (ad blockers).
        return this.poki.init().then(() => done(true)).catch(() => done(true));
      }
    } catch (e) { done(false); }
    return Promise.resolve();
  },
  loadingStart() { this._try('loadingStart', () => { if (PORTAL === 'crazygames') this.cg.game.loadingStart(); }); },
  loadingStop() {
    this._try('loadingStop', () => {
      if (PORTAL === 'crazygames') this.cg.game.loadingStop();
      if (PORTAL === 'poki') this.poki.gameLoadingFinished();
    });
  },
  gameplayStart() {
    if (this.playing || this.adActive) return;
    this.playing = true;
    this._try('gameplayStart', () => { if (PORTAL === 'crazygames') this.cg.game.gameplayStart(); else if (PORTAL === 'poki') this.poki.gameplayStart(); });
  },
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this._try('gameplayStop', () => { if (PORTAL === 'crazygames') this.cg.game.gameplayStop(); else if (PORTAL === 'poki') this.poki.gameplayStop(); });
  },
  happy() { this._try('happytime', () => { if (PORTAL === 'crazygames') this.cg.game.happytime(); }); },
  // Rewarded videos only on Poki. CrazyGames starts games in Basic Launch with ads
  // off, and a reward button that does nothing gets a game rejected.
  get hasRewarded() { return this.ready && PORTAL === 'poki'; },
  // A break before going back into gameplay. cb always runs exactly once.
  midgame(cb) { this._ad('midgame', () => cb()); },
  // Opt-in rewarded video. cb(true) only if the ad was actually watched.
  rewarded(cb) { this._ad('rewarded', cb); },
  pending: false,
  _ad(kind, cb) {
    if (!this.ready || PORTAL === 'web') { cb(false); return; }
    let finished = false;
    this.pending = true;
    const start = () => { this.adActive = true; this.log.push('adStart'); AU.applyGain(); };
    const end = ok => {
      if (finished) return; finished = true;
      this.adActive = false; this.pending = false; this.log.push('adEnd'); AU.applyGain(); cb(ok);
    };
    this.gameplayStop();
    // If the SDK never answers, don't leave the game frozen.
    setTimeout(() => { if (!this.adActive) end(false); }, 8000);
    try {
      if (PORTAL === 'crazygames') {
        this.cg.ad.requestAd(kind, { adStarted: start, adFinished: () => end(true), adError: () => end(false) });
      } else {
        const p = kind === 'rewarded' ? this.poki.rewardedBreak(start) : this.poki.commercialBreak(start);
        p.then(ok => end(kind === 'rewarded' ? !!ok : true)).catch(() => end(false));
      }
    } catch (e) { end(false); }
  },
  _try(name, fn) { this.log.push(name); if (!this.ready) return; try { fn(); } catch (e) { /* never let a portal break the game */ } },
};
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
// ---------------------------------------------------------------------------
// Game data: ranks, abilities, arenas, cosmetics, missions, CPU names.
// ---------------------------------------------------------------------------
const RANKS = [
  { name: 'Bronze', rp: 0, col: '#d08a52' },
  { name: 'Silver', rp: 250, col: '#c9d3e0' },
  { name: 'Gold', rp: 550, col: '#ffcf4a' },
  { name: 'Platinum', rp: 900, col: '#5fe3d0' },
  { name: 'Diamond', rp: 1350, col: '#7fb4ff' },
  { name: 'Champion', rp: 1900, col: '#ff6fb1' },
  { name: 'Legend', rp: 2600, col: '#ffffff' },
];
function rankOf(rp) {
  let i = 0;
  while (i + 1 < RANKS.length && rp >= RANKS[i + 1].rp) i++;
  const r = RANKS[i], next = RANKS[i + 1];
  // Three divisions inside each tier (III, II, I), except Legend.
  let div = '', frac = 1;
  if (next) {
    const span = next.rp - r.rp, into = rp - r.rp;
    const d = Math.min(2, Math.floor(into / (span / 3)));
    div = ['III', 'II', 'I'][d];
    frac = (into - d * span / 3) / (span / 3);
  }
  return { i, name: r.name, div, col: r.col, label: r.name + (div ? ' ' + div : ''), frac, next };
}
// CPU skill 0..1 grows with rank so the game stays a challenge as you climb.
function skillFor(rp) { return clamp(0.22 + rp / 2600 * 0.78, 0.22, 1); }

const ABILITIES = {
  shock: { name: 'Shockwave', icon: '💥', cd: 6.5, rank: 0, desc: 'Blast everyone nearby away from you.' },
  anchor: { name: 'Anchor', icon: '⚓', cd: 7, rank: 1, desc: 'Turn to iron for 1.6 s. You barely budge, they bounce off.' },
  blink: { name: 'Blink', icon: '✨', cd: 5, rank: 2, desc: 'Teleport a short hop. Crosses gaps, if you aim well.' },
  magnet: { name: 'Magnet', icon: '🧲', cd: 8, rank: 3, desc: 'Pull rivals in, then fling them out.' },
};
const ABILITY_KEYS = Object.keys(ABILITIES);

// Arena themes. unlock = rank tier index needed.
const ARENAS = {
  meadow: { name: 'Meadow', unlock: 0, top: ['#7bd36a', '#6cc65d'], side: '#3f7f3a', edge: '#b8f0a0', sky: ['#28215a', '#7a4f9e', '#f29d8b'], rings: 7, feature: 'none', desc: 'The classic. Tiles crumble from the edge in.' },
  pinball: { name: 'Pinball', unlock: 0, top: ['#ffcf6b', '#f6bf55'], side: '#a8692b', edge: '#fff0b8', sky: ['#13204a', '#2e4f9a', '#61c4d8'], rings: 7, feature: 'bumpers', desc: 'Bumpers fling anything that touches them.', minRp: 120 },
  glacier: { name: 'Glacier', unlock: 1, top: ['#bfe9ff', '#a7dcfa'], side: '#5a8fb8', edge: '#ffffff', sky: ['#0b1a3a', '#244a7a', '#9fd5f0'], rings: 7, feature: 'ice', desc: 'Slippery ice. Momentum is everything.' },
  sweeper: { name: 'Sweeper', unlock: 2, top: ['#f59ac0', '#ec86b0'], side: '#9a3f6c', edge: '#ffd6e8', sky: ['#1d0f33', '#5b2068', '#ff8a6b'], rings: 7, feature: 'sweeper', desc: 'A spinning beam sweeps the arena. Jump it with a dash.' },
  islands: { name: 'Islands', unlock: 3, top: ['#e5c38f', '#d9b47c'], side: '#8a6436', edge: '#fff1cf', sky: ['#082431', '#16566a', '#5fd0b5'], rings: 7, feature: 'islands', desc: 'Four islands joined by bridges that do not last.' },
  volcano: { name: 'Volcano', unlock: 4, top: ['#6d6a78', '#5d5a68'], side: '#2f2b38', edge: '#c9c3d8', sky: ['#1a0606', '#5a1410', '#ff6a2b'], rings: 7, feature: 'vents', desc: 'Vents erupt and blast you upward. Watch the glow.' },
};
const ARENA_KEYS = Object.keys(ARENAS);

// Cosmetics. price 0 = starter. rank = minimum tier to buy (prestige items).
const SKINS = {
  tomato: { name: 'Tomato', c1: '#ff5a4e', c2: '#c7262b', price: 0 },
  sky: { name: 'Sky', c1: '#5fb8ff', c2: '#2a6fd6', price: 120 },
  lime: { name: 'Lime', c1: '#a6f04a', c2: '#4fa82a', price: 120 },
  grape: { name: 'Grape', c1: '#b884ff', c2: '#6b3fd1', price: 160 },
  sunny: { name: 'Sunny', c1: '#ffe25a', c2: '#e0a020', price: 160 },
  mint: { name: 'Mint', c1: '#6ff0c8', c2: '#1fa985', price: 200 },
  bubble: { name: 'Bubblegum', c1: '#ff9ad5', c2: '#e04aa0', price: 220 },
  coal: { name: 'Coal', c1: '#5b5b6b', c2: '#25252f', price: 300 },
  snow: { name: 'Snow', c1: '#ffffff', c2: '#b8c4d8', price: 300 },
  melon: { name: 'Melon', c1: '#7ee06a', c2: '#2f8a3a', price: 380, pattern: 'stripes', pc: '#1d5e27' },
  beach: { name: 'Beach Ball', c1: '#ffffff', c2: '#d8d8e6', price: 450, pattern: 'beach' },
  lava: { name: 'Lava', c1: '#ff8a3a', c2: '#b0201a', price: 520, pattern: 'spots', pc: '#ffd36b', rank: 2 },
  galaxy: { name: 'Galaxy', c1: '#4a3ab8', c2: '#120a3a', price: 700, pattern: 'stars', pc: '#ffffff', rank: 3 },
  gold: { name: 'Solid Gold', c1: '#ffe48a', c2: '#c98a12', price: 1200, pattern: 'shine', rank: 4 },
};
const HATS = {
  none: { name: 'No hat', price: 0 },
  cap: { name: 'Cap', price: 100 },
  bow: { name: 'Bow', price: 120 },
  horns: { name: 'Horns', price: 200 },
  sprout: { name: 'Sprout', price: 150 },
  tophat: { name: 'Top Hat', price: 260 },
  viking: { name: 'Viking', price: 340 },
  chef: { name: 'Chef', price: 300 },
  halo: { name: 'Halo', price: 420, rank: 2 },
  crown: { name: 'Crown', price: 900, rank: 4 },
};

const MISSION_POOL = [
  { id: 'ko', text: 'Knock off {n} rivals', n: [5, 8, 12], reward: [60, 90, 130] },
  { id: 'win', text: 'Win {n} Royale match{es}', n: [1, 2, 3], reward: [80, 140, 200] },
  { id: 'top3', text: 'Finish top 3 in {n} match{es}', n: [2, 3, 5], reward: [60, 90, 140] },
  { id: 'charged', text: 'Knock off {n} rivals with a charged dash', n: [2, 4, 6], reward: [70, 110, 150] },
  { id: 'ability', text: 'Use your ability {n} times', n: [8, 15, 25], reward: [50, 80, 110] },
  { id: 'power', text: 'Grab {n} power-ups', n: [3, 5, 8], reward: [50, 80, 110] },
  { id: 'survive', text: 'Survive {n} seconds in total', n: [180, 300, 480], reward: [50, 80, 120] },
  { id: 'double', text: 'Get a double KO (2 in 3 s)', n: [1, 1, 2], reward: [90, 90, 160] },
  { id: 'party', text: 'Play {n} Party round{s}', n: [3, 5, 8], reward: [40, 60, 90] },
];

const CPU_NAMES = ['Bonk', 'Wobbles', 'Sir Roll', 'Pudding', 'Boulder', 'Zippy', 'Mochi', 'Thud', 'Noodle', 'Biscuit',
  'Gumdrop', 'Tank', 'Pebble', 'Dumpling', 'Rascal', 'Meatball', 'Bubbles', 'Turbo', 'Waffle', 'Chomp', 'Bouncer',
  'Marble', 'Snoot', 'Pickles', 'Rumble', 'Taffy', 'Brick', 'Jelly', 'Bonbon', 'Dozer'];

// Daily modifiers keep the Daily Challenge different every day.
const MODIFIERS = [
  { id: 'none', name: 'Classic', desc: 'No twist. Pure skill.' },
  { id: 'giant', name: 'Giants', desc: 'Everyone is huge and heavy.' },
  { id: 'tiny', name: 'Tiny Terrors', desc: 'Small, fast and fragile.' },
  { id: 'hyper', name: 'Hyper Dash', desc: 'Dash cooldown halved.' },
  { id: 'heavyhit', name: 'Glass Cannons', desc: 'Every hit counts double.' },
  { id: 'powerups', name: 'Power Rain', desc: 'Power-ups drop constantly.' },
  { id: 'quick', name: 'Quick Crumble', desc: 'The arena falls twice as fast.' },
];
// ---------------------------------------------------------------------------
// Audio: everything is synthesised with Web Audio, no sound files to load.
// Punchy one-shots plus a 120 bpm loop that layers up as rivals drop out.
// ---------------------------------------------------------------------------
const AU = {
  ctx: null, quiet: false, master: null, sfx: null, mus: null, noise: null, ready: false,
  playing: false, intensity: 0, nextStep: 0, step: 0, bpm: 120,
  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 5; comp.attack.value = 0.003; comp.release.value = 0.15;
    this.master.connect(comp); comp.connect(c.destination);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master);
    this.mus = c.createGain(); this.mus.gain.value = 0.32; this.mus.connect(this.master);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ready = true;
    this.applyGain();
    this.resume();
    setInterval(() => this.schedule(), 30);
  },
  applyGain() {
    if (!this.ready) return;
    const on = !Save.d.muted && !Portal.sdkMute && !Portal.adActive && !UI.paused;
    this.master.gain.setTargetAtTime(on ? 0.8 : 0, this.ctx.currentTime, 0.03);
    this.mus.gain.setTargetAtTime(Save.d.music ? 0.3 : 0, this.ctx.currentTime, 0.05);
  },
  // iOS suspends audio after interruptions; resume() must run inside a user gesture.
  resume() { if (this.ctx && this.ctx.state !== 'running' && !Portal.adActive) this.ctx.resume().catch(() => {}); },
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
  t() { return this.ctx ? this.ctx.currentTime : 0; },
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  tone(type, f0, f1, dur, vol, dest, when) {
    if (!this.ready || this.quiet && !dest) return;
    const c = this.ctx, t = when || c.currentTime;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(g, t, 0.004, vol, dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  hiss(fType, f, q, dur, vol, dest, when, f1) {
    if (!this.ready || this.quiet && !dest) return;
    const c = this.ctx, t = when || c.currentTime;
    const s = c.createBufferSource(), b = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.playbackRate.value = rand(0.8, 1.2);
    b.type = fType; b.frequency.setValueAtTime(f, t); b.Q.value = q || 1;
    if (f1) b.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, 0.003, vol, dur);
    s.connect(b); b.connect(g); g.connect(dest || this.sfx); s.start(t, rand(0, 0.5)); s.stop(t + dur + 0.05);
  },
  // --- sound effects ------------------------------------------------------
  bump(power, mass) { // power 0..1
    const p = clamp(power, 0, 1), base = 150 / Math.sqrt(mass || 1);
    this.tone('sine', base * (1.6 + p), base * 0.5, 0.12 + p * 0.18, 0.25 + p * 0.55);
    this.hiss('lowpass', 900 + p * 2500, 0.7, 0.06 + p * 0.1, 0.15 + p * 0.4);
    if (p > 0.6) this.tone('square', 90, 40, 0.2, 0.18);
  },
  dash(charge) {
    this.hiss('bandpass', 600 + charge * 600, 1.2, 0.22 + charge * 0.1, 0.35, null, null, 2800 + charge * 2000);
    this.tone('triangle', 260 + charge * 200, 520 + charge * 500, 0.12, 0.12);
  },
  charge(level) { this.tone('sine', 300 + level * 500, 320 + level * 520, 0.05, 0.05); },
  crack() { this.hiss('highpass', 2500, 0.8, 0.08, 0.18); this.tone('square', 180, 120, 0.05, 0.05); },
  tileFall() { this.hiss('lowpass', 500, 1, 0.35, 0.15, null, null, 120); },
  fall() { this.tone('sine', 900, 160, 0.8, 0.22); this.tone('triangle', 905, 165, 0.8, 0.08); },
  ko(big) {
    this.tone('square', 220, 55, 0.35, 0.3);
    this.hiss('lowpass', 1800, 0.6, 0.5, 0.45, null, null, 200);
    this.cheer(big ? 0.9 : 0.5);
  },
  cheer(v) { // crowd: band-limited noise swells
    if (!this.ready) return;
    for (let i = 0; i < 3; i++) this.hiss('bandpass', rand(700, 1500), 0.9, 0.9 + rand(0, 0.5), 0.12 * v, null, this.t() + i * 0.05);
  },
  shock() { this.tone('sine', 120, 40, 0.45, 0.6); this.hiss('lowpass', 3000, 0.7, 0.4, 0.4, null, null, 150); },
  anchor() { this.tone('square', 110, 100, 0.25, 0.2); this.tone('sine', 55, 50, 0.4, 0.4); },
  blink() { this.tone('sine', 1200, 300, 0.18, 0.18); this.tone('sine', 300, 1500, 0.15, 0.12, null, this.t() + 0.06); },
  magnet() { this.tone('sawtooth', 80, 160, 0.9, 0.12); },
  pickup() { [660, 880, 1320].forEach((f, i) => this.tone('triangle', f, f, 0.12, 0.2, null, this.t() + i * 0.06)); },
  bumper() { this.tone('square', 520, 880, 0.08, 0.18); this.tone('sine', 1040, 1040, 0.15, 0.15); },
  vent() { this.hiss('lowpass', 400, 1, 0.6, 0.35, null, null, 2500); },
  ui() { this.tone('triangle', 720, 980, 0.07, 0.15, this.master); },
  deny() { this.tone('square', 160, 120, 0.12, 0.12, this.master); },
  coin() { this.tone('square', 1200, 1200, 0.05, 0.08, this.master); this.tone('square', 1600, 1600, 0.12, 0.08, this.master, this.t() + 0.05); },
  count(go) { this.tone('triangle', go ? 880 : 520, go ? 880 : 520, go ? 0.4 : 0.15, 0.3); },
  win() {
    const n = [523, 659, 784, 1047, 784, 1047];
    n.forEach((f, i) => this.tone('square', f, f, 0.16, 0.14, null, this.t() + i * 0.09));
    this.cheer(1.2);
  },
  lose() { [392, 330, 262].forEach((f, i) => this.tone('triangle', f, f * 0.98, 0.25, 0.18, null, this.t() + i * 0.14)); },
  // --- music ---------------------------------------------------------------
  startMusic() { if (!this.ready) return; this.playing = true; this.nextStep = this.t() + 0.1; this.step = 0; },
  stopMusic() { this.playing = false; },
  schedule() {
    if (!this.ready || !this.playing || this.ctx.state !== 'running') return;
    const spb = 60 / this.bpm / 4; // 16th notes
    while (this.nextStep < this.t() + 0.12) {
      this.playStep(this.step, this.nextStep);
      this.nextStep += spb; this.step = (this.step + 1) % 64;
    }
  },
  playStep(s, t) {
    const I = this.intensity, m = this.mus;
    const bar = Math.floor(s / 16), b = s % 16;
    const roots = [110, 87.3, 130.8, 98]; // A F C G
    const root = roots[bar];
    if (b % 4 === 0) { // kick
      this.tone('sine', 140, 42, 0.18, 0.7, m, t);
    }
    if (b === 4 || b === 12) this.hiss('bandpass', 1800, 0.8, 0.12, 0.35, m, t); // snare
    if (I > 0.25 && b % 2 === 1) this.hiss('highpass', 7000, 1, 0.03, 0.15, m, t); // hats
    // bass: root with octave bounce
    if (b % 2 === 0) this.tone('sawtooth', b % 4 === 2 ? root * 2 : root, b % 4 === 2 ? root * 2 : root, 0.11, 0.16, m, t);
    // chord stabs on the off-beats
    if (b === 2 || b === 6 || b === 10 || b === 14) {
      const third = bar === 0 ? 1.189 : 1.26;
      [2, 2 * third, 3].forEach(k => this.tone('triangle', root * k * 2, root * k * 2, 0.09, 0.05, m, t));
    }
    // lead arpeggio when the match heats up
    if (I > 0.55 && b % 2 === 0) {
      const sc = [4, 5, 6, 8, 6, 5, 4, 3];
      const f = root * sc[(b / 2 + bar) % 8];
      this.tone('square', f, f, 0.07, 0.05, m, t);
    }
  },
};
// ---------------------------------------------------------------------------
// Arena: a floating field of hex tiles that crumbles from the outside in.
// Pointy-top axial coordinates. Tile states: 0 solid, 1 warning, 2 falling, 3 gone.
// ---------------------------------------------------------------------------
const HEX = 40;               // centre-to-corner size in world units
const SQ3 = Math.sqrt(3);
const HEX_CORNERS = [];
for (let i = 0; i < 6; i++) { const a = TAU / 6 * i - Math.PI / 6; HEX_CORNERS.push([Math.cos(a) * HEX, Math.sin(a) * HEX]); }
const hexDist = (q, r) => (Math.abs(q) + Math.abs(r) + Math.abs(q + r)) / 2;
const hexToWorld = (q, r) => [HEX * SQ3 * (q + r / 2), HEX * 1.5 * r];
function worldToHex(x, y) {
  const qf = (SQ3 / 3 * x - y / 3) / HEX, rf = (2 / 3 * y) / HEX, sf = -qf - rf;
  let q = Math.round(qf), r = Math.round(rf); const s = Math.round(sf);
  const dq = Math.abs(q - qf), dr = Math.abs(r - rf), ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  return [q, r];
}

class Arena {
  constructor(key, opts) {
    this.key = key; this.def = ARENAS[key]; this.opts = opts || {};
    this.tiles = []; this.map = new Map(); this.bumpers = []; this.vents = [];
    this.time = 0; this.nextDrop = 0; this.band = 0; this.sweep = null;
    this.rng = opts && opts.rng || Math.random;
    this.build();
  }
  add(q, r, band, type) {
    const k = q + ',' + r;
    if (this.map.has(k)) return this.map.get(k);
    const [x, y] = hexToWorld(q, r);
    const t = { q, r, x, y, band, type: type || 'normal', state: 0, t: 0, z: 0, shade: this.rng() * 0.08, wob: 0, vent: 0 };
    this.tiles.push(t); this.map.set(k, t);
    return t;
  }
  build() {
    const f = this.def.feature, R = this.opts.rings || this.def.rings;
    if (f === 'islands') {
      // Centre island plus four corner islands, joined by thin bridges.
      const isl = [[0, 0]];
      for (let i = 0; i < 4; i++) {
        const a = TAU / 4 * i + Math.PI / 4, d = HEX * SQ3 * 4.6;
        isl.push(worldToHex(Math.cos(a) * d, Math.sin(a) * d));
      }
      isl.forEach(([cq, cr], i) => {
        for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) {
          const dd = hexDist(q, r);
          if (dd <= 2) this.add(cq + q, cr + r, i === 0 ? dd : 3 + dd);
        }
      });
      // Bridges: walk from each island to the centre.
      for (let i = 1; i < isl.length; i++) {
        const [x1, y1] = hexToWorld(isl[i][0], isl[i][1]);
        const l = Math.hypot(x1, y1), px = -y1 / l * HEX * 0.9, py = x1 / l * HEX * 0.9;
        for (let s = 0; s <= 1; s += 0.04) for (const k of [-1, 0, 1]) {
          const [q, r] = worldToHex(x1 * s + px * k, y1 * s + py * k);
          if (!this.map.has(q + ',' + r)) this.add(q, r, 9, 'bridge');
        }
      }
    } else {
      const maxD = (R + 0.35) * HEX * SQ3;
      for (let q = -R; q <= R; q++) for (let r = -R; r <= R; r++) {
        const d = hexDist(q, r);
        if (d > R) continue;
        const [x, y] = hexToWorld(q, r);
        if (Math.hypot(x, y) > maxD) continue;
        this.add(q, r, d, f === 'ice' && d > 1 ? 'ice' : 'normal');
      }
    }
    if (f === 'bumpers') {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const a = TAU / n * i + 0.3, d = HEX * SQ3 * 3.1;
        const [q, r] = worldToHex(Math.cos(a) * d, Math.sin(a) * d);
        const t = this.map.get(q + ',' + r);
        if (t) this.bumpers.push({ tile: t, x: t.x, y: t.y, r: 26, hit: 0 });
      }
      const c = this.map.get('0,0'); if (c) this.bumpers.push({ tile: c, x: 0, y: 0, r: 22, hit: 0 });
    }
    if (f === 'sweeper') this.sweep = { a: 0, w: 0.6, len: HEX * SQ3 * (R + 0.6), dir: 1, flip: 12 };
    if (f === 'vents') {
      const cand = this.tiles.filter(t => t.band >= 2 && t.band <= R - 1);
      for (let i = 0; i < 9 && cand.length; i++) {
        const t = cand.splice(Math.floor(this.rng() * cand.length), 1)[0];
        t.type = 'vent'; t.vent = 3 + this.rng() * 5; this.vents.push(t);
      }
    }
    this.maxBand = Math.max(...this.tiles.map(t => t.band));
    this.band = this.maxBand;
    const quick = this.opts.quick ? 0.5 : 1;
    this.firstDrop = (this.opts.small ? 22 : 16) * quick;
    this.interval = (this.def.feature === 'islands' ? 9 : 8) * quick;
    this.nextDrop = this.firstDrop;
  }
  tileAt(x, y) {
    const [q, r] = worldToHex(x, y);
    return this.map.get(q + ',' + r) || null;
  }
  // A position is supported while its tile is solid or still shaking.
  supported(x, y) { const t = this.tileAt(x, y); return !!t && t.state < 2; }
  // An orb keeps its footing while its centre, or a point just inside its rim, is on solid ground.
  supportedOrb(x, y, r) {
    if (this.supported(x, y)) return true;
    const k = r * 0.4;
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; if (this.supported(x + Math.cos(a) * k, y + Math.sin(a) * k)) return true; }
    return false;
  }
  friction(x, y) { const t = this.tileAt(x, y); return t && t.type === 'ice' ? 'ice' : 'normal'; }
  liveTiles() { return this.tiles.filter(t => t.state === 0); }
  warnBand(b) {
    let n = 0;
    for (const t of this.tiles) if (t.band === b && t.state === 0) { t.state = 1; t.t = 2.2; n++; }
    return n;
  }
  update(dt, game) {
    this.time += dt;
    // Crumble schedule: highest band first, never the centre tile until sudden death.
    if (this.time >= this.nextDrop) {
      let b = this.band;
      while (b > 0 && !this.tiles.some(t => t.band === b && t.state === 0)) b--;
      if (b > 0) {
        if (this.warnBand(b)) game.onCrumble(b);
        this.band = b - 1;
        this.nextDrop = this.time + this.interval;
      } else {
        // Sudden death: random survivors shake loose one at a time.
        const live = this.liveTiles();
        if (live.length > 1) {
          const t = live[Math.floor(this.rng() * live.length)];
          t.state = 1; t.t = 1.6;
          this.nextDrop = this.time + Math.max(1.2, this.interval * 0.35);
        } else this.nextDrop = this.time + 99;
      }
    }
    for (const t of this.tiles) {
      if (t.state === 1) {
        t.t -= dt; t.wob += dt;
        if (t.t <= 0) { t.state = 2; t.t = 0; game.onTileFall(t); }
      } else if (t.state === 2) {
        t.t += dt; t.z = 260 * t.t * t.t;
        if (t.t > 1.2) t.state = 3;
      }
      if (t.type === 'vent' && t.state === 0) {
        t.vent -= dt;
        if (t.vent <= 0) { game.onVent(t); t.vent = 4 + this.rng() * 5; }
      }
    }
    for (const b of this.bumpers) { b.hit = Math.max(0, b.hit - dt * 4); }
    if (this.sweep) {
      const s = this.sweep;
      s.flip -= dt;
      if (s.flip <= 0) { s.dir *= -1; s.flip = 9 + this.rng() * 6; }
      const speed = s.w * (1 + Math.min(1, this.time / 90) * 0.6);
      s.a += speed * s.dir * dt;
      s.len = Math.max(HEX * 2, s.len);
    }
  }
  spawnPoints(n) {
    const R = this.opts.rings || this.def.rings;
    const pts = [];
    if (this.def.feature === 'islands') {
      // two per outer island, plus the middle
      const outer = this.tiles.filter(t => t.band === 3);
      for (let i = 0; i < n; i++) {
        const t = outer[Math.floor(i * outer.length / n)] || this.tiles[0];
        pts.push([t.x, t.y]);
      }
      return pts;
    }
    const d = HEX * SQ3 * Math.max(1.5, R - 2.8);
    const off = this.rng() * TAU;
    for (let i = 0; i < n; i++) {
      const a = off + TAU / n * i;
      const [q, r] = worldToHex(Math.cos(a) * d, Math.sin(a) * d);
      const t = this.map.get(q + ',' + r);
      pts.push(t ? [t.x, t.y] : [Math.cos(a) * d, Math.sin(a) * d]);
    }
    return pts;
  }
  bounds() {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const t of this.tiles) if (t.state < 2) {
      x0 = Math.min(x0, t.x); y0 = Math.min(y0, t.y); x1 = Math.max(x1, t.x); y1 = Math.max(y1, t.y);
    }
    if (x0 > x1) { x0 = y0 = -100; x1 = y1 = 100; }
    return [x0 - HEX, y0 - HEX, x1 + HEX, y1 + HEX * 1.6];
  }
}
// ---------------------------------------------------------------------------
// Orbs: the bumper creatures. Physics, dash, heat, abilities and power-ups.
// Simulation runs on a fixed 1/120 s step so results match at any refresh rate.
// ---------------------------------------------------------------------------
const STEP = 1 / 120;
const BASE_R = 24;
const ACCEL = 1500, DRAG = 5.6, ICE_ACCEL = 720, ICE_DRAG = 1.7;
const DASH_MIN = 640, DASH_MAX = 1120, DASH_CD = 1.5, CHARGE_T = 0.6;
const POWERUPS = {
  mega: { name: 'MEGA', col: '#ff7a3a', icon: '⬤', t: 6 },
  turbo: { name: 'TURBO', col: '#45e0ff', icon: '⚡', t: 6 },
  spikes: { name: 'SPIKES', col: '#ff4d6d', icon: '✸', t: 7 },
  shield: { name: 'SHIELD', col: '#9dff6a', icon: '◈', t: 8 },
};
const POWER_KEYS = Object.keys(POWERUPS);

let ORB_ID = 0;
class Orb {
  constructor(o) {
    this.id = ++ORB_ID;
    this.name = o.name; this.human = !!o.human; this.slot = o.slot || 0; // 1 = P1, 2 = P2
    this.skin = o.skin; this.hat = o.hat; this.ability = o.ability;
    this.x = o.x; this.y = o.y; this.vx = 0; this.vy = 0;
    this.baseR = BASE_R * (o.scale || 1); this.r = this.baseR; this.baseMass = 1 * (o.scale || 1) ** 2; this.mass = this.baseMass;
    this.heat = 0; this.alive = true; this.falling = 0; this.fz = 0;
    this.face = rand(0, TAU); this.look = 0; this.blink = rand(1, 4); this.squash = 0;
    this.dashCd = rand(0.2, 0.8); this.dashT = 0; this.charging = 0; this.chargeTick = 0;
    this.abCd = rand(1.5, 3); this.abT = 0; this.magnetT = 0;
    this.power = null; this.powerT = 0; this.shieldHits = 0;
    this.lastHitBy = null; this.lastHitT = 0; this.lastHitCharged = false;
    this.kos = 0; this.koTimes = []; this.place = 0; this.survived = 0;
    this.inMove = [0, 0]; this.wantDash = false; this.dashHeld = false; this.wantAbility = false;
    this.hitFlash = 0; this.teeter = 0; this.trail = []; this.spawnT = 0.6; this.emote = 0;
    this.ai = o.ai || null; this.mods = o.mods || {};
  }
  get dashing() { return this.dashT > 0; }
  get anchored() { return this.abT > 0 && this.ability === 'anchor'; }
  canAct() { return this.alive && !this.falling; }
  // Called by the game every fixed step. Input is set beforehand on inMove/wantDash/dashHeld/wantAbility.
  step(dt, G) {
    if (!this.alive) return;
    if (this.falling) {
      this.falling += dt; this.fz += dt * 600 * this.falling;
      this.x += this.vx * dt * 0.35; this.y += this.vy * dt * 0.35;
      if (this.falling > 0.9) { this.alive = false; G.onEliminated(this); }
      return;
    }
    this.survived += dt;
    const turbo = this.power === 'turbo';
    const ice = G.arena.friction(this.x, this.y) === 'ice';
    let acc = ice ? ICE_ACCEL : ACCEL, drag = ice ? ICE_DRAG : DRAG;
    if (turbo) acc *= 1.35;
    if (this.charging > 0) acc *= 0.35;
    if (this.anchored) acc *= 0.25;
    if (this.dashing) drag *= 0.25;
    const [mx, my] = this.inMove;
    const ml = Math.hypot(mx, my);
    if (ml > 0.05) {
      const k = Math.min(1, ml);
      this.vx += mx / ml * acc * k * dt; this.vy += my / ml * acc * k * dt;
      this.face = Math.atan2(my, mx);
    }
    const f = Math.exp(-drag * dt);
    this.vx *= f; this.vy *= f;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 30) this.look = Math.atan2(this.vy, this.vx);

    // timers
    this.dashT = Math.max(0, this.dashT - dt);
    const cdMul = (turbo ? 0.5 : 1) * (this.mods.hyper ? 0.5 : 1);
    this.dashCd = Math.max(0, this.dashCd - dt / cdMul);
    this.abCd = Math.max(0, this.abCd - dt);
    this.spawnT = Math.max(0, this.spawnT - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.squash *= Math.exp(-dt * 10);
    this.emote = Math.max(0, this.emote - dt);
    this.lastHitT += dt;
    this.heat = Math.max(0, this.heat - dt * 0.5);
    if (this.abT > 0) {
      this.abT -= dt;
      if (this.ability === 'magnet') G.magnetPull(this, dt, this.abT <= 0);
    }
    if (this.power) {
      this.powerT -= dt;
      if (this.powerT <= 0) this.setPower(null);
    }
    this.blink -= dt; if (this.blink < -0.12) this.blink = rand(2, 5);

    // dash: hold to charge, release to go
    if (this.dashHeld && this.dashCd <= 0 && !this.dashing) {
      this.charging += dt;
      this.chargeTick -= dt;
      if (this.chargeTick <= 0 && this.human) { AU.charge(Math.min(1, this.charging / CHARGE_T)); this.chargeTick = 0.09; }
    }
    if (this.wantDash) {
      this.wantDash = false;
      if (this.dashCd <= 0 && !this.dashing) this.doDash(G);
      this.charging = 0;
    }
    if (this.wantAbility) {
      this.wantAbility = false;
      if (this.abCd <= 0) G.useAbility(this);
    }
    if (this.dashing && G.tick % 2 === 0) this.trail.push([this.x, this.y, 0.25]);
    for (const p of this.trail) p[2] -= dt;
    while (this.trail.length && this.trail[0][2] <= 0) this.trail.shift();

    // Off the edge? Fast movers go straight over. Slow ones teeter for a moment
    // and can still roll back to safety, which makes for clutch saves.
    if (!G.arena.supportedOrb(this.x, this.y, this.r)) {
      const fast = Math.hypot(this.vx, this.vy) > 300;
      this.teeter += dt;
      if (fast && this.teeter > 0.02 || this.teeter > 0.5) {
        this.falling = 0.0001; this.charging = 0; this.teeter = 0;
        G.onFall(this);
      } else { const f2 = Math.exp(-9 * dt); this.vx *= f2; this.vy *= f2; }
    } else this.teeter = Math.max(0, this.teeter - dt * 2);
  }
  doDash(G) {
    const c = clamp(this.charging / CHARGE_T, 0, 1);
    let [mx, my] = this.inMove;
    let l = Math.hypot(mx, my);
    if (l < 0.1) { mx = Math.cos(this.face); my = Math.sin(this.face); l = 1; }
    const p = lerp(DASH_MIN, DASH_MAX, c);
    this.vx = this.vx * 0.3 + mx / l * p; this.vy = this.vy * 0.3 + my / l * p;
    this.face = Math.atan2(my, mx);
    this.dashT = 0.2 + c * 0.1; this.dashCharge = c;
    this.dashCd = DASH_CD + c * 0.35;
    this.squash = 0.5;
    G.onDash(this, c);
  }
  setPower(k) {
    if (this.power === 'mega' && k !== 'mega') { this.r = this.baseR; this.mass = this.baseMass; }
    this.power = k; this.powerT = k ? POWERUPS[k].t : 0;
    if (k === 'mega') { this.r = this.baseR * 1.45; this.mass = this.baseMass * 2.6; }
    if (k === 'shield') this.shieldHits = 1;
  }
  effMass() { return this.mass * (this.anchored ? 7 : 1); }
}
// ---------------------------------------------------------------------------
// CPU rivals. Each one has a skill (0..1, from the player's rank) and a
// personality. They read the arena, line up shoves toward the nearest edge,
// dodge incoming dashes and use their ability, with human-like reaction lag.
// ---------------------------------------------------------------------------
const PERSONAS = [
  { id: 'brawler', aggro: 1.0, caution: 0.6, greed: 0.5 },
  { id: 'hunter', aggro: 0.85, caution: 0.8, greed: 0.3 },
  { id: 'turtle', aggro: 0.45, caution: 1.0, greed: 0.6 },
  { id: 'opportunist', aggro: 0.7, caution: 0.85, greed: 0.9 },
];
function makeAI(skill) {
  return { skill, p: pick(PERSONAS), rest: rand(1.5, 3.5), strafe: Math.random() < 0.5 ? 1 : -1, think: 0, target: null, mx: 0, my: 0, chargeFor: 0, holdT: 0, err: rand(-1, 1), wander: rand(0, TAU) };
}
const AI = {
  // Fraction of probe points around (x, y) that are on solid ground.
  safeAt(G, x, y) {
    const t = G.arena.tileAt(x, y);
    if (!t || t.state >= 2) return 0;
    return t.state === 1 ? 0.25 : 1;
  },
  centre(G) {
    let sx = 0, sy = 0, n = 0;
    for (const t of G.arena.tiles) if (t.state === 0) { sx += t.x; sy += t.y; n++; }
    return n ? [sx / n, sy / n] : [0, 0];
  },
  update(o, G, dt) {
    const a = o.ai, s = a.skill;
    if (o.charging > 0) { // keep holding until the planned charge is reached
      a.holdT -= dt;
      if (a.holdT <= 0) { o.dashHeld = false; o.wantDash = true; }
    }
    a.rest -= dt;
    a.think -= dt;
    if (o.teeter > 0 && a.think > 0.05) a.think = 0.05;
    if (a.think > 0) return;
    a.think = lerp(0.32, 0.08, s) * rand(0.8, 1.25);
    const [cx, cy] = this.centre(G);
    // 1) Danger: look ahead along our velocity.
    const look = lerp(0.18, 0.42, s) * (G.arena.friction(o.x, o.y) === 'ice' ? 2.2 : 1);
    const px = o.x + o.vx * look, py = o.y + o.vy * look;
    const here = this.safeAt(G, o.x, o.y), ahead = this.safeAt(G, px, py);
    let mx = 0, my = 0;
    const toC = Math.atan2(cy - o.y, cx - o.x);
    const danger = (here < 1 ? 1 : 0) + (ahead < 1 ? 1 : 0) + (o.teeter > 0 ? 2 : 0);
    if (danger && (o.teeter > 0 && Math.random() < lerp(0.5, 0.95, s) || Math.random() < lerp(0.55, 1, s) * a.p.caution)) {
      // Steer to the safest of 8 directions, biased to the centre.
      let best = -1, ba = toC;
      for (let i = 0; i < 8; i++) {
        const ang = toC + (i - 3.5) * 0.45;
        let sc = 0;
        for (const d of [60, 120]) sc += this.safeAt(G, o.x + Math.cos(ang) * d, o.y + Math.sin(ang) * d);
        sc -= Math.abs(angDiff(ang, toC)) * 0.2;
        if (sc > best) { best = sc; ba = ang; }
      }
      mx = Math.cos(ba); my = Math.sin(ba);
      // Panic ability: blink or anchor when about to go over.
      if (ahead === 0 && o.abCd <= 0 && Math.random() < s) {
        if (o.ability === 'blink') { o.inMove = [mx, my]; o.wantAbility = true; }
        if (o.ability === 'anchor' && here === 1) o.wantAbility = true;
      }
      o.inMove = [mx, my];
      return;
    }
    // 2) Threat: someone dashing at us?
    for (const e of G.orbs) {
      if (e === o || !e.canAct() || !e.dashing) continue;
      const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy);
      if (d > 200) continue;
      const head = Math.atan2(e.vy, e.vx), to = Math.atan2(dy, dx);
      if (Math.abs(angDiff(head, to)) < 0.5 && Math.random() < s * 0.8) {
        if (o.ability === 'anchor' && o.abCd <= 0) { o.wantAbility = true; return; }
        const side = Math.sign(angDiff(head, toC)) || 1;
        const ang = head + side * Math.PI / 2;
        o.inMove = [Math.cos(ang), Math.sin(ang)];
        if (o.dashCd <= 0 && d < 120 && Math.random() < s * 0.6 && this.safeAt(G, o.x + Math.cos(ang) * 200, o.y + Math.sin(ang) * 200) === 1) o.wantDash = true;
        return;
      }
    }
    // 3) Power-ups within reach.
    for (const p of G.pickups) {
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < 260 * a.p.greed + 60 && this.safeAt(G, p.x, p.y) === 1) {
        const ang = Math.atan2(p.y - o.y, p.x - o.x);
        o.inMove = [Math.cos(ang), Math.sin(ang)];
        return;
      }
    }
    // 4) Hunt: pick a victim, preferring close, hot and near-the-edge ones.
    if (!a.target || !a.target.canAct() || Math.random() < 0.08) {
      let best = -1e9, tgt = null;
      for (const e of G.orbs) {
        if (e === o || !e.canAct()) continue;
        const d = Math.hypot(e.x - o.x, e.y - o.y);
        const edge = Math.hypot(e.x - cx, e.y - cy);
        let sc = -d + edge * 0.5 + e.heat * 2 + rand(0, 80);
        if (e.human && G.mode === 'royale') sc += G.humanFocus; // slightly gentler early on
        if (sc > best) { best = sc; tgt = e; }
      }
      a.target = tgt;
    }
    const t = a.target;
    if (!t) { o.inMove = [Math.cos(toC), Math.sin(toC)]; return; }
    // Push direction: from the centre through the target, towards its nearest edge.
    let ox = t.x - cx, oy = t.y - cy;
    const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
    const want = o.r + t.r + lerp(40, 70, s);
    const gx = t.x - ox * want, gy = t.y - oy * want;
    const dx = t.x - o.x, dy = t.y - o.y, dist = Math.hypot(dx, dy);
    const aim = Math.atan2(dy, dx);
    const align = Math.abs(angDiff(aim, Math.atan2(oy, ox)));
    let ang;
    if (a.rest > 0) { // between attacks: circle at a distance, looking for an opening
      const away = Math.atan2(o.y - t.y, o.x - t.x) + a.strafe * 0.5;
      const hx = t.x + Math.cos(away) * 170, hy = t.y + Math.sin(away) * 170;
      ang = Math.atan2(hy - o.y, hx - o.x);
      const k = Math.min(1, Math.hypot(hx - o.x, hy - o.y) / 80) * 0.8;
      if (Math.random() < 0.02) a.strafe *= -1;
      o.inMove = [Math.cos(ang) * k, Math.sin(ang) * k];
      return;
    }
    if (align < 0.7 || dist < want * 0.9) ang = aim; // lined up: go straight in
    else ang = Math.atan2(gy - o.y, gx - o.x);   // swing round behind it
    ang += a.err * (1 - s) * 0.5;
    mx = Math.cos(ang) * lerp(0.75, 1, a.p.aggro); my = Math.sin(ang) * lerp(0.75, 1, a.p.aggro);
    o.inMove = [mx, my];
    // Dash when lined up and the landing spot is safe.
    if (o.dashCd <= 0 && !o.dashing && o.charging === 0 && dist < lerp(150, 230, s) && align < lerp(0.9, 0.55, s)) {
      const land = 180;
      const lx = o.x + Math.cos(aim) * land, ly = o.y + Math.sin(aim) * land;
      const safeLand = this.safeAt(G, lx, ly) === 1 || Math.random() > s; // weaker bots overshoot
      if (safeLand && Math.random() < a.p.aggro * lerp(0.2, 0.55, s)) {
        o.inMove = [Math.cos(aim), Math.sin(aim)];
        if (dist > 120 && t.heat > 30 && Math.random() < s) { o.dashHeld = true; a.holdT = rand(0.25, 0.55); }
        else o.wantDash = true;
        a.rest = rand(1.4, 3.4) * lerp(1.5, 0.75, s) * (1.3 - a.p.aggro * 0.4);
      }
    }
    // Abilities on offence.
    if (o.abCd <= 0 && Math.random() < s * 0.7) {
      const near = G.orbs.filter(e => e !== o && e.canAct() && Math.hypot(e.x - o.x, e.y - o.y) < 150);
      if (o.ability === 'shock' && near.length && near.some(e => Math.hypot(e.x - cx, e.y - cy) > Math.hypot(o.x - cx, o.y - cy))) o.wantAbility = true;
      if (o.ability === 'magnet' && near.length >= 2 && here === 1) o.wantAbility = true;
      if (o.ability === 'blink' && dist > 250 && align < 0.5) {
        const bx = o.x + Math.cos(aim) * 150, by = o.y + Math.sin(aim) * 150;
        if (this.safeAt(G, bx, by) === 1) o.wantAbility = true;
      }
    }
    // Sweeper: dash through the beam rather than get swatted.
    if (G.arena.sweep && o.dashCd <= 0) {
      const sw = G.arena.sweep, myA = Math.atan2(o.y, o.x), d0 = Math.hypot(o.x, o.y);
      const da = angDiff(sw.a, myA) * sw.dir;
      if (d0 < sw.len && da > 0 && da < 0.35 && Math.random() < s) {
        const perp = sw.a + sw.dir * Math.PI / 2 * -1;
        o.inMove = [Math.cos(perp), Math.sin(perp)]; o.wantDash = true;
      }
    }
  },
};
// ---------------------------------------------------------------------------
// The match: modes, collisions, abilities, hazards, KOs, rewards.
// ---------------------------------------------------------------------------
const G = {
  mode: null, state: 'idle', arena: null, orbs: [], pickups: [], fx: [], texts: [], feed: [],
  tick: 0, time: 0, shake: 0, hitstop: 0, timeScale: 1, slowT: 0, acc: 0, countdown: 0,
  humanFocus: 0, pickupT: 8, mods: {}, party: null, daily: null, result: null, tutorial: null,
  players: [], endT: 0, intensity: 0,

  // --- setup ---------------------------------------------------------------
  start(mode, opts) {
    opts = opts || {};
    this.mode = mode; this.orbs = []; this.pickups = []; this.fx = []; this.texts = []; this.feed = [];
    this.tick = 0; this.time = 0; this.shake = 0; this.hitstop = 0; this.timeScale = 1; this.slowT = 0; this.acc = 0;
    this.result = null; this.endT = 0; this.demoEnd = 0; this.players = []; this.tutorial = null; this.intensity = 0;
    const S = Save.d;
    let arenaKey, rng = null, mod = { id: 'none' };
    let cpu = 7, skill = skillFor(S.rp);
    this.humanFocus = lerp(-170, 0, clamp(S.rp / 600, 0, 1));
    if (mode === 'tutorial') {
      arenaKey = 'meadow'; cpu = 3; skill = 0.05; this.humanFocus = -400;
      this.tutorial = { step: 0, moved: 0, dashed: 0, charged: 0, ab: 0, t: 0 };
    } else if (mode === 'daily') {
      const key = todayKey();
      rng = makeRng(key * 7 + 3);
      const avail = ARENA_KEYS;
      arenaKey = avail[Math.floor(rng() * avail.length)];
      mod = MODIFIERS[1 + Math.floor(rng() * (MODIFIERS.length - 1))];
      skill = clamp(skillFor(S.rp) + 0.1, 0.35, 1);
      this.humanFocus = 0;
      this.daily = { key, mod };
    } else if (mode === 'demo') {
      arenaKey = pick(ARENA_KEYS); cpu = 6; skill = 0.6; this.humanFocus = 0;
    } else if (mode === 'party') {
      arenaKey = opts.arena || pick(ARENA_KEYS);
      cpu = S.partyBots; skill = 0.45; this.humanFocus = 0;
    } else {
      arenaKey = this.pickArena();
    }
    this.mods = {
      hyper: mod.id === 'hyper', heavy: mod.id === 'heavyhit', rain: mod.id === 'powerups',
      scale: mod.id === 'giant' ? 1.35 : mod.id === 'tiny' ? 0.78 : 1,
    };
    this.mod = mod;
    const total = (mode === 'party' ? 2 : mode === 'demo' ? 0 : 1) + cpu;
    this.arena = new Arena(arenaKey, { rng: rng || Math.random, quick: mod.id === 'quick', small: mode === 'tutorial', rings: total <= 4 ? 5 : total <= 6 ? 6 : 0 });
    if (mode === 'tutorial') this.arena.nextDrop = 30; // a gentle first arena
    const humans = mode === 'party' ? 2 : mode === 'demo' ? 0 : 1;
    const pts = this.arena.spawnPoints(humans + cpu);
    const names = CPU_NAMES.slice().sort(() => (rng || Math.random)() - 0.5);
    const skins = Object.keys(SKINS), hats = Object.keys(HATS);
    for (let i = 0; i < humans + cpu; i++) {
      const [x, y] = pts[i];
      let o;
      if (i < humans) {
        const p2 = i === 1;
        o = new Orb({
          name: mode === 'party' ? (p2 ? 'P2' : 'P1') : 'YOU', human: true, slot: i + 1, x, y,
          skin: p2 ? (S.skin === 'sky' ? 'lime' : 'sky') : S.skin, hat: p2 ? 'cap' : S.hat,
          ability: p2 ? (S.p2ability || 'shock') : S.ability, scale: this.mods.scale, mods: this.mods,
        });
        this.players.push(o);
      } else {
        const sk = mode === 'tutorial' ? 0.05 : clamp(skill + rand(-0.12, 0.08), 0.05, 1);
        const abil = mode === 'tutorial' ? 'shock' : pick(ABILITY_KEYS.filter(k => ABILITIES[k].rank <= Math.max(1, rankOf(S.rp).i + 1)));
        o = new Orb({
          name: names[i % names.length], x, y, skin: pick(skins.filter(k => k !== S.skin && !(SIMILAR[S.skin] || []).includes(k))), hat: Math.random() < 0.55 ? pick(hats) : 'none',
          ability: abil, ai: makeAI(sk), scale: this.mods.scale, mods: this.mods,
        });
        if (mode === 'tutorial') { o.ai.p = PERSONAS[2]; o.ai.skill = 0.35; o.ai.rest = rand(5, 9); o.dashCd = 3; }
      }
      o.face = Math.atan2(-y, -x);
      this.orbs.push(o);
    }
    this.pickupT = this.mods.rain ? 3 : rand(7, 10);
    this.state = 'countdown'; this.countdown = mode === 'tutorial' ? 0.01 : 1.6;
    this.camInit = true;
    if (mode !== 'demo') S.arenasSeen[arenaKey] = 1;
    AU.intensity = 0; AU.quiet = mode === 'demo';
    UI.onMatchStart();
  },
  pickArena() {
    const S = Save.d, tier = rankOf(S.rp).i;
    const avail = ARENA_KEYS.filter(k => ARENAS[k].unlock <= tier && (!ARENAS[k].minRp || S.rp >= ARENAS[k].minRp));
    const fresh = avail.filter(k => !S.arenasSeen[k]);
    if (fresh.length) return fresh[0];
    if (S.lastArena && avail.length > 1) { const a = pick(avail.filter(k => k !== S.lastArena)); S.lastArena = a; return a; }
    const a = pick(avail); S.lastArena = a; return a;
  },
  alive() { return this.orbs.filter(o => o.alive && !o.falling); },

  // --- main update -----------------------------------------------------------
  frame(dt) {
    if (this.state === 'idle') return;
    if (this.hitstop > 0) { this.hitstop -= dt; this.decayFx(dt * 0.3); return; }
    if (this.slowT > 0) { this.slowT -= dt; this.timeScale = lerp(1, 0.25, clamp(this.slowT / 0.6, 0, 1)); } else this.timeScale = 1;
    this.acc += dt * this.timeScale;
    let n = 0;
    while (this.acc >= STEP && n < 24) { this.acc -= STEP; this.step(STEP); n++; }
    if (n >= 24) this.acc = 0;
    this.decayFx(dt);
  },
  step(dt) {
    this.tick++;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown / 0.8);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown / 0.8);
      if (after !== before && after > 0 && this.mode !== 'demo') { UI.big(after === 2 ? 'READY' : '', '#fff'); AU.count(false); }
      if (this.countdown <= 0) { this.state = 'play'; if (this.mode !== 'demo') { UI.big('GO!', '#ffe25a'); AU.count(true); AU.startMusic(); } }
      Input.apply(this); // let players aim, not move
      for (const o of this.orbs) { o.wantDash = o.wantAbility = false; o.dashHeld = false; o.charging = 0; }
      return;
    }
    if (this.state !== 'play' && this.state !== 'spectate' && this.state !== 'ending') return;
    this.time += dt;
    Input.apply(this);
    for (const o of this.orbs) if (o.ai && o.canAct()) AI.update(o, this, dt);
    for (const o of this.orbs) o.step(dt, this);
    this.collide(dt);
    this.hazards(dt);
    this.arena.update(dt, this);
    this.updatePickups(dt);
    if (this.tutorial) this.tutorialStep(dt);
    const left = this.alive().length, total = this.orbs.length;
    this.intensity = clamp(1 - (left - 2) / Math.max(1, total - 2), 0, 1) * 0.7 + clamp(this.time / 90, 0, 1) * 0.3;
    AU.intensity = this.intensity;
    if (this.state === 'ending') { this.endT -= dt; if (this.endT <= 0) this.finish(); }
  },
  decayFx(dt) {
    for (const p of this.fx) {
      p.life -= dt;
      if (p.type === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.z = (p.z || 0) + (p.vz || 0) * dt; p.vz = (p.vz || 0) - 900 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.4; } p.vx *= 0.97; p.vy *= 0.97; }
    }
    this.fx = this.fx.filter(p => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  },

  // --- physics ---------------------------------------------------------------
  collide() {
    const os = this.orbs;
    for (let i = 0; i < os.length; i++) {
      const a = os[i]; if (!a.canAct()) continue;
      for (let j = i + 1; j < os.length; j++) {
        const b = os[j]; if (!b.canAct()) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy), md = a.r + b.r;
        if (d >= md || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        const ma = a.effMass(), mb = b.effMass();
        const ov = md - d, ia = 1 / ma, ib = 1 / mb, it = ia + ib;
        a.x -= nx * ov * ia / it; a.y -= ny * ov * ia / it; b.x += nx * ov * ib / it; b.y += ny * ov * ib / it;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const impact = -vn;
        const jimp = -(1.4) * vn / it;
        a.vx -= jimp * ia * nx; a.vy -= jimp * ia * ny; b.vx += jimp * ib * nx; b.vy += jimp * ib * ny;
        // Extra knockback: who was the attacker?
        const sa = a.vx * nx + a.vy * ny, sb = -(b.vx * nx + b.vy * ny);
        this.knock(a, b, nx, ny, impact, sa >= sb || a.dashing);
        this.knock(b, a, -nx, -ny, impact, sb > sa || b.dashing);
        const power = clamp(impact / 1100, 0, 1);
        const cx = a.x + nx * a.r, cy = a.y + ny * a.r;
        this.sparks(cx, cy, 6 + power * 18, power > 0.5 ? '#fff6c0' : '#ffffff', 120 + power * 380);
        if (power > 0.25) this.ring(cx, cy, 10, 40 + power * 70, 0.25, '#ffffff');
        a.squash = b.squash = 0.25 + power * 0.5;
        if (a.human || b.human || power > 0.5) AU.bump(power, Math.max(a.mass, b.mass));
        if (power > 0.55) {
          this.hitstop = Math.max(this.hitstop, 0.03 + power * 0.08);
          this.shake = Math.max(this.shake, 4 + power * 12);
          if (a.dashing && b.dashing) this.text(cx, cy - 30, 'CLASH!', '#ffe25a', 26);
        }
        if ((a.human || b.human) && power > 0.3) Input.rumble(power);
      }
    }
  },
  // Victim v hit by attacker a along (nx, ny) pointing from a to v.
  knock(a, v, nx, ny, impact, attacking) {
    if (!attacking) return;
    const ch = a.dashing ? (a.dashCharge || 0) : 0;
    // Base push comes from the collision itself; HEAT makes every hit fly further.
    let k = ch * 0.35 + (a.power === 'spikes' ? 0.4 : 0);
    let heatK = (a.dashing ? 0.6 + ch * 0.3 : 0.3) * (v.heat / 100);
    if (this.mods.heavy) { k += 0.25; heatK *= 1.5; }
    let heatGain = impact < (a.dashing ? 150 : 260) ? 0 : impact * (a.dashing ? 0.02 : 0.008) * (a.power === 'spikes' ? 1.5 : 1) * (this.mods.heavy ? 2 : 1);
    if (v.anchored) { k = 0; heatK *= 0.1; heatGain = 0; }
    if (v.shieldHits > 0 && impact > 250) {
      v.shieldHits = 0; v.setPower(null); k = 0; heatK *= 0.2; heatGain = 0;
      this.ring(v.x, v.y, v.r, v.r * 2.6, 0.35, POWERUPS.shield.col); AU.bumper();
    }
    const kb = impact * (k + heatK) / v.effMass();
    v.vx += nx * kb; v.vy += ny * kb;
    v.heat = Math.min(250, v.heat + heatGain);
    if (impact > 140) {
      v.lastHitBy = a; v.lastHitT = 0; v.lastHitCharged = a.dashing && (a.dashCharge || 0) > 0.45;
      v.hitFlash = 1;
    }
  },
  hazards(dt) {
    const A = this.arena;
    for (const b of A.bumpers) {
      if (b.tile.state >= 2) continue;
      for (const o of this.orbs) {
        if (!o.canAct()) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy), md = b.r + o.r;
        if (d >= md || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        o.x = b.x + nx * md; o.y = b.y + ny * md;
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) { o.vx -= 2 * vn * nx; o.vy -= 2 * vn * ny; }
        o.vx += nx * 380 / o.effMass(); o.vy += ny * 380 / o.effMass();
        if (!o.anchored) o.heat = Math.min(250, o.heat + 6);
        b.hit = 1; AU.bumper(); this.shake = Math.max(this.shake, 4);
        this.sparks(b.x + nx * b.r, b.y + ny * b.r, 10, '#fff07a', 300);
      }
    }
    const s = A.sweep;
    if (s) {
      const ux = Math.cos(s.a), uy = Math.sin(s.a);
      for (const o of this.orbs) {
        if (!o.canAct() || o.dashing) continue;
        const along = o.x * ux + o.y * uy;
        if (along < 0 || along > s.len) continue;
        const perp = -o.x * uy + o.y * ux; // signed distance from the beam
        if (Math.abs(perp) > o.r + 9) continue;
        if (o.sweepCd && this.time < o.sweepCd) continue;
        o.sweepCd = this.time + 0.35;
        const side = s.dir; // beam pushes things the way it turns
        const px = -uy * side, py = ux * side;
        const f = (380 + along * 0.5) * (1 + o.heat / 150) / o.effMass();
        o.vx += px * f; o.vy += py * f;
        o.x += px * 8; o.y += py * 8;
        if (!o.anchored) o.heat = Math.min(250, o.heat + 14);
        o.hitFlash = 1; o.lastHitT = 99; // the sweeper takes the credit
        AU.bump(0.6, 1); this.shake = Math.max(this.shake, 6);
        this.sparks(o.x, o.y, 14, '#ffd6e8', 380);
      }
    }
  },
  onVent(t) {
    if (this.mode !== 'demo') AU.vent();
    for (let i = 0; i < 26; i++) this.fx.push({ type: 'p', x: t.x + rand(-20, 20), y: t.y + rand(-20, 20), vx: rand(-80, 80), vy: rand(-80, 80), vz: rand(500, 900), z: 0, life: rand(0.6, 1.1), max: 1.1, col: pick(['#ff6a2b', '#ffb03a', '#ffe08a']), size: rand(3, 7) });
    this.ring(t.x, t.y, 10, 90, 0.4, '#ff8a3a');
    for (const o of this.orbs) {
      if (!o.canAct()) continue;
      const d = Math.hypot(o.x - t.x, o.y - t.y);
      if (d > 62) continue;
      let ang = Math.atan2(o.y - t.y, o.x - t.x); if (d < 5) ang = rand(0, TAU);
      const f = 520 * (1 + o.heat / 150) / o.effMass();
      o.vx += Math.cos(ang) * f; o.vy += Math.sin(ang) * f;
      if (!o.anchored) o.heat = Math.min(250, o.heat + 18);
      o.hitFlash = 1; o.lastHitT = 99;
      this.shake = Math.max(this.shake, 8);
    }
  },
  magnetPull(o, dt, release) {
    for (const e of this.orbs) {
      if (e === o || !e.canAct()) continue;
      const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy);
      if (d > 270 || d < 1) continue;
      if (release) {
        if (d < 150) {
          const f = 450 * (1 + e.heat / 110) / e.effMass();
          e.vx -= dx / d * f; e.vy -= dy / d * f;
          e.lastHitBy = o; e.lastHitT = 0; e.lastHitCharged = false; e.heat = Math.min(250, e.heat + 10);
        }
      } else {
        const f = 1100 * dt * (1 - d / 300);
        e.vx += dx / d * f; e.vy += dy / d * f;
      }
    }
    if (release) { this.ring(o.x, o.y, o.r, 150, 0.35, '#c084ff'); AU.shock(); this.shake = Math.max(this.shake, 6); }
  },
  useAbility(o) {
    const ab = ABILITIES[o.ability];
    o.abCd = ab.cd;
    if (o.human && this.mode !== 'party') Missions.track('ability', 1);
    if (this.tutorial) this.tutorial.ab++;
    if (o.ability === 'shock') {
      for (const e of this.orbs) {
        if (e === o || !e.canAct()) continue;
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
        if (d > 175 || d < 1) continue;
        const f = 480 * (1 - d / 175 * 0.55) * (1 + e.heat / 110) / e.effMass() * (e.anchored ? 0.2 : 1);
        e.vx += dx / d * f; e.vy += dy / d * f;
        if (!e.anchored) e.heat = Math.min(250, e.heat + 12);
        e.lastHitBy = o; e.lastHitT = 0; e.lastHitCharged = false; e.hitFlash = 1;
      }
      this.ring(o.x, o.y, o.r, 180, 0.4, '#ffe25a'); this.ring(o.x, o.y, o.r, 120, 0.3, '#ffffff');
      AU.shock(); this.shake = Math.max(this.shake, 9); o.squash = 0.7;
    } else if (o.ability === 'anchor') {
      o.abT = 1.6; o.vx *= 0.3; o.vy *= 0.3; AU.anchor(); this.ring(o.x, o.y, o.r * 2, o.r, 0.3, '#9fb3c8');
    } else if (o.ability === 'blink') {
      let [mx, my] = o.inMove; let l = Math.hypot(mx, my);
      if (l < 0.1) { mx = Math.cos(o.face); my = Math.sin(o.face); l = 1; }
      this.sparks(o.x, o.y, 14, '#d9c2ff', 200);
      o.x += mx / l * 165; o.y += my / l * 165; o.vx *= 0.4; o.vy *= 0.4;
      this.sparks(o.x, o.y, 14, '#ffffff', 200); this.ring(o.x, o.y, 4, 60, 0.25, '#d9c2ff');
      AU.blink();
    } else if (o.ability === 'magnet') {
      o.abT = 1.1; AU.magnet();
    }
    if (o.human) UI.abilityUsed(o);
  },
  updatePickups(dt) {
    if (this.mode === 'tutorial') return;
    this.pickupT -= dt;
    const max = this.mods.rain ? 4 : 2;
    if (this.pickupT <= 0 && this.pickups.length < max && this.state === 'play' || this.state === 'spectate' && this.pickupT <= 0) {
      this.pickupT = this.mods.rain ? rand(2.5, 4) : rand(9, 14);
      const safe = this.arena.tiles.filter(t => t.state === 0 && t.band < this.arena.band && t.type !== 'vent');
      if (safe.length) {
        const t = pick(safe), k = pick(POWER_KEYS);
        this.pickups.push({ x: t.x, y: t.y, k, t: 0, tile: t });
      }
    }
    for (const p of this.pickups) {
      p.t += dt;
      if (p.tile.state >= 2) p.dead = true;
      for (const o of this.orbs) {
        if (!o.canAct() || p.dead) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + 18) {
          p.dead = true; o.setPower(p.k);
          const P = POWERUPS[p.k];
          this.text(o.x, o.y - o.r - 20, P.name + '!', P.col, 22);
          this.ring(p.x, p.y, 6, 60, 0.3, P.col);
          if (o.human) { AU.pickup(); if (this.mode !== 'party') Missions.track('power', 1); }
        }
      }
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  },

  // --- events ------------------------------------------------------------------
  onDash(o, c) {
    if (o.human || Math.hypot(o.x, o.y) < 400) AU.dash(c);
    this.ring(o.x, o.y, o.r, o.r * (1.6 + c), 0.18, c > 0.5 ? '#ffe25a' : '#ffffff');
    if (this.tutorial && o.human) { this.tutorial.dashed++; if (c > 0.6) this.tutorial.charged++; }
  },
  onCrumble(band) {
    if (this.mode === 'demo') return;
    AU.crack();
    if (this.state === 'play') UI.feedMsg('⚠ The edge is crumbling!', '#ffb36b');
  },
  onTileFall(t) {
    if (this.mode !== 'demo') AU.tileFall();
    for (let i = 0; i < 4; i++) this.fx.push({ type: 'p', x: t.x + rand(-25, 25), y: t.y + rand(-20, 20), vx: rand(-40, 40), vy: rand(20, 90), vz: rand(50, 200), z: 0, life: 0.7, max: 0.7, col: this.arena.def.side, size: rand(4, 8) });
  },
  onFall(o) {
    const aliveAfter = this.alive().length; // o is already marked falling
    o.place = aliveAfter + 1;
    if (o.human || o.lastHitBy && o.lastHitBy.human) AU.fall();
    if (this.mode === 'tutorial' && o.human) {
      UI.feedMsg('<b>Oops!</b> Back you go. Stay away from the edge');
      setTimeout(() => this.respawn(o), 900);
      return;
    }
    const k = o.lastHitT < 3.5 ? o.lastHitBy : null;
    let msg;
    if (k && k !== o) {
      k.kos++; k.koTimes.push(this.time); k.emote = 1.2;
      const dbl = k.koTimes.filter(t => this.time - t < 3).length >= 2;
      msg = (k.human ? '<b>' + k.name + '</b>' : k.name + cpuTag()) + ' <span class="ko">KO</span> ' + (o.human ? '<b>' + o.name + '</b>' : o.name + cpuTag());
      if (k.human) {
        this.text(o.x, o.y - 40, dbl ? 'DOUBLE KO!' : o.lastHitCharged ? 'CHARGED KO!' : 'KO!', dbl ? '#ff6fb1' : '#ffe25a', dbl ? 40 : 34);
        AU.ko(dbl); this.hitstop = Math.max(this.hitstop, 0.09); this.shake = Math.max(this.shake, 14);
        if (this.mode !== 'party') {
          Missions.track('ko', 1);
          if (o.lastHitCharged) Missions.track('charged', 1);
          if (dbl) Missions.track('double', 1);
        }
        Input.rumble(1);
      }
    } else msg = (o.human ? '<b>' + o.name + '</b>' : o.name + cpuTag()) + ' fell off';
    if (this.mode !== 'demo') UI.feedMsg(msg);
    for (let i = 0; i < 16; i++) this.fx.push({ type: 'p', x: o.x, y: o.y, vx: rand(-160, 160), vy: rand(-160, 160), vz: rand(100, 400), z: 0, life: 0.8, max: 0.8, col: SKINS[o.skin].c1, size: rand(3, 7) });
    // Match flow
    const left = this.alive();
    if (this.mode === 'tutorial' && !left.includes(this.players[0])) left.push(this.players[0]);
    if (this.mode === 'demo') {
      if (left.length <= 1 && !this.demoEnd) { this.demoEnd = 1; setTimeout(() => { if (this.mode === 'demo') this.start('demo'); }, 1800); }
      return;
    }
    if (this.mode === 'party') {
      if (left.length <= 1 || !left.some(x => x.human)) this.endRound(left);
      return;
    }
    if (o.human && this.state === 'play') {
      this.state = 'spectate';
      this.slowT = 0.6;
      this.result = this.makeResult(o.place, o);
      setTimeout(() => UI.showResult(this.result), 900);
      Portal.gameplayStop();
    }
    if (left.length === 1) {
      const w = left[0];
      w.place = 1;
      if (this.state === 'play') { // the human won
        this.state = 'ending'; this.endT = 1.6; this.slowT = 0.8;
        this.result = this.makeResult(1, w);
        UI.big('VICTORY!', '#ffe25a'); AU.win();
        this.confetti(w.x, w.y);
      } else if (this.state === 'spectate') {
        this.text(w.x, w.y - 40, 'WINNER', '#ffe25a', 26);
        this.state = 'ending'; this.endT = 99;
      }
    }
  },
  onEliminated(o) {
    if (this.mode === 'tutorial' && o.human) o.alive = true; // respawn() brings it back
  },
  respawn(o) {
    if (this.mode !== 'tutorial' || this.state !== 'play') return;
    const live = this.arena.tiles.filter(t => t.state === 0).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const t = live[0]; if (!t) return;
    Object.assign(o, { x: t.x, y: t.y, vx: 0, vy: 0, falling: 0, fz: 0, heat: 0, alive: true, spawnT: 0.6, teeter: 0, lastHitBy: null });
    this.ring(o.x, o.y, 4, 70, 0.4, '#ffe25a'); AU.pickup();
  },
  finish() {
    if (this.mode === 'party') return;
    this.state = 'over';
    UI.showResult(this.result);
    Portal.gameplayStop();
  },
  endRound(left) {
    if (this.state !== 'play') return;
    const P = this.party;
    const w = left.length === 1 ? left[0] : left.find(x => x.human) || null;
    this.state = 'ending'; this.endT = 99; this.slowT = 0.6;
    if (w && w.human) { P.score[w.slot - 1]++; this.confetti(w.x, w.y); AU.win(); }
    else AU.lose();
    Missions.track('party', 1);
    Portal.gameplayStop();
    setTimeout(() => UI.partyRound(w), 1100);
  },
  confetti(x, y) {
    const cols = ['#ff5a4e', '#ffe25a', '#5fb8ff', '#a6f04a', '#ff9ad5', '#ffffff'];
    for (let i = 0; i < 80; i++) this.fx.push({ type: 'p', x, y, vx: rand(-300, 300), vy: rand(-300, 300), vz: rand(400, 900), z: 0, life: rand(1.2, 2), max: 2, col: pick(cols), size: rand(3, 6), conf: 1 });
  },
  tutorialStep(dt) {
    const T = this.tutorial, p = this.players[0];
    if (!p) return;
    T.t += dt;
    if (Math.hypot(p.vx, p.vy) > 80) T.moved += dt;
    let want = 0;
    if (T.moved > 0.6) want = 1;
    if (want === 1 && T.dashed > 0) want = 2;
    if (want === 2 && (T.charged > 0 || T.t > 25)) want = 3;
    if (want === 3 && (T.ab > 0 || T.t > 35)) want = 4;
    if (want !== T.step) { T.step = want; UI.tutorialHint(want); }
  },

  // --- results & rewards -------------------------------------------------------
  makeResult(place, o) {
    const S = Save.d, n = this.orbs.length;
    const res = { mode: this.mode, place, n, kos: o.kos, time: o.survived, coins: 0, rp: 0, rpBefore: S.rp, unlocks: [], dailyScore: 0, newBest: false };
    const coinTable = [60, 42, 32, 24, 18, 14, 11, 8];
    res.coins = (coinTable[place - 1] || 8) + o.kos * 8;
    if (this.mode === 'royale' || this.mode === 'tutorial') {
      const tier = rankOf(S.rp).i;
      const gain = [32, 20, 12, 5, 0, -3, -6, -9][place - 1] || 0;
      res.rp = gain < 0 ? Math.round(gain * clamp(tier / 2, 0, 1.6)) : gain;
      res.rp += o.kos * 3;
      if (this.mode === 'tutorial') res.rp = Math.max(res.rp, 20);
      const before = rankOf(S.rp);
      S.rp = Math.max(0, S.rp + res.rp);
      const after = rankOf(S.rp);
      if (after.i > before.i) {
        res.rankUp = after.name;
        for (const k of ABILITY_KEYS) if (ABILITIES[k].rank === after.i) res.unlocks.push(ABILITIES[k].icon + ' ' + ABILITIES[k].name + ' ability');
        for (const k of ARENA_KEYS) if (ARENAS[k].unlock === after.i && after.i > 0) res.unlocks.push('🏝 ' + ARENAS[k].name + ' arena');
      }
      if (before.rp < 120 && S.rp >= 120) res.unlocks.push('🏝 Pinball arena');
      S.stats.matches++;
      if (place === 1) { S.stats.wins++; S.stats.streak++; S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak); } else S.stats.streak = 0;
      if (place === 1) Missions.track('win', 1);
      if (place <= 3) Missions.track('top3', 1);
      if (S.stats.streak >= 2 && place === 1) { res.streakBonus = Math.min(50, S.stats.streak * 10); res.coins += res.streakBonus; }
    }
    if (this.mode === 'daily') {
      const D = S.daily;
      res.dailyScore = (n + 1 - place) * 100 + o.kos * 60 + Math.round(o.survived);
      if (D.day !== this.daily.key) {
        D.streak = D.lastDay && dayNumber(this.daily.key) - dayNumber(D.lastDay) === 1 ? D.streak + 1 : 1;
        D.day = this.daily.key; D.best = 0; D.played = 0; D.lastDay = this.daily.key;
        res.coins += 40 + Math.min(6, D.streak) * 10; res.firstDaily = true;
      }
      D.played++;
      if (res.dailyScore > D.best) { D.best = res.dailyScore; res.newBest = true; }
      res.dailyStreak = D.streak;
      if (place === 1) Missions.track('win', 1);
      if (place <= 3) Missions.track('top3', 1);
    }
    Missions.track('survive', Math.round(o.survived));
    S.stats.kos += o.kos;
    S.coins += res.coins;
    Save.write();
    return res;
  },
  // --- small fx helpers ----------------------------------------------------------
  sparks(x, y, n, col, sp) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(0.3, 1) * sp; this.fx.push({ type: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(50, 250), z: 8, life: rand(0.25, 0.5), max: 0.5, col, size: rand(2, 4) }); }
  },
  ring(x, y, r0, r1, life, col) { this.fx.push({ type: 'r', x, y, r0, r1, life, max: life, col }); },
  text(x, y, s, col, size) { this.texts.push({ x, y, s, col, size: size || 20, life: 1.1, max: 1.1 }); },
};
const SIMILAR = { tomato: ['lava'], lava: ['tomato'], sky: ['galaxy'], snow: ['beach'], sunny: ['gold'], gold: ['sunny'], lime: ['melon'], melon: ['lime'] };
function cpuTag() { return ' <i class="cpu">CPU</i>'; }

// Daily missions: three per day, scaled to rank, completed automatically.
const Missions = {
  ensure() {
    const S = Save.d, day = todayKey();
    if (S.missions && S.missions.day === day) return S.missions;
    const rng = makeRng(day * 13 + 5), tier = Math.min(2, Math.floor(rankOf(S.rp).i / 2));
    const pool = MISSION_POOL.slice(), list = [];
    while (list.length < 3) {
      const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      list.push({ id: m.id, n: m.n[tier], reward: m.reward[tier], prog: 0, done: 0 });
    }
    S.missions = { day, list };
    Save.write();
    return S.missions;
  },
  text(m) {
    const def = MISSION_POOL.find(x => x.id === m.id);
    return def.text.replace('{n}', m.n).replace('{es}', m.n === 1 ? '' : 'es').replace('{s}', m.n === 1 ? '' : 's');
  },
  track(id, amt) {
    const M = this.ensure();
    for (const m of M.list) {
      if (m.id !== id || m.done) continue;
      m.prog = Math.min(m.n, m.prog + amt);
      if (m.prog >= m.n) {
        m.done = 1; Save.d.coins += m.reward;
        UI.toast('✔ Mission complete: ' + this.text(m) + ' <b>+' + m.reward + ' 🪙</b>');
        AU.coin();
      }
    }
    Save.write();
  },
};
// ---------------------------------------------------------------------------
// Input: keyboard (QWERTY + AZERTY), mouse, touch joysticks and gamepads.
// Dash is hold-to-charge, release-to-go on every device.
// ---------------------------------------------------------------------------
const KEYS = {
  solo: {
    up: ['KeyW', 'KeyZ', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'KeyQ', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    dash: ['Space', 'KeyJ'], ability: ['KeyE', 'ShiftLeft', 'ShiftRight', 'KeyK'],
  },
  p1: {
    up: ['KeyW', 'KeyZ'], down: ['KeyS'], left: ['KeyA', 'KeyQ'], right: ['KeyD'],
    dash: ['Space', 'KeyF'], ability: ['KeyE', 'KeyG', 'ShiftLeft'],
  },
  p2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    dash: ['Enter', 'NumpadEnter', 'Period', 'Numpad0'], ability: ['ShiftRight', 'Slash', 'Comma', 'Numpad1'],
  },
};
const Input = {
  keys: new Set(), mouse: { x: 0, y: 0, on: false, mode: false, down: false }, touch: false,
  slots: [null, { held: false, rel: false, ab: false }, { held: false, rel: false, ab: false }],
  sticks: {}, // touch joysticks by pointerId: {slot, ox, oy, x, y}
  stickVec: [null, [0, 0], [0, 0]], pads: [], padPrev: [{}, {}, {}, {}],
  init(canvas) {
    const isGameKey = c => /^(Arrow|Space)/.test(c);
    addEventListener('keydown', e => {
      if (isGameKey(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      AU.init();
      if (e.code === 'KeyP' || e.code === 'Escape') { UI.togglePause(); return; }
      if (e.code === 'KeyM') { UI.toggleMute(); return; }
      if (UI.onKey(e)) return;
      this.mouse.mode = false;
      this.keyEvent(e.code, true);
    }, { passive: false });
    addEventListener('keyup', e => { this.keys.delete(e.code); this.keyEvent(e.code, false); });
    addEventListener('blur', () => { this.keys.clear(); for (let s = 1; s <= 2; s++) this.slots[s].held = false; });
    addEventListener('wheel', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => this.pdown(e));
    addEventListener('pointermove', e => this.pmove(e));
    addEventListener('pointerup', e => this.pup(e));
    addEventListener('pointercancel', e => this.pup(e));
    addEventListener('touchstart', () => this.setTouch(true), { passive: true });
    // iOS: audio must be resumed from inside a touchend or click.
    addEventListener('touchend', () => AU.init(), { passive: true });
    addEventListener('click', () => AU.init());
    addEventListener('gamepadconnected', () => UI.toast('🎮 Controller connected'));
    // Touch buttons (DASH / ABILITY), one set per player.
    document.querySelectorAll('.tbtn').forEach(b => {
      const slot = +b.dataset.slot, kind = b.dataset.k;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); AU.init();
        if (kind === 'dash') this.slots[slot].held = true; else this.slots[slot].ab = true;
        b.classList.add('down');
      });
      const up = e => { e.preventDefault(); if (kind === 'dash' && this.slots[slot].held) { this.slots[slot].held = false; this.slots[slot].rel = true; } b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    // Tablets get touch controls even with a big screen.
    if (matchMedia('(pointer: coarse)').matches) this.setTouch(true);
  },
  setTouch(on) { if (this.touch === on) return; this.touch = on; document.body.classList.toggle('touch', on); },
  bindsFor(slot) { return G.mode === 'party' ? (slot === 1 ? KEYS.p1 : KEYS.p2) : KEYS.solo; },
  keyEvent(code, down) {
    for (let s = 1; s <= 2; s++) {
      const b = this.bindsFor(s);
      if (b.dash.includes(code)) {
        if (down) this.slots[s].held = true;
        else if (this.slots[s].held) { this.slots[s].held = false; this.slots[s].rel = true; }
      }
      if (down && b.ability.includes(code)) this.slots[s].ab = true;
      if (G.mode !== 'party') break;
    }
  },
  pdown(e) {
    AU.init();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.setTouch(true);
      let slot = 1;
      if (G.mode === 'party') slot = e.clientX < innerWidth / 2 ? 1 : 2;
      else if (e.clientX > innerWidth * 0.5) { // right side in solo: tap to dash
        this.slots[1].held = true; this.sticks[e.pointerId] = { tap: true }; return;
      }
      this.sticks[e.pointerId] = { slot, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      UI.stick(slot, e.clientX, e.clientY, 0, 0, true);
      return;
    }
    // mouse
    this.setTouch(false);
    this.mouse.mode = true; this.mouse.on = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (G.mode === 'party') { // in Party the mouse is not a player; clicks do nothing in play
      return;
    }
    if (e.button === 0) { this.mouse.down = true; this.slots[1].held = true; }
    if (e.button === 2) this.slots[1].ab = true;
  },
  pmove(e) {
    const st = this.sticks[e.pointerId];
    if (st && !st.tap) {
      st.x = e.clientX; st.y = e.clientY;
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), R = 56;
      if (d > R) { st.ox = st.x - dx / d * R; st.oy = st.y - dy / d * R; } // the base follows the thumb
      UI.stick(st.slot, st.ox, st.oy, st.x - st.ox, st.y - st.oy, true);
      return;
    }
    if (e.pointerType === 'mouse') {
      if (Math.abs(e.clientX - this.mouse.x) + Math.abs(e.clientY - this.mouse.y) > 2) this.mouse.mode = true;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.on = true;
    }
  },
  pup(e) {
    const st = this.sticks[e.pointerId];
    if (st) {
      if (st.tap) { if (this.slots[1].held) { this.slots[1].held = false; this.slots[1].rel = true; } }
      else UI.stick(st.slot, 0, 0, 0, 0, false);
      delete this.sticks[e.pointerId];
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 0 && this.mouse.down) {
      this.mouse.down = false;
      if (this.slots[1].held) { this.slots[1].held = false; this.slots[1].rel = true; }
    }
  },
  pollPads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pads = [];
    for (const p of list || []) if (p && p.connected) this.pads.push(p);
    this.pads.forEach((p, i) => {
      const slot = G.mode === 'party' ? (i === 0 ? 1 : 2) : 1;
      if (G.mode === 'party' && i > 1) return;
      const prev = this.padPrev[i], b = k => !!(p.buttons[k] && p.buttons[k].pressed);
      const A = b(0) || b(7), X = b(2) || b(1) || b(5), start = b(9);
      if (A && !prev.A) this.slots[slot].held = true;
      if (!A && prev.A && this.slots[slot].held) { this.slots[slot].held = false; this.slots[slot].rel = true; }
      if (X && !prev.X) this.slots[slot].ab = true;
      if (start && !prev.start) UI.togglePause();
      if ((A && !prev.A) && UI.padConfirm()) this.slots[slot].held = false;
      this.padPrev[i] = { A, X, start };
    });
  },
  padVec(slot) {
    let best = null;
    this.pads.forEach((p, i) => {
      const s = G.mode === 'party' ? (i === 0 ? 1 : 2) : 1;
      if (s !== slot) return;
      let x = p.axes[0] || 0, y = p.axes[1] || 0;
      const b = k => !!(p.buttons[k] && p.buttons[k].pressed);
      if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
      if (Math.hypot(x, y) > 0.22) best = [x, y];
    });
    return best;
  },
  // Copy the current input onto the human orbs (called every fixed step).
  apply(Gm) {
    for (const o of Gm.players) {
      const s = o.slot, S = this.slots[s];
      let mx = 0, my = 0;
      const b = this.bindsFor(s), k = this.keys, has = l => l.some(c => k.has(c));
      if (has(b.left)) mx -= 1; if (has(b.right)) mx += 1; if (has(b.up)) my -= 1; if (has(b.down)) my += 1;
      const pv = this.padVec(s);
      if (pv) { mx = pv[0]; my = pv[1]; }
      for (const id in this.sticks) {
        const st = this.sticks[id];
        if (st.tap || st.slot !== s) continue;
        const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy);
        if (d > 6) { mx = dx / 56; my = dy / 56; }
      }
      if (s === 1 && Gm.mode !== 'party' && this.mouse.mode && this.mouse.on && !mx && !my && o.canAct()) {
        const [wx, wy] = R.toWorld(this.mouse.x, this.mouse.y);
        const dx = wx - o.x, dy = wy - o.y, d = Math.hypot(dx, dy);
        if (d > 8) { const f = clamp((d - 8) / 70, 0, 1); mx = dx / d * f; my = dy / d * f; }
      }
      o.inMove = [mx, my];
      o.dashHeld = S.held;
      if (S.rel) { S.rel = false; o.wantDash = true; }
      if (S.ab) { S.ab = false; o.wantAbility = true; }
    }
  },
  rumble(p) {
    try {
      for (const pad of this.pads) if (pad.vibrationActuator) pad.vibrationActuator.playEffect('dual-rumble', { duration: 60 + p * 120, strongMagnitude: p, weakMagnitude: p * 0.6 }).catch(() => {});
      if (this.touch && navigator.vibrate && !Save.d.muted) navigator.vibrate(Math.round(10 + p * 25));
    } catch (e) { /* optional */ }
  },
};
// ---------------------------------------------------------------------------
// Rendering: Canvas 2D, crisp at any devicePixelRatio. A slight vertical
// squash and extruded tiles give the arena depth; everything is drawn in code.
// ---------------------------------------------------------------------------
const SQUASH = 0.78, TILE_H = 22;
const R = {
  cv: null, c: null, w: 0, h: 0, dpr: 1, cam: { x: 0, y: 0, s: 1 }, bg: null, bgKey: '', clouds: [], t: 0,
  init(cv) {
    this.cv = cv; this.c = cv.getContext('2d', { alpha: false });
    for (let i = 0; i < 7; i++) this.clouds.push({ x: Math.random(), y: rand(0.05, 0.95), s: rand(0.15, 0.35), v: rand(0.004, 0.012) });
    addEventListener('resize', () => this.resize());
    this.resize();
  },
  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = Math.max(1, Math.round(innerWidth * this.dpr)); this.h = Math.max(1, Math.round(innerHeight * this.dpr));
    this.cv.width = this.w; this.cv.height = this.h;
    this.bgKey = '';
  },
  sx(x) { return (x - this.cam.x) * this.cam.s + this.w / 2; },
  sy(y) { return (y - this.cam.y) * this.cam.s * SQUASH + this.h / 2; },
  toWorld(px, py) {
    const X = px * this.dpr, Y = py * this.dpr;
    return [(X - this.w / 2) / this.cam.s + this.cam.x, (Y - this.h / 2) / (this.cam.s * SQUASH) + this.cam.y];
  },
  updateCam(dt) {
    if (!G.arena) return;
    let [x0, y0, x1, y1] = G.arena.bounds();
    for (const o of G.orbs) if (o.alive && !o.falling) { x0 = Math.min(x0, o.x - 60); x1 = Math.max(x1, o.x + 60); y0 = Math.min(y0, o.y - 90); y1 = Math.max(y1, o.y + 60); }
    const portrait = this.h > this.w;
    const padTop = (portrait ? 120 : this.h / this.dpr < 500 ? 46 : 70) * this.dpr, padBot = (Input.touch && portrait ? 190 : this.h / this.dpr < 500 ? 16 : 50) * this.dpr;
    const bw = x1 - x0, bh = (y1 - y0) * SQUASH + TILE_H;
    let s = Math.min(this.w * 0.94 / bw, (this.h - padTop - padBot) / bh);
    s = Math.min(s, 2.2 * this.dpr);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2 + (padBot - padTop) / 2 / (s * SQUASH);
    if (G.camInit) { this.cam.x = cx; this.cam.y = cy; this.cam.s = s; G.camInit = false; return; }
    const k = 1 - Math.exp(-dt * 2.5);
    this.cam.x += (cx - this.cam.x) * k; this.cam.y += (cy - this.cam.y) * k; this.cam.s += (s - this.cam.s) * k;
  },
  buildBg() {
    const key = (G.arena ? G.arena.key : 'meadow') + this.w + 'x' + this.h;
    if (this.bgKey === key) return;
    this.bgKey = key;
    const def = G.arena ? G.arena.def : ARENAS.meadow;
    const b = document.createElement('canvas'); b.width = this.w; b.height = this.h;
    const c = b.getContext('2d');
    const g = c.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, def.sky[0]); g.addColorStop(0.55, def.sky[1]); g.addColorStop(1, def.sky[2]);
    c.fillStyle = g; c.fillRect(0, 0, this.w, this.h);
    const rng = makeRng(7);
    for (let i = 0; i < 90; i++) { // stars, fading toward the horizon
      const y = rng() * this.h * 0.6;
      c.globalAlpha = (1 - y / (this.h * 0.6)) * 0.8 * rng();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(rng() * this.w, y, (0.6 + rng() * 1.4) * this.dpr, 0, TAU); c.fill();
    }
    // distant floating rocks
    c.globalAlpha = 0.18; c.fillStyle = def.sky[0];
    for (let i = 0; i < 7; i++) {
      const x = rng() * this.w, y = this.h * (0.35 + rng() * 0.6), s = (20 + rng() * 60) * this.dpr;
      c.beginPath(); c.ellipse(x, y, s, s * 0.3, 0, 0, TAU); c.fill();
      c.beginPath(); c.moveTo(x - s, y); c.lineTo(x, y + s * 1.2); c.lineTo(x + s, y); c.fill();
    }
    c.globalAlpha = 1;
    this.bg = b;
  },
  draw(dt) {
    this.t += dt;
    const c = this.c;
    this.updateCam(dt);
    this.buildBg();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(this.bg, 0, 0);
    // drifting clouds
    c.fillStyle = '#ffffff';
    for (const cl of this.clouds) {
      cl.x += cl.v * dt; if (cl.x > 1.3) cl.x = -0.3;
      c.globalAlpha = 0.06;
      const x = cl.x * this.w, y = cl.y * this.h, s = cl.s * this.w;
      c.beginPath(); c.ellipse(x, y, s, s * 0.18, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(x + s * 0.3, y - s * 0.08, s * 0.5, s * 0.16, 0, 0, TAU); c.fill();
    }
    c.globalAlpha = 1;
    if (!G.arena) return;
    let shx = 0, shy = 0;
    if (G.shake > 0) { shx = rand(-1, 1) * G.shake * this.dpr; shy = rand(-1, 1) * G.shake * this.dpr; }
    c.setTransform(1, 0, 0, 1, shx, shy);
    const s = this.cam.s;
    // orbs falling into the void are drawn under the arena
    for (const o of G.orbs) if (o.alive && o.falling) this.orb(o);
    this.tiles();
    if (G.arena.sweep) this.sweeper();
    // y-sorted objects
    const objs = [];
    for (const b of G.arena.bumpers) if (b.tile.state < 3) objs.push([b.y + (b.tile.z || 0), 'b', b]);
    for (const p of G.pickups) objs.push([p.y, 'p', p]);
    for (const o of G.orbs) if (o.alive && !o.falling) objs.push([o.y, 'o', o]);
    objs.sort((a, b) => a[0] - b[0]);
    for (const [, k, v] of objs) { if (k === 'o') this.orb(v); else if (k === 'b') this.bumper(v); else this.pickup(v); }
    this.effects(s);
    for (const o of G.orbs) if (o.alive && !o.falling) this.tag(o);
    this.texts();
  },
  hexPath(x, y, k) {
    const c = this.c, s = this.cam.s;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const px = x + HEX_CORNERS[i][0] * k * s, py = y + HEX_CORNERS[i][1] * k * s * SQUASH;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  },
  tiles() {
    const c = this.c, s = this.cam.s, A = G.arena, def = A.def, H = TILE_H * s;
    if (!A.sorted) A.sorted = A.tiles.slice().sort((a, b) => a.y - b.y);
    const k = 0.965;
    for (const t of A.sorted) {
      if (t.state === 3) continue;
      let x = this.sx(t.x), y = this.sy(t.y);
      let alpha = 1;
      if (t.state === 1) { x += Math.sin(t.wob * 55) * 2.2 * this.dpr; y += Math.cos(t.wob * 47) * 1.2 * this.dpr; }
      if (t.state === 2) { y += t.z * s; alpha = clamp(1 - t.t / 1.2, 0, 1); }
      c.globalAlpha = alpha;
      // extruded side
      c.beginPath();
      const cs = HEX_CORNERS;
      const P = i => [x + cs[i][0] * k * s, y + cs[i][1] * k * s * SQUASH];
      let p = P(0); c.moveTo(p[0], p[1]);
      for (const i of [1, 2, 3, 4]) { p = P(i); c.lineTo(p[0], p[1]); }
      for (const i of [4, 3, 2, 1, 0]) { p = P(i); c.lineTo(p[0], p[1] + H); }
      c.closePath();
      c.fillStyle = t.type === 'bridge' ? '#7a5530' : t.type === 'vent' ? '#2a2026' : def.side;
      c.fill();
      // lighter left-front facet
      c.beginPath(); p = P(2); c.moveTo(p[0], p[1]); const q = P(3); c.lineTo(q[0], q[1]); c.lineTo(q[0], q[1] + H); c.lineTo(p[0], p[1] + H); c.closePath();
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
      // top
      this.hexPath(x, y, k);
      let top = def.top[(t.q + t.r * 2) & 1 ? 1 : 0];
      if (t.type === 'ice') top = (t.q + t.r) & 1 ? '#d8f3ff' : '#c6ebff';
      if (t.type === 'bridge') top = '#c99a62';
      if (t.type === 'vent') top = '#4a3d48';
      c.fillStyle = top; c.fill();
      if (t.shade) { c.fillStyle = 'rgba(0,0,0,' + t.shade + ')'; c.fill(); }
      if (t.state === 1) {
        const f = 0.35 + 0.35 * Math.sin(t.wob * 18);
        c.fillStyle = 'rgba(255,60,40,' + f + ')'; c.fill();
      }
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.2 * this.dpr;
      c.stroke();
      if (t.type === 'ice') {
        c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 2 * this.dpr;
        c.beginPath(); c.moveTo(x - 12 * s, y - 4 * s); c.lineTo(x - 2 * s, y - 12 * s); c.stroke();
      }
      if (t.type === 'bridge') {
        c.strokeStyle = 'rgba(80,50,20,0.5)'; c.lineWidth = 2 * this.dpr;
        for (let i = -1; i <= 1; i++) { c.beginPath(); c.moveTo(x - 26 * s, y + i * 10 * s * SQUASH); c.lineTo(x + 26 * s, y + i * 10 * s * SQUASH); c.stroke(); }
      }
      if (t.type === 'vent') {
        const warn = t.vent < 1.5 ? 1 - t.vent / 1.5 : 0;
        const glow = 0.35 + warn * 0.65 + Math.sin(this.t * (6 + warn * 20)) * 0.15 * (warn + 0.3);
        c.fillStyle = 'rgba(255,' + Math.round(110 + warn * 80) + ',40,' + clamp(glow, 0, 1) + ')';
        c.beginPath(); c.ellipse(x, y, 16 * s, 16 * s * SQUASH, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,200,90,' + clamp(glow, 0, 1) + ')'; c.lineWidth = 2 * this.dpr;
        c.beginPath(); c.moveTo(x - 20 * s, y); c.lineTo(x - 6 * s, y - 4 * s); c.lineTo(x + 4 * s, y + 6 * s); c.lineTo(x + 20 * s, y - 2 * s); c.stroke();
      }
      c.globalAlpha = 1;
    }
  },
  sweeper() {
    const c = this.c, s = this.cam.s, sw = G.arena.sweep;
    const ex = Math.cos(sw.a) * sw.len, ey = Math.sin(sw.a) * sw.len;
    const x0 = this.sx(0), y0 = this.sy(0), x1 = this.sx(ex), y1 = this.sy(ey);
    const lift = 26 * s;
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 16 * s;
    c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke();
    c.strokeStyle = '#4a1f3a'; c.lineWidth = 18 * s;
    c.beginPath(); c.moveTo(x0, y0 - lift + 5 * s); c.lineTo(x1, y1 - lift + 5 * s); c.stroke();
    c.strokeStyle = '#ff5fa2'; c.lineWidth = 14 * s;
    c.beginPath(); c.moveTo(x0, y0 - lift); c.lineTo(x1, y1 - lift); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 3 * s;
    c.beginPath(); c.moveTo(x0, y0 - lift - 3 * s); c.lineTo(x1, y1 - lift - 3 * s); c.stroke();
    c.fillStyle = '#ffd6e8'; c.beginPath(); c.arc(x0, y0 - lift, 14 * s, 0, TAU); c.fill();
    c.fillStyle = '#ff5fa2'; c.beginPath(); c.arc(x1, y1 - lift, 9 * s, 0, TAU); c.fill();
  },
  bumper(b) {
    const c = this.c, s = this.cam.s, x = this.sx(b.x), y = this.sy(b.y) + (b.tile.z || 0) * s;
    const r = b.r * s * (1 + b.hit * 0.2), h = 20 * s;
    c.globalAlpha = b.tile.state === 2 ? clamp(1 - b.tile.t / 1.2, 0, 1) : 1;
    c.fillStyle = '#b02a5a'; c.beginPath(); c.ellipse(x, y, r, r * SQUASH, 0, 0, Math.PI); c.lineTo(x - r, y - h); c.ellipse(x, y - h, r, r * SQUASH, 0, Math.PI, 0, true); c.closePath(); c.fill();
    c.fillStyle = b.hit > 0.1 ? '#ffffff' : '#ff4f8a'; c.beginPath(); c.ellipse(x, y - h, r, r * SQUASH, 0, 0, TAU); c.fill();
    c.fillStyle = b.hit > 0.1 ? '#fff07a' : '#ffd23a'; c.beginPath(); c.ellipse(x, y - h, r * 0.55, r * 0.55 * SQUASH, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
  },
  pickup(p) {
    const c = this.c, s = this.cam.s, P = POWERUPS[p.k];
    const x = this.sx(p.x), y = this.sy(p.y), bob = Math.sin(p.t * 4) * 5 * s, r = 15 * s * Math.min(1, p.t * 4);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(x, y, r, r * 0.4, 0, 0, TAU); c.fill();
    const gy = y - 28 * s + bob;
    c.globalAlpha = 0.35 + 0.15 * Math.sin(p.t * 8);
    c.fillStyle = P.col; c.beginPath(); c.arc(x, gy, r * 1.8, 0, TAU); c.fill();
    c.globalAlpha = 1;
    c.save(); c.translate(x, gy); c.rotate(p.t * 1.5);
    c.fillStyle = P.col; c.strokeStyle = '#fff'; c.lineWidth = 2.5 * this.dpr;
    c.beginPath(); c.moveTo(0, -r); c.lineTo(r, 0); c.lineTo(0, r); c.lineTo(-r, 0); c.closePath(); c.fill(); c.stroke();
    c.restore();
    c.fillStyle = '#fff'; c.font = '800 ' + Math.round(13 * s) + 'px ' + FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(P.icon, x, gy + 1);
  },
  orb(o) {
    const c = this.c, s = this.cam.s, sk = SKINS[o.skin] || SKINS.tomato;
    const gx = this.sx(o.x), gy = this.sy(o.y);
    let r = o.r * s, alpha = 1, drop = 0;
    if (o.falling) { const f = clamp(o.falling / 0.9, 0, 1); r *= 1 - f * 0.55; alpha = 1 - f * 0.8; drop = o.fz * s; }
    if (o.spawnT > 0) r *= 1 - o.spawnT * 0.6;
    c.globalAlpha = alpha;
    // dash trail
    for (const p of o.trail) {
      c.globalAlpha = alpha * p[2] * 1.6;
      c.fillStyle = sk.c1; c.beginPath(); c.arc(this.sx(p[0]), this.sy(p[1]) - o.r * s * 0.85, r * 0.8, 0, TAU); c.fill();
    }
    c.globalAlpha = alpha;
    if (!o.falling) { // shadow
      c.fillStyle = 'rgba(0,0,0,0.28)'; c.beginPath(); c.ellipse(gx, gy + 2 * s, r * 0.95, r * 0.42, 0, 0, TAU); c.fill();
      // dash ready ring for human players
      if (o.human) {
        const ready = o.dashCd <= 0;
        c.strokeStyle = o.slot === 2 ? 'rgba(95,184,255,0.9)' : 'rgba(255,226,90,0.9)'; c.lineWidth = 3 * this.dpr;
        c.beginPath(); c.ellipse(gx, gy + 2 * s, r * 1.25, r * 0.55, 0, -Math.PI / 2, -Math.PI / 2 + TAU * (ready ? 1 : 1 - o.dashCd / DASH_CD)); c.stroke();
      }
    }
    const cx = gx, cy = gy - o.r * s * 0.85 + drop;
    const sq = o.squash, jit = o.charging > 0 ? rand(-1, 1) * 1.5 * this.dpr * Math.min(1, o.charging / CHARGE_T) : 0;
    c.save(); c.translate(cx + jit, cy); c.scale(1 + sq * 0.22, 1 - sq * 0.18);
    // heat glow
    if (o.heat > 20) {
      c.globalAlpha = alpha * clamp((o.heat - 20) / 140, 0, 0.75);
      const hg = c.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.6);
      hg.addColorStop(0, '#ff4a2a'); hg.addColorStop(1, 'rgba(255,74,42,0)');
      c.fillStyle = hg; c.beginPath(); c.arc(0, 0, r * 1.6, 0, TAU); c.fill();
      c.globalAlpha = alpha;
    }
    // body
    const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
    g.addColorStop(0, sk.c1); g.addColorStop(1, sk.c2);
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    if (sk.pattern) this.pattern(sk, r);
    if (o.anchored) { c.fillStyle = 'rgba(150,165,185,0.75)'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); }
    if (o.heat > 40) { c.fillStyle = 'rgba(255,40,20,' + clamp((o.heat - 40) / 400, 0, 0.35) + ')'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); }
    if (o.hitFlash > 0) { c.fillStyle = 'rgba(255,255,255,' + o.hitFlash * 0.7 + ')'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); }
    // gloss
    c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5 * this.dpr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.stroke();
    this.face(o, r);
    this.hat(o.hat, r);
    // power-up auras
    if (o.power === 'shield') { c.strokeStyle = 'rgba(157,255,106,0.85)'; c.lineWidth = 3 * this.dpr; c.beginPath(); c.arc(0, 0, r * 1.3 + Math.sin(this.t * 8) * 2, 0, TAU); c.stroke(); c.fillStyle = 'rgba(157,255,106,0.12)'; c.fill(); }
    if (o.power === 'spikes') {
      c.fillStyle = '#ff4d6d';
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU + this.t * 2; c.beginPath(); c.moveTo(Math.cos(a - 0.15) * r, Math.sin(a - 0.15) * r); c.lineTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); c.lineTo(Math.cos(a + 0.15) * r, Math.sin(a + 0.15) * r); c.fill(); }
    }
    if (o.power === 'turbo') { c.strokeStyle = 'rgba(69,224,255,0.8)'; c.lineWidth = 2 * this.dpr; for (let i = 0; i < 3; i++) { const a = o.look + Math.PI + (i - 1) * 0.35; c.beginPath(); c.moveTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1); c.lineTo(Math.cos(a) * r * 1.7, Math.sin(a) * r * 1.7); c.stroke(); } }
    if (o.abT > 0 && o.ability === 'magnet') { c.strokeStyle = 'rgba(192,132,255,0.8)'; c.lineWidth = 2.5 * this.dpr; for (let i = 0; i < 3; i++) { const rr = r * (1.4 + ((this.t * 2 + i / 3) % 1) * 3); c.globalAlpha = alpha * (1 - ((this.t * 2 + i / 3) % 1)); c.beginPath(); c.arc(0, 0, rr, 0, TAU); c.stroke(); } c.globalAlpha = alpha; }
    // charge ring
    if (o.charging > 0) {
      const f = Math.min(1, o.charging / CHARGE_T);
      c.strokeStyle = f >= 1 ? '#ffe25a' : '#ffffff'; c.lineWidth = 4 * this.dpr;
      c.beginPath(); c.arc(0, 0, r * 1.35, -Math.PI / 2, -Math.PI / 2 + TAU * f); c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;
  },
  pattern(sk, r) {
    const c = this.c;
    c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
    if (sk.pattern === 'stripes') { c.fillStyle = sk.pc; for (let i = -3; i <= 3; i++) { c.beginPath(); c.ellipse(i * r * 0.36, 0, r * 0.08, r, 0, 0, TAU); c.fill(); } }
    if (sk.pattern === 'beach') { const cols = ['#ff4f5a', '#ffd23a', '#3fa8ff']; for (let i = 0; i < 3; i++) { c.fillStyle = cols[i]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * TAU / 3 + 0.3, i * TAU / 3 + 0.3 + TAU / 6); c.fill(); } }
    if (sk.pattern === 'spots') { c.fillStyle = sk.pc; [[0.4, -0.2, 0.2], [-0.3, 0.4, 0.16], [0.1, 0.55, 0.12], [-0.5, -0.1, 0.1]].forEach(([x, y, k]) => { c.beginPath(); c.arc(x * r, y * r, k * r, 0, TAU); c.fill(); }); }
    if (sk.pattern === 'stars') { c.fillStyle = sk.pc; [[0.4, -0.3], [-0.4, 0.3], [0.2, 0.5], [-0.2, -0.6], [0.6, 0.2]].forEach(([x, y], i) => { c.globalAlpha = 0.5 + 0.5 * Math.sin(this.t * 3 + i); c.beginPath(); c.arc(x * r, y * r, r * 0.06, 0, TAU); c.fill(); }); c.globalAlpha = 1; }
    if (sk.pattern === 'shine') { const x = ((this.t * 0.6) % 2 - 1) * r * 2; c.fillStyle = 'rgba(255,255,255,0.5)'; c.beginPath(); c.moveTo(x - r * 0.2, -r); c.lineTo(x + r * 0.1, -r); c.lineTo(x - r * 0.3, r); c.lineTo(x - r * 0.6, r); c.fill(); }
    c.restore();
  },
  face(o, r) {
    const c = this.c;
    const fx = Math.cos(o.look) * r * 0.28, fy = Math.sin(o.look) * r * 0.14 - r * 0.05;
    const ex = r * 0.3, ey = -r * 0.08, er = r * 0.24;
    const angry = o.dashing || o.charging > 0 || o.emote > 0;
    const hurt = o.hitFlash > 0.3 || o.falling;
    for (const side of [-1, 1]) {
      const x = fx + side * ex, y = fy + ey;
      if (o.blink < 0 && !hurt) {
        c.strokeStyle = '#1a1020'; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(x - er * 0.7, y); c.lineTo(x + er * 0.7, y); c.stroke();
        continue;
      }
      if (hurt) { // X eyes
        c.strokeStyle = '#1a1020'; c.lineWidth = r * 0.09;
        c.beginPath(); c.moveTo(x - er * 0.6, y - er * 0.6); c.lineTo(x + er * 0.6, y + er * 0.6); c.moveTo(x + er * 0.6, y - er * 0.6); c.lineTo(x - er * 0.6, y + er * 0.6); c.stroke();
        continue;
      }
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, er * 0.85, er, 0, 0, TAU); c.fill();
      const px = x + Math.cos(o.look) * er * 0.35, py = y + Math.sin(o.look) * er * 0.3;
      c.fillStyle = '#1a1020'; c.beginPath(); c.arc(px, py, er * 0.5, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(px - er * 0.18, py - er * 0.2, er * 0.16, 0, TAU); c.fill();
      if (angry) {
        c.strokeStyle = '#1a1020'; c.lineWidth = r * 0.09; c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - side * er * 0.9, y - er * 1.35); c.lineTo(x + side * er * 0.6, y - er * 0.85); c.stroke();
      }
    }
    // mouth
    c.strokeStyle = '#1a1020'; c.lineWidth = r * 0.07; c.lineCap = 'round';
    const my = fy + r * 0.32;
    c.beginPath();
    if (hurt) c.ellipse(fx, my, r * 0.1, r * 0.12, 0, 0, TAU);
    else if (o.emote > 0) c.arc(fx, my - r * 0.06, r * 0.18, 0.1, Math.PI - 0.1);
    else if (angry) { c.moveTo(fx - r * 0.14, my); c.lineTo(fx + r * 0.14, my); }
    else c.arc(fx, my - r * 0.1, r * 0.12, 0.3, Math.PI - 0.3);
    c.stroke();
  },
  hat(h, r) {
    const c = this.c;
    if (!h || h === 'none') return;
    c.save(); c.translate(0, -r * 0.82);
    const dark = '#1a1020';
    c.lineWidth = r * 0.06; c.strokeStyle = 'rgba(0,0,0,0.35)';
    if (h === 'cap') { c.fillStyle = '#3a6dff'; c.beginPath(); c.arc(0, r * 0.15, r * 0.55, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = '#2a4fd0'; c.beginPath(); c.ellipse(r * 0.45, r * 0.12, r * 0.4, r * 0.1, 0, 0, TAU); c.fill(); }
    if (h === 'bow') { c.fillStyle = '#ff4f9a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(-r * 0.4, -r * 0.25); c.lineTo(-r * 0.4, r * 0.2); c.closePath(); c.moveTo(0, 0); c.lineTo(r * 0.4, -r * 0.25); c.lineTo(r * 0.4, r * 0.2); c.closePath(); c.fill(); c.beginPath(); c.arc(0, 0, r * 0.1, 0, TAU); c.fill(); }
    if (h === 'horns') { c.fillStyle = '#f2ead8'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * r * 0.35, r * 0.2); c.quadraticCurveTo(sd * r * 0.75, -r * 0.1, sd * r * 0.6, -r * 0.5); c.quadraticCurveTo(sd * r * 0.45, -r * 0.05, sd * r * 0.15, r * 0.2); c.fill(); c.stroke(); } }
    if (h === 'sprout') { c.strokeStyle = '#3a9a3a'; c.lineWidth = r * 0.08; c.beginPath(); c.moveTo(0, r * 0.2); c.lineTo(0, -r * 0.25); c.stroke(); c.fillStyle = '#6fe06f'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * r * 0.2, -r * 0.3, r * 0.2, r * 0.1, sd * 0.5, 0, TAU); c.fill(); } }
    if (h === 'tophat') { c.fillStyle = dark; c.fillRect(-r * 0.32, -r * 0.55, r * 0.64, r * 0.65); c.beginPath(); c.ellipse(0, r * 0.1, r * 0.55, r * 0.12, 0, 0, TAU); c.fill(); c.fillStyle = '#ff4f5a'; c.fillRect(-r * 0.32, -r * 0.05, r * 0.64, r * 0.1); }
    if (h === 'viking') { c.fillStyle = '#9aa3b5'; c.beginPath(); c.arc(0, r * 0.2, r * 0.5, Math.PI, 0); c.fill(); c.stroke(); c.fillStyle = '#f2ead8'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * r * 0.42, 0); c.quadraticCurveTo(sd * r * 0.85, -r * 0.1, sd * r * 0.8, -r * 0.55); c.quadraticCurveTo(sd * r * 0.62, -r * 0.15, sd * r * 0.38, -r * 0.12); c.fill(); } }
    if (h === 'chef') { c.fillStyle = '#ffffff'; c.fillRect(-r * 0.3, -r * 0.15, r * 0.6, r * 0.3); for (const [x, y, k] of [[-0.25, -0.3, 0.25], [0.25, -0.3, 0.25], [0, -0.45, 0.28]]) { c.beginPath(); c.arc(x * r, y * r, k * r, 0, TAU); c.fill(); } }
    if (h === 'halo') { c.strokeStyle = '#ffe56b'; c.lineWidth = r * 0.12; c.beginPath(); c.ellipse(0, -r * 0.25 + Math.sin(this.t * 3) * r * 0.05, r * 0.45, r * 0.13, 0, 0, TAU); c.stroke(); }
    if (h === 'crown') { c.fillStyle = '#ffd23a'; c.beginPath(); c.moveTo(-r * 0.42, r * 0.15); c.lineTo(-r * 0.42, -r * 0.25); c.lineTo(-r * 0.2, -r * 0.02); c.lineTo(0, -r * 0.38); c.lineTo(r * 0.2, -r * 0.02); c.lineTo(r * 0.42, -r * 0.25); c.lineTo(r * 0.42, r * 0.15); c.closePath(); c.fill(); c.stroke(); c.fillStyle = '#ff4f5a'; c.beginPath(); c.arc(0, r * 0.02, r * 0.07, 0, TAU); c.fill(); }
    c.restore();
  },
  tag(o) {
    const c = this.c, s = this.cam.s, d = this.dpr;
    const x = this.sx(o.x), y = this.sy(o.y) - o.r * s * 1.85 - (o.hat !== 'none' ? o.r * s * 0.45 : 0) - 6 * d;
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    const fs = Math.round(clamp(12 * s, 10 * d, 15 * d));
    // heat %
    const hc = o.heat < 50 ? '#ffffff' : o.heat < 100 ? '#ffc04a' : '#ff5a3a';
    c.font = '900 ' + Math.round(fs * 1.15) + 'px ' + FONT;
    c.lineWidth = 3.5 * d; c.strokeStyle = 'rgba(10,6,24,0.85)';
    c.strokeText(Math.round(o.heat) + '%', x, y); c.fillStyle = hc; c.fillText(Math.round(o.heat) + '%', x, y);
    // name
    const ny = y - fs * 1.25;
    c.font = '700 ' + fs + 'px ' + FONT;
    if (o.human) {
      const col = o.slot === 2 ? '#5fb8ff' : '#ffe25a';
      c.strokeText(o.name, x, ny); c.fillStyle = col; c.fillText(o.name, x, ny);
      c.fillStyle = col; c.beginPath(); c.moveTo(x - 6 * d, ny + 3 * d); c.lineTo(x + 6 * d, ny + 3 * d); c.lineTo(x, ny + 9 * d); c.fill();
    } else if (G.orbs.length <= 9) {
      c.globalAlpha = 0.85;
      c.strokeText(o.name, x, ny); c.fillStyle = '#e8e4ff'; c.fillText(o.name, x, ny);
      c.globalAlpha = 1;
    }
  },
  effects(s) {
    const c = this.c;
    for (const p of G.fx) {
      const f = clamp(p.life / p.max, 0, 1);
      if (p.type === 'p') {
        c.globalAlpha = Math.min(1, f * 2);
        c.fillStyle = p.col;
        const x = this.sx(p.x), y = this.sy(p.y) - (p.z || 0) * s, z = p.size * s;
        if (p.conf) { c.save(); c.translate(x, y); c.rotate(p.life * 9); c.fillRect(-z, -z * 0.5, z * 2, z); c.restore(); }
        else { c.beginPath(); c.arc(x, y, z, 0, TAU); c.fill(); }
      } else if (p.type === 'r') {
        const r = lerp(p.r1, p.r0, f) * s;
        c.globalAlpha = f; c.strokeStyle = p.col; c.lineWidth = Math.max(1, 5 * f * s);
        c.beginPath(); c.ellipse(this.sx(p.x), this.sy(p.y) - 14 * s, r, r * SQUASH, 0, 0, TAU); c.stroke();
      }
    }
    c.globalAlpha = 1;
  },
  texts() {
    const c = this.c, s = this.cam.s, d = this.dpr;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const t of G.texts) {
      const f = clamp(t.life / t.max, 0, 1), pop = f > 0.85 ? 1 + (f - 0.85) * 4 : 1;
      c.globalAlpha = Math.min(1, f * 3);
      c.font = '900 ' + Math.round(t.size * pop * clamp(s, 0.8 * d, 1.6 * d)) + 'px ' + FONT;
      c.lineWidth = 5 * d; c.strokeStyle = '#1a0f2e';
      const x = this.sx(t.x), y = this.sy(t.y) - 30 * s;
      c.strokeText(t.s, x, y); c.fillStyle = t.col; c.fillText(t.s, x, y);
    }
    c.globalAlpha = 1;
  },
};
const FONT = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Roboto, Arial, sans-serif';
// ---------------------------------------------------------------------------
// UI: menus, HUD, locker, results, Party and Daily screens (plain DOM).
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const UI = {
  paused: false, screen: null, firstMatch: true, lockerTab: 'skin', anyInput: false,
  init() {
    const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); AU.init(); AU.ui(); fn(e); });
    on('btnPlay', () => this.go('royale'));
    on('btnAgain', () => this.again());
    on('btnHome', () => this.toMenu());
    on('btnDouble', () => this.doubleCoins());
    on('btnParty', () => this.show('partySetup'));
    on('btnPartyBack', () => this.show('menu'));
    on('btnPartyGo', () => { G.party = { score: [0, 0], round: 1 }; this.go('party'); });
    on('btnNextRound', () => this.nextRound());
    on('btnPartyQuit', () => this.toMenu());
    on('btnDaily', () => this.dailyIntro());
    on('btnDailyGo', () => this.go('daily'));
    on('btnDailyBack', () => this.show('menu'));
    on('btnLocker', () => this.openLocker());
    on('lockerBack', () => { Save.write(); this.show('menu'); });
    on('btnGift', () => this.gift());
    on('btnResume', () => this.togglePause(false));
    on('btnQuit', () => { this.paused = false; AU.applyGain(); this.toMenu(); });
    on('btnMusic', () => { Save.d.music = Save.d.music ? 0 : 1; Save.write(); AU.applyGain(); this.musicLabel(); });
    on('btnMute', () => this.toggleMute());
    on('btnPause', () => this.togglePause());
    document.querySelectorAll('#botSeg button').forEach(b => b.addEventListener('click', () => {
      AU.ui(); Save.d.partyBots = +b.dataset.n; Save.write(); this.segSync();
    }));
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
      AU.ui(); this.lockerTab = b.dataset.tab; this.renderLocker();
    }));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G.mode !== 'demo' && (G.state === 'play' || G.state === 'countdown') && !this.paused) this.togglePause(true); AU.suspend(); }
      else if (!this.paused) AU.resume();
    });
    const markInput = () => {
      this.anyInput = true;
      if (G.mode && G.mode !== 'demo' && (G.state === 'play' || G.state === 'countdown') && !this.paused && !this.screen) Portal.gameplayStart();
    };
    addEventListener('keydown', markInput); addEventListener('pointerdown', markInput);
    this.syncMute(); this.segSync(); this.musicLabel();
  },
  show(id) {
    for (const s of ['menu', 'locker', 'result', 'partySetup', 'partyRound', 'dailyIntro', 'pause']) $(s).classList.toggle('hidden', s !== id);
    this.screen = id || null; this.shownAt = performance.now();
    if (id === 'menu') this.refreshMenu();
    const inMatch = !id && G.mode && G.mode !== 'demo';
    $('hud').classList.toggle('hidden', !(inMatch || id === 'pause' || (id === 'result' && G.state === 'spectate')));
    $('touch').classList.toggle('hidden', !inMatch);
    $('btnPause').classList.toggle('hidden', !inMatch);
  },
  // --- flow ------------------------------------------------------------------
  go(mode) {
    const start = () => {
      G.start(mode);
      this.show(null);
      Portal.gameplayStart();
    };
    // An ad break may play before going back into gameplay (never before the first match).
    if (this.firstMatch) { this.firstMatch = false; start(); }
    else Portal.midgame(start);
  },
  again() {
    if (G.mode === 'daily') return this.go('daily');
    this.go('royale');
  },
  toMenu() {
    Portal.gameplayStop();
    AU.stopMusic();
    G.start('demo');
    this.show('menu');
  },
  nextRound() {
    const P = G.party;
    if (P.score[0] >= 3 || P.score[1] >= 3) { P.score = [0, 0]; P.round = 0; }
    P.round++;
    this.go('party');
  },
  onMatchStart() {
    const m = G.mode, A = G.arena.def;
    $('pscore').classList.toggle('hidden', m !== 'party');
    $('left').classList.toggle('hidden', m === 'party');
    $('modeTag').classList.toggle('low', m === 'party');
    $('ab1').classList.toggle('hidden', m === 'party');
    $('touch').classList.toggle('party', m === 'party');
    $('feed').innerHTML = '';
    $('hint').className = '';
    let tag = A.name.toUpperCase();
    if (m === 'daily') tag = 'DAILY · ' + G.mod.name.toUpperCase() + ' · ' + tag;
    if (m === 'party') tag = 'ROUND ' + G.party.round + ' · ' + tag;
    if (m === 'tutorial') tag = 'WARM-UP';
    $('modeTag').textContent = tag;
    if (m === 'party') { $('s1').textContent = G.party.score[0]; $('s2').textContent = G.party.score[1]; }
    const p1 = G.players[0];
    if (p1) {
      document.querySelectorAll('.tbtn.ab[data-slot="1"] span, #ab1 .ico').forEach(e => { e.textContent = ABILITIES[p1.ability].icon; });
      $('ab1').querySelector('.lbl').textContent = m === 'party' ? 'E' : 'E';
    }
    const p2 = G.players[1];
    if (p2) document.querySelectorAll('.tbtn.ab[data-slot="2"] span').forEach(e => { e.textContent = ABILITIES[p2.ability].icon; });
    if (m === 'tutorial') this.tutorialHint(0);
    else if (m !== 'demo' && Save.d.stats.matches < 3 && !Input.touch) this.hintFor('Hold SPACE or the mouse button to charge a big dash', 4);
    if (m === 'party') this.hintFor(Input.touch ? 'P1 left half · P2 right half' : 'P1: WASD + Space · P2: Arrows + Enter', 3);
  },
  hintFor(text, secs) {
    const h = $('hint'); h.innerHTML = text; h.className = 'on';
    clearTimeout(this.hintT); this.hintT = setTimeout(() => { h.className = ''; }, secs * 1000);
  },
  tutorialHint(step) {
    const t = Input.touch;
    const lines = [
      t ? 'Drag on the left side to roll' : 'Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, the arrows or the mouse',
      t ? 'Tap <b>DASH</b> to slam into a rival!' : 'Tap <kbd>SPACE</kbd> or click to <b>DASH</b> into a rival!',
      t ? 'HOLD <b>DASH</b>, then let go, for a charged hit' : '<b>HOLD</b> <kbd>SPACE</kbd> then let go for a charged hit',
      t ? 'Tap 💥 for a Shockwave' : 'Press <kbd>E</kbd> or right-click for a 💥 Shockwave',
      'Knock them all off the edge! The more <b style="color:#ff7a4a">%</b>, the further they fly',
    ];
    const h = $('hint'); h.innerHTML = lines[step]; h.className = 'on';
    clearTimeout(this.hintT);
    if (step === 4) this.hintT = setTimeout(() => { h.className = ''; }, 5000);
  },
  big(text, col) {
    if (!text) return;
    const b = $('bigText'); b.textContent = text; b.style.color = col || '#fff';
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  },
  feedMsg(html, col) {
    const f = $('feed'), d = document.createElement('div');
    d.innerHTML = html; if (col) d.style.color = col;
    f.prepend(d);
    while (f.children.length > 4) f.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 3500);
    setTimeout(() => d.remove(), 4200);
  },
  toast(html) {
    const t = $('toast'), d = document.createElement('div');
    d.innerHTML = html; t.appendChild(d);
    setTimeout(() => d.remove(), 3200);
  },
  abilityUsed() {},
  stick(slot, x, y, dx, dy, on) {
    const s = $('stick' + slot);
    s.classList.toggle('on', on);
    if (!on) return;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.firstElementChild.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  },
  hud() {
    if (!G.mode || G.mode === 'demo') return;
    $('leftN').textContent = G.alive().length;
    for (const o of G.players) {
      const ab = ABILITIES[o.ability], f = clamp(o.abCd / ab.cd, 0, 1);
      if (o.slot === 1) {
        $('ab1').querySelector('.cd').style.transform = 'scaleY(' + f + ')';
        $('ab1').classList.toggle('ready', f === 0);
      }
      document.querySelectorAll('.tbtn.ab[data-slot="' + o.slot + '"]').forEach(b => b.classList.toggle('cool', f > 0));
      document.querySelectorAll('.tbtn.dash[data-slot="' + o.slot + '"]').forEach(b => b.classList.toggle('cool', o.dashCd > 0));
    }
  },
  // --- results -------------------------------------------------------------------
  showResult(res) {
    if (!res || this.screen === 'result') return;
    const S = Save.d;
    const daily = res.mode === 'daily', tut = res.mode === 'tutorial';
    if (tut) { S.tutorial = 1; Save.write(); }
    $('rKicker').textContent = daily ? 'DAILY CHALLENGE · ' + G.mod.name.toUpperCase() : tut ? 'WARM-UP' : 'ROYALE · ' + G.arena.def.name.toUpperCase();
    $('rPlace').textContent = res.place === 1 ? 'WINNER!' : '#' + res.place;
    $('rPlace').style.color = res.place === 1 ? '#ffe25a' : res.place <= 3 ? '#9fe8ff' : '#ffffff';
    const subs = { 1: 'Last one standing. Unstoppable!', 2: 'So close! One more?', 3: 'On the podium.' };
    let sub = subs[res.place] || (res.kos ? 'You took ' + res.kos + ' with you.' : 'Stay away from the edge!');
    if (daily) sub = 'Score <b>' + res.dailyScore + '</b>' + (res.newBest ? ' · NEW BEST TODAY' : ' · best ' + S.daily.best) + ' · 🔥 ' + res.dailyStreak + '-day streak';
    if (res.streakBonus) sub += ' · win streak bonus +' + res.streakBonus;
    $('rSub').innerHTML = sub;
    clearTimeout(this.hintT); $('hint').className = '';
    $('rKos').textContent = res.kos;
    $('rTime').textContent = Math.round(res.time) + 's';
    $('rCoins').textContent = '+' + res.coins;
    const rr = $('rRank');
    rr.classList.toggle('hidden', daily);
    if (!daily) {
      const before = rankOf(res.rpBefore), after = rankOf(S.rp);
      rr.querySelector('.rk').textContent = after.label;
      rr.querySelector('.rk').style.color = after.col;
      const bar = rr.querySelector('.bar i');
      bar.style.transition = 'none'; bar.style.width = (after.i === before.i && before.div === after.div ? before.frac : 0) * 100 + '%';
      void bar.offsetWidth; bar.style.transition = ''; bar.style.width = after.frac * 100 + '%';
      const d = rr.querySelector('.delta');
      d.textContent = (res.rp >= 0 ? '+' : '') + res.rp + ' RP';
      d.className = 'delta ' + (res.rp >= 0 ? 'up' : 'down');
    }
    const u = $('rUnlocks'); u.innerHTML = '';
    if (res.rankUp) u.innerHTML += '<div>⬆ Promoted to ' + res.rankUp + '!</div>';
    for (const x of res.unlocks) u.innerHTML += '<div>🔓 Unlocked: ' + x + '</div>';
    if (res.firstDaily) u.innerHTML += '<div>🔥 Daily streak bonus paid</div>';
    $('btnDouble').classList.toggle('hidden', !(Portal.hasRewarded && res.coins > 0));
    $('btnDouble').disabled = false;
    $('btnAgain').firstChild.textContent = tut ? 'PLAY ROYALE' : daily ? 'TRY AGAIN' : 'PLAY AGAIN';
    if (res.place === 1) AU.win(); else if (G.state !== 'ending') AU.lose();
    if (res.place === 1) Portal.happy();
    this.show('result');
    this.syncCoins();
  },
  doubleCoins() {
    const r = G.result; if (!r || r.doubled) return;
    $('btnDouble').disabled = true;
    Portal.rewarded(ok => {
      if (!ok) { $('btnDouble').disabled = false; return; }
      r.doubled = true; Save.d.coins += r.coins; Save.write();
      $('rCoins').textContent = '+' + r.coins * 2; AU.coin();
      $('btnDouble').classList.add('hidden'); this.syncCoins();
    });
  },
  partyRound(w) {
    const P = G.party;
    const won = P.score[0] >= 3 ? 1 : P.score[1] >= 3 ? 2 : 0;
    $('s1').textContent = P.score[0]; $('s2').textContent = P.score[1];
    $('prKicker').textContent = won ? 'MATCH OVER' : 'ROUND ' + P.round;
    const who = $('prWho');
    if (won) { who.textContent = 'P' + won + ' WINS THE MATCH!'; who.style.color = won === 1 ? '#ffe25a' : '#5fb8ff'; Portal.happy(); }
    else if (w && w.human) { who.textContent = w.name + ' WINS'; who.style.color = w.slot === 1 ? '#ffe25a' : '#5fb8ff'; }
    else { who.textContent = w ? w.name + ' (CPU) WINS' : 'NOBODY WINS'; who.style.color = '#ffffff'; }
    $('prS1').textContent = P.score[0]; $('prS2').textContent = P.score[1];
    $('btnNextRound').textContent = won ? 'REMATCH' : 'NEXT ROUND';
    this.show('partyRound');
  },
  // --- pause / mute ------------------------------------------------------------
  togglePause(force) {
    const inMatch = G.mode && G.mode !== 'demo' && (G.state === 'play' || G.state === 'countdown');
    const want = force === undefined ? !this.paused : force;
    if (want && !inMatch) return;
    if (want === this.paused) return;
    this.paused = want;
    if (want) { this.show('pause'); Portal.gameplayStop(); }
    else { this.show(null); Portal.gameplayStart(); AU.resume(); }
    AU.applyGain();
  },
  toggleMute() { Save.d.muted = Save.d.muted ? 0 : 1; Save.write(); AU.init(); AU.applyGain(); this.syncMute(); },
  syncMute() { $('btnMute').classList.toggle('muted', !!Save.d.muted); },
  musicLabel() { $('btnMusic').textContent = 'MUSIC: ' + (Save.d.music ? 'ON' : 'OFF'); },
  segSync() { document.querySelectorAll('#botSeg button').forEach(b => b.classList.toggle('on', +b.dataset.n === Save.d.partyBots)); },
  // Enter / Space / gamepad A press the main button of the open screen.
  onKey(e) {
    if (!this.screen || this.screen === 'locker') return false;
    if (e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'NumpadEnter') return false;
    return this.padConfirm();
  },
  padConfirm() {
    if (performance.now() - this.shownAt < 900) return !!this.screen; // don't let a held dash skip the results
    const map = { menu: 'btnPlay', result: 'btnAgain', partySetup: 'btnPartyGo', partyRound: 'btnNextRound', dailyIntro: 'btnDailyGo', pause: 'btnResume' };
    const id = map[this.screen];
    if (!id) return false;
    $(id).click();
    return true;
  },
  // --- menu ----------------------------------------------------------------------
  syncCoins() { document.querySelectorAll('.coins b').forEach(b => { b.textContent = Save.d.coins; }); },
  refreshMenu() {
    const S = Save.d, rk = rankOf(S.rp);
    const chip = $('rankChip');
    chip.querySelector('.rk').textContent = rk.label; chip.querySelector('.rk').style.color = rk.col;
    chip.querySelector('.bar i').style.width = rk.frac * 100 + '%';
    chip.querySelector('small').textContent = rk.next ? (rk.next.rp - S.rp) + ' RP to ' + rk.next.name : 'Top rank!';
    this.syncCoins();
    $('btnGift').classList.toggle('hidden', S.gift === todayKey());
    $('btnGift').classList.toggle('glow', S.gift !== todayKey());
    $('dailySub').textContent = S.daily.day === todayKey() ? 'best ' + S.daily.best : 'new twist today!';
    $('btnDaily').classList.toggle('glow', S.daily.day !== todayKey());
    const M = Missions.ensure();
    let h = '<div class="mhead">DAILY MISSIONS</div>';
    for (const m of M.list) {
      h += '<div class="mission' + (m.done ? ' done' : '') + '"><span class="rw">' + (m.done ? '✔' : '+' + m.reward + ' 🪙') + '</span>' + Missions.text(m) +
        '<div class="mbar"><i style="width:' + Math.round(m.prog / m.n * 100) + '%"></i></div></div>';
    }
    $('missions').innerHTML = h;
  },
  gift() {
    const S = Save.d; if (S.gift === todayKey()) return;
    S.gift = todayKey(); const c = 50 + randi(0, 5) * 10; S.coins += c; Save.write();
    AU.coin(); this.toast('🎁 Daily gift: <b>+' + c + ' 🪙</b> Come back tomorrow for another!');
    this.refreshMenu();
  },
  dailyIntro() {
    const key = todayKey(), rng = makeRng(key * 7 + 3);
    const arena = ARENA_KEYS[Math.floor(rng() * ARENA_KEYS.length)];
    const mod = MODIFIERS[1 + Math.floor(rng() * (MODIFIERS.length - 1))];
    const d = new Date();
    $('dDate').textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('dMod').textContent = mod.name;
    $('dModDesc').textContent = mod.desc;
    $('dArena').textContent = 'Arena: ' + ARENAS[arena].name + ' · ' + ARENAS[arena].desc;
    const D = Save.d.daily;
    $('dBest').textContent = D.day === key ? D.best : '–';
    const live = D.lastDay && (dayNumber(key) - dayNumber(D.lastDay) <= 1);
    $('dStreak').textContent = live ? D.streak : 0;
    this.show('dailyIntro');
  },
  // --- locker ----------------------------------------------------------------------
  openLocker() { this.show('locker'); this.renderLocker(); },
  renderLocker() {
    const S = Save.d, tab = this.lockerTab, tier = rankOf(S.rp).i;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const grid = $('grid'); grid.innerHTML = '';
    const note = $('lockerNote');
    note.textContent = tab === 'ability' ? 'Abilities unlock as you climb the ranks. Pick one to take into battle.' : 'Cosmetics only. Earn coins by playing, winning and finishing missions.';
    const list = tab === 'skin' ? SKINS : tab === 'hat' ? HATS : ABILITIES;
    for (const k in list) {
      const it = list[k], d = document.createElement('button');
      d.className = 'item';
      let owned, selected, locked = false, label;
      if (tab === 'ability') {
        locked = it.rank > tier; owned = !locked; selected = S.ability === k;
        d.innerHTML = '<span class="ab">' + it.icon + '</span>' + it.name + '<span class="desc">' + (locked ? '🔒 Reach ' + RANKS[it.rank].name : it.desc) + '</span>';
      } else {
        owned = !!S.owned[k]; selected = (tab === 'skin' ? S.skin : S.hat) === k;
        locked = !owned && it.rank && it.rank > tier;
        const cv = document.createElement('canvas'); cv.width = 112; cv.height = 112;
        paintCreature(cv, tab === 'skin' ? k : S.skin, tab === 'hat' ? k : 'none');
        d.appendChild(cv);
        label = document.createElement('span'); label.textContent = it.name; d.appendChild(label);
        const pr = document.createElement('span'); pr.className = 'price';
        pr.textContent = owned ? (selected ? 'EQUIPPED' : 'OWNED') : locked ? '🔒 ' + RANKS[it.rank].name : '🪙 ' + it.price;
        d.appendChild(pr);
      }
      if (selected) d.classList.add('sel');
      if (locked) d.classList.add('locked');
      d.addEventListener('click', () => this.lockerPick(tab, k));
      grid.appendChild(d);
    }
    paintCreature($('preview'), S.skin, S.hat, ABILITIES[S.ability].icon);
    this.syncCoins();
  },
  lockerPick(tab, k) {
    const S = Save.d, tier = rankOf(S.rp).i;
    if (tab === 'ability') {
      if (ABILITIES[k].rank > tier) { AU.deny(); this.toast('🔒 Reach ' + RANKS[ABILITIES[k].rank].name + ' to unlock ' + ABILITIES[k].name); return; }
      S.ability = k;
    } else {
      const it = (tab === 'skin' ? SKINS : HATS)[k];
      if (!S.owned[k]) {
        if (it.rank && it.rank > tier) { AU.deny(); this.toast('🔒 Reach ' + RANKS[it.rank].name + ' to buy ' + it.name); return; }
        if (S.coins < it.price) { AU.deny(); this.toast('Need ' + (it.price - S.coins) + ' more 🪙. Win matches and finish missions!'); return; }
        S.coins -= it.price; S.owned[k] = 1; AU.coin(); this.toast('Bought ' + it.name + '!');
      }
      if (tab === 'skin') S.skin = k; else S.hat = k;
    }
    AU.ui(); Save.write(); this.renderLocker();
  },
};

// Draw a creature into a small canvas (locker grid and preview).
function paintCreature(cv, skin, hat, badge) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, r = w * 0.3;
  c.clearRect(0, 0, w, h);
  const keep = R.c; R.c = c;
  const sk = SKINS[skin];
  c.save(); c.translate(w / 2, h * 0.56);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, r * 0.95, r * 0.9, r * 0.25, 0, 0, TAU); c.fill();
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, sk.c1); g.addColorStop(1, sk.c2);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  if (sk.pattern) R.pattern(sk, r);
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0, TAU); c.fill();
  R.face({ look: 0.35, blink: 1, hitFlash: 0, emote: 1, dashing: false, charging: 0, falling: 0 }, r);
  R.hat(hat, r);
  c.restore();
  if (badge) { c.font = Math.round(w * 0.16) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(badge, w * 0.82, h * 0.2); }
  R.c = keep;
}
// ---------------------------------------------------------------------------
// Boot and main loop.
// ---------------------------------------------------------------------------
(function boot() {
  Save.load();
  Missions.ensure();
  R.init($('cv'));
  Input.init($('cv'));
  UI.init();
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    Input.pollPads();
    if (!UI.paused && !Portal.adActive) G.frame(dt);
    R.draw(UI.paused || Portal.adActive ? 0 : dt);
    UI.hud();
    requestAnimationFrame(loop);
  };
  Portal.init().then(() => {
    Portal.loadingStart();
    Portal.loadingStop();
    // First visit: straight into a short warm-up match. Afterwards: the menu, one click from play.
    if (!Save.d.tutorial) { UI.firstMatch = false; G.start('tutorial'); UI.show(null); }
    else { G.start('demo'); UI.show('menu'); }
    requestAnimationFrame(loop);
  });
})();
})();
