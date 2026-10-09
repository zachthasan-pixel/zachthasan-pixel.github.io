// ---------------------------------------------------------------------------
// Infinite Loot Goblin: One-Button Dungeon — core: canvas, utils, save, audio
// ---------------------------------------------------------------------------
const cvs = document.getElementById('game');
const ctx = cvs.getContext('2d');
let W = 0, H = 0, DPR = 1;

const rand = Math.random;
const rr = (a, b) => a + rand() * (b - a);
const ri = (a, b) => Math.floor(rr(a, b + 1));
const pick = a => a[Math.floor(rand() * a.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = t => 1 - Math.pow(1 - t, 3);
const inRect = (x, y, r) => r && x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;

const SUFFIX = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc'];
function fmt(n) {
  if (!isFinite(n)) return '∞';
  const neg = n < 0; n = Math.abs(n);
  let s;
  if (n < 10 && n % 1 !== 0) s = n.toFixed(1);
  else if (n < 1000) s = String(Math.round(n));
  else {
    let i = 0;
    while (n >= 1000 && i < SUFFIX.length - 1) { n /= 1000; i++; }
    s = (n < 10 ? n.toFixed(2) : n < 100 ? n.toFixed(1) : Math.round(n)) + SUFFIX[i];
  }
  return (neg ? '-' : '') + s;
}
const pct = v => Math.round(v * 100) + '%';

const FONT = '"Pixelify Sans", ui-monospace, monospace';
const TFONT = '"Press Start 2P", ui-monospace, monospace';
const f = (px, bold) => (bold ? '700 ' : '400 ') + Math.round(px) + 'px ' + FONT;
const tf = px => Math.round(px) + 'px ' + TFONT;

// ---------------------------------------------------------------- save -----
const SAVE_KEY = 'ilg_save_v1';
const save = {
  gold: 0, best: 0, runs: 0, chests: 0, kills: 0, tut: false, muted: false,
  up: { bag: 0, luck: 0, hp: 0, dmg: 0, sell: 0, insure: 0 },
  bestItem: null,
};
function loadSave() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (s && typeof s === 'object') {
      const up = Object.assign({}, save.up, s.up || {});
      Object.assign(save, s); save.up = up;
    }
  } catch (e) { /* storage blocked: play without saving */ }
}
function writeSave() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { /* ignore */ }
}

