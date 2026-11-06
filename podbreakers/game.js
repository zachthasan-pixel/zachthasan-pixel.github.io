/* Pod Breakers - gameplay simulation */
(function (PB) {
  'use strict';
  var U = PB.U, W = PB.W, M = PB.Models, S = PB.save, I = PB.input, UI = PB.UI, A = PB.audio;
  var GM = PB.Game = {};
  var g = null; // current run state
  var DT = 1 / 60;
  GM.DT = DT;

  // ---------- helpers ----------
  function add(o) { W.scene.add(o); return o; }
  function rem(o) { if (o && o.parent) o.parent.remove(o); }
  function up(id) { return g.up[id] || 0; }
  function dexBonus(type) { var n = S.dex[type] || 0, t = 0; PB.DEX_TIERS.forEach(function (x) { if (n >= x) t++; }); return 1 + t * 0.05; }
  function pushOut(o, r) {
    for (var i = 0; i < W.colliders.length; i++) {
      var c = W.colliders[i], dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz), m = c.r + r;
      if (d < m && d > 0.001) { o.x = c.x + dx / d * m; o.z = c.z + dz / d * m; }
    }
    var gd = Math.hypot(o.x, o.z), gm = 2.6 + r;
    if (gd < gm && gd > 0.001) { o.x = o.x / gd * gm; o.z = o.z / gd * gm; }
  }
  function clampArena(o, r) { var d = Math.hypot(o.x, o.z), m = W.arenaR - r; if (d > m) { o.x = o.x / d * m; o.z = o.z / d * m; } }

  GM.stats = function () {
    var h = g.hero, wpn = PB.WEAPONS[g.weapon], glass = g.mod === 'glass';
    h.maxHp = (100 + 15 * PB.perkLvl('armor') + 25 * up('hp')) * (glass ? 0.5 : 1);
    h.dmgMul = (1 + 0.1 * PB.perkLvl('power')) * (1 + 0.25 * up('dmg')) * (glass ? 2 : 1) * (g.mod === 'turrets' ? 0.75 : 1);
    h.rateMul = (1 + 0.08 * PB.perkLvl('trigger')) * (1 + 0.18 * up('rate'));
    h.speed = 8.6 * (1 + 0.06 * PB.perkLvl('agility')) * (1 + 0.1 * up('speed'));
    h.magnet = 4.6 * (1 + 0.15 * PB.perkLvl('magnet')) * (1 + 0.6 * up('magnet'));
    h.dashMax = 2.4 * Math.pow(0.75, up('dash'));
    h.crit = 0.05 + 0.12 * up('crit');
    g.gen.maxHp = 500 + 80 * PB.perkLvl('shield') + 150 * up('gen');
    h.wpn = wpn;
  };

  // ---------- run setup ----------
  GM.newRun = function (opts) {
    GM.clear();
    var daily = opts.daily ? PB.Meta.dailyMod() : null;
    var zone = daily ? daily.zone : S.zone;
    g = GM.g = {
      zone: zone, Z: PB.ZONES[zone], mod: daily ? daily.mod.id : null, daily: !!daily, weapon: S.weapon,
      wave: 0, waveState: 'ready', waveT: 0, podQueue: [], podTimer: 2, enemies: [], pods: [], bullets: [], ebullets: [], pickups: [], puddles: [], turrets: [], orbs: [], strikes: [], slams: [],
      cores: 0, xp: 0, level: 1, xpNeed: 7, score: 0, kills: 0, podsBroken: 0, podsHatched: 0, bossKills: 0, combo: 0, comboT: 0, bestCombo: 0, strike: 0.2 * PB.perkLvl('uplink'),
      up: {}, t: 0, hitstop: 0, pendingLv: 0, boss: null, over: false, started: false, revived: false, alertT: 0, genPulseT: 4, tut: S.tutorialDone ? 99 : 0, tutT: 0, buildT: 0, waveSub: '', turretBuilds: 0, strikesUsed: 0, brutes: 0, firstPodShown: false
    };
    W.setZone(zone, g.mod);
    // generator
    var gm = M.generator(); add(gm.group);
    g.gen = { x: 0, z: 0, r: 2.6, hp: 500, maxHp: 500, m: gm, hitT: 0 };
    // pads
    W.padPositions.forEach(function (p, i) {
      var pd = M.pad(); pd.group.position.set(p[0], 0, p[1]); add(pd.group);
      g.turrets.push({ x: p[0], z: p[1], lvl: 0, pad: pd, obj: null, cd: 0, yaw: 0 });
    });
    // hero
    var hm = M.hero(); add(hm.group);
    g.hero = { x: 0, z: 6, vx: 0, vz: 0, hp: 100, maxHp: 100, m: hm, aimX: 0, aimZ: 1, fireCd: 0, dashCd: 0, dashMax: 2.4, dashT: 0, dashX: 0, dashZ: 0, inv: 0, hurtT: 0, walk: 0, dashHit: null, moveK: 0 };
    GM.stats();
    g.hero.hp = g.hero.maxHp; g.gen.hp = g.gen.maxHp;
    W.camT = null;
    return g;
  };
  GM.clear = function () {
    if (!g) return;
    var all = [g.hero && g.hero.m.group, g.gen && g.gen.m.group];
    g.enemies.forEach(function (e) { all.push(e.R.group, e.warnM); });
    g.pods.forEach(function (p) { all.push(p.R.group, p.warn); });
    g.bullets.concat(g.ebullets).forEach(function (b) { all.push(b.obj.group); });
    g.pickups.forEach(function (p) { all.push(p.obj.group); });
    g.puddles.forEach(function (p) { all.push(p.m); });
    g.turrets.forEach(function (t) { all.push(t.pad.group); if (t.obj) all.push(t.obj.group); });
    g.orbs.forEach(function (o) { all.push(o.obj.group); });
    g.strikes.forEach(function (s) { all.push(s.beam, s.warn); });
    g.slams.forEach(function (s) { all.push(s.warn); });
    all.forEach(rem);
    W.clearFx(); g = GM.g = null;
  };

  // ---------- waves ----------
  var UNLOCK = { skitter: 1, gloop: 2, spitter: 3, wisp: 4, stalker: 6, brute: 7 };
  function startWave() {
    g.wave++; g.waveState = 'fight'; g.waveT = 0;
    var w = g.wave, budget = Math.round(6 + w * 4.6 + Math.pow(w, 1.35));
    var types = Object.keys(UNLOCK).filter(function (k) { return w >= UNLOCK[k]; });
    var q = [];
    var bossWave = w % 5 === 0;
    if (bossWave) budget = Math.round(budget * 0.45);
    while (budget > 0) {
      var size = U.randi(2, 3 + Math.min(4, Math.floor(w / 3))), pod = [];
      for (var i = 0; i < size && budget > 0; i++) {
        var t = U.pick(types);
        if (t === 'brute' && Math.random() < 0.6) t = 'skitter';
        if (g.mod === 'swarm' && Math.random() < 0.5) t = 'skitter';
        pod.push(t); budget -= PB.ENEMIES[t].cost;
        if (t === 'skitter' && g.mod === 'swarm') pod.push('skitter');
      }
      q.push(pod);
    }
    g.podQueue = q;
    g.podTimer = w === 1 ? 1.2 : 2.0;
    g.podInterval = Math.max(1.3, 4.0 - w * 0.17) * (g.mod === 'rain' ? 0.55 : 1);
    g.boss = null;
    if (bossWave) {
      var bt = (w / 5) % 2 === 1 ? 'behemoth' : 'overmind';
      g.bossPending = bt; g.bossT = 2.5;
      UI.toast('☠ BOSS INCOMING ☠', '#ff3fa4'); A.sfx('roar');
    } else { UI.toast('WAVE ' + w, '#3ff0ff'); A.sfx('wave'); }
    g.waveSub = PB.ZONES[g.zone].name + (g.mod ? ' · ' + PB.MODS.filter(function (m) { return m.id === g.mod; })[0].name : '');
    PB.Meta.progress('wave', w, true);
  }
  function waveCleared() {
    g.waveState = 'clear'; g.waveT = 3.5;
    var rep = g.gen.maxHp * 0.08; g.gen.hp = Math.min(g.gen.maxHp, g.gen.hp + rep);
    g.score += 250 * g.wave;
    UI.toast('WAVE ' + g.wave + ' CLEARED!', '#a6ff3a'); A.sfx('levelup');
    if (g.wave === 10) {
      UI.toast('ZONE SECURED!', '#ffd23f'); PB.platform.happy();
      if (!g.daily && S.zonesUnlocked < PB.ZONES.length && g.zone === S.zonesUnlocked - 1) { S.zonesUnlocked++; PB.persist(); UI.toast('NEW ZONE UNLOCKED: ' + PB.ZONES[g.zone + 1].name.toUpperCase(), '#ffd23f'); }
    }
    if (g.daily && g.wave >= 5 && !S.daily.done) { S.daily.done = true; S.credits += 400; PB.persist(); UI.toast('DAILY CHALLENGE COMPLETE! +400', '#ffd23f'); }
  }

  // ---------- pods ----------
  function dropPod(contents, opts) {
    opts = opts || {};
    var x, z, tries = 0, h = g.hero;
    do {
      var a = Math.random() * 6.283, d = U.rand(13, 33);
      if (g.wave <= 2 && tries < 20) { a = Math.atan2(h.z, h.x) + U.rand(-1.2, 1.2); d = U.rand(12, 24); } // early pods appear near the action
      x = Math.cos(a) * d; z = Math.sin(a) * d; tries++;
    } while (tries < 30 && (W.colliders.some(function (c) { return U.dist2(x, z, c.x, c.z) < (c.r + 2) * (c.r + 2); }) || g.pods.some(function (p) { return U.dist2(x, z, p.x, p.z) < 16; })));
    if (opts.x != null) { x = opts.x; z = opts.z; }
    var R = M.pod(); add(R.group); R.group.position.set(x, 0, z);
    if (opts.big) R.group.scale.setScalar(1.8);
    R.body.position.y = 60; R.trail.visible = true; R.timer.visible = false;
    var warn = new THREE.Mesh(new THREE.RingGeometry(1.6, 2.0, 32), new THREE.MeshBasicMaterial({ color: 0xff3f6a, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.set(x, 0.08, z); add(warn);
    g.podsDropped = (g.podsDropped || 0) + 1;
    var fast = !opts.boss && g.podsDropped > 1 && Math.random() < (g.wave <= 2 ? 0.4 : 0.25);
    var hatch = fast ? 2.4 : (g.wave <= 1 ? 7.5 : Math.max(4.8, 6.6 - g.wave * 0.12)) * (g.mod === 'rain' ? 1.25 : 1);
    var hp = Math.round((120 + g.wave * 24) * g.Z.hpMul * (opts.big ? 3 : 1));
    g.pods.push({ x: x, z: z, r: opts.big ? 2 : 1.15, R: R, warn: warn, state: 'fall', fallT: 1.25, hp: hp, maxHp: hp, hatchT: hatch, hatchMax: hatch, contents: contents, boss: opts.boss, flash: 0, ringT: 0 });
    A.sfx('whistle');
  }
  function podLand(p) {
    p.state = 'land'; p.R.body.position.y = 0; p.R.trail.visible = false; p.R.timer.visible = !p.boss; rem(p.warn);
    W.addShake(p.boss ? 0.9 : 0.35); A.sfx('impact');
    W.ring(p.x, p.z, 0.5, p.boss ? 10 : 5, 0.5, 0xff7ac8); W.smokePuff(p.x, 0.3, p.z, 10, 0x2a2030, 2);
    W.burst(p.x, 0.5, p.z, 0xff9a40, 26, 9, 0.6, 0.35);
    W.decal(p.x, p.z, p.boss ? 5 : 2.6, 0x0a0608, 0.7);
    var h = g.hero, d = Math.hypot(h.x - p.x, h.z - p.z);
    if (d < (p.boss ? 6 : 3.2)) hurtHero(p.boss ? 25 : 12, p.x, p.z);
    if (p.boss) { hatchPod(p); return; }
    if (!g.firstPodShown && g.tut <= 1) { g.firstPodShown = true; g.tut = 1; }
  }
  function hatchPod(p) {
    A.sfx('hatch'); W.burst(p.x, 1.2, p.z, 0xff3fa4, 30, 8, 0.7, 0.4); W.ring(p.x, p.z, 0.5, 3.5, 0.4, 0xff3fa4);
    p.contents.forEach(function (t, i) {
      var a = i / p.contents.length * 6.283 + Math.random();
      spawnEnemy(t, p.x + Math.cos(a) * 1.4, p.z + Math.sin(a) * 1.4);
    });
    if (p.boss) spawnEnemy(p.boss, p.x, p.z, true);
    if (!p.boss) g.podsHatched++;
    killPod(p, false);
    if (g.tut === 1) g.tut = 2;
  }
  function killPod(p, broken) {
    rem(p.R.group); rem(p.warn);
    g.pods.splice(g.pods.indexOf(p), 1);
    if (broken) {
      var val = p.contents.reduce(function (s, t) { return s + PB.ENEMIES[t].cost; }, 0);
      var cores = Math.round((val * 0.9 + 2) * (1 + 0.4 * up('pod')) * (1 + 0.12 * PB.perkLvl('salvage')));
      for (var i = 0; i < Math.min(8, cores); i++) dropPickup('core', p.x, p.z, Math.ceil(cores / Math.min(8, cores)));
      for (var j = 0; j < 2 + Math.floor(val / 3); j++) dropPickup('xp', p.x, p.z, 1);
      g.podsBroken++; S.totalPods++; g.score += 60 * g.wave; addStrike(0.08); addCombo();
      A.sfx('podbreak'); W.addShake(0.25);
      W.burst(p.x, 1.2, p.z, 0xff3fa4, 40, 11, 0.8, 0.45); W.burst(p.x, 1.2, p.z, 0xffffff, 12, 6, 0.4, 0.3); W.ring(p.x, p.z, 0.5, 4, 0.35, 0xffffff);
      W.decal(p.x, p.z, 2.4, 0xc0208a, 0.6);
      if (g.podsBroken <= 3 || Math.random() < 0.25) UI.toast('POD BROKEN!', '#ff7ac8');
      PB.Meta.progress('pods', 1);
      if (g.tut === 1) g.tut = 2;
    }
  }
  GM.dropPod = dropPod;

  // ---------- enemies ----------
  function spawnEnemy(type, x, z, isBoss, mini) {
    var D = PB.ENEMIES[type];
    var elite = !isBoss && !mini && g.wave >= 3 && Math.random() < 0.03 + g.wave * 0.008;
    var R = M.alien(type, elite); add(R.group);
    var hpMul = g.Z.hpMul * (1 + 0.11 * (g.wave - 1) + 0.06 * Math.pow(Math.max(0, g.wave - 9), 1.35)) * (elite ? 3 : 1) * (g.mod === 'giants' ? 1.6 : 1) * (g.mod === 'swarm' && type === 'skitter' ? 0.6 : 1);
    if (isBoss) hpMul = g.Z.hpMul * (1 + 0.15 * (g.wave - 5)) * (g.wave <= 5 ? 0.85 : 1);
    var e = { type: type, D: D, x: x, z: z, y: 0, hp: D.hp * hpMul * (mini ? 0.35 : 1), maxHp: 0, r: D.r * (elite ? 1.3 : 1) * (mini ? 0.6 : 1) * (g.mod === 'giants' ? 1.3 : 1), speed: D.speed * U.rand(0.9, 1.1) * (1 + Math.min(0.3, g.wave * 0.015)), dmg: D.dmg * (1 + 0.05 * (g.wave - 1) + 0.03 * Math.max(0, g.wave - 9)) * (elite ? 1.4 : 1),
      R: R, atkCd: U.rand(0.3, 1), t: Math.random() * 10, state: 'move', stT: 0, slowT: 0, flash: 0, elite: elite, mini: mini, boss: isBoss, cd1: U.rand(1, 3), cd2: U.rand(2, 5), cd3: 6, vx: 0, vz: 0, orbHit: {} };
    e.maxHp = e.hp;
    if (isBoss) e.dmg *= g.wave <= 5 ? 0.55 : 0.75;
    if (mini) R.body.scale.multiplyScalar(0.6);
    if (g.mod === 'giants') R.group.scale.setScalar(1.3);
    if (type === 'wisp' || type === 'overmind') e.y = type === 'wisp' ? 2.6 : 2.4;
    R.group.position.set(x, e.y, z);
    g.enemies.push(e);
    if (isBoss) {
      g.boss = e; UI.toast(D.name.toUpperCase(), '#ff3fa4'); A.sfx('roar'); W.addShake(1);
      PB.UI.bossBar && PB.UI.bossBar(e);
    }
    return e;
  }
  GM.spawnEnemy = spawnEnemy;

  function targetFor(e) {
    var h = g.hero, dh = Math.hypot(h.x - e.x, h.z - e.z), dg = Math.hypot(e.x, e.z);
    var hero = { x: h.x, z: h.z, r: 0.6, gen: false, d: dh }, gen = { x: 0, z: 0, r: 2.6, gen: true, d: dg };
    switch (e.type) {
      case 'skitter': return dh < 13 ? hero : gen;
      case 'gloop': return dh < 6 ? hero : gen;
      case 'stalker': return hero;
      case 'wisp': return dh < 18 ? hero : gen;
      case 'spitter': return dh < 9 ? hero : gen;
      case 'brute': return dh < 9 ? hero : gen;
      default: return hero;
    }
  }
  function damageEnemy(e, dmg, opts) {
    if (e.dead) return;
    opts = opts || {};
    var crit = !opts.noCrit && Math.random() < g.hero.crit;
    dmg *= dexBonus(e.type) * (crit ? 2.5 : 1);
    e.hp -= dmg; e.flash = 0.08;
    if (opts.slow) e.slowT = 1.5;
    if (crit) W.burst(e.x, e.y + 1.2, e.z, 0xffe040, 5, 6, 0.3, 0.3);
    if (!opts.silent) A.sfx('hit', crit ? 1.4 : 1);
    if (e.hp <= 0) killEnemy(e);
  }
  GM.damageEnemy = damageEnemy;
  function killEnemy(e) {
    e.dead = true;
    var D = e.D, col = D.color;
    g.enemies.splice(g.enemies.indexOf(e), 1); rem(e.R.group); if (e.warnM) rem(e.warnM);
    g.kills++; S.totalKills++;
    S.dex[e.type] = (S.dex[e.type] || 0) + 1;
    if (S.dex[e.type] === 1) { UI.toast('NEW ALIEN CATALOGUED: ' + D.name.toUpperCase(), '#c46bff'); A.sfx('dex'); }
    else if (PB.DEX_TIERS.indexOf(S.dex[e.type]) >= 0) UI.toast(D.name.toUpperCase() + ' XENODEX TIER UP! +5% DMG', '#c46bff');
    addCombo(); addStrike((e.boss ? 0.5 : 0.035) * (1 + 0.35 * up('strike')));
    g.score += Math.round((D.xp * 25) * (1 + g.combo * 0.05) * (e.elite ? 3 : 1));
    var big = e.boss || e.type === 'brute' || e.elite;
    W.burst(e.x, e.y + 0.8, e.z, col, big ? 50 : 18, big ? 12 : 8, 0.7, big ? 0.5 : 0.35);
    W.burst(e.x, e.y + 0.8, e.z, 0xffffff, big ? 14 : 5, 6, 0.3, 0.25);
    if (e.y < 1) W.decal(e.x, e.z, e.r * 1.8, col, 0.55);
    A.sfx(big ? 'boom' : 'kill', big ? 1 : U.rand(0.8, 1.2)); A.sfx('splat');
    if (big) { W.addShake(e.boss ? 1.2 : 0.3); g.hitstop = e.boss ? 0.35 : 0.06; W.ring(e.x, e.z, 0.5, e.boss ? 14 : 4, 0.5, col); }
    var xpN = D.xp * (e.elite ? 3 : 1), coreMul = (g.mod === 'giants' ? 2 : 1) * (1 + 0.12 * PB.perkLvl('salvage'));
    for (var i = 0; i < Math.min(10, xpN); i++) dropPickup('xp', e.x, e.z, xpN > 10 ? xpN / 10 : 1);
    var cores = (D.cost * 0.45 + (e.elite ? 6 : 0) + (e.boss ? 30 : 0)) * coreMul;
    var whole = Math.floor(cores) + (Math.random() < cores % 1 ? 1 : 0);
    for (var c = 0; c < Math.min(8, whole); c++) dropPickup('core', e.x, e.z, whole > 8 ? whole / 8 : 1);
    if (Math.random() < (e.elite ? 0.6 : e.boss ? 1 : 0.035)) dropPickup('heal', e.x, e.z, 1);
    if (e.type === 'gloop' && !e.mini) { for (var k = 0; k < 2; k++) { var m = spawnEnemy('gloop', e.x + (k ? 0.8 : -0.8), e.z, false, true); m.maxHp = m.hp; } }
    if (e.type === 'brute') { g.brutes++; PB.Meta.progress('brute', 1); }
    if (e.boss) {
      g.bossKills++; g.boss = null; PB.Meta.progress('boss', 1); PB.platform.happy();
      UI.toast(D.name.toUpperCase() + ' DESTROYED!', '#ffd23f'); g.score += 5000 * (g.wave / 5);
      g.enemies.slice().forEach(function (o) { if (o.type === 'skitter' || o.type === 'wisp') damageEnemy(o, 9999, { silent: true, noCrit: true }); });
    }
    PB.Meta.progress('kill', 1);
  }

  function hurtHero(dmg, sx, sz) {
    var h = g.hero; if (h.inv > 0 || g.over) return;
    h.hp -= dmg; h.inv = dmg >= 18 ? 0.9 : 0.35; h.hurtT = 0.25;
    A.sfx('hurt'); W.addShake(Math.min(0.6, dmg / 40));
    if (sx != null) { var dx = h.x - sx, dz = h.z - sz, d = Math.hypot(dx, dz) || 1; h.vx += dx / d * 8; h.vz += dz / d * 8; }
    W.burst(h.x, 1.4, h.z, 0xff4a5a, 8, 5, 0.3, 0.25);
    if (h.hp <= 0) { h.hp = 0; GM.onDeath('hero'); }
  }
  function hurtGen(dmg) {
    var G = g.gen; if (g.over) return;
    G.hp -= dmg; G.hitT = 0.2; g.alertT = 1.5;
    if (Math.random() < 0.3) A.sfx('gen');
    if (G.hp <= 0) { G.hp = 0; GM.onDeath('gen'); }
  }
  GM.hurtHero = hurtHero;

  function addCombo() { g.combo++; g.comboT = 2.5; if (g.combo > g.bestCombo) { g.bestCombo = g.combo; PB.Meta.progress('combo', g.combo, true); } }
  function addStrike(v) { var was = g.strike >= 1; g.strike = Math.min(1, g.strike + v); if (!was && g.strike >= 1) { UI.toast('ORBITAL STRIKE READY', '#ff9a2e'); A.sfx('strikeCall'); if (g.tut === 3 || (g.tut < 3 && !S.tutorialDone)) g.tut = Math.max(g.tut, 3); } }

  // ---------- pickups ----------
  function dropPickup(kind, x, z, val) {
    if (g.pickups.length > 260) { // merge into an existing pickup of the same kind
      for (var i = 0; i < g.pickups.length; i++) if (g.pickups[i].kind === kind) { g.pickups[i].val += val; return; }
    }
    var o = M.pickup(kind); add(o.group);
    var a = Math.random() * 6.28, s = U.rand(2, 6);
    g.pickups.push({ kind: kind, x: x, z: z, y: 0.6, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: U.rand(4, 7), val: val, obj: o, t: 0, pull: false });
  }
  GM.dropPickup = dropPickup;
  function gainXp(v) {
    g.xp += v;
    while (g.xp >= g.xpNeed) { g.xp -= g.xpNeed; g.level++; g.xpNeed = Math.round(6 + g.level * 3.6 + Math.pow(g.level, 1.55)); g.pendingLv++; }
  }

  // ---------- shooting ----------
  function nearestTarget(x, z, range, preferPods) {
    var best = null, bd = range * range;
    for (var i = 0; i < g.enemies.length; i++) { var e = g.enemies[i], d = U.dist2(x, z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
    if (preferPods) for (var j = 0; j < g.pods.length; j++) {
      var p = g.pods[j]; if (p.state !== 'land') continue;
      var pd = U.dist2(x, z, p.x, p.z) * (p.hatchT < 3 ? 0.35 : 0.7); if (pd < bd) { bd = pd; best = p; }
    }
    return best;
  }
  GM.nearestTarget = nearestTarget;
  function fire() {
    var h = g.hero, wp = h.wpn, ax = h.aimX, az = h.aimZ;
    var mz = h.m.muzzle.getWorldPosition(tmpV);
    h.m.flash.material.opacity = 1; h.m.flash.material.color.setHex(wp.color);
    if (wp.arc) {
      var first = nearestInCone(h.x, h.z, ax, az, wp.range, 0.6);
      if (!first) { W.lightning(mz.x, mz.y, mz.z, mz.x + ax * 6, 1.2, mz.z + az * 6, wp.color); A.sfx('arc'); return; }
      var hitList = [first], cur = first, px = mz.x, py = mz.y, pz = mz.z;
      for (var c = 0; c < wp.chain + up('multi'); c++) {
        var tx = cur.x, tz = cur.z, ty = (cur.y || 0) + 1.1;
        W.lightning(px, py, pz, tx, ty, tz, wp.color);
        if (cur.hatchT != null) damagePod(cur, wp.dmg * h.dmgMul); else damageEnemy(cur, wp.dmg * h.dmgMul * (c === 0 ? 1 : 0.8), { slow: up('cryo') > 0, silent: c > 0 });
        W.burst(tx, ty, tz, wp.color, 4, 4, 0.25, 0.25);
        px = tx; py = ty; pz = tz;
        var nxt = null, nd = 64;
        for (var i = 0; i < g.enemies.length; i++) { var e = g.enemies[i]; if (hitList.indexOf(e) >= 0) continue; var d = U.dist2(tx, tz, e.x, e.z); if (d < nd) { nd = d; nxt = e; } }
        if (!nxt) break; hitList.push(nxt); cur = nxt;
      }
      A.sfx('arc'); return;
    }
    var n = wp.count + up('multi'), spread = wp.spread + (up('multi') ? 0.12 : 0);
    var base = Math.atan2(ax, az);
    for (var k = 0; k < n; k++) {
      var a = base + (n > 1 ? (k / (n - 1) - 0.5) * spread * (wp.count > 1 ? 1 : n * 0.5) : 0) + U.rand(-0.02, 0.02);
      if (wp.count > 1) a += U.rand(-0.06, 0.06);
      var o = M.bolt(wp.color, wp.size); add(o.group);
      o.group.position.set(mz.x, 1.35, mz.z); o.group.rotation.y = a;
      g.bullets.push({ x: mz.x, z: mz.z, vx: Math.sin(a) * wp.speed, vz: Math.cos(a) * wp.speed, dmg: wp.dmg * h.dmgMul, pierce: wp.pierce + up('pierce'), life: wp.range / wp.speed, obj: o, hit: [], color: wp.color, player: true });
    }
    A.sfx(g.weapon === 'scatter' ? 'scatter' : g.weapon === 'rail' ? 'rail' : 'shoot');
    if (g.weapon === 'rail') W.addShake(0.12);
  }
  var tmpV = new THREE.Vector3();
  function nearestInCone(x, z, ax, az, range, cosMin) {
    var best = null, bd = range * range;
    var cands = g.enemies.concat(g.pods.filter(function (p) { return p.state === 'land'; }));
    for (var i = 0; i < cands.length; i++) {
      var e = cands[i], dx = e.x - x, dz = e.z - z, d2 = dx * dx + dz * dz; if (d2 > bd) continue;
      var d = Math.sqrt(d2) || 1; if ((dx * ax + dz * az) / d < cosMin && d > 2.5) continue;
      bd = d2; best = e;
    }
    return best;
  }
  function damagePod(p, dmg) {
    p.hp -= dmg * (1 + 0.7 * up('pod')); p.flash = 0.08; A.sfx('hit', 0.7);
    W.burst(p.x, 1.2, p.z, 0xff7ac8, 3, 5, 0.3, 0.25);
    if (p.hp <= 0) killPod(p, true);
  }
  function explode(x, z, r, dmg, color) {
    W.ring(x, z, 0.3, r, 0.3, color); W.burst(x, 0.8, z, color, 12, 7, 0.4, 0.35);
    for (var i = g.enemies.length - 1; i >= 0; i--) { var e = g.enemies[i]; if (e && U.dist2(x, z, e.x, e.z) < (r + e.r) * (r + e.r)) damageEnemy(e, dmg, { silent: true, noCrit: true }); }
  }

  // ---------- strike ----------
  function callStrike(tx, tz) {
    g.strike = 0; g.strikesUsed++; PB.Meta.progress('strike', 1);
    var r = 6.5 + 1.8 * up('strike');
    var warn = new THREE.Mesh(new THREE.RingGeometry(r - 0.4, r, 48), new THREE.MeshBasicMaterial({ color: 0xff9a2e, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    warn.rotation.x = -Math.PI / 2; warn.position.set(tx, 0.1, tz); add(warn);
    var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 80, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    beam.position.set(tx, 40, tz); add(beam);
    g.strikes.push({ x: tx, z: tz, r: r, t: 0.75, warn: warn, beam: beam, fired: false, life: 1.4 });
    A.sfx('strikeCall');
    if (g.tut === 3) { g.tut = 4; S.tutorialDone = true; PB.persist(); }
  }
  function strikeTarget() {
    var h = g.hero;
    if (I.lastDevice !== 'touch' && I.moved) { var p = W.screenToGround(I.mx, I.my); if (p) { var dx = p.x - h.x, dz = p.z - h.z, d = Math.hypot(dx, dz); if (d > 26) { p.x = h.x + dx / d * 26; p.z = h.z + dz / d * 26; } return { x: p.x, z: p.z }; } }
    var best = null, bn = -1;
    g.enemies.forEach(function (e) { var n = 0; g.enemies.forEach(function (o) { if (U.dist2(e.x, e.z, o.x, o.z) < 36) n += o.boss ? 10 : 1; }); if (U.dist2(e.x, e.z, h.x, h.z) < 30 * 30 && n > bn) { bn = n; best = e; } });
    if (best) return { x: best.x, z: best.z };
    return { x: h.x + h.aimX * 8, z: h.z + h.aimZ * 8 };
  }

  // ---------- main step ----------
  GM.step = function (dt) {
    if (!g || g.over) return;
    g.t += dt;
    var h = g.hero;
    stepHero(dt);
    if (!g.started) return;
    stepWave(dt);
    stepPods(dt);
    stepEnemies(dt);
    stepBullets(dt);
    stepEBullets(dt);
    stepPickups(dt);
    stepTurrets(dt);
    stepOrbs(dt);
    stepStrikes(dt);
    stepGen(dt);
    g.comboT -= dt; if (g.comboT <= 0) g.combo = 0;
    if (up('regen')) h.hp = Math.min(h.maxHp, h.hp + 1.5 * up('regen') * dt);
    g.alertT -= dt;
  };

  function stepHero(dt) {
    var h = g.hero, mx = 0, mz = 0;
    if (I.keys.KeyW || I.keys.KeyZ || I.keys.ArrowUp) mz -= 1;
    if (I.keys.KeyS || I.keys.ArrowDown) mz += 1;
    if (I.keys.KeyA || I.keys.KeyQ || I.keys.ArrowLeft) mx -= 1;
    if (I.keys.KeyD || I.keys.ArrowRight) mx += 1;
    if (I.stickActive) { mx = I.moveX; mz = I.moveZ; }
    var ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; ml = 1; }
    // input ramp so low-speed control is not twitchy
    h.moveK = ml > 0.05 ? Math.min(1, h.moveK + dt * 3.5) : Math.max(0, h.moveK - dt * 8);
    if (!g.started && (ml > 0.1 || I.mdown || I.dashPressed || I.startLatch)) GM.begin();
    I.startLatch = false;
    if (h.dashT > 0) {
      h.dashT -= dt; var ds = 6.5 / 0.18;
      h.x += h.dashX * ds * dt; h.z += h.dashZ * ds * dt;
      W.particles.spawn(h.x, 1.2, h.z, 0, 0.5, 0, 0.35, 0.7, 0.25, 0.94, 1, 0, 0);
      if (up('dash')) g.enemies.forEach(function (e) { if (h.dashHit.indexOf(e) < 0 && U.dist2(h.x, h.z, e.x, e.z) < (e.r + 1) * (e.r + 1)) { h.dashHit.push(e); damageEnemy(e, 22 * up('dash') * h.dmgMul, { noCrit: true }); } });
    } else {
      var sp = h.speed * (h.moveK * 0.6 + 0.4 * (ml > 0.05 ? 1 : 0)) * (h.slowT > 0 ? 0.6 : 1);
      var tvx = mx * sp, tvz = mz * sp, k = 1 - Math.exp(-dt * 14);
      h.vx += (tvx - h.vx) * k; h.vz += (tvz - h.vz) * k;
      h.x += h.vx * dt; h.z += h.vz * dt;
    }
    h.slowT = (h.slowT || 0) - dt;
    pushOut(h, 0.6); clampArena(h, 0.6);
    h.inv -= dt; h.hurtT -= dt; h.dashCd -= dt; h.fireCd -= dt;
    // dash
    if (I.dashPressed) {
      I.dashPressed = false;
      if (h.dashCd <= 0 && g.started) {
        var dx = ml > 0.1 ? mx / ml : h.aimX, dz = ml > 0.1 ? mz / ml : h.aimZ;
        h.dashX = dx; h.dashZ = dz; h.dashT = 0.18; h.inv = Math.max(h.inv, 0.32); h.dashCd = h.dashMax; h.dashHit = [];
        A.sfx('dash'); W.ring(h.x, h.z, 0.4, 2.5, 0.3, 0x3ff0ff);
      }
    }
    // aim
    var auto = I.lastDevice === 'touch' || PB.isTouchDevice || I.autoFire || !I.manual, tgt = null;
    g.autoOn = auto;
    if (auto) tgt = nearestTarget(h.x, h.z, I.lastDevice === 'touch' ? 20 : 24, true);
    if (I.lastDevice !== 'touch' && I.moved && (I.mdown || !auto || !tgt)) {
      var p = W.screenToGround(I.mx, I.my);
      if (p) { var ax = p.x - h.x, az = p.z - h.z, al = Math.hypot(ax, az); if (al > 0.3) { h.aimX = ax / al; h.aimZ = az / al; } }
    } else if (tgt) {
      var tx = tgt.x - h.x, tz = tgt.z - h.z, tl = Math.hypot(tx, tz) || 1; h.aimX = tx / tl; h.aimZ = tz / tl;
    } else if (ml > 0.1) { h.aimX = mx / ml; h.aimZ = mz / ml; }
    var wantFire = g.started && (I.mdown || (auto && tgt));
    if (wantFire && h.fireCd <= 0 && h.dashT <= 0) { h.fireCd = 1 / (h.wpn.rate * h.rateMul); fire(); }
    // strike
    if (I.strikePressed) { I.strikePressed = false; if (g.strike >= 1 && g.started) { var st = strikeTarget(); callStrike(st.x, st.z); } }
    // visuals
    var m = h.m; m.group.position.set(h.x, 0, h.z);
    var yaw = Math.atan2(h.aimX, h.aimZ); m.body.rotation.y = yaw;
    var spd = Math.hypot(h.vx, h.vz); h.walk += spd * dt * 1.6;
    var sw = Math.sin(h.walk) * Math.min(1, spd / 4) * 0.7;
    m.legs[0].rotation.x = sw; m.legs[1].rotation.x = -sw; m.body.position.y = Math.abs(Math.cos(h.walk)) * 0.06 * Math.min(1, spd / 4);
    m.flash.material.opacity = Math.max(0, m.flash.material.opacity - dt * 14);
    var flick = h.inv > 0 && h.dashT <= 0 && Math.floor(g.t * 20) % 2 === 0;
    m.body.visible = !flick || h.hurtT <= 0;
    m.mats[0].emissive.setHex(h.hurtT > 0 ? 0xff2020 : 0x000000);
    m.ring.material.opacity = 0.35 + Math.sin(g.t * 5) * 0.15;
  }

  function stepWave(dt) {
    if (g.waveState === 'ready') { startWave(); return; }
    if (g.waveState === 'clear') { g.waveT -= dt; if (g.waveT <= 0) startWave(); return; }
    if (g.bossPending) { g.bossT -= dt; if (g.bossT <= 0) { var a = Math.random() * 6.28; dropPod([], { boss: g.bossPending, big: true, x: Math.cos(a) * 16, z: Math.sin(a) * 16 }); g.bossPending = null; } }
    if (g.podQueue.length) {
      g.podTimer -= dt;
      var cap = g.enemies.length < 120;
      if (g.podTimer <= 0 && cap) { dropPod(g.podQueue.shift()); g.podTimer = g.podInterval * U.rand(0.75, 1.25); if (g.podQueue.length && Math.random() < Math.min(0.55, 0.1 + g.wave * 0.06)) dropPod(g.podQueue.shift()); }
    } else if (!g.pods.length && !g.enemies.length && !g.bossPending) waveCleared();
  }

  var ringUpd = 0;
  function stepPods(dt) {
    ringUpd -= dt; var doRing = ringUpd <= 0; if (doRing) ringUpd = 0.1;
    for (var i = g.pods.length - 1; i >= 0; i--) {
      var p = g.pods[i]; if (!p) continue;
      if (p.state === 'fall') {
        p.fallT -= dt; var k = Math.max(0, p.fallT / 1.25);
        p.R.body.position.y = 60 * k * k; p.R.trail.position.y = p.R.body.position.y + 2.5;
        p.warn.scale.setScalar(0.6 + k * 0.8); p.warn.material.opacity = 0.5 + Math.sin(g.t * 30) * 0.3;
        if (Math.random() < 0.8) W.particles.spawn(p.x + U.rand(-0.3, 0.3), p.R.body.position.y + 2, p.z + U.rand(-0.3, 0.3), 0, 4, 0, 0.5, 1.2, 1, 0.45, 0.75, 0, 1);
        if (p.fallT <= 0) podLand(p);
        continue;
      }
      p.hatchT -= dt; p.flash -= dt;
      var f = p.hatchT / p.hatchMax;
      var wob = f < 0.35 ? Math.sin(g.t * (40 - f * 60)) * (0.35 - f) * 0.5 : 0;
      p.R.body.rotation.z = wob; p.R.body.scale.setScalar(1 + (1 - f) * 0.12);
      p.R.mat.emissiveIntensity = p.flash > 0 ? 6 : 1.4 + (1 - f) * 2.5 + (f < 0.3 ? Math.sin(g.t * 25) * 1.5 : 0);
      if (doRing && p.R.timer.visible) {
        p.R.timer.geometry.dispose(); p.R.timer.geometry = new THREE.RingGeometry(1.5, 1.85, 40, 1, Math.PI / 2, Math.PI * 2 * Math.max(0.001, f));
        p.R.timer.material.color.setHex(f > 0.5 ? 0xffd23f : f > 0.25 ? 0xff9a2e : 0xff2a4a);
      }
      if (p.hatchT <= 0) hatchPod(p);
    }
  }

  function stepEnemies(dt) {
    var h = g.hero, list = g.enemies, n = list.length;
    for (var i = n - 1; i >= 0; i--) {
      var e = list[i]; if (!e || e.dead) continue;
      e.t += dt; e.atkCd -= dt; e.slowT -= dt; e.flash -= dt; e.cd1 -= dt; e.cd2 -= dt; e.cd3 -= dt;
      var spMul = e.slowT > 0 ? 0.65 : 1;
      var T = targetFor(e), dx = T.x - e.x, dz = T.z - e.z, d = Math.hypot(dx, dz) || 0.001, nx = dx / d, nz = dz / d;
      var reach = T.r + e.r + 0.25, moving = 1, wantX = 0, wantZ = 0, special = 0;
      switch (e.type) {
        case 'stalker':
          if (e.state === 'crouch') { moving = 0; special = 1; e.stT -= dt; if (e.stT <= 0) { e.state = 'leap'; e.stT = 0.42; e.lx = nx; e.lz = nz; e.hitDone = false; } }
          else if (e.state === 'leap') { e.stT -= dt; e.x += e.lx * 19 * dt; e.z += e.lz * 19 * dt; e.y = Math.sin((1 - e.stT / 0.42) * Math.PI) * 1.6; if (!e.hitDone && U.dist2(e.x, e.z, h.x, h.z) < (e.r + 0.9) * (e.r + 0.9)) { e.hitDone = true; hurtHero(e.dmg, e.x, e.z); } if (e.stT <= 0) { e.state = 'move'; e.y = 0; e.cd1 = U.rand(2.5, 3.5); } moving = 0; }
          else if (d < 8 && e.cd1 <= 0) { e.state = 'crouch'; e.stT = 0.5; }
          else { wantX = nx; wantZ = nz; }
          break;
        case 'wisp':
          var keep = 9;
          if (d > keep + 1) { wantX = nx; wantZ = nz; } else if (d < keep - 2) { wantX = -nx; wantZ = -nz; } else { wantX = -nz * 0.6; wantZ = nx * 0.6; }
          if (e.cd1 <= 0 && d < 16) { e.cd1 = U.rand(2.2, 3.0); enemyOrb(e.x, e.y + 0.2, e.z, T.x, T.z, 9, e.dmg, 0x7ae8ff, T.gen); A.sfx('orb'); }
          break;
        case 'spitter':
          if (d > 12) { wantX = nx; wantZ = nz; } else { moving = 0; special = Math.max(0, 1 - e.cd1); if (e.cd1 <= 0) { e.cd1 = U.rand(2.8, 3.6); lobAcid(e, T); } }
          break;
        case 'brute':
          if (e.state === 'wind') { moving = 0; special = 1; e.stT -= dt; e.R.group.rotation.y = Math.atan2(nx, nz); if (e.stT <= 0) { e.state = 'charge'; e.stT = 1.1; e.lx = nx; e.lz = nz; e.hitDone = false; } }
          else if (e.state === 'charge') {
            special = 1; e.stT -= dt; e.x += e.lx * 16 * spMul * dt; e.z += e.lz * 16 * spMul * dt;
            if (Math.random() < 0.5) W.smokePuff(e.x, 0.2, e.z, 1, 0x5a4a40, 1);
            if (!e.hitDone && U.dist2(e.x, e.z, h.x, h.z) < (e.r + 0.8) * (e.r + 0.8)) { e.hitDone = true; hurtHero(e.dmg, e.x, e.z); W.addShake(0.4); }
            if (!e.hitDone && Math.hypot(e.x, e.z) < 2.6 + e.r + 0.3) { e.hitDone = true; hurtGen(e.dmg * 1.5); W.addShake(0.4); e.stT = 0; }
            if (e.stT <= 0) { e.state = 'stun'; e.stT = 0.9; }
            moving = 0;
          } else if (e.state === 'stun') { moving = 0; e.stT -= dt; if (e.stT <= 0) { e.state = 'move'; e.cd1 = U.rand(3, 5); } }
          else if (d < 14 && d > 4 && e.cd1 <= 0) { e.state = 'wind'; e.stT = 0.65; A.sfx('roar'); }
          else { wantX = nx; wantZ = nz; }
          break;
        case 'behemoth': bossBehemoth(e, T, dt, nx, nz, d); moving = e.state === 'move' ? 1 : 0; special = e.state === 'charge' ? 1 : 0; if (e.state === 'move') { wantX = nx; wantZ = nz; } break;
        case 'overmind': bossOvermind(e, T, dt, nx, nz, d); if (d > 11) { wantX = nx; wantZ = nz; } else { wantX = -nz * 0.5; wantZ = nx * 0.5; } break;
        default: wantX = nx; wantZ = nz;
      }
      // melee
      if (e.type !== 'wisp' && e.type !== 'spitter' && e.type !== 'overmind' && e.state === 'move' && d < reach) {
        wantX = 0; wantZ = 0; moving = 0;
        if (e.atkCd <= 0) { e.atkCd = e.boss ? 1.8 : 1.0; if (T.gen) hurtGen(e.dmg); else hurtHero(e.dmg, e.x, e.z); e.R.body.position.z = 0.3; }
      }
      // separation
      var sx = 0, sz = 0;
      for (var j = 0; j < n; j++) { var o = list[j]; if (o === e || !o) continue; var ox = e.x - o.x, oz = e.z - o.z, rr = e.r + o.r; if (ox > rr || ox < -rr || oz > rr || oz < -rr) continue; var od = Math.hypot(ox, oz); if (od < rr && od > 0.001) { var push = (rr - od) / rr; sx += ox / od * push; sz += oz / od * push; } }
      var sp = e.speed * spMul;
      var tvx = (wantX * sp + sx * 4), tvz = (wantZ * sp + sz * 4), kk = 1 - Math.exp(-dt * 8);
      e.vx += (tvx - e.vx) * kk; e.vz += (tvz - e.vz) * kk;
      e.x += e.vx * dt; e.z += e.vz * dt;
      if (e.type !== 'wisp' && e.type !== 'overmind') pushOut(e, e.r * 0.8);
      clampArena(e, e.r);
      // visuals
      var R = e.R; R.group.position.set(e.x, e.y, e.z);
      if (e.state !== 'wind') { var fy = Math.atan2(e.vx, e.vz), cur = R.group.rotation.y; if (Math.hypot(e.vx, e.vz) > 0.3 || d < reach + 1) R.group.rotation.y = cur + U.angWrap((Math.hypot(e.vx, e.vz) > 0.3 ? fy : Math.atan2(nx, nz)) - cur) * Math.min(1, dt * 10); }
      R.body.position.z *= 0.85;
      M.animAlien(R, e.t, Math.min(1, Math.hypot(e.vx, e.vz) / 2 + (moving ? 0.2 : 0)), special);
      var mt = R.mats[0];
      if (e.flash > 0) { mt.emissive.setHex(e.boss ? 0xff60ff : 0xffffff); mt.emissiveIntensity = e.boss ? 0.45 : 1.0; }
      else if (special && (e.state === 'wind' || e.state === 'crouch')) { mt.emissive.setHex(0xff2020); mt.emissiveIntensity = 0.6 + Math.sin(e.t * 40) * 0.4; }
      else { mt.emissive.copy(R.baseEmissive); mt.emissiveIntensity = R.baseEI; }
      if (R.halo) R.halo.material.opacity = 0.4 + Math.sin(e.t * 6) * 0.2;
    }
  }
  function enemyOrb(x, y, z, tx, tz, speed, dmg, color, atGen, size) {
    var o = M.orb(color, size || 1); add(o.group); o.group.position.set(x, y, z);
    var dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz) || 1;
    g.ebullets.push({ x: x, y: y, z: z, vx: dx / d * speed, vz: dz / d * speed, vy: (1.2 - y) / (d / speed), dmg: dmg, obj: o, life: 4, kind: 'orb', r: 0.45 * (size || 1) });
  }
  function lobAcid(e, T) {
    var o = M.orb(0x9dff2e, 1.2); add(o.group);
    var tx = T.x + U.rand(-1, 1), tz = T.z + U.rand(-1, 1), fl = 1.1;
    g.ebullets.push({ x: e.x, y: 1.6, z: e.z, sx: e.x, sz: e.z, tx: tx, tz: tz, t: 0, fl: fl, dmg: e.dmg, obj: o, kind: 'acid', life: fl + 0.1, gen: T.gen });
    A.sfx('spit');
    var w = new THREE.Mesh(new THREE.RingGeometry(1.4, 1.7, 24), new THREE.MeshBasicMaterial({ color: 0x9dff2e, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    w.rotation.x = -Math.PI / 2; w.position.set(tx, 0.09, tz); add(w); g.ebullets[g.ebullets.length - 1].warn = w;
  }
  function bossBehemoth(e, T, dt, nx, nz, d) {
    var h = g.hero;
    if (e.state === 'wind') {
      e.stT -= dt; e.R.group.rotation.y = Math.atan2(nx, nz);
      if (!e.warnM) { e.warnM = new THREE.Mesh(new THREE.PlaneGeometry(e.r * 1.6, 20), new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); e.warnM.geometry.rotateX(-Math.PI / 2); e.warnM.geometry.translate(0, 0.1, 10); add(e.warnM); }
      e.warnM.position.set(e.x, 0, e.z); e.warnM.rotation.y = Math.atan2(nx, nz); e.warnM.material.opacity = 0.25 + Math.sin(g.t * 25) * 0.15;
      if (e.stT <= 0) { e.state = 'charge'; e.stT = 1.4; e.lx = nx; e.lz = nz; e.hitDone = false; rem(e.warnM); e.warnM = null; }
      return;
    }
    if (e.state === 'charge') {
      e.stT -= dt; e.x += e.lx * 15 * dt; e.z += e.lz * 15 * dt; W.addShake(0.02);
      if (Math.random() < 0.6) W.smokePuff(e.x, 0.3, e.z, 1, 0x5a4a40, 2);
      if (!e.hitDone && U.dist2(e.x, e.z, h.x, h.z) < (e.r + 0.8) * (e.r + 0.8)) { e.hitDone = true; hurtHero(e.dmg, e.x, e.z); }
      if (!e.hitDone && Math.hypot(e.x, e.z) < 2.6 + e.r) { e.hitDone = true; hurtGen(e.dmg * 2); e.stT = 0; }
      if (e.stT <= 0 || Math.hypot(e.x, e.z) > W.arenaR - e.r - 0.5) { e.state = 'stun'; e.stT = 1.2; }
      return;
    }
    if (e.state === 'stun') { e.stT -= dt; if (e.stT <= 0) e.state = 'move'; return; }
    if (e.cd1 <= 0 && d < 20) { e.state = 'wind'; e.stT = 1.3; e.cd1 = 7; A.sfx('roar'); UI.toast('⚠ CHARGE! DASH ASIDE', '#ff5a6e'); return; }
    if (e.cd2 <= 0) { // stomp shockwave
      e.cd2 = 6;
      var sw = new THREE.Mesh(new THREE.RingGeometry(0.5, 11, 48), new THREE.MeshBasicMaterial({ color: 0xff2a4a, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false }));
      sw.rotation.x = -Math.PI / 2; sw.position.set(e.x, 0.08, e.z); add(sw);
      g.slams.push({ x: e.x, z: e.z, t: 0, r0: 1, r1: 11, life: 1.6, delay: 0.9, dmg: 14, hit: false, warn: sw, wave: true });
    }
    if (e.cd3 <= 0) { e.cd3 = 7; for (var i = 0; i < 3 + Math.floor(g.wave / 5); i++) spawnEnemy('skitter', e.x + U.rand(-2, 2), e.z + U.rand(-2, 2)); A.sfx('hatch'); }
  }
  function bossOvermind(e, T, dt, nx, nz, d) {
    var h = g.hero;
    if (e.cd1 <= 0) { e.cd1 = 4.2; for (var i = 0; i < 14; i++) { var a = i / 14 * 6.283 + e.t; enemyOrb(e.x, e.y, e.z, e.x + Math.cos(a) * 10, e.z + Math.sin(a) * 10, 8, 12, 0xff60c0, false, 1.3); } A.sfx('orb'); }
    if (e.cd2 <= 0) { e.cd2 = 3.2; // tentacle slam telegraph
      var w = new THREE.Mesh(new THREE.CircleGeometry(3.6, 32), new THREE.MeshBasicMaterial({ color: 0xff3fa4, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false }));
      w.rotation.x = -Math.PI / 2; w.position.set(h.x, 0.08, h.z); add(w);
      g.slams.push({ x: h.x, z: h.z, t: 0, life: 1.1, r1: 3.6, dmg: 28, warn: w, hit: false });
    }
    if (e.cd3 <= 0) { e.cd3 = 9; for (var k = 0; k < 2 + Math.floor(g.wave / 10); k++) spawnEnemy('wisp', e.x + U.rand(-3, 3), e.z + U.rand(-3, 3)); A.sfx('hatch'); }
  }

  function stepBullets(dt) {
    for (var i = g.bullets.length - 1; i >= 0; i--) {
      var b = g.bullets[i];
      b.x += b.vx * dt; b.z += b.vz * dt; b.life -= dt;
      b.obj.group.position.set(b.x, b.turret ? 1.1 : 1.35, b.z);
      var dead = b.life <= 0;
      if (!dead) {
        for (var c = 0; c < W.colliders.length; c++) { var C = W.colliders[c]; if (U.dist2(b.x, b.z, C.x, C.z) < C.r * C.r * 0.8) { dead = true; W.burst(b.x, 1.2, b.z, b.color, 4, 4, 0.2, 0.2); break; } }
      }
      if (!dead) for (var j = 0; j < g.enemies.length; j++) {
        var e = g.enemies[j]; if (b.hit.indexOf(e) >= 0) continue;
        var rr = e.r + 0.25; if (U.dist2(b.x, b.z, e.x, e.z) > rr * rr) continue;
        b.hit.push(e);
        damageEnemy(e, b.dmg, { slow: up('cryo') > 0 && !b.turret });
        W.burst(b.x, 1.3, b.z, b.color, 3, 4, 0.2, 0.22);
        if (!b.turret) {
          if (up('nova')) explode(b.x, b.z, 1.6 + up('nova') * 0.6, b.dmg * (0.3 + 0.15 * up('nova')), 0xff9a2e);
          if (up('tesla') && Math.random() < 0.12 + 0.1 * up('tesla')) teslaChain(e, b.dmg * 0.6);
        }
        if (b.pierce-- <= 0) { dead = true; break; }
      }
      if (!dead) for (var k = 0; k < g.pods.length; k++) {
        var p = g.pods[k]; if (p.state !== 'land') continue;
        if (U.dist2(b.x, b.z, p.x, p.z) < (p.r + 0.25) * (p.r + 0.25)) { damagePod(p, b.dmg); dead = true; break; }
      }
      if (dead) { rem(b.obj.group); g.bullets.splice(i, 1); }
    }
  }
  function teslaChain(from, dmg) {
    var last = from, hits = [from];
    for (var c = 0; c < 2; c++) {
      var nx = null, nd = 49;
      g.enemies.forEach(function (e) { if (hits.indexOf(e) < 0) { var d = U.dist2(last.x, last.z, e.x, e.z); if (d < nd) { nd = d; nx = e; } } });
      if (!nx) break; W.lightning(last.x, last.y + 1, last.z, nx.x, nx.y + 1, nx.z, 0xc8a0ff); damageEnemy(nx, dmg, { silent: true }); hits.push(nx); last = nx;
    }
  }
  function stepEBullets(dt) {
    var h = g.hero;
    for (var i = g.ebullets.length - 1; i >= 0; i--) {
      var b = g.ebullets[i], dead = false; b.life -= dt;
      if (b.kind === 'acid') {
        b.t += dt; var k = Math.min(1, b.t / b.fl);
        b.x = U.lerp(b.sx, b.tx, k); b.z = U.lerp(b.sz, b.tz, k); b.y = 1.6 + Math.sin(k * Math.PI) * 6 - k * 1.4;
        if (k >= 1) {
          dead = true; rem(b.warn); W.burst(b.x, 0.3, b.z, 0x9dff2e, 14, 6, 0.5, 0.3); A.sfx('splat');
          if (Math.hypot(b.x, b.z) < 4) hurtGen(b.dmg * 1.5);
          var pm = new THREE.Mesh(new THREE.CircleGeometry(1.7, 24), new THREE.MeshBasicMaterial({ color: 0x7aff20, transparent: true, opacity: 0.55, depthWrite: false }));
          pm.rotation.x = -Math.PI / 2; pm.position.set(b.x, 0.05, b.z); add(pm);
          g.puddles.push({ x: b.x, z: b.z, r: 1.7, t: 3.5, m: pm, dps: b.dmg * 1.2 });
        }
      } else {
        b.x += b.vx * dt; b.z += b.vz * dt; b.y = Math.max(1.0, b.y + (b.vy || 0) * dt);
        if (U.dist2(b.x, b.z, h.x, h.z) < (0.7 + b.r) * (0.7 + b.r)) { hurtHero(b.dmg, b.x, b.z); dead = true; }
        else if (Math.hypot(b.x, b.z) < 3) { hurtGen(b.dmg); dead = true; W.burst(b.x, b.y, b.z, 0x7ae8ff, 6, 4, 0.3, 0.3); }
        if (b.life <= 0 || Math.hypot(b.x, b.z) > 45) dead = true;
      }
      b.obj.group.position.set(b.x, b.y, b.z);
      if (dead) { rem(b.obj.group); if (b.warn) rem(b.warn); g.ebullets.splice(i, 1); }
    }
    for (var p = g.puddles.length - 1; p >= 0; p--) {
      var P = g.puddles[p]; P.t -= dt; P.m.material.opacity = Math.min(0.55, P.t * 0.4);
      if (U.dist2(P.x, P.z, h.x, h.z) < P.r * P.r && h.dashT <= 0) { h.hp -= P.dps * dt; h.slowT = 0.2; if (h.hp <= 0) { h.hp = 0; GM.onDeath('hero'); } if (Math.random() < 0.1) W.burst(h.x, 0.3, h.z, 0x9dff2e, 2, 2, 0.3, 0.2); }
      if (P.t <= 0) { rem(P.m); g.puddles.splice(p, 1); }
    }
    for (var s = g.slams.length - 1; s >= 0; s--) {
      var L = g.slams[s]; L.t += dt;
      if (L.wave) { // telegraphed, then an expanding stomp band
        if (L.t < L.delay) { if (L.warn) L.warn.material.opacity = 0.08 + (L.t / L.delay) * 0.25; continue; }
        if (L.warn) { rem(L.warn); L.warn = null; W.ring(L.x, L.z, 1, L.r1, L.life - L.delay, 0xff3fa4); W.addShake(0.6); A.sfx('impact'); }
        var rr = U.lerp(L.r0, L.r1, (L.t - L.delay) / (L.life - L.delay)), dh = Math.hypot(h.x - L.x, h.z - L.z);
        if (!L.hit && Math.abs(dh - rr) < 0.9 && h.dashT <= 0) { L.hit = true; hurtHero(L.dmg, L.x, L.z); }
      } else {
        L.warn.material.opacity = 0.15 + (L.t / L.life) * 0.45;
        if (L.t >= L.life && !L.hit) { L.hit = true; W.ring(L.x, L.z, 0.5, L.r1 + 1, 0.4, 0xff3fa4); W.burst(L.x, 0.5, L.z, 0xb04bff, 30, 9, 0.6, 0.4); W.addShake(0.5); A.sfx('impact'); W.decal(L.x, L.z, 3, 0x2a0a3a, 0.7); if (Math.hypot(h.x - L.x, h.z - L.z) < L.r1 + 0.5) hurtHero(L.dmg, L.x, L.z); }
      }
      if (L.t >= L.life) { if (L.warn) rem(L.warn); g.slams.splice(s, 1); }
    }
  }
  function stepPickups(dt) {
    var h = g.hero, mag = h.magnet;
    for (var i = g.pickups.length - 1; i >= 0; i--) {
      var p = g.pickups[i]; p.t += dt;
      if (p.t < 0.45) { p.x += p.vx * dt; p.z += p.vz * dt; p.vy -= 20 * dt; p.y = Math.max(0.5, p.y + p.vy * dt); p.vx *= 0.95; p.vz *= 0.95; }
      else {
        var dx = h.x - p.x, dz = h.z - p.z, d = Math.hypot(dx, dz);
        if (d < mag || p.pull || g.waveState === 'clear') p.pull = true;
        if (p.pull) { var s = 6 + p.t * 18; p.x += dx / (d || 1) * Math.min(d, s * dt); p.z += dz / (d || 1) * Math.min(d, s * dt); }
        p.y = 0.6 + Math.sin(p.t * 4 + i) * 0.15;
        if (d < 0.9) {
          if (p.kind === 'xp') { gainXp(p.val); A.sfx('xp'); }
          else if (p.kind === 'core') { g.cores += p.val; A.sfx('pickup'); }
          else { h.hp = Math.min(h.maxHp, h.hp + 18); A.sfx('levelup'); UI.toast('+HEALTH', '#ff6a7a'); }
          rem(p.obj.group); g.pickups.splice(i, 1); continue;
        }
        if (p.t > 30) { rem(p.obj.group); g.pickups.splice(i, 1); continue; }
      }
      p.obj.group.position.set(p.x, p.y, p.z); p.obj.m.rotation.y += dt * 3;
    }
  }
  var TCOST = [15, 35, 70];
  GM.turretCost = function (lvl) { return Math.round(TCOST[lvl] * (g.mod === 'turrets' ? 0.5 : 1)); };
  function stepTurrets(dt) {
    var h = g.hero, near = null;
    g.turrets.forEach(function (t) {
      var afford = t.lvl < 3 && g.cores >= GM.turretCost(t.lvl), pulse = 0.5 + Math.sin(g.t * 5) * 0.5;
      t.pad.ring.material.opacity = t.lvl >= 3 ? 0.25 : afford ? 0.75 + pulse * 0.25 : 0.45;
      t.pad.glow.material.opacity = afford ? 0.35 + pulse * 0.45 : 0.08;
      t.pad.arrow.visible = afford && !t.obj; t.pad.arrow.position.y = 2.2 + pulse * 0.4; t.pad.arrow.rotation.y = g.t * 2;
      if (U.dist2(h.x, h.z, t.x, t.z) < 2.0 * 2.0) near = t;
      if (!t.obj) return;
      t.cd -= dt;
      var range = 14 + t.lvl * 1.5, best = null, bd = range * range;
      for (var i = 0; i < g.enemies.length; i++) { var e = g.enemies[i], d = U.dist2(t.x, t.z, e.x, e.z); if (d < bd) { bd = d; best = e; } }
      if (best) {
        var yaw = Math.atan2(best.x - t.x, best.z - t.z); t.yaw += U.angWrap(yaw - t.yaw) * Math.min(1, dt * 10); t.obj.head.rotation.y = t.yaw;
        if (t.cd <= 0) {
          var oc = 1 + 0.4 * up('turret');
          t.cd = 1 / ((1.8 + t.lvl * 0.9) * oc);
          var mz = t.obj.muzzle.getWorldPosition(tmpV), o = M.bolt(t.obj.color, 0.8); add(o.group);
          var a = t.yaw; o.group.rotation.y = a;
          g.bullets.push({ x: mz.x, z: mz.z, vx: Math.sin(a) * 40, vz: Math.cos(a) * 40, dmg: (5 + 4 * t.lvl) * oc * (1 + 0.04 * g.wave), pierce: t.lvl >= 3 ? 1 : 0, life: range / 40 + 0.1, obj: o, hit: [], color: t.obj.color, turret: true });
          A.sfx('turret');
        }
      }
    });
    // build interaction
    if (near && near.lvl < 3) {
      var cost = GM.turretCost(near.lvl), still = Math.hypot(h.vx, h.vz) < 3;
      if (g.cores >= cost) {
        if (still) g.buildT += dt; else g.buildT = Math.max(0, g.buildT - dt * 2);
        UI.build((near.lvl ? 'UPGRADING TURRET TO LV ' + (near.lvl + 1) : 'BUILDING TURRET') + ' · ◆ ' + cost, Math.min(1, g.buildT / 0.7));
        if (g.buildT >= 0.7) {
          g.cores -= cost; near.lvl++; g.buildT = 0; g.turretBuilds++;
          if (near.obj) rem(near.obj.group);
          near.obj = M.turret(near.lvl); near.obj.group.position.set(near.x, 0.2, near.z); add(near.obj.group); near.obj.head.rotation.y = near.yaw;
          A.sfx('build'); W.ring(near.x, near.z, 0.5, 3.5, 0.4, 0xa6ff3a); W.burst(near.x, 1, near.z, 0xa6ff3a, 20, 6, 0.5, 0.3);
          UI.toast(near.lvl === 1 ? 'TURRET ONLINE' : 'TURRET LV ' + near.lvl, '#a6ff3a');
          PB.Meta.progress('turret', 1);
          if (g.tut === 2) g.tut = 3;
        }
      } else { g.buildT = 0; UI.build('TURRET PAD · NEED ◆ ' + cost + ' CORES (YOU HAVE ' + Math.floor(g.cores) + ')', 0); }
    } else { g.buildT = 0; UI.build(null); }
  }
  function stepOrbs(dt) {
    var n = up('orb'), h = g.hero;
    while (g.orbs.length < n) { var o = M.orb(0xc46bff, 1.4); add(o.group); g.orbs.push({ obj: o }); }
    for (var i = 0; i < g.orbs.length; i++) {
      var a = g.t * 3.2 + i / g.orbs.length * 6.283, ox = h.x + Math.cos(a) * 2.6, oz = h.z + Math.sin(a) * 2.6;
      g.orbs[i].obj.group.position.set(ox, 1.2, oz);
      for (var j = g.enemies.length - 1; j >= 0; j--) {
        var e = g.enemies[j]; if (!e) continue; var key = i;
        if (U.dist2(ox, oz, e.x, e.z) < (e.r + 0.5) * (e.r + 0.5) && (!e.orbHit[key] || g.t - e.orbHit[key] > 0.45)) { e.orbHit[key] = g.t; damageEnemy(e, 11 * h.dmgMul, { silent: true, noCrit: true }); W.burst(ox, 1.2, oz, 0xc46bff, 4, 4, 0.25, 0.25); }
      }
    }
  }
  function stepStrikes(dt) {
    for (var i = g.strikes.length - 1; i >= 0; i--) {
      var s = g.strikes[i]; s.t -= dt; s.life -= dt;
      if (!s.fired) {
        s.warn.rotation.z += dt * 3; s.warn.material.opacity = 0.5 + Math.sin(g.t * 30) * 0.4;
        s.beam.material.opacity = 0.15 * (1 - s.t / 0.75); s.beam.scale.set(0.3, 1, 0.3);
        if (s.t <= 0) {
          s.fired = true; W.addShake(1.1); A.sfx('strike'); g.hitstop = 0.08;
          W.ring(s.x, s.z, 0.5, s.r * 1.6, 0.6, 0xffd08a); W.ring(s.x, s.z, 0.5, s.r, 0.4, 0xffffff);
          W.burst(s.x, 1, s.z, 0xffb050, 90, 16, 0.9, 0.55, 6); W.burst(s.x, 1, s.z, 0xffffff, 30, 10, 0.5, 0.4);
          W.smokePuff(s.x, 0.5, s.z, 16, 0x302820, 3); W.decal(s.x, s.z, s.r * 0.9, 0x0a0806, 0.8);
          var dmg = (220 + 30 * g.wave) * (1 + 0.1 * PB.perkLvl('power'));
          g.enemies.slice().forEach(function (e) { if (U.dist2(s.x, s.z, e.x, e.z) < (s.r + e.r) * (s.r + e.r)) damageEnemy(e, e.boss ? dmg * 1.5 : dmg, { silent: true, noCrit: true }); });
          g.pods.slice().forEach(function (p) { if (p.state === 'land' && U.dist2(s.x, s.z, p.x, p.z) < (s.r + 1) * (s.r + 1)) killPod(p, true); });
          rem(s.warn); W.hemi.intensity += 1.5; UI.flash && UI.flash();
        }
      } else {
        var k = Math.max(0, s.life / 0.65); s.beam.material.opacity = k * 0.9; var bs = s.r * 0.6 + (1 - k) * s.r * 1.2; s.beam.scale.set(bs, 1, bs);
      }
      if (s.life <= 0) { rem(s.beam); rem(s.warn); g.strikes.splice(i, 1); }
    }
    var base = g.mod === 'night' ? 0.4 : 0.62; if (W.hemi.intensity > base) W.hemi.intensity = Math.max(base, W.hemi.intensity - dt * 4);
  }
  function stepGen(dt) {
    var G = g.gen, m = G.m;
    m.rings.forEach(function (r, i) { r.rotation.x = g.t * (0.7 + i * 0.4); r.rotation.y = g.t * (0.5 + i * 0.3); });
    G.hitT -= dt; var hp = G.hp / G.maxHp;
    m.dome.material.opacity = 0.06 + (G.hitT > 0 ? 0.35 : 0) + (hp < 0.3 ? Math.sin(g.t * 10) * 0.05 + 0.05 : 0);
    m.dome.material.color.setHex(hp < 0.3 ? 0xff4a5a : 0x3ff0ff);
    m.light.intensity = 1.5 + Math.sin(g.t * 3) * 0.4; m.orb.position.y = 4.6 + Math.sin(g.t * 2) * 0.12; m.glow.position.y = m.orb.position.y;
    if (up('gen')) { g.genPulseT -= dt; if (g.genPulseT <= 0) { g.genPulseT = 4; W.ring(0, 0, 2, 7, 0.5, 0x3ff0ff); g.enemies.slice().forEach(function (e) { if (Math.hypot(e.x, e.z) < 7 + e.r) damageEnemy(e, 25 * up('gen'), { silent: true, noCrit: true }); }); } }
  }

  // ---------- visuals each frame (not fixed-step) ----------
  GM.frame = function (dt) {
    if (!g) return;
    var h = g.hero;
    W.updateCamera(dt, h.x, h.z, h.aimX * 5, h.aimZ * 5);
    UI.alert(g.alertT > 0 && g.started && !g.over);
    // off-screen pod arrows
    var arr = [], cx = window.innerWidth / 2, cy = window.innerHeight / 2, mxw = window.innerWidth - 40, myh = window.innerHeight - 40;
    g.pods.forEach(function (p) {
      if (p.state !== 'land' && p.fallT > 0.9) return;
      var s = W.worldToScreen(p.x, 1, p.z);
      if (s.x > 30 && s.x < mxw + 10 && s.y > 60 && s.y < myh && !s.behind) return;
      var dx = s.x - cx, dy = s.y - cy; if (s.behind) { dx = -dx; dy = -dy; }
      var k = Math.min((cx - 40) / Math.abs(dx || 1), (cy - 60) / Math.abs(dy || 1));
      var f = p.state === 'land' ? p.hatchT / p.hatchMax : 1;
      var ax2 = U.clamp(cx + dx * k, 30, window.innerWidth - 30), ay2 = U.clamp(cy + dy * k, 80, window.innerHeight - 40);
      if (ax2 > window.innerWidth - 210 && ay2 > window.innerHeight - 180) ay2 = window.innerHeight - 180;
      arr.push({ x: ax2, y: ay2, ang: Math.atan2(dy, dx) + Math.PI / 2, color: p.boss ? '#ff3fa4' : f > 0.5 ? '#ffd23f' : f > 0.25 ? '#ff9a2e' : '#ff2a4a' });
    });
    UI.arrows(arr);
    UI.combo(g.combo);
    UI.hud(g);
    // tutorial hints
    var touch = I.lastDevice === 'touch';
    var hint = null;
    if (!g.started) hint = touch ? 'Drag the <b>left side</b> to move. You aim and fire automatically.<br><b>Move to start!</b>' : '<b>WASD</b> to move · <b>MOUSE</b> to aim · <b>HOLD CLICK</b> to fire<br><b>Move to start!</b>';
    else if (g.tut === 1 && g.pods.some(function (p) { return p.state === 'land'; })) hint = '🥚 <b>SHOOT THE POD</b> before its ring runs out!<br>Broken pods never hatch and drop cores.';
    else if (g.tut === 2 && g.cores >= GM.turretCost(0) && g.turrets.every(function (t) { return !t.lvl; }) && (g.padHintT = (g.padHintT || 0) + dt) < 14) hint = '◆ You have cores! Stand on a <b style="color:#a6ff3a">glowing pad</b> beside the generator to build a <b>TURRET</b>.';
    else if (g.tut === 3 && g.strike >= 1) hint = touch ? '🛰️ Tap <b style="color:#ff9a2e">STRIKE</b> to call an Orbital Strike on the biggest crowd!' : '🛰️ <b style="color:#ff9a2e">STRIKE READY!</b> Point at a crowd and press <b>E</b> or <b>RIGHT CLICK</b>.';
    else if (g.started && g.t < 9 && S.runs < 1 && !hint && g.tut < 1) hint = touch ? 'Protect the <b style="color:#3ff0ff">SHIELD GENERATOR</b> in the centre!' : 'Protect the <b style="color:#3ff0ff">SHIELD GENERATOR</b>! · <b>SPACE</b> to dash';
    UI.hint(hint);
    if (g.wave >= 4 && g.tut < 4 && !S.tutorialDone) { S.tutorialDone = true; PB.persist(); }
  };
  GM.begin = function () { if (!g || g.started) return; g.started = true; PB.onBegin && PB.onBegin(); };

  // ---------- level up options ----------
  GM.cardOptions = function () {
    var pool = PB.UPGRADES.filter(function (u) { return up(u.id) < u.max && !(u.id === 'multi' && g.weapon === 'arc' && up(u.id) >= 2); });
    var out = [];
    while (out.length < 3 && pool.length) {
      var tot = 0; pool.forEach(function (u) { tot += [60, 30, 12][u.rar]; });
      var r = Math.random() * tot, pick = pool[0];
      for (var i = 0; i < pool.length; i++) { r -= [60, 30, 12][pool[i].rar]; if (r <= 0) { pick = pool[i]; break; } }
      pool.splice(pool.indexOf(pick), 1);
      out.push(Object.assign({}, pick, { lvl: up(pick.id) }));
    }
    if (!out.length) out.push({ id: 'repair', name: 'Field Repair', icon: '🔧', rar: 0, desc: 'Fully repair yourself and the generator', lvl: 0, max: 99 });
    return out;
  };
  GM.applyCard = function (c) {
    var h = g.hero, before = h.maxHp, genBefore = g.gen.maxHp;
    if (c.id === 'repair') { h.hp = h.maxHp; g.gen.hp = g.gen.maxHp; return; }
    g.up[c.id] = up(c.id) + 1;
    GM.stats();
    if (c.id === 'hp') h.hp = h.maxHp; else h.hp += h.maxHp - before;
    if (c.id === 'gen') g.gen.hp = g.gen.maxHp; else g.gen.hp += g.gen.maxHp - genBefore;
  };
  GM.revive = function () {
    var h = g.hero; g.over = false; g.revived = true;
    h.hp = h.maxHp * 0.6; h.inv = 2.5; g.gen.hp = Math.max(g.gen.hp, g.gen.maxHp * 0.4);
    W.ring(h.x, h.z, 1, 14, 0.6, 0x3ff0ff); W.addShake(0.6);
    g.enemies.slice().forEach(function (e) { if (U.dist2(e.x, e.z, h.x, h.z) < 100 || Math.hypot(e.x, e.z) < 8) damageEnemy(e, e.boss ? e.maxHp * 0.15 : 9999, { silent: true, noCrit: true }); });
  };
  GM.callStrikeAt = callStrike;
})(window.PB);
