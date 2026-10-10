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
