import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { R, latLon, buildEarth, buildStars } from './earth.js';
import { Audio } from './audio.js';
import { REGIONS, FACTIONS, ENEMY, MISSIONS, UPGRADES, ENDINGS } from './data.js';

const VERSION = '1.0.0';
const SAVE_KEY = 'earthfall.save.v1';
const BEST_KEY = 'earthfall.best.v1';
const params = new URLSearchParams(location.search);
const AUTOTEST = params.has('autotest');
const TIMESCALE = parseFloat(params.get('speed') || '1');

const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const fmt = (n) => Math.round(n).toLocaleString('en-US');

// ---------------------------------------------------------------- renderer
const canvas = $('#game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02040a);
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 600);
camera.position.set(0, 10, 34);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true; controls.dampingFactor = 0.08;
controls.minDistance = 15; controls.maxDistance = 55;
controls.enablePan = false; controls.rotateSpeed = 0.55; controls.zoomSpeed = 0.8;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.5, 0.35, 0.8);
composer.addPass(bloom);
composer.addPass(new OutputPass());

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  const mobile = w < 700;
  controls.minDistance = mobile ? 22 : 15;
  controls.maxDistance = mobile ? 70 : 55;
  if (mobile && camera.position.length() < 48) camera.position.setLength(52);
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- scene
scene.add(new THREE.AmbientLight(0x6080b0, 0.35));
const sun = new THREE.DirectionalLight(0xfff2dc, 2.6);
sun.position.set(60, 20, 40);
scene.add(sun);
scene.add(buildStars());
const E = buildEarth();
scene.add(E.group);

// Moon, for depth and for the "Lunar Approach" flavor
const moon = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 24), new THREE.MeshStandardMaterial({ color: 0xb8b8c0, roughness: 1 }));
moon.position.set(-70, 18, -90);
scene.add(moon);

const pickSphere = new THREE.Mesh(new THREE.SphereGeometry(R + 1.6, 32, 24), new THREE.MeshBasicMaterial({ visible: false }));
scene.add(pickSphere);

// ---------------------------------------------------------------- regions
const regionMarkers = [];
const regions = REGIONS.map((d) => {
  const pos = latLon(d.lat, d.lon, R + 0.05);
  const n = pos.clone().normalize();
  const g = new THREE.Group();
  g.position.copy(pos);
  g.lookAt(pos.clone().add(n));
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.72, 40), new THREE.MeshBasicMaterial({ color: 0x5fe6ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
  g.add(ring);
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.22, 24), new THREE.MeshBasicMaterial({ color: 0xcffaff }));
  core.position.z = 0.02; g.add(core);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x4fd8ff, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  dome.rotation.x = Math.PI / 2; dome.visible = false; g.add(dome);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(1.3, 12, 8), new THREE.MeshBasicMaterial({ visible: false }));
  g.add(hit);
  E.group.add(g);
  const r = { ...d, group: g, ring, core, dome, hit, hp: 100, max: 100, shieldT: 0, alive: true, incoming: 0, _w: new THREE.Vector3() };
  hit.userData.region = r; regionMarkers.push(hit);
  return r;
});
const worldPos = (obj, out) => obj.getWorldPosition(out);

// ---------------------------------------------------------------- state
const game = {
  state: 'title', mission: 0, score: 0, best: 0, energy: 100, maxEnergy: 100,
  upgrades: {}, tool: 'laser', priority: null, t: 0, waveIdx: 0, missionT: 0, spawnQueue: [],
  comms: [], missilesLocked: 0, blackoutT: 0, bossSpawned: false, kills: 0, ended: false, pausedBefore: null,
};
try { game.best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch (e) { /* storage blocked */ }

const up = (id) => game.upgrades[id] || 0;
const stats = () => {
  const lostEU = !regions[1].alive, lostEA = !regions[2].alive, lostNA = !regions[0].alive, lostAF = !regions[4].alive, lostSAM = !regions[5].alive;
  return {
    sats: 4 + up('sat'),
    laserDps: 13 * (1 + 0.3 * up('laser')),
    regen: 8 * (1 + 0.25 * up('regen')) * (lostEA ? 0.7 : 1) * (MISSIONS[game.mission]?.event === 'world-shield' ? 2 : 1),
    maxEnergy: 100 + 30 * up('cap'),
    laserRange: 25 * (1 + 0.25 * up('range')) * (lostEU ? 0.75 : 1),
    volley: 3 + 2 * up('volley'),
    missileCost: Math.round(20 * (lostNA ? 1.5 : 1)),
    interCost: Math.round(30 * (lostAF ? 1.5 : 1)),
    interCount: 6 + 4 * up('inter'), interLife: 16 + 5 * up('inter'),
    empCost: 40, empRadius: 7 * (1 + 0.4 * up('emp')), stun: 5 + 2 * up('emp'),
    shieldCost: 50, shieldDur: (12 + 6 * up('dome')) * (lostSAM ? 0.5 : 1),
    scoreMul: regions[3].alive ? 1 : 0.7,
  };
};
const TOOLS = {
  laser: { key: '1', name: 'Laser Focus', cost: () => 0, hint: 'Tap a ship: satellites focus fire' },
  missile: { key: '2', name: 'Missiles', cost: () => stats().missileCost, hint: 'Tap a ship to launch a homing volley' },
  inter: { key: '3', name: 'Interceptors', cost: () => stats().interCost, hint: 'Tap in space to send a squadron' },
  emp: { key: '4', name: 'EMP Pulse', cost: () => stats().empCost, hint: 'Tap in space: break shields, stun ships' },
  shield: { key: '5', name: 'Planetary Shield', cost: () => stats().shieldCost, hint: 'Tap a region to dome it' },
};

// ---------------------------------------------------------------- entities
const enemies = [], missiles = [], squads = [], fx = [], beams = [];
const satellites = [];
const audio = new Audio();

const sparkTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.8)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t; })();
const geos = {
  scout: new THREE.ConeGeometry(0.28, 0.9, 5),
  bomber: new THREE.OctahedronGeometry(0.62, 0),
  shield: new THREE.IcosahedronGeometry(0.55, 0),
  pod: new THREE.CapsuleGeometry(0.42, 0.7, 4, 10),
  shieldBubble: new THREE.SphereGeometry(1.05, 20, 14),
  missile: new THREE.ConeGeometry(0.09, 0.45, 6),
  inter: new THREE.ConeGeometry(0.1, 0.36, 4),
  spark: new THREE.SphereGeometry(0.06, 6, 4),
};
geos.scout.rotateX(Math.PI / 2); geos.missile.rotateX(Math.PI / 2); geos.inter.rotateX(Math.PI / 2);
const matFor = (f, extra = {}) => new THREE.MeshStandardMaterial({ color: 0x111318, emissive: FACTIONS[f].glow, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.6, ...extra });
const mats = {
  scout: matFor('veyr'), bomber: matFor('veyr', { emissive: 0xc2500a, emissiveIntensity: 0.5 }), shield: matFor('nhal'), pod: matFor('orun'),
  bubble: new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.22, depthWrite: false }),
  missile: new THREE.MeshBasicMaterial({ color: 0xffe9a8 }), inter: new THREE.MeshBasicMaterial({ color: 0x9ff6ff }),
  beam: new THREE.MeshBasicMaterial({ color: 0x7af7ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }),
  sat: new THREE.MeshStandardMaterial({ color: 0xcfd6e0, roughness: 0.4, metalness: 0.8 }),
  panel: new THREE.MeshStandardMaterial({ color: 0x1b3f8a, emissive: 0x1140ff, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 }),
  dead: new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x220000, roughness: 0.9 }),
};

