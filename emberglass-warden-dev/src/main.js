/* global __PLATFORM__, __TEST__ */
import { ENEMY, UPGRADES, ARMORY, BLADES, RANKS, TRIALS, mulberry32, waveList } from './data.js';
import { THREE, G, R, PILLARS, initRenderer, resize, render, setQuality, loadAssets, makeEnemyVisual, buildWorld, setBiome, buildViewModel, setBladeColor, setBladeLength, setBladeGlow, buildParticles, emit, updateParticles, buildRings, ring, updateRings, buildTrail, updateTrail } from './gfx.js';
import { initAudio, resumeAudio, sfx, setMuted, setForcedMute, isMuted, startMusic, setIntensity } from './audio.js';
import { platform } from './platform.js';

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const YAW_FIX = { wraith: 0, stinger: 0, brute: 0, tyrant: 0 };

// ---------------- save ----------------
const KEY = 'emberglass_warden_v1';
const save = { shards: 0, best: 0, bestScore: 0, xp: 0, armory: {}, blade: 'ember', bosses: 0, dailyClears: 0, daily: { date: '', best: 0, done: false }, streak: 0, lastDay: '', mute: false, sens: 1, tut: {}, runs: 0 };
try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s) Object.assign(save, s); } catch (e) {}
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} };
const arm = (id) => save.armory[id] || 0;
const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const dayNum = () => { const d = new Date(); return Math.floor((d.getTime() - d.getTimezoneOffset() * 60000) / 86400000); };
const rankOf = (xp) => { let r = 0; for (let i = 0; i < RANKS.length; i++) if (xp >= RANKS[i].xp) r = i; return r; };
const bladeUnlocked = (b) => !b.unlock || (b.unlock.type === 'wave' && save.best >= b.unlock.n) || (b.unlock.type === 'boss' && save.bosses >= b.unlock.n) || (b.unlock.type === 'daily' && save.dailyClears >= b.unlock.n);

// ---------------- state ----------------
const S = { state: 'loading', t: 0, wave: 0, score: 0, combo: 0, comboT: 0, kills: 0, runShards: 0, queue: [], spawnT: 0, waveActive: false, betweenT: 0, timeScale: 1, slowT: 0, hitStop: 0, shake: 0, trial: null, daily: false, rng: Math.random, up: {}, rerolls: 0, windUsed: false, biome: 0, bossRef: null, menuAng: 0, touch: false, started: false, adBreak: false, hintId: null, hintT: 0 };
const p = { x: 0, z: 8, yaw: 0, pitch: 0, vx: 0, vz: 0, hp: 100, maxHp: 100, en: 100, maxEn: 100, enDelay: 0, dashT: 0, dashCharges: 1, dashMax: 1, dashRe: 0, ddx: 0, ddz: 0, inv: 0, swing: null, comboStep: 0, comboWin: 0, queued: false, chargeT: 0, charged: false, blocking: false, blockT: 0, burst: 0, stun: 0, moved: 0, bob: 0, fovKick: 0 };
const st = { dmg: 1, reach: 1, swing: 1, regen: 1, parry: 0.2, burstRate: 1, nova: 1, chain: 0, reflect: 1, heavyMul: 1, heavyRate: 1, shard: 1, thorn: 0, leech: 0 };
const enemies = [], shots = [], pickups = [];
const inp = { mx: 0, mz: 0, atk: false, atkPressed: false, atkReleased: false, block: false, dash: false, burst: false };
const keys = {};

function calcStats() {
  const u = (id) => S.up[id] || 0;
  st.dmg = (1 + 0.2 * u('edge')) * (1 + 0.06 * arm('hone')) * (S.trial === 'glass' ? 2 : 1);
  st.reach = 1 + 0.15 * u('reach'); st.swing = 1 + 0.15 * u('swift'); st.regen = (1 + 0.35 * u('recover')) * (S.trial === 'drain' ? 0.4 : 1);
  st.parry = 0.2 * (1 + 0.4 * u('parry')); st.burstRate = (1 + 0.4 * u('battery')) * (S.trial === 'surge' ? 3 : 1); st.nova = 1 + 0.35 * u('nova');
  st.chain = u('chain'); st.reflect = 1 + u('reflect'); st.heavyMul = (1 + 0.3 * u('heavy')) * (S.trial === 'heavy' ? 2 : 1); st.heavyRate = 1 + 0.3 * u('heavy');
  st.shard = (1 + 0.5 * u('magnet')) * (1 + 0.1 * arm('lens')); st.thorn = u('thorn'); st.leech = u('leech');
  const mh = 100 + 10 * arm('hull') + 25 * u('vital'), me = 100 + 10 * arm('cap') + 30 * u('reserve');
  p.hp += mh - p.maxHp; p.maxHp = mh; p.en += me - p.maxEn; p.maxEn = me; p.dashMax = 1 + u('dash2');
  setBladeLength(st.reach);
}

// ---------------- UI helpers ----------------
const show = (id, on) => $(id).classList.toggle('hidden', !on);
function banner(text, sub, dur = 2) { const b = $('banner'); b.innerHTML = '<b>' + text + '</b>' + (sub ? '<span>' + sub + '</span>' : ''); b.classList.remove('go'); void b.offsetWidth; b.style.animationDuration = dur + 's'; b.classList.add('go'); }
function hint(id, text) { if (save.tut[id] || S.hintId === id) return; S.hintId = id; S.hintT = 0; $('hint').innerHTML = text; show('hint', true); }
function hintDone(id) { if (S.hintId === id) { S.hintId = null; show('hint', false); } if (!save.tut[id]) { save.tut[id] = 1; persist(); } }
const numPool = []; let numI = 0; const _v = new THREE.Vector3();
function dmgNum(x, y, z, text, cls) {
  if (!numPool.length) for (let i = 0; i < 18; i++) { const d = document.createElement('div'); d.className = 'num'; $('nums').appendChild(d); numPool.push(d); }
  _v.set(x, y, z).project(G.camera); if (_v.z > 1) return;
  const d = numPool[numI++ % numPool.length];
  d.textContent = text; d.className = 'num ' + (cls || ''); d.style.left = ((_v.x * 0.5 + 0.5) * 100) + '%'; d.style.top = ((-_v.y * 0.5 + 0.5) * 100) + '%';
  void d.offsetWidth; d.classList.add('pop');
}
const hudCache = {};
function setText(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
function setW(id, v) { v = Math.round(clamp(v, 0, 1) * 1000) / 10; if (hudCache[id] !== v) { hudCache[id] = v; $(id).style.width = v + '%'; } }
function updateHud() {
  setW('hpf', p.hp / p.maxHp); setW('enf', p.en / p.maxEn); setW('buf', p.burst / 100);
  $('burstBox').classList.toggle('ready', p.burst >= 100); $('bars').classList.toggle('low', p.hp / p.maxHp < 0.3);
  setText('hpv', Math.ceil(p.hp) + ' / ' + p.maxHp);
  setText('waveN', 'WAVE ' + S.wave); setText('left', 'Beasts left: ' + (enemies.filter((e) => !e.dead).length + S.queue.length));
  setText('score', String(Math.floor(S.score))); setText('combo', S.combo > 1 ? 'x' + S.combo + ' COMBO' : ''); setText('shards', '◆ ' + S.runShards);
  let pips = ''; for (let i = 0; i < p.dashMax; i++) pips += i < p.dashCharges ? '●' : '○'; setText('dashpips', 'DASH ' + pips);
  const b = S.bossRef; show('bossBar', !!(b && !b.dead)); if (b && !b.dead) setW('bossf', b.hp / b.maxHp);
}

// ---------------- input ----------------
const canvas = $('c');
function lockPointer() { if (S.touch) return; try { const r = canvas.requestPointerLock && canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} }
function unlockPointer() { try { document.exitPointerLock && document.exitPointerLock(); } catch (e) {} }
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return; keys[e.code] = true; initAudio(); resumeAudio();
  if (S.state === 'playing') {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') inp.dash = true;
    if (e.code === 'KeyE' || e.code === 'KeyF') inp.burst = true;
    if (e.code === 'KeyP' || (e.code === 'Escape' && __PLATFORM__ !== 'crazygames')) pause();
  } else if (S.state === 'paused' && (e.code === 'KeyP' || e.code === 'Space' || e.code === 'Enter')) resume();
  else if (S.state === 'upgrade') { const n = { Digit1: 0, Digit2: 1, Digit3: 2, Numpad1: 0, Numpad2: 1, Numpad3: 2 }[e.code]; if (n !== undefined) pickUpgrade(n); }
  else if (S.state === 'menu' && (e.code === 'Enter' || e.code === 'Space')) startRun(false);
  else if (S.state === 'over' && (e.code === 'Enter' || e.code === 'Space')) againRun();
  if (e.code === 'KeyM') toggleMute();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; inp.atk = inp.block = false; });
