// ---------------------------------------------------------------------------
// Screens, input, main loop, boot.
// ---------------------------------------------------------------------------
const ptr = { x: -1, y: -1, touch: false, down: false };

function drawTitle() {
  const fs = clamp(Math.min(W, H) * 0.032, 12, 18), cx = W / 2;
  ctx.fillStyle = 'rgba(4,5,12,0.45)'; ctx.fillRect(0, 0, W, H);
  const ty = Math.max(fs * 3.5, LAY.cy - LAY.R * 0.55);
  const big = Math.min(fs * 3.4, W / 10);
  txt('MAGNETIC CHAOS', cx, ty, big, '#f4f1ff', 'center', 800);
  txt('KEEP  THE  SPHERE', cx, ty + big * 0.95, big * 0.36, '#ffd59a', 'center', 600);
  const bw = Math.min(280, W - 48), bh = Math.max(48, fs * 3);
  let y = LAY.cy - bh / 2 + LAY.R * 0.05;
  button({ x: cx - bw / 2, y, w: bw, h: bh }, 'PLAY', () => { AU.sfx('click'); startRun(); }, { size: bh * 0.4 });
  y += bh + fs * 1.6;
  if (save.best > 0) {
    txt('BEST  ' + fmt(save.best) + '   ·   PHASE ' + save.bestPhase + '   ·   ' + clock(save.bestTime), cx, y, fs * 0.9, '#9aa3d8', 'center', 600);
    y += fs * 1.8;
  }
  const how = LAY.touch
    ? ['Drag to steer the gravity well.', 'Amber is pulled in. Blue is pushed away.', 'Hold INVERT to swap them.', 'Don’t let the sphere empty.']
    : ['Move the mouse to steer the gravity well.', 'Amber is pulled in. Blue is pushed away.', 'Hold the mouse or Space to swap them.', 'Don’t let the sphere empty.'];
  how.forEach((l, i) => txt(l, cx, y + i * fs * 1.35, fs * 0.9, '#b9c0ee', 'center', 500, 0.9));
  const s = Math.max(36, fs * 2.4);
  iconBtn(W - 16 - s / 2, 16 + s / 2, s, 'mute', () => { AU.setMuted(!save.muted); });
  txt('© 2026 Dr. Zahir Hasan', cx, H - fs * 1.2, fs * 0.7, '#5d6496', 'center', 500);
}

function drawPause() {
  const fs = clamp(Math.min(W, H) * 0.032, 12, 18), cx = W / 2;
  ctx.fillStyle = 'rgba(4,5,12,0.6)'; ctx.fillRect(0, 0, W, H);
  txt('PAUSED', cx, H * 0.38, fs * 2.4, '#f4f1ff', 'center', 700);
  const bw = Math.min(260, W - 48), bh = Math.max(46, fs * 2.8);
  button({ x: cx - bw / 2, y: H * 0.48, w: bw, h: bh }, 'RESUME', () => { AU.sfx('click'); setPaused(false); }, { size: bh * 0.38 });
  button({ x: cx - bw / 2, y: H * 0.48 + bh + 12, w: bw, h: bh * 0.85 }, 'QUIT TO MENU', () => {
    AU.sfx('click'); game.paused = false; Portal.gameplayStop(); newRun(true);
  }, { col: '#9aa3d8', size: bh * 0.3 });
}