function makeSatellite(i, n) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.42, 0.62), mats.sat);
  g.add(body);
  const p1 = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.04, 0.5), mats.panel); p1.position.x = 1.05; g.add(p1);
  const p2 = p1.clone(); p2.position.x = -1.05; g.add(p2);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mats.sat);
  dish.position.z = 0.45; dish.rotation.x = Math.PI / 2; g.add(dish);
  const lamp = new THREE.Mesh(geos.spark, new THREE.MeshBasicMaterial({ color: 0x7af7ff }));
  lamp.position.z = 0.36; g.add(lamp);
  scene.add(g);
  const inc = (i % 3) * 0.55 - 0.4;
  return { group: g, lamp, angle: (i / n) * Math.PI * 2, inc, node: i * 1.1, speed: 0.11 + 0.015 * (i % 2), radius: R + 3.4, target: null, firing: false, disabledT: 0, pos: new THREE.Vector3() };
}
function syncSatellites() {
  const n = stats().sats;
  while (satellites.length < n) satellites.push(makeSatellite(satellites.length, n));
}

function makeEnemy(type, target, scale) {
  const d = ENEMY[type];
  const g = new THREE.Group();
  let mesh;
  if (type === 'mothership') {
    mesh = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.0, 0.5, 12, 40), matFor('orun', { emissiveIntensity: 0.8 }));
    const core = new THREE.Mesh(new THREE.SphereGeometry(1.5, 24, 16), new THREE.MeshStandardMaterial({ color: 0x1a0a22, emissive: 0xb060ff, emissiveIntensity: 1.2, roughness: 0.3 }));
    const spokes = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.18, 8, 6), matFor('orun'));
    spokes.rotation.x = Math.PI / 2; ring.rotation.x = Math.PI / 2;
    mesh.add(ring, core, spokes);
  } else {
    mesh = new THREE.Mesh(geos[type], mats[type]);
  }
  g.add(mesh);
  let bubble = null;
  if (d.shield) {
    bubble = new THREE.Mesh(geos.shieldBubble, mats.bubble.clone());
    if (type === 'mothership') bubble.scale.setScalar(4.2);
    g.add(bubble);
  }
  const hp = Math.round(d.hp * scale), sh = Math.round((d.shield || 0) * scale);
  const e = { type, d, group: g, mesh, bubble, hp, maxHp: hp, shield: sh, maxShield: sh, target, speed: d.speed * (0.9 + Math.random() * 0.2),
    state: 'approach', stun: 0, fireT: rand(1, 3), hackT: rand(8, 14), shieldCycle: 0, spin: new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)), alive: true, flash: 0, bornT: game.t };
  g.userData.enemy = e;
  scene.add(g);
  enemies.push(e);
  return e;
}

function spawnEnemy(type, dir, targetIdx, scale) {
  const live = regions.filter((r) => r.alive);
  const target = regions[targetIdx]?.alive ? regions[targetIdx] : pick(live);
  const e = makeEnemy(type, target, scale);
  const jitter = new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).multiplyScalar(4);
  e.group.position.copy(dir).multiplyScalar(44).add(jitter);
  return e;
}

function spawnBoss(kind) {
  const target = pick(regions.filter((r) => r.alive));
  const scale = kind === 'flagship' ? 2.2 : 1;
  const e = makeEnemy('mothership', target, scale);
  const dir = worldPos(target.group, new THREE.Vector3()).normalize();
  e.group.position.copy(dir).multiplyScalar(26);
  e.state = 'station'; e.shieldCycle = 10; e.spawnT = 6; e.kind = kind;
  game.bossSpawned = true;
  say(kind === 'flagship' ? 'FLAGSHIP ON SCOPE. Shield cycles every ten seconds. EMP it when the shield is up, then strike.' : 'Orun carrier holding station on the Lunar Approach. It is launching pods. EMP its shield, then missiles.', 'warn');
  audio.alarm();
  return e;
}

// ---------------------------------------------------------------- effects
function explode(pos, color, size = 1, big = false) {
  const N = big ? 90 : 28;
  const p = new Float32Array(N * 3), v = [];
  for (let i = 0; i < N; i++) {
    p.set([pos.x, pos.y, pos.z], i * 3);
    v.push(new THREE.Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize().multiplyScalar(rand(2, big ? 14 : 7) * size));
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const m = new THREE.PointsMaterial({ color, map: sparkTex, size: (big ? 0.6 : 0.34) * size, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false });
  const pts = new THREE.Points(g, m); scene.add(pts);
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.22 * size, 12, 8), new THREE.MeshBasicMaterial({ color: 0xfff1d0, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
  flash.position.copy(pos); scene.add(flash);
  fx.push({ kind: 'boom', pts, v, flash, life: big ? 1.4 : 0.8, t: 0, size });
  audio.explosion(big);
}
function empWave(pos, radius) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 20), new THREE.MeshBasicMaterial({ color: 0x9fe0ff, transparent: true, opacity: 0.5, wireframe: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  m.position.copy(pos); scene.add(m);
  fx.push({ kind: 'emp', mesh: m, radius, life: 0.9, t: 0 });
}
function beamFx(a, b, color = 0x7af7ff, width = 0.05, life = 0.1) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(width, width * 1.6, len, 6, 1, true), mats.beam.clone());
  m.material.color.set(color);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b); m.rotateX(Math.PI / 2);
  scene.add(m);
  fx.push({ kind: 'beam', mesh: m, life, t: 0 });
}