canvas.addEventListener('mousedown', (e) => {
  initAudio(); resumeAudio();
  if (S.state !== 'playing' || S.touch) return;
  if (document.pointerLockElement !== canvas) lockPointer();
  if (e.button === 0) { inp.atk = true; inp.atkPressed = true; } else if (e.button === 2) inp.block = true; else if (e.button === 1) { inp.burst = true; e.preventDefault(); }
});
addEventListener('mouseup', (e) => { if (e.button === 0) { if (inp.atk) inp.atkReleased = true; inp.atk = false; } else if (e.button === 2) inp.block = false; });
addEventListener('mousemove', (e) => {
  if (S.state !== 'playing' || S.touch) return;
  if (document.pointerLockElement !== canvas && !(e.buttons & 3)) return;
  const k = 0.0022 * save.sens; p.yaw -= clamp(e.movementX || 0, -300, 300) * k; p.pitch = clamp(p.pitch - clamp(e.movementY || 0, -300, 300) * k, -1.2, 1.2);
});
addEventListener('contextmenu', (e) => e.preventDefault());
addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement !== canvas && S.state === 'playing' && !S.touch) pause(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && S.state === 'playing') pause(); });
addEventListener('resize', resize);

// touch controls
function setupTouch() {
  S.touch = true; document.body.classList.add('touch');
  const joy = $('joy'), nub = $('nub'); let jid = null, jx = 0, jy = 0, lid = null, lx = 0, ly = 0;
  joy.addEventListener('pointerdown', (e) => { jid = e.pointerId; const r = joy.getBoundingClientRect(); jx = r.left + r.width / 2; jy = r.top + r.height / 2; joy.setPointerCapture(e.pointerId); mv(e); initAudio(); resumeAudio(); });
  const mv = (e) => { if (e.pointerId !== jid) return; let dx = (e.clientX - jx) / 50, dy = (e.clientY - jy) / 50; const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } inp.mx = dx; inp.mz = dy; nub.style.transform = 'translate(' + dx * 36 + 'px,' + dy * 36 + 'px)'; };
  joy.addEventListener('pointermove', mv);
  const jend = (e) => { if (e.pointerId !== jid) return; jid = null; inp.mx = inp.mz = 0; nub.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' || lid !== null) return; lid = e.pointerId; lx = e.clientX; ly = e.clientY; initAudio(); resumeAudio(); });
  canvas.addEventListener('pointermove', (e) => { if (e.pointerId !== lid || S.state !== 'playing') return; const k = 0.006 * save.sens; p.yaw -= (e.clientX - lx) * k; p.pitch = clamp(p.pitch - (e.clientY - ly) * k, -1.2, 1.2); lx = e.clientX; ly = e.clientY; });
  const lend = (e) => { if (e.pointerId === lid) lid = null; }; canvas.addEventListener('pointerup', lend); canvas.addEventListener('pointercancel', lend);
  const btn = (id, down, up) => { const b = $(id); b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.classList.add('on'); initAudio(); resumeAudio(); down(); }); const u = (e) => { b.classList.remove('on'); up && up(); }; b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); b.addEventListener('pointerleave', u); };
  btn('tAtk', () => { inp.atk = true; inp.atkPressed = true; }, () => { if (inp.atk) inp.atkReleased = true; inp.atk = false; });
  btn('tBlk', () => { inp.block = true; }, () => { inp.block = false; });
  btn('tDash', () => { inp.dash = true; }); btn('tBurst', () => { inp.burst = true; });
}

// ---------------- combat helpers ----------------
function addShake(v) { S.shake = Math.min(1.2, S.shake + v); }
function hitStop(t) { S.hitStop = Math.max(S.hitStop, t); }
function addBurst(v) { const was = p.burst >= 100; p.burst = Math.min(100, p.burst + v * st.burstRate); if (!was && p.burst >= 100) { sfx('ready'); hint('burst', S.touch ? 'RIFT BURST ready — tap <b>BURST</b>' : 'RIFT BURST ready — press <b>E</b>'); } }
function addCombo() { S.combo++; S.comboT = 4; }

function damageEnemy(e, dmg, o = {}) {
  if (e.dead || e.state === 'spawn') return false;
  let armored = false;
  if (e.kind === 'brute' && !o.heavy && !o.pierce && e.stagger <= 0 && e.state !== 'recover') { dmg *= 0.45; armored = true; }
  if (e.stagger > 0) dmg *= 1.5;
  e.hp -= dmg; e.flash = 1; e.hitT = 0.25;
  const kb = (o.kb || 4) / (e.d.boss ? 6 : e.kind === 'brute' ? 2.5 : 1), dx = e.x - p.x, dz = e.z - p.z, l = Math.hypot(dx, dz) || 1;
  e.kx += (dx / l) * kb; e.kz += (dz / l) * kb;
  emit(e.x, e.y, e.z, o.heavy ? 22 : 10, { color: armored ? [0.8, 0.8, 0.9] : e.d.glow, speed: 7, life: 0.45, size: 0.22 });
  dmgNum(e.x, e.y + e.d.size * 0.35, e.z, armored ? 'ARMOR ' + Math.round(dmg) : String(Math.round(dmg)), o.heavy ? 'big' : armored ? 'dim' : '');
  if (armored) hint('armor', 'Brutes are armored from the front — use a <b>heavy strike</b> or hit them after they swing');
  if (e.hp <= 0) killEnemy(e, o);
  return true;
}
function killEnemy(e, o = {}) {
  e.dead = true; e.deathT = 0; S.kills++; addCombo();
  const mult = 1 + Math.min(S.combo, 40) * 0.05;
  S.score += e.d.score * mult * (e.elite ? 2 : 1);
  sfx('kill'); emit(e.x, e.y, e.z, e.d.boss ? 140 : 34, { color: e.d.glow, speed: e.d.boss ? 14 : 9, life: 0.9, size: 0.3 });
  ring(e.x, e.y, e.z, 0.3, e.d.size * 1.3, 0.45, new THREE.Color(e.d.glow[0], e.d.glow[1], e.d.glow[2]), true);
  addBurst(e.d.boss ? 40 : 7); if (st.leech) p.hp = Math.min(p.maxHp, p.hp + 2 * st.leech);
  if (S.trial === 'drain') p.en = Math.min(p.maxEn, p.en + 25);
  const n = Math.round(e.d.shards * (e.elite ? 3 : 1));
  for (let i = 0; i < Math.min(n, 14); i++) spawnPickup(e.x, e.y, e.z, Math.ceil(n / Math.min(n, 14)));
  if (e.d.boss) { hitStop(0.18); S.slowT = 1.2; addShake(1); save.bosses++; persist(); platform.happytime(); for (const s of shots) s.life = 0; }
  if (st.chain && !o.chained) {
    let best = null, bd = 9; for (const q of enemies) { if (q.dead || q === e || q.state === 'spawn') continue; const d = Math.hypot(q.x - e.x, q.z - e.z); if (d < bd) { bd = d; best = q; } }
    if (best) { for (let i = 0; i <= 8; i++) emit(lerp(e.x, best.x, i / 8), lerp(e.y, best.y, i / 8), lerp(e.z, best.z, i / 8), 2, { color: [0.6, 0.9, 1], speed: 1.5, life: 0.25, size: 0.2, grav: 0 }); damageEnemy(best, 14 * st.chain * st.dmg, { chained: true, pierce: true, kb: 2 }); }
  }
}
function spawnPickup(x, y, z, val) {
  const m = new THREE.Mesh(pickGeo, pickMat); m.position.set(x, y, z); G.scene.add(m);
  const a = Math.random() * TAU; pickups.push({ m, vx: Math.cos(a) * 4, vy: 4 + Math.random() * 3, vz: Math.sin(a) * 4, t: 0, val });
}
let pickGeo, pickMat, shotGeo;

