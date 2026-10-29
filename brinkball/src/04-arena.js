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