// ---------------------------------------------------------------- comms / HUD
function say(text, cls = '') {
  game.comms.push({ text, cls, t: game.t });
  if (game.comms.length > 40) game.comms.shift();
  renderComms();
}
function renderComms() {
  const el = $('#comms');
  const last = game.comms.slice(-4);
  el.innerHTML = last.map((c) => `<div class="line ${c.cls}">${c.text}</div>`).join('');
}
function renderRegions() {
  const el = $('#regions');
  el.innerHTML = regions.map((r, i) => `<button class="region ${r.alive ? '' : 'lost'} ${r.shieldT > 0 ? 'shielded' : ''}" data-i="${i}" title="Focus camera">
    <span class="rn">${r.name}${r.incoming ? ` <b class="inc">▲${r.incoming}</b>` : ''}</span>
    <span class="bar"><i style="width:${clamp(r.hp, 0, 100)}%"></i></span></button>`).join('');
}
function renderTools() {
  const s = stats();
  const el = $('#tools');
  el.innerHTML = Object.entries(TOOLS).map(([id, t]) => {
    const cost = t.cost();
    const locked = id === 'missile' && game.missilesLocked > 0;
    const poor = cost > game.energy;
    return `<button class="tool ${game.tool === id ? 'on' : ''} ${poor || locked ? 'poor' : ''}" data-tool="${id}">
      <span class="k">${t.key}</span><span class="n">${t.name}</span><span class="c">${locked ? 'LOCKED ' + Math.ceil(game.missilesLocked) + 's' : cost ? cost + ' ⚡' : 'free'}</span></button>`;
  }).join('');
  $('#toolhint').textContent = TOOLS[game.tool].hint;
}
function renderTop() {
  const m = MISSIONS[game.mission];
  $('#mname').textContent = `Mission ${game.mission + 1}/10 · ${m.name} · ${m.hours}`;
  $('#wave').textContent = `Wave ${Math.min(game.waveIdx, 5)}/5 · Hostiles ${enemies.length}`;
  $('#score').textContent = fmt(game.score);
  $('#energyBar').style.width = `${(game.energy / game.maxEnergy) * 100}%`;
  $('#energyTxt').textContent = `${Math.floor(game.energy)}/${game.maxEnergy}`;
}

// ---------------------------------------------------------------- save
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ v: VERSION, mission: game.mission, score: game.score, upgrades: game.upgrades, hp: regions.map((r) => r.hp) }));
  } catch (e) { /* ignore */ }
}
function loadSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); return s && s.v === VERSION ? s : null; } catch (e) { return null; }
}
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } }
function recordBest() {
  if (game.score > game.best) { game.best = game.score; try { localStorage.setItem(BEST_KEY, String(Math.round(game.best))); } catch (e) { /* ignore */ } }
}

// ---------------------------------------------------------------- screens
function show(id) {
  document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('show', s.id === id));
  $('#hud').classList.toggle('show', id === '' );
}
function titleScreen() {
  game.state = 'title';
  const s = loadSave();
  $('#continueBtn').style.display = s ? '' : 'none';
  $('#continueBtn').textContent = s ? `Continue — Mission ${s.mission + 1}` : '';
  $('#bestTxt').textContent = game.best ? `Best score ${fmt(game.best)}` : '';
  show('title');
}
function newGame() {
  clearSave();
  game.mission = 0; game.score = 0; game.upgrades = {};
  regions.forEach((r) => { r.hp = 100; r.alive = true; r.shieldT = 0; });
  briefing();
}
function continueGame() {
  const s = loadSave(); if (!s) return newGame();
  game.mission = clamp(s.mission, 0, 9); game.score = s.score || 0; game.upgrades = s.upgrades || {};
  regions.forEach((r, i) => { r.hp = s.hp?.[i] ?? 100; r.alive = r.hp > 0; r.shieldT = 0; });
  briefing();
}
function briefing() {
  game.state = 'briefing';
  const m = MISSIONS[game.mission];
  $('#bTitle').textContent = `Mission ${game.mission + 1}: ${m.name}`;
  $('#bHours').textContent = `${m.hours} · Space Defense Force command brief`;
  $('#bText').textContent = m.brief;
  const lost = regions.filter((r) => !r.alive);
  $('#bLost').innerHTML = lost.length ? `<b>Regions lost:</b> ${lost.map((r) => `${r.name} — ${r.lost}`).join(' · ')}` : 'All regions holding. The planet is your health bar: lose a region and you lose what it provides.';
  show('briefing');
}
function startMission() {
  clearField();
  game.state = 'playing';
  const m = MISSIONS[game.mission];
  game.maxEnergy = stats().maxEnergy; game.energy = game.maxEnergy;
  game.waveIdx = 0; game.missionT = 0; game.spawnQueue = []; game.bossSpawned = false; game.priority = null; game.tool = 'laser';
  game.missilesLocked = m.event === 'missiles-locked' ? 45 : 0;
  game.blackoutT = m.event === 'blackout' ? 12 : 0;
  game.comms = [];
  regions.forEach((r) => { r.shieldT = 0; r.dome.visible = false; r.incoming = 0; });
  syncSatellites();
  audio.ensure(); audio.startDrone();
  say(`SDF Command: ${m.name}. ${m.hours}. Grid online.`, 'sys');
  if (m.event === 'missiles-locked') say('Launch authority suspended. Missiles locked for 45 seconds.', 'warn');
  if (m.event === 'blackout') say('Nhal intrusion detected. Expect satellite blackouts.', 'warn');
  if (m.event === 'world-shield') say('World Shield grid live. Energy regeneration doubled.', 'good');
  show(''); renderTools(); renderRegions(); renderTop(); renderComms();
}
function clearField() {
  for (const e of enemies) scene.remove(e.group);
  for (const m of missiles) scene.remove(m.mesh), m.trail && scene.remove(m.trail);
  for (const s of squads) scene.remove(s.group);
  for (const f of fx) { if (f.pts) scene.remove(f.pts); if (f.flash) scene.remove(f.flash); if (f.mesh) scene.remove(f.mesh); }
  for (const b of beams) scene.remove(b.mesh);
  enemies.length = missiles.length = squads.length = fx.length = beams.length = 0;
}
function missionComplete() {
  game.state = 'between';
  const aliveHp = regions.reduce((a, r) => a + Math.max(0, r.hp), 0);
  const bonus = Math.round(aliveHp * 12 * stats().scoreMul);
  game.score += bonus;
  say(`Mission complete. Population bonus +${fmt(bonus)}.`, 'good');
  recordBest();
  if (game.mission >= 9) return endingScreen();
  // upgrade picks
  const pool = UPGRADES.filter((u) => up(u.id) < u.max);
  const picks = [];
  while (picks.length < 3 && pool.length) picks.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  $('#uTitle').textContent = `${MISSIONS[game.mission].name} — held. Bonus +${fmt(bonus)}`;
  $('#uCards').innerHTML = picks.map((u) => `<button class="card" data-up="${u.id}"><b>${u.name}</b><span>${u.desc}</span><em>${up(u.id) ? `level ${up(u.id)} → ${up(u.id) + 1}` : 'new'}</em></button>`).join('');
  show('upgrade');
  if (AUTOTEST) setTimeout(() => chooseUpgrade(picks[0].id), 200);
}
function chooseUpgrade(id) {
  game.upgrades[id] = up(id) + 1;
  if (id === 'repair') regions.forEach((r) => { if (r.alive) r.hp = Math.min(r.max, r.hp + 35); });
  // civil recovery between missions
  regions.forEach((r) => { if (r.alive) r.hp = Math.min(r.max, r.hp + 15); });
  game.mission += 1;
  save();
  briefing();
}
function gameOver() {
  game.state = 'over';
  recordBest(); clearSave();
  $('#oScore').textContent = `Final score ${fmt(game.score)} · Best ${fmt(game.best)}`;
  $('#oText').textContent = `Every region fell during ${MISSIONS[game.mission].name}. The harvest is complete. ${game.kills} alien craft were destroyed before the sky went dark.`;
  show('over');
  audio.explosion(true);
}
function endingScreen() {
  game.state = 'ending';
  $('#eCards').innerHTML = ENDINGS.map((e) => `<button class="card" data-end="${e.id}"><b>${e.name}</b><span>${e.id === 'total' ? 'Fire the Lunar Battery through the atmosphere.' : e.id === 'evac' ? 'Turn every ship into a lifeboat.' : 'Answer the ghost signal.'}</span></button>`).join('');
  show('ending');
  if (AUTOTEST) setTimeout(() => chooseEnding('signal'), 200);
}
function chooseEnding(id) {
  const e = ENDINGS.find((x) => x.id === id);
  game.score = Math.round(game.score * e.bonus);
  recordBest(); clearSave();
  $('#vTitle').textContent = e.name;
  $('#vText').textContent = e.text;
  $('#vScore').textContent = `Final score ${fmt(game.score)} · Best ${fmt(game.best)} · ${game.kills} craft destroyed`;
  show('victory');
  game.state = 'victory';
}