function drawDead() {
  const r = run, fs = clamp(Math.min(W, H) * 0.032, 12, 18), cx = W / 2;
  ctx.fillStyle = 'rgba(4,5,12,0.62)'; ctx.fillRect(0, 0, W, H);
  let y = Math.max(fs * 2.5, H * 0.16);
  txt('CONTAINMENT LOST', cx, y, Math.min(fs * 2.2, W / 11), '#ff8a9a', 'center', 800);
  y += fs * 1.9;
  const why = r.cn <= r.cp ? 'Too few blue particles were left inside.' : 'Too few amber particles were left inside.';
  txt(why, cx, y, fs * 0.9, '#d6b6c0', 'center', 500);
  y += fs * 3;
  txt(fmt(r.score), cx, y, fs * 3, '#f4f1ff', 'center', 800);
  y += fs * 2.4;
  txt(r.record ? 'NEW BEST!' : 'BEST  ' + fmt(save.best), cx, y, fs * 1, r.record ? '#ffd59a' : '#9aa3d8', 'center', 700);
  y += fs * 2;
  const stats = 'Phase ' + r.phase + '  ·  ' + clock(r.t) + '  ·  ' + r.collected + ' crystals  ·  ' + r.lost + ' escaped';
  txt(stats, cx, y, Math.min(fs * 0.85, (W - 32) / (stats.length * 0.52)), '#b9c0ee', 'center', 500);
  y += fs * 1.6;
  const tip = wrap(deathTip(), Math.min(W - 40, 560), fs * 0.85, 500);
  tip.forEach((l, i) => txt(l, cx, y + i * fs * 1.2, fs * 0.85, '#7fd7ff', 'center', 500));
  y += fs * (1.2 * tip.length + 1.4);
  const bw = Math.min(300, W - 40), bh = Math.max(46, fs * 2.8);
  const canRevive = Portal.hasRewarded && !r.revived;
  let yb = Math.min(y, H - bh * (canRevive ? 3.1 : 2.1) - 24);
  if (canRevive) {
    if (r.reviveFailed) txt('No video available right now. Sorry!', cx, yb - fs * 0.7, fs * 0.85, '#ff8fa3', 'center', 500);
    button({ x: cx - bw / 2, y: yb, w: bw, h: bh * 0.9 }, 'REVIVE: WATCH AD', () => {
      AU.sfx('click');
      const rr0 = run;
      Portal.rewarded(ok => { if (run !== rr0 || game.state !== 'dead' || !rr0.dead) return; if (ok) revive(); else rr0.reviveFailed = true; });
    }, { col: '#78e6ff', size: bh * 0.32 });
    yb += bh * 0.9 + 12;
  }
  button({ x: cx - bw / 2, y: yb, w: bw, h: bh }, 'RUN AGAIN', () => { AU.sfx('click'); startRun(); }, { size: bh * 0.38 });
  button({ x: cx - bw / 2, y: yb + bh + 12, w: bw, h: bh * 0.8 }, 'MENU', () => { AU.sfx('click'); newRun(true); }, { col: '#9aa3d8', size: bh * 0.3 });
}
function deathTip() {
  const r = run;
  if (r._tip) return r._tip;
  const tips = [
    'Blue particles flee the well. Park it between them and the rim to herd them home.',
    'Inverting pulls the blue ones in but flings the amber ones out. Keep it short.',
    'When the storm ring closes in, gather everything near the centre.',
    'Green crystals refill your invert meter and add a dozen particles.',
    'New particles stream in at the rim from phase 2. Catch them early.',
  ];
  r._tip = r.phase >= 2 && rand() < 0.5 ? tips[2 + Math.floor(rand() * 3)] : tips[Math.floor(rand() * tips.length)];
  return r._tip;
}

// Runs start here so portals get a natural ad break between runs.
let sessionRuns = 0, starting = false;
function startRun() {
  if (starting) return;
  starting = true;
  const go = () => { starting = false; newRun(false); tctx.fillStyle = '#04050c'; tctx.fillRect(0, 0, W, H); Portal.gameplayStart(); };
  if (sessionRuns++ > 0) Portal.midgame(go); else go();
}
function setPaused(p) {
  if (!run || run.dead || game.state !== 'play') { game.paused = false; return; }
  if (game.paused === p) return;
  game.paused = p;
  input.hold = input.keyHold = input.ptrHold = input.padHold = false;
  if (p) Portal.gameplayStop(); else Portal.gameplayStart();
}

