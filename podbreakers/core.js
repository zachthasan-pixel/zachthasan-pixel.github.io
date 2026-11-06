/* Pod Breakers - core: save data, utilities, game data tables, input */
(function (PB) {
  'use strict';
  // ---------- storage (safe in incognito) ----------
  var KEY = 'podbreakers_v1_';
  PB.store = {
    get: function (k, d) { try { var v = localStorage.getItem(KEY + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) {} }
  };
  var DEFAULT = {
    credits: 0, rankXp: 0, perks: {}, weapons: { pulse: true }, weapon: 'pulse', zonesUnlocked: 1, zone: 0,
    best: {}, dex: {}, runs: 0, totalKills: 0, totalPods: 0, tutorialDone: false,
    daily: { date: '', done: false, best: 0 }, streak: { last: '', count: 0 }, missions: { date: '', list: [] },
    settings: { sfx: true, music: true }
  };
  function fill(dst, def) {
    for (var k in def) {
      if (dst[k] === undefined || dst[k] === null) dst[k] = JSON.parse(JSON.stringify(def[k]));
      else if (typeof def[k] === 'object' && !Array.isArray(def[k])) fill(dst[k], def[k]);
    }
    return dst;
  }
  var loaded = PB.store.get('save', null);
  PB.firstVisit = !loaded;
  PB.save = fill(loaded && typeof loaded === 'object' ? loaded : {}, DEFAULT);
  PB.persist = function () { PB.store.set('save', PB.save); };

  // ---------- utils ----------
  PB.U = {
    rand: function (a, b) { return a + Math.random() * (b - a); },
    randi: function (a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    clamp: function (v, a, b) { return v < a ? a : v > b ? b : v; },
    lerp: function (a, b, t) { return a + (b - a) * t; },
    dist2: function (ax, az, bx, bz) { var dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; },
    angWrap: function (a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; },
    dateKey: function (d) { d = d || new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); },
    seeded: function (seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; },
    hash: function (s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; },
    fmt: function (n) { return Math.floor(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  };

  // ---------- data ----------
  PB.ENEMIES = {
    skitter: { name: 'Skitter', hp: 14, speed: 6.4, dmg: 6, r: 0.55, xp: 1, cost: 1, color: 0x9b3bff, img: 'a_skitter.jpg', lore: 'Fast six-legged crawlers that hunt in swarms. They go for the nearest warm target, which is usually you.' },
    gloop: { name: 'Gloop', hp: 30, speed: 3.4, dmg: 10, r: 0.95, xp: 2, cost: 2, color: 0x9dff2e, img: 'a_gloop.jpg', lore: 'A living jelly with three eyes. Pop it and it splits into two smaller Gloops. Aim for clean kills.' },
    stalker: { name: 'Stalker', hp: 42, speed: 5.0, dmg: 15, r: 0.6, xp: 3, cost: 3, color: 0x1fc8b0, img: 'a_stalker.jpg', lore: 'Tall, patient hunters. When close, a Stalker crouches and leaps. Dash sideways when it squats.' },
    wisp: { name: 'Wisp', hp: 22, speed: 4.2, dmg: 8, r: 0.7, xp: 2, cost: 2, color: 0x3fd8ff, img: 'a_wisp.jpg', lore: 'Floating jellyfish drones that keep their distance and fire slow plasma orbs at you and the generator. Turrets track them well.' },
    spitter: { name: 'Spitter', hp: 36, speed: 3.0, dmg: 9, r: 0.85, xp: 3, cost: 3, color: 0xffa020, img: 'a_spitter.jpg', lore: 'Plant-like artillery. It plants itself at range and lobs acid that leaves burning puddles. Rush it down.' },
    brute: { name: 'Brute', hp: 170, speed: 2.9, dmg: 26, r: 1.35, xp: 7, cost: 6, color: 0xff2e8a, img: 'a_brute.jpg', lore: 'An armoured rhino-beetle. It lowers its horn and charges in a straight line. Step aside and shoot its back.' },
    behemoth: { name: 'Behemoth', hp: 2400, speed: 2.4, dmg: 35, r: 2.6, xp: 40, cost: 0, color: 0xff2e8a, img: 'a_brute.jpg', boss: true, lore: 'A Brute queen the size of a bus. It charges, stomps shockwaves and births Skitters from its back.' },
    overmind: { name: 'The Overmind', hp: 5000, speed: 2.0, dmg: 30, r: 3.0, xp: 80, cost: 0, color: 0xb04bff, img: 'a_overmind.jpg', boss: true, lore: 'The invasion\'s brain. It floats over the battlefield, fires orb barrages, slams tentacles and summons Wisps.' }
  };
  PB.DEX_ORDER = ['skitter', 'gloop', 'spitter', 'wisp', 'stalker', 'brute', 'behemoth', 'overmind'];
  PB.DEX_TIERS = [10, 50, 200];

  PB.WEAPONS = {
    pulse: { name: 'Pulse Rifle', icon: '🔫', cost: 0, dmg: 10, rate: 6.5, speed: 52, count: 1, spread: 0.04, pierce: 0, range: 34, size: 1, color: 0x3ff0ff, desc: 'Reliable rapid plasma bolts.' },
    scatter: { name: 'Scatter Blaster', icon: '💥', cost: 450, dmg: 7, rate: 2.3, speed: 42, count: 6, spread: 0.55, pierce: 0, range: 17, size: 1.1, color: 0xff9a2e, desc: 'Six-pellet blast. Devastating up close.' },
    arc: { name: 'Arc Caster', icon: '⚡', cost: 1200, dmg: 9, rate: 5, chain: 3, range: 15, color: 0xc46bff, arc: true, desc: 'Instant lightning that jumps between 3 aliens.' },
    rail: { name: 'Rail Lance', icon: '☄️', cost: 2500, dmg: 75, rate: 1.15, speed: 130, count: 1, spread: 0, pierce: 99, range: 60, size: 1.8, color: 0xb6ff5a, desc: 'Slow, piercing hyper-shot through entire lines.' }
  };
  PB.WEAPON_ORDER = ['pulse', 'scatter', 'arc', 'rail'];

  PB.PERKS = [
    { id: 'armor', name: 'Armor Plating', icon: '🛡️', desc: '+15 max health', base: 120 },
    { id: 'power', name: 'Firepower', icon: '🔥', desc: '+10% weapon damage', base: 150 },
    { id: 'trigger', name: 'Trigger Tuning', icon: '⏱️', desc: '+8% fire rate', base: 150 },
    { id: 'agility', name: 'Servo Legs', icon: '👟', desc: '+6% move speed', base: 100 },
    { id: 'shield', name: 'Shield Capacitor', icon: '🔷', desc: '+80 generator health', base: 120 },
    { id: 'salvage', name: 'Salvage Rig', icon: '◆', desc: '+12% cores from aliens', base: 130 },
    { id: 'magnet', name: 'Magnet Field', icon: '🧲', desc: '+15% pickup range', base: 90 },
    { id: 'uplink', name: 'Orbital Uplink', icon: '🛰️', desc: 'Start each run with +20% strike charge', base: 140 }
  ];
  PB.perkLvl = function (id) { return PB.save.perks[id] || 0; };
  PB.perkCost = function (p) { var l = PB.perkLvl(p.id); return Math.round(p.base * Math.pow(1.8, l)); };

  PB.ZONES = [
    { name: 'Dusk Park', hpMul: 1, payMul: 1, sky: [0x1a0f3d, 0xff7a3d, 0xffc07a], ground: '#3d5a3a', ground2: '#2c4430', fog: 0x5b3a5e, sun: 0xffb27a, amb: 0x7a6aff, prop: 'city' },
    { name: 'Dune Outpost', hpMul: 1.35, payMul: 1.5, sky: [0x23305e, 0xf0a060, 0xffe2a8], ground: '#b98a55', ground2: '#9c6f41', fog: 0xc69a6a, sun: 0xffe0b0, amb: 0x6a8aff, prop: 'desert' },
    { name: 'Frost Lab', hpMul: 1.8, payMul: 2.1, sky: [0x0b1a3d, 0x4aa0d8, 0xc8f0ff], ground: '#c9dbe8', ground2: '#9fb8cc', fog: 0x8fb0d0, sun: 0xd8f0ff, amb: 0x5a7aff, prop: 'frost' },
    { name: 'Magma Rift', hpMul: 2.4, payMul: 3, sky: [0x12040a, 0x8a1d10, 0xff6a20], ground: '#3a2622', ground2: '#241513', fog: 0x4a1a10, sun: 0xff8a50, amb: 0xff4a6a, prop: 'magma' }
  ];

  PB.MODS = [
    { id: 'swarm', name: 'Swarm', desc: 'Twice as many Skitters, but they are fragile.' },
    { id: 'glass', name: 'Glass Cannon', desc: 'You deal double damage but have half health.' },
    { id: 'rain', name: 'Pod Rain', desc: 'Pods fall much faster and hatch slower.' },
    { id: 'giants', name: 'Giants', desc: 'Aliens are huge, tougher and drop double cores.' },
    { id: 'turrets', name: 'Turret Rush', desc: 'Turrets cost half. Your rifle hits 25% softer.' },
    { id: 'night', name: 'Blackout', desc: 'A dark night battle. Aliens glow brighter.' }
  ];

  PB.UPGRADES = [
    { id: 'dmg', name: 'Overcharged Cells', icon: '🔋', rar: 0, max: 6, desc: '+25% weapon damage' },
    { id: 'rate', name: 'Rapid Cycler', icon: '⏩', rar: 0, max: 6, desc: '+18% fire rate' },
    { id: 'multi', name: 'Split Shot', icon: '🔱', rar: 1, max: 3, desc: '+1 extra projectile' },
    { id: 'pierce', name: 'Phase Rounds', icon: '🪡', rar: 1, max: 3, desc: 'Shots pierce +1 alien' },
    { id: 'crit', name: 'Weak-Spot Scanner', icon: '🎯', rar: 0, max: 4, desc: '+12% chance to deal 2.5x damage' },
    { id: 'nova', name: 'Nova Rounds', icon: '💣', rar: 2, max: 3, desc: 'Shots explode on impact' },
    { id: 'tesla', name: 'Tesla Coil', icon: '⚡', rar: 1, max: 3, desc: 'Hits can chain lightning to 2 aliens' },
    { id: 'orb', name: 'Guardian Orb', icon: '🔮', rar: 1, max: 4, desc: '+1 orb circles you, burning aliens' },
    { id: 'cryo', name: 'Cryo Rounds', icon: '❄️', rar: 1, max: 2, desc: 'Hits slow aliens by 35%' },
    { id: 'hp', name: 'Nano Armor', icon: '❤️', rar: 0, max: 5, desc: '+25 max health and full heal' },
    { id: 'regen', name: 'Bio-Regen', icon: '💚', rar: 0, max: 3, desc: 'Regenerate 1.5 health per second' },
    { id: 'speed', name: 'Servo Boots', icon: '👢', rar: 0, max: 3, desc: '+10% move speed' },
    { id: 'dash', name: 'Blink Thrusters', icon: '💨', rar: 1, max: 3, desc: 'Dash recharges 25% faster and burns aliens' },
    { id: 'magnet', name: 'Core Magnet', icon: '🧲', rar: 0, max: 3, desc: '+60% pickup range' },
    { id: 'gen', name: 'Shield Matrix', icon: '🔷', rar: 1, max: 3, desc: 'Generator +150 health, repaired, and pulses' },
    { id: 'turret', name: 'Turret Overclock', icon: '🗼', rar: 1, max: 3, desc: 'Turrets +40% damage and fire rate' },
    { id: 'strike', name: 'Strike Uplink', icon: '🛰️', rar: 1, max: 2, desc: 'Strike charges 35% faster, bigger blast' },
    { id: 'pod', name: 'Pod Cracker', icon: '🥚', rar: 0, max: 2, desc: '+70% damage to pods, pods drop more cores' }
  ];
  PB.RARITY = ['COMMON', 'RARE', 'EPIC'];

  PB.RANKS = ['Recruit', 'Private', 'Corporal', 'Sergeant', 'Lieutenant', 'Captain', 'Major', 'Colonel', 'Commander', 'General', 'Earth Marshal'];
  PB.rankInfo = function () {
    var xp = PB.save.rankXp, lvl = 0, need = 400;
    while (lvl < PB.RANKS.length - 1 && xp >= need) { xp -= need; lvl++; need = Math.round(need * 1.45); }
    return { lvl: lvl, name: PB.RANKS[lvl], xp: xp, need: need };
  };

  PB.MISSION_T = [
    { id: 'kill', txt: 'Defeat {n} aliens', n: [60, 120, 200], reward: [100, 160, 240] },
    { id: 'pods', txt: 'Break {n} pods before they hatch', n: [8, 15, 25], reward: [100, 160, 240] },
    { id: 'wave', txt: 'Reach wave {n}', n: [5, 8, 11], reward: [120, 180, 260] },
    { id: 'turret', txt: 'Build or upgrade {n} turrets', n: [4, 8, 12], reward: [90, 140, 200] },
    { id: 'strike', txt: 'Call {n} Orbital Strikes', n: [3, 6, 10], reward: [90, 140, 200] },
    { id: 'boss', txt: 'Defeat {n} boss', n: [1, 1, 2], reward: [150, 150, 300] },
    { id: 'brute', txt: 'Defeat {n} Brutes', n: [5, 10, 20], reward: [110, 170, 250] },
    { id: 'combo', txt: 'Reach a {n}x combo', n: [15, 30, 50], reward: [100, 160, 240] }
  ];

  // ---------- input ----------
  var I = PB.input = { keys: {}, mx: 0, my: 0, mdown: false, mright: false, moved: false, any: false, touch: false,
    moveX: 0, moveZ: 0, stickActive: false, dashPressed: false, strikePressed: false, pausePressed: false, autoFire: false, lastDevice: 'kb' };
  var block = { ArrowUp: 1, ArrowDown: 1, ArrowLeft: 1, ArrowRight: 1, Space: 1 };
  window.addEventListener('keydown', function (e) {
    if (block[e.code]) e.preventDefault();
    if (e.repeat) return;
    I.keys[e.code] = true; I.any = true; I.lastDevice = 'kb'; if (!/^(KeyP|Escape|KeyM|Tab|Alt|Meta|Control)/.test(e.code)) I.startLatch = true;
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') I.dashPressed = true;
    if (e.code === 'KeyE' || e.code === 'KeyQ') I.strikePressed = true;
    if (e.code === 'KeyP' || e.code === 'Escape') I.pausePressed = true;
    if (e.code === 'KeyF') { I.autoFire = !I.autoFire; I.manual = true; if (PB.UI) PB.UI.toast(I.autoFire ? 'AUTO-FIRE ON' : 'AUTO-FIRE OFF', '#3ff0ff'); }
    if (e.code === 'KeyM' && PB.toggleMute) PB.toggleMute();
    if (PB.onKey) PB.onKey(e.code);
  });
  window.addEventListener('keyup', function (e) { I.keys[e.code] = false; });
  window.addEventListener('blur', function () { I.keys = {}; I.mdown = false; I.mright = false; if (PB.onBlur) PB.onBlur(); });
  window.addEventListener('wheel', function (e) { e.preventDefault(); }, { passive: false });
  window.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var cv = document.getElementById('c');
  cv.addEventListener('mousemove', function (e) { I.mx = e.clientX; I.my = e.clientY; I.moved = true; });
  cv.addEventListener('mousedown', function (e) {
    I.mx = e.clientX; I.my = e.clientY; I.any = true; I.lastDevice = 'kb';
    if (e.button === 0) { I.mdown = true; I.startLatch = true; if (!I.manual && PB.Game && PB.Game.g && PB.Game.g.started) { I.manual = true; if (PB.UI) PB.UI.toast('MANUAL AIM · PRESS F FOR AUTO-FIRE', '#3ff0ff'); } }
    if (e.button === 2) { I.mright = true; I.strikePressed = true; }
  });
  window.addEventListener('mouseup', function (e) { if (e.button === 0) I.mdown = false; if (e.button === 2) I.mright = false; });

  // touch: left half = movement stick (floating), buttons handled by ui
  var stickId = null, sx = 0, sy = 0;
  var stickEl = document.getElementById('stickL'), knob = stickEl.querySelector('.knob');
  function tstart(e) {
    I.touch = true; I.any = true; I.lastDevice = 'touch'; I.startLatch = true;
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (stickId === null && t.clientX < window.innerWidth * 0.55) {
        stickId = t.identifier; sx = t.clientX; sy = t.clientY;
        stickEl.style.display = 'block'; stickEl.style.left = (sx - 65) + 'px'; stickEl.style.top = (sy - 65) + 'px';
        knob.style.transform = 'translate(0,0)'; I.stickActive = true;
      }
    }
    e.preventDefault();
  }
  function tmove(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i];
      if (t.identifier === stickId) {
        var dx = t.clientX - sx, dy = t.clientY - sy, d = Math.hypot(dx, dy), m = 55;
        if (d > m) { dx = dx / d * m; dy = dy / d * m; }
        knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
        var mag = Math.min(1, d / m); var a = Math.atan2(dy, dx);
        var k = mag < 0.15 ? 0 : (mag - 0.15) / 0.85;
        I.moveX = Math.cos(a) * k; I.moveZ = Math.sin(a) * k;
      }
    }
    e.preventDefault();
  }
  function tend(e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === stickId) { stickId = null; I.moveX = 0; I.moveZ = 0; I.stickActive = false; stickEl.style.display = 'none'; }
    }
  }
  cv.addEventListener('touchstart', tstart, { passive: false });
  cv.addEventListener('touchmove', tmove, { passive: false });
  cv.addEventListener('touchend', tend); cv.addEventListener('touchcancel', tend);
  var tl = document.getElementById('touch');
  tl.addEventListener('touchstart', tstart, { passive: false });
  tl.addEventListener('touchmove', tmove, { passive: false });
  tl.addEventListener('touchend', tend); tl.addEventListener('touchcancel', tend);
  PB.isTouchDevice = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia && matchMedia('(pointer:coarse)').matches;
  if (PB.isTouchDevice) I.lastDevice = 'touch';
})(window.PB);