// ---------------------------------------------------------------- waves
function scheduleWave(w, scale) {
  // Each wave comes from one direction toward one or two regions.
  const live = regions.filter((r) => r.alive);
  const primary = regions.indexOf(pick(live));
  const secondary = regions.indexOf(pick(live));
  const dir = new THREE.Vector3(rand(-1, 1), rand(-0.6, 0.6), rand(-1, 1)).normalize();
  let delay = 0;
  const add = (type, count) => {
    for (let i = 0; i < count; i++) { game.spawnQueue.push({ at: game.missionT + delay, type, dir, target: Math.random() < 0.7 ? primary : secondary, scale }); delay += type === 'scout' ? 0.55 : 1.1; }
  };
  add('scout', w.scout); add('bomber', w.bomber); add('shield', w.shield); add('pod', w.pod);
  say(`Wave ${game.waveIdx + 1}: ${w.scout + w.bomber + w.shield + w.pod} contacts inbound → ${regions[primary].name}${secondary !== primary ? ` and ${regions[secondary].name}` : ''}.`, 'warn');
  audio.alarm();
}

// ---------------------------------------------------------------- input
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null;
canvas.addEventListener('pointerdown', (ev) => { down = { x: ev.clientX, y: ev.clientY, t: performance.now() }; audio.ensure(); });
canvas.addEventListener('pointerup', (ev) => {
  if (!down) return;
  const moved = Math.hypot(ev.clientX - down.x, ev.clientY - down.y);
  const dt = performance.now() - down.t;
  down = null;
  if (moved < 9 && dt < 450 && game.state === 'playing') tapAt(ev.clientX, ev.clientY);
});
function tapAt(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  ray.params.Points.threshold = 0.5;
  const hitEnemies = ray.intersectObjects(enemies.map((e) => e.group), true);
  const enemy = hitEnemies.length ? findEnemy(hitEnemies[0].object) : null;
  const hitRegions = ray.intersectObjects(regionMarkers, false);
  const region = hitRegions.length ? hitRegions[0].object.userData.region : null;
  const hitSphere = ray.intersectObject(pickSphere, false);
  const point = hitSphere.length ? hitSphere[0].point : null;
  useTool(game.tool, { enemy, region, point });
}
function findEnemy(obj) { let o = obj; while (o && !o.userData.enemy) o = o.parent; return o ? o.userData.enemy : null; }
function nearestRegionTo(point) {
  let best = null, bd = 1e9;
  for (const r of regions) { if (!r.alive) continue; const d = worldPos(r.group, r._w).distanceTo(point); if (d < bd) { bd = d; best = r; } }
  return best;
}
function spend(cost) {
  if (game.energy < cost) { say('Insufficient command energy.', 'bad'); audio.ping(220); return false; }
  game.energy -= cost; return true;
}
function useTool(tool, { enemy, region, point }) {
  const s = stats();
  if (tool === 'laser') {
    if (enemy) { game.priority = enemy; say(`Priority target: ${enemy.d.label}.`); audio.ping(1200); }
    else { game.priority = null; }
    return;
  }
  if (tool === 'missile') {
    if (game.missilesLocked > 0) { say('Missile launch authority is suspended.', 'bad'); audio.ping(220); return; }
    if (!enemy) { say('Missiles need a target. Tap a ship.', 'bad'); return; }
    if (!spend(s.missileCost)) return;
    const from = nearestRegionTo(enemy.group.position);
    const origin = from ? worldPos(from.group, new THREE.Vector3()) : pick(satellites).pos.clone();
    for (let i = 0; i < s.volley; i++) launchMissile(origin, enemy, i * 0.12);
    audio.missile(); game.tool = 'laser'; renderTools();
    return;
  }
  if (tool === 'inter') {
    const at = enemy ? enemy.group.position.clone() : point;
    if (!at) return;
    if (!spend(s.interCost)) return;
    const from = nearestRegionTo(at);
    launchSquad(worldPos(from.group, new THREE.Vector3()), at, s.interCount, s.interLife);
    audio.interceptors(); say(`Squadron launched from ${from.name}.`); game.tool = 'laser'; renderTools();
    return;
  }
  if (tool === 'emp') {
    const at = enemy ? enemy.group.position.clone() : point;
    if (!at) return;
    if (!spend(s.empCost)) return;
    empWave(at, s.empRadius); audio.emp();
    let n = 0;
    for (const e of enemies) {
      if (e.group.position.distanceTo(at) <= s.empRadius + e.d.size) {
        e.shield = 0; e.stun = Math.max(e.stun, e.type === 'mothership' ? 8 : s.stun); n++;
        if (e.type === 'mothership') { e.shieldCycle = -8; }
      }
    }
    say(`EMP detonated. ${n} craft disabled.`, 'good'); game.tool = 'laser'; renderTools();
    return;
  }
  if (tool === 'shield') {
    const r = region || (point && nearestRegionTo(point));
    if (!r || !r.alive) return;
    if (!spend(s.shieldCost)) return;
    r.shieldT = s.shieldDur; r.dome.visible = true;
    if (up('dome')) r.hp = Math.min(r.max, r.hp + 5 * up('dome'));
    audio.shield(); say(`Planetary shield raised over ${r.name} for ${Math.round(s.shieldDur)}s.`, 'good');
    game.tool = 'laser'; renderTools(); renderRegions();
  }
}
function setTool(id) {
  if (!TOOLS[id]) return;
  game.tool = id; renderTools(); audio.ping(700);
}
window.addEventListener('keydown', (ev) => {
  if (ev.repeat) return;
  const k = ev.key;
  if (game.state === 'playing') {
    const map = { 1: 'laser', 2: 'missile', 3: 'inter', 4: 'emp', 5: 'shield', q: 'laser', w: 'missile', e: 'inter', r: 'emp', t: 'shield' };
    if (map[k.toLowerCase()]) setTool(map[k.toLowerCase()]);
    if (k === 'Escape' || k === 'p' || k === 'P') pause();
    if (k === ' ') { ev.preventDefault(); const e = nearestThreat(); if (e) focusOn(e.group.position); }
  } else if (game.state === 'paused' && (k === 'Escape' || k === 'p' || k === 'P')) resume();
});
document.addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  audio.ensure();
  if (b.dataset.tool) setTool(b.dataset.tool);
  else if (b.dataset.i !== undefined) focusOn(worldPos(regions[+b.dataset.i].group, new THREE.Vector3()));
  else if (b.dataset.up) chooseUpgrade(b.dataset.up);
  else if (b.dataset.end) chooseEnding(b.dataset.end);
  else if (b.id === 'newBtn') newGame();
  else if (b.id === 'continueBtn') continueGame();
  else if (b.id === 'howBtn') show('how');
  else if (b.id === 'howBack') titleScreen();
  else if (b.id === 'launchBtn') startMission();
  else if (b.id === 'pauseBtn') pause();
  else if (b.id === 'resumeBtn') resume();
  else if (b.id === 'quitBtn') { save(); clearField(); titleScreen(); }
  else if (b.id === 'retryBtn') { regions.forEach((r) => { r.alive = true; r.hp = Math.max(r.hp, 60); r.ring.material.color.set(0x5fe6ff); r.core.material.color.set(0xcffaff); }); briefing(); }
  else if (b.classList.contains('toTitle')) { clearField(); titleScreen(); }
  else if (b.id === 'muteBtn') { audio.setMuted(!audio.muted); b.textContent = audio.muted ? '🔇' : '🔊'; }
  else if (b.id === 'threatBtn') { const e = nearestThreat(); if (e) focusOn(e.group.position); }
});
function pause() { if (game.state !== 'playing') return; game.state = 'paused'; show('pause'); }
function resume() { if (game.state !== 'paused') return; game.state = 'playing'; show(''); }
let focusTarget = null;
function focusOn(p) {
  // Stand off to one side of the threat so it sits in view rather than in the lens.
  const dir = p.clone().normalize();
  const side = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize();
  if (side.lengthSq() < 0.01) side.set(1, 0, 0);
  focusTarget = dir.multiplyScalar(0.8).addScaledVector(side, 0.55).add(new THREE.Vector3(0, 0.25, 0)).normalize().multiplyScalar(camera.position.length());
}
function nearestThreat() {
  let best = null, bd = 1e9;
  for (const e of enemies) { const d = e.group.position.length(); if (d < bd) { bd = d; best = e; } }
  return best;
}

