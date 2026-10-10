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
// Core helpers, saved settings, screen mapping and input.
// World space: the arena is a circle of radius R centred on (0, 0), y down.
// Physics runs in world units so every screen size plays the same game.
// ---------------------------------------------------------------------------
const TAU = Math.PI * 2;
const R = 1000;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rand = (a, b) => a + Math.random() * (b - a);
const smooth01 = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

const Store = {
  get(k, d) { try { const v = localStorage.getItem('mchaos_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('mchaos_' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } },
};
const Settings = { muted: !!Store.get('muted', false) };
const Stats = {
  best: Number(Store.get('best', 0)) || 0,
  runs: Number(Store.get('runs', 0)) || 0,
};

const View = {
  w: 1, h: 1, dpr: 1, scale: 1, quality: 1,
  resize() {
    this.w = Math.max(1, window.innerWidth);
    this.h = Math.max(1, window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    // Arena diameter fills the short side, minus a small margin.
    this.scale = Math.min(this.w, this.h) / (2 * R * 1.075);
  },
  toWorld(x, y) { return [(x - this.w / 2) / this.scale, (y - this.h / 2) / this.scale]; },
};

// Mouse/pen: the gravity well sits under the cursor.
// Touch: drag anywhere to move the well (relative, like a trackpad) so a finger
// never hides the Spark. Quick tap or a second finger = PULSE.
// Keyboard: WASD / arrows move the well, Space = PULSE.
const Input = {
  wx: 0, wy: 0, mode: 'mouse', keys: Object.create(null), pulse: false, touch: null, sens: 1.4,
  init(canvas) {
    canvas.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e), { passive: true });
    window.addEventListener('pointerup', e => this.up(e));
    window.addEventListener('pointercancel', e => this.up(e));
    window.addEventListener('contextmenu', e => e.preventDefault());
    window.addEventListener('keydown', e => this.key(e, true));
    window.addEventListener('keyup', e => this.key(e, false));
    window.addEventListener('blur', () => { this.keys = Object.create(null); this.touch = null; });
  },
  clampWell() {
    const r = Math.hypot(this.wx, this.wy), m = R * 0.97;
    if (r > m) { this.wx *= m / r; this.wy *= m / r; }
  },
  setAbs(x, y) { const p = View.toWorld(x, y); this.wx = p[0]; this.wy = p[1]; this.clampWell(); },
  down(e) {
    AU.init();
    if (e.pointerType !== 'touch') {
      this.mode = 'mouse'; this.setAbs(e.clientX, e.clientY);
      if (e.button === 0) this.pulse = true;
      return;
    }
    e.preventDefault();
    if (this.touch && this.touch.id !== e.pointerId) { this.pulse = true; return; }
    this.mode = 'touch';
    this.touch = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, moved: 0 };
  },
  move(e) {
    if (e.pointerType !== 'touch') { this.mode = 'mouse'; this.setAbs(e.clientX, e.clientY); return; }
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    t.x = e.clientX; t.y = e.clientY; t.moved += Math.abs(dx) + Math.abs(dy);
    this.wx += dx / View.scale * this.sens;
    this.wy += dy / View.scale * this.sens;
    this.clampWell();
  },
  up(e) {
    const t = this.touch;
    if (!t || t.id !== e.pointerId) return;
    if (e.type === 'pointerup' && e.timeStamp - t.t < 280 && t.moved < 16) this.pulse = true;
    this.touch = null;
  },
  key(e, down) {
    const k = e.code;
    if (k === 'Space' || k.indexOf('Arrow') === 0) e.preventDefault();
    this.keys[k] = down;
    if (down && !e.repeat) { AU.init(); UI.onKey(k); }
  },
  update(dt) {
    const K = this.keys;
    let dx = 0, dy = 0;
    if (K.KeyA || K.ArrowLeft) dx--;
    if (K.KeyD || K.ArrowRight) dx++;
    if (K.KeyW || K.ArrowUp) dy--;
    if (K.KeyS || K.ArrowDown) dy++;
    if (dx || dy) {
      this.mode = 'keys';
      const l = Math.hypot(dx, dy);
      this.wx += dx / l * 1500 * dt; this.wy += dy / l * 1500 * dt;
      this.clampWell();
    }
  },
  takePulse() { const p = this.pulse; this.pulse = false; return p; },
};
// ---------------------------------------------------------------------------
// Audio: everything is synthesised live with Web Audio, no sound files.
// A detuned ambient drone opens up as intensity rises; a heartbeat starts slow
// and climbs to a frantic pulse; an arpeggio and hats join in past 30%/55%.
// ---------------------------------------------------------------------------
const AU = {
  ctx: null, master: null, fx: null, noise: null, ready: false,
  intensity: 0, danger: 0, beatOn: false, nextBeat: 0, step: 0, beats: [],
  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !UI.paused && !Portal.adActive) this.ctx.resume().catch(() => {});
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ctx = new AC(); } catch (e) { return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
    this.master.connect(comp); comp.connect(c.destination);
    const len = c.sampleRate;
    this.noise = c.createBuffer(1, len, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // Cheap space: filtered feedback delay.
    this.fx = c.createGain(); this.fx.gain.value = 0.5;
    const dl = c.createDelay(1), fb = c.createGain(), lp = c.createBiquadFilter();
    dl.delayTime.value = 0.29; fb.gain.value = 0.38; lp.frequency.value = 2400;
    this.fx.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(this.master);
    this.buildDrone();
    this.ready = true;
    this.applyGain();
    if (c.state === 'suspended') c.resume().catch(() => {});
    setInterval(() => this.schedule(), 25);
  },
  applyGain() {
    if (!this.ready) return;
    const on = !Settings.muted && !Portal.sdkMute && !Portal.adActive;
    this.master.gain.setTargetAtTime(on ? 0.85 : 0, this.ctx.currentTime, 0.04);
  },
  suspend() { if (this.ctx && this.ctx.state === 'running') this.ctx.suspend().catch(() => {}); },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); },
  osc(type, f) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; return o; },
  gain(v) { const g = this.ctx.createGain(); g.gain.value = v; return g; },
  filt(type, f, q) { const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; return b; },
  buildDrone() {
    const c = this.ctx;
    this.dFilter = this.filt('lowpass', 220, 5);
    this.dGain = this.gain(0);
    this.dFilter.connect(this.dGain); this.dGain.connect(this.master);
    [['sawtooth', 55, 0.28], ['sawtooth', 55.35, 0.28], ['sawtooth', 82.6, 0.16], ['sine', 27.5, 0.55]].forEach(v => {
      const o = this.osc(v[0], v[1]), g = this.gain(v[2]);
      o.connect(g); g.connect(this.dFilter); o.start();
    });
    const lfo = this.osc('sine', 0.11), lg = this.gain(80);
    lfo.connect(lg); lg.connect(this.dFilter.frequency); lfo.start();
    // Shimmering pad that fades in with intensity.
    this.pGain = this.gain(0);
    const pf = this.filt('bandpass', 950, 0.8);
    pf.connect(this.pGain); this.pGain.connect(this.master); this.pGain.connect(this.fx);
    [220, 329.6, 440.5, 659.3].forEach(f => {
      const o = this.osc('triangle', f), v = this.osc('sine', rand(3, 6)), vg = this.gain(f * 0.004);
      v.connect(vg); vg.connect(o.frequency); v.start(); o.connect(pf); o.start();
    });
    void c;
  },
  // Called every frame by the game.
  setMood(intensity, danger, beatOn) {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.intensity = intensity; this.danger = danger;
    if (beatOn && !this.beatOn) { this.nextBeat = t + 0.08; this.step = 0; }
    this.beatOn = beatOn;
    this.dFilter.frequency.setTargetAtTime(170 + intensity * 1300 + danger * 1700, t, 0.12);
    this.dGain.gain.setTargetAtTime(0.15 + intensity * 0.1, t, 0.3);
    this.pGain.gain.setTargetAtTime(beatOn ? 0.01 + intensity * 0.03 : 0.012, t, 0.6);
  },
  // Heartbeat glow for the arena rim: 1 right on a beat, decaying after.
  pulseLevel() {
    if (!this.ready) return 0;
    const now = this.ctx.currentTime;
    while (this.beats.length > 1 && this.beats[1] <= now) this.beats.shift();
    const b = this.beats[0];
    if (b === undefined || b > now) return 0;
    return Math.exp(-(now - b) * 7);
  },
  schedule() {
    if (!this.ready || this.ctx.state !== 'running' || !this.beatOn) return;
    const I = this.intensity, ahead = this.ctx.currentTime + 0.12;
    const spb = 60 / (54 + I * 116), s16 = spb / 4;
    const prog = [0, 8, 10, 7];                 // A minor: i - VI - VII - v
    const pat = [0, 7, 12, 15, 19, 15, 12, 7];
    while (this.nextBeat < ahead) {
      const t = this.nextBeat, st = this.step % 16;
      if (st === 0 || st === 8) { this.heart(t, 0.5 + 0.5 * I, false); this.beats.push(t); }
      if (st === 2 || st === 10) this.heart(t, 0.35 + 0.4 * I, true);
      if (I > 0.62 && (st === 4 || st === 12)) this.heart(t, 0.25 + 0.3 * I, false);
      if (I > 0.3) {
        const root = prog[Math.floor(this.step / 32) % 4];
        const n = root + pat[st % 8] + (st >= 8 && I > 0.5 ? 12 : 0);
        this.pluck(t, 110 * Math.pow(2, n / 12), 0.03 + 0.05 * (I - 0.3));
      }
      if (I > 0.5 && st % 2 === 0) this.hat(t, 0.05 + 0.06 * I, st % 4 === 2 ? 0.09 : 0.03);
      if (I > 0.8 && st % 4 === 3) this.hat(t, 0.04, 0.02);
      this.step++; this.nextBeat += s16;
    }
  },
  env(g, t, v, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(v, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  },
  heart(t, v, dub) {
    const o = this.osc('sine', dub ? 92 : 118), g = this.gain(0);
    o.frequency.setValueAtTime(dub ? 92 : 118, t);
    o.frequency.exponentialRampToValueAtTime(36, t + 0.15);
    this.env(g, t, v * (dub ? 0.65 : 1), 0.006, 0.3);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.34);
  },
  pluck(t, f, v) {
    const o = this.osc('square', f), g = this.gain(0), fl = this.filt('lowpass', 500, 7);
    fl.frequency.setValueAtTime(500 + 3200 * this.intensity, t);
    fl.frequency.exponentialRampToValueAtTime(280, t + 0.13);
    this.env(g, t, v, 0.004, 0.16);
    o.connect(fl); fl.connect(g); g.connect(this.master); g.connect(this.fx);
    o.start(t); o.stop(t + 0.2);
  },
  hat(t, v, len) {
    const s = this.ctx.createBufferSource(), g = this.gain(0), f = this.filt('highpass', 7200);
    s.buffer = this.noise;
    this.env(g, t, v, 0.002, len);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  },
  noiseHit(t, v, f0, f1, dur, type) {
    const s = this.ctx.createBufferSource(), g = this.gain(0), f = this.filt(type || 'lowpass', f0, 1.5);
    s.buffer = this.noise;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, v, 0.01, dur);
    s.connect(f); f.connect(g); g.connect(this.master); g.connect(this.fx);
    s.start(t); s.stop(t + dur + 0.05);
  },
  tone(type, f0, f1, v, a, d, toFx) {
    if (!this.ready) return;
    const t = this.ctx.currentTime, o = this.osc(type, f0), g = this.gain(0);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + d);
    this.env(g, t, v, a, d);
    o.connect(g); g.connect(this.master); if (toFx) g.connect(this.fx);
    o.start(t); o.stop(t + a + d + 0.05);
  },
  graze(combo) {
    const f = 880 * Math.pow(2, Math.min(combo, 14) / 12);
    this.tone('sine', f, f * 1.01, 0.09, 0.003, 0.08, true);
  },
  pulse() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.35, 180, 2600, 0.55, 'bandpass');
    this.tone('sine', 90, 32, 0.6, 0.005, 0.5);
  },
  denied() { this.tone('square', 160, 120, 0.05, 0.003, 0.08); },
  warn() { this.tone('square', 990, 990, 0.05, 0.003, 0.07); },
  flip() { this.tone('sawtooth', 1400, 90, 0.16, 0.005, 0.4, true); },
  anomaly() { this.tone('sine', 160, 640, 0.14, 0.4, 0.5, true); },
  milestone() {
    this.tone('sine', 1318.5, 1318.5, 0.07, 0.004, 1.1, true);
    this.tone('sine', 1975.5, 1975.5, 0.04, 0.004, 0.9, true);
  },
  absorb() { this.tone('sine', 300, 60, 0.04, 0.004, 0.2); },
  click() { this.tone('triangle', 660, 880, 0.08, 0.002, 0.07); },
  death() {
    if (!this.ready) return;
    const t = this.ctx.currentTime;
    this.noiseHit(t, 0.6, 4000, 90, 1.3);
    this.tone('sine', 70, 24, 0.8, 0.005, 1.2);
    for (let i = 0; i < 7; i++) {
      const o = this.osc('sine', rand(1800, 4200)), g = this.gain(0), tt = t + i * 0.035;
      this.env(g, tt, 0.05, 0.002, 0.25);
      o.connect(g); g.connect(this.fx); o.start(tt); o.stop(tt + 0.3);
    }
  },
};
// ---------------------------------------------------------------------------
// WebGL renderer. Three passes per frame:
//   1. sprites  -> scene texture (additive glow quads, one draw call)
//   2. trail    -> ping-pong texture: max(previous * decay, scene) = motion trails
//   3. composite-> screen: background grid, arena rim, lensing for anomalies,
//                  bloom from the trail, chromatic aberration, tonemap, grain.
// Plain WebGL 1 so it runs everywhere, including old phones and portal iframes.
// ---------------------------------------------------------------------------
const SPRITE_VS = `
attribute vec2 aPos; attribute vec2 aCorner; attribute vec2 aSize; attribute float aAng;
attribute vec4 aCol; attribute float aShape;
uniform vec2 uScale; uniform vec2 uCam;
varying vec2 vUV; varying vec4 vCol; varying float vShape;
void main() {
  float c = cos(aAng), s = sin(aAng);
  vec2 o = aCorner * aSize;
  o = vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  vec2 p = (aPos + o - uCam) * uScale;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  vUV = aCorner; vCol = aCol; vShape = aShape;
}`;
const SPRITE_FS = `
precision mediump float;
varying vec2 vUV; varying vec4 vCol; varying float vShape;
void main() {
  float d = length(vUV);
  float f;
  if (vShape < 0.5) f = exp(-d * d * 4.5) * (1.0 - smoothstep(0.85, 1.0, d));
  else if (vShape < 1.5) { float k = (d - 0.86) * 16.0; f = exp(-k * k); }
  else if (vShape < 2.5) f = smoothstep(1.0, 0.8, d) + exp(-d * d * 3.0) * 0.3;
  else f = smoothstep(1.0, 0.15, d);
  gl_FragColor = vec4(vCol.rgb * (vCol.a * f), 1.0);
}`;
const QUAD_VS = `
attribute vec2 aPos; varying vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const TRAIL_FS = `
precision mediump float;
varying vec2 vUV; uniform sampler2D uPrev; uniform sampler2D uScene; uniform float uDecay;
void main() {
  vec3 p = texture2D(uPrev, vUV).rgb * uDecay - 2.0 / 255.0;
  gl_FragColor = vec4(max(p, texture2D(uScene, vUV).rgb), 1.0);
}`;
const COMP_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUV;
uniform sampler2D uScene; uniform sampler2D uTrail;
uniform vec2 uRes; uniform vec4 uZone[4]; uniform vec3 uRim; uniform vec4 uRimFx; uniform vec3 uRimCol;
uniform float uTime; uniform float uAberr; uniform float uTwist; uniform vec3 uFlash; uniform float uDark;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUV, c = uRim.xy;
  if (uTwist != 0.0) {
    vec2 d = uv - c; d.x *= aspect;
    float r = length(d) / uRim.z;
    float a = uTwist * exp(-r * r * 1.4);
    float cs = cos(a), sn = sin(a);
    d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs); d.x /= aspect;
    uv = c + d;
  }
  vec3 tint = vec3(0.0), ring = vec3(0.0); float horizon = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 z = uZone[i];
    if (z.w == 0.0) continue;
    vec2 d = uv - z.xy; d.x *= aspect;
    float r = length(d) + 1e-5; vec2 n = d / r; n.x /= aspect;
    if (z.w > 0.0) {
      float m = 1.0 - smoothstep(z.z * 0.55, z.z, r);
      uv += n * sin(r / z.z * 30.0 - uTime * 5.0) * 0.0032 * z.w * m;
      tint += vec3(0.02, 0.07, 0.17) * m * z.w;
      float e = (r - z.z) / (z.z * 0.025);
      ring += vec3(0.3, 0.65, 1.0) * exp(-e * e) * 0.45 * z.w;
    } else {
      float s = -z.w, h = z.z;
      uv += n * (h * h * 1.1 / r) * s;
      horizon = max(horizon, (1.0 - smoothstep(h * 0.85, h * 1.08, r)) * s);
      float e = (r - h * 1.2) / (h * 0.1);
      ring += vec3(1.0, 0.55, 0.22) * exp(-e * e) * 0.9 * s;
    }
  }
  vec2 ab = (uv - 0.5) * uAberr;
  vec3 col = vec3(texture2D(uScene, uv + ab).r, texture2D(uScene, uv).g, texture2D(uScene, uv - ab).b);
  vec3 tr = texture2D(uTrail, uv).rgb;
  vec2 px = 1.0 / uRes;
  vec3 bl = vec3(0.0);
  bl += texture2D(uTrail, uv + vec2( 4.0,  0.0) * px).rgb;
  bl += texture2D(uTrail, uv + vec2(-2.0,  3.5) * px).rgb;
  bl += texture2D(uTrail, uv + vec2(-2.0, -3.5) * px).rgb;
  bl += texture2D(uTrail, uv + vec2(-10.0, 0.0) * px).rgb;
  bl += texture2D(uTrail, uv + vec2( 5.0,  8.7) * px).rgb;
  bl += texture2D(uTrail, uv + vec2( 5.0, -8.7) * px).rgb;
  bl += texture2D(uTrail, uv + vec2( 0.0, 16.0) * px).rgb * 0.7;
  bl += texture2D(uTrail, uv + vec2(13.9, -8.0) * px).rgb * 0.7;
  bl += texture2D(uTrail, uv + vec2(-13.9,-8.0) * px).rgb * 0.7;
  bl /= 8.1;
  vec2 q = uv - c; q.x *= aspect;
  float rr = length(q) / uRim.z, ang = atan(q.y, q.x);
  vec3 bg = vec3(0.010, 0.012, 0.028) + vec3(0.030, 0.018, 0.070) * exp(-rr * rr * 1.6);
  float spokes = smoothstep(0.992, 1.0, cos(ang * 24.0 + uTime * 0.05));
  float rings = smoothstep(0.96, 1.0, cos(rr * 3.14159 * 8.0 - uTime * 0.4));
  bg += vec3(0.30, 0.38, 0.95) * (spokes * 0.5 + rings) * 0.02 * (1.0 - smoothstep(0.98, 1.0, rr));
  bg *= mix(1.0, 0.4, smoothstep(1.0, 1.03, rr));
  float rimD = abs(rr - 1.0) * uRim.z * uRes.y;
  float rim = exp(-rimD * rimD / 3.0) + exp(-rimD / 12.0) * 0.28;
  float danger = uRimFx.y * smoothstep(0.55, 1.0, cos(ang - uRimFx.x));
  vec3 rimCol = mix(uRimCol, vec3(1.0, 0.1, 0.12), clamp(danger, 0.0, 1.0));
  bg += rimCol * rim * (0.5 + uRimFx.z * 0.7 + danger * 1.6);
  vec3 o = bg + tint + ring + col + tr * 0.5 + bl * 0.75;
  o = 1.0 - exp(-o * 1.3);
  o *= 1.0 - horizon;
  vec2 vq = (vUV - 0.5) * vec2(aspect, 1.0);
  o *= 1.0 - smoothstep(0.55, 1.35, length(vq)) * 0.65;
  o = o * (1.0 - uDark) + uFlash;
  o += (hash(vUV * uRes + fract(uTime) * 91.7) - 0.5) * 0.025;
  gl_FragColor = vec4(o, 1.0);
}`;