function playerHurt(dmg, e) {
  if (p.inv > 0 || S.state !== 'playing') return;
  if (S.trial === 'glass') dmg *= 2;
  p.hp -= dmg; p.inv = 0.4; S.combo = 0; addShake(0.7); sfx('hurt');
  const v = $('vignette'); v.classList.remove('hit'); void v.offsetWidth; v.classList.add('hit');
  if (p.hp <= 0) {
    if (S.up.wind && !S.windUsed) { S.windUsed = true; p.hp = p.maxHp * 0.4; p.inv = 1.5; banner('SECOND WIND', 'You rise again', 2); doBurst(true); }
    else gameOver();
  }
}
// An enemy melee strike lands on the player. Returns 'hit' | 'block' | 'parry' | 'miss'.
function strikePlayer(e, dmg) {
  if (p.dashT > 0 || p.inv > 0) return 'miss';
  const a = Math.atan2(-(e.x - p.x), -(e.z - p.z)), facing = Math.abs(angDiff(a, p.yaw)) < 1.25;
  if (p.blocking && facing) {
    if (p.blockT <= st.parry) {
      sfx('parry'); hitStop(0.1); S.slowT = 0.35; addShake(0.35); e.stagger = e.d.boss ? 2.2 : 1.8; e.state = 'recover'; e.t = 0; e.cd = 1;
      p.en = Math.min(p.maxEn, p.en + 25); addBurst(14); addCombo(); S.score += 50;
      emit(lerp(p.x, e.x, 0.4), 1.5, lerp(p.z, e.z, 0.4), 30, { color: [1, 0.95, 0.7], speed: 10, life: 0.4, size: 0.2 });
      ring(lerp(p.x, e.x, 0.4), 1.5, lerp(p.z, e.z, 0.4), 0.2, 2.2, 0.3, 0xfff2c0, true);
      dmgNum(e.x, e.y + 1, e.z, 'PARRY!', 'gold'); hintDone('parry');
      if (S.up.parry) { ring(p.x, 0.1, p.z, 0.5, 5.5, 0.4, 0xfff2c0); for (const q of enemies) if (!q.dead && Math.hypot(q.x - p.x, q.z - p.z) < 5.5) damageEnemy(q, 12 * S.up.parry * st.dmg, { pierce: true, kb: 9 }); }
      return 'parry';
    }
    p.en -= dmg * 1.3; p.enDelay = 0.9; sfx('block'); addShake(0.25);
    emit(lerp(p.x, e.x, 0.3), 1.5, lerp(p.z, e.z, 0.3), 12, { color: [1, 0.9, 0.6], speed: 6, life: 0.3, size: 0.16 });
    if (st.thorn) damageEnemy(e, 8 * st.thorn * st.dmg, { pierce: true, kb: 2 });
    if (p.en < 0) { p.en = 0; p.stun = 0.5; p.blocking = false; playerHurt(dmg * 0.5, e); banner('GUARD BROKEN', '', 1); return 'hit'; }
    hint('parry', 'Good block! Raise your guard <b>just before</b> a hit lands to <b>PARRY</b> and stun the beast');
    return 'block';
  }
  playerHurt(dmg, e); return 'hit';
}

function doBurst(free) {
  if (!free) { if (p.burst < 100) return; p.burst = 0; hintDone('burst'); }
  const rad = 9 * st.nova; sfx('burst'); hitStop(0.08); addShake(0.9); S.slowT = 0.3;
  ring(p.x, 0.15, p.z, 0.5, rad, 0.6, G.bladeGlowMat.color); ring(p.x, 1.2, p.z, 0.5, rad * 0.8, 0.5, 0xffffff);
  emit(p.x, 1.2, p.z, 90, { color: [G.bladeGlowMat.color.r, G.bladeGlowMat.color.g, G.bladeGlowMat.color.b], speed: 18, life: 0.7, size: 0.3, flat: true, grav: 0 });
  for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - p.x, e.z - p.z); if (d < rad + e.d.radius) { if (!e.d.boss) e.stagger = 1.6; damageEnemy(e, 55 * st.nova * st.dmg, { heavy: true, kb: 16 }); } }
  for (const s of shots) if (!s.friendly) s.life = 0;
}

function startSwing(type) {
  const heavy = type === 'heavy';
  const dur = (heavy ? 0.5 : type === 3 ? 0.44 : 0.34) / st.swing;
  p.swing = { type, t: 0, dur, hit: false }; p.queued = false; sfx(heavy ? 'heavy' : 'swing', type === 2 ? 1.12 : type === 3 ? 0.85 : 1);
  if (type !== 'heavy') hintDone('slash');
}
function swingHit() {
  const sw = p.swing, heavy = sw.type === 'heavy', big = heavy || sw.type === 3;
  const reach = (big ? 3.7 : 3.2) * st.reach, cone = big ? 1.25 : 0.95;
  let dmg = 13 * st.dmg * (heavy ? 2.6 * st.heavyMul : sw.type === 3 ? 1.6 : 1), any = false;
  for (const e of enemies) {
    if (e.dead) continue; const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
    if (d - e.d.radius > reach) continue;
    if (d > 1.2 && Math.abs(angDiff(Math.atan2(-dx, -dz), p.yaw)) > cone) continue;
    if (damageEnemy(e, dmg, { heavy, kb: heavy ? 12 : sw.type === 3 ? 7 : 4 })) { any = true; addBurst(heavy ? 9 : 4); if (heavy && e.stagger <= 0 && !e.d.boss && !e.dead) e.stagger = 0.7; }
  }
  for (const s of shots) { if (s.friendly) continue; const dx = s.x - p.x, dz = s.z - p.z, d = Math.hypot(dx, dz); if (d < reach + 0.5 && Math.abs(angDiff(Math.atan2(-dx, -dz), p.yaw)) < cone) { reflectShot(s); any = true; } }
  if (any) { sfx('hit'); hitStop(heavy ? 0.09 : 0.045); addShake(heavy ? 0.5 : 0.22); addCombo(); if (heavy) hintDone('heavy'); }
}
function reflectShot(s) {
  let tgt = s.owner && !s.owner.dead ? s.owner : null;
  if (!tgt) { let bd = 1e9; for (const e of enemies) { if (e.dead) continue; const d = Math.hypot(e.x - s.x, e.z - s.z); if (d < bd) { bd = d; tgt = e; } } }
  let dx, dy, dz; if (tgt) { dx = tgt.x - s.x; dy = tgt.y - s.y; dz = tgt.z - s.z; } else { dx = -Math.sin(p.yaw); dy = 0; dz = -Math.cos(p.yaw); }
  const l = Math.hypot(dx, dy, dz) || 1; s.vx = dx / l * 30; s.vy = dy / l * 30; s.vz = dz / l * 30; s.friendly = true; s.life = 3; s.dmg = 42 * st.reflect * st.dmg;
  s.m.material = shotMatF; sfx('deflect'); addBurst(6); S.score += 25; hintDone('deflect');
  emit(s.x, s.y, s.z, 12, { color: [1, 1, 1], speed: 6, life: 0.3, size: 0.18 });
}
let shotMatF;
const shotMats = {};
function fireShot(e, tx, ty, tz, speed, dmg, spread = 0) {
  const k = e.kind; if (!shotMats[k]) shotMats[k] = new THREE.MeshBasicMaterial({ color: new THREE.Color(e.d.glow[0], e.d.glow[1], e.d.glow[2]).multiplyScalar(1.6), toneMapped: false });
  const m = new THREE.Mesh(shotGeo, shotMats[k]); G.scene.add(m);
  const sx = e.x + Math.sin(e.yaw) * e.d.radius, sz = e.z + Math.cos(e.yaw) * e.d.radius;
  let dx = tx - sx, dy = ty - e.y, dz = tz - sz; if (spread) { const a = Math.atan2(dx, dz) + spread, l2 = Math.hypot(dx, dz); dx = Math.sin(a) * l2; dz = Math.cos(a) * l2; }
  const l = Math.hypot(dx, dy, dz) || 1;
  shots.push({ m, x: sx, y: e.y, z: sz, vx: dx / l * speed, vy: dy / l * speed, vz: dz / l * speed, owner: e, friendly: false, dmg, life: 5, col: e.d.glow, pt: 0 });
  sfx('shot');
}