// ----------------------------------------------------------------- input ---
let steerId = null, padId = null;
function setPtr(e) {
  const b = cvs.getBoundingClientRect();
  ptr.x = e.clientX - b.left; ptr.y = e.clientY - b.top;
  ptr.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
  if (ptr.touch) LAY.touch = true; else if (e.pointerType === 'mouse') LAY.touch = false;
}
function steer(x, y, touch) {
  if (!run || run.demo) return;
  const off = touch ? -Math.min(44, LAY.R * 0.12) : 0; // keep the well above the finger
  run.well.tx = (x - LAY.cx) / LAY.R;
  run.well.ty = (y + off - LAY.cy) / LAY.R;
}
const syncHold = () => { input.hold = input.keyHold || input.ptrHold || input.padHold; };
cvs.addEventListener('pointerdown', e => {
  if (Portal.adActive || Portal.pending) return;
  setPtr(e); ptr.down = true; AU.init();
  try { cvs.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  for (const b of BTN) if (inRect(ptr.x, ptr.y, b.r)) { b.fn(); return; }
  if (game.state !== 'play' || !run || run.dead) return;
  if (game.paused) { setPaused(false); return; }
  if (ptr.touch) {
    if (LAY.invBtn && inRect(ptr.x, ptr.y, LAY.invBtn)) { padId = e.pointerId; input.padHold = true; syncHold(); return; }
    steerId = e.pointerId; steer(ptr.x, ptr.y, true);
  } else if (e.button === 0 || e.button === 2) { input.ptrHold = true; syncHold(); steer(ptr.x, ptr.y, false); }
});
cvs.addEventListener('pointermove', e => {
  setPtr(e);
  if (game.state !== 'play' || game.paused) return;
  if (ptr.touch) { if (e.pointerId === steerId) steer(ptr.x, ptr.y, true); }
  else steer(ptr.x, ptr.y, false);
});
function ptrEnd(e) {
  if (e.pointerId === padId) { padId = null; input.padHold = false; }
  if (e.pointerId === steerId) steerId = null;
  if (e.pointerType === 'mouse') input.ptrHold = false;
  ptr.down = false; syncHold();
}
cvs.addEventListener('pointerup', ptrEnd);
cvs.addEventListener('pointercancel', ptrEnd);
cvs.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('keydown', e => {
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  if (Portal.adActive || Portal.pending) return;
  AU.init();
  const k = e.key.toLowerCase();
  if (k === 'm') { AU.setMuted(!save.muted); return; }
  if (game.state === 'title' && (k === 'enter' || k === ' ')) { startRun(); return; }
  if (game.state === 'dead' && (k === 'enter' || k === 'r')) { startRun(); return; }
  if (game.state !== 'play' || !run || run.dead) return;
  if (k === 'escape' || k === 'p') { setPaused(!game.paused); return; }
  if (k === ' ' || k === 'shift') { if (!game.paused) { input.keyHold = true; syncHold(); } }
});
window.addEventListener('keyup', e => {
  const k = e.key.toLowerCase();
  if (k === ' ' || k === 'shift') { input.keyHold = false; syncHold(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
window.addEventListener('blur', () => { input.keyHold = input.ptrHold = input.padHold = false; syncHold(); });
window.addEventListener('resize', resize);
window.addEventListener('wheel', e => e.preventDefault(), { passive: false });

// ------------------------------------------------------------------ loop ---
const STEP = 1 / 60;
let lastT = 0, acc = 0;
function update(dt) {
  game.t += dt;
  const frozen = Portal.adActive || (game.state === 'play' && game.paused);
  if (frozen) return;
  acc += dt;
  let n = 0;
  while (acc >= STEP && n < 3) { step(STEP); acc -= STEP; n++; }
  if (n === 3) acc = 0;
}
function render() {
  BTN.length = 0;
  drawScene();
  if (game.state === 'title') drawTitle();
  else if (game.state === 'play') { drawHUD(); if (game.paused) drawPause(); }
  else if (game.state === 'dead') drawDead();
  else if (game.state === 'cover') drawCover();
  cvs.style.cursor = BTN.some(b => inRect(ptr.x, ptr.y, b.r)) ? 'pointer' : game.state === 'play' && !game.paused ? 'none' : 'default';
}
// #cover renders a clean title card for store art.
function drawCover() {
  const fs = Math.min(W, H) * 0.05;
  txt('MAGNETIC CHAOS', W / 2, H * 0.14, Math.min(fs * 1.6, W / 9), '#f4f1ff', 'center', 800);
  txt('KEEP  THE  SPHERE', W / 2, H * 0.14 + fs * 1.5, fs * 0.6, '#ffd59a', 'center', 600);
}
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  try { update(dt); render(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function boot() {
  loadSave();
  LAY.touch = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  resize();
  newRun(true);
  if (location.hash === '#cover') game.state = 'cover';
  requestAnimationFrame(frame);
}
// Test/screenshot hook (no effect on normal play).
window.__mc = { game, P, input, TUNE, get run() { return run; }, newRun, step, startRun, revive, save, LAY };
const wait = ms => new Promise(r => setTimeout(r, ms));
Promise.race([Portal.init(), wait(3000)]).catch(() => {}).then(() => { Portal.loadingStart(); }).then(() => { boot(); Portal.loadingStop(); });
