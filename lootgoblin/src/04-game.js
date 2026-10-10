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
