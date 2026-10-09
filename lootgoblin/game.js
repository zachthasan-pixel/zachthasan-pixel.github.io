/* Infinite Loot Goblin: One-Button Dungeon — (c) 2026 Dr. Zahir Hasan. Built from src/ by build.sh */
(function () {
'use strict';
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
// ---------------------------------------------------------------------------
// Pixel art. Every sprite is a list of strings; one char = one pixel.
// '.' is transparent. Palettes map chars to colours and can be swapped per
// draw (armor tint, rarity accents) — results are cached.
// ---------------------------------------------------------------------------
const OUT = '#1a1022';
const BASE_PAL = {
  o: OUT, g: '#6cc644', G: '#3f8a2c', w: '#ffffff', k: OUT, t: '#fff6d8', c: '#8a5a2b', C: '#5e3c1c',
  f: '#2f6b22', h: '#9aa3b0', H: '#5c6370',
};

const SPR = {
  // Goblin hero: head + torso, faces right. Eye = w/k at cols 9-10.
  body: [
    '................',
    '......ooooo.....',
    '.....oggggggo...',
    'oo..ogggggwwgo..',
    'ogoogggggwkggo..',
    '.oggggggggggggo.',
    '..oogggggggGGgo.',
    '....ogGtGtGGGo..',
    '.....oGGGGGGo...',
    '....occcccccco..',
    '...occcccccccgo.',
    '....occcccccco..',
  ],
  legs: [
    ['.....oCCCCCo....', '.....oG..oG.....', '....of...of.....', '....ff...ff.....'],
    ['.....oCCCCCo....', '....oG....oG....', '...of......of...', '...ff......ff...'],
    ['.....oCCCCCo....', '.....oG..oG.....', '....of...of.....', '....ff...ff.....'],
    ['.....oCCCCCo....', '......oGoG......', '......offo......', '......ffff......'],
  ],
  helm: [
    '......oooooo....',
    '.....ohhhhhho...',
    '....ohHhhhhhho..',
    '...ohhhhhhhhhho.',
  ],
  slime: [
    '................', '................', '................', '................',
    '................', '.......oooo.....', '.....oossssoo...', '....osssssssso..',
    '...osskwssskwso.', '...ossssssssso..', '..ossssssssssso.', '..osSssssssSsso.',
    '..oSSSSSSSSSSSo.', '...ooooooooooo..', '................', '................',
  ],
  skeleton: [
    '......oooo......', '.....owwwwo.....', '....owwwwwwo....', '....okwwkwwo....',
    '....owwwwwwo....', '.....owkkwo.....', '......owwo......', '....oowwwwoo....',
    '...owowwwwowo...', '...ow.owwo.wo...', '......owwo......', '.....owwwwo.....',
    '.....ow..wo.....', '.....ow..wo.....', '....oww..wwo....', '................',
  ],
  bat: [
    '................', '................', 'o..............o', 'oo....o..o....oo',
    'obo..oboobo..obo', 'obbooobbbbooobbo', '.obbbbbbbbbbbbo.', '..obbbrbbrbbbo..',
    '...obbbbbbbbo...', '....oobbbboo....', '......obbo......', '.......oo.......',
    '................', '................', '................', '................',
  ],
  orc: [
    '....oooooooo....', '...oqqqqqqqqo...', '..oqqrqqqqrqqo..', '..oqqqqqqqqqqo..',
    '..oqtqqqqqqtqo..', '...oqqqqqqqqo...', '..ooaaaaaaaaoo..', '.oqoaaammaaaoqo.',
    '.oqoaaammaaaoqo.', '.oqoaaaaaaaaoqo.', '..o.oaaaaaao.o..', '....oqqo.oqqo...',
    '....oqqo.oqqo...', '...oqqqo.oqqqo..', '...ooooo.ooooo..', '................',
  ],
  mimic: [
    '................', '................', '...oooooooooo...', '..oyyyyyyyyyyo..',
    '..obbbbbbbbbbo..', '..otototototoo..', '..okkkkkkkkkko..', '..okkrrrrrrkko..',
    '..otototototoo..', '..obbbbyybbbbo..', '..obbbbyybbbbo..', '..obbbbbbbbbbo..',
    '..oooooooooooo..', '................', '................', '................',
  ],
  ghost: [
    '......oooo......', '....oowwwwoo....', '...owwwwwwwwo...', '..owkkwwkkwwwo..',
    '..owkkwwkkwwwo..', '..owwwwwwwwwwo..', '..owwwookwwwwo..', '..owwwwwwwwwwo..',
    '..owwwwwwwwwwo..', '..owwwwwwwwwwo..', '..owowwowwowwo..', '..oo.oo.oo.oo...',
    '................', '................', '................', '................',
  ],
  eye: [
    '.....oooooo.....', '...oowwwwwwoo...', '..owwwrwwwwwwo..', '.owwwwwiiiwwwwo.',
    '.owwwwiiiiiwwwo.', 'owrwwiikkkiiwwwo', 'owwwwiikkkiiwrwo', 'owwwwiikkkiiwwwo',
    '.owwwwiiiiiwwwo.', '.owwrwwiiiwwwwo.', '..owwwwwwwrwwo..', '...oowwwwwwoo...',
    '.....oooooo.....', '................', '................', '................',
  ],
  chestBase: [
    'oyyyyyyyyyyyyo', 'obbbbbryrbbbbo', 'obbbbbbybbbbbo', 'obbbbbbbbbbbbo',
    'oBBBBBBBBBBBBo', 'oooooooooooooo',
  ],
  chestLid: [
    '..oooooooooo..', '.obbbbbbbbbbo.', 'obbbbbbbbbbbbo', 'orrrrrrrrrrrro',
  ],
  coin: ['.oooo.', 'oggGGo', 'ogGggo', 'ogGggo', 'oggGGo', '.oooo.'],
  tophat: ['...oooooo...', '...okkkko...', '...okkkko...', '...orrrro...', '.oooooooooo.'],
  crown: ['o..o..o..o', 'oyoyoyoyoy', 'oyyyyyyyyo', 'oyryyyryyo', 'oooooooooo'],
};

// Item icons, 12x12. m/M metal, w/W wood, a/A accent (rarity), g/G gold, l/L liquid, x white, k dark, r red.
const ICON = {
  sword: ['..........oo', '.........omo', '........omo.', '.......omo..', '......omo...', '.....omo....',
    '..o.omo.....', '..oaao......', '...aaao.....', '..owoaa.....', '.owo..o.....', '.oo.........'],
  axe: ['......ooo...', '.....ommmo..', '....ommmmmo.', '....omMwmmo.', '.....oowMmo.', '.....owo.oo.',
    '....owo.....', '...owo......', '..owo.......', '.oao........', '.oo.........', '............'],
  dagger: ['............', '..........o.', '.........omo', '........omo.', '.......omo..', '......omo...',
    '....oaao....', '.....aao....', '....owoa....', '...owo......', '...oo.......', '............'],
  hammer: ['..oooooooo..', '.ommmmmmmmo.', '.omMMMMMMmo.', '.ommmmmmmmo.', '..oooaaooo..', '.....owo....',
    '.....owo....', '.....owo....', '.....owo....', '.....oao....', '.....owo....', '.....ooo....'],
  staff: ['....oaao....', '...oaAAao...', '...oaAAao...', '....oaao....', '.....owo....', '.....owo....',
    '....owo.....', '....owo.....', '...owo......', '...owo......', '..owo.......', '..oo........'],
  helm: ['............', '....oooo....', '...ommmmo...', '..ommmmmmo..', '..oaaaaaao..', '..ommmmmmo..',
    '..om.kk.mo..', '..omkkkkmo..', '..om.kk.mo..', '..oo....oo..', '............', '............'],
  armor: ['............', '..oo....oo..', '.omao..oamo.', '.ommmoommmo.', '.ommmaammmo.', '..ommmmmmo..',
    '..ommaammo..', '..ommmmmmo..', '..ommmmmmo..', '..oaaaaaao..', '...oooooo...', '............'],
  boots: ['............', '............', '...oooo.....', '...owwo.....', '...owwo.....', '...owwo.....',
    '...owwoooo..', '...owwwwwwo.', '...oaaaaaao.', '...oooooooo.', '............', '............'],
  ring: ['............', '....oaao....', '...oaAAao...', '....oaao....', '...oggggo...', '..og....go..',
    '..og....go..', '..og....go..', '...oggggo...', '....oooo....', '............', '............'],
  amulet: ['..o......o..', '...o....o...', '....o..o....', '.....oo.....', '....oggo....', '...ogaago...',
    '..ogaAAago..', '...ogaago...', '....oggo....', '.....oo.....', '............', '............'],
  potion: ['....oooo....', '....owwo....', '.....oo.....', '....o..o....', '...ollllo...', '..olllllLo..',
    '..olxlllLo..', '..olllllLo..', '..oLLLLLLo..', '...oooooo...', '............', '............'],
  bomb: ['.........x..', '........xg..', '.......oo...', '......o.....', '....oooo....', '...okkkko...',
    '..okkxkkko..', '..okxkkkko..', '..okkkkkko..', '..okkkkkko..', '...okkkko...', '....oooo....'],
  rock: ['............', '............', '............', '....oooo....', '...oMmmMo...', '..oMmmmmMo..',
    '..oMmmmMMo..', '.oMMmmMMMMo.', '.oMMMMMMMMo.', '..oooooooo..', '............', '............'],
  sock: ['...oooooo...', '...oxxxxo...', '...orrrro...', '...oxxxxo...', '...oxxxxo...', '...oxxxxo...',
    '...oxxxxoo..', '...oxxxxxxo.', '...oxxxxxxo.', '....oooooo..', '............', '............'],
  receipt: ['...oooooo...', '...oxxxxo...', '...oxkkxo...', '...oxxxxo...', '...oxkkxo...', '...oxxxxo...',
    '...oxkkxo...', '...oxxxxo...', '...oxkxxo...', '...oxoxoxo..', '............', '............'],
};
const ICON_PAL = {
  o: OUT, m: '#d6dbe3', M: '#7d8590', w: '#a8743c', W: '#6b4423', a: '#b8b8c8', A: '#ffffff',
  g: '#f2c14e', G: '#b8862b', l: '#ff4f6d', L: '#b02745', x: '#ffffff', k: '#3a3f58', r: '#d94a4a',
};

const _spriteCache = new Map();
function sprite(rows, pal, key) {
  const k = key || null;
  if (k && _spriteCache.has(k)) return _spriteCache.get(k);
  const w = Math.max.apply(null, rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    if (ch === '.' || ch === ' ') continue;
    const col = pal[ch];
    if (!col) continue;
    x.fillStyle = col; x.fillRect(i, j, 1, 1);
  }
  if (k) _spriteCache.set(k, c);
  return c;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map(v => ('0' + Math.round(v).toString(16)).slice(-2)).join('');
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function heroBody(armorCol, eyesClosed, hurt) {
  const key = 'body|' + armorCol + '|' + eyesClosed + '|' + hurt;
  const pal = Object.assign({}, BASE_PAL);
  if (armorCol) { pal.c = armorCol; pal.C = shade(armorCol, -0.35); }
  if (eyesClosed) { pal.w = BASE_PAL.G; pal.k = BASE_PAL.G; }
  if (hurt) { pal.g = '#ffffff'; pal.G = '#ffd0d0'; }
  return sprite(SPR.body, pal, key);
}
function heroLegs(frame, bootCol) {
  const pal = Object.assign({}, BASE_PAL);
  if (bootCol) pal.f = bootCol;
  return sprite(SPR.legs[frame], pal, 'legs|' + frame + '|' + bootCol);
}
function helmSprite(col) {
  return sprite(SPR.helm, { o: OUT, h: col, H: shade(col, -0.35) }, 'helm|' + col);
}
const ENEMY_PAL = {
  slime: { o: OUT, s: '#4fd1a5', S: '#2b8f72', w: '#ffffff', k: OUT },
  skeleton: { o: OUT, w: '#e8e2cf', k: '#2a2033' },
  bat: { o: OUT, b: '#6d4c9f', r: '#ff3b5c' },
  orc: { o: OUT, q: '#7aa83f', r: '#ff3b3b', t: '#fff6d8', a: '#7a4b2a', m: '#aab2bd' },
  mimic: { o: OUT, y: '#f2c14e', b: '#8a5a2b', t: '#fff6d8', k: '#2a0d16', r: '#e0435f' },
  ghost: { o: '#4a5d8a', w: '#cfe8ff', k: '#2a3354' },
  eye: { o: OUT, w: '#f4f0ff', r: '#e0435f', i: '#c0392b', k: '#120812' },
  taxman: Object.assign({}, BASE_PAL, { g: '#9b6bd6', G: '#6a3fa8', c: '#2b2b44', C: '#1a1a2e' }),
};
function chestSprites(rarCol) {
  const pal = { o: OUT, y: rarCol, b: '#8a5a2b', B: '#5e3c1c', r: rarCol };
  return { base: sprite(SPR.chestBase, pal, 'cb|' + rarCol), lid: sprite(SPR.chestLid, pal, 'cl|' + rarCol) };
}
function iconSprite(name, accent, liquid) {
  const pal = Object.assign({}, ICON_PAL);
  if (accent) { pal.a = accent; pal.A = shade(accent, 0.5); }
  if (liquid) { pal.l = liquid; pal.L = shade(liquid, -0.4); }
  return sprite(ICON[name], pal, 'ic|' + name + '|' + accent + '|' + liquid);
}
// ---------------------------------------------------------------------------
// Loot: rarities, affixes, absurd legendary synergies, curses, item factory.
// ---------------------------------------------------------------------------
const RAR = [
  { k: 'common', name: 'Common', c: '#b9b6cc', m: 1.0, affixes: 0 },
  { k: 'uncommon', name: 'Uncommon', c: '#5fd35f', m: 1.3, affixes: 1 },
  { k: 'rare', name: 'Rare', c: '#4ea8ff', m: 1.7, affixes: 2 },
  { k: 'epic', name: 'Epic', c: '#c46bff', m: 2.3, affixes: 3 },
  { k: 'legendary', name: 'Legendary', c: '#ff9a1f', m: 3.2, affixes: 2 },
  { k: 'cursed', name: 'Cursed', c: '#ff3b5c', m: 4.6, affixes: 2 },
];
const R_LEG = 4, R_CUR = 5;

const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
const SLOT_NAME = { weapon: 'Weapon', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' };
const SLOT_ICON = { weapon: 'sword', helm: 'helm', armor: 'armor', boots: 'boots', ring: 'ring', amulet: 'amulet' };

// Weapon families: dmg multiplier, attack-speed multiplier.
const WEAPONS = {
  sword: { dmg: 1.0, spd: 1.0, names: ['Sword', 'Blade', 'Cutlass', 'Butter Knife (Large)'] },
  axe: { dmg: 1.35, spd: 0.8, names: ['Axe', 'Cleaver', 'Hatchet', 'Lumber Licker'] },
  dagger: { dmg: 0.6, spd: 1.65, names: ['Dagger', 'Shiv', 'Stabber', 'Pointy Stick'] },
  hammer: { dmg: 1.9, spd: 0.6, names: ['Hammer', 'Maul', 'Bonker', 'Mallet'] },
  staff: { dmg: 0.85, spd: 1.0, cleave: true, names: ['Staff', 'Wand', 'Rod', 'Twig of Power'] },
};
const BASES = {
  helm: ['Helm', 'Cooking Pot', 'Bucket', 'Crown', 'Hood', 'Skull Cap'],
  armor: ['Mail', 'Plate', 'Robe', 'Barrel', 'Tunic', 'Cuirass'],
  boots: ['Boots', 'Sandals', 'Greaves', 'Clogs', 'Sneakers', 'Treads'],
  ring: ['Ring', 'Band', 'Loop', 'Signet'],
  amulet: ['Amulet', 'Talisman', 'Charm', 'Locket', 'Pendant'],
};
const PREFIX = [
  ['Rusty', 'Chipped', 'Damp', 'Borrowed', 'Mediocre', 'Slightly Used'],
  ['Sturdy', 'Polished', 'Goblin-Forged', 'Shiny', 'Decent'],
  ['Gleaming', 'Runed', 'Vicious', 'Swift', 'Gilded'],
  ['Ancient', 'Abyssal', 'Radiant', 'Unhinged', 'Overclocked'],
  ['Mythic'],
  ['Cursed', 'Haunted', 'Forbidden', 'Accursed', 'Very Bad'],
];
const SUFFIXES = ['of Greed', 'of Haste', 'of the Bat', 'of Questionable Origin', 'of Overkill',
  'of Hoarding', 'of a Thousand Blinks', 'of Taxes', 'of the Goblin King', 'of Big Numbers', 'of Regret'];

// Regular affixes. v(t) = base value at rarity tier t (0..5).
const AFX = {
  dmgPct: { base: 0.12, txt: v => '+' + pct(v) + ' Damage', a: (s, v) => { s.dmgPct += v; } },
  apsPct: { base: 0.10, txt: v => '+' + pct(v) + ' Attack Speed', a: (s, v) => { s.apsPct += v; } },
  crit: { base: 0.04, txt: v => '+' + pct(v) + ' Crit Chance', a: (s, v) => { s.crit += v; } },
  critMul: { base: 0.25, txt: v => '+' + pct(v) + ' Crit Damage', a: (s, v) => { s.critMul += v; } },
  hpPct: { base: 0.10, txt: v => '+' + pct(v) + ' Max HP', a: (s, v) => { s.hpPct += v; } },
  dr: { base: 0.035, txt: v => pct(v) + ' Damage Reduction', a: (s, v) => { s.dr += v; } },
  regen: { base: 0.006, txt: v => 'Regenerate ' + (v * 100).toFixed(1) + '% HP/s', a: (s, v) => { s.regen += v; } },
  lifesteal: { base: 0.02, txt: v => pct(v) + ' Lifesteal', a: (s, v) => { s.lifesteal += v; } },
  goldPct: { base: 0.15, txt: v => '+' + pct(v) + ' Gold Found', a: (s, v) => { s.goldPct += v; } },
  thorns: { base: 0.2, txt: v => 'Reflect ' + pct(v) + ' of damage taken', a: (s, v) => { s.thorns += v; } },
  speedPct: { base: 0.06, txt: v => '+' + pct(v) + ' Run Speed', a: (s, v) => { s.speedPct += v; } },
  luck: { base: 0.06, txt: v => '+' + pct(v) + ' Chest Luck', a: (s, v) => { s.luck += v; } },
};
const AFX_KEYS = Object.keys(AFX);
// Rare-only affixes that change the inventory itself.
const AFX_SPECIAL = {
  bag: { txt: v => '+' + v + ' Bag Slot' + (v > 1 ? 's' : ''), a: (s, v) => { s.bagBonus += v; }, warn: true },
  cleave: { txt: () => 'Attacks hit every enemy in reach', a: s => { s.cleave = true; } },
};

// Legendary synergies: power fantasy first, consequences second.
const SPECIALS = [
  { id: 'shiv', slot: 'weapon', sub: 'dagger', name: 'Twitchy Shiv', t: '+500% Attack Speed. You lose 1% HP every time you blink.', a: s => { s.apsPct += 5; s.blinkDrain += 0.01; } },
  { id: 'glass', slot: 'weapon', sub: 'sword', name: 'Glass Greatsword', t: 'x3 Damage. Your Max HP is halved.', a: s => { s.dmgMul *= 3; s.hpMul *= 0.5; } },
  { id: 'tenth', slot: 'weapon', sub: 'hammer', name: 'The Tenth Bonk', t: 'Every 10th hit deals x50 damage.', a: s => { s.every10 += 50; } },
  { id: 'overkill', slot: 'weapon', sub: 'axe', name: 'Overkill Axe', t: 'Crits deal x10 instead of x1.5. +15% Crit Chance.', a: s => { s.critMul += 8.5; s.crit += 0.15; } },
  { id: 'stare', slot: 'amulet', name: 'Eye of the Death Stare', t: 'Every blink zaps ALL enemies for x6 damage. You blink twice as often.', a: s => { s.stare += 6; s.blinkRate *= 2; } },
  { id: 'tax', slot: 'amulet', name: 'Tax-Free Talisman', t: 'Selling heals 8% HP and pays double gold.', a: s => { s.sellHeal += 0.08; s.sellGold += 1; } },
  { id: 'hoard', slot: 'helm', name: "Hoarder's Crown", t: '+15% Damage for every item in your bag.', a: s => { s.perBag += 0.15; } },
  { id: 'shut', slot: 'helm', name: 'Shut-Eye Visor', t: 'Invulnerable while your eyes are closed. You blink twice as often.', a: s => { s.blinkShield = true; s.blinkRate *= 2; } },
  { id: 'fang', slot: 'ring', name: 'Vampire Fang Ring', t: '25% Lifesteal. You cannot regenerate at all.', a: s => { s.lifesteal += 0.25; s.noRegen = true; } },
  { id: 'clover', slot: 'ring', name: 'Four-Leaf Crit Clover', t: '+40% Crit Chance. Every crit heals 2% HP.', a: s => { s.crit += 0.4; s.critHeal += 0.02; } },
  { id: 'sack', slot: 'armor', name: 'Bottomless Sack', t: '+4 Bag Slots. -6% Damage for every item in your bag.', a: s => { s.bagBonus += 4; s.perBag -= 0.06; }, warn: true },
  { id: 'barrel', slot: 'armor', name: 'Spiked Barrel', t: 'Reflect 400% of all damage you take.', a: s => { s.thorns += 4; } },
  { id: 'hose', slot: 'boots', name: 'Firehose Boots', t: 'Chests drop TWICE as fast and roll +1 rarity.', a: s => { s.chestSpeed += 1; s.rarityUp += 1; } },
  { id: 'sock', slot: 'boots', name: "Berserker's Last Sock", t: '+300% Damage while below 35% HP.', a: s => { s.lowHp += 3; } },
];
const CURSES = [
  { id: 'bound', t: 'BOUND: cannot be removed for 25s after equipping.' },
  { id: 'drain', t: 'You lose 2% HP every second.', a: s => { s.drain += 0.02; } },
  { id: 'shrink', t: '-2 Bag Slots.', a: s => { s.bagBonus -= 2; }, warn: true },
  { id: 'rush', t: 'Chests drop 60% faster.', a: s => { s.chestSpeed += 0.6; } },
  { id: 'fragile', t: 'Enemies deal +75% damage.', a: s => { s.enemyDmg += 0.75; } },
  { id: 'eater', t: 'Every blink destroys a random bag item.', a: s => { s.destroyOnBlink = true; } },
  { id: 'junk', t: 'A junk item appears in your bag every 12s.', a: s => { s.junkSpawn = true; } },
  { id: 'boom', t: 'Explodes when sold (40% of your Max HP).' },
];
const POTIONS = [
  { id: 'heal', name: 'Healing Draught', col: '#ff4f6d', t: 'Drink: restore 50% HP.' },
  { id: 'rage', name: 'Rage Brew', col: '#ff8c1a', t: 'Drink: x2 Damage for 10s.' },
  { id: 'haste', name: 'Zoom Juice', col: '#4ee0ff', t: 'Drink: x2 Attack Speed for 10s.' },
  { id: 'greed', name: 'Liquid Greed', col: '#f2c14e', t: 'Drink: x3 Gold for 15s.' },
  { id: 'mystery', name: 'Mystery Slurry', col: '#b45cff', t: 'Drink: ??? (probably fine)' },
];
const JUNK = [
  { icon: 'rock', name: 'A Rock' }, { icon: 'sock', name: 'Single Damp Sock' },
  { icon: 'receipt', name: 'Goblin Tax Receipt' }, { icon: 'rock', name: 'Slightly Bigger Rock' },
  { icon: 'sock', name: "Somebody's Sock" }, { icon: 'receipt', name: 'Coupon (Expired)' },
];

const G = L => Math.pow(1.13, L - 1);
let _uid = 1;

function rollAffixVal(key, tier) {
  return AFX[key].base * (1 + tier * 0.55) * rr(0.8, 1.2);
}
function addAffixes(it, n, tier) {
  const pool = AFX_KEYS.slice();
  if (it.slot === 'weapon') pool.push('dmgPct', 'apsPct', 'crit', 'critMul');
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (it.affixes.some(a => a.k === k)) { i--; continue; }
    it.affixes.push({ k, v: rollAffixVal(k, tier) });
  }
}

function makeGear(slot, rarity, level, opts) {
  opts = opts || {};
  const r = RAR[rarity], g = G(level);
  const it = { id: _uid++, kind: 'gear', slot, rarity, level, affixes: [], special: null, curse: null, extra: [] };
  if (slot === 'weapon') {
    const sub = opts.sub || pick(Object.keys(WEAPONS));
    const wd = WEAPONS[sub];
    it.sub = sub; it.icon = sub;
    it.dmg = 11 * g * r.m * wd.dmg * rr(0.9, 1.1);
    it.spd = wd.spd;
    if (wd.cleave) it.extra.push({ k: 'cleave', v: 1 });
    it.base = pick(wd.names);
  } else {
    it.icon = SLOT_ICON[slot];
    it.base = pick(BASES[slot]);
    if (slot === 'helm') it.hp = 26 * g * r.m;
    if (slot === 'armor') { it.hp = 52 * g * r.m; it.affixes.push({ k: 'dr', v: 0.03 * (rarity + 1) }); }
    if (slot === 'boots') { it.hp = 18 * g * r.m; it.affixes.push({ k: 'speedPct', v: 0.04 + 0.02 * rarity }); }
  }
  let n = r.affixes + ((slot === 'ring' || slot === 'amulet') ? 1 : 0);
  addAffixes(it, n, Math.min(rarity, 3));
  // Inventory-bending affixes on rare+ items
  if (rarity >= 2 && rarity < R_LEG && (slot === 'armor' || slot === 'boots' || slot === 'amulet') && rand() < 0.22) {
    it.extra.push({ k: 'bag', v: rarity >= 3 && rand() < 0.4 ? 2 : 1 });
  }
  if (rarity === R_LEG) {
    const sp = opts.special ? SPECIALS.find(s => s.id === opts.special) :
      pick(SPECIALS.filter(s => s.slot === slot)) || null;
    if (sp) {
      it.special = sp.id; it.name = sp.name;
      if (sp.sub && slot === 'weapon' && it.sub !== sp.sub) { // re-roll the weapon base to match
        const wd = WEAPONS[sp.sub]; it.sub = sp.sub; it.icon = sp.sub; it.spd = wd.spd;
        it.dmg = 11 * g * r.m * wd.dmg;
        it.extra = wd.cleave ? [{ k: 'cleave', v: 1 }] : [];
      }
    }
  }
  if (rarity === R_CUR) {
    const pool = CURSES.filter(c => !(opts.noBound && c.id === 'bound'));
    it.curse = (opts.curse ? CURSES.find(c => c.id === opts.curse) : pick(pool)).id;
  }
  if (!it.name) {
    const pre = pick(PREFIX[rarity]);
    it.name = pre + ' ' + it.base + (rarity >= 2 && rand() < 0.5 ? ' ' + pick(SUFFIXES) : '');
  }
  return it;
}
function makePotion(level, id) {
  const p = id ? POTIONS.find(x => x.id === id) : pick(POTIONS);
  return { id: _uid++, kind: 'potion', potion: p.id, name: p.name, col: p.col, icon: 'potion', rarity: 1, level };
}
function makeBomb(level) {
  return { id: _uid++, kind: 'bomb', name: 'Unstable Bomb', icon: 'bomb', rarity: 2, level, fuse: 12 };
}
function makeJunk(level) {
  const j = pick(JUNK);
  return { id: _uid++, kind: 'junk', name: j.name, icon: j.icon, rarity: 0, level };
}

function rollRarity(luck, depth, up) {
  const w = [52, 27, 13, 5.5, 1.7, 0.25 + Math.min(4, depth / 220)];
  for (let i = 1; i < 5; i++) w[i] *= Math.pow(1 + luck, i);
  let tot = w.reduce((a, b) => a + b, 0), x = rand() * tot, r = 0;
  for (; r < w.length; r++) { x -= w[r]; if (x <= 0) break; }
  r = Math.min(r, 5);
  if (up && r < R_LEG) r = Math.min(R_LEG, r + up);
  return r;
}
function rollChest(st) {
  const d = st.depth, L = st.level;
  const x = rand();
  const junkP = 0.06 + Math.min(0.1, d / 4000), bombP = 0.05 + Math.min(0.07, d / 3000), potP = 0.1;
  if (x < junkP) return makeJunk(L);
  if (x < junkP + bombP) return makeBomb(L);
  if (x < junkP + bombP + potP) return makePotion(L);
  const slot = rand() < 0.24 ? 'weapon' : pick(SLOTS);
  return makeGear(slot, rollRarity(st.stats.luck, d, st.stats.rarityUp), L);
}
// The scripted opening: the power trip is guaranteed, every run.
function scriptedChest(n, L) {
  switch (n) {
    case 0: return makeGear('weapon', 2, L, { sub: 'sword' });
    case 1: return makeGear('weapon', R_LEG, L + 2, { special: 'shiv' });
    case 2: { const a = makeGear('armor', 3, L + 2); a.affixes.push({ k: 'regen', v: 0.02 }); return a; }
    case 3: return makeJunk(L);
    case 4: return makeGear('amulet', R_LEG, L + 2, { special: 'stare' });
    case 5: return makeBomb(L);
    case 6: return makeGear('helm', 2, L);
    case 7: return makePotion(L, 'heal');
    case 8: return makeGear('boots', 3, L + 1);
    case 9: return makeGear('ring', R_CUR, L + 3, { curse: 'drain' });
  }
  return null;
}

function itemColor(it) { return it.kind === 'potion' ? it.col : RAR[it.rarity].c; }
function sellValue(it, st) {
  if (it.kind === 'junk') return Math.max(1, Math.round(1 * (1 + 0.2 * save.up.sell)));
  const base = 3 * (1 + (it.level - 1) * 0.12) * (it.kind === 'gear' ? RAR[it.rarity].m : 1.2);
  return Math.max(1, Math.round(base * (1 + 0.2 * save.up.sell) * (1 + (st ? st.stats.sellGold : 0))));
}
function itemLines(it) {
  // Returns [{t, c}] describing the item for the tooltip.
  const out = [];
  if (it.kind === 'gear') {
    if (it.dmg) out.push({ t: fmt(it.dmg) + ' Damage' + (it.spd !== 1 ? '  (' + (it.spd > 1 ? 'fast' : 'slow') + ' x' + it.spd + ' speed)' : ''), c: '#ffffff', big: true });
    if (it.hp) out.push({ t: '+' + fmt(it.hp) + ' Max HP', c: '#ffffff', big: true });
    for (const a of it.affixes) out.push({ t: AFX[a.k].txt(a.v), c: '#9fe6a0' });
    for (const a of it.extra) out.push({ t: AFX_SPECIAL[a.k].txt(a.v), c: '#7fd7ff' });
    if (it.special) out.push({ t: '★ ' + SPECIALS.find(s => s.id === it.special).t, c: '#ffb347' });
    if (it.curse) out.push({ t: '☠ ' + CURSES.find(c => c.id === it.curse).t, c: '#ff5a76' });
  } else if (it.kind === 'potion') {
    out.push({ t: POTIONS.find(p => p.id === it.potion).t, c: '#ffffff' });
    out.push({ t: 'Drag onto the dungeon (or double-tap) to drink.', c: '#a99fc4' });
  } else if (it.kind === 'bomb') {
    out.push({ t: 'Throw it at enemies for x15 damage.', c: '#ffffff' });
    out.push({ t: 'Explodes in your bag in ' + Math.ceil(it.fuse) + 's!', c: '#ff5a76' });
    out.push({ t: 'Drag onto the dungeon (or double-tap) to throw.', c: '#a99fc4' });
  } else {
    out.push({ t: 'Completely worthless. Takes up space.', c: '#a99fc4' });
  }
  return out;
}
// ---------------------------------------------------------------------------
// Game state, simulation, combat and inventory rules.
// ---------------------------------------------------------------------------
const MAXBAG = 18, BAG_COLS = 6, REACH = 16;
const game = { state: 'title', t: 0, paused: false, sel: null, hover: null };
let run = null;

const ENEMIES = {
  slime: { name: 'Slime', hp: 1.0, dmg: 0.8, spd: 4, cd: 1.15, from: 0, w: 4 },
  skeleton: { name: 'Skeleton', hp: 1.25, dmg: 1.0, spd: 6, cd: 1.0, from: 25, w: 3 },
  bat: { name: 'Bat', hp: 0.6, dmg: 0.7, spd: 16, cd: 0.7, from: 50, w: 2, fly: true },
  mimic: { name: 'Mimic', hp: 1.7, dmg: 1.2, spd: 5, cd: 1.0, from: 70, w: 0.35, loot: true },
  orc: { name: 'Orc Brute', hp: 2.7, dmg: 1.7, spd: 3, cd: 1.45, from: 110, w: 1.6 },
  ghost: { name: 'Ghost', hp: 1.1, dmg: 1.35, spd: 9, cd: 0.9, from: 260, w: 1.8, fly: true },
};
const BOSSES = [
  { id: 'taxman', name: 'THE GREMLIN TAXMAN', sprite: 'taxman', t: 'Throws junk into your bag!' },
  { id: 'mimicking', name: 'THE MIMIC KING', sprite: 'mimic', t: 'Chests drop twice as fast!' },
  { id: 'watcher', name: 'THE BLINK WATCHER', sprite: 'eye', t: 'Makes you blink 3x as often!' },
];
const THEMES = [
  { name: 'THE MOSSY CRYPT', bg: '#130d22', wall: '#2c2444', wall2: '#251e3a', mortar: '#160f26', floor: '#3b3152', floor2: '#2f2744', accent: '#4b7a3c', glow: '#ff9f43' },
  { name: 'THE BONE PITS', bg: '#1a1013', wall: '#3d3030', wall2: '#342828', mortar: '#1d1415', floor: '#4a3b36', floor2: '#3b2e2a', accent: '#d8cfb4', glow: '#ffcf5a' },
  { name: 'THE LAVA VAULTS', bg: '#1d0a0a', wall: '#42201e', wall2: '#381a18', mortar: '#1f0c0b', floor: '#4f2a22', floor2: '#40211b', accent: '#ff5e3a', glow: '#ff6a2a' },
  { name: 'THE CRYSTAL MINES', bg: '#0a1222', wall: '#1f2f4c', wall2: '#1a2842', mortar: '#0c1426', floor: '#2b3d5e', floor2: '#22324e', accent: '#5ee7ff', glow: '#6ef0ff' },
  { name: 'THE VOID CASINO', bg: '#12051d', wall: '#2e1145', wall2: '#260e3a', mortar: '#140620', floor: '#3c1a55', floor2: '#311546', accent: '#ff4fd8', glow: '#ff4fd8' },
];

function computeStats(gear) {
  const s = {
    maxHp: 100, hpFlat: 0, hpPct: 0, hpMul: 1,
    dmgFlat: 6, weapon: 0, weaponSpd: 1, dmgPct: 0, dmgMul: 1,
    apsPct: 0, crit: 0.05, critMul: 1.5, dr: 0, regen: 0, lifesteal: 0, goldPct: 0, thorns: 0,
    cleave: false, speedPct: 0, luck: 0.08 * save.up.luck, bagBonus: 0, chestSpeed: 0, rarityUp: 0,
    blinkDrain: 0, blinkRate: 1, stare: 0, blinkShield: false, every10: 0, critHeal: 0, noRegen: false,
    perBag: 0, sellHeal: 0, sellGold: 0, lowHp: 0, drain: 0, enemyDmg: 0, destroyOnBlink: false, junkSpawn: false,
  };
  for (const k of SLOTS) {
    const it = gear[k]; if (!it) continue;
    if (it.dmg) { s.weapon += it.dmg; s.weaponSpd = it.spd; }
    if (it.hp) s.hpFlat += it.hp;
    for (const a of it.affixes) AFX[a.k].a(s, a.v);
    for (const a of it.extra) AFX_SPECIAL[a.k].a(s, a.v);
    if (it.special) SPECIALS.find(x => x.id === it.special).a(s);
    if (it.curse) { const c = CURSES.find(x => x.id === it.curse); if (c.a) c.a(s); }
  }
  s.maxHp = Math.max(1, (s.maxHp + s.hpFlat) * (1 + s.hpPct) * s.hpMul * (1 + 0.15 * save.up.hp));
  s.aps = 1.2 * (1 + s.apsPct) * s.weaponSpd;
  s.dmg = (s.dmgFlat + s.weapon) * (1 + s.dmgPct) * s.dmgMul * (1 + 0.15 * save.up.dmg);
  s.dr = Math.min(0.8, s.dr);
  s.crit = Math.min(1, s.crit);
  return s;
}
const bagCount = () => run.bag.reduce((n, it, i) => n + (it && i < run.cap ? 1 : 0), 0);
const freeSlot = () => { for (let i = 0; i < run.cap; i++) if (!run.bag[i]) return i; return -1; };
const buff = id => run.buffs.some(b => b.id === id);
function effDmg(s, bagN) {
  s = s || run.stats;
  let d = s.dmg * Math.max(0.05, 1 + s.perBag * (bagN == null ? bagCount() : bagN));
  if (s.lowHp && run.hp < s.maxHp * 0.35) d *= 1 + s.lowHp;
  if (buff('rage')) d *= 2;
  return d;
}
function effAps(s) { s = s || run.stats; return Math.min(30, s.aps * (buff('haste') ? 2 : 1)); }
function dps(s, bagN) { s = s || run.stats; return effDmg(s, bagN) * effAps(s) * (1 + s.crit * (s.critMul - 1)) * (s.every10 ? 1 + (s.every10 - 1) / 10 : 1); }
function chestInterval() {
  let i = 3 / (1 + run.stats.chestSpeed);
  if (run.boss && run.boss.bid === 'mimicking') i *= 0.5;
  return i;
}

function newRun() {
  run = {
    t: 0, depth: 0, level: 1, hp: 1, gear: {}, bag: new Array(MAXBAG).fill(null), cap: 6, stats: null,
    chestT: 1.4, chestN: 0, chests: [], enemies: [], shots: [], fx: [], nums: [], flyers: [], beams: [],
    nextSpawn: 9, nextBoss: 250, boss: null, floor: 0, kills: 0, gold: 0, opened: 0,
    blinkT: 2.4, eyes: 0, hits: 0, atkT: 0, fighting: false, buffs: [], junkT: 12,
    insured: false, bestItem: null, dead: false, cause: '', deathT: 0, exploded: false,
    shake: 0, flash: 0, flashCol: '#fff', slow: 0, attackAnim: 0, hurtT: 0, legT: 0, scroll: 0,
    jackpot: null, banner: null, toasts: [], hint: null, hintsDone: {}, bossAbilityT: 4,
  };
  for (const k of SLOTS) run.gear[k] = null;
  recompute(true);
  run.hp = run.stats.maxHp;
  game.sel = null; game.hover = null; game.paused = false;
  game.state = 'play';
  showBanner(THEMES[0].name, 'Run #' + (save.runs + 1) + ' · Loot fast. Don\'t explode.');
  save.runs++; writeSave();
}

function recompute(init) {
  const prevMax = run.stats ? run.stats.maxHp : 0;
  run.stats = computeStats(run.gear);
  if (!init && prevMax > 0) run.hp = clamp(run.hp * run.stats.maxHp / prevMax, 0, run.stats.maxHp);
  const cap = clamp(6 + save.up.bag + run.stats.bagBonus, 2, MAXBAG);
  if (cap !== run.cap) setCap(cap);
}
function setCap(cap) {
  const grew = cap > run.cap;
  run.cap = cap;
  const displaced = [];
  for (let i = cap; i < MAXBAG; i++) if (run.bag[i]) { displaced.push(run.bag[i]); run.bag[i] = null; }
  for (const it of displaced) {
    const f = freeSlot();
    if (f >= 0) run.bag[f] = it; else if (!overflow(it, 'Your bag shrank and burst!')) return;
  }
  toast(grew ? 'BAG +' : 'BAG SHRANK!', grew ? '#7fd7ff' : '#ff5a76');
}
// Returns true if the player survived the overflow.
function overflow(it, why) {
  if (run.dead) return false;
  if (save.up.insure && !run.insured) {
    run.insured = true;
    toast('INSURANCE CLAIMED! ' + it.name + ' was shredded', '#7fd7ff', 2.4);
    puff(LAY.bagRect.x + LAY.bagRect.w / 2, LAY.bagRect.y + LAY.bagRect.h / 2, '#7fd7ff', 30);
    AU.sfx('deny');
    return true;
  }
  die(why || 'Your bag overflowed!', true);
  return false;
}
function die(cause, explode) {
  if (run.dead) return;
  run.dead = true; run.cause = cause; run.exploded = !!explode; run.deathT = 0;
  run.hp = Math.min(run.hp, 0);
  run.shake = explode ? 1.4 : 0.6; run.flash = explode ? 1 : 0.4; run.flashCol = explode ? '#fff3c4' : '#ff3b5c';
  run.slow = 0.6;
  if (explode) {
    AU.sfx('explode');
    const hx = LAY.hx, hy = LAY.gy - 9 * LAY.P;
    for (let i = 0; i < 90; i++) {
      const a = rand() * Math.PI * 2, sp = rr(80, 520);
      run.fx.push({ x: hx, y: hy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, life: rr(0.6, 1.6), max: 1.6, col: pick(['#fff3c4', '#ffb347', '#ff5e3a', '#6cc644', '#f2c14e']), size: rr(2, 6), g: 500 });
    }
    // Your loot sprays everywhere. Every item you owned, gone.
    for (let i = 0; i < run.cap; i++) if (run.bag[i]) {
      const r = LAY.bag[i];
      run.fx.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, vx: rr(-300, 300), vy: rr(-500, -200), life: 1.6, max: 1.6, icon: run.bag[i], size: r.w * 0.7, g: 700, spin: rr(-8, 8) });
      run.bag[i] = null;
    }
  } else AU.sfx('die');
}

function toast(text, col, dur) { run.toasts.push({ text, col: col || '#fff', t: 0, dur: dur || 1.4 }); if (run.toasts.length > 4) run.toasts.shift(); }
function showBanner(title, sub) { run.banner = { title, sub, t: 0 }; }
function num(dx, h, text, col, size) { run.nums.push({ dx, h, text, col, size: size || 1, t: 0, vx: rr(-6, 6) }); if (run.nums.length > 80) run.nums.shift(); }
function puff(x, y, col, n) {
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2, sp = rr(40, 220);
    run.fx.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rr(0.3, 0.8), max: 0.8, col, size: rr(2, 4), g: 200 });
  }
}

