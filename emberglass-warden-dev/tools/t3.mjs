// Gameplay screenshot sequence with a simple bot.
import { open } from './lib.mjs';
const { pg, errs, close } = await open();
const shot = async (n) => { await pg.evaluate(() => { const g = window.__ew; g.G.quality = 2; g.render(); }); await pg.screenshot({ path: 'shots/g-' + n + '.png' }); };
await shot('menu');
await pg.evaluate(() => { const g = window.__ew; g.startRun(false); g.step(120); }); await shot('start');
// bot helper: run n steps
const bot = (n, opts = {}) => pg.evaluate(([n, opts]) => { const g = window.__ew; let stop = null;
  for (let i = 0; i < n; i++) { if (g.S.state === 'upgrade') { if (opts.stopUpg) { stop = 'upg'; break; } g.pickUpgrade(0); } if (g.S.state !== 'playing') { stop = g.S.state; break; }
    const e = g.enemies.filter((q) => !q.dead).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
    if (e) { const d = Math.hypot(e.x - g.p.x, e.z - g.p.z); g.p.yaw = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.p.pitch = Math.atan2(e.y - 1.65, d) * 0.8; g.keys.KeyW = d > 2.6; if (i % 45 === 0 && d < 4.5) g.inp.atkPressed = true; g.inp.block = opts.block && (e.state === 'windup' || e.state === 'lunge' || e.state === 'sweepW'); if (opts.god) g.p.hp = g.p.maxHp; }
    if (opts.until && opts.until === 'swing' && g.p.swing && g.p.swing.t / g.p.swing.dur > 0.4 && g.enemies.some((q) => q.hitT > 0.1)) { stop = 'swing'; break; }
    g.step(1); }
  return { stop, state: g.S.state, wave: g.S.wave, hp: Math.round(g.p.hp), kills: g.S.kills, t: Math.round(g.S.t) }; }, [n, opts]);
console.log(await bot(360)); await shot('w1-a');
console.log(await bot(2000, { until: 'swing', god: true })); await shot('w1-hit');
console.log(await bot(6000, { stopUpg: true, god: true })); await shot('upgrade');
console.log(await bot(9000, { god: true, block: true, until: 'swing' })); await shot('w2-hit');
await pg.evaluate(() => { const g = window.__ew; g.inp.block = true; g.step(30); }); await shot('block');
await pg.evaluate(() => { const g = window.__ew; g.inp.block = false; g.inp.atk = true; g.step(110); }); await shot('charge');
await pg.evaluate(() => { const g = window.__ew; g.inp.atk = false; g.inp.atkReleased = true; g.step(28); }); await shot('heavy');
await pg.evaluate(() => { const g = window.__ew; g.p.burst = 100; g.step(2); g.doBurst(false); g.step(14); }); await shot('burst');
await pg.evaluate(() => { window.__ew.pause(); }); await shot('pause');
await pg.evaluate(() => { window.__ew.resume(); });
// jump to boss
await pg.evaluate(() => { const g = window.__ew; g.S.queue.length = 0; for (const e of g.enemies) if (!e.dead) g.damageEnemy(e, 9999, { pierce: true }); g.S.wave = 4; g.step(400); if (g.S.state === 'upgrade') g.pickUpgrade(0); g.step(500); g.p.hp = g.p.maxHp; }); await shot('boss');
console.log(await bot(1200, { god: true, block: true })); await shot('boss2');
await pg.evaluate(() => { const g = window.__ew; g.p.hp = 1; g.p.inv = 0; g.gameOver(); g.step(60); }); await shot('over');
console.log(errs); await close();