const GL = {
  gl: null, ok: false, max: 6000, n: 0, data: null, idx: 0,
  init(canvas) {
    this.canvas = canvas;
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
    let gl = null;
    try { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) return false;
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.ok = false; }, false);
    canvas.addEventListener('webglcontextrestored', () => { this.setup(); this.resize(); }, false);
    this.setup();
    return this.ok;
  },
  shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
    return s;
  },
  program(vs, fs, attrs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this.shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  },
  setup() {
    const gl = this.gl;
    try {
      this.sprite = this.program(SPRITE_VS, SPRITE_FS, ['aPos', 'aCorner', 'aSize', 'aAng', 'aCol', 'aShape']);
      this.trail = this.program(QUAD_VS, TRAIL_FS, ['aPos']);
      this.comp = this.program(QUAD_VS, COMP_FS, ['aPos']);
    } catch (e) {
      console.error(e); this.ok = false; return;
    }
    this.data = new Float32Array(this.max * 48);
    const cx = [-1, 1, 1, -1], cy = [-1, -1, 1, 1];
    for (let i = 0; i < this.max; i++) for (let v = 0; v < 4; v++) {
      this.data[i * 48 + v * 12 + 2] = cx[v]; this.data[i * 48 + v * 12 + 3] = cy[v];
    }
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const ix = new Uint16Array(this.max * 6);
    for (let i = 0; i < this.max; i++) {
      const v = i * 4, o = i * 6;
      ix[o] = v; ix[o + 1] = v + 1; ix[o + 2] = v + 2; ix[o + 3] = v; ix[o + 4] = v + 2; ix[o + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.targets = null; this.tw = 0;
    this.ok = true;
  },
  target(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  },
  resize() {
    if (!this.ok) return;
    const gl = this.gl, k = View.dpr * View.quality;
    const w = Math.max(2, Math.round(View.w * k)), h = Math.max(2, Math.round(View.h * k));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    if (this.targets && this.tw === w && this.th === h) return;
    if (this.targets) this.targets.forEach(t => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
    this.tw = w; this.th = h;
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.targets = [this.target(w, h), this.target(hw, hh), this.target(hw, hh)];
    this.ping = 1;
  },
  begin() { this.n = 0; },
  // x, y centre (world), w, h half-extents, ang rotation, rgb + alpha, shape:
  // 0 soft glow, 1 ring, 2 solid disc, 3 shard.
  spr(x, y, w, h, ang, r, g, b, a, shape) {
    if (this.n >= this.max || a <= 0.003) return;
    const d = this.data;
    let o = this.n * 48;
    for (let v = 0; v < 4; v++, o += 12) {
      d[o] = x; d[o + 1] = y; d[o + 4] = w; d[o + 5] = h; d[o + 6] = ang;
      d[o + 7] = r; d[o + 8] = g; d[o + 9] = b; d[o + 10] = a; d[o + 11] = shape;
    }
    this.n++;
  },
  dot(x, y, s, c, a, shape) { this.spr(x, y, s, s, 0, c[0], c[1], c[2], a, shape || 0); },
  quadDraw(prog) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    for (let i = 1; i < 6; i++) gl.disableVertexAttribArray(i);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog.p);
  },
  frame(U) {
    if (!this.ok || this.gl.isContextLost()) return;
    const gl = this.gl, S = this.targets[0];
    let A = this.targets[this.ping], B = this.targets[3 - this.ping];
    // 1. sprites
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb);
    gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.n) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.sprite.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 48));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      const st = 48, sizes = [2, 2, 2, 1, 4, 1];
      let off = 0;
      for (let i = 0; i < 6; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, st, off);
        off += sizes[i] * 4;
      }
      gl.uniform2f(this.sprite.u.uScale, 2 * View.scale / View.w, 2 * View.scale / View.h);
      gl.uniform2f(this.sprite.u.uCam, U.camX, U.camY);
      gl.drawElements(gl.TRIANGLES, this.n * 6, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
    }
    // 2. trails
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
    gl.viewport(0, 0, B.w, B.h);
    this.quadDraw(this.trail);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.uniform1i(this.trail.u.uPrev, 0); gl.uniform1i(this.trail.u.uScene, 1);
    gl.uniform1f(this.trail.u.uDecay, U.decay);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.ping = 3 - this.ping;
    // 3. composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const c = this.comp, u = c.u;
    this.quadDraw(c);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.uniform1i(u.uScene, 0); gl.uniform1i(u.uTrail, 1);
    gl.uniform2f(u.uRes, View.w, View.h);
    gl.uniform4fv(u.uZone, U.zones);
    gl.uniform3f(u.uRim, U.rimX, U.rimY, U.rimR);
    gl.uniform4f(u.uRimFx, U.dangerAng, U.danger, U.beat, 0);
    gl.uniform3fv(u.uRimCol, U.rimCol);
    gl.uniform1f(u.uTime, U.time % 1000);
    gl.uniform1f(u.uAberr, U.aberr);
    gl.uniform1f(u.uTwist, U.twist);
    gl.uniform3fv(u.uFlash, U.flash);
    gl.uniform1f(u.uDark, U.dark);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
};
// ---------------------------------------------------------------------------
// Simulation. Fixed 120 Hz physics steps, struct-of-arrays for the debris so a
// few hundred fragments cost almost nothing.
//
// Rules: the Spark is pulled toward your gravity well. Debris with the SAME
// charge as the Spark is repelled by it (harmless). Debris with the OPPOSITE
// charge is attracted to it and destroys it on contact. So does the arena wall.
// Brushing past opposite debris without touching it is a GRAZE; grazes charge
// the PULSE, a shockwave that throws debris away from the Spark.
// ---------------------------------------------------------------------------
const MAXF = 900;
const F = {
  n: 0,
  x: new Float32Array(MAXF), y: new Float32Array(MAXF),
  vx: new Float32Array(MAXF), vy: new Float32Array(MAXF),
  r: new Float32Array(MAXF), age: new Float32Array(MAXF), life: new Float32Array(MAXF),
  q: new Int8Array(MAXF), gz: new Uint8Array(MAXF),
};
const MAXP = 1400;
const P = {
  n: 0,
  x: new Float32Array(MAXP), y: new Float32Array(MAXP), vx: new Float32Array(MAXP), vy: new Float32Array(MAXP),
  t: new Float32Array(MAXP), life: new Float32Array(MAXP), s: new Float32Array(MAXP),
  r: new Float32Array(MAXP), g: new Float32Array(MAXP), b: new Float32Array(MAXP),
};
const COL = { pos: [0.22, 0.9, 1.0], neg: [1.0, 0.2, 0.52], white: [1, 1, 1], well: [0.62, 0.45, 1.0], amber: [1.0, 0.62, 0.25], red: [1, 0.15, 0.18], blue: [0.35, 0.65, 1.0] };
const qcol = q => (q > 0 ? COL.pos : COL.neg);
const SPARK_R = 22;
// Plummer-softened pull on debris: a = G d / (d^2 + e^2)^1.5, peak 0.385 G / e^2 ~ 135 at d = 226.
const WELL_G = 3.6e7, WELL_E2 = 320 * 320;
const K_SPRING = 22, DAMP = 4.7;             // Spark -> well spring (damping ratio ~0.5)
const ANOM = {
  dilation: { name: 'TIME DILATION', sub: 'Everything slows inside the ring' },
  flip: { name: 'POLARITY FLIP', sub: 'Your charge is about to invert' },
  warp: { name: 'GRAVITY WARP', sub: 'The swirl reverses' },
  storm: { name: 'CHARGE STORM', sub: 'Opposite debris incoming' },
  sing: { name: 'SINGULARITY', sub: "Don't fall in" },
};
const TIERS = [[0, 'STATIC'], [10, 'SPARK'], [20, 'CURRENT'], [30, 'RESONANT'], [45, 'SURGE'], [60, 'FLOW STATE'],
  [90, 'TRANSCENDENT'], [120, 'SINGULAR MIND'], [180, 'BEYOND CHAOS']];
