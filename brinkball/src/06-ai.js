// ---------------------------------------------------------------------------
// CPU rivals. Each one has a skill (0..1, from the player's rank) and a
// personality. They read the arena, line up shoves toward the nearest edge,
// dodge incoming dashes and use their ability, with human-like reaction lag.
// ---------------------------------------------------------------------------
const PERSONAS = [
  { id: 'brawler', aggro: 1.0, caution: 0.6, greed: 0.5 },
  { id: 'hunter', aggro: 0.85, caution: 0.8, greed: 0.3 },
  { id: 'turtle', aggro: 0.45, caution: 1.0, greed: 0.6 },
  { id: 'opportunist', aggro: 0.7, caution: 0.85, greed: 0.9 },
];
function makeAI(skill) {
  return { skill, p: pick(PERSONAS), rest: rand(1.5, 3.5), strafe: Math.random() < 0.5 ? 1 : -1, think: 0, target: null, mx: 0, my: 0, chargeFor: 0, holdT: 0, err: rand(-1, 1), wander: rand(0, TAU) };
}
const AI = {
  // Fraction of probe points around (x, y) that are on solid ground.
  safeAt(G, x, y) {
    const t = G.arena.tileAt(x, y);
    if (!t || t.state >= 2) return 0;
    return t.state === 1 ? 0.25 : 1;
  },
  centre(G) {
    let sx = 0, sy = 0, n = 0;
    for (const t of G.arena.tiles) if (t.state === 0) { sx += t.x; sy += t.y; n++; }
    return n ? [sx / n, sy / n] : [0, 0];
  },
  update(o, G, dt) {
    const a = o.ai, s = a.skill;
    if (o.charging > 0) { // keep holding until the planned charge is reached
      a.holdT -= dt;
      if (a.holdT <= 0) { o.dashHeld = false; o.wantDash = true; }
    }
    a.rest -= dt;
    a.think -= dt;
    if (o.teeter > 0 && a.think > 0.05) a.think = 0.05;
    if (a.think > 0) return;
    a.think = lerp(0.32, 0.08, s) * rand(0.8, 1.25);
    const [cx, cy] = this.centre(G);
    // 1) Danger: look ahead along our velocity.
    const look = lerp(0.18, 0.42, s) * (G.arena.friction(o.x, o.y) === 'ice' ? 2.2 : 1);
    const px = o.x + o.vx * look, py = o.y + o.vy * look;
    const here = this.safeAt(G, o.x, o.y), ahead = this.safeAt(G, px, py);
    let mx = 0, my = 0;
    const toC = Math.atan2(cy - o.y, cx - o.x);
    const danger = (here < 1 ? 1 : 0) + (ahead < 1 ? 1 : 0) + (o.teeter > 0 ? 2 : 0);
    if (danger && (o.teeter > 0 && Math.random() < lerp(0.5, 0.95, s) || Math.random() < lerp(0.55, 1, s) * a.p.caution)) {
      // Steer to the safest of 8 directions, biased to the centre.
      let best = -1, ba = toC;
      for (let i = 0; i < 8; i++) {
        const ang = toC + (i - 3.5) * 0.45;
        let sc = 0;
        for (const d of [60, 120]) sc += this.safeAt(G, o.x + Math.cos(ang) * d, o.y + Math.sin(ang) * d);
        sc -= Math.abs(angDiff(ang, toC)) * 0.2;
        if (sc > best) { best = sc; ba = ang; }
      }
      mx = Math.cos(ba); my = Math.sin(ba);
      // Panic ability: blink or anchor when about to go over.
      if (ahead === 0 && o.abCd <= 0 && Math.random() < s) {
        if (o.ability === 'blink') { o.inMove = [mx, my]; o.wantAbility = true; }
        if (o.ability === 'anchor' && here === 1) o.wantAbility = true;
      }
      o.inMove = [mx, my];
      return;
    }
    // 2) Threat: someone dashing at us?
    for (const e of G.orbs) {
      if (e === o || !e.canAct() || !e.dashing) continue;
      const dx = o.x - e.x, dy = o.y - e.y, d = Math.hypot(dx, dy);
      if (d > 200) continue;
      const head = Math.atan2(e.vy, e.vx), to = Math.atan2(dy, dx);
      if (Math.abs(angDiff(head, to)) < 0.5 && Math.random() < s * 0.8) {
        if (o.ability === 'anchor' && o.abCd <= 0) { o.wantAbility = true; return; }
        const side = Math.sign(angDiff(head, toC)) || 1;
        const ang = head + side * Math.PI / 2;
        o.inMove = [Math.cos(ang), Math.sin(ang)];
        if (o.dashCd <= 0 && d < 120 && Math.random() < s * 0.6 && this.safeAt(G, o.x + Math.cos(ang) * 200, o.y + Math.sin(ang) * 200) === 1) o.wantDash = true;
        return;
      }
    }
    // 3) Power-ups within reach.
    for (const p of G.pickups) {
      const d = Math.hypot(p.x - o.x, p.y - o.y);
      if (d < 260 * a.p.greed + 60 && this.safeAt(G, p.x, p.y) === 1) {
        const ang = Math.atan2(p.y - o.y, p.x - o.x);
        o.inMove = [Math.cos(ang), Math.sin(ang)];
        return;
      }
    }
    // 4) Hunt: pick a victim, preferring close, hot and near-the-edge ones.
    if (!a.target || !a.target.canAct() || Math.random() < 0.08) {
      let best = -1e9, tgt = null;
      for (const e of G.orbs) {
        if (e === o || !e.canAct()) continue;
        const d = Math.hypot(e.x - o.x, e.y - o.y);
        const edge = Math.hypot(e.x - cx, e.y - cy);
        let sc = -d + edge * 0.5 + e.heat * 2 + rand(0, 80);
        if (e.human && G.mode === 'royale') sc += G.humanFocus; // slightly gentler early on
        if (sc > best) { best = sc; tgt = e; }
      }
      a.target = tgt;
    }
    const t = a.target;
    if (!t) { o.inMove = [Math.cos(toC), Math.sin(toC)]; return; }
    // Push direction: from the centre through the target, towards its nearest edge.
    let ox = t.x - cx, oy = t.y - cy;
    const ol = Math.hypot(ox, oy) || 1; ox /= ol; oy /= ol;
    const want = o.r + t.r + lerp(40, 70, s);
    const gx = t.x - ox * want, gy = t.y - oy * want;
    const dx = t.x - o.x, dy = t.y - o.y, dist = Math.hypot(dx, dy);
    const aim = Math.atan2(dy, dx);
    const align = Math.abs(angDiff(aim, Math.atan2(oy, ox)));
    let ang;
    if (a.rest > 0) { // between attacks: circle at a distance, looking for an opening
      const away = Math.atan2(o.y - t.y, o.x - t.x) + a.strafe * 0.5;
      const hx = t.x + Math.cos(away) * 170, hy = t.y + Math.sin(away) * 170;
      ang = Math.atan2(hy - o.y, hx - o.x);
      const k = Math.min(1, Math.hypot(hx - o.x, hy - o.y) / 80) * 0.8;
      if (Math.random() < 0.02) a.strafe *= -1;
      o.inMove = [Math.cos(ang) * k, Math.sin(ang) * k];
      return;
    }
    if (align < 0.7 || dist < want * 0.9) ang = aim; // lined up: go straight in
    else ang = Math.atan2(gy - o.y, gx - o.x);   // swing round behind it
    ang += a.err * (1 - s) * 0.5;
    mx = Math.cos(ang) * lerp(0.75, 1, a.p.aggro); my = Math.sin(ang) * lerp(0.75, 1, a.p.aggro);
    o.inMove = [mx, my];
    // Dash when lined up and the landing spot is safe.
    if (o.dashCd <= 0 && !o.dashing && o.charging === 0 && dist < lerp(150, 230, s) && align < lerp(0.9, 0.55, s)) {
      const land = 180;
      const lx = o.x + Math.cos(aim) * land, ly = o.y + Math.sin(aim) * land;
      const safeLand = this.safeAt(G, lx, ly) === 1 || Math.random() > s; // weaker bots overshoot
      if (safeLand && Math.random() < a.p.aggro * lerp(0.2, 0.55, s)) {
        o.inMove = [Math.cos(aim), Math.sin(aim)];
        if (dist > 120 && t.heat > 30 && Math.random() < s) { o.dashHeld = true; a.holdT = rand(0.25, 0.55); }
        else o.wantDash = true;
        a.rest = rand(1.4, 3.4) * lerp(1.5, 0.75, s) * (1.3 - a.p.aggro * 0.4);
      }
    }
    // Abilities on offence.
    if (o.abCd <= 0 && Math.random() < s * 0.7) {
      const near = G.orbs.filter(e => e !== o && e.canAct() && Math.hypot(e.x - o.x, e.y - o.y) < 150);
      if (o.ability === 'shock' && near.length && near.some(e => Math.hypot(e.x - cx, e.y - cy) > Math.hypot(o.x - cx, o.y - cy))) o.wantAbility = true;
      if (o.ability === 'magnet' && near.length >= 2 && here === 1) o.wantAbility = true;
      if (o.ability === 'blink' && dist > 250 && align < 0.5) {
        const bx = o.x + Math.cos(aim) * 150, by = o.y + Math.sin(aim) * 150;
        if (this.safeAt(G, bx, by) === 1) o.wantAbility = true;
      }
    }
    // Sweeper: dash through the beam rather than get swatted.
    if (G.arena.sweep && o.dashCd <= 0) {
      const sw = G.arena.sweep, myA = Math.atan2(o.y, o.x), d0 = Math.hypot(o.x, o.y);
      const da = angDiff(sw.a, myA) * sw.dir;
      if (d0 < sw.len && da > 0 && da < 0.35 && Math.random() < s) {
        const perp = sw.a + sw.dir * Math.PI / 2 * -1;
        o.inMove = [Math.cos(perp), Math.sin(perp)]; o.wantDash = true;
      }
    }
  },
};
