// Rendering: scene, arena, models, particles, blade trail, view model.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ENEMY, BIOMES } from './data.js';

export { THREE };
export const R = 26; // arena radius
export const PILLARS = [];
const A = (n) => (window.EW_ASSETS && window.EW_ASSETS[n]) || n;

export const G = {
  renderer: null, scene: null, camera: null, composer: null, bloom: null, quality: 2, pr: 1,
  models: {}, tex: {}, vm: null, blade: null, bladeGlow: null, bladeLight: null, bladeMat: null, bladeGlowMat: null,
  sky: null, skyCap: null, wall: null, ring: null, hemi: null, sun: null, floorMat: null, accentMats: [], time: 0,
};

export function initRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.15;
  r.outputColorSpace = THREE.SRGBColorSpace;
  G.renderer = r;
  G.scene = new THREE.Scene();
  G.scene.fog = new THREE.Fog(0x0b1030, 30, 150);
  G.camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.05, 900);
  G.camera.rotation.order = 'YXZ';
  G.scene.add(G.camera);
  G.composer = new EffectComposer(r);
  G.composer.addPass(new RenderPass(G.scene, G.camera));
  G.bloom = new UnrealBloomPass(new THREE.Vector2(512, 288), 0.42, 0.5, 0.88);
  G.composer.addPass(G.bloom);
  G.composer.addPass(new OutputPass());
  resize();
}

export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const base = Math.min(window.devicePixelRatio || 1, 2);
  G.pr = G.quality >= 1 ? base : Math.min(base, 1) * 0.8;
  G.renderer.setPixelRatio(G.pr); G.renderer.setSize(w, h, false);
  G.composer.setPixelRatio(G.pr); G.composer.setSize(w, h);
  G.camera.aspect = w / h;
  // keep horizontal view wide enough in portrait
  G.baseFov = w / h < 1 ? 92 : 74;
  G.camera.fov = G.baseFov; G.camera.updateProjectionMatrix();
}
export function setQuality(q) { G.quality = q; resize(); }
export function render() { if (G.quality >= 2) G.composer.render(); else G.renderer.render(G.scene, G.camera); }

// ---------- assets ----------
function glowMat(map, glow, swz) {
  const m = new THREE.MeshStandardMaterial({ map, roughness: 0.7, metalness: 0.15 });
  m.userData.u = { uGlow: { value: glow ? 1 : 0 }, uFlash: { value: 0 }, uTint: { value: new THREE.Color(1, 1, 1) }, uSwz: { value: swz || 0 } };
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, m.userData.u);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uGlow; uniform float uFlash; uniform vec3 uTint; uniform float uSwz;')
      .replace('#include <emissivemap_fragment>', `
        #ifdef USE_MAP
          vec3 emc = texture2D( map, vMapUv ).rgb;
          if ( uSwz > 1.5 ) { emc = vec3( max( emc.r, emc.g ), emc.b, emc.b * 0.8 ); diffuseColor.rgb = vec3( max( diffuseColor.r, diffuseColor.g ), diffuseColor.b, diffuseColor.b * 0.8 ); } else if ( uSwz > 0.5 ) { emc = emc.gbr; diffuseColor.rgb = diffuseColor.gbr; }
          float emx = max( emc.r, max( emc.g, emc.b ) ); float emn = min( emc.r, min( emc.g, emc.b ) );
          float eg = smoothstep( 0.22, 0.6, emx - emn ) * smoothstep( 0.25, 0.75, emx );
          totalEmissiveRadiance += emc * ( eg * uGlow * 1.1 + 0.12 + uFlash * 2.0 ) + vec3( uFlash * 0.35 );
        #endif
        diffuseColor.rgb *= uTint;`);
  };
  return m;
}

function normalize(root, size, upright) {
  const box = new THREE.Box3().setFromObject(root), s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const g = new THREE.Group(); root.position.sub(c); g.add(root);
  if (upright) { // longest axis to +Y
    if (s.x > s.y && s.x > s.z) g.rotation.z = Math.PI / 2; else if (s.z > s.y && s.z > s.x) g.rotation.x = -Math.PI / 2;
  }
  const k = size / Math.max(s.x, s.y, s.z); g.scale.setScalar(k);
  const w = new THREE.Group(); w.add(g); return w;
}