// ---------------------------------------------------------------- weapons
function launchMissile(origin, target, delay) {
  const mesh = new THREE.Mesh(geos.missile, mats.missile);
  mesh.position.copy(origin);
  const vel = origin.clone().normalize().multiplyScalar(6).add(new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2)));
  const tg = new THREE.BufferGeometry();
  const tp = new Float32Array(12 * 3); for (let i = 0; i < 12; i++) tp.set([origin.x, origin.y, origin.z], i * 3);
  tg.setAttribute('position', new THREE.BufferAttribute(tp, 3));
  const trail = new THREE.Line(tg, new THREE.LineBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.7 }));
  scene.add(mesh); scene.add(trail);
  missiles.push({ mesh, trail, vel, target, delay, life: 9, dmg: 35, hist: [] });
}
function launchSquad(origin, at, count, life) {
  const g = new THREE.Group();
  const ships = [];
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geos.inter, mats.inter);
    m.position.copy(origin).add(new THREE.Vector3(rand(-0.4, 0.4), rand(-0.4, 0.4), rand(-0.4, 0.4)));
    g.add(m); ships.push({ mesh: m, phase: rand(0, 6.28), alive: true });
  }
  scene.add(g);
  squads.push({ group: g, ships, pos: origin.clone(), dest: at.clone(), life, target: null, dps: 3.2 });
}