// ------------------------------------------------------------- spawning ----
// Enemies keep pace with loot, then slowly outgrow it: every run has to end.
function enemyScale() { return G(run.level) * (1 + Math.pow(run.depth / 1400, 2)); }
const goldScale = L => 1 + (L - 1) * 0.15;
function spawnEnemy() {
  const avail = Object.keys(ENEMIES).filter(k => run.depth >= ENEMIES[k].from);
  const tot = avail.reduce((a, k) => a + ENEMIES[k].w, 0);
  let x = rand() * tot, type = avail[0];
  for (const k of avail) { x -= ENEMIES[k].w; if (x <= 0) { type = k; break; } }
  const d = ENEMIES[type], g = enemyScale();
  const last = run.enemies.length ? run.enemies[run.enemies.length - 1].dx : 0;
  const e = {
    type, def: d, name: d.name, dx: Math.max(LAY.viewU + 12, last + 14), hp: 22 * g * d.hp, dmg: 3.6 * g * d.dmg,
    cd: d.cd * 0.6, hurt: 0, bob: rand() * 6, fly: !!d.fly, scale: 1, boss: false,
  };
  e.maxHp = e.hp;
  run.enemies.push(e);
}
function spawnBoss() {
  const b = BOSSES[run.floor % BOSSES.length], g = enemyScale();
  const e = {
    type: b.sprite, bid: b.id, def: { cd: 1.3, spd: 3 }, name: b.name, dx: LAY.viewU + 24, hp: 22 * g * 32, dmg: 3.6 * g * 2.1,
    cd: 1.5, hurt: 0, bob: 0, fly: b.id === 'watcher', scale: 2.4, boss: true,
  };
  e.maxHp = e.hp;
  run.enemies.push(e); run.boss = e; run.bossAbilityT = 3;
  showBanner('BOSS: ' + b.name, b.t);
  AU.sfx('boss');
}
function spawnChest(item, dx) {
  const it = item || scriptedChest(run.chestN, run.level) || rollChest(run);
  run.chestN++;
  // Land it where the hero will be when it pops open (~1.2s from now).
  const lead = run.fighting || run.jackpot ? 0 : 6 * (1 + run.stats.speedPct) * 8 * 1.15;
  run.chests.push({ dx: dx == null ? 20 + lead : dx, h: 60, vh: 0, st: 'fall', t: 0, item: it, bounces: 0 });
  AU.sfx('drop');
}
// Send an item flying into the bag; the overflow check happens on arrival.
function sendToBag(it, x, y, delay) {
  run.flyers.push({ item: it, x, y, t: -(delay || 0), dur: 0.5 });
}
function arriveInBag(it) {
  const i = freeSlot();
  if (i < 0) { overflow(it, 'Your bag overflowed!'); return; }
  run.bag[i] = it;
  run.opened++;
  if (it.kind === 'gear' && (!run.bestItem || it.rarity > run.bestItem.rarity || (it.rarity === run.bestItem.rarity && it.level > run.bestItem.level))) run.bestItem = it;
  const r = LAY.bag[i];
  puff(r.x + r.w / 2, r.y + r.h / 2, itemColor(it), it.rarity >= 3 ? 16 : 6);
  tutorialOnArrive(it, i);
}