function fallbackModel(kind) {
  const d = ENEMY[kind], col = new THREE.Color(d.glow[0], d.glow[1], d.glow[2]);
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({ color: 0x20222c, roughness: 0.6, emissive: col, emissiveIntensity: 0.25 }));
  body.scale.set(1, 0.8, 1.2); g.add(body);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: col }));
  eye.position.set(0, 0.1, 0.55); g.add(eye);
  for (let i = 0; i < 4; i++) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 5), body.material); h.position.set(Math.cos(i * 1.57 + 0.78) * 0.35, 0.35, Math.sin(i * 1.57 + 0.78) * 0.3); h.rotation.x = -0.6; g.add(h); }
  return normalize(g, d.size, false);
}

export async function loadAssets(onProgress) {
  const tl = new THREE.TextureLoader(), gl = new GLTFLoader();
  const jobs = [];
  let done = 0; const tick = () => onProgress(++done / jobs.length);
  const tex = (key, file, srgb, repeat) => jobs.push(new Promise((res) => tl.load(A(file), (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } t.anisotropy = 4; G.tex[key] = t; tick(); res(); }, undefined, () => { tick(); res(); })));
  const glb = (key, file) => jobs.push(new Promise((res) => gl.load(A(file), (g) => { G.models[key] = g.scene; tick(); res(); }, undefined, () => { tick(); res(); })));
  tex('sky', 'sky.jpg', true, true); tex('floor', 'floor.jpg', true, true);
  for (const k of ['wraith', 'stinger', 'brute', 'tyrant', 'hilt']) glb(k, k + '.glb');
  await Promise.all(jobs);
}

// Make a fresh enemy visual. Returns { obj, mats }.
export function makeEnemyVisual(kind, yawFix) {
  const d = ENEMY[kind], src = G.models[d.model];
  let obj; const mats = [];
  if (src) {
    const c = src.clone(true);
    c.traverse((o) => { if (o.isMesh) { const m = glowMat(o.material.map, true, d.swz); o.material = m; mats.push(m); } });
    obj = normalize(c, d.size, false);
    obj.children[0].rotation.y = yawFix || 0;
  } else obj = fallbackModel(kind);
  return { obj, mats };
}