// ---------------- enemies ----------------
function spawnEnemy(kind, x, z, o = {}) {
  const d = ENEMY[kind], vis = makeEnemyVisual(kind, YAW_FIX[kind]), w = Math.max(1, S.wave);
  const elite = !!o.elite, hpMul = (1 + 0.09 * (w - 1)) * (S.trial === 'swarm' ? 0.6 : 1) * (elite ? 1.9 : 1) * (d.boss ? 1 + 0.25 * (w / 5 - 1) : 1);
  const e = { kind, d, x, z, y: d.hover, vx: 0, vz: 0, kx: 0, kz: 0, hp: d.hp * hpMul, maxHp: d.hp * hpMul, dmg: d.dmg * (1 + 0.05 * (w - 1)) * (elite ? 1.3 : 1), state: o.idle ? 'idle' : 'spawn', t: 0, cd: 0.8 + Math.random() * 1.2, obj: vis.obj, mats: vis.mats, yaw: Math.atan2(p.x - x, p.z - z), stagger: 0, flash: 0, glow: 1, orbit: Math.random() < 0.5 ? -1 : 1, seed: Math.random() * 10, hitDone: false, elite, pattern: 0, summoned: false, dead: false, deathT: 0, hitT: 0, lx: 0, lz: 0, sc: elite ? 1.22 : 1, strikes: 0 };
  e.obj.rotation.order = 'YXZ'; e.obj.position.set(x, e.y, z); e.obj.scale.setScalar(0.01);
  if (elite) for (const m of e.mats) m.userData.u.uTint.value.set(1.5, 1.1, 0.6);
  G.scene.add(e.obj); enemies.push(e);
  if (!o.idle) { ring(x, 0.1, z, 0.3, d.radius * 2.4, 0.7, new THREE.Color(d.glow[0], d.glow[1], d.glow[2])); emit(x, d.hover, z, 24, { color: d.glow, speed: 5, life: 0.7, size: 0.24, grav: -2 }); sfx(d.boss ? 'boss' : 'spawn'); }
  if (d.boss) { S.bossRef = e; setText('bossName', d.name.toUpperCase()); }
  return e;
}
function removeEnemy(e) { G.scene.remove(e.obj); for (const m of e.mats) m.dispose(); const i = enemies.indexOf(e); if (i >= 0) enemies.splice(i, 1); if (S.bossRef === e) S.bossRef = null; }
function meleeBusy() { let n = 0; for (const e of enemies) if (!e.dead && !e.d.boss && (e.state === 'windup' || e.state === 'lunge')) n++; return n; }

function updateEnemy(e, dt) {
  const d = e.d; e.t += dt;
  if (e.dead) { e.deathT += dt; const k = 1 - e.deathT / 0.3; if (k <= 0) { removeEnemy(e); return; } e.obj.scale.setScalar(Math.max(0.01, k) * e.sc); e.obj.rotation.z += dt * 10; return; }
  let dx = p.x - e.x, dz = p.z - e.z; const dist = Math.hypot(dx, dz) || 0.001, nx = dx / dist, nz = dz / dist;
  let tvx = 0, tvz = 0, glow = 1, pitch = 0, face = true, sp = d.speed * (e.enraged ? 1.3 : 1);
  if (e.state === 'idle') { const a = e.seed + G.time * 0.25 * e.orbit; tvx = (Math.cos(a) * 9 - e.x) * 1.2; tvz = (Math.sin(a) * 9 - e.z) * 1.2; face = false; e.yaw = Math.atan2(e.vx, e.vz); }
  else if (e.state === 'spawn') { if (e.t > 0.8) { e.state = 'chase'; e.t = 0; } glow = 2; }
  else if (e.stagger > 0) { e.stagger -= dt; glow = 0.3; pitch = Math.sin(G.time * 22) * 0.12; face = false; e.obj.rotation.y += dt * 2.5; e.yaw = e.obj.rotation.y; if (e.stagger <= 0) { e.state = 'chase'; e.t = 0; } }
  else if (d.model === 'wraith') {
    if (e.state === 'chase') {
      e.cd -= dt; const tang = dist < 8 ? 0.65 : 0.2; tvx = (nx - nz * tang * e.orbit) * sp; tvz = (nz + nx * tang * e.orbit) * sp;
      if (dist < 3) { tvx -= nx * sp; tvz -= nz * sp; }
      if (dist < 6.5 && e.cd <= 0 && meleeBusy() < 2) { e.state = 'windup'; e.t = 0; sfx('tele'); }
    } else if (e.state === 'windup') { tvx = -nx * 2; tvz = -nz * 2; glow = 2.1 + Math.sin(e.t * 40) * 0.5; pitch = -0.45; if (e.t > (d.wind || 0.45)) { e.state = 'lunge'; e.t = 0; e.lx = nx; e.lz = nz; e.hitDone = false; } }
    else if (e.state === 'lunge') { e.vx = e.lx * 19; e.vz = e.lz * 19; tvx = e.vx; tvz = e.vz; glow = 2; pitch = 0.35; face = false; if (!e.hitDone && dist < 1.7) { e.hitDone = true; strikePlayer(e, e.dmg); } if (e.t > 0.34) { e.state = 'recover'; e.t = 0; } }
    else if (e.state === 'recover') { tvx = -nx * 1.5; tvz = -nz * 1.5; if (e.t > 0.75) { e.state = 'chase'; e.t = 0; e.cd = 1 + Math.random() * 1.4; } }
  } else if (d.model === 'brute') {
    if (e.state === 'chase') { e.cd -= dt; tvx = nx * sp; tvz = nz * sp; if (dist < 3.6 && e.cd <= 0) { e.state = 'windup'; e.t = 0; sfx('bossTele'); } }
    else if (e.state === 'windup') { glow = 2.1 + Math.sin(e.t * 30) * 0.5; pitch = -0.5 * Math.min(1, e.t / 0.5); if (e.t > 0.85) { e.state = 'recover'; e.t = 0; pitch = 0.5; ring(e.x + nx * 2, 0.1, e.z + nz * 2, 0.5, 4.2, 0.4, 0xffa040); addShake(dist < 8 ? 0.4 : 0.1); emit(e.x + nx * 2, 0.3, e.z + nz * 2, 26, { color: d.glow, speed: 8, life: 0.5, size: 0.25, flat: true }); if (dist < 4.6) strikePlayer(e, e.dmg); } }
    else if (e.state === 'recover') { pitch = 0.45 * (1 - e.t / 1.15); glow = 0.5; if (e.t > 1.15) { e.state = 'chase'; e.t = 0; e.cd = 0.5 + Math.random(); } }
  } else if (d.model === 'stinger') {
    e.cd -= dt;
    if (e.state === 'chase') { const want = 12, rad = clamp((dist - want) * 0.6, -1, 1); tvx = (nx * rad - nz * 0.7 * e.orbit) * sp; tvz = (nz * rad + nx * 0.7 * e.orbit) * sp; if (e.cd <= 0 && dist < 22) { e.state = 'windup'; e.t = 0; sfx('tele'); } if (Math.sin(G.time * 0.4 + e.seed) > 0.97) e.orbit *= -1; }
    else if (e.state === 'windup') { glow = 2.1 + Math.sin(e.t * 40) * 0.5; if (e.t > 0.5) { { const nv = d.volley || 1; for (let i = 0; i < nv; i++) fireShot(e, p.x, 1.35, p.z, 13 + Math.min(6, S.wave * 0.3), e.dmg, (i - (nv - 1) / 2) * 0.2); } hint('deflect', 'Spore incoming! <b>Slash</b> or <b>block</b> it to send it back'); e.state = 'chase'; e.t = 0; e.cd = (S.trial === 'storm' ? 1.7 : 2.7) + Math.random() * 0.8; } }
  } else if (d.boss) {
    if (!e.summoned && e.hp < e.maxHp * 0.5) { e.summoned = true; e.enraged = true; banner('THE TYRANT ENRAGES', '', 1.6); sfx('boss'); for (let i = 0; i < 3; i++) { const a = Math.random() * TAU; S.queue.push('wraith'); } }
    if (e.state === 'chase') {
      e.cd -= dt; tvx = nx * sp; tvz = nz * sp;
      if (e.cd <= 0) { const r = (e.pattern++) % 3; if (dist < 6.2) { e.state = 'sweepW'; e.strikes = 0; } else if (r === 1) e.state = 'volleyW'; else e.state = 'chargeW'; e.t = 0; sfx('bossTele'); }
    } else if (e.state === 'sweepW') { glow = 2.1 + Math.sin(e.t * 30) * 0.5; pitch = -0.3; tvx = nx * 1.5; tvz = nz * 1.5; const need = e.strikes === 0 ? 0.7 : 0.45; if (e.t > need) { e.strikes++; e.t = 0; ring(e.x + nx * 3, 1.2, e.z + nz * 3, 0.5, 5, 0.3, 0xb070ff); addShake(0.3); sfx('swing', 0.6); let res = 'miss'; if (dist < 6.6) res = strikePlayer(e, e.dmg); if (res === 'parry' || e.strikes >= 2) { if (res !== 'parry') { e.state = 'recover'; e.t = 0; } } } }
    else if (e.state === 'chargeW') { glow = 2.1 + Math.sin(e.t * 40) * 0.5; pitch = -0.35; if (e.t > 0.9) { e.state = 'charge'; e.t = 0; e.lx = nx; e.lz = nz; e.hitDone = false; sfx('dash'); } }
    else if (e.state === 'charge') { e.vx = e.lx * 24; e.vz = e.lz * 24; tvx = e.vx; tvz = e.vz; pitch = 0.4; glow = 2; face = false; emit(e.x, 0.6, e.z, 3, { color: d.glow, speed: 3, life: 0.5, size: 0.3 }); if (!e.hitDone && dist < 3) { e.hitDone = true; strikePlayer(e, e.dmg * 1.3); } if (e.t > 0.6) { e.state = 'recover'; e.t = 0; } }
    else if (e.state === 'volleyW') { glow = 2.1 + Math.sin(e.t * 40) * 0.5; if (e.t > 0.7) { const n = e.enraged ? 7 : 5; for (let i = 0; i < n; i++) fireShot(e, p.x, 1.35, p.z, 15, e.dmg * 0.6, (i - (n - 1) / 2) * 0.16); e.state = 'recover'; e.t = 0.5; } }
    else if (e.state === 'recover') { glow = 0.5; pitch = 0.25; if (e.t > 1.3) { e.state = 'chase'; e.t = 0; e.cd = e.enraged ? 0.5 : 1; } }
  }
  // integrate
  const acc = e.state === 'lunge' || e.state === 'charge' ? 1 : Math.min(1, 5 * dt);
  e.vx += (tvx - e.vx) * acc; e.vz += (tvz - e.vz) * acc;
  e.x += (e.vx + e.kx) * dt; e.z += (e.vz + e.kz) * dt; const kd = Math.exp(-7 * dt); e.kx *= kd; e.kz *= kd;
  for (const q of enemies) { if (q === e || q.dead) continue; const ax = e.x - q.x, az = e.z - q.z, l = Math.hypot(ax, az), m = (e.d.radius + q.d.radius) * 0.9; if (l < m && l > 0.001) { const f = (m - l) * 0.5; e.x += ax / l * f; e.z += az / l * f; } }
  for (const c of PILLARS) { const ax = e.x - c.x, az = e.z - c.z, l = Math.hypot(ax, az), m = c.r + d.radius * 0.6; if (l < m && l > 0.001) { e.x = c.x + ax / l * m; e.z = c.z + az / l * m; if (e.state === 'lunge' || e.state === 'charge') { e.state = 'recover'; e.t = 0; } } }
  const er = Math.hypot(e.x, e.z), lim = R - d.radius; if (er > lim) { e.x *= lim / er; e.z *= lim / er; }
  if (face) e.yaw += angDiff(Math.atan2(dx, dz), e.yaw) * Math.min(1, 8 * dt);
  // visuals
  e.hitT = Math.max(0, e.hitT - dt);
  const spawnK = e.state === 'spawn' ? clamp(e.t / 0.7, 0.01, 1) : 1, squash = 1 + e.hitT * 0.6;
  e.obj.scale.set(e.sc * spawnK * squash, e.sc * spawnK / squash, e.sc * spawnK * squash);
  e.obj.position.set(e.x, e.y + Math.sin(G.time * 2.2 + e.seed) * 0.14 * (d.boss ? 2 : 1), e.z);
  if (e.stagger <= 0) e.obj.rotation.y = e.yaw;
  e.obj.rotation.x += (pitch - e.obj.rotation.x) * Math.min(1, 12 * dt);
  e.obj.rotation.z = Math.sin(G.time * 1.7 + e.seed) * 0.06;
  e.glow += (glow - e.glow) * Math.min(1, 14 * dt); e.flash = Math.max(0, e.flash - dt * 6);
  for (const m of e.mats) { m.userData.u.uGlow.value = e.glow; m.userData.u.uFlash.value = e.flash * 0.16; }
}