// ---------------------------------------------------------------- combat ---
function attack() {
  const s = run.stats;
  let tg = run.enemies.filter(e => e.dx <= REACH + 1.5 + (e.boss ? 15 : 0) && e.hp > 0);
  if (!tg.length) return;
  tg.sort((a, b) => a.dx - b.dx);
  if (!s.cleave) tg = [tg[0]];
  run.hits++;
  let d = effDmg(), crit = rand() < s.crit, big = false;
  if (crit) d *= s.critMul;
  if (s.every10 && run.hits % 10 === 0) { d *= s.every10; big = true; }
  for (const e of tg) hurtEnemy(e, d, crit || big, big);
  if (s.lifesteal) heal(d * s.lifesteal * tg.length);
  if (crit && s.critHeal) heal(s.maxHp * s.critHeal);
  run.attackAnim = Math.min(0.14, 0.6 / effAps());
  AU.sfx(crit || big ? 'crit' : 'hit');
  if (big) { run.shake = Math.max(run.shake, 0.5); run.flash = 0.25; run.flashCol = '#ffe08a'; }
}
function heal(v) { run.hp = Math.min(run.stats.maxHp, run.hp + v); }
function hurtEnemy(e, d, crit, huge) {
  if (e.hp <= 0) return;
  e.hp -= d; e.hurt = 0.1;
  num(e.dx + rr(-3, 3), (e.fly ? 22 : 16) * e.scale, fmt(d) + (crit ? '!' : ''), huge ? '#ff9a1f' : crit ? '#ffe14d' : '#ffffff', huge ? 2 : crit ? 1.5 : 1);
  const px = LAY.hx + e.dx * LAY.P, py = LAY.gy - (e.fly ? 18 : 8) * e.scale * LAY.P;
  for (let i = 0; i < (crit ? 6 : 3); i++) run.fx.push({ x: px, y: py, vx: rr(20, 160), vy: rr(-160, 20), life: 0.35, max: 0.35, col: crit ? '#ffe14d' : '#ffffff', size: rr(1.5, 3), g: 400 });
  if (e.hp <= 0) killEnemy(e);
}
function killEnemy(e) {
  run.kills++; save.kills++;
  let gold = 0.8 * goldScale(run.level) * (1 + run.stats.goldPct) * (buff('greed') ? 3 : 1) * (e.boss ? 40 : 1);
  gold = Math.max(1, Math.round(gold));
  run.gold += gold;
  const px = LAY.hx + e.dx * LAY.P, py = LAY.gy - (e.fly ? 18 : 8) * e.scale * LAY.P;
  puff(px, py, e.boss ? '#ff9a1f' : '#cfc3ff', e.boss ? 60 : 12);
  for (let i = 0; i < Math.min(12, 2 + Math.floor(Math.log10(gold + 1) * 2)); i++) run.fx.push({ x: px, y: py, vx: rr(-120, 120), vy: rr(-260, -120), life: 0.9, max: 0.9, coin: true, size: 6, g: 600, home: 0.45 });
  AU.sfx('coin');
  if (e.def.loot) { spawnChest(null, e.dx); toast('MIMIC LOOT!', '#f2c14e'); }
  if (e.boss) {
    run.boss = null; run.shake = 1; run.flash = 0.6; run.flashCol = '#ffe08a';
    AU.sfx('jackpot');
    startJackpot();
  }
  run.enemies = run.enemies.filter(x => x !== e);
}
function hitHero(d, src) {
  if (run.dead) return;
  const s = run.stats;
  if (s.blinkShield && run.eyes > 0) { num(0, 24, 'BLOCKED', '#7fd7ff', 1.2); return; }
  const taken = d * (1 + s.enemyDmg) * (1 - s.dr);
  run.hp -= taken; run.hurtT = 0.15;
  run.shake = Math.max(run.shake, 0.18);
  num(-2, 22, '-' + fmt(taken), '#ff5a76', 1.1);
  AU.sfx('hurt');
  if (s.thorns && src) hurtEnemy(src, d * s.thorns, false);
  if (run.hp <= 0) die('Slain by ' + (src ? src.name : 'something'), false);
}
function onBlink() {
  const s = run.stats;
  if (s.blinkDrain) {
    run.hp -= s.maxHp * s.blinkDrain;
    num(0, 26, 'BLINK -' + pct(s.blinkDrain), '#ff8fa3', 0.9);
    if (run.hp <= 0) { die('Blinked to death', false); return; }
  }
  if (s.stare && run.enemies.length) {
    const d = effDmg() * s.stare;
    for (const e of run.enemies.slice()) {
      if (e.dx > LAY.viewU) continue;
      run.beams.push({ dx: e.dx, h: (e.fly ? 18 : 8) * e.scale, t: 0 });
      hurtEnemy(e, d, true);
    }
    AU.sfx('zap');
  } else if (s.blinkDrain || s.blinkShield) AU.sfx('blink');
  if (s.destroyOnBlink) {
    const full = []; for (let i = 0; i < run.cap; i++) if (run.bag[i]) full.push(i);
    if (full.length) {
      const i = pick(full), r = LAY.bag[i];
      puff(r.x + r.w / 2, r.y + r.h / 2, '#ff5a76', 14);
      toast('The curse ate ' + run.bag[i].name + '!', '#ff5a76');
      run.bag[i] = null;
    }
  }
}
function bagExplode(i) {
  const it = run.bag[i]; if (!it) return;
  run.bag[i] = null;
  const r = LAY.bag[i];
  puff(r.x + r.w / 2, r.y + r.h / 2, '#ffb347', 40);
  const c = i % BAG_COLS, nb = [];
  if (c > 0) nb.push(i - 1);
  if (c < BAG_COLS - 1) nb.push(i + 1);
  nb.push(i - BAG_COLS, i + BAG_COLS);
  let lost = 0;
  for (const j of nb) if (j >= 0 && j < run.cap && run.bag[j]) {
    const rj = LAY.bag[j]; puff(rj.x + rj.w / 2, rj.y + rj.h / 2, '#ff5e3a', 12);
    run.bag[j] = null; lost++;
  }
  run.shake = 0.7; run.flash = 0.35; run.flashCol = '#ffb347';
  AU.sfx('boom');
  toast('BOMB WENT OFF IN YOUR BAG!' + (lost ? ' ' + lost + ' item' + (lost > 1 ? 's' : '') + ' destroyed' : ''), '#ffb347', 2);
  run.hp -= run.stats.maxHp * 0.3; run.hurtT = 0.2;
  if (run.hp <= 0) die('Blown up by your own bomb', true);
}
function throwBomb(it) {
  let target = run.enemies.filter(e => e.dx < LAY.viewU).sort((a, b) => a.dx - b.dx)[0];
  run.shots.push({ kind: 'bomb', x0: 4, h0: 14, x1: target ? target.dx : 40, t: 0, dur: 0.45, dmg: effDmg() * 15 });
  AU.sfx('throw');
}
function drink(it) {
  let p = it.potion;
  if (p === 'mystery') p = pick(['heal', 'rage', 'haste', 'greed', 'confuse', 'confuse']);
  AU.sfx('drink');
  if (p === 'heal') { heal(run.stats.maxHp * 0.5); toast('+50% HP', '#ff8fa3'); }
  else if (p === 'confuse') { addBuff('confuse', 12); toast('UH OH. BLINKING x4', '#b45cff'); }
  else { addBuff(p, p === 'greed' ? 15 : 10); toast({ rage: 'RAGE! x2 DAMAGE', haste: 'ZOOM! x2 ATTACK SPEED', greed: 'GREED! x3 GOLD' }[p], it.col); }
}
function addBuff(id, t) {
  const b = run.buffs.find(x => x.id === id);
  if (b) b.t = Math.max(b.t, t); else run.buffs.push({ id, t, max: t });
}