// ---------- world ----------
export function buildWorld() {
  const s = G.scene;
  G.hemi = new THREE.HemisphereLight(0x9db4ff, 0x1a1030, 1.25); s.add(G.hemi);
  G.sun = new THREE.DirectionalLight(0xd8ccff, 1.6); G.sun.position.set(-30, 50, -40); s.add(G.sun);

  // sky cylinder + cap
  const skyR = 420, skyH = 2 * Math.PI * skyR * (1152 / 2688);
  const skyMat = new THREE.MeshBasicMaterial({ map: G.tex.sky || null, color: G.tex.sky ? 0xffffff : 0x1a1650, side: THREE.BackSide, fog: false, toneMapped: false, depthWrite: false });
  G.sky = new THREE.Mesh(new THREE.CylinderGeometry(skyR, skyR, skyH, 48, 1, true), skyMat);
  G.sky.position.y = skyH / 2 - 95; G.sky.renderOrder = -10; s.add(G.sky);
  G.skyCap = new THREE.Mesh(new THREE.CircleGeometry(skyR, 32), new THREE.MeshBasicMaterial({ color: 0x080a24, fog: false, side: THREE.DoubleSide, depthWrite: false }));
  G.skyCap.rotation.x = Math.PI / 2; G.skyCap.position.y = skyH - 96; G.skyCap.renderOrder = -11; s.add(G.skyCap);

  // far ground
  const far = new THREE.Mesh(new THREE.CircleGeometry(600, 48), new THREE.MeshBasicMaterial({ color: 0x070a1c }));
  far.rotation.x = -Math.PI / 2; far.position.y = -0.06; s.add(far);

  // arena floor
  if (G.tex.floor) G.tex.floor.repeat.set(9, 9);
  G.floorMat = new THREE.MeshStandardMaterial({ map: G.tex.floor || null, color: G.tex.floor ? 0xb8c4e8 : 0x39425c, roughness: 0.82, metalness: 0.2 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R + 5, 72), G.floorMat); floor.rotation.x = -Math.PI / 2; s.add(floor);

  const accent = (opacity) => { const m = new THREE.MeshBasicMaterial({ color: 0x7a5cff, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }); G.accentMats.push(m); return m; };
  for (const [ri, w, o] of [[R, 0.22, 0.9], [14, 0.07, 0.45], [6, 0.06, 0.4], [R + 4.6, 0.3, 0.5]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(ri - w, ri + w, 96), accent(o)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.02; s.add(ring);
  }
  // energy wall
  const wallMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(0x7a5cff) } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform float uTime; uniform vec3 uColor; varying vec2 vUv; void main(){ float f = pow(1.0 - vUv.y, 2.5); float l = smoothstep(0.92, 1.0, sin(vUv.x * 500.0 + uTime * 0.6) * 0.5 + 0.5) * 0.35; float sc = smoothstep(0.9, 1.0, sin(vUv.y * 40.0 - uTime * 2.0) * 0.5 + 0.5) * 0.25; gl_FragColor = vec4(uColor * (f * 0.26 + (l + sc) * f * 0.8), 1.0); }',
  });
  G.wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 7, 96, 1, true), wallMat); G.wall.position.y = 3.5; s.add(G.wall);

  // pillars (cover)
  const stone = new THREE.MeshStandardMaterial({ color: 0x6f7aa6, roughness: 0.85, metalness: 0.1, flatShading: true });
  const cry = new THREE.MeshStandardMaterial({ color: 0x1a1030, emissive: 0x7a5cff, emissiveIntensity: 1.6, roughness: 0.3, flatShading: true });
  G.accentMats.push(cry);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3, x = Math.cos(a) * 13.5, z = Math.sin(a) * 13.5;
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.3, 4.6, 6), stone); p.position.set(x, 2.3, z); s.add(p);
    for (const [py, pr] of [[0.9, 1.26], [3.6, 0.99]]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(pr, pr + 0.03, 0.12, 6), cry); band.position.set(x, py, z); s.add(band); }
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.75), cry); c.scale.y = 1.7; c.position.set(x, 5.6, z); c.userData.spin = 1; s.add(c);
    G.spinners = G.spinners || []; G.spinners.push(c);
    PILLARS.push({ x, z, r: 1.45 });
  }
  // outer crystal spires
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 26; i++) {
    const a = rnd() * 6.283, d = R + 9 + rnd() * 55, h = 6 + rnd() * 22;
    const m = new THREE.Mesh(new THREE.ConeGeometry(1.2 + h * 0.13, h, 5), i % 3 === 0 ? cry : stone);
    m.position.set(Math.cos(a) * d, h / 2 - 0.5, Math.sin(a) * d); m.rotation.set((rnd() - 0.5) * 0.35, rnd() * 6, (rnd() - 0.5) * 0.35); s.add(m);
  }
}

export function setBiome(i) {
  const b = BIOMES[i % BIOMES.length];
  G.sky.material.color.set(G.tex.sky ? b.sky : 0x1a1650);
  G.scene.fog.color.set(b.fog); G.hemi.color.set(b.light);
  for (const m of G.accentMats) { if (m.emissive) m.emissive.set(b.accent); else m.color.set(b.accent); }
  G.wall.material.uniforms.uColor.value.set(b.accent);
}

