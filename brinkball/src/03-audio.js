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