const tierFor = t => { let n = TIERS[0][1]; for (const x of TIERS) if (t >= x[0]) n = x[1]; return n; };

const Game = {
  state: 'title', clock: 0, t: 0, acc: 0, slow: 1,
  spark: { x: 0, y: 0, vx: 0, vy: 0, q: 1, inv: 0, mass: 1, dead: false },
  well: { x: 0, y: 0 },
  meter: 1, grazes: 0, combo: 0, comboT: 0, bestCombo: 0, pulses: 0, survived: 0,
  anoms: [], nextAnom: 10, anomCount: 0, swirl: 1, swirlTarget: 1,
  shake: 0, flash: [0, 0, 0], waves: [], deathT: 0, cause: '', revived: false,
  nextMilestone: 10, spawnAcc: 0, minOpp: 1e9, danger: 0, wallDanger: 0, flipWarn: 0, warnBeep: 0,
  dil: [], sing: [],

  toTitle() {
    this.state = 'title';
    this.reset();
    this.spark.dead = true;
    for (let i = 0; i < 240; i++) this.spawnFrag(Math.random() < 0.5 ? 1 : -1, true);
  },
  reset() {
    F.n = 0; P.n = 0;
    const s = this.spark;
    s.x = 0; s.y = 0; s.vx = 0; s.vy = 0; s.q = 1; s.inv = 2; s.mass = 1; s.dead = false;
    this.well.x = 0; this.well.y = 0; Input.wx = 0; Input.wy = 0;
    this.t = 0; this.acc = 0; this.slow = 1; this.meter = 1; this.grazes = 0; this.combo = 0; this.comboT = 0;
    this.bestCombo = 0; this.pulses = 0; this.survived = 0; this.anoms = []; this.nextAnom = 9; this.anomCount = 0;
    this.swirl = 1; this.swirlTarget = 1; this.shake = 0; this.waves = []; this.deathT = 0; this.cause = '';
    this.revived = false; this.nextMilestone = 10; this.spawnAcc = 0; this.flipWarn = 0; this.danger = 0; this.wallDanger = 0;
  },
  start() {
    this.reset();
    // Mouse players start with the well where the cursor already is.
    if (Input.mode === 'mouse' && UI.lastMouse) Input.setAbs(UI.lastMouse[0], UI.lastMouse[1]);
    this.well.x = Input.wx; this.well.y = Input.wy;
    this.spark.x = this.well.x * 0.5; this.spark.y = this.well.y * 0.5;
    for (let i = 0; i < 45; i++) this.spawnFrag(0, true);
    this.state = 'play';
    Input.pulse = false;
    Stats.runs++; Store.set('runs', Stats.runs);
    Portal.gameplayStart();
  },
  get intensity() { return clamp(this.t / 150, 0, 1); },
  get oppFraction() {
    const t = this.t;
    if (t < 30) return lerp(0.08, 0.3, t / 30);   // gentle on-ramp
    return 0.3 + 0.25 * clamp((t - 30) / 150, 0, 1) + 0.12 * clamp((t - 180) / 240, 0, 1);
  },
  // Early-game ramp: 0 at the start, 1 after 90 s. Threats grow in gradually.
  get ramp() { return this.state === 'play' ? smooth01(this.t / 90) : 1; },
  // Overdrive: past the first minute the whole swarm keeps speeding up.
  get speedUp() { return 1 + 0.7 * clamp((this.t - 45) / 300, 0, 1); },

  // --- debris ---------------------------------------------------------------
  spawnFrag(q, scatter, idx) {
    const i = idx === undefined ? F.n : idx;
    if (i >= MAXF) return -1;
    if (idx === undefined) F.n++;
    const s = this.spark;
    let a = 0, rr = 0;
    for (let k = 0; k < 8; k++) {
      a = Math.random() * TAU;
      rr = scatter ? R * Math.sqrt(rand(0.12, 0.9)) : R * rand(0.8, 0.94);
      const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
      if (s.dead || (x - s.x) ** 2 + (y - s.y) ** 2 > 420 * 420) break;
    }
    F.x[i] = Math.cos(a) * rr; F.y[i] = Math.sin(a) * rr;
    const sp = rr * 0.52 * rand(0.8, 1.1) * (this.swirl < 0 ? -1 : 1);
    F.vx[i] = -Math.sin(a) * sp; F.vy[i] = Math.cos(a) * sp;
    F.r[i] = rand(7, 11) + Math.min(this.t / 25, 6) * Math.random();
    F.age[i] = 0; F.life[i] = rand(14, 26); F.gz[i] = 0;
    F.q[i] = q || (Math.random() < this.oppFraction ? -s.q : s.q);
    return i;
  },

  // --- frame update -----------------------------------------------------------
  update(dt) {
    this.clock += dt;
    const play = this.state === 'play';
    if (this.state === 'dying') {
      this.deathT += dt;
      this.slow = lerp(this.slow, 0.1, 1 - Math.exp(-dt * 5));
      if (this.deathT > 1.25) { this.state = 'over'; UI.showOver(); }
    } else if (this.state === 'over') this.slow = lerp(this.slow, 0.3, 1 - Math.exp(-dt * 2));
    else this.slow = lerp(this.slow, 1, 1 - Math.exp(-dt * 6));

    Input.update(dt);
    if (play) {
      this.t += dt;
      this.spark.mass = 1 + Math.min(this.t / 85, 1.5);
      if (Input.takePulse()) this.tryPulse();
      this.updateSpawns(dt);
      this.updateAnoms(dt);
      if (this.t >= this.nextMilestone) { this.milestone(this.nextMilestone); this.nextMilestone += 10; }
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
    } else {
      Input.pulse = false;
      if (this.state === 'title') {
        // Attract mode: the well drifts on its own unless the player moves it.
        if (Input.mode !== 'mouse' || !UI.lastMouse) {
          Input.wx = Math.cos(this.clock * 0.31) * R * 0.45; Input.wy = Math.sin(this.clock * 0.47) * R * 0.35;
        }
        for (let i = 0; i < F.n; i++) if (F.age[i] > F.life[i]) this.spawnFrag(Math.random() < 0.5 ? 1 : -1, false, i);
      }
    }
    this.swirl = lerp(this.swirl, this.swirlTarget, 1 - Math.exp(-dt * 1.6));
    const k = 1 - Math.exp(-dt * (Input.mode === 'mouse' ? 28 : 40));
    this.well.x += (Input.wx - this.well.x) * k; this.well.y += (Input.wy - this.well.y) * k;

    const H = 1 / 120;
    this.acc += dt * this.slow;
    let steps = 0;
    while (this.acc >= H && steps < 8) { this.step(H); this.acc -= H; steps++; }
    if (steps >= 8) this.acc = 0;
    this.updateFx(dt * this.slow, dt);
  },

  updateSpawns(dt) {
    const target = Math.min(55 + this.t * 3.1, 640);
    this.spawnAcc = Math.min(this.spawnAcc + dt * 24, 4);
    while (F.n < target && this.spawnAcc >= 1) { this.spawnFrag(0); this.spawnAcc--; }
    for (let i = 0; i < F.n; i++) if (F.age[i] > F.life[i]) this.spawnFrag(0, false, i);
  },

  // --- anomalies --------------------------------------------------------------
  updateAnoms(dt) {
    this.nextAnom -= dt;
    if (this.nextAnom <= 0) {
      this.spawnAnom();
      const base = Math.max(this.t > 180 ? 4.5 : 6.5, 12.5 - this.t / 16);
      this.nextAnom = base + rand(-1.5, 2);
      if (this.t > 75 && Math.random() < (this.t > 180 ? 0.6 : 0.35)) this.nextAnom = 2.5;
    }
    const s = this.spark;
    this.flipWarn = 0;
    for (const a of this.anoms) {
      a.t += dt;
      const inT = a.t - (a.warn || 0);
      a.str = smooth01(inT / 0.9) * smooth01((a.dur - a.t) / 0.9);
      if (a.type === 'flip') {
        if (a.t < a.warn) {
          this.flipWarn = a.t / a.warn;
          this.warnBeep -= dt;
          if (this.warnBeep <= 0) { AU.warn(); this.warnBeep = lerp(0.42, 0.09, a.t / a.warn); }
        } else if (!a.fired) {
          a.fired = true;
          s.q = -s.q; s.inv = Math.max(s.inv, 0.6);
          for (let i = 0; i < F.n; i++) {
            F.gz[i] = 0;
            if (Math.random() < 0.5) F.q[i] = -F.q[i];
            // Fairness: newly-opposite debris close to the Spark gets thrown clear.
            const dx = F.x[i] - s.x, dy = F.y[i] - s.y, d = Math.hypot(dx, dy) + 1e-3;
            if (F.q[i] !== s.q && d < 320) { const k = 900 * (1 - d / 320) + 200; F.vx[i] += dx / d * k; F.vy[i] += dy / d * k; }
          }
          AU.flip(); this.shake = Math.max(this.shake, 0.5);
          const c = qcol(s.q); this.flash = [c[0] * 0.35, c[1] * 0.35, c[2] * 0.35];
          this.wave(s.x, s.y, 700, qcol(s.q));
        }
      } else if (a.type === 'warp') {
        this.swirlTarget = a.t < a.dur - 1 ? -1.9 : 1;
      } else if (a.type === 'storm') {
        if (a.t >= a.warn && a.spawned < a.count) {
          const want = Math.min(a.count, Math.floor((a.t - a.warn) / 0.8 * a.count) + 1);
          while (a.spawned < want) {
            let i = F.n < MAXF ? this.spawnFrag(-s.q) : this.spawnFrag(-s.q, false, (Math.random() * F.n) | 0);
            if (i < 0) break;
            const ang = a.ang + rand(-0.35, 0.35), rr = R * 0.93;
            F.x[i] = Math.cos(ang) * rr; F.y[i] = Math.sin(ang) * rr;
            const sp = rand(500, 750);
            F.vx[i] = -Math.cos(ang) * sp - Math.sin(ang) * 160; F.vy[i] = -Math.sin(ang) * sp + Math.cos(ang) * 160;
            F.age[i] = 0.3; F.life[i] = rand(10, 16);
            a.spawned++;
          }
        }
      }
    }
    for (let j = this.anoms.length - 1; j >= 0; j--) {
      const a = this.anoms[j];
      if (a.t >= a.dur) {
        this.anoms.splice(j, 1);
        this.survived++;
        if (a.type === 'warp') this.swirlTarget = 1;
      }
    }
  },
  spawnAnom() {
    const t = this.t, active = this.anoms.map(a => a.type);
    let type;
    if (this.anomCount === 0) type = 'dilation';
    else if (this.anomCount === 1) type = 'flip';
    else {
      const pool = ['dilation', 'dilation'];
      if (t >= 18) pool.push('flip', 'flip');
      if (t >= 26) pool.push('warp', 'warp');
      if (t >= 34) pool.push('storm', 'storm');
      if (t >= 44) pool.push('sing', 'sing', 'sing');
      const ok = pool.filter(p => active.indexOf(p) < 0);
      if (!ok.length) return;
      type = ok[(Math.random() * ok.length) | 0];
    }
    this.anomCount++;
    const s = this.spark, a = { type, t: 0, str: 0, warn: 0, dur: 8, x: 0, y: 0, r: 0 };
    const away = (minD, maxR) => {
      for (let k = 0; k < 20; k++) {
        const ang = Math.random() * TAU, rr = R * Math.sqrt(Math.random()) * maxR;
        a.x = Math.cos(ang) * rr; a.y = Math.sin(ang) * rr;
        if ((a.x - s.x) ** 2 + (a.y - s.y) ** 2 > minD * minD) return;
      }
    };
    if (type === 'dilation') { a.r = 300; a.dur = 8.5; away(0, 0.62); }
    else if (type === 'flip') { a.warn = 2.2; a.dur = 2.8; this.warnBeep = 0; }
    else if (type === 'warp') { a.dur = 7.5; }
    else if (type === 'storm') {
      a.warn = 1.7; a.dur = 3; a.spawned = 0; a.count = Math.round(26 + Math.min(t, 150) / 5);
      a.ang = Math.atan2(s.y, s.x) + Math.PI + rand(-1, 1);
    } else if (type === 'sing') { a.r = 85; a.dur = 9.5; away(580, 0.62); }
    this.anoms.push(a);
    AU.anomaly();
    UI.banner(ANOM[type].name, ANOM[type].sub, type === 'flip' ? qcol(-s.q) : null);
  },
  timeScaleAt(x, y) {
    let ts = 1;
    for (let j = 0; j < this.dil.length; j++) {
      const a = this.dil[j], d = Math.hypot(x - a.x, y - a.y);
      if (d < a.r) ts *= 1 - 0.68 * a.str * smooth01((a.r - d) / (a.r * 0.35));
    }
    return ts;
  },

  // --- physics step -------------------------------------------------------------
  step(h) {
    const s = this.spark, w = this.well, live = this.state === 'play';
    this.dil.length = 0; this.sing.length = 0;
    for (const a of this.anoms) {
      if (a.type === 'dilation' && a.str > 0) this.dil.push(a);
      else if (a.type === 'sing' && a.str > 0) this.sing.push(a);
    }
    const ramp = this.ramp, wellG = WELL_G * (0.6 + 0.4 * ramp), oppPull = 180 + 260 * ramp;
    // Rotating-disc swirl: terminal speed = omega * r, balanced by an inward pull
    // slightly stronger than needed, so debris slowly spirals in from the rim
    // (where it respawns) and fills the whole arena.
    const omega = 0.52 * this.swirl * (this.state === 'title' ? 1 : this.speedUp), sq = s.q, alive = !s.dead;
    const tang = 0.75 * omega, inward = 1.12 * omega * omega;
    let spx = 0, spy = 0, minOpp = 1e9;
    for (let i = 0; i < F.n; i++) {
      let x = F.x[i], y = F.y[i];
      const hh = h * (this.dil.length ? this.timeScaleAt(x, y) : 1);
      let ax = -y * tang - x * inward, ay = x * tang - y * inward;
      let dx = w.x - x, dy = w.y - y, d2 = dx * dx + dy * dy;
      let k = wellG / Math.pow(d2 + WELL_E2, 1.5);
      ax += dx * k; ay += dy * k;
      if (alive) {
        dx = x - s.x; dy = y - s.y; d2 = dx * dx + dy * dy;
        if (d2 < 300 * 300) {
          const d = Math.sqrt(d2) + 1e-3;
          if (F.q[i] === sq) {
            if (d < 230) {
              k = 3000 * Math.pow(1 - d / 230, 1.5); ax += dx / d * k; ay += dy / d * k;
              if (d < 80) { const p = (1 - d / 80) * 900; spx -= dx / d * p; spy -= dy / d * p; }
            }
            F.gz[i] = 0;
          } else {
            k = oppPull * (1 - d / 300); ax -= dx / d * k; ay -= dy / d * k;
            const hit = SPARK_R * 0.82 + F.r[i] * 0.6, fresh = F.age[i] > 0.6 && F.age[i] < F.life[i] - 0.4;
            if (fresh && d - hit < minOpp) minOpp = d - hit;
            if (d < hit && fresh && s.inv <= 0 && live) { this.die('opp'); return; }
            if (d < hit + 48) { if (!F.gz[i] && fresh && live) { F.gz[i] = 1; this.graze(x, y); } }
            else if (d > hit + 120) F.gz[i] = 0;
          }
        } else F.gz[i] = 0;
      }
      for (let j = 0; j < this.sing.length; j++) {
        const a = this.sing[j];
        dx = a.x - x; dy = a.y - y;
        const d = Math.hypot(dx, dy) + 1e-3;
        if (d < a.r * a.str) { this.spawnFrag(0, false, i); this.particle(a.x, a.y, 0, 0, 0.4, 30, COL.amber); x = F.x[i]; y = F.y[i]; break; }
        k = a.str * 1100 / (1 + (d / 260) ** 2);
        ax += dx / d * k; ay += dy / d * k;
        ax += -dy / d * k * 0.5; ay += dx / d * k * 0.5;   // accretion spin
      }
      let vx = F.vx[i] + ax * hh, vy = F.vy[i] + ay * hh;
      const drag = 1 - 0.75 * hh;
      vx *= drag; vy *= drag;
      const sp = vx * vx + vy * vy;
      const cap = 1150 * this.speedUp;
      if (sp > cap * cap) { const m = cap / Math.sqrt(sp); vx *= m; vy *= m; }
      x += vx * hh; y += vy * hh;
      const rr = Math.hypot(x, y), lim = R - F.r[i];
      if (rr > lim) {
        const nx = x / rr, ny = y / rr;
        x = nx * lim; y = ny * lim;
        const vn = vx * nx + vy * ny;
        if (vn > 0) { vx -= 1.8 * vn * nx; vy -= 1.8 * vn * ny; }
      }
      F.x[i] = x; F.y[i] = y; F.vx[i] = vx; F.vy[i] = vy; F.age[i] += hh;
    }
    this.minOpp = minOpp;
    if (!alive) return;
    const hh = h * (this.dil.length ? this.timeScaleAt(s.x, s.y) : 1), m = s.mass;
    const dm = DAMP / Math.sqrt(m);
    let ax = (w.x - s.x) * K_SPRING / m - s.vx * dm + spx / m;
    let ay = (w.y - s.y) * K_SPRING / m - s.vy * dm + spy / m;
    for (let j = 0; j < this.sing.length; j++) {
      const a = this.sing[j], dx = a.x - s.x, dy = a.y - s.y, d = Math.hypot(dx, dy) + 1e-3;
      const k = a.str * 1150 / (1 + (d / 320) ** 2);
      ax += dx / d * k; ay += dy / d * k;
      if (d < a.r * a.str + SPARK_R * 0.5 && live && s.inv <= 0) { this.die('sing'); return; }
    }
    const al = Math.hypot(ax, ay);
    if (al > 14000) { ax *= 14000 / al; ay *= 14000 / al; }
    s.vx += ax * hh; s.vy += ay * hh;
    s.x += s.vx * hh; s.y += s.vy * hh;
    s.inv -= hh;
    const sr = Math.hypot(s.x, s.y), lim = R - SPARK_R;
    if (sr > lim) {
      if (live && s.inv <= 0) { this.die('wall'); return; }
      const nx = s.x / sr, ny = s.y / sr, vn = s.vx * nx + s.vy * ny;
      s.x = nx * lim; s.y = ny * lim;
      if (vn > 0) { s.vx -= 1.8 * vn * nx; s.vy -= 1.8 * vn * ny; }
    }
  },

  graze(x, y) {
    const s = this.spark;
    this.grazes++; this.combo++; this.comboT = 1.5;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    const was = this.meter;
    this.meter = Math.min(1, this.meter + 0.075 + Math.min(this.combo, 10) * 0.007);
    if (was < 1 && this.meter >= 1) UI.pulseReady();
    AU.graze(this.combo);
    const mx = (x + s.x) / 2, my = (y + s.y) / 2;
    for (let k = 0; k < 6; k++) this.particle(mx, my, rand(-260, 260), rand(-260, 260), rand(0.2, 0.45), rand(8, 14), COL.white);
  },
  tryPulse() {
    if (this.meter < 1) { AU.denied(); UI.pulseDenied(); return; }
    const s = this.spark;
    this.meter = 0; this.pulses++;
    for (let i = 0; i < F.n; i++) {
      const dx = F.x[i] - s.x, dy = F.y[i] - s.y, d = Math.hypot(dx, dy) + 1e-3;
      if (d < 560) {
        const k = 1700 * Math.pow(1 - d / 560, 0.6);
        F.vx[i] += dx / d * k; F.vy[i] += dy / d * k; F.gz[i] = 0;
      }
    }
    s.inv = Math.max(s.inv, 0.3);
    this.wave(s.x, s.y, 560, COL.white);
    this.shake = Math.max(this.shake, 0.45);
    this.flash = [0.12, 0.12, 0.16];
    AU.pulse();
  },
  milestone(sec) {
    AU.milestone();
    this.wave(0, 0, R, COL.well, true);
    UI.milestone(sec, tierFor(sec), TIERS.some(x => x[0] === sec));
  },
  die(cause) {
    if (this.state !== 'play') return;
    const s = this.spark;
    this.state = 'dying'; this.deathT = 0; this.cause = cause; s.dead = true;
    const c = qcol(s.q);
    for (let k = 0; k < 160; k++) {
      const a = Math.random() * TAU, sp = rand(80, 1300);
      this.particle(s.x, s.y, Math.cos(a) * sp, Math.sin(a) * sp, rand(0.5, 1.6), rand(6, 22), Math.random() < 0.4 ? COL.white : c);
    }
    this.wave(s.x, s.y, 900, c);
    this.shake = 1.2;
    this.flash = [0.55, 0.5, 0.6];
    AU.death();
    Portal.gameplayStop();
    UI.hideHud();
  },
  revive() {
    const s = this.spark, w = this.well;
    const rr = Math.hypot(w.x, w.y), m = R * 0.55;
    s.x = rr > m ? w.x * m / rr : w.x; s.y = rr > m ? w.y * m / rr : w.y;
    s.vx = 0; s.vy = 0; s.dead = false; s.inv = 2.5;
    for (let i = 0; i < F.n; i++) {
      const d = Math.hypot(F.x[i] - s.x, F.y[i] - s.y);
      if (d < 380 && F.q[i] !== s.q) this.spawnFrag(0, false, i);
    }
    this.anoms = this.anoms.filter(a => a.type !== 'sing' && a.type !== 'storm');
    this.revived = true; this.state = 'play'; this.slow = 1; this.meter = 1;
    this.wave(s.x, s.y, 560, COL.white);
    AU.pulse();
    Portal.gameplayStart();
  },

  // --- effects -------------------------------------------------------------------
  particle(x, y, vx, vy, life, size, c) {
    let i = P.n;
    if (i >= MAXP) i = (Math.random() * MAXP) | 0; else P.n++;
    P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy; P.t[i] = 0; P.life[i] = life; P.s[i] = size;
    P.r[i] = c[0]; P.g[i] = c[1]; P.b[i] = c[2];
  },
  wave(x, y, max, c, inward) { this.waves.push({ x, y, max, c, t: 0, inward: !!inward }); },
  updateFx(sdt, dt) {
    for (let i = P.n - 1; i >= 0; i--) {
      P.t[i] += sdt;
      if (P.t[i] >= P.life[i]) {
        const j = --P.n;
        P.x[i] = P.x[j]; P.y[i] = P.y[j]; P.vx[i] = P.vx[j]; P.vy[i] = P.vy[j]; P.t[i] = P.t[j];
        P.life[i] = P.life[j]; P.s[i] = P.s[j]; P.r[i] = P.r[j]; P.g[i] = P.g[j]; P.b[i] = P.b[j];
        continue;
      }
      const d = 1 - 2.2 * sdt;
      P.vx[i] *= d; P.vy[i] *= d; P.x[i] += P.vx[i] * sdt; P.y[i] += P.vy[i] * sdt;
    }
    for (let i = this.waves.length - 1; i >= 0; i--) { this.waves[i].t += dt; if (this.waves[i].t > 0.9) this.waves.splice(i, 1); }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const fk = Math.exp(-dt * 5);
    this.flash = this.flash.map(v => v * fk);
    const s = this.spark;
    const opp = s.dead ? 0 : clamp(1 - this.minOpp / 260, 0, 1);
    this.wallDanger = s.dead ? 0 : clamp((Math.hypot(s.x, s.y) - (R - 300)) / 270, 0, 1);
    this.danger = lerp(this.danger, Math.max(opp, this.wallDanger), 1 - Math.exp(-dt * 8));
  },

  // --- drawing -------------------------------------------------------------------
  draw(g) {
    g.begin();
    const s = this.spark, w = this.well, T = this.clock;
    // Small screens: draw debris larger (hitboxes unchanged) so it stays readable.
    const vs = 1 + 0.55 * clamp((760 - Math.min(View.w, View.h)) / 400, 0, 1);
    const playing = this.state === 'play' || this.state === 'dying';
    // Anomaly visuals (under everything)
    for (const a of this.anoms) {
      if (a.type === 'dilation') {
        g.dot(a.x, a.y, a.r * 1.05, COL.blue, 0.28 * a.str, 1);
        g.dot(a.x, a.y, a.r * (0.55 + 0.1 * Math.sin(T * 2)), COL.blue, 0.12 * a.str, 1);
        g.dot(a.x, a.y, a.r * 0.9, COL.blue, 0.05 * a.str, 0);
        for (let k = 0; k < 12; k++) {
          const ang = k / 12 * TAU + T * 0.25;
          g.dot(a.x + Math.cos(ang) * a.r, a.y + Math.sin(ang) * a.r, 9, COL.blue, 0.5 * a.str, 0);
        }
      } else if (a.type === 'sing') {
        const rr = a.r * a.str;
        g.dot(a.x, a.y, 330 * a.str, COL.amber, 0.12 * a.str, 0);
        for (let k = 0; k < 36; k++) {
          const ang = k / 36 * TAU + T * (1.6 + (k % 3) * 0.4), d = rr * (1.7 + (k % 4) * 0.35);
          g.spr(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, 16, 4, ang + Math.PI / 2, 1, 0.6 + (k % 2) * 0.2, 0.25, 0.55 * a.str, 3);
        }
      } else if (a.type === 'storm' && a.t < a.warn + 0.8) {
        const blink = 0.5 + 0.5 * Math.sin(a.t * 18);
        for (let k = -6; k <= 6; k++) {
          const ang = a.ang + k * 0.06;
          g.dot(Math.cos(ang) * R * 0.985, Math.sin(ang) * R * 0.985, 40, COL.red, 0.35 * blink * (1 - Math.abs(k) / 7), 0);
        }
        for (let k = 0; k < 3; k++) {
          const p = ((a.t * 1.4 + k / 3) % 1), d = R * (0.95 - p * 0.25);
          g.spr(Math.cos(a.ang) * d, Math.sin(a.ang) * d, 26, 7, a.ang, 1, 0.2, 0.2, 0.7 * (1 - p), 3);
        }
      }
    }
    // Waves
    for (const v of this.waves) {
      const p = v.t / 0.9, e = 1 - (1 - p) * (1 - p);
      const rr = v.inward ? v.max * (1 - e * 0.6) : v.max * e;
      g.dot(v.x, v.y, Math.max(rr, 1), v.c, 0.55 * (1 - p), 1);
    }
    // Gravity well
    const wa = this.state === 'title' ? 0.35 : 0.6;
    g.dot(w.x, w.y, 120, COL.well, 0.18 * wa, 0);
    g.dot(w.x, w.y, 70 + 6 * Math.sin(T * 3), COL.well, 0.35 * wa, 1);
    for (let k = 0; k < 6; k++) {
      const ang = T * 2.4 + k / 6 * TAU;
      g.dot(w.x + Math.cos(ang) * 46, w.y + Math.sin(ang) * 46, 6, COL.well, 0.9 * wa, 0);
      const ang2 = -T * 1.3 + k / 6 * TAU;
      g.dot(w.x + Math.cos(ang2) * 95, w.y + Math.sin(ang2) * 95, 4, COL.well, 0.5 * wa, 0);
    }
    g.dot(w.x, w.y, 9, COL.white, 0.9 * wa, 2);
    // Tether: dotted line spark -> well
    if (!s.dead) {
      const dx = w.x - s.x, dy = w.y - s.y, d = Math.hypot(dx, dy), n = Math.min(14, Math.floor(d / 40));
      for (let k = 1; k < n; k++) {
        const p = (k + (T * 3 % 1)) / n;
        g.dot(s.x + dx * p, s.y + dy * p, 4, COL.well, 0.35, 0);
      }
    }
    // Debris
    const sq = s.q;
    for (let i = 0; i < F.n; i++) {
      const x = F.x[i], y = F.y[i], vx = F.vx[i], vy = F.vy[i], q = F.q[i], c = qcol(q);
      const age = F.age[i], fade = smooth01(age / 0.6) * smooth01((F.life[i] - age) / 0.5);
      const sp = Math.hypot(vx, vy), ang = Math.atan2(vy, vx), r = F.r[i] * vs;
      const opp = playing && !s.dead && q !== sq;
      let a = (opp ? 0.95 : playing ? 0.42 : 0.7) * fade;
      const len = r * (1.45 + sp / 210), wid = r * 0.85;
      if (opp) {
        const d = Math.hypot(x - s.x, y - s.y);
        if (d < 300) {
          const hot = 1 - d / 300;
          g.dot(x, y, r * (3 + hot * 3), c, hot * 0.45 * fade, 0);
          a += hot * 0.6;
        }
      }
      g.spr(x, y, len * 2.2, wid * 3.4, ang, c[0], c[1], c[2], a * 0.3, 0);
      g.spr(x, y, len, wid, ang, c[0] * 0.75 + 0.25, c[1] * 0.75 + 0.25, c[2] * 0.75 + 0.25, a, 3);
    }
    // Spark
    if (!s.dead) {
      let c = qcol(s.q);
      if (this.flipWarn > 0) {
        const rate = 4 + this.flipWarn * 22;
        if (Math.sin(T * rate * TAU / 2) > 0) c = qcol(-s.q);
      }
      const inv = s.inv > 0 && this.state === 'play' ? 0.5 + 0.5 * Math.sin(T * 30) : 1;
      const beat = AU.pulseLevel();
      g.dot(s.x, s.y, 150 + beat * 30, c, 0.32, 0);
      g.dot(s.x, s.y, 58, c, 0.75 * inv, 0);
      g.dot(s.x, s.y, SPARK_R * 1.65, c, 0.6, 1);
      // Target ticks so the Spark never gets lost in the swarm.
      for (let k = 0; k < 4; k++) {
        const ang = T * 1.8 + k * Math.PI / 2, d = 50 + beat * 6;
        g.spr(s.x + Math.cos(ang) * d, s.y + Math.sin(ang) * d, 9, 2.4, ang, 1, 1, 1, 0.75 * inv, 3);
      }
      g.dot(s.x, s.y, SPARK_R * (0.5 + vs * 0.5), [c[0] * 0.55 + 0.45, c[1] * 0.55 + 0.45, c[2] * 0.55 + 0.45], 0.95 * inv, 2);
      const sign = (this.flipWarn > 0 && c !== qcol(s.q)) ? -s.q : s.q;
      g.spr(s.x, s.y, 12, 3.2, 0, 1, 1, 1, 0.9, 3);
      if (sign > 0) g.spr(s.x, s.y, 12, 3.2, Math.PI / 2, 1, 1, 1, 0.9, 3);
    }
    // Particles
    for (let i = 0; i < P.n; i++) {
      const p = 1 - P.t[i] / P.life[i];
      g.spr(P.x[i], P.y[i], P.s[i] * (0.4 + p * 0.6), P.s[i] * (0.4 + p * 0.6), 0, P.r[i], P.g[i], P.b[i], p * 0.9, 0);
    }
  },

  uniforms() {
    const U = this.U || (this.U = { zones: new Float32Array(16), rimCol: new Float32Array(3), flash: new Float32Array(3) });
    const s = this.spark;
    const sh = this.shake * this.shake * 28;
    U.camX = (Math.random() - 0.5) * sh; U.camY = (Math.random() - 0.5) * sh;
    U.decay = this.state === 'dying' ? 0.92 : 0.8;
    const toUV = (x, y) => [(x - U.camX) * View.scale / View.w + 0.5, 0.5 - (y - U.camY) * View.scale / View.h];
    const z = U.zones; z.fill(0);
    let n = 0;
    for (const a of this.anoms) {
      if (n >= 4) break;
      if (a.type === 'dilation' && a.str > 0) {
        const p = toUV(a.x, a.y); z[n * 4] = p[0]; z[n * 4 + 1] = p[1]; z[n * 4 + 2] = a.r * View.scale / View.h; z[n * 4 + 3] = a.str; n++;
      } else if (a.type === 'sing' && a.str > 0) {
        const p = toUV(a.x, a.y); z[n * 4] = p[0]; z[n * 4 + 1] = p[1]; z[n * 4 + 2] = a.r * a.str * View.scale / View.h + 1e-4; z[n * 4 + 3] = -a.str; n++;
      }
    }
    const c = toUV(0, 0);
    U.rimX = c[0]; U.rimY = c[1]; U.rimR = R * View.scale / View.h;
    U.dangerAng = Math.atan2(-s.y, s.x);
    U.danger = this.wallDanger;
    U.beat = this.state === 'title' ? 0.3 + 0.3 * Math.sin(this.clock * 1.5) : AU.pulseLevel();
    const base = this.state === 'play' && !s.dead ? qcol(s.q) : COL.well;
    U.rimCol[0] = base[0] * 0.5 + 0.2; U.rimCol[1] = base[1] * 0.5 + 0.15; U.rimCol[2] = base[2] * 0.5 + 0.3;
    U.time = this.clock;
    U.aberr = 0.0015 + this.shake * 0.012 + this.danger * 0.004;
    U.twist = (1 - this.swirl) * 0.12;
    U.flash[0] = this.flash[0]; U.flash[1] = this.flash[1]; U.flash[2] = this.flash[2];
    U.dark = this.state === 'over' ? 0.35 : this.state === 'title' ? 0.15 : 0;
    return U;
  },
};
// ---------------------------------------------------------------------------
// DOM overlays, HUD, pause handling, adaptive quality and the main loop.
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const UI = {
  paused: false, lastMouse: null, bannerT: 0, msT: 0, shown: '',
  init() {
    this.el = {
      hud: $('hud'), time: $('time'), best: $('best'), tier: $('tier'), banner: $('banner'),
      bName: $('bannerName'), bSub: $('bannerSub'), pulse: $('pulse'), pulseFill: $('pulseFill'),
      pulseLabel: $('pulseLabel'), combo: $('combo'), title: $('title'), over: $('over'), pause: $('pause'),
      titleBest: $('titleBest'), oTime: $('oTime'), oCause: $('oCause'), oNew: $('oNew'), oRank: $('oRank'),
      oBest: $('oBest'), oGrazes: $('oGrazes'), oCombo: $('oCombo'), oAnoms: $('oAnoms'),
      revive: $('btnRevive'), toast: $('toast'), mute: $('btnMute'), pauseBtn: $('btnPause'),
      hint: $('hint'),
    };
    const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); AU.init(); fn(); });
    on('btnPlay', () => this.play());
    on('btnRetry', () => this.retry());
    on('btnMenu', () => this.menu());
    on('btnMenu2', () => { this.resume(); this.menu(); });
    on('btnResume', () => this.resume());
    on('btnRevive', () => this.revive());
    on('btnMute', () => this.toggleMute());
    on('btnPause', () => (this.paused ? this.resume() : this.pause()));
    this.el.pulse.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (Game.state === 'play') Game.tryPulse(); });
    window.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') this.lastMouse = [e.clientX, e.clientY]; }, { passive: true });
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') document.body.classList.add('touch'); }, { passive: true });
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('focus', () => { if (!this.paused) AU.resume(); });
    window.addEventListener('resize', () => { View.resize(); GL.resize(); });
    this.syncMute();
    this.el.titleBest.textContent = Stats.best > 0 ? 'BEST  ' + Stats.best.toFixed(2) + 's  ·  ' + tierFor(Stats.best) : '';
  },
  show(el, yes) { el.classList.toggle('hidden', !yes); },
  play() {
    if (Game.state !== 'title') return;   // Enter on a focused button fires key + click
    AU.click();
    this.show(this.el.title, false); this.show(this.el.over, false);
    this.showHud();
    Game.start();
  },
  retry() {
    if (Game.state !== 'over' || Portal.pending) return;
    AU.click();
    this.show(this.el.over, false);
    Portal.midgame(() => { this.showHud(); Game.start(); });
  },
  menu() {
    AU.click();
    Portal.gameplayStop();
    this.show(this.el.over, false); this.show(this.el.pause, false); this.hideHud();
    this.el.titleBest.textContent = Stats.best > 0 ? 'BEST  ' + Stats.best.toFixed(2) + 's  ·  ' + tierFor(Stats.best) : '';
    this.show(this.el.title, true);
    Game.toTitle();
  },
  revive() {
    if (Game.state !== 'over' || Game.revived || Portal.pending) return;
    Portal.rewarded(ok => {
      if (ok) { this.show(this.el.over, false); this.showHud(); Game.revive(); }
      else this.toast('No video available right now');
    });
  },
  showHud() { this.show(this.el.hud, true); document.body.classList.add('playing'); this.el.hint.classList.remove('gone'); this.hintT = 6; },
  hideHud() { this.show(this.el.hud, false); document.body.classList.remove('playing'); this.el.banner.classList.remove('on'); },
  showOver() {
    const t = Game.t, prev = Stats.best, isNew = t > prev;
    if (isNew) { Stats.best = t; Store.set('best', t); if (prev > 0) Portal.happy(); }
    const causes = { wall: 'The Spark touched the wall', opp: 'Opposite-charge contact', sing: 'Swallowed by the singularity' };
    const e = this.el;
    e.oTime.textContent = t.toFixed(2);
    e.oCause.textContent = causes[Game.cause] || '';
    e.oRank.textContent = tierFor(t);
    e.oBest.textContent = Stats.best.toFixed(2) + 's';
    e.oGrazes.textContent = Game.grazes;
    e.oCombo.textContent = '×' + Game.bestCombo;
    e.oAnoms.textContent = Game.survived;
    this.show(e.oNew, isNew && prev > 0);
    this.show(e.revive, Portal.hasRewarded && !Game.revived);
    this.show(e.over, true);
    setTimeout(() => { const b = $('btnRetry'); if (b && !e.over.classList.contains('hidden')) b.focus({ preventScroll: true }); }, 50);
  },
  pause() {
    if (Game.state !== 'play' || this.paused) return;
    this.paused = true;
    this.show(this.el.pause, true);
    AU.suspend();
    Portal.gameplayStop();
  },
  autoPause() { if (Game.state === 'play') this.pause(); else AU.suspend(); },
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.show(this.el.pause, false);
    AU.init(); AU.resume();
    Input.pulse = false;
    Portal.gameplayStart();
  },
  toggleMute() { Settings.muted = !Settings.muted; Store.set('muted', Settings.muted); this.syncMute(); AU.applyGain(); },
  syncMute() { this.el.mute.classList.toggle('muted', Settings.muted); this.el.mute.setAttribute('aria-label', Settings.muted ? 'Unmute' : 'Mute'); },
  onKey(k) {
    if (k === 'KeyM') { this.toggleMute(); return; }
    if (this.paused) { if (k === 'Enter' || k === 'Space' || k === 'KeyP' || k === 'Escape') this.resume(); return; }
    if (Game.state === 'play') {
      if (k === 'Space') Game.tryPulse();
      else if (k === 'KeyP' || k === 'Escape') this.pause();
    } else if (Game.state === 'title') {
      if (k === 'Enter' || k === 'Space') this.play();
    } else if (Game.state === 'over') {
      if (k === 'Enter' || k === 'Space' || k === 'KeyR') this.retry();
    }
  },
  banner(name, sub, col) {
    const b = this.el.banner;
    this.el.bName.textContent = name; this.el.bSub.textContent = sub;
    b.style.setProperty('--bc', col ? `rgb(${col.map(v => Math.round(v * 255)).join(',')})` : '');
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('on'), 2200);
  },
  milestone(sec, tier, isTier) {
    const t = this.el.tier;
    t.textContent = isTier ? tier : sec + ' SECONDS';
    t.classList.toggle('big', isTier);
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    this.el.time.classList.remove('pop'); void this.el.time.offsetWidth; this.el.time.classList.add('pop');
  },
  pulseReady() { this.el.pulse.classList.remove('flash'); void this.el.pulse.offsetWidth; this.el.pulse.classList.add('flash'); },
  pulseDenied() { this.el.pulse.classList.remove('deny'); void this.el.pulse.offsetWidth; this.el.pulse.classList.add('deny'); },
  toast(msg) {
    const t = this.el.toast; t.textContent = msg; t.classList.add('on');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  },
  hud(dt) {
    if (Game.state !== 'play' && Game.state !== 'dying') return;
    const e = this.el, txt = Game.t.toFixed(2);
    if (txt !== this.shown) { e.time.textContent = txt; this.shown = txt; }
    const bestTxt = Stats.best > 0 ? (Game.t > Stats.best ? 'NEW BEST' : 'BEST ' + Stats.best.toFixed(2)) : 'SURVIVE';
    if (bestTxt !== this.bestShown) { e.best.textContent = bestTxt; e.best.classList.toggle('hot', Game.t > Stats.best && Stats.best > 0); this.bestShown = bestTxt; }
    const m = Math.round(Game.meter * 100);
    if (m !== this.mShown) {
      e.pulseFill.style.transform = `scaleX(${Game.meter})`;
      e.pulse.classList.toggle('ready', Game.meter >= 1);
      e.pulseLabel.textContent = Game.meter >= 1 ? (document.body.classList.contains('touch') ? 'PULSE READY · TAP' : 'PULSE READY · CLICK / SPACE') : 'GRAZE DEBRIS TO CHARGE';
      this.mShown = m;
    }
    const cb = Game.combo >= 2 ? '×' + Game.combo : '';
    if (cb !== this.cShown) { e.combo.textContent = cb; this.cShown = cb; if (cb) { e.combo.classList.remove('bump'); void e.combo.offsetWidth; e.combo.classList.add('bump'); } }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) e.hint.classList.add('gone'); }
  },
};