// --------------------------------------------------------------- jackpot ---
const REEL_SYMS = ['sword', 'ring', 'amulet', 'helm', 'potion', 'bomb'];
function startJackpot() {
  const x = rand();
  let res;
  if (x < 0.22) { const s = pick(REEL_SYMS); res = [s, s, s]; }
  else if (x < 0.65) { const s = pick(REEL_SYMS); let o; do { o = pick(REEL_SYMS); } while (o === s); res = [s, s, o]; res.sort(() => rand() - 0.5); }
  else { res = REEL_SYMS.slice().sort(() => rand() - 0.5).slice(0, 3); }
  const match = res[0] === res[1] && res[1] === res[2] ? 3 : (res[0] === res[1] || res[1] === res[2] || res[0] === res[2]) ? 2 : 1;
  run.jackpot = { t: 0, res, match, paid: false };
}
function payJackpot() {
  const j = run.jackpot, L = run.level + 2, cx = LAY.scene.w / 2, cy = LAY.scene.h * 0.42;
  const items = [];
  if (j.match === 3) items.push(makeGear(pick(SLOTS), R_LEG, L), makeGear(pick(SLOTS), R_LEG, L));
  else if (j.match === 2) items.push(makeGear(pick(SLOTS), R_LEG, L));
  else items.push(makeGear(pick(SLOTS), 3, L));
  items.forEach((it, i) => sendToBag(it, cx, cy, i * 0.3));
  const gold = Math.round(30 * goldScale(run.level) * [1, 1, 2, 5][j.match]);
  run.gold += gold;
  toast((j.match === 3 ? 'MEGA JACKPOT! ' : j.match === 2 ? 'JACKPOT! ' : 'CONSOLATION PRIZE ') + '+' + fmt(gold) + ' GOLD', '#f2c14e', 2.4);
  for (let i = 0; i < 30; i++) run.fx.push({ x: cx, y: cy, vx: rr(-260, 260), vy: rr(-380, -60), life: 1.2, max: 1.2, coin: true, size: 6, g: 600, home: 0.6 });
  j.paid = true;
}

// ---------------------------------------------------------------- update ---
function update(dt) {
  game.t += dt;
  if (game.state !== 'play' || game.paused) return;
  if (run.slow > 0) { run.slow -= dt; dt *= 0.35; }
  run.t += dt;
  const s = run.stats;
  updateFx(dt);
  if (run.dead) {
    run.deathT += dt;
    if (run.deathT > 2.2) endRun();
    return;
  }
  // timers
  run.attackAnim = Math.max(0, run.attackAnim - dt);
  run.hurtT = Math.max(0, run.hurtT - dt);
  for (const b of run.buffs) b.t -= dt;
  run.buffs = run.buffs.filter(b => b.t > 0);
  if (run.banner && (run.banner.t += dt) > 3) run.banner = null;
  for (const t of run.toasts) t.t += dt;
  run.toasts = run.toasts.filter(t => t.t < t.dur);

  // movement
  run.fighting = run.enemies.some(e => e.dx <= REACH + 0.6 + (e.boss ? 15 : 0));
  const speed = run.fighting || run.jackpot ? 0 : 6 * (1 + s.speedPct);
  const du = speed * 8 * dt;
  run.depth += speed * dt; run.scroll += du;
  if (speed) run.legT += dt * (1 + s.speedPct) * 10;
  run.level = 1 + Math.floor(run.depth / 18);
  if (run.depth > save.best && !run.newBest && save.best > 50) { run.newBest = true; toast('NEW BEST DEPTH!', '#f2c14e', 2); }

  // spawns
  if (!run.boss && !run.jackpot) {
    if (run.depth >= run.nextBoss) { spawnBoss(); run.nextBoss += 250; }
    else if (run.depth >= run.nextSpawn) {
      spawnEnemy();
      if (run.depth > 180 && rand() < Math.min(0.45, run.depth / 2000)) spawnEnemy();
      run.nextSpawn = run.depth + rr(9, 15) * Math.max(0.55, 1 - run.depth / 3000);
    }
  }
  // enemies advance; they queue up in a line in front of the hero
  run.enemies.sort((a, b) => a.dx - b.dx);
  let stop = REACH;
  for (const e of run.enemies) {
    const want = stop + (e.boss ? 15 : 0);
    e.dx -= du + e.def.spd * dt;
    if (e.dx < want) e.dx = want;
    stop = e.dx + 15 * e.scale;
    e.hurt = Math.max(0, e.hurt - dt);
    e.bob += dt * (e.fly ? 9 : 6);
    if (e.dx <= want + 0.01 && e.dx <= REACH + 0.6 + (e.boss ? 15 : 0)) {
      e.cd -= dt;
      if (e.cd <= 0) { e.cd = e.def.cd; e.lunge = 0.15; hitHero(e.dmg, e); if (run.dead) return; }
    }
    if (e.lunge) e.lunge = Math.max(0, e.lunge - dt);
  }
  // boss abilities
  if (run.boss && run.boss.bid === 'taxman' && run.boss.dx < LAY.viewU) {
    run.bossAbilityT -= dt;
    if (run.bossAbilityT <= 0) {
      run.bossAbilityT = 4;
      const e = run.boss;
      sendToBag(makeJunk(run.level), LAY.hx + e.dx * LAY.P, LAY.gy - 20 * e.scale * LAY.P);
      toast('TAXMAN: "Your receipt, sir."', '#c46bff');
    }
  }
  // hero attacks
  run.atkT -= dt;
  if (run.fighting) {
    if (run.atkT < -0.25) run.atkT = 0;
    let guard = 0;
    while (run.atkT <= 0 && guard++ < 4) { run.atkT += 1 / effAps(); attack(); if (run.dead) return; }
  } else run.atkT = Math.max(run.atkT, 0);

  // health over time
  if (!s.noRegen) heal(s.maxHp * (s.regen + (run.fighting ? 0 : 0.035)) * dt);
  if (s.drain) { run.hp -= s.maxHp * s.drain * dt; if (run.hp <= 0) { die('Drained by a cursed item', false); return; } }

  // blinking (it matters more than you think)
  run.eyes = Math.max(0, run.eyes - dt);
  const bmul = s.blinkRate * (buff('confuse') ? 4 : 1) * (run.boss && run.boss.bid === 'watcher' ? 3 : 1);
  run.blinkT -= dt * bmul;
  if (run.blinkT <= 0) { run.blinkT = rr(2.2, 3.0); run.eyes = s.blinkShield ? 0.45 : 0.16; onBlink(); if (run.dead) return; }

  // cursed junk
  if (s.junkSpawn) {
    run.junkT -= dt;
    if (run.junkT <= 0) { run.junkT = 12; sendToBag(makeJunk(run.level), LAY.scene.w * 0.5, 0); toast('Cursed junk appeared!', '#ff5a76'); }
  }
  // bombs tick in the bag
  for (let i = 0; i < run.cap; i++) {
    const it = run.bag[i];
    if (it && it.kind === 'bomb') {
      const before = Math.ceil(it.fuse);
      it.fuse -= dt;
      if (Math.ceil(it.fuse) !== before && it.fuse < 4) AU.sfx('tick');
      if (it.fuse <= 0) { bagExplode(i); if (run.dead) return; }
    }
  }

  // chests
  if (!run.jackpot) {
    run.chestT -= dt;
    if (run.chestT <= 0) { run.chestT += chestInterval(); spawnChest(); }
  }
  for (const c of run.chests) {
    c.dx -= du; c.t += dt;
    if (c.st !== 'open' && c.dx < 8) c.dx = 8; // the goblin never runs past unopened loot
    if (c.st === 'fall') {
      c.vh -= 420 * dt; c.h += c.vh * dt;
      if (c.h <= 0) {
        c.h = 0;
        if (c.bounces++ < 1 && c.vh < -60) { c.vh = -c.vh * 0.35; } else { c.st = 'land'; c.t = 0; }
      }
    } else if (c.st === 'land' && c.t > 0.18) { c.st = 'spin'; c.t = 0; }
    else if (c.st === 'spin') {
      if (Math.floor(c.t * 30) !== Math.floor((c.t - dt) * 30)) AU.sfx('reel');
      if (c.t > 0.32) {
        c.st = 'open'; c.t = 0;
        const it = c.item, r = it.rarity;
        AU.sfx('chest', it.kind === 'gear' ? r : 1);
        if (r >= R_LEG && it.kind === 'gear') {
          run.flash = 0.45; run.flashCol = RAR[r].c; run.slow = 0.25; run.shake = Math.max(run.shake, 0.35);
          toast((r === R_CUR ? 'CURSED! ' : 'LEGENDARY! ') + it.name, RAR[r].c, 2);
        }
        const px = LAY.hx + c.dx * LAY.P, py = LAY.gy - 10 * LAY.P;
        sendToBag(it, px, py);
        puff(px, py, itemColor(it), it.rarity >= 3 ? 30 : 10);
        save.chests++;
      }
    }
  }
  run.chests = run.chests.filter(c => c.dx > -40 && !(c.st === 'open' && c.t > 6));

  // flying loot
  for (const fl of run.flyers) {
    fl.t += dt;
    if (fl.t >= fl.dur && !fl.done) { fl.done = true; arriveInBag(fl.item); if (run.dead) return; }
  }
  run.flyers = run.flyers.filter(fl => !fl.done);

  // thrown bombs
  for (const sh of run.shots) {
    sh.t += dt;
    if (sh.t >= sh.dur && !sh.done) {
      sh.done = true;
      const px = LAY.hx + sh.x1 * LAY.P, py = LAY.gy - 6 * LAY.P;
      puff(px, py, '#ffb347', 50); puff(px, py, '#fff3c4', 20);
      run.shake = Math.max(run.shake, 0.5); AU.sfx('boom');
      for (const e of run.enemies.slice()) if (Math.abs(e.dx - sh.x1) < 34) hurtEnemy(e, sh.dmg, true, true);
    }
  }
  run.shots = run.shots.filter(s2 => !s2.done);
  for (const b of run.beams) b.t += dt;
  run.beams = run.beams.filter(b => b.t < 0.25);

  // jackpot reels
  if (run.jackpot) {
    const j = run.jackpot; j.t += dt;
    if (j.t < 1.9 && Math.floor(j.t * 18) !== Math.floor((j.t - dt) * 18)) AU.sfx('reel');
    if (j.t > 2.0 && !j.paid) { payJackpot(); AU.sfx('jackpot'); }
    if (j.t > 3.2) {
      run.jackpot = null; run.floor++;
      const th = THEMES[run.floor % THEMES.length];
      showBanner(th.name, 'Floor ' + (run.floor + 1) + ' · Depth ' + Math.floor(run.depth) + ' m');
      AU.sfx('floor');
      run.nextSpawn = run.depth + 12;
    }
  }
  tutorialUpdate();
}
function updateFx(dt) {
  run.shake = Math.max(0, run.shake - dt * 2);
  run.flash = Math.max(0, run.flash - dt * 2.5);
  for (const p of run.fx) {
    p.life -= dt;
    if (p.home && p.max - p.life > p.home) {
      // coins home in on the gold counter
      const tx = LAY.goldPos.x, ty = LAY.goldPos.y;
      p.vx = lerp(p.vx, (tx - p.x) * 6, 0.2); p.vy = lerp(p.vy, (ty - p.y) * 6, 0.2);
      if (Math.abs(tx - p.x) < 10 && Math.abs(ty - p.y) < 10) { p.life = 0; LAY.goldPulse = 0.2; }
    } else p.vy += (p.g || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spin) p.rot = (p.rot || 0) + p.spin * dt;
  }
  run.fx = run.fx.filter(p => p.life > 0);
  if (run.fx.length > 700) run.fx.splice(0, run.fx.length - 700);
  for (const n of run.nums) { n.t += dt; n.dx += n.vx * dt; }
  run.nums = run.nums.filter(n => n.t < 0.9);
  if (LAY.goldPulse) LAY.goldPulse = Math.max(0, LAY.goldPulse - dt);
}
function endRun() {
  save.gold += run.gold;
  const d = Math.floor(run.depth);
  run.record = d > save.best;
  if (run.record) save.best = d;
  if (run.bestItem && (!save.bestItem || run.bestItem.rarity > save.bestItem.r || (run.bestItem.rarity === save.bestItem.r && run.bestItem.level > save.bestItem.l))) {
    save.bestItem = { n: run.bestItem.name, r: run.bestItem.rarity, l: run.bestItem.level };
  }
  if (run.chestN >= 10) save.tut = true;
  writeSave();
  game.state = 'dead'; game.sel = null; game.drag = null;
}

// ---------------------------------------------------- inventory actions ----
// A "ref" is {k:'bag', i} or {k:'gear', s}.
function getItem(ref) { if (!ref) return null; return ref.k === 'bag' ? (ref.i < run.cap ? run.bag[ref.i] : null) : run.gear[ref.s]; }
function setItem(ref, it) { if (ref.k === 'bag') run.bag[ref.i] = it; else run.gear[ref.s] = it; }
function isBound(it) { return it && it.boundUntil && run.t < it.boundUntil; }
function deny(msg) { toast(msg, '#ff5a76'); AU.sfx('deny'); }

function equipFrom(ref) {
  const it = getItem(ref); if (!it || it.kind !== 'gear') return false;
  const cur = run.gear[it.slot];
  if (isBound(cur)) { deny('BOUND! ' + cur.name + ' won\'t come off for ' + Math.ceil(cur.boundUntil - run.t) + 's'); return false; }
  run.gear[it.slot] = it;
  setItem(ref, cur || null);
  if (it.curse === 'bound') it.boundUntil = run.t + 25;
  AU.sfx(it.rarity >= R_LEG ? 'chest' : 'equip', it.rarity);
  const r = LAY.gear[it.slot];
  puff(r.x + r.w / 2, r.y + r.h / 2, itemColor(it), 14);
  recompute();
  if (it.curse) toast('☠ ' + CURSES.find(c => c.id === it.curse).t, '#ff5a76', 2.2);
  return true;
}
function unequip(slot, toIdx) {
  const it = run.gear[slot]; if (!it) return false;
  if (isBound(it)) { deny('BOUND! Can\'t remove for ' + Math.ceil(it.boundUntil - run.t) + 's'); return false; }
  const i = toIdx != null ? toIdx : freeSlot();
  if (i < 0 || run.bag[i]) { deny('No room in your bag!'); return false; }
  run.gear[slot] = null; run.bag[i] = it;
  AU.sfx('swap');
  recompute();
  return true;
}
function sell(ref) {
  const it = getItem(ref); if (!it) return false;
  if (ref.k === 'gear' && isBound(it)) { deny('BOUND! Can\'t sell it yet'); return false; }
  setItem(ref, null);
  const v = Math.round(sellValue(it, run) * (buff('greed') ? 3 : 1));
  run.gold += v;
  const r = LAY.sell;
  for (let i = 0; i < Math.min(10, 2 + Math.floor(Math.log10(v + 1) * 2)); i++) run.fx.push({ x: r.x + r.w / 2, y: r.y + r.h / 2, vx: rr(-120, 120), vy: rr(-260, -100), life: 0.9, max: 0.9, coin: true, size: 6, g: 600, home: 0.35 });
  run.nums.push({ screen: true, x: r.x + r.w / 2, y: r.y, text: '+' + fmt(v) + 'g', col: '#f2c14e', size: 1.1, t: 0, vx: 0, dx: 0 });
  AU.sfx('sell');
  if (run.stats.sellHeal) heal(run.stats.maxHp * run.stats.sellHeal);
  if (ref.k === 'gear') recompute();
  if (it.curse === 'boom') {
    run.hp -= run.stats.maxHp * 0.4; run.shake = 0.6; AU.sfx('boom');
    puff(r.x + r.w / 2, r.y + r.h / 2, '#ff5e3a', 40);
    toast('IT EXPLODED WHEN SOLD!', '#ff5a76');
    if (run.hp <= 0) die('Sold a cursed item. It exploded.', true);
  }
  return true;
}
function useItem(ref) {
  const it = getItem(ref); if (!it) return false;
  if (it.kind === 'potion') { setItem(ref, null); drink(it); return true; }
  if (it.kind === 'bomb') { setItem(ref, null); throwBomb(it); return true; }
  if (it.kind === 'gear') return ref.k === 'bag' ? equipFrom(ref) : unequip(ref.s);
  if (it.kind === 'junk') return sell(ref);
  return false;
}
// Drag-and-drop resolution.
function dropOn(src, tgt) {
  const it = getItem(src); if (!it) return;
  if (!tgt) return;
  if (tgt.k === 'sell') { sell(src); return; }
  if (tgt.k === 'scene') {
    if (it.kind === 'gear') { if (src.k === 'bag') equipFrom(src); return; }
    if (it.kind === 'junk') { deny('Junk does nothing. SELL it!'); return; }
    useItem(src); return;
  }
  if (tgt.k === 'gear') {
    if (src.k === 'gear') return;
    if (it.kind !== 'gear') { deny(it.kind === 'junk' ? 'You can\'t wear junk' : 'Drag it onto the dungeon to use it'); return; }
    if (it.slot !== tgt.s) { deny('That goes in the ' + SLOT_NAME[it.slot].toUpperCase() + ' slot'); return; }
    equipFrom(src); return;
  }
  if (tgt.k === 'bag') {
    if (tgt.i >= run.cap) return;
    if (src.k === 'bag') {
      if (src.i === tgt.i) return;
      const o = run.bag[tgt.i]; run.bag[tgt.i] = it; run.bag[src.i] = o; AU.sfx('swap'); return;
    }
    const o = run.bag[tgt.i];
    if (!o) { unequip(src.s, tgt.i); return; }
    if (o.kind === 'gear' && o.slot === src.s) { equipFrom(tgt); return; }
    deny('That slot is taken');
  }
}

