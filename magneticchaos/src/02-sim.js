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
