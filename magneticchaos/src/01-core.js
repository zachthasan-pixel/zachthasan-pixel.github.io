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
