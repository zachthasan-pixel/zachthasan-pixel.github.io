// ---------------------------------------------------------------------------
// Orbs: the bumper creatures. Physics, dash, heat, abilities and power-ups.
// Simulation runs on a fixed 1/120 s step so results match at any refresh rate.
// ---------------------------------------------------------------------------
const STEP = 1 / 120;
const BASE_R = 24;
const ACCEL = 1500, DRAG = 5.6, ICE_ACCEL = 720, ICE_DRAG = 1.7;
const DASH_MIN = 640, DASH_MAX = 1120, DASH_CD = 1.5, CHARGE_T = 0.6;
const POWERUPS = {
  mega: { name: 'MEGA', col: '#ff7a3a', icon: '⬤', t: 6 },
  turbo: { name: 'TURBO', col: '#45e0ff', icon: '⚡', t: 6 },
  spikes: { name: 'SPIKES', col: '#ff4d6d', icon: '✸', t: 7 },
  shield: { name: 'SHIELD', col: '#9dff6a', icon: '◈', t: 8 },
};
const POWER_KEYS = Object.keys(POWERUPS);

let ORB_ID = 0;
class Orb {
  constructor(o) {
    this.id = ++ORB_ID;
    this.name = o.name; this.human = !!o.human; this.slot = o.slot || 0; // 1 = P1, 2 = P2
    this.skin = o.skin; this.hat = o.hat; this.ability = o.ability;
    this.x = o.x; this.y = o.y; this.vx = 0; this.vy = 0;
    this.baseR = BASE_R * (o.scale || 1); this.r = this.baseR; this.baseMass = 1 * (o.scale || 1) ** 2; this.mass = this.baseMass;
    this.heat = 0; this.alive = true; this.falling = 0; this.fz = 0;
    this.face = rand(0, TAU); this.look = 0; this.blink = rand(1, 4); this.squash = 0;
    this.dashCd = rand(0.2, 0.8); this.dashT = 0; this.charging = 0; this.chargeTick = 0;
    this.abCd = rand(1.5, 3); this.abT = 0; this.magnetT = 0;
    this.power = null; this.powerT = 0; this.shieldHits = 0;
    this.lastHitBy = null; this.lastHitT = 0; this.lastHitCharged = false;
    this.kos = 0; this.koTimes = []; this.place = 0; this.survived = 0;
    this.inMove = [0, 0]; this.wantDash = false; this.dashHeld = false; this.wantAbility = false;
    this.hitFlash = 0; this.teeter = 0; this.trail = []; this.spawnT = 0.6; this.emote = 0;
    this.ai = o.ai || null; this.mods = o.mods || {};
  }
  get dashing() { return this.dashT > 0; }
  get anchored() { return this.abT > 0 && this.ability === 'anchor'; }
  canAct() { return this.alive && !this.falling; }
  // Called by the game every fixed step. Input is set beforehand on inMove/wantDash/dashHeld/wantAbility.
  step(dt, G) {
    if (!this.alive) return;
    if (this.falling) {
      this.falling += dt; this.fz += dt * 600 * this.falling;
      this.x += this.vx * dt * 0.35; this.y += this.vy * dt * 0.35;
      if (this.falling > 0.9) { this.alive = false; G.onEliminated(this); }
      return;
    }
    this.survived += dt;
    const turbo = this.power === 'turbo';
    const ice = G.arena.friction(this.x, this.y) === 'ice';
    let acc = ice ? ICE_ACCEL : ACCEL, drag = ice ? ICE_DRAG : DRAG;
    if (turbo) acc *= 1.35;
    if (this.charging > 0) acc *= 0.35;
    if (this.anchored) acc *= 0.25;
    if (this.dashing) drag *= 0.25;
    const [mx, my] = this.inMove;
    const ml = Math.hypot(mx, my);
    if (ml > 0.05) {
      const k = Math.min(1, ml);
      this.vx += mx / ml * acc * k * dt; this.vy += my / ml * acc * k * dt;
      this.face = Math.atan2(my, mx);
    }
    const f = Math.exp(-drag * dt);
    this.vx *= f; this.vy *= f;
    this.x += this.vx * dt; this.y += this.vy * dt;
    const sp = Math.hypot(this.vx, this.vy);
    if (sp > 30) this.look = Math.atan2(this.vy, this.vx);

    // timers
    this.dashT = Math.max(0, this.dashT - dt);
    const cdMul = (turbo ? 0.5 : 1) * (this.mods.hyper ? 0.5 : 1);
    this.dashCd = Math.max(0, this.dashCd - dt / cdMul);
    this.abCd = Math.max(0, this.abCd - dt);
    this.spawnT = Math.max(0, this.spawnT - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.squash *= Math.exp(-dt * 10);
    this.emote = Math.max(0, this.emote - dt);
    this.lastHitT += dt;
    this.heat = Math.max(0, this.heat - dt * 0.5);
    if (this.abT > 0) {
      this.abT -= dt;
      if (this.ability === 'magnet') G.magnetPull(this, dt, this.abT <= 0);
    }
    if (this.power) {
      this.powerT -= dt;
      if (this.powerT <= 0) this.setPower(null);
    }
    this.blink -= dt; if (this.blink < -0.12) this.blink = rand(2, 5);

    // dash: hold to charge, release to go
    if (this.dashHeld && this.dashCd <= 0 && !this.dashing) {
      this.charging += dt;
      this.chargeTick -= dt;
      if (this.chargeTick <= 0 && this.human) { AU.charge(Math.min(1, this.charging / CHARGE_T)); this.chargeTick = 0.09; }
    }
    if (this.wantDash) {
      this.wantDash = false;
      if (this.dashCd <= 0 && !this.dashing) this.doDash(G);
      this.charging = 0;
    }
    if (this.wantAbility) {
      this.wantAbility = false;
      if (this.abCd <= 0) G.useAbility(this);
    }
    if (this.dashing && G.tick % 2 === 0) this.trail.push([this.x, this.y, 0.25]);
    for (const p of this.trail) p[2] -= dt;
    while (this.trail.length && this.trail[0][2] <= 0) this.trail.shift();

    // Off the edge? Fast movers go straight over. Slow ones teeter for a moment
    // and can still roll back to safety, which makes for clutch saves.
    if (!G.arena.supportedOrb(this.x, this.y, this.r)) {
      const fast = Math.hypot(this.vx, this.vy) > 300;
      this.teeter += dt;
      if (fast && this.teeter > 0.02 || this.teeter > 0.5) {
        this.falling = 0.0001; this.charging = 0; this.teeter = 0;
        G.onFall(this);
      } else { const f2 = Math.exp(-9 * dt); this.vx *= f2; this.vy *= f2; }
    } else this.teeter = Math.max(0, this.teeter - dt * 2);
  }
  doDash(G) {
    const c = clamp(this.charging / CHARGE_T, 0, 1);
    let [mx, my] = this.inMove;
    let l = Math.hypot(mx, my);
    if (l < 0.1) { mx = Math.cos(this.face); my = Math.sin(this.face); l = 1; }
    const p = lerp(DASH_MIN, DASH_MAX, c);
    this.vx = this.vx * 0.3 + mx / l * p; this.vy = this.vy * 0.3 + my / l * p;
    this.face = Math.atan2(my, mx);
    this.dashT = 0.2 + c * 0.1; this.dashCharge = c;
    this.dashCd = DASH_CD + c * 0.35;
    this.squash = 0.5;
    G.onDash(this, c);
  }
  setPower(k) {
    if (this.power === 'mega' && k !== 'mega') { this.r = this.baseR; this.mass = this.baseMass; }
    this.power = k; this.powerT = k ? POWERUPS[k].t : 0;
    if (k === 'mega') { this.r = this.baseR * 1.45; this.mass = this.baseMass * 2.6; }
    if (k === 'shield') this.shieldHits = 1;
  }
  effMass() { return this.mass * (this.anchored ? 7 : 1); }
}
