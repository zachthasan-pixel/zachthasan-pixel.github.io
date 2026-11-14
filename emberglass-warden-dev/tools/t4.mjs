import { open } from './lib.mjs';
import { execSync } from 'node:child_process';
const { pg, errs, close } = await open();
const files = [];
const shot = async (n) => { await pg.evaluate(() => { const g = window.__ew; g.G.quality = 2; g.render(); }); await pg.screenshot({ path: 'shots/s-' + n + '.png' }); files.push('shots/s-' + n + '.png'); };
const ev = (fn, a) => pg.evaluate(fn, a);
await ev(() => { const g = window.__ew; g.startRun(false); g.step(60); });
// face nearest helper inside page
await ev(() => { window.face = () => { const g = window.__ew; const e = g.enemies.filter((q) => !q.dead).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0]; if (e) { const d = Math.hypot(e.x - g.p.x, e.z - g.p.z); g.p.yaw = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.p.pitch = Math.atan2(e.y - 1.65, d) * 0.7; } return e; };
  window.run = (n, f) => { const g = window.__ew; for (let i = 0; i < n; i++) { g.p.hp = g.p.maxHp; const e = window.face(); if (f && f(e, i)) return i; g.step(1); } return n; }; });
// wraith about to lunge
await ev(() => window.run(2000, (e) => e && e.state === 'windup' && e.t > 0.3)); await shot('wraith-windup');
await ev(() => { const g = window.__ew; window.run(600, (e, i) => { if (i % 40 === 0) g.inp.atkPressed = true; g.keys.KeyW = e && Math.hypot(e.x - g.p.x, e.z - g.p.z) > 2.6; return g.p.swing && g.p.swing.t / g.p.swing.dur > 0.42 && g.enemies.some((q) => q.hitT > 0.15); }); }); await shot('hit');
await ev(() => { const g = window.__ew; g.step(4); }); await shot('hit+4');
await ev(() => { const g = window.__ew; g.keys.KeyW = false; g.jumpWave(3); window.run(3000, (e) => g.shots.length && Math.hypot(g.shots[0].x - g.p.x, g.shots[0].z - g.p.z) < 6); }); await shot('spore');
await ev(() => { const g = window.__ew; g.jumpWave(4); g.S.queue = ['brute']; window.run(3000, (e) => e && e.kind === 'brute' && e.state === 'windup' && e.t > 0.6); }); await shot('brute');
await ev(() => { const g = window.__ew; g.jumpWave(5); window.run(3000, (e) => e && e.d.boss && e.state !== 'spawn' && Math.hypot(e.x - g.p.x, e.z - g.p.z) < 11); }); await shot('boss-far');
await ev(() => { const g = window.__ew; window.run(3000, (e) => e && e.state === 'sweepW' && e.t > 0.5); }); await shot('boss-sweep');
await ev(() => { const g = window.__ew; g.p.x = 20; g.p.z = 0; window.run(3000, (e) => g.shots.length > 3 && Math.hypot(g.shots[0].x - g.p.x, g.shots[0].z - g.p.z) < 9); }); await shot('boss-volley');
execSync('montage ' + files.join(' ') + ' -tile 2x4 -geometry 800x450+2+2 shots/sheet3.png');
console.log(errs); await close();