// Adaptive resolution: if frames are slow for ~2 s, render at a lower scale.
const Perf = {
  acc: 0, n: 0,
  sample(ms) {
    if (document.hidden || UI.paused) return;
    this.acc += ms; this.n++;
    if (this.n < 120) return;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    if (avg > 21 && View.quality > 0.5) { View.quality = Math.max(0.5, View.quality - 0.2); GL.resize(); }
    else if (avg < 14 && View.quality < 1) { View.quality = Math.min(1, View.quality + 0.1); GL.resize(); }
  },
};

let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = now;
  const raw = now - lastFrame;
  lastFrame = now;
  if (raw <= 0) return;
  const dt = Math.min(raw / 1000, 0.05);
  Perf.sample(raw);
  if (!UI.paused && !Portal.adActive) Game.update(dt);
  const playing = Game.state === 'play' && !UI.paused;
  AU.setMood(Game.state === 'title' ? 0.05 : Game.intensity, Game.state === 'play' ? Game.danger : 0, playing);
  Game.draw(GL);
  GL.frame(Game.uniforms());
  UI.hud(dt);
}

function boot() {
  View.resize();
  const canvas = $('gl');
  if (!GL.init(canvas)) { $('nogl').classList.remove('hidden'); $('title').classList.add('hidden'); return; }
  GL.resize();
  Input.init(canvas);
  UI.init();
  Game.toTitle();
  requestAnimationFrame(frame);
  Portal.init().then(() => Portal.loadingStop());
  // Debug hook for automated tests and screenshots (harmless for players).
  window.__mc = { Game, F, Input, UI, View, Portal, Perf, GL, AU };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
