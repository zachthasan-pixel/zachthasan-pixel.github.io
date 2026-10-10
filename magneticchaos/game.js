/* Magnetic Chaos: Keep the Sphere — (c) 2026 Dr. Zahir Hasan. Built from src/ by build.sh (web) */
(function () {
'use strict';
// ---------------------------------------------------------------------------
// Portal layer. build.sh stamps PORTAL as 'web' (itch.io + own site, no ads),
// 'crazygames' or 'poki'. If a portal SDK is missing (adblock, offline, wrong
// domain) every call quietly falls through and the game plays normally.
// ---------------------------------------------------------------------------
const PORTAL = 'web';
const Portal = {
  name: PORTAL, ready: false, playing: false, adActive: false, sdkMute: false,
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
        return this.poki.init().then(() => done(true)).catch(() => done(true));
      }
    } catch (e) { done(false); }
    return Promise.resolve();
  },
  loadingStart() { this._try(() => { if (PORTAL === 'crazygames') this.cg.game.loadingStart(); }); },
  loadingStop() {
    this._try(() => {
      if (PORTAL === 'crazygames') this.cg.game.loadingStop();
      if (PORTAL === 'poki') this.poki.gameLoadingFinished();
    });
  },
  gameplayStart() {
    if (this.playing || this.adActive) return;
    this.playing = true;
    this._try(() => { if (PORTAL === 'crazygames') this.cg.game.gameplayStart(); else if (PORTAL === 'poki') this.poki.gameplayStart(); });
  },
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this._try(() => { if (PORTAL === 'crazygames') this.cg.game.gameplayStop(); else if (PORTAL === 'poki') this.poki.gameplayStop(); });
  },
  happy() { this._try(() => { if (PORTAL === 'crazygames') this.cg.game.happytime(); }); },
  get hasRewarded() { return this.ready && PORTAL !== 'web'; },
  // A break between runs. cb always runs exactly once.
  midgame(cb) { this._ad('midgame', ok => cb(ok)); },
  // Opt-in rewarded video. cb(true) only if the ad was actually watched.
  rewarded(cb) { this._ad('rewarded', cb); },
  pending: false,
  _ad(kind, cb) {
    if (!this.ready || PORTAL === 'web') { cb(false); return; }
    let finished = false;
    this.pending = true;
    const start = () => { this.adActive = true; AU.applyGain(); };
    const end = ok => {
      if (finished) return; finished = true;
      this.adActive = false; this.pending = false; AU.applyGain(); cb(ok);
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
  _try(fn) { if (!this.ready) return; try { fn(); } catch (e) { /* never let a portal break the game */ } },
};
// ---------------------------------------------------------------------------
// Magnetic Chaos: Keep the Sphere — core: canvas, utils, save, audio
// ---------------------------------------------------------------------------
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1;

const rand = Math.random;
const rr = (a, b) => a + rand() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);
const inRect = (x, y, r) => r && x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;
const fmt = n => Math.floor(n).toLocaleString('en-US');
const clock = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const f = (px, w) => (w || 400) + ' ' + Math.round(px) + 'px ' + FONT;

// ---------------------------------------------------------------- save -----
const SAVE_KEY = 'mc_save_v1';
const save = { best: 0, bestPhase: 0, bestTime: 0, runs: 0, muted: false, tut: false };
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') for (const k in save) if (typeof s[k] === typeof save[k]) save[k] = s[k];
  } catch (e) { /* private mode or blocked storage: play without saving */ }
}
function writeSave() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ } }

