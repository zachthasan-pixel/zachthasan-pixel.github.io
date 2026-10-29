// ---------------------------------------------------------------------------
// The match: modes, collisions, abilities, hazards, KOs, rewards.
// ---------------------------------------------------------------------------
const G = {
  mode: null, state: 'idle', arena: null, orbs: [], pickups: [], fx: [], texts: [], feed: [],
  tick: 0, time: 0, shake: 0, hitstop: 0, timeScale: 1, slowT: 0, acc: 0, countdown: 0,
  humanFocus: 0, pickupT: 8, mods: {}, party: null, daily: null, result: null, tutorial: null,
  players: [], endT: 0, intensity: 0,

  // --- setup ---------------------------------------------------------------
  start(mode, opts) {
    opts = opts || {};
    this.mode = mode; this.orbs = []; this.pickups = []; this.fx = []; this.texts = []; this.feed = [];
    this.tick = 0; this.time = 0; this.shake = 0; this.hitstop = 0; this.timeScale = 1; this.slowT = 0; this.acc = 0;
    this.result = null; this.endT = 0; this.demoEnd = 0; this.players = []; this.tutorial = null; this.intensity = 0;
    const S = Save.d;
    let arenaKey, rng = null, mod = { id: 'none' };
    let cpu = 7, skill = skillFor(S.rp);
    this.humanFocus = lerp(-170, 0, clamp(S.rp / 600, 0, 1));
    if (mode === 'tutorial') {
      arenaKey = 'meadow'; cpu = 3; skill = 0.05; this.humanFocus = -400;
      this.tutorial = { step: 0, moved: 0, dashed: 0, charged: 0, ab: 0, t: 0 };
    } else if (mode === 'daily') {
      const key = todayKey();
      rng = makeRng(key * 7 + 3);
      const avail = ARENA_KEYS;
      arenaKey = avail[Math.floor(rng() * avail.length)];
      mod = MODIFIERS[1 + Math.floor(rng() * (MODIFIERS.length - 1))];
      skill = clamp(skillFor(S.rp) + 0.1, 0.35, 1);
      this.humanFocus = 0;
      this.daily = { key, mod };
    } else if (mode === 'demo') {
      arenaKey = pick(ARENA_KEYS); cpu = 6; skill = 0.6; this.humanFocus = 0;
    } else if (mode === 'party') {
      arenaKey = opts.arena || pick(ARENA_KEYS);
      cpu = S.partyBots; skill = 0.45; this.humanFocus = 0;
    } else {
      arenaKey = this.pickArena();
    }
    this.mods = {
      hyper: mod.id === 'hyper', heavy: mod.id === 'heavyhit', rain: mod.id === 'powerups',
      scale: mod.id === 'giant' ? 1.35 : mod.id === 'tiny' ? 0.78 : 1,
    };
    this.mod = mod;
    const total = (mode === 'party' ? 2 : mode === 'demo' ? 0 : 1) + cpu;
    this.arena = new Arena(arenaKey, { rng: rng || Math.random, quick: mod.id === 'quick', small: mode === 'tutorial', rings: total <= 4 ? 5 : total <= 6 ? 6 : 0 });
    if (mode === 'tutorial') this.arena.nextDrop = 30; // a gentle first arena
    const humans = mode === 'party' ? 2 : mode === 'demo' ? 0 : 1;
    const pts = this.arena.spawnPoints(humans + cpu);
    const names = CPU_NAMES.slice().sort(() => (rng || Math.random)() - 0.5);
    const skins = Object.keys(SKINS), hats = Object.keys(HATS);
    for (let i = 0; i < humans + cpu; i++) {
      const [x, y] = pts[i];
      let o;
      if (i < humans) {
        const p2 = i === 1;
        o = new Orb({
          name: mode === 'party' ? (p2 ? 'P2' : 'P1') : 'YOU', human: true, slot: i + 1, x, y,
          skin: p2 ? (S.skin === 'sky' ? 'lime' : 'sky') : S.skin, hat: p2 ? 'cap' : S.hat,
          ability: p2 ? (S.p2ability || 'shock') : S.ability, scale: this.mods.scale, mods: this.mods,
        });
        this.players.push(o);
      } else {
        const sk = mode === 'tutorial' ? 0.05 : clamp(skill + rand(-0.12, 0.08), 0.05, 1);
        const abil = mode === 'tutorial' ? 'shock' : pick(ABILITY_KEYS.filter(k => ABILITIES[k].rank <= Math.max(1, rankOf(S.rp).i + 1)));
        o = new Orb({
          name: names[i % names.length], x, y, skin: pick(skins.filter(k => k !== S.skin && !(SIMILAR[S.skin] || []).includes(k))), hat: Math.random() < 0.55 ? pick(hats) : 'none',
          ability: abil, ai: makeAI(sk), scale: this.mods.scale, mods: this.mods,
        });
        if (mode === 'tutorial') { o.ai.p = PERSONAS[2]; o.ai.skill = 0.35; o.ai.rest = rand(5, 9); o.dashCd = 3; }
      }
      o.face = Math.atan2(-y, -x);
      this.orbs.push(o);
    }
    this.pickupT = this.mods.rain ? 3 : rand(7, 10);
    this.state = 'countdown'; this.countdown = mode === 'tutorial' ? 0.01 : 1.6;
    this.camInit = true;
    if (mode !== 'demo') S.arenasSeen[arenaKey] = 1;
    AU.intensity = 0; AU.quiet = mode === 'demo';
    UI.onMatchStart();
  },
  pickArena() {
    const S = Save.d, tier = rankOf(S.rp).i;
    const avail = ARENA_KEYS.filter(k => ARENAS[k].unlock <= tier && (!ARENAS[k].minRp || S.rp >= ARENAS[k].minRp));
    const fresh = avail.filter(k => !S.arenasSeen[k]);
    if (fresh.length) return fresh[0];
    if (S.lastArena && avail.length > 1) { const a = pick(avail.filter(k => k !== S.lastArena)); S.lastArena = a; return a; }
    const a = pick(avail); S.lastArena = a; return a;
  },
  alive() { return this.orbs.filter(o => o.alive && !o.falling); },

  // --- main update -----------------------------------------------------------
  frame(dt) {
    if (this.state === 'idle') return;
    if (this.hitstop > 0) { this.hitstop -= dt; this.decayFx(dt * 0.3); return; }
    if (this.slowT > 0) { this.slowT -= dt; this.timeScale = lerp(1, 0.25, clamp(this.slowT / 0.6, 0, 1)); } else this.timeScale = 1;
    this.acc += dt * this.timeScale;
    let n = 0;
    while (this.acc >= STEP && n < 24) { this.acc -= STEP; this.step(STEP); n++; }
    if (n >= 24) this.acc = 0;
    this.decayFx(dt);
  },
  step(dt) {
    this.tick++;
    if (this.state === 'countdown') {
      const before = Math.ceil(this.countdown / 0.8);
      this.countdown -= dt;
      const after = Math.ceil(this.countdown / 0.8);
      if (after !== before && after > 0 && this.mode !== 'demo') { UI.big(after === 2 ? 'READY' : '', '#fff'); AU.count(false); }
      if (this.countdown <= 0) { this.state = 'play'; if (this.mode !== 'demo') { UI.big('GO!', '#ffe25a'); AU.count(true); AU.startMusic(); } }
      Input.apply(this); // let players aim, not move
      for (const o of this.orbs) { o.wantDash = o.wantAbility = false; o.dashHeld = false; o.charging = 0; }
      return;
    }
    if (this.state !== 'play' && this.state !== 'spectate' && this.state !== 'ending') return;
    this.time += dt;
    Input.apply(this);
    for (const o of this.orbs) if (o.ai && o.canAct()) AI.update(o, this, dt);
    for (const o of this.orbs) o.step(dt, this);
    this.collide(dt);
    this.hazards(dt);
    this.arena.update(dt, this);
    this.updatePickups(dt);
    if (this.tutorial) this.tutorialStep(dt);
    const left = this.alive().length, total = this.orbs.length;
    this.intensity = clamp(1 - (left - 2) / Math.max(1, total - 2), 0, 1) * 0.7 + clamp(this.time / 90, 0, 1) * 0.3;
    AU.intensity = this.intensity;
    if (this.state === 'ending') { this.endT -= dt; if (this.endT <= 0) this.finish(); }
  },
  decayFx(dt) {
    for (const p of this.fx) {
      p.life -= dt;
      if (p.type === 'p') { p.x += p.vx * dt; p.y += p.vy * dt; p.z = (p.z || 0) + (p.vz || 0) * dt; p.vz = (p.vz || 0) - 900 * dt; if (p.z < 0) { p.z = 0; p.vz *= -0.4; } p.vx *= 0.97; p.vy *= 0.97; }
    }
    this.fx = this.fx.filter(p => p.life > 0);
    for (const t of this.texts) { t.life -= dt; t.y -= 40 * dt; }
    this.texts = this.texts.filter(t => t.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  },

  // --- physics ---------------------------------------------------------------
  collide() {
    const os = this.orbs;
    for (let i = 0; i < os.length; i++) {
      const a = os[i]; if (!a.canAct()) continue;
      for (let j = i + 1; j < os.length; j++) {
        const b = os[j]; if (!b.canAct()) continue;
        let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy), md = a.r + b.r;
        if (d >= md || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        const ma = a.effMass(), mb = b.effMass();
        const ov = md - d, ia = 1 / ma, ib = 1 / mb, it = ia + ib;
        a.x -= nx * ov * ia / it; a.y -= ny * ov * ia / it; b.x += nx * ov * ib / it; b.y += ny * ov * ib / it;
        const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
        if (vn >= 0) continue;
        const impact = -vn;
        const jimp = -(1.4) * vn / it;
        a.vx -= jimp * ia * nx; a.vy -= jimp * ia * ny; b.vx += jimp * ib * nx; b.vy += jimp * ib * ny;
        // Extra knockback: who was the attacker?
        const sa = a.vx * nx + a.vy * ny, sb = -(b.vx * nx + b.vy * ny);
        this.knock(a, b, nx, ny, impact, sa >= sb || a.dashing);
        this.knock(b, a, -nx, -ny, impact, sb > sa || b.dashing);
        const power = clamp(impact / 1100, 0, 1);
        const cx = a.x + nx * a.r, cy = a.y + ny * a.r;
        this.sparks(cx, cy, 6 + power * 18, power > 0.5 ? '#fff6c0' : '#ffffff', 120 + power * 380);
        if (power > 0.25) this.ring(cx, cy, 10, 40 + power * 70, 0.25, '#ffffff');
        a.squash = b.squash = 0.25 + power * 0.5;
        if (a.human || b.human || power > 0.5) AU.bump(power, Math.max(a.mass, b.mass));
        if (power > 0.55) {
          this.hitstop = Math.max(this.hitstop, 0.03 + power * 0.08);
          this.shake = Math.max(this.shake, 4 + power * 12);
          if (a.dashing && b.dashing) this.text(cx, cy - 30, 'CLASH!', '#ffe25a', 26);
        }
        if ((a.human || b.human) && power > 0.3) Input.rumble(power);
      }
    }
  },
  // Victim v hit by attacker a along (nx, ny) pointing from a to v.
  knock(a, v, nx, ny, impact, attacking) {
    if (!attacking) return;
    const ch = a.dashing ? (a.dashCharge || 0) : 0;
    // Base push comes from the collision itself; HEAT makes every hit fly further.
    let k = ch * 0.35 + (a.power === 'spikes' ? 0.4 : 0);
    let heatK = (a.dashing ? 0.6 + ch * 0.3 : 0.3) * (v.heat / 100);
    if (this.mods.heavy) { k += 0.25; heatK *= 1.5; }
    let heatGain = impact < (a.dashing ? 150 : 260) ? 0 : impact * (a.dashing ? 0.02 : 0.008) * (a.power === 'spikes' ? 1.5 : 1) * (this.mods.heavy ? 2 : 1);
    if (v.anchored) { k = 0; heatK *= 0.1; heatGain = 0; }
    if (v.shieldHits > 0 && impact > 250) {
      v.shieldHits = 0; v.setPower(null); k = 0; heatK *= 0.2; heatGain = 0;
      this.ring(v.x, v.y, v.r, v.r * 2.6, 0.35, POWERUPS.shield.col); AU.bumper();
    }
    const kb = impact * (k + heatK) / v.effMass();
    v.vx += nx * kb; v.vy += ny * kb;
    v.heat = Math.min(250, v.heat + heatGain);
    if (impact > 140) {
      v.lastHitBy = a; v.lastHitT = 0; v.lastHitCharged = a.dashing && (a.dashCharge || 0) > 0.45;
      v.hitFlash = 1;
    }
  },
  hazards(dt) {
    const A = this.arena;
    for (const b of A.bumpers) {
      if (b.tile.state >= 2) continue;
      for (const o of this.orbs) {
        if (!o.canAct()) continue;
        const dx = o.x - b.x, dy = o.y - b.y, d = Math.hypot(dx, dy), md = b.r + o.r;
        if (d >= md || d === 0) continue;
        const nx = dx / d, ny = dy / d;
        o.x = b.x + nx * md; o.y = b.y + ny * md;
        const vn = o.vx * nx + o.vy * ny;
        if (vn < 0) { o.vx -= 2 * vn * nx; o.vy -= 2 * vn * ny; }
        o.vx += nx * 380 / o.effMass(); o.vy += ny * 380 / o.effMass();
        if (!o.anchored) o.heat = Math.min(250, o.heat + 6);
        b.hit = 1; AU.bumper(); this.shake = Math.max(this.shake, 4);
        this.sparks(b.x + nx * b.r, b.y + ny * b.r, 10, '#fff07a', 300);
      }
    }
    const s = A.sweep;
    if (s) {
      const ux = Math.cos(s.a), uy = Math.sin(s.a);
      for (const o of this.orbs) {
        if (!o.canAct() || o.dashing) continue;
        const along = o.x * ux + o.y * uy;
        if (along < 0 || along > s.len) continue;
        const perp = -o.x * uy + o.y * ux; // signed distance from the beam
        if (Math.abs(perp) > o.r + 9) continue;
        if (o.sweepCd && this.time < o.sweepCd) continue;
        o.sweepCd = this.time + 0.35;
        const side = s.dir; // beam pushes things the way it turns
        const px = -uy * side, py = ux * side;
        const f = (380 + along * 0.5) * (1 + o.heat / 150) / o.effMass();
        o.vx += px * f; o.vy += py * f;
        o.x += px * 8; o.y += py * 8;
        if (!o.anchored) o.heat = Math.min(250, o.heat + 14);
        o.hitFlash = 1; o.lastHitT = 99; // the sweeper takes the credit
        AU.bump(0.6, 1); this.shake = Math.max(this.shake, 6);
        this.sparks(o.x, o.y, 14, '#ffd6e8', 380);
      }
    }
  },
  onVent(t) {
    if (this.mode !== 'demo') AU.vent();
    for (let i = 0; i < 26; i++) this.fx.push({ type: 'p', x: t.x + rand(-20, 20), y: t.y + rand(-20, 20), vx: rand(-80, 80), vy: rand(-80, 80), vz: rand(500, 900), z: 0, life: rand(0.6, 1.1), max: 1.1, col: pick(['#ff6a2b', '#ffb03a', '#ffe08a']), size: rand(3, 7) });
    this.ring(t.x, t.y, 10, 90, 0.4, '#ff8a3a');
    for (const o of this.orbs) {
      if (!o.canAct()) continue;
      const d = Math.hypot(o.x - t.x, o.y - t.y);
      if (d > 62) continue;
      let ang = Math.atan2(o.y - t.y, o.x - t.x); if (d < 5) ang = rand(0, TAU);
      const f = 520 * (1 + o.heat / 150) / o.effMass();
      o.vx += Math.cos(ang) * f; o.vy += Math.sin(ang) * f;
      if (!o.anchored) o.heat = Math.min(250, o.heat + 18);
      o.hitFlash = 1; o.lastHitT = 99;
      this.shake = Math.max(this.shake, 8);
    }
  },
  magnetPull(o, dt, release) {
    for (const e of this.orbs) {
      if (e === o || !e.canAct()) continue;
      const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy);
      if (d > 270 || d < 1) continue;
      if (release) {
        if (d < 150) {
          const f = 450 * (1 + e.heat / 110) / e.effMass();
          e.vx -= dx / d * f; e.vy -= dy / d * f;
          e.lastHitBy = o; e.lastHitT = 0; e.lastHitCharged = false; e.heat = Math.min(250, e.heat + 10);
        }
      } else {
        const f = 1100 * dt * (1 - d / 300);
        e.vx += dx / d * f; e.vy += dy / d * f;
      }
    }
    if (release) { this.ring(o.x, o.y, o.r, 150, 0.35, '#c084ff'); AU.shock(); this.shake = Math.max(this.shake, 6); }
  },
  useAbility(o) {
    const ab = ABILITIES[o.ability];
    o.abCd = ab.cd;
    if (o.human && this.mode !== 'party') Missions.track('ability', 1);
    if (this.tutorial) this.tutorial.ab++;
    if (o.ability === 'shock') {
      for (const e of this.orbs) {
        if (e === o || !e.canAct()) continue;
        const dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy);
        if (d > 175 || d < 1) continue;
        const f = 480 * (1 - d / 175 * 0.55) * (1 + e.heat / 110) / e.effMass() * (e.anchored ? 0.2 : 1);
        e.vx += dx / d * f; e.vy += dy / d * f;
        if (!e.anchored) e.heat = Math.min(250, e.heat + 12);
        e.lastHitBy = o; e.lastHitT = 0; e.lastHitCharged = false; e.hitFlash = 1;
      }
      this.ring(o.x, o.y, o.r, 180, 0.4, '#ffe25a'); this.ring(o.x, o.y, o.r, 120, 0.3, '#ffffff');
      AU.shock(); this.shake = Math.max(this.shake, 9); o.squash = 0.7;
    } else if (o.ability === 'anchor') {
      o.abT = 1.6; o.vx *= 0.3; o.vy *= 0.3; AU.anchor(); this.ring(o.x, o.y, o.r * 2, o.r, 0.3, '#9fb3c8');
    } else if (o.ability === 'blink') {
      let [mx, my] = o.inMove; let l = Math.hypot(mx, my);
      if (l < 0.1) { mx = Math.cos(o.face); my = Math.sin(o.face); l = 1; }
      this.sparks(o.x, o.y, 14, '#d9c2ff', 200);
      o.x += mx / l * 165; o.y += my / l * 165; o.vx *= 0.4; o.vy *= 0.4;
      this.sparks(o.x, o.y, 14, '#ffffff', 200); this.ring(o.x, o.y, 4, 60, 0.25, '#d9c2ff');
      AU.blink();
    } else if (o.ability === 'magnet') {
      o.abT = 1.1; AU.magnet();
    }
    if (o.human) UI.abilityUsed(o);
  },
  updatePickups(dt) {
    if (this.mode === 'tutorial') return;
    this.pickupT -= dt;
    const max = this.mods.rain ? 4 : 2;
    if (this.pickupT <= 0 && this.pickups.length < max && this.state === 'play' || this.state === 'spectate' && this.pickupT <= 0) {
      this.pickupT = this.mods.rain ? rand(2.5, 4) : rand(9, 14);
      const safe = this.arena.tiles.filter(t => t.state === 0 && t.band < this.arena.band && t.type !== 'vent');
      if (safe.length) {
        const t = pick(safe), k = pick(POWER_KEYS);
        this.pickups.push({ x: t.x, y: t.y, k, t: 0, tile: t });
      }
    }
    for (const p of this.pickups) {
      p.t += dt;
      if (p.tile.state >= 2) p.dead = true;
      for (const o of this.orbs) {
        if (!o.canAct() || p.dead) continue;
        if (Math.hypot(o.x - p.x, o.y - p.y) < o.r + 18) {
          p.dead = true; o.setPower(p.k);
          const P = POWERUPS[p.k];
          this.text(o.x, o.y - o.r - 20, P.name + '!', P.col, 22);
          this.ring(p.x, p.y, 6, 60, 0.3, P.col);
          if (o.human) { AU.pickup(); if (this.mode !== 'party') Missions.track('power', 1); }
        }
      }
    }
    this.pickups = this.pickups.filter(p => !p.dead);
  },

  // --- events ------------------------------------------------------------------
  onDash(o, c) {
    if (o.human || Math.hypot(o.x, o.y) < 400) AU.dash(c);
    this.ring(o.x, o.y, o.r, o.r * (1.6 + c), 0.18, c > 0.5 ? '#ffe25a' : '#ffffff');
    if (this.tutorial && o.human) { this.tutorial.dashed++; if (c > 0.6) this.tutorial.charged++; }
  },
  onCrumble(band) {
    if (this.mode === 'demo') return;
    AU.crack();
    if (this.state === 'play') UI.feedMsg('⚠ The edge is crumbling!', '#ffb36b');
  },
  onTileFall(t) {
    if (this.mode !== 'demo') AU.tileFall();
    for (let i = 0; i < 4; i++) this.fx.push({ type: 'p', x: t.x + rand(-25, 25), y: t.y + rand(-20, 20), vx: rand(-40, 40), vy: rand(20, 90), vz: rand(50, 200), z: 0, life: 0.7, max: 0.7, col: this.arena.def.side, size: rand(4, 8) });
  },
  onFall(o) {
    const aliveAfter = this.alive().length; // o is already marked falling
    o.place = aliveAfter + 1;
    if (o.human || o.lastHitBy && o.lastHitBy.human) AU.fall();
    if (this.mode === 'tutorial' && o.human) {
      UI.feedMsg('<b>Oops!</b> Back you go. Stay away from the edge');
      setTimeout(() => this.respawn(o), 900);
      return;
    }
    const k = o.lastHitT < 3.5 ? o.lastHitBy : null;
    let msg;
    if (k && k !== o) {
      k.kos++; k.koTimes.push(this.time); k.emote = 1.2;
      const dbl = k.koTimes.filter(t => this.time - t < 3).length >= 2;
      msg = (k.human ? '<b>' + k.name + '</b>' : k.name + cpuTag()) + ' <span class="ko">KO</span> ' + (o.human ? '<b>' + o.name + '</b>' : o.name + cpuTag());
      if (k.human) {
        this.text(o.x, o.y - 40, dbl ? 'DOUBLE KO!' : o.lastHitCharged ? 'CHARGED KO!' : 'KO!', dbl ? '#ff6fb1' : '#ffe25a', dbl ? 40 : 34);
        AU.ko(dbl); this.hitstop = Math.max(this.hitstop, 0.09); this.shake = Math.max(this.shake, 14);
        if (this.mode !== 'party') {
          Missions.track('ko', 1);
          if (o.lastHitCharged) Missions.track('charged', 1);
          if (dbl) Missions.track('double', 1);
        }
        Input.rumble(1);
      }
    } else msg = (o.human ? '<b>' + o.name + '</b>' : o.name + cpuTag()) + ' fell off';
    if (this.mode !== 'demo') UI.feedMsg(msg);
    for (let i = 0; i < 16; i++) this.fx.push({ type: 'p', x: o.x, y: o.y, vx: rand(-160, 160), vy: rand(-160, 160), vz: rand(100, 400), z: 0, life: 0.8, max: 0.8, col: SKINS[o.skin].c1, size: rand(3, 7) });
    // Match flow
    const left = this.alive();
    if (this.mode === 'tutorial' && !left.includes(this.players[0])) left.push(this.players[0]);
    if (this.mode === 'demo') {
      if (left.length <= 1 && !this.demoEnd) { this.demoEnd = 1; setTimeout(() => { if (this.mode === 'demo') this.start('demo'); }, 1800); }
      return;
    }
    if (this.mode === 'party') {
      if (left.length <= 1 || !left.some(x => x.human)) this.endRound(left);
      return;
    }
    if (o.human && this.state === 'play') {
      this.state = 'spectate';
      this.slowT = 0.6;
      this.result = this.makeResult(o.place, o);
      setTimeout(() => UI.showResult(this.result), 900);
      Portal.gameplayStop();
    }
    if (left.length === 1) {
      const w = left[0];
      w.place = 1;
      if (this.state === 'play') { // the human won
        this.state = 'ending'; this.endT = 1.6; this.slowT = 0.8;
        this.result = this.makeResult(1, w);
        UI.big('VICTORY!', '#ffe25a'); AU.win();
        this.confetti(w.x, w.y);
      } else if (this.state === 'spectate') {
        this.text(w.x, w.y - 40, 'WINNER', '#ffe25a', 26);
        this.state = 'ending'; this.endT = 99;
      }
    }
  },
  onEliminated(o) {
    if (this.mode === 'tutorial' && o.human) o.alive = true; // respawn() brings it back
  },
  respawn(o) {
    if (this.mode !== 'tutorial' || this.state !== 'play') return;
    const live = this.arena.tiles.filter(t => t.state === 0).sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
    const t = live[0]; if (!t) return;
    Object.assign(o, { x: t.x, y: t.y, vx: 0, vy: 0, falling: 0, fz: 0, heat: 0, alive: true, spawnT: 0.6, teeter: 0, lastHitBy: null });
    this.ring(o.x, o.y, 4, 70, 0.4, '#ffe25a'); AU.pickup();
  },
  finish() {
    if (this.mode === 'party') return;
    this.state = 'over';
    UI.showResult(this.result);
    Portal.gameplayStop();
  },
  endRound(left) {
    if (this.state !== 'play') return;
    const P = this.party;
    const w = left.length === 1 ? left[0] : left.find(x => x.human) || null;
    this.state = 'ending'; this.endT = 99; this.slowT = 0.6;
    if (w && w.human) { P.score[w.slot - 1]++; this.confetti(w.x, w.y); AU.win(); }
    else AU.lose();
    Missions.track('party', 1);
    Portal.gameplayStop();
    setTimeout(() => UI.partyRound(w), 1100);
  },
  confetti(x, y) {
    const cols = ['#ff5a4e', '#ffe25a', '#5fb8ff', '#a6f04a', '#ff9ad5', '#ffffff'];
    for (let i = 0; i < 80; i++) this.fx.push({ type: 'p', x, y, vx: rand(-300, 300), vy: rand(-300, 300), vz: rand(400, 900), z: 0, life: rand(1.2, 2), max: 2, col: pick(cols), size: rand(3, 6), conf: 1 });
  },
  tutorialStep(dt) {
    const T = this.tutorial, p = this.players[0];
    if (!p) return;
    T.t += dt;
    if (Math.hypot(p.vx, p.vy) > 80) T.moved += dt;
    let want = 0;
    if (T.moved > 0.6) want = 1;
    if (want === 1 && T.dashed > 0) want = 2;
    if (want === 2 && (T.charged > 0 || T.t > 25)) want = 3;
    if (want === 3 && (T.ab > 0 || T.t > 35)) want = 4;
    if (want !== T.step) { T.step = want; UI.tutorialHint(want); }
  },

  // --- results & rewards -------------------------------------------------------
  makeResult(place, o) {
    const S = Save.d, n = this.orbs.length;
    const res = { mode: this.mode, place, n, kos: o.kos, time: o.survived, coins: 0, rp: 0, rpBefore: S.rp, unlocks: [], dailyScore: 0, newBest: false };
    const coinTable = [60, 42, 32, 24, 18, 14, 11, 8];
    res.coins = (coinTable[place - 1] || 8) + o.kos * 8;
    if (this.mode === 'royale' || this.mode === 'tutorial') {
      const tier = rankOf(S.rp).i;
      const gain = [32, 20, 12, 5, 0, -3, -6, -9][place - 1] || 0;
      res.rp = gain < 0 ? Math.round(gain * clamp(tier / 2, 0, 1.6)) : gain;
      res.rp += o.kos * 3;
      if (this.mode === 'tutorial') res.rp = Math.max(res.rp, 20);
      const before = rankOf(S.rp);
      S.rp = Math.max(0, S.rp + res.rp);
      const after = rankOf(S.rp);
      if (after.i > before.i) {
        res.rankUp = after.name;
        for (const k of ABILITY_KEYS) if (ABILITIES[k].rank === after.i) res.unlocks.push(ABILITIES[k].icon + ' ' + ABILITIES[k].name + ' ability');
        for (const k of ARENA_KEYS) if (ARENAS[k].unlock === after.i && after.i > 0) res.unlocks.push('🏝 ' + ARENAS[k].name + ' arena');
      }
      if (before.rp < 120 && S.rp >= 120) res.unlocks.push('🏝 Pinball arena');
      S.stats.matches++;
      if (place === 1) { S.stats.wins++; S.stats.streak++; S.stats.bestStreak = Math.max(S.stats.bestStreak, S.stats.streak); } else S.stats.streak = 0;
      if (place === 1) Missions.track('win', 1);
      if (place <= 3) Missions.track('top3', 1);
      if (S.stats.streak >= 2 && place === 1) { res.streakBonus = Math.min(50, S.stats.streak * 10); res.coins += res.streakBonus; }
    }
    if (this.mode === 'daily') {
      const D = S.daily;
      res.dailyScore = (n + 1 - place) * 100 + o.kos * 60 + Math.round(o.survived);
      if (D.day !== this.daily.key) {
        D.streak = D.lastDay && dayNumber(this.daily.key) - dayNumber(D.lastDay) === 1 ? D.streak + 1 : 1;
        D.day = this.daily.key; D.best = 0; D.played = 0; D.lastDay = this.daily.key;
        res.coins += 40 + Math.min(6, D.streak) * 10; res.firstDaily = true;
      }
      D.played++;
      if (res.dailyScore > D.best) { D.best = res.dailyScore; res.newBest = true; }
      res.dailyStreak = D.streak;
      if (place === 1) Missions.track('win', 1);
      if (place <= 3) Missions.track('top3', 1);
    }
    Missions.track('survive', Math.round(o.survived));
    S.stats.kos += o.kos;
    S.coins += res.coins;
    Save.write();
    return res;
  },
  // --- small fx helpers ----------------------------------------------------------
  sparks(x, y, n, col, sp) {
    for (let i = 0; i < n; i++) { const a = rand(0, TAU), v = rand(0.3, 1) * sp; this.fx.push({ type: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, vz: rand(50, 250), z: 8, life: rand(0.25, 0.5), max: 0.5, col, size: rand(2, 4) }); }
  },
  ring(x, y, r0, r1, life, col) { this.fx.push({ type: 'r', x, y, r0, r1, life, max: life, col }); },
  text(x, y, s, col, size) { this.texts.push({ x, y, s, col, size: size || 20, life: 1.1, max: 1.1 }); },
};
const SIMILAR = { tomato: ['lava'], lava: ['tomato'], sky: ['galaxy'], snow: ['beach'], sunny: ['gold'], gold: ['sunny'], lime: ['melon'], melon: ['lime'] };
function cpuTag() { return ' <i class="cpu">CPU</i>'; }