// --------------------------------------------------------------- audio -----
const AU = {
  ac: null, master: null, sfxBus: null, musBus: null, noiseBuf: null,
  musicOn: false, nextNote: 0, step: 0, tempo: 128, timer: null,
  init() {
    if (this.ac) { if (this.ac.state === 'suspended') this.ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try { this.ac = new AC(); } catch (e) { return; }
    this.master = this.ac.createGain();
    this.master.gain.value = save.muted ? 0 : 0.55;
    this.master.connect(this.ac.destination);
    this.sfxBus = this.ac.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musBus = this.ac.createGain(); this.musBus.gain.value = 0.16; this.musBus.connect(this.master);
    const len = this.ac.sampleRate;
    this.noiseBuf = this.ac.createBuffer(1, len, this.ac.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  },
  setMuted(m) {
    save.muted = m; writeSave();
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ac.currentTime, 0.03);
  },
  tone(freq, dur, type, vol, slide, delay, bus) {
    if (!this.ac) return;
    const t = this.ac.currentTime + (delay || 0);
    const o = this.ac.createOscillator(), g = this.ac.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.005);
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
  sfx(name, arg) {
    if (!this.ac || save.muted) return;
    const now = this.ac.currentTime;
    const gap = { hit: 0.045, crit: 0.05, coin: 0.035, tick: 0.05, hurt: 0.08 }[name] || 0;
    if (gap && this._last[name] && now - this._last[name] < gap) return;
    this._last[name] = now;
    switch (name) {
      case 'hit': this.noise(0.06, 0.12, 3000, 600); this.tone(rr(180, 240), 0.05, 'square', 0.05, 90); break;
      case 'crit': this.noise(0.09, 0.18, 5000, 800); this.tone(880, 0.09, 'square', 0.07, 1500); break;
      case 'coin': this.tone(1318, 0.05, 'square', 0.05); this.tone(1976, 0.09, 'square', 0.05, null, 0.045); break;
      case 'hurt': this.tone(160, 0.14, 'sawtooth', 0.12, 70); this.noise(0.08, 0.1, 900, 200); break;
      case 'drop': this.tone(300, 0.08, 'triangle', 0.15, 120); this.noise(0.05, 0.08, 1200, 300); break;
      case 'chest': {
        const r = arg || 0, base = 392 * Math.pow(1.12, r);
        const n = [0, 4, 7, 12, 16, 19].slice(0, 3 + Math.min(3, r));
        n.forEach((s, i) => this.tone(base * Math.pow(2, s / 12), 0.12, 'square', 0.07, null, i * 0.045));
        if (r >= 4) { this.noise(0.5, 0.06, 8000, 2000, 0.15); this.tone(base * 4, 0.5, 'triangle', 0.08, null, 0.25); }
        break;
      }
      case 'reel': this.tone(rr(600, 900), 0.03, 'square', 0.04); break;
      case 'jackpot': [0, 4, 7, 12, 7, 12, 16, 24].forEach((s, i) => this.tone(523 * Math.pow(2, s / 12), 0.14, 'square', 0.08, null, i * 0.07)); break;
      case 'equip': this.tone(520, 0.05, 'square', 0.08); this.tone(780, 0.07, 'square', 0.07, null, 0.05); break;
      case 'swap': this.tone(440, 0.04, 'triangle', 0.1); break;
      case 'deny': this.tone(140, 0.12, 'square', 0.1); this.tone(110, 0.14, 'square', 0.1, null, 0.08); break;
      case 'sell': [0, 7, 12].forEach((s, i) => this.tone(988 * Math.pow(2, s / 12), 0.06, 'square', 0.05, null, i * 0.035)); break;
      case 'explode': this.noise(0.9, 0.45, 2500, 60); this.tone(90, 0.7, 'sawtooth', 0.2, 30); break;
      case 'boom': this.noise(0.45, 0.3, 3000, 100); this.tone(120, 0.35, 'square', 0.12, 40); break;
      case 'tick': this.tone(1200, 0.025, 'square', 0.05); break;
      case 'blink': this.tone(2200, 0.03, 'sine', 0.04); break;
      case 'zap': this.tone(1600, 0.18, 'sawtooth', 0.06, 200); this.noise(0.12, 0.08, 6000, 1500); break;
      case 'drink': [0, 3, 7].forEach((s, i) => this.tone(330 * Math.pow(2, s / 12), 0.08, 'sine', 0.12, null, i * 0.06)); break;
      case 'throw': this.tone(500, 0.18, 'triangle', 0.1, 180); break;
      case 'warn': this.tone(880, 0.07, 'square', 0.07); this.tone(660, 0.09, 'square', 0.07, null, 0.08); break;
      case 'boss': this.tone(110, 0.6, 'sawtooth', 0.14, 55); this.tone(165, 0.6, 'sawtooth', 0.1, 82, 0.1); break;
      case 'floor': [0, 5, 7, 12].forEach((s, i) => this.tone(392 * Math.pow(2, s / 12), 0.2, 'triangle', 0.1, null, i * 0.09)); break;
      case 'click': this.tone(700, 0.03, 'square', 0.05); break;
      case 'buy': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(659 * Math.pow(2, s / 12), 0.08, 'square', 0.06, null, i * 0.05)); break;
      case 'die': this.tone(392, 0.25, 'square', 0.1, 196); this.tone(196, 0.5, 'square', 0.1, 70, 0.22); break;
    }
  },
  // A tiny chiptune loop: A-minor progression, bass + arpeggio + hat.
  startMusic() {
    if (this.musicOn || !this.ac) return;
    this.musicOn = true; this.nextNote = this.ac.currentTime + 0.1; this.step = 0;
    this.timer = setInterval(() => this.schedule(), 25);
  },
  schedule() {
    if (!this.ac) return;
    const prog = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const arpPat = [0, 1, 2, 1, 0, 2, 1, 2];
    while (this.nextNote < this.ac.currentTime + 0.12) {
      const st = this.step, bar = Math.floor(st / 16) % 4, s16 = st % 16;
      const chord = prog[bar], t = this.nextNote - this.ac.currentTime;
      const quiet = game.state !== 'play' ? 0.6 : 1;
      if (s16 % 4 === 0) this.tone(midi(chord[0] - 24), 0.2, 'triangle', 0.5 * quiet, null, t, this.musBus);
      if (s16 % 2 === 0) {
        const n = chord[arpPat[(s16 / 2) % 8]] + (s16 >= 8 ? 12 : 0);
        this.tone(midi(n), 0.1, 'square', 0.12 * quiet, null, t, this.musBus);
      }
      if (s16 % 4 === 2) this.noiseHat(t);
      this.step++;
      const bpm = this.tempo + (game.state === 'play' ? Math.min(40, run ? run.depth / 40 : 0) : 0);
      this.nextNote += 60 / bpm / 4;
    }
  },
  noiseHat(delay) {
    const t = this.ac.currentTime + delay;
    const s = this.ac.createBufferSource(); s.buffer = this.noiseBuf;
    const fl = this.ac.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = 7000;
    const g = this.ac.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    s.connect(fl); fl.connect(g); g.connect(this.musBus); s.start(t, Math.random()); s.stop(t + 0.05);
  },
};
const midi = n => 440 * Math.pow(2, (n - 69) / 12);