function updateShots(dt) {
  for (let i = shots.length - 1; i >= 0; i--) {
    const s = shots[i]; s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.pt -= dt;
    if (s.pt <= 0) { s.pt = 0.03; emit(s.x, s.y, s.z, 1, { color: s.friendly ? [1, 1, 1] : s.col, speed: 0.6, life: 0.3, size: 0.26, grav: 0 }); }
    let gone = s.life <= 0 || s.y < 0.1 || Math.hypot(s.x, s.z) > R + 1;
    for (const c of PILLARS) if (Math.hypot(s.x - c.x, s.z - c.z) < c.r && s.y < 5) gone = true;
    if (!gone && s.friendly) { for (const e of enemies) { if (e.dead || e.state === 'spawn') continue; if (Math.hypot(e.x - s.x, e.y - s.y, e.z - s.z) < e.d.radius + 0.5) { damageEnemy(e, s.dmg, { pierce: true, kb: 6 }); sfx('hit'); gone = true; break; } } }
    else if (!gone) {
      const d = Math.hypot(p.x - s.x, 1.35 - s.y, p.z - s.z);
      if (d < 0.9) {
        const facing = Math.abs(angDiff(Math.atan2(-(s.x - s.vx * 0.2 - p.x), -(s.z - s.vz * 0.2 - p.z)), p.yaw)) < 1.3;
        if (p.dashT > 0) { /* dodged */ } else if (p.blocking && facing) { reflectShot(s); continue; } else { playerHurt(s.dmg, null); gone = true; }
      }
    }
    if (gone) { emit(s.x, s.y, s.z, 8, { color: s.col, speed: 4, life: 0.3, size: 0.2 }); G.scene.remove(s.m); shots.splice(i, 1); } else s.m.position.set(s.x, s.y, s.z);
  }
}
function updatePickups(dt) {
  for (let i = pickups.length - 1; i >= 0; i--) {
    const k = pickups[i]; k.t += dt; const m = k.m.position;
    if (k.t < 0.45) { k.vy -= 14 * dt; m.x += k.vx * dt; m.y = Math.max(0.3, m.y + k.vy * dt); m.z += k.vz * dt; }
    else { const dx = p.x - m.x, dy = 1.1 - m.y, dz = p.z - m.z, l = Math.hypot(dx, dy, dz), v = 10 + k.t * 22; if (l < 0.8) { S.runShards += k.val; sfx('shard'); G.scene.remove(k.m); pickups.splice(i, 1); continue; } m.x += dx / l * v * dt; m.y += dy / l * v * dt; m.z += dz / l * v * dt; }
    k.m.rotation.y += dt * 6;
  }
}

// ---------------- waves ----------------
function startWave(n) {
  S.wave = n; S.queue = waveList(n, S.rng, S.trial); S.spawnT = 0.8; S.waveActive = true;
  const boss = n % 5 === 0;
  if (S.rng() < 0.999 && n >= 7 && !boss) S.eliteAt = Math.floor(S.rng() * S.queue.length); else S.eliteAt = -1;
  banner(boss ? 'RIFT TYRANT' : 'WAVE ' + n, boss ? 'Parry its blades. Dash through its charge.' : n === 1 ? 'Clear the beasts' : '', 2.2);
  if (boss) sfx('boss');
  if (n === 2) hint('heavy', S.touch ? '<b>Hold SLASH</b> to charge a heavy strike' : '<b>Hold Left-Click</b> to charge a heavy strike');
  if (n === 3) hint('dash', S.touch ? 'Tap <b>DASH</b> to dodge through attacks' : 'Press <b>Space</b> to dash through attacks');
}
function updateWaves(dt) {
  if (!S.waveActive) { if (S.betweenT > 0) { S.betweenT -= dt; if (S.betweenT <= 0) openUpgrades(); } return; }
  const alive = enemies.filter((e) => !e.dead).length, cap = Math.min(9, 4 + Math.floor(S.wave / 3)) + (S.trial === 'swarm' ? 2 : 0);
  S.spawnT -= dt;
  if (S.queue.length && S.spawnT <= 0 && alive < cap) {
    const kind = S.queue.shift(); let x, z, tries = 0;
    do { const a = Math.random() * TAU, r = kind === 'tyrant' ? 16 : R - 3 - Math.random() * 4; x = Math.cos(a) * r; z = Math.sin(a) * r; } while (Math.hypot(x - p.x, z - p.z) < 9 && tries++ < 20);
    spawnEnemy(kind, x, z, { elite: S.queue.length === S.eliteAt && kind !== 'tyrant' }); S.spawnT = S.wave < 3 ? 1.1 : 0.6; return;
  }
  if (!S.queue.length && alive === 0) {
    S.waveActive = false; S.betweenT = 1.6; S.slowT = 0.6; sfx('wave'); p.hp = Math.min(p.maxHp, p.hp + 15);
    S.score += 200 * S.wave; banner('WAVE ' + S.wave + ' CLEARED', '+15 integrity', 1.6);
    if (S.wave % 5 === 0) { S.biome++; setBiome(S.biome); }
    if (S.daily && S.wave === 5 && !save.daily.done) { save.daily.done = true; save.dailyClears++; S.runShards += 40; }
    hintDone('move');
  }
}

