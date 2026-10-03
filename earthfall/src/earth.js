// Procedural Earth: equirectangular day map + night-lights map drawn from
// Natural Earth land polygons (world-atlas), atmosphere glow shader, clouds.
import * as THREE from 'three';
import { feature } from 'topojson-client';
import land from 'world-atlas/land-110m.json';

export const R = 10;

export function latLon(lat, lon, r = R) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function landPaths(ctx, W, H) {
  const geo = feature(land, land.objects.land);
  ctx.beginPath();
  for (const f of geo.features) {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of polys) {
      for (const ring of poly) {
        ring.forEach(([lon, lat], i) => {
          const x = (lon + 180) / 360 * W;
          const y = (90 - lat) / 180 * H;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      }
    }
  }
}

function mulberry(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function buildEarthTextures() {
  const W = 2048, H = 1024;
  // ---- day map
  const day = document.createElement('canvas');
  day.width = W; day.height = H;
  const c = day.getContext('2d');
  const ocean = c.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#0b2a4a');
  ocean.addColorStop(0.5, '#0e3d66');
  ocean.addColorStop(1, '#0b2a4a');
  c.fillStyle = ocean; c.fillRect(0, 0, W, H);
  // land
  landPaths(c, W, H);
  c.fillStyle = '#2e6b3f';
  c.fill('evenodd');
  c.lineWidth = 2.2; c.strokeStyle = 'rgba(170,230,255,0.55)'; c.stroke();
  // latitude tinting (deserts / tundra)
  const tint = c.createLinearGradient(0, 0, 0, H);
  tint.addColorStop(0.0, 'rgba(230,240,255,0.55)');
  tint.addColorStop(0.12, 'rgba(120,150,110,0.25)');
  tint.addColorStop(0.32, 'rgba(190,160,90,0.35)');
  tint.addColorStop(0.5, 'rgba(40,110,50,0.2)');
  tint.addColorStop(0.68, 'rgba(190,160,90,0.3)');
  tint.addColorStop(0.9, 'rgba(120,150,110,0.25)');
  tint.addColorStop(1.0, 'rgba(230,240,255,0.7)');
  c.save(); landPaths(c, W, H); c.clip('evenodd');
  c.fillStyle = tint; c.fillRect(0, 0, W, H);
  c.restore();
  // ice caps
  c.fillStyle = 'rgba(225,238,250,0.9)';
  c.fillRect(0, 0, W, H * 0.045); c.fillRect(0, H * 0.93, W, H * 0.07);

  // ---- land mask for sampling lights
  const mask = c.getImageData(0, 0, W, H).data;
  const isLand = (x, y) => {
    const i = ((y | 0) * W + (x | 0)) * 4;
    return mask[i + 1] > mask[i + 2] + 10; // greener than blue
  };

  // ---- night lights
  const night = document.createElement('canvas');
  night.width = W; night.height = H;
  const n = night.getContext('2d');
  n.fillStyle = '#000'; n.fillRect(0, 0, W, H);
  const rnd = mulberry(7);
  n.fillStyle = 'rgba(255,214,140,0.9)';
  for (let i = 0; i < 9000; i++) {
    const x = rnd() * W, y = rnd() * H;
    const lat = 90 - y / H * 180;
    const w = Math.exp(-Math.pow((lat - 38) / 22, 2)) * 0.8 + 0.15;
    if (rnd() > w) continue;
    if (!isLand(x, y)) continue;
    const s = rnd() < 0.08 ? 3 : 1.4;
    n.globalAlpha = 0.25 + rnd() * 0.35;
    n.fillRect(x, y, s, s);
  }
  n.globalAlpha = 1;
  const cities = [
    [40.7, -74], [34, -118], [41.8, -87.6], [19.4, -99], [45.5, -73.6], [29.7, -95.4],
    [51.5, -0.1], [48.8, 2.3], [52.5, 13.4], [41.9, 12.5], [40.4, -3.7], [55.7, 37.6],
    [35.7, 139.7], [31.2, 121.5], [39.9, 116.4], [37.5, 127], [22.3, 114.2], [25, 121.5],
    [28.6, 77.2], [19, 72.8], [13, 77.6], [23.8, 90.4], [24.9, 67], [13.7, 100.5], [1.3, 103.8], [-6.2, 106.8], [14.6, 121],
    [30, 31.2], [6.5, 3.4], [-1.3, 36.8], [-26.2, 28], [33.6, -7.6], [9, 38.7],
    [-23.5, -46.6], [-34.6, -58.4], [-12, -77], [4.7, -74], [-33.4, -70.6], [-22.9, -43.2],
    [-33.9, 151.2], [-37.8, 145], [-36.8, 174.8], [24.7, 46.7], [25.2, 55.3], [41, 29], [35.7, 51.4],
  ];
  for (const [lat, lon] of cities) {
    const x = (lon + 180) / 360 * W, y = (90 - lat) / 180 * H;
    const g = n.createRadialGradient(x, y, 0, x, y, 14);
    g.addColorStop(0, 'rgba(255,235,190,1)');
    g.addColorStop(0.4, 'rgba(255,200,120,0.6)');
    g.addColorStop(1, 'rgba(255,180,90,0)');
    n.fillStyle = g; n.fillRect(x - 14, y - 14, 28, 28);
  }

  // ---- clouds
  const cl = document.createElement('canvas');
  cl.width = 1024; cl.height = 512;
  const k = cl.getContext('2d');
  k.clearRect(0, 0, 1024, 512);
  const r2 = mulberry(99);
  for (let i = 0; i < 1600; i++) {
    const x = r2() * 1024, y = 40 + r2() * 432;
    const rad = 3 + r2() * 14;
    const sx = 1.6 + r2() * 2.4;
    k.save(); k.translate(x, y); k.scale(sx, 1);
    const g = k.createRadialGradient(0, 0, 0, 0, 0, rad);
    const a = 0.06 + r2() * 0.16;
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    k.fillStyle = g; k.fillRect(-rad, -rad, rad * 2, rad * 2);
    k.restore();
  }

  const mk = (cv) => { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  return { day: mk(day), night: mk(night), clouds: mk(cl) };
}

export function buildEarth() {
  const group = new THREE.Group();
  const tex = buildEarthTextures();
  const geo = new THREE.SphereGeometry(R, 96, 64);
  const mat = new THREE.MeshStandardMaterial({
    map: tex.day, roughness: 0.75, metalness: 0.05,
    emissiveMap: tex.night, emissive: new THREE.Color(0xffc58a), emissiveIntensity: 0.6,
  });
  const earth = new THREE.Mesh(geo, mat);
  group.add(earth);

  const clouds = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.015, 64, 48),
    new THREE.MeshStandardMaterial({ map: tex.clouds, transparent: true, opacity: 0.55, depthWrite: false, roughness: 1 }),
  );
  group.add(clouds);

  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.14, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0x4fb8ff) } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 color; varying vec3 vN; void main(){ float i = pow(0.62 - dot(vN, vec3(0.0,0.0,1.0)), 3.0); gl_FragColor = vec4(color, 1.0)*i*1.6; }`,
      side: THREE.BackSide, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  group.add(atmo);
  const rim = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.002, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(0x6fd1ff) } },
      vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `uniform vec3 color; varying vec3 vN; void main(){ float f = 1.0 - max(dot(vN, vec3(0.0,0.0,1.0)),0.0); gl_FragColor = vec4(color, 1.0)*pow(f,4.0)*0.9; }`,
      blending: THREE.AdditiveBlending, transparent: true, depthWrite: false,
    }),
  );
  group.add(rim);
  return { group, earth, clouds };
}

export function buildStars() {
  const N = 2600;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const rnd = mulberry(3);
  for (let i = 0; i < N; i++) {
    const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(180 + rnd() * 60);
    pos.set([v.x, v.y, v.z], i * 3);
    const t = rnd();
    const c = t < 0.1 ? [1, 0.75, 0.6] : t < 0.3 ? [0.7, 0.8, 1] : [1, 1, 1];
    const b = 0.5 + rnd() * 0.5;
    col.set([c[0] * b, c[1] * b, c[2] * b], i * 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9, vertexColors: true, sizeAttenuation: true }));
}