// Preview: how would equipping `it` change things?
function previewEquip(it) {
  if (!it || it.kind !== 'gear') return null;
  const g2 = Object.assign({}, run.gear); g2[it.slot] = it;
  const s2 = computeStats(g2);
  const inBag = run.bag.indexOf(it) >= 0;
  const n = bagCount() - (inBag ? 1 : 0) + (run.gear[it.slot] ? 1 : 0);
  const cap2 = clamp(6 + save.up.bag + s2.bagBonus, 2, MAXBAG);
  return {
    dps: dps(s2, n) / Math.max(1e-9, dps()) - 1,
    hp: s2.maxHp / run.stats.maxHp - 1,
    burst: n > cap2, cap: cap2 - run.cap,
  };
}

// ------------------------------------------------------------- tutorial ----
function tutorialOnArrive(it, i) {
  if (save.tut) return;
  const h = run.hintsDone;
  if (it.kind === 'gear' && !h.equip && !run.gear[it.slot]) { run.hint = { id: 'equip', ref: { k: 'bag', i }, item: it, text: 'NEW LOOT! Drag it onto your ' + SLOT_NAME[it.slot].toUpperCase() + ' slot (or double-tap it).' }; }
  else if (it.kind === 'junk' && !h.sell) run.hint = { id: 'sell', ref: { k: 'bag', i }, item: it, text: 'JUNK! Drag it to SELL. If your bag overflows... you explode.' };
  else if (it.kind === 'bomb' && !h.bomb) run.hint = { id: 'bomb', ref: { k: 'bag', i }, item: it, text: 'A BOMB! It will blow up in your bag. Drag it onto the dungeon to throw it!' };
}
function tutorialUpdate() {
  const hint = run.hint;
  if (hint) {
    const still = run.bag.indexOf(hint.item);
    if (still < 0) { run.hintsDone[hint.id] = true; run.hint = null; }
    else hint.ref = { k: 'bag', i: still };
  }
  if (!save.tut && !run.hint && !run.hintsDone.full && bagCount() >= run.cap - 1) {
    run.hintsDone.full = true;
    toast('Bag almost full! Equip, sell or use something!', '#ff5a76', 2.4);
    AU.sfx('warn');
  }
}
// ---------------------------------------------------------------------------
// Layout + rendering.
// ---------------------------------------------------------------------------
const LAY = { bag: [], gear: {}, goldPos: { x: 0, y: 0 }, goldPulse: 0 };

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  layout();
}
function layout() {
  const portrait = H > W * 1.05;
  LAY.portrait = portrait;
  let S, sceneH;
  if (!portrait) {
    sceneH = Math.round(H * 0.55);
    const ph = H - sceneH;
    S = Math.floor(Math.min((ph - 46) / 3.25, (W - 60) / 12.6));
    S = clamp(S, 30, 84);
    const g = Math.round(S * 0.1), gap = Math.round(S * 0.55);
    const gearW = 3 * S + 2 * g, bagW = BAG_COLS * S + (BAG_COLS - 1) * g, sellW = Math.round(S * 1.5);
    const total = gearW + gap + bagW + gap + sellW;
    let x = Math.round((W - total) / 2), y = sceneH + Math.round(S * 0.42) + 6;
    LAY.gearLabel = { x, y: y - 8 };
    SLOTS.forEach((k, i) => { LAY.gear[k] = { x: x + (i % 3) * (S + g), y: y + Math.floor(i / 3) * (S + g), w: S, h: S }; });
    x += gearW + gap;
    LAY.bagLabel = { x, y: y - 8 };
    for (let i = 0; i < MAXBAG; i++) LAY.bag[i] = { x: x + (i % BAG_COLS) * (S + g), y: y + Math.floor(i / BAG_COLS) * (S + g), w: S, h: S };
    LAY.bagRect = { x, y, w: bagW, h: 3 * S + 2 * g };
    x += bagW + gap;
    LAY.sell = { x, y, w: sellW, h: 2 * S + g };
    LAY.g = g;
  } else {
    S = Math.floor(Math.min((W - 24) / 6.6, (H * 0.58 - 40) / 6.3));
    S = clamp(S, 30, 80);
    sceneH = Math.round(Math.max(H * 0.4, H - (6.3 * S + 44)));
    const g = Math.round(S * 0.1);
    const rowW = 6 * S + 5 * g;
    const x0 = Math.round((W - rowW) / 2);
    let y = sceneH + Math.round(S * 0.42) + 6;
    LAY.gearLabel = { x: x0, y: y - 8 };
    SLOTS.forEach((k, i) => { LAY.gear[k] = { x: x0 + i * (S + g), y, w: S, h: S }; });
    y += S + Math.round(S * 0.55) + 6;
    LAY.bagLabel = { x: x0, y: y - 8 };
    for (let i = 0; i < MAXBAG; i++) LAY.bag[i] = { x: x0 + (i % BAG_COLS) * (S + g), y: y + Math.floor(i / BAG_COLS) * (S + g), w: S, h: S };
    LAY.bagRect = { x: x0, y, w: rowW, h: 3 * S + 2 * g };
    y += 3 * S + 2 * g + Math.round(S * 0.25);
    LAY.sell = { x: x0, y, w: rowW, h: Math.max(38, Math.round(S * 0.8)) };
    LAY.g = g;
  }
  LAY.S = S;
  LAY.scene = { x: 0, y: 0, w: W, h: sceneH };
  LAY.P = Math.max(2, Math.floor(sceneH / 66));
  LAY.gy = Math.round(sceneH * 0.82);
  LAY.hx = Math.round(Math.min(W * 0.26, W / 2 - 40));
  LAY.viewU = (W - LAY.hx) / LAY.P;
  LAY.fs = clamp(S * 0.29, 12, 18);
}

// ---------------------------------------------------------------- scene ----
function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function drawScene() {
  const sc = LAY.scene, P = LAY.P, gy = LAY.gy;
  const th = THEMES[(run ? run.floor : 0) % THEMES.length];
  const scroll = run ? run.scroll : game.t * 40;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, sc.w, sc.h);
  // back wall bricks (parallax 0.6)
  const bw = 16 * P, bh = 8 * P, off = scroll * 0.6 * P;
  const top = Math.round(sc.h * 0.06);
  const rows = Math.ceil((gy - top) / bh);
  for (let r = 0; r < rows; r++) {
    const y = gy - (r + 1) * bh;
    const shift = (r % 2) * bw / 2;
    const c0 = Math.floor((off - shift) / bw) - 1;
    for (let c = c0; c < c0 + Math.ceil(sc.w / bw) + 3; c++) {
      const x = Math.round(c * bw + shift - off);
      const hv = hash(c, r);
      ctx.fillStyle = hv < 0.5 ? th.wall : th.wall2;
      ctx.fillRect(x, y, bw - P, bh - P);
      if (hv > 0.9) { ctx.fillStyle = th.accent; ctx.globalAlpha = 0.35; ctx.fillRect(x, y + bh - 3 * P, bw - P, 2 * P); ctx.globalAlpha = 1; }
      else if (hv < 0.06) { ctx.fillStyle = th.mortar; ctx.fillRect(x + 4 * P, y + 2 * P, 2 * P, 3 * P); }
    }
  }
  // ceiling shadow
  const grd = ctx.createLinearGradient(0, 0, 0, sc.h * 0.45);
  grd.addColorStop(0, 'rgba(5,2,12,0.95)'); grd.addColorStop(1, 'rgba(5,2,12,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, sc.w, sc.h * 0.45);
  // torches
  const tg = 112 * P, toff = scroll * 0.6 * P;
  for (let c = Math.floor(toff / tg) - 1; c < Math.floor(toff / tg) + Math.ceil(sc.w / tg) + 2; c++) {
    const x = Math.round(c * tg - toff + tg * 0.5), y = gy - 30 * P;
    const fl = 0.85 + 0.15 * Math.sin(game.t * 13 + c * 7) + 0.08 * Math.sin(game.t * 31 + c);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 46 * P * fl);
    rg.addColorStop(0, hexA(th.glow, 0.34)); rg.addColorStop(1, hexA(th.glow, 0));
    ctx.fillStyle = rg; ctx.fillRect(x - 50 * P, y - 50 * P, 100 * P, 100 * P);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x - P, y, 2 * P, 6 * P);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 2 * P, y + P, 4 * P, P);
    ctx.fillStyle = th.glow; ctx.fillRect(x - P, y - 3 * P * fl, 2 * P, 3 * P * fl);
    ctx.fillStyle = '#fff3c4'; ctx.fillRect(x - P / 2, y - 2 * P * fl, P, 2 * P * fl);
  }
  // floor
  ctx.fillStyle = th.floor; ctx.fillRect(0, gy, sc.w, sc.h - gy);
  const fw = 24 * P, foff = scroll * P;
  for (let c = Math.floor(foff / fw) - 1; c < Math.floor(foff / fw) + Math.ceil(sc.w / fw) + 2; c++) {
    const x = Math.round(c * fw - foff);
    ctx.fillStyle = th.floor2;
    ctx.fillRect(x, gy + 4 * P, P, sc.h - gy);
    if (hash(c, 99) > 0.6) ctx.fillRect(x + 8 * P, gy + 9 * P, 6 * P, P);
  }
  ctx.fillStyle = shade(th.floor, 0.18); ctx.fillRect(0, gy, sc.w, P);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, gy + P, sc.w, 2 * P);
  // vignette at bottom of scene
  const vg = ctx.createLinearGradient(0, sc.h - 18, 0, sc.h);
  vg.addColorStop(0, 'rgba(11,7,20,0)'); vg.addColorStop(1, 'rgba(11,7,20,1)');
  ctx.fillStyle = vg; ctx.fillRect(0, sc.h - 18, sc.w, 18);
}

function drawSprite(img, x, y, scale, flip, alpha, sx, sy) {
  const w = img.width * scale * (sx || 1), h = img.height * scale * (sy || 1);
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  ctx.restore();
}

function drawHero(x, gy, P, opts) {
  opts = opts || {};
  const gear = opts.gear || (run ? run.gear : {});
  const moving = opts.moving != null ? opts.moving : (run && !run.fighting && !run.jackpot);
  const lt = opts.legT != null ? opts.legT : (run ? run.legT : game.t * 10);
  const frame = moving ? Math.floor(lt) % 4 : 0;
  const bob = moving && (frame === 1 || frame === 3) ? -P : 0;
  const eyes = opts.eyes != null ? opts.eyes : (run && run.eyes > 0);
  const hurt = run && run.hurtT > 0;
  const atk = run ? run.attackAnim : 0;
  const lean = atk > 0 ? 2 * P : 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 6 * P, gy - P, 12 * P, 2 * P);
  // loot sack on the back grows with the bag; turns red when it's about to burst
  const fill = opts.fill != null ? opts.fill : (run ? bagCount() / run.cap : 0.3);
  const sr = (3 + fill * 4) * P, sx = x - 7 * P + lean / 2, sy = gy - 9 * P + bob;
  const full = fill >= 1, pulse = full ? 0.5 + 0.5 * Math.sin(game.t * 18) : 0;
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(sx, sy - sr * 0.6, sr + P, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = full ? (pulse > 0.5 ? '#ff3b5c' : '#b8862b') : '#b8862b';
  ctx.beginPath(); ctx.arc(sx, sy - sr * 0.6, sr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx - sr * 0.5, sy - sr * 1.2, P * 2, P);
  // legs + body + helm
  const armorCol = gear.armor ? RAR[gear.armor.rarity].c : null;
  const bootCol = gear.boots ? RAR[gear.boots.rarity].c : null;
  drawSprite(heroLegs(frame, bootCol), x + lean, gy, P);
  const body = heroBody(armorCol, eyes, hurt);
  drawSprite(body, x + lean, gy - 4 * P + bob, P);
  if (gear.helm) drawSprite(helmSprite(RAR[gear.helm.rarity].c), x + lean, gy - 14 * P + bob, P);
  // weapon in hand, swinging when attacking
  const wp = gear.weapon;
  if (wp) {
    const ic = iconSprite(wp.icon, RAR[wp.rarity].c);
    const hxp = x + 5 * P + lean, hyp = gy - 6 * P + bob;
    const swing = atk > 0 ? (1 - atk / 0.14) : 0;
    const ang = atk > 0 ? lerp(-1.6, 0.9, ease(swing)) : -0.35 + Math.sin(lt * 0.6) * 0.06;
    ctx.save(); ctx.translate(hxp, hyp); ctx.rotate(ang);
    ctx.drawImage(ic, -2 * P, -10 * P, 12 * P, 12 * P);
    ctx.restore();
    if (atk > 0.05) {
      ctx.strokeStyle = hexA(RAR[wp.rarity].c, 0.7); ctx.lineWidth = 2 * P;
      ctx.beginPath(); ctx.arc(hxp, hyp, 12 * P, -1.3, 0.9 * ease(swing)); ctx.stroke();
    }
  } else if (atk > 0.05) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 9 * P, gy - 8 * P, 3 * P, 2 * P);
  }
}

function enemySprite(e) {
  if (e.type === 'taxman') return sprite(SPR.body, ENEMY_PAL.taxman, 'boss-tax');
  return sprite(SPR[e.type], ENEMY_PAL[e.type], 'en|' + e.type);
}
function drawEnemy(e) {
  const P = LAY.P, x = LAY.hx + e.dx * P - (e.lunge ? 4 * P : 0);
  let y = LAY.gy;
  if (e.fly) y -= (8 + Math.sin(e.bob) * 3) * P * (e.boss ? 1 : 1);
  const sq = e.type === 'slime' ? 1 + Math.sin(e.bob) * 0.08 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 6 * P * e.scale, LAY.gy - P, 12 * P * e.scale, 2 * P);
  const img = enemySprite(e);
  const flip = e.type === 'taxman';
  drawSprite(img, x, y, P * e.scale, flip, e.type === 'ghost' ? 0.8 : 1, 2 - sq, sq);
  if (e.type === 'taxman') {
    drawSprite(sprite(SPR.tophat, { o: OUT, k: '#1a1a2e', r: '#c46bff' }, 'tophat'), x - P * e.scale, y - 11 * P * e.scale, P * e.scale);
    drawSprite(sprite(SPR.legs[Math.floor(game.t * 6) % 4], Object.assign({}, ENEMY_PAL.taxman, { f: '#1a1a2e' }), 'taxlegs' + Math.floor(game.t * 6) % 4), x, y + 4 * P * e.scale, P * e.scale, true);
  }
  if (e.bid === 'mimicking') drawSprite(sprite(SPR.crown, { o: OUT, y: '#f2c14e', r: '#e0435f' }, 'crown'), x, y - 12 * P * e.scale, P * e.scale);
  if (e.hurt > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.hurt * 6;
    drawSprite(img, x, y, P * e.scale, flip, null, 2 - sq, sq);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // HP bar
  if (e.hp < e.maxHp && !e.boss) {
    const bw = 14 * P, bx = x - bw / 2, by = y - 18 * P * e.scale;
    ctx.fillStyle = OUT; ctx.fillRect(bx - 1, by - 1, bw + 2, P + 2);
    ctx.fillStyle = '#ff3b5c'; ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), P);
  }
}

function drawChest(c) {
  const P = LAY.P, x = LAY.hx + c.dx * P, y = LAY.gy - c.h * P;
  const it = c.item, col = c.st === 'spin' ? RAR[Math.floor(c.t * 30) % 5].c : (c.st === 'open' ? itemColor(it) : '#f2c14e');
  const s = chestSprites(col);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 7 * P, LAY.gy - P, 14 * P, 2 * P);
  if (c.st === 'open') {
    const a = Math.max(0, 1 - c.t / 1.2);
    if (a > 0) {
      // rarity light beam
      const bwid = (it.rarity >= 3 ? 16 : 10) * P;
      const g = ctx.createLinearGradient(0, y - 80 * P, 0, y);
      g.addColorStop(0, hexA(col, 0)); g.addColorStop(1, hexA(col, 0.55 * a));
      ctx.fillStyle = g; ctx.fillRect(x - bwid / 2, y - 80 * P, bwid, 80 * P - 4 * P);
    }
    drawSprite(s.base, x, y, P);
    ctx.save(); ctx.translate(x - 6 * P, y - 6 * P); ctx.rotate(-0.9);
    ctx.drawImage(s.lid, -P, -4 * P, 14 * P, 4 * P); ctx.restore();
  } else {
    const shake = c.st === 'spin' ? Math.sin(c.t * 80) * P : 0;
    drawSprite(s.base, x + shake, y, P);
    drawSprite(s.lid, x + shake, y - 6 * P, P);
  }
}

function drawItemIcon(it, x, y, size, alpha) {
  const ic = iconSprite(it.icon, it.kind === 'gear' ? RAR[it.rarity].c : null, it.kind === 'potion' ? it.col : null);
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ic, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
  ctx.restore();
}