// --------------------------------------------------------------- audio -----
// Everything is synthesised: a slow ambient pad, a sparse pentatonic shimmer
// that grows busier with each phase, and soft sound effects.
const AU = {
  ac: null, master: null, sfxBus: null, musBus: null, noiseBuf: null,
  musicOn: false, nextBar: 0, bar: 0, nextSpark: 0, timer: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ac = new AC(); } catch (e) { return; }
    this.master = this.ac.createGain();
    this.master.gain.value = this.targetGain();
    this.master.connect(this.ac.destination);
    this.sfxBus = this.ac.createGain(); this.sfxBus.gain.value = 0.8; this.sfxBus.connect(this.master);
    const lp = this.ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.musBus = this.ac.createGain(); this.musBus.gain.value = 0.22; this.musBus.connect(lp); lp.connect(this.master);
    const len = this.ac.sampleRate;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },
  targetGain() { return save.muted || Portal.adActive || Portal.sdkMute ? 0 : 0.6; },
  applyGain() { if (this.master) this.master.gain.setTargetAtTime(this.targetGain(), this.ac.currentTime, 0.03); },
  setMuted(m) { save.muted = m; writeSave(); this.applyGain(); },
  tone(freq, dur, type, vol, slide, delay, bus, attack) {
    if (!this.ac) return;
    const t = this.ac.currentTime + (delay || 0), a = attack || 0.005;
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur, vol, freq, freqTo, delay) {
    if (!this.ac) return;
    const t = this.ac.currentTime + (delay || 0);
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = this.ac.createBiquadFilter(); fl.type = 'lowpass';
    fl.frequency.setValueAtTime(freq || 2000, t);
    if (freqTo) fl.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
    const g = this.ac.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(this.sfxBus);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  },
  _last: {},
  sfx(name) {
    if (!this.ac || save.muted || Portal.adActive) return;
    const now = this.ac.currentTime;
    const gap = { lose: 0.07, edge: 0.3 }[name] || 0;
    if (gap && this._last[name] && now - this._last[name] < gap) return;
    this._last[name] = now;
    switch (name) {
      case 'lose': this.tone(rr(500, 700), 0.22, 'sine', 0.05, 180); break;
      case 'seed': [0, 4, 7, 11, 14].forEach((s, i) => this.tone(659 * Math.pow(2, s / 12), 0.5, 'sine', 0.07, null, i * 0.06)); break;
      case 'invert': this.tone(220, 0.35, 'triangle', 0.09, 660); this.noise(0.25, 0.05, 600, 3000); break;
      case 'revert': this.tone(520, 0.25, 'triangle', 0.06, 240); break;
      case 'empty': this.tone(160, 0.15, 'square', 0.04, 110); break;
      case 'warn': this.tone(440, 0.5, 'sawtooth', 0.04, 330); this.tone(443, 0.5, 'sawtooth', 0.04, 332); break;
      case 'pulse': this.noise(1.2, 0.3, 1400, 60); this.tone(70, 0.9, 'sine', 0.25, 35); break;
      case 'phase': [0, 7, 12, 16, 19].forEach((s, i) => this.tone(262 * Math.pow(2, s / 12), 1.6, 'sine', 0.06, null, i * 0.12, null, 0.08)); break;
      case 'click': this.tone(880, 0.06, 'sine', 0.07); break;
      case 'over': [12, 7, 3, 0, -5].forEach((s, i) => this.tone(220 * Math.pow(2, s / 12), 0.9, 'sine', 0.08, null, i * 0.18, null, 0.04)); break;
      case 'revive': [0, 5, 9, 12, 17].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), 0.6, 'sine', 0.07, null, i * 0.07)); break;
    }
  },
  // Slow pad: a new chord every four seconds, two detuned voices per note.
  startMusic() {
    if (this.musicOn || !this.ac) return;
    this.musicOn = true; this.nextBar = this.ac.currentTime + 0.1; this.nextSpark = this.nextBar + 1; this.bar = 0;
    this.timer = setInterval(() => this.schedule(), 100);
  },
  schedule() {
    if (!this.ac) return;
    const prog = [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 55]];
    const scale = [69, 72, 74, 76, 79, 81, 84, 86, 88];
    while (this.nextBar < this.ac.currentTime + 0.5) {
      const chord = prog[this.bar % 4], d = this.nextBar - this.ac.currentTime;
      chord.forEach((n, i) => {
        const fq = midi(n);
        this.tone(fq, 5.2, i ? 'sine' : 'triangle', 0.12, null, d, this.musBus, 1.6);
        this.tone(fq * 1.004, 5.2, 'sine', 0.06, null, d, this.musBus, 1.9);
      });
      this.bar++;
      this.nextBar += 4;
    }
    const busy = game.state === 'play' && run ? Math.min(6, run.phase) : 1;
    while (this.nextSpark < this.ac.currentTime + 0.5) {
      const d = this.nextSpark - this.ac.currentTime;
      this.tone(midi(scale[Math.floor(rand() * scale.length)]), 1.4, 'sine', 0.035, null, d, this.musBus, 0.01);
      this.nextSpark += rr(1.6, 3.2) / (0.6 + busy * 0.4);
    }
  },
};
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
// ---------------------------------------------------------------------------
// Simulation. Everything lives in "sphere units": the sphere is the unit
// circle centred on (0, 0), so play is identical on every screen size.
//
// Charges:  amber  (+) are pulled toward the well and orbit it.
//           cyan   (-) are pushed away from the well.
//           violet (~) flip between + and - every few seconds (phase 3+).
// Holding the button inverts the well, which swaps who is pulled and pushed.
// Opposite charges cling together; like charges push apart.
// A particle that crosses the rim is lost. The sphere needs both charges:
// containment is set by whichever charge is scarcer, so a well parked in the
// middle (which slowly drives every blue particle out) is not a strategy.
// ---------------------------------------------------------------------------
const MAXP = 720;
const START_N = 320;
const LOSE_C = 0.35;   // containment below this ends the run
const PHASE_LEN = 30;
const TUNE = {
  well: 0.042,       // well pull/push strength
  push: 0.45,        // repelled particles feel this share of the well force
  swirl: 0.6,        // orbit strength around the well for attracted particles
  soft: 0.02,        // softening so the force near the well stays finite
  drag: 1.15,        // velocity damping per second
  vmax: 1.5,
  wind: 0.008,       // outward drift at phase 1, grows each phase
  windStep: 0.012,
  pairR: 0.06,       // particle-particle interaction radius
  pairCore: 0.016,
  cling: 0.45,       // opposite charges attract
  spread: 0.3,       // like charges repel
  invTime: 3,        // seconds of inversion on a full meter
  recharge: 4,       // seconds to refill the meter
};
const KIND = [
  { name: 'pos', rgb: [255, 182, 72] },
  { name: 'neg', rgb: [70, 214, 255] },
  { name: 'flux', rgb: [196, 120, 255] },
];

const P = {
  n: 0,
  x: new Float32Array(MAXP), y: new Float32Array(MAXP),
  vx: new Float32Array(MAXP), vy: new Float32Array(MAXP),
  q: new Int8Array(MAXP), k: new Uint8Array(MAXP),
  flip: new Float32Array(MAXP), age: new Float32Array(MAXP),
};
function addP(x, y, vx, vy, k) {
  if (P.n >= MAXP) return -1;
  const i = P.n++;
  P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.k[i] = k;
  P.q[i] = k === 1 ? -1 : k === 2 ? (rand() < 0.5 ? 1 : -1) : 1;
  P.flip[i] = rr(3, 6); P.age[i] = 0;
  return i;
}
function killP(i) {
  const j = --P.n;
  if (i === j) return;
  P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j];
  P.q[i] = P.q[j]; P.k[i] = P.k[j]; P.flip[i] = P.flip[j]; P.age[i] = P.age[j];
}
// New particles lean toward whichever charge is running short.
function mixKind(phase) {
  if (phase >= 3 && rand() < Math.min(0.3, 0.12 + 0.03 * (phase - 3))) return 2;
  const pBlue = run && run.cn < run.cp ? 0.62 : run && run.cn > run.cp ? 0.38 : 0.5;
  return rand() < pBlue ? 1 : 0;
}
// 1.0 = a full, balanced sphere. Flux particles count half to each side.
const contain = r => Math.min(r.cp, r.cn) * 2 / START_N;
function countCharges(r) {
  let cp = 0, cn = 0;
  for (let i = 0; i < P.n; i++) { if (P.k[i] === 0) cp++; else if (P.k[i] === 1) cn++; else { cp += 0.5; cn += 0.5; } }
  r.cp = cp; r.cn = cn;
}

// ------------------------------------------------------------------ state ---
const game = { state: 'title', paused: false, t: 0 };
const input = { hold: false, keyHold: false, ptrHold: false, padHold: false };
let run = null;

function newRun(demo) {
  P.n = 0;
  run = {
    demo: !!demo, t: 0, score: 0, phase: 1, phaseT: 0,
    well: { x: 0, y: 0, tx: 0, ty: 0 },
    inv: false, energy: 1, lock: false,
    seeds: [], seedT: 3, influxT: 6, pulse: null, pulseT: 12,
    fx: [], lost: 0, collected: 0, peak: START_N,
    cp: 0, cn: 0,
    dead: false, revived: false, reviveFailed: false, record: false,
    banner: demo ? null : { text: 'PHASE 1', sub: 'Keep the particles inside the sphere', t: 3 },
    edge: new Float32Array(48),
  };
  for (let i = 0; i < START_N; i++) {
    const a = rand() * Math.PI * 2, r = 0.15 + Math.sqrt(rand()) * 0.6;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, s = 0.25 * (1 - r * 0.5);
    addP(x, y, -y / r * s, x / r * s, i & 1);
  }
  countCharges(run);
  game.state = demo ? 'title' : 'play';
  game.paused = false;
}

function spawnRing(x, y, n, spd, phase) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.4;
    addP(x + Math.cos(a) * 0.02, y + Math.sin(a) * 0.02, Math.cos(a) * spd - y * 0.2, Math.sin(a) * spd + x * 0.2, mixKind(phase));
  }
}