// ---------- view model (the blade) ----------
export function buildViewModel() {
  const vm = new THREE.Group(); G.camera.add(vm); G.vm = vm;
  let hilt;
  if (G.models.hilt) {
    const c = G.models.hilt.clone(true);
    c.traverse((o) => { if (o.isMesh) o.material = glowMat(o.material.map, false); });
    hilt = normalize(c, 0.36, true);
  } else {
    hilt = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 0.36, 10), new THREE.MeshStandardMaterial({ color: 0x555b66, metalness: 0.8, roughness: 0.35 }));
  }
  G.hilt = hilt; vm.add(hilt);
  // saber blade: thin white-hot core plus soft additive glow shells
  const L = 0.95, y0 = 0.17;
  const cap = (r) => { const g = new THREE.CapsuleGeometry(r, L, 6, 14); g.translate(0, y0 + L / 2 + 0.011, 0); return g; };
  G.bladeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  G.blade = new THREE.Mesh(cap(0.0105), G.bladeMat); vm.add(G.blade);
  G.bladeGlowMat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  G.bladeGlow = new THREE.Group(); vm.add(G.bladeGlow);
  for (const [r, o] of [[0.019, 0.55], [0.032, 0.26], [0.055, 0.12]]) { const m = G.bladeGlowMat.clone(); m.opacity = o; m.color = G.bladeGlowMat.color; const sh = new THREE.Mesh(cap(r), m); sh.renderOrder = 4; G.bladeGlow.add(sh); }
  G.bladeLight = new THREE.PointLight(0xff8a2a, 5, 10, 1.4); G.bladeLight.position.set(0, 0.2, -0.8); G.camera.add(G.bladeLight);
}
export function setBladeColor(hex) {
  const c = new THREE.Color(hex);
  G.bladeMat.color.copy(c).lerp(new THREE.Color(1, 1, 1), 0.8);
  G.bladeGlowMat.color.copy(c); G.bladeLight.color.copy(c); trail.mat.color.copy(c);
}
export function setBladeLength(k) { G.blade.scale.y = k; G.bladeGlow.scale.y = k; }
export function setBladeGlow(k) { G.bladeGlow.scale.x = G.bladeGlow.scale.z = k; G.bladeLight.intensity = 5 * k; }

// ---------- particles ----------
const PN = 1000;
export const parts = { n: PN, pos: new Float32Array(PN * 3), vel: new Float32Array(PN * 3), col: new Float32Array(PN * 3), base: new Float32Array(PN * 3), size: new Float32Array(PN), life: new Float32Array(PN), max: new Float32Array(PN), grav: new Float32Array(PN), head: 0, points: null };
export function buildParticles() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(parts.pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(parts.col, 3));
  g.setAttribute('size', new THREE.BufferAttribute(parts.size, 1));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uScale: { value: 600 } },
    vertexShader: 'attribute float size; attribute vec3 color; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vC * a * a * 1.6, 1.0); }',
  });
  parts.points = new THREE.Points(g, m); parts.points.frustumCulled = false; G.scene.add(parts.points);
  for (let i = 0; i < PN; i++) parts.pos[i * 3 + 1] = -999;
}
export function emit(x, y, z, n, o) {
  const sp = o.speed || 5, c = o.color || [1, 1, 1];
  for (let k = 0; k < n; k++) {
    const i = parts.head; parts.head = (parts.head + 1) % PN;
    const th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), v = sp * (0.3 + Math.random() * 0.7);
    parts.pos[i * 3] = x; parts.pos[i * 3 + 1] = y; parts.pos[i * 3 + 2] = z;
    parts.vel[i * 3] = Math.sin(ph) * Math.cos(th) * v + (o.vx || 0); parts.vel[i * 3 + 1] = Math.cos(ph) * v * (o.flat ? 0.2 : 1) + (o.up || 0); parts.vel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * v + (o.vz || 0);
    const j = 0.7 + Math.random() * 0.3; parts.base[i * 3] = c[0] * j; parts.base[i * 3 + 1] = c[1] * j; parts.base[i * 3 + 2] = c[2] * j;
    parts.size[i] = (o.size || 0.25) * (0.6 + Math.random() * 0.8); parts.max[i] = parts.life[i] = (o.life || 0.5) * (0.6 + Math.random() * 0.8); parts.grav[i] = o.grav === undefined ? 6 : o.grav;
  }
}
export function updateParticles(dt) {
  for (let i = 0; i < PN; i++) {
    if (parts.life[i] <= 0) continue;
    parts.life[i] -= dt;
    if (parts.life[i] <= 0) { parts.pos[i * 3 + 1] = -999; continue; }
    parts.vel[i * 3 + 1] -= parts.grav[i] * dt;
    const dr = Math.exp(-2.2 * dt);
    parts.vel[i * 3] *= dr; parts.vel[i * 3 + 2] *= dr;
    parts.pos[i * 3] += parts.vel[i * 3] * dt; parts.pos[i * 3 + 1] += parts.vel[i * 3 + 1] * dt; parts.pos[i * 3 + 2] += parts.vel[i * 3 + 2] * dt;
    if (parts.pos[i * 3 + 1] < 0.03 && parts.grav[i] > 0) { parts.pos[i * 3 + 1] = 0.03; parts.vel[i * 3 + 1] *= -0.35; }
    const a = parts.life[i] / parts.max[i];
    parts.col[i * 3] = parts.base[i * 3] * a; parts.col[i * 3 + 1] = parts.base[i * 3 + 1] * a; parts.col[i * 3 + 2] = parts.base[i * 3 + 2] * a;
  }
  const g = parts.points.geometry; g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true; g.attributes.size.needsUpdate = true;
  parts.points.material.uniforms.uScale.value = window.innerHeight * G.pr * 0.9;
}