function drawWorld() {
  const sc = LAY.scene, P = LAY.P;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, sc.w, sc.h); ctx.clip();
  let sh = 0;
  if (run && run.shake > 0) sh = run.shake * 8;
  ctx.translate(rr(-sh, sh), rr(-sh, sh));
  drawScene();
  if (!run) { ctx.restore(); return; }
  for (const c of run.chests) drawChest(c);
  for (let i = run.enemies.length - 1; i >= 0; i--) drawEnemy(run.enemies[i]);
  if (!(run.dead && run.exploded)) drawHero(LAY.hx, LAY.gy, P);
  // death-stare beams
  for (const b of run.beams) {
    ctx.strokeStyle = hexA('#ff3b5c', 1 - b.t / 0.25); ctx.lineWidth = 2 * P;
    ctx.beginPath(); ctx.moveTo(LAY.hx + 3 * P, LAY.gy - 12 * P); ctx.lineTo(LAY.hx + b.dx * P, LAY.gy - b.h * P); ctx.stroke();
  }
  // thrown bombs
  for (const s2 of run.shots) {
    const t = s2.t / s2.dur, x = LAY.hx + lerp(s2.x0, s2.x1, t) * P, y = LAY.gy - (s2.h0 + Math.sin(t * Math.PI) * 26) * P;
    drawItemIcon({ icon: 'bomb', kind: 'bomb' }, x, y, 10 * P);
  }
  // damage numbers
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of run.nums) {
    if (n.screen) continue;
    const t = n.t / 0.9, x = LAY.hx + n.dx * P, y = LAY.gy - n.h * P - ease(Math.min(1, t * 1.6)) * 26;
    const sz = Math.round(LAY.fs * (0.9 + 0.35 * n.size) * (t < 0.12 ? 1 + (0.12 - t) * 4 : 1));
    ctx.font = f(sz, true);
    ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
    ctx.fillStyle = OUT; ctx.fillText(n.text, x + 2, y + 2);
    ctx.fillStyle = n.col; ctx.fillText(n.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFx() {
  for (const p of run.fx) {
    const a = clamp(p.life / (p.max * 0.5), 0, 1);
    if (p.coin) {
      drawSprite(sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin'), p.x, p.y + 3 * 2, 2, false, a);
    } else if (p.icon) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      drawItemIcon(p.icon, 0, 0, p.size, a); ctx.restore();
    } else {
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), Math.ceil(p.size), Math.ceil(p.size));
    }
  }
  ctx.globalAlpha = 1;
  for (const n of run.nums) {
    if (!n.screen) continue;
    const t = n.t / 0.9;
    ctx.font = f(LAY.fs * 1.1, true); ctx.textAlign = 'center';
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = OUT; ctx.fillText(n.text, n.x + 2, n.y - t * 30 + 2);
    ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y - t * 30);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ text ---
function txt(s, x, y, size, col, align, bold, title) {
  ctx.font = title ? tf(size) : f(size, bold);
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = OUT; ctx.fillText(s, x + Math.max(1, size / 10), y + Math.max(1, size / 10));
  ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size, bold) {
  ctx.font = f(size, bold);
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function panel(x, y, w, h, fill, stroke, lw) {
  ctx.fillStyle = fill || 'rgba(20,12,36,0.94)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke || '#4a3a6a'; ctx.lineWidth = lw || 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

// ------------------------------------------------------------------- HUD ---
function drawHUD() {
  const fs = LAY.fs, s = run.stats, pad = 12;
  // HP bar
  ctx.font = tf(fs * 1.55);
  const depthW = ctx.measureText(Math.floor(run.depth) + ' m').width;
  const bw = Math.max(110, Math.min(LAY.scene.w * 0.32, 300, W - pad * 2 - (fs * 2.1 * 2 + 6) - depthW - 30)), bh = Math.round(fs * 1.35);
  const x = pad, y = pad;
  const hpF = clamp(run.hp / s.maxHp, 0, 1);
  panel(x, y, bw, bh, '#1a0f2a', OUT, 2);
  const low = hpF < 0.3;
  ctx.fillStyle = low && Math.sin(game.t * 14) > 0 ? '#ff7a8f' : '#e0435f';
  ctx.fillRect(x + 3, y + 3, (bw - 6) * hpF, bh - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 3, y + 3, (bw - 6) * hpF, 3);
  txt(fmt(Math.max(0, run.hp)) + ' / ' + fmt(s.maxHp), x + bw / 2, y + bh / 2 + 1, fs * 0.9, '#fff', 'center', true);
  // stat line
  const sl = 'DMG ' + fmt(effDmg()) + '   SPD ' + effAps().toFixed(1) + '/s   DPS ' + fmt(dps());
  txt(sl, x, y + bh + fs * 0.85, fs * 0.85, '#d9cff5', 'left');
  // buffs
  let bx = x;
  const by = y + bh + fs * 2;
  for (const b of run.buffs) {
    const lab = { rage: 'RAGE', haste: 'ZOOM', greed: 'GREED', confuse: 'BLINKY' }[b.id];
    const col = { rage: '#ff8c1a', haste: '#4ee0ff', greed: '#f2c14e', confuse: '#b45cff' }[b.id];
    ctx.font = f(fs * 0.8, true);
    const w = ctx.measureText(lab).width + 26;
    panel(bx, by - fs * 0.6, w, fs * 1.2, hexA(col, 0.25), col, 1);
    txt(lab + ' ' + Math.ceil(b.t), bx + w / 2, by, fs * 0.8, col, 'center', true);
    bx += w + 6;
  }
  // top-right: depth, gold, buttons
  const bs = Math.round(fs * 2.1);
  LAY.pauseBtn = { x: W - pad - bs, y: pad, w: bs, h: bs };
  LAY.muteBtn = { x: W - pad - bs * 2 - 6, y: pad, w: bs, h: bs };
  iconButton(LAY.pauseBtn, 'pause');
  iconButton(LAY.muteBtn, save.muted ? 'muted' : 'sound');
  const rx = LAY.muteBtn.x - 14;
  txt(Math.floor(run.depth) + ' m', rx, pad + fs * 0.9, fs * 1.55, '#ffffff', 'right', false, true);
  txt('BEST ' + Math.max(save.best, Math.floor(run.depth)) + ' m', rx, pad + fs * 2.45, fs * 0.8, '#a99fc4', 'right', true);
  const gp = 1 + (LAY.goldPulse || 0) * 1.5;
  txt(fmt(run.gold), rx - 4, pad + fs * 3.7, fs * 1.1 * gp, '#f2c14e', 'right', true);
  ctx.font = f(fs * 1.1 * gp, true);
  const gw = ctx.measureText(fmt(run.gold)).width;
  drawSprite(sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin'), rx - gw - 16, pad + fs * 3.7 + 7, 2.4);
  LAY.goldPos = { x: rx - gw - 16, y: pad + fs * 3.7 };
  // boss bar
  if (run.boss) {
    const e = run.boss, w = Math.min(LAY.scene.w * 0.5, 420), bx2 = (LAY.scene.w - w) / 2, by2 = LAY.scene.h * 0.18;
    txt(e.name, LAY.scene.w / 2, by2 - fs * 0.9, fs * 0.95, '#ff9a1f', 'center', false, true);
    panel(bx2, by2, w, fs * 0.9, '#1a0f2a', OUT, 2);
    ctx.fillStyle = '#ff9a1f'; ctx.fillRect(bx2 + 3, by2 + 3, (w - 6) * clamp(e.hp / e.maxHp, 0, 1), fs * 0.9 - 6);
  }
  // banner
  if (run.banner) {
    const b = run.banner, a = b.t < 0.3 ? b.t / 0.3 : b.t > 2.4 ? (3 - b.t) / 0.6 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const y2 = LAY.scene.h * 0.36;
    ctx.fillStyle = 'rgba(8,4,16,0.6)'; ctx.fillRect(0, y2 - fs * 1.6, W, fs * 3.4);
    txt(b.title, W / 2, y2 - fs * 0.35, Math.min(fs * 1.35, W / (b.title.length * 1.15)), '#ffe08a', 'center', false, true);
    txt(b.sub, W / 2, y2 + fs * 1.05, fs * 0.95, '#d9cff5', 'center', true);
    ctx.globalAlpha = 1;
  }
  // toasts
  let ty = run.jackpot ? LAY.scene.h * 0.24 + Math.min(W * 0.7, 360) * 0.42 + LAY.fs * 1.6 : LAY.scene.h * (run.banner ? 0.56 : 0.46);
  for (const t of run.toasts) {
    const a = t.t < 0.12 ? t.t / 0.12 : t.t > t.dur - 0.3 ? (t.dur - t.t) / 0.3 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const sz = Math.min(fs * 1.15, (W - 30) / (t.text.length * 0.55));
    txt(t.text, W / 2, ty - (1 - Math.min(1, t.t * 6)) * 8, sz, t.col, 'center', true);
    ty += sz * 1.45;
  }
  ctx.globalAlpha = 1;
  // jackpot reels
  if (run.jackpot) drawJackpot();
}
function iconButton(r, kind) {
  const hov = inRect(ptr.x, ptr.y, r) && !ptr.touch;
  panel(r.x, r.y, r.w, r.h, hov ? '#3a2a5a' : 'rgba(26,15,42,0.85)', '#5a4a7a', 2);
  ctx.fillStyle = '#e8e0ff';
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, u = r.w / 10;
  if (kind === 'pause') { ctx.fillRect(cx - 2.5 * u, cy - 3 * u, 1.8 * u, 6 * u); ctx.fillRect(cx + 0.7 * u, cy - 3 * u, 1.8 * u, 6 * u); }
  else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(cx - 2 * u, cy - 3 * u); ctx.lineTo(cx + 3 * u, cy); ctx.lineTo(cx - 2 * u, cy + 3 * u); ctx.fill(); }
  else {
    ctx.fillRect(cx - 3.5 * u, cy - 1.2 * u, 2 * u, 2.4 * u);
    ctx.beginPath(); ctx.moveTo(cx - 1.5 * u, cy - 1.2 * u); ctx.lineTo(cx + 1 * u, cy - 3.4 * u); ctx.lineTo(cx + 1 * u, cy + 3.4 * u); ctx.lineTo(cx - 1.5 * u, cy + 1.2 * u); ctx.fill();
    ctx.strokeStyle = kind === 'muted' ? '#ff5a76' : '#e8e0ff'; ctx.lineWidth = Math.max(2, u * 0.7);
    if (kind === 'muted') { ctx.beginPath(); ctx.moveTo(cx + 2 * u, cy - 2 * u); ctx.lineTo(cx + 4.4 * u, cy + 2 * u); ctx.moveTo(cx + 4.4 * u, cy - 2 * u); ctx.lineTo(cx + 2 * u, cy + 2 * u); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(cx + 1.3 * u, cy, 2.6 * u, -0.8, 0.8); ctx.stroke(); }
  }
}
function drawJackpot() {
  const j = run.jackpot, fs = LAY.fs;
  const cw = Math.min(W * 0.7, 360), ch = cw * 0.42, x = (LAY.scene.w - cw) / 2, y = LAY.scene.h * 0.24;
  const a = j.t > 2.8 ? clamp((3.2 - j.t) / 0.4, 0, 1) : clamp(j.t / 0.2, 0, 1);
  ctx.globalAlpha = a;
  panel(x - 6, y - 6, cw + 12, ch + 12, '#f2c14e', OUT, 3);
  panel(x, y, cw, ch, '#2a0d3a', '#ff4fd8', 3);
  txt(j.t > 2.0 ? (j.match === 3 ? 'MEGA JACKPOT!' : j.match === 2 ? 'JACKPOT!' : 'SO CLOSE!') : 'BOSS JACKPOT', x + cw / 2, y - fs * 1.2, fs * 1.1, '#ffe08a', 'center', false, true);
  const rw = (cw - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const rx = x + 10 + i * (rw + 10), ry = y + 10, rh = ch - 20;
    ctx.fillStyle = '#fff7e6'; ctx.fillRect(rx, ry, rw, rh);
    const stopT = 0.8 + i * 0.5;
    const sym = j.t < stopT ? REEL_SYMS[Math.floor(j.t * 22 + i * 3) % REEL_SYMS.length] : j.res[i];
    const it = sym === 'potion' ? { icon: 'potion', kind: 'potion', col: '#ff4f6d' } : sym === 'bomb' ? { icon: 'bomb', kind: 'bomb' } : { icon: sym, kind: 'gear', rarity: R_LEG };
    const off = j.t < stopT ? (j.t * 900) % rh - rh / 2 : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    drawItemIcon(it, rx + rw / 2, ry + rh / 2 + off * 0.2, Math.min(rw, rh) * 0.8);
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(rx, ry, rw, rh);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------- inventory ---
function slotBox(r, col, glow, hot) {
  ctx.fillStyle = hot ? '#3a2a5a' : '#1c1230'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(r.x, r.y, r.w, 3);
  if (glow) {
    const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 2, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.7);
    g.addColorStop(0, hexA(col, 0.35)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = col || '#3d2f5c'; ctx.lineWidth = glow ? 3 : 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}
function drawInventory() {
  const S = LAY.S, fs = LAY.fs;
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, LAY.scene.h, W, H - LAY.scene.h);
  ctx.fillStyle = '#2a1d45'; ctx.fillRect(0, LAY.scene.h, W, 3);
  const drag = game.drag && game.drag.moved ? game.drag : null;
  const dragIt = drag ? getItem(drag.src) : null;
  const selIt = game.sel ? getItem(game.sel) : null;
  const active = dragIt || selIt;
  // GEAR
  txt('GEAR', LAY.gearLabel.x, LAY.gearLabel.y - fs * 0.3, fs * 0.8, '#a99fc4', 'left', false, true);
  for (const k of SLOTS) {
    const r = LAY.gear[k], it = run.gear[k];
    const can = active && active.kind === 'gear' && active.slot === k && !(drag && drag.src.k === 'gear');
    const hot = (drag && inRect(ptr.x, ptr.y, r)) || (game.hover && game.hover.k === 'gear' && game.hover.s === k);
    slotBox(r, can ? '#ffe08a' : it ? RAR[it.rarity].c : '#3d2f5c', can || (it && it.rarity >= 3), hot);
    if (it && !(drag && drag.src.k === 'gear' && drag.src.s === k)) {
      drawItemIcon(it, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.78);
      if (isBound(it)) { ctx.fillStyle = 'rgba(255,59,92,0.25)'; ctx.fillRect(r.x, r.y, r.w, r.h); txt(Math.ceil(it.boundUntil - run.t) + 's', r.x + r.w - 4, r.y + r.h - fs * 0.6, fs * 0.8, '#ff5a76', 'right', true); }
    } else if (!it) {
      drawItemIcon({ icon: SLOT_ICON[k], kind: 'gear', rarity: 0 }, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6, 0.18);
    }
    if (game.sel && game.sel.k === 'gear' && game.sel.s === k) selRing(r);
  }
  // BAG
  const n = bagCount(), full = n >= run.cap;
  const ci = chestInterval(), ct = run.jackpot ? ci : Math.max(0, run.chestT);
  const danger = full && !run.dead;
  txt('BAG ' + n + '/' + run.cap, LAY.bagLabel.x, LAY.bagLabel.y - fs * 0.3, fs * 0.8, danger ? '#ff5a76' : '#a99fc4', 'left', false, true);
  // next-chest timer
  ctx.font = tf(fs * 0.8); const lw = ctx.measureText('BAG ' + n + '/' + run.cap).width;
  const tx = LAY.bagLabel.x + lw + 16, ty = LAY.bagLabel.y - fs * 0.3;
  const cs = chestSprites('#f2c14e');
  drawSprite(cs.base, tx + 10, ty + 6, 1.4); drawSprite(cs.lid, tx + 10, ty - 2.4, 1.4);
  ctx.strokeStyle = danger ? '#ff3b5c' : '#f2c14e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(tx + 10, ty, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ct / ci)); ctx.stroke();
  txt(danger ? 'FULL! next loot in ' + ct.toFixed(1) + 's' : 'next loot ' + ct.toFixed(1) + 's', tx + 32, ty, fs * 0.85, danger ? (Math.sin(game.t * 16) > 0 ? '#ff3b5c' : '#ffe08a') : '#d9cff5', 'left', true);
  for (let i = 0; i < Math.min(MAXBAG, Math.ceil(Math.max(run.cap, 6) / BAG_COLS) * BAG_COLS); i++) {
    const r = LAY.bag[i];
    if (i >= run.cap) { ctx.fillStyle = 'rgba(28,18,48,0.35)'; ctx.fillRect(r.x, r.y, r.w, r.h); continue; }
    const it = run.bag[i];
    const hot = (drag && inRect(ptr.x, ptr.y, r)) || (game.hover && game.hover.k === 'bag' && game.hover.i === i);
    const pulse = danger ? 0.5 + 0.5 * Math.sin(game.t * 12) : 0;
    slotBox(r, danger ? (pulse > 0.5 ? '#ff3b5c' : '#7a1f33') : it ? itemColor(it) : '#3d2f5c', it && (it.rarity >= 3 || it.kind === 'bomb'), hot);
    if (it && !(drag && drag.src.k === 'bag' && drag.src.i === i)) {
      let jx = 0;
      if (it.kind === 'bomb' && it.fuse < 4) jx = Math.sin(game.t * 50) * 2;
      drawItemIcon(it, r.x + r.w / 2 + jx, r.y + r.h / 2, r.w * 0.78);
      if (it.kind === 'bomb') txt(Math.ceil(it.fuse) + '', r.x + r.w - 5, r.y + fs * 0.7, fs * 0.95, it.fuse < 4 ? '#ff3b5c' : '#ffe08a', 'right', true);
      if (it.kind === 'gear') {
        const pv = previewEquip(it);
        if (pv && pv.dps > 0.05 && it.slot === 'weapon') arrowUp(r);
        else if (pv && !run.gear[it.slot]) arrowUp(r);
        if (it.rarity === R_CUR) txt('☠', r.x + 5, r.y + fs * 0.7, fs * 0.9, '#ff5a76', 'left', true);
      }
    }
    if (game.sel && game.sel.k === 'bag' && game.sel.i === i) selRing(r);
  }
  // SELL bin (on phones it hugs the last visible bag row)
  if (LAY.portrait) {
    const last = LAY.bag[Math.ceil(Math.max(run.cap, 6) / BAG_COLS) * BAG_COLS - 1];
    LAY.sell.y = last.y + last.h + Math.round(S * 0.3);
  }
  const sr = LAY.sell;
  const hotSell = (drag && inRect(ptr.x, ptr.y, sr)) || (selIt && inRect(ptr.x, ptr.y, sr));
  panel(sr.x, sr.y, sr.w, sr.h, hotSell ? '#4a3510' : '#24180c', active ? '#f2c14e' : '#6b5420', active ? 3 : 2);
  const coin = sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin');
  if (LAY.portrait) {
    drawSprite(coin, sr.x + sr.w / 2 - fs * 2.4, sr.y + sr.h / 2 + 8, 2.6);
    txt('SELL', sr.x + sr.w / 2 + fs * 0.6, sr.y + sr.h / 2, fs * 1.0, '#f2c14e', 'center', false, true);
  } else {
    drawSprite(coin, sr.x + sr.w / 2, sr.y + sr.h * 0.42 + 8, Math.max(2.4, LAY.S / 16));
    txt('SELL', sr.x + sr.w / 2, sr.y + sr.h * 0.66, fs * 0.9, '#f2c14e', 'center', false, true);
    if (active) txt('+' + fmt(sellValue(active, run)) + 'g', sr.x + sr.w / 2, sr.y + sr.h * 0.84, fs * 0.9, '#ffe08a', 'center', true);
  }
  // hint
  if (run.hint && !drag) drawHint(run.hint);
  // dragged item follows the pointer
  if (dragIt) {
    drawItemIcon(dragIt, ptr.x, ptr.y - (ptr.touch ? S * 0.6 : 0), S * 0.95);
    if (inRect(ptr.x, ptr.y, LAY.scene)) {
      const lab = dragIt.kind === 'potion' ? 'DRINK' : dragIt.kind === 'bomb' ? 'THROW!' : dragIt.kind === 'gear' ? 'EQUIP' : '';
      if (lab) txt(lab, ptr.x, ptr.y - S * (ptr.touch ? 1.3 : 0.75), fs * 1.1, '#ffe08a', 'center', true);
    }
  }
}
function arrowUp(r) {
  const s = Math.max(4, r.w / 10), x = r.x + r.w - s * 1.8, y = r.y + r.h - s * 1.6;
  const bob = Math.sin(game.t * 6) * 1.5;
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - s - 1, y + bob + 1); ctx.lineTo(x, y - s * 1.2 + bob - 1); ctx.lineTo(x + s + 1, y + bob + 1); ctx.fill();
  ctx.fillStyle = '#5fd35f'; ctx.beginPath(); ctx.moveTo(x - s, y + bob); ctx.lineTo(x, y - s * 1.1 + bob); ctx.lineTo(x + s, y + bob); ctx.fill();
}
function selRing(r) {
  const p = 2 + Math.sin(game.t * 8) * 2;
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3;
  ctx.strokeRect(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p);
}
function drawHint(h) {
  const r = h.ref.k === 'bag' ? LAY.bag[h.ref.i] : LAY.gear[h.ref.s];
  if (!r) return;
  const fs = LAY.fs, w = Math.min(W - 24, 300);
  const lines = wrap(h.text, w - 20, fs * 0.95, true);
  const hh = lines.length * fs * 1.25 + 16;
  let x = clamp(r.x + r.w / 2 - w / 2, 12, W - w - 12), y = r.y - hh - 18 - Math.abs(Math.sin(game.t * 4)) * 6;
  if (y < LAY.scene.h * 0.25) y = r.y + r.h + 14;
  panel(x, y, w, hh, '#ffe08a', OUT, 3);
  lines.forEach((l, i) => { ctx.font = f(fs * 0.95, true); ctx.textAlign = 'left'; ctx.fillStyle = '#2a1640'; ctx.fillText(l, x + 10, y + 10 + fs * 0.6 + i * fs * 1.25); });
  ctx.fillStyle = '#ffe08a'; ctx.beginPath();
  const ax = r.x + r.w / 2;
  if (y < r.y) { ctx.moveTo(ax - 8, y + hh - 2); ctx.lineTo(ax + 8, y + hh - 2); ctx.lineTo(ax, y + hh + 12); }
  else { ctx.moveTo(ax - 8, y + 2); ctx.lineTo(ax + 8, y + 2); ctx.lineTo(ax, y - 12); }
  ctx.fill();
}

// ------------------------------------------------------------- tooltip -----
function drawTooltip(ref, anchor) {
  const it = getItem(ref); if (!it) return;
  const fs = LAY.fs, w = Math.min(W - 16, Math.max(250, fs * 20));
  const col = itemColor(it);
  const rows = [];
  const kindName = it.kind === 'gear' ? RAR[it.rarity].name + ' ' + SLOT_NAME[it.slot] : it.kind === 'potion' ? 'Potion' : it.kind === 'bomb' ? 'Bomb' : 'Junk';
  rows.push({ t: it.name, c: col, size: 1.1, bold: true });
  rows.push({ t: kindName + (it.kind === 'gear' ? ' · Lv ' + it.level : ''), c: '#a99fc4', size: 0.85 });
  for (const l of itemLines(it)) rows.push({ t: l.t, c: l.c, size: l.big ? 1.0 : 0.92, bold: l.big });
  if (it.kind === 'gear' && ref.k === 'bag') {
    const pv = previewEquip(it);
    if (pv) {
      const cmp = run.gear[it.slot] ? 'vs. equipped ' + SLOT_NAME[it.slot].toLowerCase() : 'Empty slot: equip it!';
      rows.push({ t: cmp, c: '#a99fc4', size: 0.85, gap: true });
      rows.push({ t: 'DPS ' + (pv.dps >= 0 ? '▲ +' : '▼ ') + Math.round(pv.dps * 100) + '%    HP ' + (pv.hp >= 0 ? '▲ +' : '▼ ') + Math.round(pv.hp * 100) + '%', c: pv.dps >= 0 ? '#5fd35f' : '#ff5a76', size: 1.0, bold: true, split: pv });
      if (pv.burst) rows.push({ t: '⚠ YOUR BAG WILL SHRINK AND BURST!', c: '#ff3b5c', size: 1.0, bold: true });
      else if (pv.cap < 0) rows.push({ t: '⚠ Bag shrinks by ' + (-pv.cap), c: '#ff9a1f', size: 0.92, bold: true });
      if (isBound(run.gear[it.slot])) rows.push({ t: '⚠ Your current ' + SLOT_NAME[it.slot] + ' is BOUND', c: '#ff5a76', size: 0.92 });
    }
  } else if (it.kind === 'gear' && ref.k === 'gear') {
    const cur = run.gear[it.slot];
    const g2 = Object.assign({}, run.gear); g2[it.slot] = null;
    const cap2 = clamp(6 + save.up.bag + computeStats(g2).bagBonus, 2, MAXBAG);
    if (cap2 < run.cap) rows.push({ t: '⚠ Removing this shrinks your bag by ' + (run.cap - cap2) + '!', c: '#ff3b5c', size: 0.95, bold: true, gap: true });
    if (isBound(cur)) rows.push({ t: 'BOUND for ' + Math.ceil(cur.boundUntil - run.t) + 's', c: '#ff5a76', size: 0.95, bold: true });
  }
  rows.push({ t: 'Sells for ' + fmt(sellValue(it, run)) + 'g', c: '#f2c14e', size: 0.85, gap: true });
  // layout
  const lines = [];
  for (const r of rows) {
    const sz = fs * r.size;
    const parts = r.split ? [r.t] : wrap(r.t, w - 24, sz, r.bold);
    parts.forEach((p, i) => lines.push({ t: p, c: r.c, sz, bold: r.bold, gap: i === 0 && r.gap, split: r.split }));
  }
  let h = 14;
  for (const l of lines) h += l.sz * 1.28 + (l.gap ? 6 : 0);
  h += 6;
  let x = clamp(anchor.x + anchor.w / 2 - w / 2, 8, W - w - 8);
  let y = anchor.y - h - 10;
  if (y < 8) y = Math.min(H - h - 8, anchor.y + anchor.h + 10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 4, y + 4, w, h);
  panel(x, y, w, h, '#160d26', col, 3);
  ctx.fillStyle = hexA(col, 0.18); ctx.fillRect(x + 3, y + 3, w - 6, fs * 1.6);
  let cy = y + 10;
  for (const l of lines) {
    if (l.gap) { cy += 6; ctx.fillStyle = '#33264f'; ctx.fillRect(x + 10, cy - 4, w - 20, 1); }
    cy += l.sz * 0.64;
    if (l.split) {
      const pv = l.split;
      txt('DPS ' + (pv.dps >= 0 ? '▲ +' : '▼ ') + fmt(Math.round(pv.dps * 100)) + '%', x + 12, cy, l.sz, pv.dps >= -0.005 ? '#5fd35f' : '#ff5a76', 'left', true);
      txt('HP ' + (pv.hp >= 0 ? '▲ +' : '▼ ') + fmt(Math.round(pv.hp * 100)) + '%', x + w / 2 + 10, cy, l.sz, pv.hp >= -0.005 ? '#5fd35f' : '#ff5a76', 'left', true);
    } else txt(l.t, x + 12, cy, l.sz, l.c, 'left', l.bold);
    cy += l.sz * 0.64;
  }
}
// ---------------------------------------------------------------------------
// Screens, buttons, input, main loop.
// ---------------------------------------------------------------------------
const ptr = { x: -1, y: -1, touch: false, down: false };
let BTN = [];

const UPG = [
  { k: 'bag', name: 'Bigger Sack', desc: '+1 bag slot, every run', max: 4, cost: l => [150, 600, 2000, 6500][l] },
  { k: 'luck', name: 'Lucky Snout', desc: '+8% chest luck (better rarities)', max: 5, cost: l => Math.round(110 * Math.pow(2.3, l)) },
  { k: 'hp', name: 'Thick Skin', desc: '+15% Max HP', max: 5, cost: l => Math.round(80 * Math.pow(2.2, l)) },
  { k: 'dmg', name: 'Sharp Claws', desc: '+15% Damage', max: 5, cost: l => Math.round(80 * Math.pow(2.2, l)) },
  { k: 'sell', name: 'Haggler', desc: '+20% gold from selling', max: 5, cost: l => Math.round(100 * Math.pow(2.1, l)) },
  { k: 'insure', name: 'Overflow Insurance', desc: 'Survive your first overflow each run', max: 1, cost: () => 3000 },
];

function button(r, label, fn, opts) {
  opts = opts || {};
  const hov = inRect(ptr.x, ptr.y, r) && !ptr.touch;
  const dis = opts.disabled;
  const col = opts.col || '#f2c14e';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(r.x + 4, r.y + 5, r.w, r.h);
  panel(r.x, r.y, r.w, r.h, dis ? '#2a2238' : hov ? shade(col, 0.2) : col, OUT, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, 3);
  txt(label, r.x + r.w / 2, r.y + r.h / 2 + 1, opts.size || LAY.fs * 1.0, dis ? '#7a6f92' : '#2a1640', 'center', false, true);
  if (!dis) BTN.push({ r, fn });
}

// ---------------------------------------------------------------- title ----
function drawTitle() {
  drawWorld();
  const P = LAY.P;
  drawHero(LAY.hx, LAY.gy, P, { gear: demoGear, moving: true, legT: game.t * 10, eyes: (game.t % 2.7) < 0.15, fill: 0.5 + 0.5 * Math.sin(game.t) });
  // falling demo chests
  const ph = (game.t % 3) / 3;
  const cx = LAY.hx + (30 - ph * 30) * P, cy = LAY.gy - Math.max(0, 1 - ph * 3) * 60 * P;
  const cs = chestSprites(RAR[Math.floor(game.t / 3) % 6].c);
  drawSprite(cs.base, cx, cy, P); drawSprite(cs.lid, cx, cy - 6 * P, P);
  ctx.fillStyle = 'rgba(8,4,16,0.55)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, LAY.scene.h, W, H - LAY.scene.h);
  const fs = LAY.fs, cx2 = W / 2;
  const ts = Math.min(W / 13, H / 11, 54);
  const wob = Math.sin(game.t * 2) * 3;
  txt('INFINITE', cx2, H * 0.12 + wob, ts * 0.62, '#ffe08a', 'center', false, true);
  txt('LOOT GOBLIN', cx2, H * 0.12 + ts * 1.05 + wob, ts, '#ff9a1f', 'center', false, true);
  txt('ONE-BUTTON DUNGEON', cx2, H * 0.12 + ts * 1.95, ts * 0.36, '#c46bff', 'center', false, true);
  const lines = ['Your goblin runs and fights on his own.', 'YOU manage the loot. A chest drops every 3 seconds.', 'If your bag overflows... you explode.'];
  lines.forEach((l, i) => txt(l, cx2, H * 0.12 + ts * 2.7 + i * fs * 1.45, fs * 1.0, i === 2 ? '#ff5a76' : '#e8e0ff', 'center', true));
  const bw = Math.min(300, W - 40), bh = Math.round(fs * 2.9);
  let y = Math.max(LAY.scene.h + 10, H * 0.12 + ts * 2.7 + fs * 5.2);
  button({ x: cx2 - bw / 2, y, w: bw, h: bh }, save.runs ? 'RUN AGAIN' : 'PLAY', () => { AU.sfx('click'); newRun(); }, { size: fs * 1.3 });
  y += bh + 12;
  const hw = (bw - 10) / 2;
  button({ x: cx2 - bw / 2, y, w: hw, h: bh * 0.8 }, 'BANK', () => { AU.sfx('click'); game.state = 'bank'; }, { col: '#c46bff', size: fs * 0.9 });
  button({ x: cx2 - bw / 2 + hw + 10, y, w: hw, h: bh * 0.8 }, 'HOW TO', () => { AU.sfx('click'); game.state = 'help'; }, { col: '#4ea8ff', size: fs * 0.9 });
  y += bh * 0.8 + 18;
  const info = 'Best ' + save.best + ' m  ·  Gold ' + fmt(save.gold) + (save.bestItem ? '  ·  Best find: ' + save.bestItem.n : '');
  const isz = Math.min(fs * 0.9, (W - 20) / (info.length * 0.52));
  txt(info, cx2, Math.min(H - 16, y + 8), isz, save.bestItem ? RAR[save.bestItem.r].c : '#a99fc4', 'center', true);
  muteCorner();
}
const demoGear = {
  weapon: { icon: 'dagger', rarity: R_LEG }, helm: { rarity: 3 }, armor: { rarity: 4 }, boots: { rarity: 2 },
};
function muteCorner() {
  const bs = Math.round(LAY.fs * 2.1);
  LAY.muteBtn = { x: W - 12 - bs, y: 12, w: bs, h: bs };
  iconButton(LAY.muteBtn, save.muted ? 'muted' : 'sound');
  BTN.push({ r: LAY.muteBtn, fn: () => AU.setMuted(!save.muted) });
}

// ----------------------------------------------------------------- help ----
function drawHelp() {
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs, w = Math.min(W - 24, 640), x = (W - w) / 2;
  let y = 30;
  txt('HOW TO PLAY', W / 2, y, Math.min(fs * 1.6, W / 14), '#ffe08a', 'center', false, true);
  y += fs * 2.4;
  const tips = [
    ['#e8e0ff', 'Your goblin charges forward and fights by himself. You never control him.'],
    ['#f2c14e', 'A chest drops every 3 seconds. The loot flies straight into your BAG.'],
    ['#ff5a76', 'If loot arrives and your bag is full, you EXPLODE. Watch the timer.'],
    ['#5fd35f', 'Drag gear onto the matching GEAR slot to equip it (or drop it on the goblin, or double-tap it). A green arrow means it is better.'],
    ['#f2c14e', 'Drag anything to SELL for gold. Right-click (or hover + S) also sells. Gold buys permanent upgrades in the BANK.'],
    ['#4ee0ff', 'Potions and bombs: drag them onto the dungeon. Bombs explode in your bag if you wait too long.'],
    ['#ff9a1f', 'Legendaries break the game. Read them: some make you lose HP every time you BLINK.'],
    ['#ff3b5c', 'Cursed items are huge, and they bite back. Some shrink your bag. A shrinking bag can burst.'],
    ['#c46bff', 'A boss waits every 250 m. Beat it to spin the JACKPOT.'],
  ];
  for (const [c, t] of tips) {
    const lines = wrap(t, w - 30, fs * 0.98, true);
    ctx.fillStyle = c; ctx.fillRect(x, y - fs * 0.45, 8, 8);
    lines.forEach((l, i) => txt(l, x + 18, y + i * fs * 1.3, fs * 0.98, c === '#e8e0ff' ? c : shade(c, 0.35), 'left', true));
    y += lines.length * fs * 1.3 + fs * 0.6;
  }
  txt('Desktop: hover an item and press E to equip/use, S to sell. Esc pauses, M mutes.', W / 2, y + fs * 0.4, Math.min(fs * 0.85, (W - 20) / 48), '#a99fc4', 'center', true);
  const bw = Math.min(260, W - 40);
  button({ x: W / 2 - bw / 2, y: Math.min(H - fs * 3.6, y + fs * 1.8), w: bw, h: fs * 2.6 }, 'GOT IT', () => {
    AU.sfx('click');
    if (game.wasPlaying && run && !run.dead) { game.state = 'play'; game.paused = true; } else game.state = 'title';
    game.wasPlaying = false;
  });
}

// ----------------------------------------------------------------- bank ----
function drawBank() {
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs;
  txt('THE GOBLIN BANK', W / 2, 32, Math.min(fs * 1.5, W / 16), '#c46bff', 'center', false, true);
  txt('Gold: ' + fmt(save.gold), W / 2, 32 + fs * 2, fs * 1.2, '#f2c14e', 'center', true);
  const cols = W > 760 ? 3 : W > 480 ? 2 : 1;
  const cw = Math.min(260, (W - 24 - (cols - 1) * 12) / cols), ch = fs * 6.2;
  const totalW = cols * cw + (cols - 1) * 12, x0 = (W - totalW) / 2;
  let y0 = 32 + fs * 3.6;
  UPG.forEach((u, i) => {
    const x = x0 + (i % cols) * (cw + 12), y = y0 + Math.floor(i / cols) * (ch + 12);
    const lv = save.up[u.k], maxed = lv >= u.max, cost = maxed ? 0 : u.cost(lv);
    panel(x, y, cw, ch, '#1a1030', maxed ? '#5fd35f' : '#4a3a6a', 2);
    txt(u.name, x + 12, y + fs * 1.1, fs * 1.05, '#ffe08a', 'left', true);
    txt(u.desc, x + 12, y + fs * 2.35, fs * 0.82, '#d9cff5', 'left', true);
    for (let p = 0; p < u.max; p++) { ctx.fillStyle = p < lv ? '#5fd35f' : '#2e2346'; ctx.fillRect(x + 12 + p * 16, y + fs * 3.3, 12, 8); }
    const br = { x: x + 12, y: y + ch - fs * 2.3, w: cw - 24, h: fs * 1.8 };
    if (maxed) txt('MAXED', x + cw / 2, br.y + br.h / 2, fs * 0.9, '#5fd35f', 'center', false, true);
    else button(br, 'BUY ' + fmt(cost) + 'g', () => {
      if (save.gold < cost) { AU.sfx('deny'); return; }
      save.gold -= cost; save.up[u.k]++; writeSave(); AU.sfx('buy');
    }, { disabled: save.gold < cost, size: fs * 0.75, col: '#5fd35f' });
  });
  const rows = Math.ceil(UPG.length / cols);
  const bw = Math.min(260, W - 40);
  button({ x: W / 2 - bw / 2, y: Math.min(H - fs * 3.4, y0 + rows * (ch + 12) + 8), w: bw, h: fs * 2.5 }, 'BACK', () => { AU.sfx('click'); game.state = run && run.dead ? 'dead' : 'title'; });
}

// -------------------------------------------------------------- results ----
function drawDead() {
  drawWorld();
  ctx.fillStyle = 'rgba(8,4,16,0.82)'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs, cx = W / 2;
  let y = H * 0.1;
  const ts = Math.min(W / 11, 46);
  txt(run.exploded ? 'KA-BOOM!' : 'YOU DIED', cx, y, ts, run.exploded ? '#ff9a1f' : '#ff3b5c', 'center', false, true);
  y += ts * 1.1;
  txt(run.cause, cx, y, Math.min(fs * 1.15, (W - 20) / (run.cause.length * 0.55)), '#e8e0ff', 'center', true);
  y += fs * 2.4;
  const rows = [
    ['DEPTH', Math.floor(run.depth) + ' m' + (run.record ? '  NEW BEST!' : ''), run.record ? '#ffe08a' : '#fff'],
    ['LOOT OPENED', String(run.opened), '#fff'],
    ['ENEMIES SLAIN', String(run.kills), '#fff'],
    ['GOLD BANKED', '+' + fmt(run.gold), '#f2c14e'],
  ];
  const w = Math.min(380, W - 40);
  for (const [a, b, c] of rows) {
    txt(a, cx - w / 2, y, fs * 0.95, '#a99fc4', 'left', true);
    txt(b, cx + w / 2, y, fs * 1.1, c, 'right', true);
    y += fs * 1.7;
  }
  if (run.bestItem) {
    txt('BEST FIND', cx - w / 2, y, fs * 0.95, '#a99fc4', 'left', true);
    const nm = run.bestItem.name;
    txt(nm, cx + w / 2, y, Math.min(fs * 1.05, (w * 0.62) / (nm.length * 0.5)), RAR[run.bestItem.rarity].c, 'right', true);
    y += fs * 1.7;
  }
  y += fs * 0.8;
  const tip = deathTip();
  wrap(tip, w, fs * 0.9, true).forEach((l, i) => txt(l, cx, y + i * fs * 1.2, fs * 0.9, '#7fd7ff', 'center', true));
  y += fs * 3.2;
  const bw = Math.min(300, W - 40), bh = fs * 2.8;
  button({ x: cx - bw / 2, y: Math.min(y, H - bh * 2 - 30), w: bw, h: bh }, 'RUN AGAIN', () => { AU.sfx('click'); newRun(); }, { size: fs * 1.2 });
  const hw = (bw - 10) / 2, y2 = Math.min(y, H - bh * 2 - 30) + bh + 12;
  button({ x: cx - bw / 2, y: y2, w: hw, h: bh * 0.8 }, 'BANK', () => { AU.sfx('click'); game.state = 'bank'; }, { col: '#c46bff', size: fs * 0.9 });
  button({ x: cx - bw / 2 + hw + 10, y: y2, w: hw, h: bh * 0.8 }, 'MENU', () => { AU.sfx('click'); game.state = 'title'; }, { col: '#4ea8ff', size: fs * 0.9 });
}
function deathTip() {
  if (run._tip) return run._tip;
  const c = run.cause;
  let t;
  if (/overflow|burst/i.test(c)) t = save.up.insure ? 'Tip: sell junk the moment it lands. The bag never waits for you.' : 'Tip: Overflow Insurance in the BANK saves you from your first overflow.';
  else if (/Blink/i.test(c)) t = 'Tip: that legendary drains HP every blink. Pair it with lifesteal or regen... or stop blinking.';
  else if (/bomb/i.test(c)) t = 'Tip: throw bombs onto the dungeon before the fuse hits zero.';
  else if (/curse|cursed/i.test(c)) t = 'Tip: cursed items are strong, but read the red line first.';
  else t = 'Tip: keep upgrading your weapon. Enemies grow stronger every few metres.';
  run._tip = t; return t;
}

// ---------------------------------------------------------------- pause ----
function drawPause() {
  ctx.fillStyle = 'rgba(8,4,16,0.78)'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs, bw = Math.min(280, W - 40), bh = fs * 2.7;
  txt('PAUSED', W / 2, H * 0.3, Math.min(fs * 2, W / 9), '#ffe08a', 'center', false, true);
  button({ x: W / 2 - bw / 2, y: H * 0.42, w: bw, h: bh }, 'RESUME', () => { AU.sfx('click'); game.paused = false; });
  button({ x: W / 2 - bw / 2, y: H * 0.42 + bh + 14, w: bw, h: bh }, 'HOW TO PLAY', () => { AU.sfx('click'); game.paused = false; game.state = 'help'; game.wasPlaying = true; }, { col: '#4ea8ff' });
  button({ x: W / 2 - bw / 2, y: H * 0.42 + 2 * (bh + 14), w: bw, h: bh }, 'GIVE UP', () => { AU.sfx('click'); game.paused = false; die('Gave up. The loot wins this time.', false); }, { col: '#ff5a76' });
  muteCorner();
}


// ---------------------------------------------------------------- cover ----
// Store-art composition rendered by the engine itself: open index.html#cover.
function drawCover() {
  const P = Math.max(3, Math.round(H / 105));
  LAY.P = P; LAY.gy = Math.round(H * 0.8); LAY.hx = Math.round(W * 0.3);
  LAY.scene = { x: 0, y: 0, w: W, h: H };
  drawScene();
  ctx.fillStyle = 'rgba(8,4,16,0.35)'; ctx.fillRect(0, 0, W, H);
  const cx = W * 0.63, gy = LAY.gy;
  // legendary beam from an exploding chest
  const beamW = 26 * P;
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, 'rgba(255,154,31,0)'); g.addColorStop(1, 'rgba(255,154,31,0.75)');
  ctx.fillStyle = g; ctx.fillRect(cx - beamW / 2, 0, beamW, gy - 4 * P);
  const rg = ctx.createRadialGradient(cx, gy - 10 * P, 0, cx, gy - 10 * P, 60 * P);
  rg.addColorStop(0, 'rgba(255,224,138,0.55)'); rg.addColorStop(1, 'rgba(255,224,138,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const cs = chestSprites('#ff9a1f');
  drawSprite(cs.base, cx, gy, P);
  ctx.save(); ctx.translate(cx - 6 * P, gy - 6 * P); ctx.rotate(-1.0); ctx.drawImage(cs.lid, -P, -4 * P, 14 * P, 4 * P); ctx.restore();
  // loot spraying out
  const loot = [['sword', 4], ['ring', 3], ['amulet', 4], ['helm', 2], ['armor', 3], ['boots', 1], ['dagger', 4], ['hammer', 5], ['staff', 3]];
  loot.forEach(([ic, r], i) => {
    const a = -Math.PI / 2 + (i - (loot.length - 1) / 2) * 0.36, d = (26 + (i % 3) * 8) * P;
    const x = cx + Math.cos(a) * d, y = gy - 16 * P + Math.sin(a) * d * 0.9;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 9 * P);
    glow.addColorStop(0, hexA(RAR[r].c, 0.6)); glow.addColorStop(1, hexA(RAR[r].c, 0));
    ctx.fillStyle = glow; ctx.fillRect(x - 10 * P, y - 10 * P, 20 * P, 20 * P);
    ctx.save(); ctx.translate(x, y); ctx.rotate((i - 4) * 0.25);
    drawItemIcon({ icon: ic, kind: 'gear', rarity: r }, 0, 0, 13 * P); ctx.restore();
  });
  [['potion', '#ff4f6d', -0.9, 30], ['potion', '#4ee0ff', 0.75, 24], ['bomb', null, 1.15, 34]].forEach(([ic, col, a, d]) => {
    drawItemIcon({ icon: ic, kind: ic, col }, cx + Math.cos(a - Math.PI / 2) * d * P * 1.5, gy - 30 * P + Math.sin(a - Math.PI / 2) * d * P, 11 * P);
  });
  for (let i = 0; i < 28; i++) {
    const x = cx + (hash(i, 3) - 0.5) * 120 * P, y = gy - hash(i, 7) * 70 * P - 10 * P;
    drawSprite(sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin'), x, y, P * 0.8);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pick(['#fff3c4', '#ffe08a', '#ff9a1f']); ctx.globalAlpha = 0.8;
    ctx.fillRect(cx + (hash(i, 11) - 0.5) * 90 * P, gy - hash(i, 13) * 80 * P, P * 0.8, P * 0.8);
  }
  ctx.globalAlpha = 1;
  // the goblin, mid-sprint, sack stuffed
  run = null;
  drawHero(LAY.hx, gy, P * 1.5, { gear: { weapon: { icon: 'dagger', rarity: R_LEG }, helm: { rarity: 3 }, armor: { rarity: 4 }, boots: { rarity: 2 } }, moving: true, legT: 1, eyes: false, fill: 0.75 });
  // a doomed slime
  drawSprite(sprite(SPR.slime, ENEMY_PAL.slime, 'en|slime'), W * 0.88, gy, P * 1.3, false, 1, 1.05, 0.95);
  // number-go-up
  const nums = [['+500% ATK SPEED', W * 0.04, H * 0.42, '#ffe14d', 0.9], ['x9,999!', W * 0.86, H * 0.6, '#ff9a1f', 1.2], ['LEGENDARY!', cx, H * 0.3, '#ffb347', 1.0]];
  const ns = Math.min(W / 11.5, H / 7.5) * 0.3;
  for (const [t, x, y, c, sc] of nums) txt(t, x, y, ns * sc, c, x < W * 0.3 ? 'left' : 'center', true);
  // title
  const ts = Math.min(W / 11.5, H / 7.5);
  ctx.fillStyle = 'rgba(8,4,16,0.55)'; ctx.fillRect(0, 0, W, ts * 2.65);
  txt('INFINITE', W / 2, ts * 0.62, ts * 0.58, '#ffe08a', 'center', false, true);
  txt('LOOT GOBLIN', W / 2, ts * 1.55, ts, '#ff9a1f', 'center', false, true);
  ctx.fillStyle = 'rgba(8,4,16,0.75)'; ctx.fillRect(0, H - ts * 0.95, W, ts * 0.95);
  txt('ONE-BUTTON DUNGEON', W / 2, H - ts * 0.48, ts * 0.42, '#c46bff', 'center', false, true);
}

// ----------------------------------------------------------------- frame ---
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  BTN = [];
  if (game.state === 'cover') drawCover();
  else if (game.state === 'title') drawTitle();
  else if (game.state === 'help') drawHelp();
  else if (game.state === 'bank') drawBank();
  else if (game.state === 'dead') drawDead();
  else if (game.state === 'play') {
    drawWorld();
    drawInventory();
    drawFx();
    drawHUD();
    BTN.push({ r: LAY.pauseBtn, fn: () => { AU.sfx('click'); game.paused = true; } });
    BTN.push({ r: LAY.muteBtn, fn: () => AU.setMuted(!save.muted) });
    if (run.flash > 0) { ctx.globalAlpha = run.flash * 0.6; ctx.fillStyle = run.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (!run.dead && !(game.drag && game.drag.moved)) {
      const tipRef = (!ptr.touch && game.hover && getItem(game.hover)) ? game.hover : game.sel;
      if (tipRef && getItem(tipRef)) drawTooltip(tipRef, tipRef.k === 'bag' ? LAY.bag[tipRef.i] : LAY.gear[tipRef.s]);
    }
    if (game.paused) { BTN = []; drawPause(); }
  }
  cvs.className = game.drag && game.drag.moved ? 'grab' : (BTN.some(b => inRect(ptr.x, ptr.y, b.r)) || (game.state === 'play' && hitSlot(ptr.x, ptr.y) && getItem(hitSlot(ptr.x, ptr.y)))) ? 'point' : '';
}

// ----------------------------------------------------------------- input ---
function hitSlot(x, y) {
  if (!run || game.state !== 'play') return null;
  for (const k of SLOTS) if (inRect(x, y, LAY.gear[k])) return { k: 'gear', s: k };
  for (let i = 0; i < run.cap; i++) if (inRect(x, y, LAY.bag[i])) return { k: 'bag', i };
  return null;
}
function hitTarget(x, y) {
  const s = hitSlot(x, y); if (s) return s;
  if (inRect(x, y, LAY.sell)) return { k: 'sell' };
  // generous sell zone: anywhere near the bin
  const sr = LAY.sell;
  if (inRect(x, y, { x: sr.x - 10, y: sr.y - 10, w: sr.w + 20, h: sr.h + 20 })) return { k: 'sell' };
  if (inRect(x, y, LAY.scene)) return { k: 'scene' };
  return null;
}
const sameRef = (a, b) => a && b && a.k === b.k && a.i === b.i && a.s === b.s;
function setPtr(e) {
  const r = cvs.getBoundingClientRect();
  ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
  ptr.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
}
cvs.addEventListener('pointerdown', e => {
  setPtr(e); ptr.down = true; AU.init();
  try { cvs.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  if (e.button === 2) return;
  for (const b of BTN) if (inRect(ptr.x, ptr.y, b.r)) { b.fn(); return; }
  if (game.state !== 'play' || game.paused || run.dead) return;
  const ref = hitSlot(ptr.x, ptr.y);
  if (ref && getItem(ref)) { game.drag = { src: ref, item: getItem(ref), x0: ptr.x, y0: ptr.y, moved: false }; return; }
  if (game.sel) {
    const tgt = hitTarget(ptr.x, ptr.y);
    if (tgt && getItem(game.sel)) dropOn(game.sel, tgt);
    game.sel = null;
  }
});
cvs.addEventListener('pointermove', e => {
  setPtr(e);
  if (game.drag && !game.drag.moved && Math.hypot(ptr.x - game.drag.x0, ptr.y - game.drag.y0) > 8) { game.drag.moved = true; game.sel = null; }
  game.hover = ptr.touch ? null : hitSlot(ptr.x, ptr.y);
});
function endDrag() {
  const d = game.drag; game.drag = null;
  if (!d || game.state !== 'play' || !run || run.dead) return;
  if (getItem(d.src) !== d.item) return; // it blew up or moved while we held it
  if (d.moved) {
    const tgt = hitTarget(ptr.x, ptr.y - (ptr.touch ? LAY.S * 0.6 : 0)) || hitTarget(ptr.x, ptr.y);
    dropOn(d.src, tgt);
    return;
  }
  const now = performance.now();
  if (game.lastTap && sameRef(game.lastTap.ref, d.src) && now - game.lastTap.t < 380) {
    useItem(d.src); game.sel = null; game.lastTap = null;
  } else if (game.sel && !sameRef(game.sel, d.src)) {
    dropOn(game.sel, d.src); game.sel = null; game.lastTap = null;
  } else {
    game.sel = sameRef(game.sel, d.src) ? null : d.src;
    game.lastTap = { ref: d.src, t: now };
  }
}
cvs.addEventListener('pointerup', e => { setPtr(e); ptr.down = false; endDrag(); if (ptr.touch) game.hover = null; });
cvs.addEventListener('pointercancel', () => { ptr.down = false; game.drag = null; });
cvs.addEventListener('pointerleave', () => { if (!ptr.down) game.hover = null; });
cvs.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (game.state !== 'play' || game.paused || !run || run.dead) return;
  setPtr(e);
  const ref = hitSlot(ptr.x, ptr.y);
  if (ref && getItem(ref)) { sell(ref); if (sameRef(game.sel, ref)) game.sel = null; }
});
window.addEventListener('keydown', e => {
  AU.init();
  const k = e.key.toLowerCase();
  if (k === 'm') { AU.setMuted(!save.muted); return; }
  if (game.state === 'title' && (k === 'enter' || k === ' ')) { e.preventDefault(); newRun(); return; }
  if (game.state === 'dead' && (k === 'enter' || k === ' ' || k === 'r')) { e.preventDefault(); newRun(); return; }
  if (game.state === 'help' && (k === 'escape' || k === 'enter')) { game.state = game.wasPlaying ? 'play' : 'title'; if (game.wasPlaying) { game.paused = true; game.wasPlaying = false; } return; }
  if (game.state === 'bank' && k === 'escape') { game.state = run && run.dead ? 'dead' : 'title'; return; }
  if (game.state !== 'play' || !run || run.dead) return;
  if (k === 'escape' || k === 'p') { game.paused = !game.paused; return; }
  if (game.paused) return;
  const ref = game.hover || game.sel;
  if (ref && getItem(ref)) {
    if (k === 's' || k === 'delete' || k === 'backspace') { sell(ref); game.sel = null; }
    else if (k === 'e' || k === ' ') { e.preventDefault(); useItem(ref); game.sel = null; }
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play' && run && !run.dead) game.paused = true; });
window.addEventListener('resize', resize);
window.addEventListener('blur', () => { game.drag = null; });

// ------------------------------------------------------------------ loop ---
let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  try { update(dt); render(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function boot() {
  loadSave();
  resize();
  if (location.hash === '#cover') game.state = 'cover';
  requestAnimationFrame(frame);
}
// Test/screenshot hook (no effect on normal play).
window.__ilg = { game, get run() { return run; }, newRun, makeGear, makeBomb, makeJunk, makePotion, recompute, save, update, LAY };
window.__ilgAPI = { sell, useItem, equipFrom, previewEquip, dropOn, unequip, spawnEnemy, spawnBoss };
const fontsReady = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('16px "Press Start 2P"')]) : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
})();