// ------------------------------------------------------------- spatial grid -
const GC = TUNE.pairR, GSPAN = 2.4, GN = Math.ceil(GSPAN / GC);
const gHead = new Int32Array(GN * GN), gNext = new Int32Array(MAXP);
const cellOf = v => { const c = Math.floor((v + GSPAN / 2) / GC); return c < 0 ? 0 : c >= GN ? GN - 1 : c; };

// ------------------------------------------------------------------- step ---
function step(dt) {
  const r = run, w = r.well;
  r.t += dt;

  // Well eases toward the pointer, and stays inside the sphere.
  if (r.demo) {
    const t = r.t * 0.35;
    w.tx = Math.sin(t * 1.3) * 0.45 + Math.sin(t * 0.7) * 0.15;
    w.ty = Math.cos(t * 0.9) * 0.4;
  }
  const kf = 1 - Math.exp(-dt * 16);
  w.x += (w.tx - w.x) * kf; w.y += (w.ty - w.y) * kf;
  const wr = Math.hypot(w.x, w.y);
  if (wr > 0.9) { w.x *= 0.9 / wr; w.y *= 0.9 / wr; }

  // Polarity meter.
  const want = (input.hold || (r.demo && Math.sin(r.t * 0.5) > 0.82)) && !r.dead;
  if (!want) r.lock = false;
  if (want && !r.lock && (r.inv || r.energy > 0.12)) {
    if (!r.inv) { r.inv = true; if (!r.demo) AU.sfx('invert'); }
    r.energy -= dt / TUNE.invTime;
    if (r.energy <= 0) { r.energy = 0; r.lock = true; r.inv = false; if (!r.demo) AU.sfx('empty'); }
  } else {
    if (r.inv) { r.inv = false; if (!r.demo) AU.sfx('revert'); }
    if (want && !r.lock && r.energy <= 0.12 && !r._emptyCue) { r._emptyCue = true; if (!r.demo) AU.sfx('empty'); }
    if (!want) r._emptyCue = false;
    r.energy = Math.min(1, r.energy + dt / TUNE.recharge);
  }

  const live = !r.demo && !r.dead;
  if (live) {
    r.phaseT += dt;
    if (r.phaseT >= PHASE_LEN) {
      r.phaseT -= PHASE_LEN; r.phase++;
      const sub = r.phase === 2 ? 'Magnetic storms and influx begin' : r.phase === 3 ? 'Violet particles flip their charge' : 'The pull outward grows stronger';
      r.banner = { text: 'PHASE ' + r.phase, sub, t: 3 };
      AU.sfx('phase');
    }
    r.score += contain(r) * START_N * dt * 0.1 * (1 + 0.25 * (r.phase - 1));
  }
  if (r.banner && (r.banner.t -= dt) <= 0) r.banner = null;

  // Charge seeds: touch one with the well for energy and new particles.
  if (!r.dead && (r.seedT -= dt) <= 0) {
    r.seedT = rr(5, 8);
    if (r.seeds.length < 2) {
      const a = rand() * Math.PI * 2, d = rr(0.2, 0.72);
      r.seeds.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, t: 0 });
    }
  }
  for (let i = r.seeds.length - 1; i >= 0; i--) {
    const s = r.seeds[i];
    s.t += dt;
    if (Math.hypot(s.x - w.x, s.y - w.y) < 0.085) {
      r.seeds.splice(i, 1);
      r.energy = Math.min(1, r.energy + 0.5);
      spawnRing(s.x, s.y, 12, 0.18, r.phase);
      r.collected++;
      if (!r.demo) { r.score += 40 * r.phase; AU.sfx('seed'); }
      r.fx.push({ type: 'ring', x: s.x, y: s.y, t: 0, life: 0.8, rgb: [150, 255, 180] });
    } else if (s.t > 14) r.seeds.splice(i, 1);
  }

  // Influx: from phase 2 new particles stream in at the rim. Catch them.
  if (live && r.phase >= 2 && (r.influxT -= dt) <= 0) {
    r.influxT = rr(4.5, 6.5);
    const a = rand() * Math.PI * 2, n = 5 + r.phase;
    for (let i = 0; i < n; i++) {
      const b = a + rr(-0.18, 0.18), d = 0.95;
      addP(Math.cos(b) * d, Math.sin(b) * d, -Math.cos(b) * 0.32, -Math.sin(b) * 0.32, mixKind(r.phase));
    }
    r.fx.push({ type: 'influx', a, t: 0, life: 1 });
  }

  // Magnetic storm: a warning, then a shock that throws everything outward.
  if (live && r.phase >= 2) {
    if (!r.pulse && (r.pulseT -= dt) <= 0) { r.pulse = { t: 1.8, life: 1.8 }; AU.sfx('warn'); }
    if (r.pulse && (r.pulse.t -= dt) <= 0) {
      const kick = 0.34 + 0.04 * (r.phase - 2);
      for (let i = 0; i < P.n; i++) {
        const d = Math.hypot(P.x[i], P.y[i]) + 0.05;
        P.vx[i] += P.x[i] / d * kick; P.vy[i] += P.y[i] / d * kick;
      }
      r.pulse = null;
      r.pulseT = Math.max(7, rr(11, 15) - r.phase * 0.6);
      r.fx.push({ type: 'shock', x: 0, y: 0, t: 0, life: 0.9 });
      AU.sfx('pulse');
    }
  }

  // Forces.
  const ws = r.inv ? -1 : 1;
  const wind = TUNE.wind + TUNE.windStep * (Math.min(r.phase, 10) - 1);
  const n = P.n;
  gHead.fill(-1);
  for (let i = 0; i < n; i++) {
    const c = cellOf(P.y[i]) * GN + cellOf(P.x[i]);
    gNext[i] = gHead[c]; gHead[c] = i;
  }
  const R2 = TUNE.pairR * TUNE.pairR, core = TUNE.pairCore;
  for (let i = 0; i < n; i++) {
    const x = P.x[i], y = P.y[i];
    let ax = 0, ay = 0;
    // flux particles flip
    if (P.k[i] === 2 && (P.flip[i] -= dt) <= 0) { P.q[i] = -P.q[i]; P.flip[i] = rr(3, 6); }
    P.age[i] += dt;
    // well
    const dx = w.x - x, dy = w.y - y, d2 = dx * dx + dy * dy, d = Math.sqrt(d2) + 1e-4;
    const s = P.q[i] * ws;
    let a = TUNE.well / (d2 + TUNE.soft);
    if (a > 2.2) a = 2.2;
    if (s > 0) {
      ax += dx / d * a; ay += dy / d * a;
      const tan = a * TUNE.swirl * ws;
      ax += -dy / d * tan; ay += dx / d * tan;
      if (d < 0.04) { ax -= dx / d * 3; ay -= dy / d * 3; } // don't collapse into the well
    } else {
      ax -= dx / d * a * TUNE.push; ay -= dy / d * a * TUNE.push;
    }
    // outward wind
    ax += x * wind; ay += y * wind;
    // neighbours
    const cx = cellOf(x), cy = cellOf(y);
    let hits = 0;
    for (let gy = cy - 1; gy <= cy + 1 && hits < 12; gy++) {
      if (gy < 0 || gy >= GN) continue;
      for (let gx = cx - 1; gx <= cx + 1 && hits < 12; gx++) {
        if (gx < 0 || gx >= GN) continue;
        for (let j = gHead[gy * GN + gx]; j !== -1 && hits < 12; j = gNext[j]) {
          if (j <= i) continue;
          const ex = P.x[j] - x, ey = P.y[j] - y, e2 = ex * ex + ey * ey;
          if (e2 >= R2 || e2 < 1e-10) continue;
          hits++;
          const e = Math.sqrt(e2), ux = ex / e, uy = ey / e;
          let fpush; // positive pushes apart
          if (e < core) fpush = (core - e) / core * 3;
          else fpush = (P.q[i] * P.q[j] > 0 ? TUNE.spread : -TUNE.cling) * (1 - e / TUNE.pairR);
          ax -= ux * fpush; ay -= uy * fpush;
          P.vx[j] += ux * fpush * dt; P.vy[j] += uy * fpush * dt;
        }
      }
    }
    P.vx[i] += ax * dt; P.vy[i] += ay * dt;
  }

  // Integrate; walk backwards so removals don't skip anyone.
  const damp = Math.exp(-TUNE.drag * dt), vmax = TUNE.vmax;
  r.edge.fill(0);
  for (let i = P.n - 1; i >= 0; i--) {
    let vx = P.vx[i] * damp, vy = P.vy[i] * damp;
    const sp = Math.hypot(vx, vy);
    if (sp > vmax) { vx *= vmax / sp; vy *= vmax / sp; }
    P.vx[i] = vx; P.vy[i] = vy;
    const x = P.x[i] += vx * dt, y = P.y[i] += vy * dt;
    const rr2 = x * x + y * y;
    if (rr2 > 0.7225) { // past 0.85: rim warning
      const b = Math.floor(((Math.atan2(y, x) / (Math.PI * 2)) + 1) * r.edge.length) % r.edge.length;
      r.edge[b] += (Math.sqrt(rr2) - 0.85) / 0.15;
    }
    if (rr2 > 1) {
      r.fx.push({ type: 'spark', x, y, vx, vy, k: P.k[i], q: P.q[i], t: 0, life: 0.9 });
      killP(i);
      if (r.demo) { const a = rand() * Math.PI * 2, d = rr(0.1, 0.5); addP(Math.cos(a) * d, Math.sin(a) * d, 0, 0, P.k[P.n - 1] === 0 ? 1 : 0); }
      else if (!r.dead) { r.lost++; AU.sfx('lose'); }
    }
  }
  if (P.n > r.peak) r.peak = P.n;
  countCharges(r);

  for (let i = r.fx.length - 1; i >= 0; i--) {
    const e = r.fx[i];
    e.t += dt;
    if (e.type === 'spark') { e.x += e.vx * dt; e.y += e.vy * dt; }
    if (e.t >= e.life) r.fx.splice(i, 1);
  }
  if (r.fx.length > 400) r.fx.splice(0, r.fx.length - 400);

  if (live && contain(r) < LOSE_C) gameOver();
}