function damageEnemy(e, amt, src) {
  if (!e.alive) return;
  if (e.shield > 0) { e.shield -= amt; if (e.shield < 0) { e.hp += e.shield; e.shield = 0; } e.flash = 0.1; return; }
  e.hp -= amt; e.flash = 0.1;
  if (e.hp <= 0) killEnemy(e, src);
}
function killEnemy(e, src) {
  e.alive = false;
  const big = e.type === 'mothership' || e.type === 'pod';
  explode(e.group.position, FACTIONS[e.d.faction].glow, e.type === 'mothership' ? 2.6 : 1, big);
  const pts = Math.round(e.d.score * (e.type === 'mothership' && e.kind === 'flagship' ? 3 : 1) * stats().scoreMul);
  game.score += pts; game.kills++;
  if (game.priority === e) game.priority = null;
  if (e.type === 'mothership') say(`${e.kind === 'flagship' ? 'FLAGSHIP' : 'Carrier'} destroyed. +${fmt(pts)}`, 'good');
  if (e.state === 'landed') say(`Landing zone in ${e.target.name} cleared.`, 'good');
  e.target.incoming = Math.max(0, e.target.incoming - 1);
}
function damageRegion(r, amt, why) {
  if (!r.alive) return;
  if (r.shieldT > 0) { audio.hit(); return; }
  r.hp -= amt;
  if (r.hp <= 0) {
    r.hp = 0; r.alive = false; r.ring.material.color.set(0xff4040); r.core.material.color.set(0x552020);
    say(`${r.name} has fallen. ${r.lost}.`, 'bad'); audio.explosion(true);
    for (const e of enemies) if (e.target === r && e.alive) { const live = regions.filter((x) => x.alive); if (live.length) e.target = pick(live); }
    if (!regions.some((x) => x.alive)) gameOver();
  }
}

// ---------------------------------------------------------------- update
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
let lastRegionsRender = 0;

