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