// ---------- shock rings ----------
const rings = [];
export function buildRings() {
  const geo = new THREE.RingGeometry(0.86, 1, 48);
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; G.scene.add(m); rings.push({ m, t: 0, dur: 1, r0: 0, r1: 1 });
  }
}
export function ring(x, y, z, r0, r1, dur, color, vertical) {
  const r = rings.find((q) => !q.m.visible) || rings[0];
  r.m.visible = true; r.m.position.set(x, y, z); r.t = 0; r.dur = dur; r.r0 = r0; r.r1 = r1; r.m.material.color.set(color);
  r.m.rotation.set(vertical ? 0 : -Math.PI / 2, 0, 0); if (vertical) r.m.lookAt(G.camera.getWorldPosition(new THREE.Vector3()));
}
export function updateRings(dt) {
  for (const r of rings) { if (!r.m.visible) continue; r.t += dt; const k = r.t / r.dur; if (k >= 1) { r.m.visible = false; continue; } const e = 1 - Math.pow(1 - k, 3); r.m.scale.setScalar(r.r0 + (r.r1 - r.r0) * e); r.m.material.opacity = (1 - k) * 0.9; }
}

// ---------- blade trail ----------
const TN = 18;
export const trail = { pos: new Float32Array(TN * 2 * 3), col: new Float32Array(TN * 2 * 3), mesh: null, mat: null, alpha: new Float32Array(TN), a: new THREE.Vector3(), b: new THREE.Vector3() };
export function buildTrail() {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(trail.pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(trail.col, 3));
  const idx = []; for (let i = 0; i < TN - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setIndex(idx);
  trail.mat = new THREE.MeshBasicMaterial({ color: 0xff8a2a, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, depthTest: false });
  trail.mesh = new THREE.Mesh(g, trail.mat); trail.mesh.frustumCulled = false; trail.mesh.renderOrder = 5; G.scene.add(trail.mesh);
}
export function updateTrail(active, power) {
  G.blade.updateWorldMatrix(true, false);
  trail.a.set(0, 0.3, 0).applyMatrix4(G.blade.matrixWorld); trail.b.set(0, 1.13, 0).applyMatrix4(G.blade.matrixWorld);
  for (let i = TN - 1; i > 0; i--) { for (let k = 0; k < 6; k++) trail.pos[i * 6 + k] = trail.pos[(i - 1) * 6 + k]; trail.alpha[i] = trail.alpha[i - 1] * 0.86; }
  trail.pos[0] = trail.a.x; trail.pos[1] = trail.a.y; trail.pos[2] = trail.a.z; trail.pos[3] = trail.b.x; trail.pos[4] = trail.b.y; trail.pos[5] = trail.b.z;
  trail.alpha[0] = active ? power : 0;
  for (let i = 0; i < TN; i++) { const a = trail.alpha[i]; for (let k = 0; k < 6; k++) trail.col[i * 6 + k] = a * (k < 3 ? 0.08 : 1); }
  trail.mesh.geometry.attributes.position.needsUpdate = true; trail.mesh.geometry.attributes.color.needsUpdate = true;
}