function gameOver() {
  const r = run;
  r.dead = true; r.pulse = null; r.seeds.length = 0;
  input.hold = input.keyHold = input.ptrHold = input.padHold = false;
  game.state = 'dead';
  save.runs++;
  r.record = r.score > save.best;
  if (r.record) { if (save.best > 0) Portal.happy(); save.best = Math.floor(r.score); }
  save.bestPhase = Math.max(save.bestPhase, r.phase);
  save.bestTime = Math.max(save.bestTime, Math.floor(r.t));
  if (r.t > 20) save.tut = true;
  writeSave();
  Portal.gameplayStop();
  AU.sfx('over');
}

// Rewarded revive: refill the sphere around the well and carry on.
function revive() {
  const r = run;
  r.dead = false; r.revived = true; r.reviveFailed = false;
  const w = r.well;
  for (let guard = 0; contain(r) < 0.7 && P.n < MAXP && guard < MAXP; guard++) {
    const a = rand() * Math.PI * 2, d = 0.08 + Math.sqrt(rand()) * 0.4;
    let x = w.x + Math.cos(a) * d, y = w.y + Math.sin(a) * d;
    const m = Math.hypot(x, y); if (m > 0.8) { x *= 0.8 / m; y *= 0.8 / m; }
    addP(x, y, 0, 0, r.cn < r.cp ? 1 : 0);
    countCharges(r);
  }
  r.energy = 1; r.pulseT = 8;
  r.banner = { text: 'SPHERE RESTORED', sub: 'Second chance. Make it count.', t: 2.5 };
  game.state = 'play';
  AU.sfx('revive');
  Portal.gameplayStart();
}
// ---------------------------------------------------------------------------
// Rendering. Particles glow on a separate trail layer that fades a little
// each frame, which gives the long hypnotic streaks. HUD draws on top.
// ---------------------------------------------------------------------------
const tcv = document.createElement('canvas');
const tctx = tcv.getContext('2d');
const LAY = { cx: 0, cy: 0, R: 100, top: 0, bottom: 0, touch: false, wide: false };

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(200, window.innerWidth); H = Math.max(200, window.innerHeight);
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  tcv.width = cvs.width; tcv.height = cvs.height;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  tctx.fillStyle = '#04050c'; tctx.fillRect(0, 0, W, H);
  // Wide, short screens (phones in landscape) put the HUD beside the sphere.
  LAY.wide = W > H * 1.45 && H < 600;
  const top = LAY.wide ? 14 : Math.max(64, H * 0.08), bottom = LAY.wide ? 14 : Math.max(78, H * 0.1);
  LAY.top = top; LAY.bottom = bottom;
  LAY.R = Math.max(60, Math.min(W * 0.46, (H - top - bottom) * 0.5));
  LAY.cx = W / 2; LAY.cy = top + (H - top - bottom) / 2;
  buildSprites();
}
const toScreen = (x, y) => [LAY.cx + x * LAY.R, LAY.cy + y * LAY.R];