// ---------------- upgrades UI ----------------
let offer = [];
function rollOffer() {
  const pool = UPGRADES.filter((u) => (S.up[u.id] || 0) < u.max); offer = [];
  while (offer.length < 3 && pool.length) offer.push(pool.splice(Math.floor(S.rng() * pool.length), 1)[0]);
}
function drawOffer() {
  $('cards').innerHTML = offer.map((u, i) => '<button class="card" data-i="' + i + '"><div class="ic">' + u.icon + '</div><h3>' + u.name + '</h3><p>' + u.desc + '</p><div class="lv">' + ((S.up[u.id] || 0) ? 'Level ' + (S.up[u.id] + 1) : 'New') + '</div>' + (S.touch ? '' : '<div class="key">' + (i + 1) + '</div>') + '</button>').join('');
  $('reroll').textContent = 'Reroll (' + S.rerolls + ')'; show('reroll', S.rerolls > 0);
}
function openUpgrades() {
  if (S.state !== 'playing') return;
  S.state = 'upgrade'; platform.gameplayStop(); unlockPointer(); rollOffer(); drawOffer();
  $('upgTitle').textContent = 'WAVE ' + S.wave + ' CLEARED — CHOOSE AN UPGRADE'; show('upg', true); inp.atk = inp.block = false;
}
function pickUpgrade(i) {
  const u = offer[i]; if (!u || S.state !== 'upgrade') return;
  S.up[u.id] = (S.up[u.id] || 0) + 1; if (u.id === 'vital') p.hp = Math.min(p.maxHp + 25, p.hp + 25);
  calcStats(); sfx('pick'); show('upg', false); S.state = 'playing'; platform.gameplayStart(); lockPointer(); startWave(S.wave + 1);
}
$('cards').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) pickUpgrade(+c.dataset.i); });
$('reroll').addEventListener('click', () => { if (S.rerolls > 0) { S.rerolls--; sfx('ui'); rollOffer(); drawOffer(); } });

// ---------------- run flow ----------------
function clearWorld() { while (enemies.length) removeEnemy(enemies[0]); for (const s of shots) G.scene.remove(s.m); shots.length = 0; for (const k of pickups) G.scene.remove(k.m); pickups.length = 0; }
function startRun(daily) {
  if (S.state !== 'menu' && S.state !== 'over') return;
  initAudio(); resumeAudio(); startMusic(); sfx('pick');
  clearWorld(); S.daily = !!daily; S.trial = daily ? TRIALS[dayNum() % TRIALS.length].id : null; S.rng = daily ? mulberry32(dayNum() * 7919) : Math.random;
  if (daily && save.daily.date !== today()) { save.daily = { date: today(), best: 0, done: false }; }
  Object.assign(S, { score: 0, combo: 0, kills: 0, runShards: 0, up: {}, rerolls: arm('reroll'), windUsed: false, biome: 0, bossRef: null, timeScale: 1, slowT: 0, hitStop: 0, shake: 0, betweenT: 0 });
  Object.assign(p, { x: 0, z: 9, yaw: 0, pitch: 0, vx: 0, vz: 0, maxHp: 100, hp: 100, maxEn: 100, en: 100, burst: 0, swing: null, comboStep: 0, chargeT: 0, charged: false, blocking: false, stun: 0, inv: 0, dashT: 0, dashCharges: 1, moved: 0 });
  for (let i = 0; i < arm('head'); i++) { const u = UPGRADES[Math.floor(S.rng() * UPGRADES.length)]; if (u.id !== 'wind') S.up[u.id] = (S.up[u.id] || 0) + 1; }
  calcStats(); p.hp = p.maxHp; p.en = p.maxEn; p.dashCharges = p.dashMax; setBiome(0);
  setBladeColor(BLADES.find((b) => b.id === save.blade).color);
  for (const id of ['menu', 'over', 'armory', 'pause', 'upg']) show(id, false); show('hud', true); document.body.classList.add('ingame');
  S.state = 'playing'; save.runs++; persist(); lockPointer(); platform.gameplayStart(); startWave(1);
  if (S.trial) banner(TRIALS.find((t) => t.id === S.trial).name.toUpperCase(), 'Daily Trial', 2.4);
  hint('move', S.touch ? 'Left stick to <b>move</b> · drag to <b>look</b> · tap <b>SLASH</b>' : '<b>WASD</b> to move · <b>Mouse</b> to look · <b>Click</b> to slash');
}
function againRun() { if (S.state !== 'over' || S.adBreak) return; S.adBreak = true; platform.commercialBreak(() => setForcedMute(true), () => { setForcedMute(false); S.adBreak = false; startRun(S.daily); }); }
function pause() { if (S.state !== 'playing') return; S.state = 'paused'; platform.gameplayStop(); unlockPointer(); show('pause', true); $('sens').value = save.sens; inp.atk = inp.block = false; }
function resume() { if (S.state !== 'paused') return; show('pause', false); S.state = 'playing'; platform.gameplayStart(); lockPointer(); }
function gameOver() {
  S.state = 'over'; platform.gameplayStop(); unlockPointer(); sfx('dead'); S.slowT = 0; setIntensity(0);
  const earned = Math.round(S.runShards * st.shard) + S.wave * 3, oldRank = rankOf(save.xp), newBest = S.wave > save.best;
  save.shards += earned; save.xp += Math.floor(S.score); save.best = Math.max(save.best, S.wave); save.bestScore = Math.max(save.bestScore, Math.floor(S.score));
  if (S.daily) { save.daily.best = Math.max(save.daily.best, S.wave); if (save.lastDay !== today()) { save.streak = save.lastDay && dayNum() - (save.lastDayNum || 0) === 1 ? save.streak + 1 : 1; save.lastDay = today(); save.lastDayNum = dayNum(); } }
  persist(); const nr = rankOf(save.xp);
  $('overStats').innerHTML = '<div><b>' + S.wave + '</b><span>Wave reached' + (newBest ? ' — NEW BEST' : '') + '</span></div><div><b>' + S.kills + '</b><span>Beasts slain</span></div><div><b>' + Math.floor(S.score) + '</b><span>Score</span></div><div><b>◆ ' + earned + '</b><span>Shards earned</span></div>';
  const next = RANKS[nr + 1];
  $('overRank').innerHTML = (nr > oldRank ? '<b class="gold">RANK UP! </b>' : '') + 'Rank: <b>' + RANKS[nr].name + '</b>' + (next ? ' — ' + (next.xp - save.xp) + ' XP to ' + next.name : '');
  show('hud', false); show('hint', false); S.hintId = null; show('over', true); document.body.classList.remove('ingame'); if (nr > oldRank || newBest) platform.happytime();
}
function toMenu() {
  clearWorld(); S.state = 'menu'; S.wave = 0; S.waveActive = false; for (const id of ['over', 'armory', 'pause', 'hud', 'upg']) show(id, false); document.body.classList.remove('ingame');
  for (let i = 0; i < 4; i++) { const k = ['wraith', 'stinger', 'wraith', 'brute'][i], a = i * 1.57; spawnEnemy(k, Math.cos(a) * 9, Math.sin(a) * 9, { idle: true }).seed = a; }
  drawMenu(); show('menu', true);
}
function drawMenu() {
  const t = TRIALS[dayNum() % TRIALS.length], dd = save.daily.date === today() ? save.daily : { best: 0, done: false };
  $('mStats').innerHTML = '<span>Best wave <b>' + save.best + '</b></span><span>Rank <b>' + RANKS[rankOf(save.xp)].name + '</b></span><span>◆ <b>' + save.shards + '</b></span>';
  $('dailyBtn').innerHTML = '<small>DAILY TRIAL' + (save.streak > 1 ? ' · ' + save.streak + '-day streak' : '') + '</small><b>' + t.name + '</b><span>' + t.desc + '</span><em>' + (dd.done ? 'Cleared today ✓ Best wave ' + dd.best : 'Clear wave 5 for +40 shards') + '</em>';
  $('blades').innerHTML = BLADES.map((b) => { const ok = bladeUnlocked(b); return '<button class="dot' + (save.blade === b.id ? ' sel' : '') + (ok ? '' : ' lock') + '" data-id="' + b.id + '" style="--c:#' + b.color.toString(16).padStart(6, '0') + '" title="' + (ok ? b.name : b.unlock.text) + '">' + (ok ? '' : '🔒') + '</button>'; }).join('');
  const sel = BLADES.find((b) => b.id === save.blade); $('bladeName').textContent = sel.name + ' blade'; setBladeColor(sel.color);
  $('muteBtn').textContent = isMuted() ? 'Sound: OFF' : 'Sound: ON'; $('muteBtn2').textContent = $('muteBtn').textContent;
}
function drawArmory() {
  $('armShards').textContent = '◆ ' + save.shards;
  $('armList').innerHTML = ARMORY.map((a) => { const lv = arm(a.id), mx = lv >= a.max, c = mx ? 0 : a.cost[lv]; return '<div class="arow"><div><h3>' + a.name + ' <small>' + lv + '/' + a.max + '</small></h3><p>' + a.desc + '</p></div><button data-id="' + a.id + '" ' + (mx || save.shards < c ? 'disabled' : '') + '>' + (mx ? 'MAX' : '◆ ' + c) + '</button></div>'; }).join('');
}
function toggleMute() { setMuted(!isMuted()); save.mute = isMuted(); persist(); drawMenu(); }
$('playBtn').addEventListener('click', () => startRun(false));
$('dailyBtn').addEventListener('click', () => startRun(true));
$('armBtn').addEventListener('click', () => { sfx('ui'); show('menu', false); drawArmory(); show('armory', true); S.state = 'armory'; });
$('armBack').addEventListener('click', () => { sfx('ui'); show('armory', false); S.state = 'menu'; drawMenu(); show('menu', true); });
$('armList').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; const a = ARMORY.find((q) => q.id === b.dataset.id), lv = arm(a.id); if (lv < a.max && save.shards >= a.cost[lv]) { save.shards -= a.cost[lv]; save.armory[a.id] = lv + 1; persist(); sfx('buy'); drawArmory(); } else sfx('deny'); });
$('blades').addEventListener('click', (e) => { const b = e.target.closest('.dot'); if (!b) return; const bl = BLADES.find((q) => q.id === b.dataset.id); if (bladeUnlocked(bl)) { save.blade = bl.id; persist(); sfx('ui'); drawMenu(); } else { sfx('deny'); $('bladeName').textContent = '🔒 ' + bl.unlock.text; } });
$('muteBtn').addEventListener('click', toggleMute); $('muteBtn2').addEventListener('click', toggleMute);
$('resumeBtn').addEventListener('click', resume); $('quitBtn').addEventListener('click', () => { gameOverQuiet(); });
$('pauseBtn').addEventListener('click', pause);
$('againBtn').addEventListener('click', againRun); $('menuBtn').addEventListener('click', toMenu);
$('sens').addEventListener('input', (e) => { save.sens = +e.target.value; persist(); });
function gameOverQuiet() { show('pause', false); S.state = 'playing'; gameOver(); }

