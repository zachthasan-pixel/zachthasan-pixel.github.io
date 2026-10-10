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