function update(dt) {
  const s = stats();
  const m = MISSIONS[game.mission];
  game.t += dt; game.missionT += dt;
  game.maxEnergy = s.maxEnergy;
  game.energy = Math.min(game.maxEnergy, game.energy + s.regen * dt);
  if (game.missilesLocked > 0) { game.missilesLocked -= dt; if (game.missilesLocked <= 0) { game.missilesLocked = 0; say('Launch authority restored. Missiles online.', 'good'); } }

  // waves
  if (game.waveIdx < m.waves.length && game.missionT >= m.waves[game.waveIdx].t) { scheduleWave(m.waves[game.waveIdx], m.scale); game.waveIdx++; }
  if (m.boss && !game.bossSpawned && game.waveIdx >= 3) spawnBoss(m.boss);
  while (game.spawnQueue.length && game.spawnQueue[0].at <= game.missionT) {
    const q = game.spawnQueue.shift();
    const e = spawnEnemy(q.type, q.dir, q.target, q.scale);
    e.target.incoming++;
  }
  if (game.waveIdx >= m.waves.length && !game.spawnQueue.length && enemies.length === 0 && (!m.boss || game.bossSpawned)) {
    if (!game._doneT) game._doneT = game.t + 1.5;
    if (game.t > game._doneT) { game._doneT = 0; missionComplete(); return; }
  } else game._doneT = 0;

  // blackout event
  if (m.event === 'blackout') {
    game.blackoutT -= dt;
    if (game.blackoutT <= 0) { game.blackoutT = rand(14, 22); const sat = pick(satellites); sat.disabledT = 7; say('Satellite hacked. Link down for 7 seconds.', 'warn'); audio.ping(300); }
  }

  // earth rotation
  E.group.rotation.y += dt * 0.012;
  E.clouds.rotation.y += dt * 0.004;

  // regions
  for (const r of regions) {
    if (r.shieldT > 0) { r.shieldT -= dt; r.dome.material.opacity = 0.18 + 0.1 * Math.sin(game.t * 6); if (r.shieldT <= 0) { r.shieldT = 0; r.dome.visible = false; } }
    const pulse = 0.85 + 0.15 * Math.sin(game.t * 3 + r.lon);
    r.ring.scale.setScalar(r.alive ? pulse : 1);
  }

  // satellites
  for (let i = 0; i < satellites.length; i++) {
    const sat = satellites[i];
    sat.angle += dt * sat.speed;
    const x = Math.cos(sat.angle) * sat.radius, z = Math.sin(sat.angle) * sat.radius;
    const y = Math.sin(sat.angle) * sat.radius * Math.sin(sat.inc);
    sat.pos.set(x * Math.cos(sat.node) - z * Math.sin(sat.node), y, x * Math.sin(sat.node) + z * Math.cos(sat.node));
    sat.group.position.copy(sat.pos);
    sat.group.lookAt(0, 0, 0);
    sat.firing = false;
    if (sat.disabledT > 0) { sat.disabledT -= dt; sat.lamp.material.color.set(0xff3030); continue; }
    sat.lamp.material.color.set(0x7af7ff);
    // choose target: player priority if reachable, else closest-to-Earth enemy in range
    let tgt = null;
    const reachable = (e) => e.alive && e.group.position.distanceTo(sat.pos) < s.laserRange && e.group.position.clone().normalize().dot(sat.pos.clone().normalize()) > -0.15;
    if (game.priority && reachable(game.priority)) tgt = game.priority;
    else {
      let bd = 1e9;
      for (const e of enemies) { if (!reachable(e)) continue; if (e.type === 'shield' && e.shield > 0) continue; const d = e.group.position.length() + (e.state === 'landed' ? -5 : 0); if (d < bd) { bd = d; tgt = e; } }
      if (!tgt) for (const e of enemies) { if (reachable(e)) { tgt = e; break; } }
    }
    if (tgt) {
      sat.firing = true;
      let dmg = s.laserDps * dt;
      if (tgt.type === 'mothership') dmg *= 0.5;
      if (tgt.type === 'shield' && tgt.shield > 0) dmg *= 0.15;
      damageEnemy(tgt, dmg, 'laser');
      if (Math.random() < dt * 9) { beamFx(sat.pos, tgt.group.position, 0x7af7ff, 0.04, 0.09); if (Math.random() < 0.25) audio.laser(); }
    }
  }

  // enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.alive) { scene.remove(e.group); enemies.splice(i, 1); continue; }
    const p = e.group.position;
    e.mesh.rotation.x += e.spin.x * dt; e.mesh.rotation.y += e.spin.y * dt;
    if (e.flash > 0) { e.flash -= dt; e.mesh.traverse((o) => { if (o.material && o.material.emissiveIntensity !== undefined) o.material.emissiveIntensity = 1.8; }); }
    else e.mesh.traverse((o) => { if (o.material && o.material.emissiveIntensity !== undefined) o.material.emissiveIntensity = e.type === 'mothership' ? 0.8 : 0.7; });
    if (e.bubble) { e.bubble.visible = e.shield > 0; e.bubble.material.opacity = 0.15 + 0.12 * Math.sin(game.t * 5); }
    if (e.stun > 0) { e.stun -= dt; e.mesh.rotation.z += dt * 4; continue; }
    const tgtPos = worldPos(e.target.group, tmpA);
    if (e.type === 'mothership') {
      // hold station, cycle shields, launch pods
      const want = tmpB.copy(tgtPos).normalize().multiplyScalar(26);
      p.lerp(want, dt * 0.08);
      e.mesh.rotation.y += dt * 0.3;
      e.shieldCycle += dt;
      if (e.shieldCycle >= 10) { e.shieldCycle = -6; e.shield = 0; say('Carrier shield down! Six seconds.', 'good'); audio.ping(1500); }
      else if (e.shieldCycle >= 0 && e.shield <= 0 && e.shieldCycle < 0.05) { e.shield = e.maxShield; say('Carrier shield back up.', 'warn'); }
      e.spawnT -= dt;
      if (e.spawnT <= 0) {
        e.spawnT = e.kind === 'flagship' ? 7 : 9;
        const pod = makeEnemy(Math.random() < 0.6 ? 'pod' : 'bomber', pick(regions.filter((r) => r.alive)), m.scale);
        pod.group.position.copy(p).add(new THREE.Vector3(rand(-2, 2), rand(-2, 2), rand(-2, 2)));
        pod.target.incoming++;
        say('Carrier launching craft.', 'warn');
      }
      continue;
    }
    if (e.state === 'approach') {
      const standoff = e.type === 'shield' ? R + 3.2 : R + 0.75;
      tmpB.copy(tgtPos).normalize().multiplyScalar(e.type === 'shield' ? standoff : R + 0.3);
      const dir = tmpC.copy(tmpB).sub(p);
      const dist = dir.length();
      dir.normalize();
      p.addScaledVector(dir, e.speed * dt);
      e.group.lookAt(tmpB);
      if (e.type === 'shield') {
        if (dist < 1.2) { e.state = 'orbit'; }
      } else if (p.length() <= standoff || dist < 0.3) {
        if (e.type === 'pod') {
          if (e.target.shieldT > 0 || !e.target.alive) { killEnemy(e, 'shield'); game.score -= Math.round(e.d.score * 0.5); continue; }
          e.state = 'landed';
          E.group.attach(e.group);
          say(`Landing pod down in ${e.target.name}! Destroy it.`, 'bad'); audio.alarm();
        } else {
          damageRegion(e.target, e.d.dmg * m.scale, e.type);
          explode(p, FACTIONS[e.d.faction].glow, 0.8);
          e.alive = false; e.target.incoming = Math.max(0, e.target.incoming - 1);
          if (game.priority === e) game.priority = null;
          if (e.target.shieldT <= 0) audio.hit();
        }
      }
    } else if (e.state === 'orbit') {
      // shield ship: bombard from standoff, hack satellites
      const want = tmpB.copy(tgtPos).normalize().multiplyScalar(R + 3.2);
      p.lerp(want, dt * 0.5);
      e.group.lookAt(tgtPos);
      e.fireT -= dt;
      if (e.fireT <= 0) { e.fireT = 2.5; damageRegion(e.target, e.d.dmg * m.scale, 'shield'); beamFx(p, tgtPos, 0x3fa9ff, 0.05, 0.25); audio.hit(); }
      e.hackT -= dt;
      if (e.hackT <= 0 && satellites.length) { e.hackT = rand(14, 20); const sat = pick(satellites); if (sat.disabledT <= 0) { sat.disabledT = 4; say('Nhal intrusion: satellite link lost for 4s.', 'warn'); } }
    } else if (e.state === 'landed') {
      const drain = e.d.dmg * m.scale * (m.name === 'The Harvest Begins' ? 1.8 : 1);
      damageRegion(e.target, drain * dt, 'pod');
      if (Math.random() < dt * 2) { const wp = e.group.getWorldPosition(tmpB); beamFx(wp, wp.clone().multiplyScalar(1.25), 0xb060ff, 0.1, 0.3); }
    }
  }

  // missiles
  for (let i = missiles.length - 1; i >= 0; i--) {
    const ms = missiles[i];
    if (ms.delay > 0) { ms.delay -= dt; continue; }
    ms.life -= dt;
    const p = ms.mesh.position;
    if (!ms.target || !ms.target.alive) { let bd = 1e9, nt = null; for (const e of enemies) { const d = e.group.position.distanceTo(p); if (d < bd) { bd = d; nt = e; } } ms.target = nt; }
    const tp = ms.target ? (ms.target.state === 'landed' ? ms.target.group.getWorldPosition(tmpA) : ms.target.group.position) : null;
    if (tp) {
      const want = tmpB.copy(tp).sub(p).normalize().multiplyScalar(16);
      ms.vel.lerp(want, clamp(dt * 2.4, 0, 1));
    }
    p.addScaledVector(ms.vel, dt);
    ms.mesh.lookAt(tmpC.copy(p).add(ms.vel));
    const arr = ms.trail.geometry.attributes.position.array;
    for (let k = arr.length - 3; k >= 3; k -= 3) { arr[k] = arr[k - 3]; arr[k + 1] = arr[k - 2]; arr[k + 2] = arr[k - 1]; }
    arr[0] = p.x; arr[1] = p.y; arr[2] = p.z; ms.trail.geometry.attributes.position.needsUpdate = true;
    let hit = false;
    if (tp && p.distanceTo(tp) < 0.9 + (ms.target.d.size || 0.5)) { damageEnemy(ms.target, ms.dmg * (ms.target.type === 'shield' ? 1.5 : 1), 'missile'); hit = true; }
    if (hit || ms.life <= 0 || p.length() < R - 0.5) {
      explode(p, 0xffd080, 0.5);
      scene.remove(ms.mesh); scene.remove(ms.trail); missiles.splice(i, 1);
    }
  }

  // interceptor squads
  for (let i = squads.length - 1; i >= 0; i--) {
    const sq = squads[i];
    sq.life -= dt;
    if (sq.life <= 0) { scene.remove(sq.group); squads.splice(i, 1); continue; }
    if (!sq.target || !sq.target.alive || sq.target.state === 'landed') {
      let bd = 10, nt = null;
      for (const e of enemies) { if (e.type === 'mothership' || e.state === 'landed') continue; const d = e.group.position.distanceTo(sq.pos); if (d < bd) { bd = d; nt = e; } }
      sq.target = nt;
    }
    const goal = sq.target ? sq.target.group.position : sq.dest;
    const dir = tmpA.copy(goal).sub(sq.pos); const dist = dir.length();
    if (dist > 0.1) sq.pos.addScaledVector(dir.normalize(), Math.min(dist, 11 * dt));
    if (sq.target && dist < 2.4) {
      const dmg = sq.dps * dt * sq.ships.length / 6;
      damageEnemy(sq.target, sq.target.shield > 0 ? dmg * 0.4 : dmg, 'inter');
      if (Math.random() < dt * 6) beamFx(sq.pos, sq.target.group.position, 0x9ff6ff, 0.02, 0.06);
      // bombers and shield ships shoot back
      if ((sq.target.type === 'bomber' || sq.target.type === 'shield') && Math.random() < dt * 0.35 && sq.ships.length > 1) {
        const lost = sq.ships.pop(); sq.group.remove(lost.mesh); explode(lost.mesh.position.clone().add(sq.pos), 0x9ff6ff, 0.3);
      }
    }
    sq.ships.forEach((sh, k) => {
      sh.phase += dt * 3;
      const off = tmpB.set(Math.cos(sh.phase + k) * 0.9, Math.sin(sh.phase * 1.3 + k) * 0.5, Math.sin(sh.phase + k * 2) * 0.9);
      sh.mesh.position.copy(sq.pos).add(off);
      sh.mesh.lookAt(goal);
    });
  }

  // fx
  for (let i = fx.length - 1; i >= 0; i--) {
    const f = fx[i]; f.t += dt;
    const k = f.t / f.life;
    if (f.kind === 'boom') {
      const arr = f.pts.geometry.attributes.position.array;
      for (let j = 0; j < f.v.length; j++) { arr[j * 3] += f.v[j].x * dt; arr[j * 3 + 1] += f.v[j].y * dt; arr[j * 3 + 2] += f.v[j].z * dt; f.v[j].multiplyScalar(0.96); }
      f.pts.geometry.attributes.position.needsUpdate = true;
      f.pts.material.opacity = 1 - k;
      f.flash.scale.setScalar(1 + k * 2); f.flash.material.opacity = 0.9 * (1 - k * 2);
      if (k >= 1) { scene.remove(f.pts); scene.remove(f.flash); fx.splice(i, 1); }
    } else if (f.kind === 'emp') {
      f.mesh.scale.setScalar(0.2 + f.radius * k); f.mesh.material.opacity = 0.6 * (1 - k);
      if (k >= 1) { scene.remove(f.mesh); fx.splice(i, 1); }
    } else if (f.kind === 'beam') {
      f.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { scene.remove(f.mesh); fx.splice(i, 1); }
    }
  }

  // priority marker
  if (game.priority && !game.priority.alive) game.priority = null;
  marker.visible = !!game.priority;
  if (game.priority) { marker.position.copy(game.priority.state === 'landed' ? game.priority.group.getWorldPosition(tmpA) : game.priority.group.position); marker.rotation.z += dt * 2; marker.lookAt(camera.position); marker.scale.setScalar(game.priority.d.size * 2.2); }

  // camera focus
  if (focusTarget) {
    camera.position.lerp(focusTarget, 1 - Math.pow(0.001, dt));
    camera.position.setLength(focusTarget.length());
    if (camera.position.distanceTo(focusTarget) < 0.3) focusTarget = null;
  }

  // HUD
  renderTop();
  if (game.t - lastRegionsRender > 0.25) { lastRegionsRender = game.t; renderRegions(); renderTools(); }
}