// Pre-rendered glow dots, one per colour.
const SPR = {};
function glow(rgb, core) {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  const [r, gg, b] = rgb;
  gr.addColorStop(0, core || 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, `rgba(${r},${gg},${b},0.95)`);
  gr.addColorStop(0.45, `rgba(${r},${gg},${b},0.28)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return c;
}
function buildSprites() {
  SPR.pos = glow(KIND[0].rgb);
  SPR.neg = glow(KIND[1].rgb);
  SPR.fluxP = glow(KIND[2].rgb, 'rgba(255,214,150,1)');
  SPR.fluxN = glow(KIND[2].rgb, 'rgba(160,236,255,1)');
  SPR.seed = glow([150, 255, 180]);
}
const sprOf = (k, q) => (k === 0 ? SPR.pos : k === 1 ? SPR.neg : q > 0 ? SPR.fluxP : SPR.fluxN);
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

function txt(s, x, y, size, col, align, weight, alpha) {
  ctx.font = f(size, weight);
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.max(4, size * 0.35); // legible over the swarm
  ctx.fillStyle = col; ctx.fillText(s, x, y);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;
}
function wrap(s, maxW, size, weight) {
  ctx.font = f(size, weight);
  const out = []; let line = '';
  for (const w of s.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// ----------------------------------------------------------------- scene ---
function drawScene() {
  const r = run, R = LAY.R;
  // trail layer
  tctx.globalCompositeOperation = 'source-over';
  tctx.fillStyle = 'rgba(4,5,12,0.2)';
  tctx.fillRect(0, 0, W, H);
  tctx.globalCompositeOperation = 'lighter';
  const ps = Math.max(7, R * 0.05);
  for (let i = 0; i < P.n; i++) {
    const sx = LAY.cx + P.x[i] * R, sy = LAY.cy + P.y[i] * R;
    const g = P.age[i] < 0.5 ? P.age[i] / 0.5 : 1;
    const sz = ps * (0.6 + 0.4 * g);
    tctx.globalAlpha = 0.55 + 0.45 * g;
    tctx.drawImage(sprOf(P.k[i], P.q[i]), sx - sz / 2, sy - sz / 2, sz, sz);
  }
  for (const e of r.fx) {
    if (e.type !== 'spark') continue;
    const k = 1 - e.t / e.life, [sx, sy] = toScreen(e.x, e.y), sz = ps * (1 + (1 - k) * 1.5);
    tctx.globalAlpha = k * 0.8;
    tctx.drawImage(sprOf(e.k, e.q), sx - sz / 2, sy - sz / 2, sz, sz);
  }
  tctx.globalAlpha = 1;
  tctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#04050c'; ctx.fillRect(0, 0, W, H);
  // faint sphere body
  const bg = ctx.createRadialGradient(LAY.cx, LAY.cy, R * 0.1, LAY.cx, LAY.cy, R * 1.05);
  bg.addColorStop(0, 'rgba(40,46,90,0.22)'); bg.addColorStop(0.85, 'rgba(18,20,44,0.18)'); bg.addColorStop(1, 'rgba(4,5,12,0)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(tcv, 0, 0, W, H);

  drawRim();
  drawSeeds();
  drawWell();
  drawFx();
}

function drawRim() {
  const r = run, R = LAY.R, t = game.t;
  ctx.lineWidth = Math.max(1.5, R * 0.006);
  ctx.strokeStyle = 'rgba(150,170,255,0.35)';
  ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150,170,255,0.08)';
  ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * (1.03 + 0.01 * Math.sin(t * 2)), 0, Math.PI * 2); ctx.stroke();
  // rim heat where particles are close to escaping
  const n = r.edge.length, seg = Math.PI * 2 / n;
  ctx.lineWidth = Math.max(3, R * 0.018); ctx.lineCap = 'round';
  for (let b = 0; b < n; b++) {
    const v = Math.min(1, r.edge[b] * 0.2);
    if (v < 0.12) continue;
    ctx.strokeStyle = `rgba(255,${Math.round(120 - 80 * v)},${Math.round(110 - 60 * v)},${0.25 + 0.6 * v})`;
    ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * 1.012, b * seg + 0.02, (b + 1) * seg - 0.02); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // storm warning: a ring that closes in toward the centre
  if (r.pulse) {
    const k = 1 - r.pulse.t / r.pulse.life, pr = R * (1 - ease(k) * 0.9);
    ctx.setLineDash([R * 0.04, R * 0.03]);
    ctx.lineDashOffset = -t * 60;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,90,110,${0.35 + 0.4 * Math.abs(Math.sin(t * 10))})`;
    ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawSeeds() {
  const R = LAY.R;
  for (const s of run.seeds) {
    const [sx, sy] = toScreen(s.x, s.y), fade = Math.min(1, s.t * 2) * (s.t > 12 ? (14 - s.t) / 2 : 1);
    const pulse = 1 + 0.15 * Math.sin(s.t * 6), sz = R * 0.13 * pulse;
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(SPR.seed, sx - sz / 2, sy - sz / 2, sz, sz);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(160,255,190,0.8)'; ctx.lineWidth = 1.5;
    const d = R * 0.035;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.t * 1.5);
    ctx.strokeRect(-d, -d, d * 2, d * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawWell() {
  const r = run, R = LAY.R, [wx, wy] = toScreen(r.well.x, r.well.y), t = game.t;
  const col = r.inv ? [120, 230, 255] : [255, 214, 150];
  const gr = ctx.createRadialGradient(wx, wy, 0, wx, wy, R * 0.16);
  gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.4, rgba(col, 0.12)); gr.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(wx, wy, R * 0.16, 0, Math.PI * 2); ctx.fill();
  // field arcs spin one way when pulling (+), the other when inverted
  ctx.lineWidth = 1.5;
  const dir = r.inv ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    const rad = R * (0.045 + i * 0.022), a0 = t * (2.2 - i * 0.5) * dir + i * 2.1;
    ctx.strokeStyle = rgba(col, 0.6 - i * 0.15);
    ctx.beginPath(); ctx.arc(wx, wy, rad, a0, a0 + Math.PI * 1.2); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(wx, wy, Math.max(3, R * 0.018), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(col, 1);
  ctx.beginPath(); ctx.arc(wx, wy, Math.max(2, R * 0.011), 0, Math.PI * 2); ctx.fill();
}

function drawFx() {
  const R = LAY.R;
  for (const e of run.fx) {
    const k = e.t / e.life;
    if (e.type === 'ring') {
      const [sx, sy] = toScreen(e.x, e.y);
      ctx.strokeStyle = rgba(e.rgb, 1 - k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, R * (0.03 + 0.18 * ease(k)), 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'shock') {
      ctx.strokeStyle = `rgba(255,110,130,${(1 - k) * 0.8})`; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * (0.1 + 0.95 * ease(k)), 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'influx') {
      ctx.strokeStyle = `rgba(160,255,190,${(1 - k) * 0.7})`; ctx.lineWidth = Math.max(3, R * 0.02);
      ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * 1.03, e.a - 0.25, e.a + 0.25); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------- HUD ---
const BTN = [];
function button(r, label, fn, o) {
  o = o || {};
  BTN.push({ r, fn });
  const hot = inRect(ptr.x, ptr.y, r) && !ptr.touch;
  const col = o.col || '#ffd59a';
  ctx.fillStyle = hot ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = col; ctx.lineWidth = hot ? 2 : 1.4;
  roundRect(r.x, r.y, r.w, r.h, Math.min(r.h / 2, 26));
  ctx.fill(); ctx.stroke();
  txt(label, r.x + r.w / 2, r.y + r.h / 2 + 1, o.size || r.h * 0.38, col, 'center', 600);
}
function roundRect(x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}
function iconBtn(x, y, s, kind, fn) {
  const r = { x: x - s / 2, y: y - s / 2, w: s, h: s };
  BTN.push({ r, fn });
  ctx.strokeStyle = 'rgba(200,210,255,0.5)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, s / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(220,226,255,0.85)'; ctx.strokeStyle = ctx.fillStyle;
  const u = s * 0.14;
  if (kind === 'pause') { ctx.fillRect(x - u * 1.2, y - u * 1.6, u * 0.8, u * 3.2); ctx.fillRect(x + u * 0.4, y - u * 1.6, u * 0.8, u * 3.2); }
  else {
    ctx.beginPath(); ctx.moveTo(x - u * 2, y - u * 0.8); ctx.lineTo(x - u * 0.9, y - u * 0.8); ctx.lineTo(x + u * 0.4, y - u * 2);
    ctx.lineTo(x + u * 0.4, y + u * 2); ctx.lineTo(x - u * 0.9, y + u * 0.8); ctx.lineTo(x - u * 2, y + u * 0.8); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.6;
    if (save.muted) { ctx.beginPath(); ctx.moveTo(x + u * 1.1, y - u); ctx.lineTo(x + u * 2.3, y + u); ctx.moveTo(x + u * 2.3, y - u); ctx.lineTo(x + u * 1.1, y + u); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x + u * 0.6, y, u * 1.4, -0.8, 0.8); ctx.stroke(); }
  }
}
function bar(x, y, w, h, v, col, mark) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(x, y, w, h, h / 2); ctx.fill();
  if (v > 0) { ctx.fillStyle = col; roundRect(x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); ctx.fill(); }
  if (mark != null) {
    ctx.fillStyle = 'rgba(255,90,110,0.9)';
    ctx.fillRect(x + w * mark - 1, y - 3, 2, h + 6);
  }
}

function drawHUD() {
  const r = run, fs = clamp(Math.min(W, H) * 0.032, 12, 18), pad = 16;
  txt(fmt(r.score), pad, pad + fs * 0.9, fs * 1.9, '#f4f1ff', 'left', 700);
  txt('PHASE ' + r.phase + '  ·  ' + clock(r.t), pad, pad + fs * 2.6, fs * 0.85, '#9aa3d8', 'left', 500);
  const s = Math.max(36, fs * 2.4);
  iconBtn(W - pad - s / 2, pad + s / 2, s, 'pause', () => { AU.sfx('click'); setPaused(true); });
  iconBtn(W - pad - s * 1.6, pad + s / 2, s, 'mute', () => { AU.setMuted(!save.muted); });

  // bottom bars (bottom-left column on wide screens)
  const side = W / 2 - LAY.R - pad * 2;
  const bw = LAY.wide ? Math.min(260, side) : Math.min(W - pad * 2 - (LAY.touch ? 100 : 0), 460);
  const bx = LAY.wide || LAY.touch ? pad : (W - bw) / 2, bh = Math.max(6, fs * 0.45);
  const y1 = LAY.wide ? H - pad - fs * 4.6 : H - LAY.bottom * 0.72, y2 = LAY.wide ? H - pad - fs * 0.6 : H - LAY.bottom * 0.3;
  const c = contain(r), lose = LOSE_C, scale = 1.5; // bar shows 0..150%
  const danger = clamp((c - lose) / 0.25, 0, 1);
  const ccol = `rgb(${Math.round(lerp(255, 120, danger))},${Math.round(lerp(80, 230, danger))},${Math.round(lerp(100, 160, danger))})`;
  txt('CONTAINMENT', bx, y1 - bh - fs * 0.55, fs * 0.72, '#9aa3d8', 'left', 600);
  txt(Math.round(c * 100) + '%', bx + bw, y1 - bh - fs * 0.55, fs * 0.8, ccol, 'right', 700);
  bar(bx, y1 - bh / 2, bw, bh, c / scale, ccol, lose / scale);
  // which charge is scarce: amber and blue counts beside the label
  const lx = LAY.wide ? bx : bx + fs * 7.6, scarce = r.cp < r.cn ? 0 : 1;
  const ly = LAY.wide ? y1 - bh - fs * 1.9 : y1 - bh - fs * 0.55;
  txt('● ' + Math.round(r.cp), lx, ly, fs * 0.72, rgba(KIND[0].rgb, scarce === 0 ? 1 : 0.6), 'left', 700);
  txt('● ' + Math.round(r.cn), lx + fs * 3.6, ly, fs * 0.72, rgba(KIND[1].rgb, scarce === 1 ? 1 : 0.6), 'left', 700);
  const ecol = r.lock ? 'rgba(120,130,170,0.8)' : r.inv ? '#78e6ff' : '#5fb8ff';
  txt(r.inv ? 'INVERTED' : 'INVERT', bx, y2 - bh - fs * 0.55, fs * 0.72, r.inv ? '#78e6ff' : '#9aa3d8', 'left', 600);
  bar(bx, y2 - bh / 2, bw, bh, r.energy, ecol);

  if (LAY.touch) {
    const s2 = Math.max(64, Math.min(92, W * 0.2));
    const ib = { x: W - pad - s2, y: H - pad - s2, w: s2, h: s2 };
    LAY.invBtn = ib;
    ctx.fillStyle = r.inv ? 'rgba(120,230,255,0.25)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = r.inv ? '#78e6ff' : 'rgba(180,200,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ib.x + s2 / 2, ib.y + s2 / 2, s2 / 2 - 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    txt('INVERT', ib.x + s2 / 2, ib.y + s2 / 2, s2 * 0.17, r.inv ? '#bff3ff' : '#cfd6ff', 'center', 700);
  } else LAY.invBtn = null;

  if (r.banner) {
    const b = r.banner, a = Math.min(1, b.t * 2, (3.2 - b.t) * 3);
    txt(b.text, W / 2, LAY.cy - LAY.R * 0.35, fs * 2.2, '#f4f1ff', 'center', 700, clamp(a, 0, 1) * 0.9);
    if (b.sub) txt(b.sub, W / 2, LAY.cy - LAY.R * 0.35 + fs * 2, fs * 0.95, '#b9c0ee', 'center', 500, clamp(a, 0, 1) * 0.85);
  }
  if (r.pulse) txt('MAGNETIC STORM', W / 2, LAY.cy - LAY.R * 0.62, fs * 1.1, '#ff8a9a', 'center', 700, 0.5 + 0.5 * Math.abs(Math.sin(game.t * 8)));
  if (!save.tut && r.t < 12 && !r.banner) {
    const lines = LAY.touch
      ? ['Drag to move the gravity well.', 'Hold INVERT to pull the blue ones in.']
      : ['Move the mouse to steer the gravity well.', 'Hold the mouse button or Space to invert polarity.'];
    lines.push('Green crystals refill your meter and add particles.');
    lines.forEach((l, i) => txt(l, W / 2, LAY.cy + LAY.R * 0.55 + i * fs * 1.4, fs * 0.9, '#b9c0ee', 'center', 500, Math.min(1, (12 - r.t) / 2) * 0.85));
  }
}
// ---------------------------------------------------------------------------
// Screens, input, main loop, boot.
// ---------------------------------------------------------------------------
const ptr = { x: -1, y: -1, touch: false, down: false };

function drawTitle() {
  const fs = clamp(Math.min(W, H) * 0.032, 12, 18), cx = W / 2;
  ctx.fillStyle = 'rgba(4,5,12,0.45)'; ctx.fillRect(0, 0, W, H);
  const ty = Math.max(fs * 3.5, LAY.cy - LAY.R * 0.55);
  const big = Math.min(fs * 3.4, W / 10);
  txt('MAGNETIC CHAOS', cx, ty, big, '#f4f1ff', 'center', 800);
  txt('KEEP  THE  SPHERE', cx, ty + big * 0.95, big * 0.36, '#ffd59a', 'center', 600);
  const bw = Math.min(280, W - 48), bh = Math.max(48, fs * 3);
  let y = LAY.cy - bh / 2 + LAY.R * 0.05;
  button({ x: cx - bw / 2, y, w: bw, h: bh }, 'PLAY', () => { AU.sfx('click'); startRun(); }, { size: bh * 0.4 });
  y += bh + fs * 1.6;
  if (save.best > 0) {
    txt('BEST  ' + fmt(save.best) + '   ·   PHASE ' + save.bestPhase + '   ·   ' + clock(save.bestTime), cx, y, fs * 0.9, '#9aa3d8', 'center', 600);
    y += fs * 1.8;
  }
  const how = LAY.touch
    ? ['Drag to steer the gravity well.', 'Amber is pulled in. Blue is pushed away.', 'Hold INVERT to swap them.', 'Don’t let the sphere empty.']
    : ['Move the mouse to steer the gravity well.', 'Amber is pulled in. Blue is pushed away.', 'Hold the mouse or Space to swap them.', 'Don’t let the sphere empty.'];
  how.forEach((l, i) => txt(l, cx, y + i * fs * 1.35, fs * 0.9, '#b9c0ee', 'center', 500, 0.9));
  const s = Math.max(36, fs * 2.4);
  iconBtn(W - 16 - s / 2, 16 + s / 2, s, 'mute', () => { AU.setMuted(!save.muted); });
  txt('© 2026 Dr. Zahir Hasan', cx, H - fs * 1.2, fs * 0.7, '#5d6496', 'center', 500);
}

function drawPause() {
  const fs = clamp(Math.min(W, H) * 0.032, 12, 18), cx = W / 2;
  ctx.fillStyle = 'rgba(4,5,12,0.6)'; ctx.fillRect(0, 0, W, H);
  txt('PAUSED', cx, H * 0.38, fs * 2.4, '#f4f1ff', 'center', 700);
  const bw = Math.min(260, W - 48), bh = Math.max(46, fs * 2.8);
  button({ x: cx - bw / 2, y: H * 0.48, w: bw, h: bh }, 'RESUME', () => { AU.sfx('click'); setPaused(false); }, { size: bh * 0.38 });
  button({ x: cx - bw / 2, y: H * 0.48 + bh + 12, w: bw, h: bh * 0.85 }, 'QUIT TO MENU', () => {
    AU.sfx('click'); game.paused = false; Portal.gameplayStop(); newRun(true);
  }, { col: '#9aa3d8', size: bh * 0.3 });
}

function drawDead() {
  const r = run, fs = clamp(Math.min(W, H) * 0.032, 12, 18), cx = W / 2;
  ctx.fillStyle = 'rgba(4,5,12,0.62)'; ctx.fillRect(0, 0, W, H);
  let y = Math.max(fs * 2.5, H * 0.16);
  txt('CONTAINMENT LOST', cx, y, Math.min(fs * 2.2, W / 11), '#ff8a9a', 'center', 800);
  y += fs * 1.9;
  const why = r.cn <= r.cp ? 'Too few blue particles were left inside.' : 'Too few amber particles were left inside.';
  txt(why, cx, y, fs * 0.9, '#d6b6c0', 'center', 500);
  y += fs * 3;
  txt(fmt(r.score), cx, y, fs * 3, '#f4f1ff', 'center', 800);
  y += fs * 2.4;
  txt(r.record ? 'NEW BEST!' : 'BEST  ' + fmt(save.best), cx, y, fs * 1, r.record ? '#ffd59a' : '#9aa3d8', 'center', 700);
  y += fs * 2;
  const stats = 'Phase ' + r.phase + '  ·  ' + clock(r.t) + '  ·  ' + r.collected + ' crystals  ·  ' + r.lost + ' escaped';
  txt(stats, cx, y, Math.min(fs * 0.85, (W - 32) / (stats.length * 0.52)), '#b9c0ee', 'center', 500);
  y += fs * 1.6;
  const tip = wrap(deathTip(), Math.min(W - 40, 560), fs * 0.85, 500);
  tip.forEach((l, i) => txt(l, cx, y + i * fs * 1.2, fs * 0.85, '#7fd7ff', 'center', 500));
  y += fs * (1.2 * tip.length + 1.4);
  const bw = Math.min(300, W - 40), bh = Math.max(46, fs * 2.8);
  const canRevive = Portal.hasRewarded && !r.revived;
  let yb = Math.min(y, H - bh * (canRevive ? 3.1 : 2.1) - 24);
  if (canRevive) {
    if (r.reviveFailed) txt('No video available right now. Sorry!', cx, yb - fs * 0.7, fs * 0.85, '#ff8fa3', 'center', 500);
    button({ x: cx - bw / 2, y: yb, w: bw, h: bh * 0.9 }, 'REVIVE: WATCH AD', () => {
      AU.sfx('click');
      const rr0 = run;
      Portal.rewarded(ok => { if (run !== rr0 || game.state !== 'dead' || !rr0.dead) return; if (ok) revive(); else rr0.reviveFailed = true; });
    }, { col: '#78e6ff', size: bh * 0.32 });
    yb += bh * 0.9 + 12;
  }
  button({ x: cx - bw / 2, y: yb, w: bw, h: bh }, 'RUN AGAIN', () => { AU.sfx('click'); startRun(); }, { size: bh * 0.38 });
  button({ x: cx - bw / 2, y: yb + bh + 12, w: bw, h: bh * 0.8 }, 'MENU', () => { AU.sfx('click'); newRun(true); }, { col: '#9aa3d8', size: bh * 0.3 });
}
function deathTip() {
  const r = run;
  if (r._tip) return r._tip;
  const tips = [
    'Blue particles flee the well. Park it between them and the rim to herd them home.',
    'Inverting pulls the blue ones in but flings the amber ones out. Keep it short.',
    'When the storm ring closes in, gather everything near the centre.',
    'Green crystals refill your invert meter and add a dozen particles.',
    'New particles stream in at the rim from phase 2. Catch them early.',
  ];
  r._tip = r.phase >= 2 && rand() < 0.5 ? tips[2 + Math.floor(rand() * 3)] : tips[Math.floor(rand() * tips.length)];
  return r._tip;
}

// Runs start here so portals get a natural ad break between runs.
let sessionRuns = 0, starting = false;
function startRun() {
  if (starting) return;
  starting = true;
  const go = () => { starting = false; newRun(false); tctx.fillStyle = '#04050c'; tctx.fillRect(0, 0, W, H); Portal.gameplayStart(); };
  if (sessionRuns++ > 0) Portal.midgame(go); else go();
}
function setPaused(p) {
  if (!run || run.dead || game.state !== 'play') { game.paused = false; return; }
  if (game.paused === p) return;
  game.paused = p;
  input.hold = input.keyHold = input.ptrHold = input.padHold = false;
  if (p) Portal.gameplayStop(); else Portal.gameplayStart();
}

// ----------------------------------------------------------------- input ---
let steerId = null, padId = null;
function setPtr(e) {
  const b = cvs.getBoundingClientRect();
  ptr.x = e.clientX - b.left; ptr.y = e.clientY - b.top;
  ptr.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  if (ptr.touch) LAY.touch = true; else if (e.pointerType === 'mouse') LAY.touch = false;
}
function steer(x, y, touch) {
  if (!run || run.demo) return;
  const off = touch ? -Math.min(44, LAY.R * 0.12) : 0; // keep the well above the finger
  run.well.tx = (x - LAY.cx) / LAY.R;
  run.well.ty = (y + off - LAY.cy) / LAY.R;
}
const syncHold = () => { input.hold = input.keyHold || input.ptrHold || input.padHold; };
cvs.addEventListener('pointerdown', e => {
  if (Portal.adActive || Portal.pending) return;
  setPtr(e); ptr.down = true; AU.init();
  try { cvs.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  for (const b of BTN) if (inRect(ptr.x, ptr.y, b.r)) { b.fn(); return; }
  if (game.state !== 'play' || !run || run.dead) return;
  if (game.paused) { setPaused(false); return; }
  if (ptr.touch) {
    if (LAY.invBtn && inRect(ptr.x, ptr.y, LAY.invBtn)) { padId = e.pointerId; input.padHold = true; syncHold(); return; }
    steerId = e.pointerId; steer(ptr.x, ptr.y, true);
  } else if (e.button === 0 || e.button === 2) { input.ptrHold = true; syncHold(); steer(ptr.x, ptr.y, false); }
});
cvs.addEventListener('pointermove', e => {
  setPtr(e);
  if (game.state !== 'play' || game.paused) return;
  if (ptr.touch) { if (e.pointerId === steerId) steer(ptr.x, ptr.y, true); }
  else steer(ptr.x, ptr.y, false);
});
function ptrEnd(e) {
  if (e.pointerId === padId) { padId = null; input.padHold = false; }
  if (e.pointerId === steerId) steerId = null;
  if (e.pointerType === 'mouse') input.ptrHold = false;
  ptr.down = false; syncHold();
}
cvs.addEventListener('pointerup', ptrEnd);
cvs.addEventListener('pointercancel', ptrEnd);
cvs.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (Portal.adActive || Portal.pending) return;
  AU.init();
  const k = e.key.toLowerCase();
  if (k === 'm') { AU.setMuted(!save.muted); return; }
  if (game.state === 'title' && (k === 'enter' || k === ' ')) { startRun(); return; }
  if (game.state === 'dead' && (k === 'enter' || k === 'r')) { startRun(); return; }
  if (game.state !== 'play' || !run || run.dead) return;
  if (k === 'escape' || k === 'p') { setPaused(!game.paused); return; }
  if (k === ' ' || k === 'shift') { if (!game.paused) { input.keyHold = true; syncHold(); } }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'shift') { input.keyHold = false; syncHold(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
window.addEventListener('blur', () => { input.keyHold = input.ptrHold = input.padHold = false; syncHold(); });
window.addEventListener('resize', resize);
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------ loop ---
const STEP = 1 / 60;
let lastT = 0, acc = 0;
function update(dt) {
  game.t += dt;
  const frozen = Portal.adActive || (game.state === 'play' && game.paused);
  if (frozen) return;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 3) { step(STEP); acc -= STEP; n++; }
  if (n === 3) acc = 0;
}
function render() {
  BTN.length = 0;
  drawScene();
  if (game.state === 'title') drawTitle();
  else if (game.state === 'play') { drawHUD(); if (game.paused) drawPause(); }
  else if (game.state === 'dead') drawDead();
  else if (game.state === 'cover') drawCover();
  cvs.style.cursor = BTN.some(b => inRect(ptr.x, ptr.y, b.r)) ? 'pointer' : game.state === 'play' && !game.paused ? 'none' : 'default';
}
// #cover renders a clean title card for store art.
function drawCover() {
  const fs = Math.min(W, H) * 0.05;
  txt('MAGNETIC CHAOS', W / 2, H * 0.14, Math.min(fs * 1.6, W / 9), '#f4f1ff', 'center', 800);
  txt('KEEP  THE  SPHERE', W / 2, H * 0.14 + fs * 1.5, fs * 0.6, '#ffd59a', 'center', 600);
}
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  try { update(dt); render(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function boot() {
  loadSave();
  LAY.touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  resize();
  newRun(true);
  if (location.hash === '#cover') game.state = 'cover';
  requestAnimationFrame(frame);
}
// Test/screenshot hook (no effect on normal play).
window.__mc = { game, P, input, TUNE, get run() { return run; }, newRun, step, startRun, revive, save, LAY };
const wait = ms => new Promise(r => setTimeout(r, ms));
Promise.race([Portal.init(), wait(3000)]).catch(() => {}).then(() => { Portal.loadingStart(); }).then(() => { boot(); Portal.loadingStop(); });
})();