// ---------------- player update ----------------
const POSE = { idle: [0.46, -0.4, -0.5, -1.0, 0.2], block: [0.02, -0.2, -0.5, -0.2, 1.3], charge: [0.44, -0.12, -0.5, 0.22, -0.55],
  s1: [0.5, -0.05, -0.5, -0.5, -1.0], e1: [-0.4, -0.38, -0.55, -1.25, 1.6], s2: [-0.5, -0.05, -0.5, -0.5, 1.0], e2: [0.45, -0.38, -0.55, -1.25, -1.6],
  s3: [0.12, 0.12, -0.42, 0.6, 0.1], e3: [0.05, -0.5, -0.62, -1.95, 0.0], sh: [0.55, 0.05, -0.38, 0.5, -1.3], eh: [-0.5, -0.42, -0.6, -1.35, 1.9] };
const cur = POSE.idle.slice(), tmp = [0, 0, 0, 0, 0];
const mix = (a, b, t, out) => { for (let i = 0; i < 5; i++) out[i] = a[i] + (b[i] - a[i]) * t; return out; };
const ease = (t) => t * t * (3 - 2 * t);

function updatePlayer(dt) {
  // movement input
  let mx = inp.mx, mz = inp.mz;
  if (!S.touch) { mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.KeyQ || keys.ArrowLeft ? 1 : 0); mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.KeyZ || keys.ArrowUp ? 1 : 0); }
  const ml = Math.hypot(mx, mz); if (ml > 1) { mx /= ml; mz /= ml; }
  const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw);
  let wx = mx * cs + mz * sn, wz = -mx * sn + mz * cs;
  p.stun = Math.max(0, p.stun - dt); p.inv = Math.max(0, p.inv - dt);
  const speed = (p.blocking ? 3.6 : p.chargeT > 0.2 ? 4.6 : 7.2) * (p.stun > 0 ? 0.3 : 1);
  // dash
  if (p.dashCharges < p.dashMax) { p.dashRe -= dt; if (p.dashRe <= 0) { p.dashCharges++; p.dashRe = 1.1; } }
  if (inp.dash && p.dashT <= 0 && p.dashCharges > 0 && p.en >= 18 && p.stun <= 0) {
    p.dashCharges--; if (p.dashCharges === p.dashMax - 1) p.dashRe = 1.1; p.en -= 18; p.enDelay = 0.5; p.dashT = 0.2;
    if (ml < 0.1) { wx = -sn; wz = -cs; } p.ddx = wx / (Math.hypot(wx, wz) || 1); p.ddz = wz / (Math.hypot(wx, wz) || 1); sfx('dash'); p.fovKick = 1; hintDone('dash');
    emit(p.x, 0.8, p.z, 14, { color: [G.bladeGlowMat.color.r, G.bladeGlowMat.color.g, G.bladeGlowMat.color.b], speed: 3, life: 0.4, size: 0.22, grav: 0 });
  }
  inp.dash = false;
  if (p.dashT > 0) { p.dashT -= dt; p.vx = p.ddx * 34; p.vz = p.ddz * 34; }
  else { const a = Math.min(1, 14 * dt); p.vx += (wx * speed - p.vx) * a; p.vz += (wz * speed - p.vz) * a; }
  p.x += p.vx * dt; p.z += p.vz * dt; const mvd = Math.hypot(p.vx, p.vz) * dt; p.moved += mvd; p.bob += mvd;
  if (p.moved > 4 && S.hintId === 'move' && save.tut.slash) hintDone('move');
  const pr = Math.hypot(p.x, p.z); if (pr > R - 0.7) { p.x *= (R - 0.7) / pr; p.z *= (R - 0.7) / pr; }
  for (const c of PILLARS) { const ax = p.x - c.x, az = p.z - c.z, l = Math.hypot(ax, az), m = c.r + 0.5; if (l < m && l > 0.001) { p.x = c.x + ax / l * m; p.z = c.z + az / l * m; } }
  for (const e of enemies) { if (e.dead || p.dashT > 0) continue; const ax = p.x - e.x, az = p.z - e.z, l = Math.hypot(ax, az), m = e.d.radius * 0.9 + 0.5; if (l < m && l > 0.001) { p.x = e.x + ax / l * m; p.z = e.z + az / l * m; } }
  // block
  const wantBlock = inp.block && p.stun <= 0 && !(p.swing && p.swing.t / p.swing.dur < 0.6);
  if (wantBlock && !p.blocking) { p.blocking = true; p.blockT = 0; if (p.swing) p.swing = null; p.chargeT = 0; p.charged = false; }
  else if (!wantBlock) p.blocking = false;
  if (p.blocking) { p.blockT += dt; p.en -= 6 * dt; p.enDelay = Math.max(p.enDelay, 0.3); if (p.en <= 0) { p.en = 0; p.blocking = false; } }
  // energy
  p.enDelay -= dt; if (p.enDelay <= 0 && !p.blocking) p.en = Math.min(p.maxEn, p.en + 24 * st.regen * dt);
  // attacks
  p.comboWin -= dt; if (p.comboWin <= 0 && !p.swing) p.comboStep = 0;
  if (inp.atkPressed && !p.blocking && p.stun <= 0) { if (!p.swing) { p.comboStep = (p.comboStep % 3) + 1; startSwing(p.comboStep); } else if (p.swing.t / p.swing.dur > 0.35) p.queued = true; }
  inp.atkPressed = false;
  if (inp.atk && !p.swing && !p.blocking && p.stun <= 0) { p.chargeT += dt * st.heavyRate; if (!p.charged && p.chargeT > 0.55) { if (p.en >= 22) { p.charged = true; sfx('charge'); } else p.chargeT = 0.4; } }
  if (inp.atkReleased) { if (p.charged && !p.swing && !p.blocking) { p.en -= 22; p.enDelay = 0.7; startSwing('heavy'); p.comboStep = 0; } p.chargeT = 0; p.charged = false; }
  inp.atkReleased = false; if (!inp.atk) { p.chargeT = 0; p.charged = false; }
  if (inp.burst) { doBurst(false); inp.burst = false; }
  let trailOn = false, target = POSE.idle;
  if (p.swing) {
    const sw = p.swing; sw.t += dt; const k = sw.t / sw.dur, a = sw.type === 'heavy' ? 'h' : sw.type;
    const s = POSE['s' + a], e = POSE['e' + a];
    if (k < 0.22) mix(cur, s, Math.min(1, dt / (sw.dur * 0.22 - (sw.t - dt)) || 1), cur); else if (k < 0.6) { mix(s, e, ease((k - 0.22) / 0.38), cur); trailOn = true; } else mix(e, POSE.idle, ease((k - 0.6) / 0.4) * 0.6, cur);
    if (!sw.hit && k >= 0.36) { sw.hit = true; swingHit(); if (S.touch) { let best = null, bd = 0.7; for (const q of enemies) { if (q.dead) continue; const d = angDiff(Math.atan2(-(q.x - p.x), -(q.z - p.z)), p.yaw); if (Math.abs(d) < bd && Math.hypot(q.x - p.x, q.z - p.z) < 7) { bd = Math.abs(d); best = d; } } if (best !== null) p.yaw += best * 0.5; } }
    if (k >= 1 || (p.queued && k > 0.72)) { const q = p.queued; p.swing = null; p.comboWin = 0.5; if (q && !p.blocking) { p.comboStep = (p.comboStep % 3) + 1; startSwing(p.comboStep); } }
  } else {
    target = p.blocking ? POSE.block : p.chargeT > 0.18 ? POSE.charge : POSE.idle;
    mix(cur, target, Math.min(1, (p.blocking ? 26 : 12) * dt), cur);
  }
  // view model + camera
  const bobY = Math.sin(p.bob * 1.6) * 0.035, bobX = Math.cos(p.bob * 0.8) * 0.02, jit = p.charged ? (Math.random() - 0.5) * 0.012 : 0;
  G.vm.position.set(cur[0] + bobX + jit, cur[1] + bobY * 0.6 + jit, cur[2]); G.vm.rotation.set(cur[3], 0, cur[4]);
  const glowK = p.charged ? 1.6 + Math.sin(G.time * 40) * 0.3 : p.blocking ? 1.3 : 1;
  setBladeGlow(glowK);
  p.fovKick = Math.max(0, p.fovKick - dt * 4);
  S.shake = Math.max(0, S.shake - dt * 2.4); const sh = S.shake * S.shake * 0.09;
  G.camera.position.set(p.x + (Math.random() - 0.5) * sh, 1.65 + bobY + (Math.random() - 0.5) * sh, p.z);
  G.camera.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.3, p.yaw + (Math.random() - 0.5) * sh * 0.3, 0);
  const fov = G.baseFov + p.fovKick * 9; if (Math.abs(G.camera.fov - fov) > 0.05) { G.camera.fov = fov; G.camera.updateProjectionMatrix(); }
  updateTrail(trailOn, p.swing && p.swing.type === 'heavy' ? 0.55 : 0.38);
}

