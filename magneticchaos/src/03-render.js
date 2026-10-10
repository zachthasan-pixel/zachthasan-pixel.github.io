// ---------------------------------------------------------------------------
// Rendering. Particles glow on a separate trail layer that fades a little
// each frame, which gives the long hypnotic streaks. HUD draws on top.
// ---------------------------------------------------------------------------
const tcv = document.createElement('canvas');
const tctx = tcv.getContext('2d');
const LAY = { cx: 0, cy: 0, R: 100, top: 0, bottom: 0, touch: false, wide: false };

function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(200, window.innerWidth); H = Math.max(200, window.innerHeight);
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  tcv.width = cvs.width; tcv.height = cvs.height;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  tctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  tctx.fillStyle = '#04050c'; tctx.fillRect(0, 0, W, H);
  // Wide, short screens (phones in landscape) put the HUD beside the sphere.
  LAY.wide = W > H * 1.45 && H < 600;
  const top = LAY.wide ? 14 : Math.max(64, H * 0.08), bottom = LAY.wide ? 14 : Math.max(78, H * 0.1);
  LAY.top = top; LAY.bottom = bottom;
  LAY.R = Math.max(60, Math.min(W * 0.46, (H - top - bottom) * 0.5));
  LAY.cx = W / 2; LAY.cy = top + (H - top - bottom) / 2;
  buildSprites();
}
const toScreen = (x, y) => [LAY.cx + x * LAY.R, LAY.cy + y * LAY.R];

// Pre-rendered glow dots, one per colour.
const SPR = {};
function glow(rgb, core) {
  const s = 64, c = document.createElement('canvas');
  c.width = c.height = s;
  const g = c.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  const [r, gg, b] = rgb;
  gr.addColorStop(0, core || 'rgba(255,255,255,1)');
  gr.addColorStop(0.18, `rgba(${r},${gg},${b},0.95)`);
  gr.addColorStop(0.45, `rgba(${r},${gg},${b},0.28)`);
  gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, s, s);
  return c;
}
function buildSprites() {
  SPR.pos = glow(KIND[0].rgb);
  SPR.neg = glow(KIND[1].rgb);
  SPR.fluxP = glow(KIND[2].rgb, 'rgba(255,214,150,1)');
  SPR.fluxN = glow(KIND[2].rgb, 'rgba(160,236,255,1)');
  SPR.seed = glow([150, 255, 180]);
}
const sprOf = (k, q) => (k === 0 ? SPR.pos : k === 1 ? SPR.neg : q > 0 ? SPR.fluxP : SPR.fluxN);
const rgba = (rgb, a) => `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${a})`;