// Daily missions: three per day, scaled to rank, completed automatically.
const Missions = {
  ensure() {
    const S = Save.d, day = todayKey();
    if (S.missions && S.missions.day === day) return S.missions;
    const rng = makeRng(day * 13 + 5), tier = Math.min(2, Math.floor(rankOf(S.rp).i / 2));
    const pool = MISSION_POOL.slice(), list = [];
    while (list.length < 3) {
      const m = pool.splice(Math.floor(rng() * pool.length), 1)[0];
      list.push({ id: m.id, n: m.n[tier], reward: m.reward[tier], prog: 0, done: 0 });
    }
    S.missions = { day, list };
    Save.write();
    return S.missions;
  },
  text(m) {
    const def = MISSION_POOL.find(x => x.id === m.id);
    return def.text.replace('{n}', m.n).replace('{es}', m.n === 1 ? '' : 'es').replace('{s}', m.n === 1 ? '' : 's');
  },
  track(id, amt) {
    const M = this.ensure();
    for (const m of M.list) {
      if (m.id !== id || m.done) continue;
      m.prog = Math.min(m.n, m.prog + amt);
      if (m.prog >= m.n) {
        m.done = 1; Save.d.coins += m.reward;
        UI.toast('✔ Mission complete: ' + this.text(m) + ' <b>+' + m.reward + ' 🪙</b>');
        AU.coin();
      }
    }
    Save.write();
  },
};