const marker = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 4), new THREE.MeshBasicMaterial({ color: 0xffe066, side: THREE.DoubleSide, transparent: true, opacity: 0.95, depthTest: false }));
marker.visible = false; marker.renderOrder = 10; scene.add(marker);

// ---------------------------------------------------------------- autotest (headless QA)
function autoplay(dt) {
  autoplay.t = (autoplay.t || 0) + dt;
  if (autoplay.t < 0.5) return;
  autoplay.t = 0;
  const s = stats();
  const threats = enemies.slice().sort((a, b) => a.group.position.length() - b.group.position.length());
  const t = threats[0];
  if (!t) return;
  game.priority = t;
  const pods = enemies.filter((e) => e.type === 'pod' || e.state === 'landed');
  const shields = enemies.filter((e) => e.shield > 0);
  const boss = enemies.find((e) => e.type === 'mothership');
  if (shields.length >= 2 && game.energy >= s.empCost) useTool('emp', { enemy: shields[0] });
  else if (boss && boss.shield <= 0 && game.energy >= s.missileCost && game.missilesLocked <= 0) useTool('missile', { enemy: boss });
  else if (pods.length && game.energy >= s.missileCost && game.missilesLocked <= 0) useTool('missile', { enemy: pods[0] });
  else if (threats.length > 6 && game.energy >= s.interCost) useTool('inter', { point: threats[2].group.position.clone() });
  else if (game.energy >= s.shieldCost + 20) { const r = regions.filter((x) => x.alive).sort((a, b) => b.incoming - a.incoming)[0]; if (r && r.incoming > 2) useTool('shield', { region: r }); }
}

// ---------------------------------------------------------------- loop
let last = performance.now();
let frames = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000) * TIMESCALE;
  last = now;
  if (game.state === 'playing') {
    if (AUTOTEST) { autoplay(dt); }
    update(dt);
  } else {
    E.group.rotation.y += dt * 0.02;
    for (const sat of satellites) { sat.angle += dt * sat.speed; const x = Math.cos(sat.angle) * sat.radius, z = Math.sin(sat.angle) * sat.radius, y = Math.sin(sat.angle) * sat.radius * Math.sin(sat.inc); sat.pos.set(x * Math.cos(sat.node) - z * Math.sin(sat.node), y, x * Math.sin(sat.node) + z * Math.cos(sat.node)); sat.group.position.copy(sat.pos); sat.group.lookAt(0, 0, 0); }
  }
  controls.update();
  composer.render();
  frames++;
}

// ---------------------------------------------------------------- boot
resize();
syncSatellites();
titleScreen();
$('#ver').textContent = `v${VERSION}`;
requestAnimationFrame(loop);
if (AUTOTEST) {
  window.__game = { game, enemies, regions, missions: MISSIONS, startNew: () => { newGame(); startMission(); }, frames: () => frames };
}
window.addEventListener('error', (ev) => { const el = $('#err'); if (el) { el.textContent = 'Error: ' + ev.message; el.style.display = 'block'; } });