function txt(s, x, y, size, col, align, weight, alpha) {
  ctx.font = f(size, weight);
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.globalAlpha = alpha == null ? 1 : alpha;
  ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = Math.max(4, size * 0.35); // legible over the swarm
  ctx.fillStyle = col; ctx.fillText(s, x, y);
  ctx.shadowBlur = 0; ctx.shadowColor = 'transparent';
  ctx.globalAlpha = 1;
}
function wrap(s, maxW, size, weight) {
  ctx.font = f(size, weight);
  const out = []; let line = '';
  for (const w of s.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (line && ctx.measureText(t).width > maxW) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

// ----------------------------------------------------------------- scene ---
function drawScene() {
  const r = run, R = LAY.R;
  // trail layer
  tctx.globalCompositeOperation = 'source-over';
  tctx.fillStyle = 'rgba(4,5,12,0.2)';
  tctx.fillRect(0, 0, W, H);
  tctx.globalCompositeOperation = 'lighter';
  const ps = Math.max(7, R * 0.05);
  for (let i = 0; i < P.n; i++) {
    const sx = LAY.cx + P.x[i] * R, sy = LAY.cy + P.y[i] * R;
    const g = P.age[i] < 0.5 ? P.age[i] / 0.5 : 1;
    const sz = ps * (0.6 + 0.4 * g);
    tctx.globalAlpha = 0.55 + 0.45 * g;
    tctx.drawImage(sprOf(P.k[i], P.q[i]), sx - sz / 2, sy - sz / 2, sz, sz);
  }
  for (const e of r.fx) {
    if (e.type !== 'spark') continue;
    const k = 1 - e.t / e.life, [sx, sy] = toScreen(e.x, e.y), sz = ps * (1 + (1 - k) * 1.5);
    tctx.globalAlpha = k * 0.8;
    tctx.drawImage(sprOf(e.k, e.q), sx - sz / 2, sy - sz / 2, sz, sz);
  }
  tctx.globalAlpha = 1;
  tctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#04050c'; ctx.fillRect(0, 0, W, H);
  // faint sphere body
  const bg = ctx.createRadialGradient(LAY.cx, LAY.cy, R * 0.1, LAY.cx, LAY.cy, R * 1.05);
  bg.addColorStop(0, 'rgba(40,46,90,0.22)'); bg.addColorStop(0.85, 'rgba(18,20,44,0.18)'); bg.addColorStop(1, 'rgba(4,5,12,0)');
  ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * 1.05, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(tcv, 0, 0, W, H);

  drawRim();
  drawSeeds();
  drawWell();
  drawFx();
}

function drawRim() {
  const r = run, R = LAY.R, t = game.t;
  ctx.lineWidth = Math.max(1.5, R * 0.006);
  ctx.strokeStyle = 'rgba(150,170,255,0.35)';
  ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(150,170,255,0.08)';
  ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * (1.03 + 0.01 * Math.sin(t * 2)), 0, Math.PI * 2); ctx.stroke();
  // rim heat where particles are close to escaping
  const n = r.edge.length, seg = Math.PI * 2 / n;
  ctx.lineWidth = Math.max(3, R * 0.018); ctx.lineCap = 'round';
  for (let b = 0; b < n; b++) {
    const v = Math.min(1, r.edge[b] * 0.2);
    if (v < 0.12) continue;
    ctx.strokeStyle = `rgba(255,${Math.round(120 - 80 * v)},${Math.round(110 - 60 * v)},${0.25 + 0.6 * v})`;
    ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * 1.012, b * seg + 0.02, (b + 1) * seg - 0.02); ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // storm warning: a ring that closes in toward the centre
  if (r.pulse) {
    const k = 1 - r.pulse.t / r.pulse.life, pr = R * (1 - ease(k) * 0.9);
    ctx.setLineDash([R * 0.04, R * 0.03]);
    ctx.lineDashOffset = -t * 60;
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(255,90,110,${0.35 + 0.4 * Math.abs(Math.sin(t * 10))})`;
    ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, pr, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawSeeds() {
  const R = LAY.R;
  for (const s of run.seeds) {
    const [sx, sy] = toScreen(s.x, s.y), fade = Math.min(1, s.t * 2) * (s.t > 12 ? (14 - s.t) / 2 : 1);
    const pulse = 1 + 0.15 * Math.sin(s.t * 6), sz = R * 0.13 * pulse;
    ctx.globalAlpha = fade;
    ctx.globalCompositeOperation = 'lighter';
    ctx.drawImage(SPR.seed, sx - sz / 2, sy - sz / 2, sz, sz);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(160,255,190,0.8)'; ctx.lineWidth = 1.5;
    const d = R * 0.035;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(s.t * 1.5);
    ctx.strokeRect(-d, -d, d * 2, d * 2);
    ctx.restore();
    ctx.globalAlpha = 1;
  }
}

function drawWell() {
  const r = run, R = LAY.R, [wx, wy] = toScreen(r.well.x, r.well.y), t = game.t;
  const col = r.inv ? [120, 230, 255] : [255, 214, 150];
  const gr = ctx.createRadialGradient(wx, wy, 0, wx, wy, R * 0.16);
  gr.addColorStop(0, rgba(col, 0.55)); gr.addColorStop(0.4, rgba(col, 0.12)); gr.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(wx, wy, R * 0.16, 0, Math.PI * 2); ctx.fill();
  // field arcs spin one way when pulling (+), the other when inverted
  ctx.lineWidth = 1.5;
  const dir = r.inv ? -1 : 1;
  for (let i = 0; i < 3; i++) {
    const rad = R * (0.045 + i * 0.022), a0 = t * (2.2 - i * 0.5) * dir + i * 2.1;
    ctx.strokeStyle = rgba(col, 0.6 - i * 0.15);
    ctx.beginPath(); ctx.arc(wx, wy, rad, a0, a0 + Math.PI * 1.2); ctx.stroke();
  }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(wx, wy, Math.max(3, R * 0.018), 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rgba(col, 1);
  ctx.beginPath(); ctx.arc(wx, wy, Math.max(2, R * 0.011), 0, Math.PI * 2); ctx.fill();
}

function drawFx() {
  const R = LAY.R;
  for (const e of run.fx) {
    const k = e.t / e.life;
    if (e.type === 'ring') {
      const [sx, sy] = toScreen(e.x, e.y);
      ctx.strokeStyle = rgba(e.rgb, 1 - k); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, R * (0.03 + 0.18 * ease(k)), 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'shock') {
      ctx.strokeStyle = `rgba(255,110,130,${(1 - k) * 0.8})`; ctx.lineWidth = 3 * (1 - k) + 1;
      ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * (0.1 + 0.95 * ease(k)), 0, Math.PI * 2); ctx.stroke();
    } else if (e.type === 'influx') {
      ctx.strokeStyle = `rgba(160,255,190,${(1 - k) * 0.7})`; ctx.lineWidth = Math.max(3, R * 0.02);
      ctx.beginPath(); ctx.arc(LAY.cx, LAY.cy, R * 1.03, e.a - 0.25, e.a + 0.25); ctx.stroke();
    }
  }
}

// ------------------------------------------------------------------- HUD ---
const BTN = [];
function button(r, label, fn, o) {
  o = o || {};
  BTN.push({ r, fn });
  const hot = inRect(ptr.x, ptr.y, r) && !ptr.touch;
  const col = o.col || '#ffd59a';
  ctx.fillStyle = hot ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.05)';
  ctx.strokeStyle = col; ctx.lineWidth = hot ? 2 : 1.4;
  roundRect(r.x, r.y, r.w, r.h, Math.min(r.h / 2, 26));
  ctx.fill(); ctx.stroke();
  txt(label, r.x + r.w / 2, r.y + r.h / 2 + 1, o.size || r.h * 0.38, col, 'center', 600);
}
function roundRect(x, y, w, h, rad) {
  ctx.beginPath();
  ctx.moveTo(x + rad, y); ctx.arcTo(x + w, y, x + w, y + h, rad); ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad); ctx.arcTo(x, y, x + w, y, rad); ctx.closePath();
}
function iconBtn(x, y, s, kind, fn) {
  const r = { x: x - s / 2, y: y - s / 2, w: s, h: s };
  BTN.push({ r, fn });
  ctx.strokeStyle = 'rgba(200,210,255,0.5)'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(x, y, s / 2 - 1, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(220,226,255,0.85)'; ctx.strokeStyle = ctx.fillStyle;
  const u = s * 0.14;
  if (kind === 'pause') { ctx.fillRect(x - u * 1.2, y - u * 1.6, u * 0.8, u * 3.2); ctx.fillRect(x + u * 0.4, y - u * 1.6, u * 0.8, u * 3.2); }
  else {
    ctx.beginPath(); ctx.moveTo(x - u * 2, y - u * 0.8); ctx.lineTo(x - u * 0.9, y - u * 0.8); ctx.lineTo(x + u * 0.4, y - u * 2);
    ctx.lineTo(x + u * 0.4, y + u * 2); ctx.lineTo(x - u * 0.9, y + u * 0.8); ctx.lineTo(x - u * 2, y + u * 0.8); ctx.closePath(); ctx.fill();
    ctx.lineWidth = 1.6;
    if (save.muted) { ctx.beginPath(); ctx.moveTo(x + u * 1.1, y - u); ctx.lineTo(x + u * 2.3, y + u); ctx.moveTo(x + u * 2.3, y - u); ctx.lineTo(x + u * 1.1, y + u); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(x + u * 0.6, y, u * 1.4, -0.8, 0.8); ctx.stroke(); }
  }
}
function bar(x, y, w, h, v, col, mark) {
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  roundRect(x, y, w, h, h / 2); ctx.fill();
  if (v > 0) { ctx.fillStyle = col; roundRect(x, y, Math.max(h, w * clamp(v, 0, 1)), h, h / 2); ctx.fill(); }
  if (mark != null) {
    ctx.fillStyle = 'rgba(255,90,110,0.9)';
    ctx.fillRect(x + w * mark - 1, y - 3, 2, h + 6);
  }
}

function drawHUD() {
  const r = run, fs = clamp(Math.min(W, H) * 0.032, 12, 18), pad = 16;
  txt(fmt(r.score), pad, pad + fs * 0.9, fs * 1.9, '#f4f1ff', 'left', 700);
  txt('PHASE ' + r.phase + '  ·  ' + clock(r.t), pad, pad + fs * 2.6, fs * 0.85, '#9aa3d8', 'left', 500);
  const s = Math.max(36, fs * 2.4);
  iconBtn(W - pad - s / 2, pad + s / 2, s, 'pause', () => { AU.sfx('click'); setPaused(true); });
  iconBtn(W - pad - s * 1.6, pad + s / 2, s, 'mute', () => { AU.setMuted(!save.muted); });

  // bottom bars (bottom-left column on wide screens)
  const side = W / 2 - LAY.R - pad * 2;
  const bw = LAY.wide ? Math.min(260, side) : Math.min(W - pad * 2 - (LAY.touch ? 100 : 0), 460);
  const bx = LAY.wide || LAY.touch ? pad : (W - bw) / 2, bh = Math.max(6, fs * 0.45);
  const y1 = LAY.wide ? H - pad - fs * 4.6 : H - LAY.bottom * 0.72, y2 = LAY.wide ? H - pad - fs * 0.6 : H - LAY.bottom * 0.3;
  const c = contain(r), lose = LOSE_C, scale = 1.5; // bar shows 0..150%
  const danger = clamp((c - lose) / 0.25, 0, 1);
  const ccol = `rgb(${Math.round(lerp(255, 120, danger))},${Math.round(lerp(80, 230, danger))},${Math.round(lerp(100, 160, danger))})`;
  txt('CONTAINMENT', bx, y1 - bh - fs * 0.55, fs * 0.72, '#9aa3d8', 'left', 600);
  txt(Math.round(c * 100) + '%', bx + bw, y1 - bh - fs * 0.55, fs * 0.8, ccol, 'right', 700);
  bar(bx, y1 - bh / 2, bw, bh, c / scale, ccol, lose / scale);
  // which charge is scarce: amber and blue counts beside the label
  const lx = LAY.wide ? bx : bx + fs * 7.6, scarce = r.cp < r.cn ? 0 : 1;
  const ly = LAY.wide ? y1 - bh - fs * 1.9 : y1 - bh - fs * 0.55;
  txt('● ' + Math.round(r.cp), lx, ly, fs * 0.72, rgba(KIND[0].rgb, scarce === 0 ? 1 : 0.6), 'left', 700);
  txt('● ' + Math.round(r.cn), lx + fs * 3.6, ly, fs * 0.72, rgba(KIND[1].rgb, scarce === 1 ? 1 : 0.6), 'left', 700);
  const ecol = r.lock ? 'rgba(120,130,170,0.8)' : r.inv ? '#78e6ff' : '#5fb8ff';
  txt(r.inv ? 'INVERTED' : 'INVERT', bx, y2 - bh - fs * 0.55, fs * 0.72, r.inv ? '#78e6ff' : '#9aa3d8', 'left', 600);
  bar(bx, y2 - bh / 2, bw, bh, r.energy, ecol);

  if (LAY.touch) {
    const s2 = Math.max(64, Math.min(92, W * 0.2));
    const ib = { x: W - pad - s2, y: H - pad - s2, w: s2, h: s2 };
    LAY.invBtn = ib;
    ctx.fillStyle = r.inv ? 'rgba(120,230,255,0.25)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = r.inv ? '#78e6ff' : 'rgba(180,200,255,0.6)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ib.x + s2 / 2, ib.y + s2 / 2, s2 / 2 - 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    txt('INVERT', ib.x + s2 / 2, ib.y + s2 / 2, s2 * 0.17, r.inv ? '#bff3ff' : '#cfd6ff', 'center', 700);
  } else LAY.invBtn = null;

  if (r.banner) {
    const b = r.banner, a = Math.min(1, b.t * 2, (3.2 - b.t) * 3);
    txt(b.text, W / 2, LAY.cy - LAY.R * 0.35, fs * 2.2, '#f4f1ff', 'center', 700, clamp(a, 0, 1) * 0.9);
    if (b.sub) txt(b.sub, W / 2, LAY.cy - LAY.R * 0.35 + fs * 2, fs * 0.95, '#b9c0ee', 'center', 500, clamp(a, 0, 1) * 0.85);
  }
  if (r.pulse) txt('MAGNETIC STORM', W / 2, LAY.cy - LAY.R * 0.62, fs * 1.1, '#ff8a9a', 'center', 700, 0.5 + 0.5 * Math.abs(Math.sin(game.t * 8)));
  if (!save.tut && r.t < 12 && !r.banner) {
    const lines = LAY.touch
      ? ['Drag to move the gravity well.', 'Hold INVERT to pull the blue ones in.']
      : ['Move the mouse to steer the gravity well.', 'Hold the mouse button or Space to invert polarity.'];
    lines.push('Green crystals refill your meter and add particles.');
    lines.forEach((l, i) => txt(l, W / 2, LAY.cy + LAY.R * 0.55 + i * fs * 1.4, fs * 0.9, '#b9c0ee', 'center', 500, Math.min(1, (12 - r.t) / 2) * 0.85));
  }
}