// ---------------- main loop ----------------
const STEP = 1 / 120; let acc = 0, last = 0, fpsAcc = 0, fpsN = 0, slowFrames = 0;
function sim(dt) {
  S.t += dt; G.time += dt;
  if (S.state === 'playing') {
    updatePlayer(dt); for (let i = enemies.length - 1; i >= 0; i--) updateEnemy(enemies[i], dt);
    updateShots(dt); updatePickups(dt); updateWaves(dt);
    if (S.comboT > 0) { S.comboT -= dt; if (S.comboT <= 0) S.combo = 0; }
    if (S.hintId) { S.hintT += dt; if (S.hintT > 14) hintDone(S.hintId); }
  } else if (S.state === 'menu' || S.state === 'armory' || S.state === 'over') {
    for (let i = enemies.length - 1; i >= 0; i--) { const e = enemies[i]; if (S.state === 'over' && e.state !== 'idle') { e.state = 'idle'; e.seed = Math.atan2(e.z, e.x) - G.time * 0.25 * e.orbit; } updateEnemy(e, dt); }
    updateShots(dt);
    S.menuAng += dt * 0.07; const a = S.menuAng;
    G.camera.position.set(Math.sin(a) * 19, 4.2, Math.cos(a) * 19); G.camera.rotation.set(-0.13, a, 0);
    cur[0] = 0.42; cur[1] = -0.3; cur[2] = -0.6; cur[3] = -0.35; cur[4] = 0.55; G.vm.position.set(cur[0], cur[1], cur[2]); G.vm.rotation.set(cur[3], 0, cur[4]); updateTrail(false, 0);
  }
  updateParticles(dt); updateRings(dt);
  G.wall.material.uniforms.uTime.value = G.time; if (G.spinners) for (const s of G.spinners) { s.rotation.y += dt * 0.8; s.position.y = 5.6 + Math.sin(G.time * 1.3 + s.position.x) * 0.25; }
}
function frame(now) {
  requestAnimationFrame(frame);
  if (__TEST__ && window.__ew.manual) { last = now; return; }
  tick(now);
}
function tick(now) {
  let dt = Math.min(0.1, (now - last) / 1000 || 0); last = now;
  if (S.state === 'paused' || S.state === 'upgrade' || S.state === 'loading') { render(); return; }
  fpsAcc += dt; fpsN++; if (fpsAcc > 2) { const ms = fpsAcc / fpsN * 1000; fpsAcc = 0; fpsN = 0; if (ms > 27 && G.quality > 0) { if (++slowFrames >= 2) { setQuality(G.quality - 1); slowFrames = 0; } } else slowFrames = 0; }
  if (S.hitStop > 0) { S.hitStop -= dt; dt = 0; }
  if (S.slowT > 0) { S.slowT -= dt; dt *= 0.35; }
  acc += dt; let n = 0; while (acc >= STEP && n++ < 14) { sim(STEP); acc -= STEP; } if (n >= 14) acc = 0;
  if (S.state === 'playing') { updateHud(); setIntensity(clamp(0.25 + enemies.length * 0.12 + (S.bossRef ? 0.4 : 0), 0, 1)); }
  render();
}

// ---------------- boot ----------------
async function boot() {
  initRenderer(canvas);
  await platform.init((m) => setForcedMute(m));
  platform.loadingStart();
  if (platform.isMobile()) setupTouch();
  setMuted(!!save.mute);
  await loadAssets((k) => { $('loadFill').style.width = Math.round(k * 100) + '%'; });
  buildWorld(); buildParticles(); buildRings(); buildViewModel(); buildTrail();
  pickGeo = new THREE.OctahedronGeometry(0.13); pickMat = new THREE.MeshBasicMaterial({ color: 0x9fe8ff, toneMapped: false });
  shotGeo = new THREE.SphereGeometry(0.3, 12, 10); shotMatF = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  setBiome(0); platform.loadingStop();
  show('loading', false); toMenu(); requestAnimationFrame(frame);
}
if (__TEST__) window.__ew = { manual: false, tick, againRun, toggleMute, isMuted, setLast(v) { last = v; acc = 0; }, jumpWave(n) { clearWorld(); S.queue.length = 0; S.betweenT = 0; if (S.state === 'upgrade') { show('upg', false); S.state = 'playing'; } startWave(n); }, toMenu, pause, resume, gameOver, doBurst, platform, cur, POSE, S, p, st, enemies, shots, inp, save, G, sim, render, startRun, pickUpgrade, spawnEnemy, damageEnemy, keys, YAW_FIX, step(n, dt = STEP) { for (let i = 0; i < n; i++) sim(dt); if (S.state === 'playing') updateHud(); } };
boot();
