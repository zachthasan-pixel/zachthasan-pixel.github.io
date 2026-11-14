import { open } from './lib.mjs';
const { pg, errs, close } = await open();
await pg.evaluate(() => { const g = window.__ew; g.startRun(false); g.jumpWave(9); g.S.queue = ['shade', 'mortar', 'shade']; g.p.x = 0; g.p.z = 10;
  for (let i = 0; i < 2400; i++) { g.p.hp = g.p.maxHp; const es = g.enemies.filter((q) => !q.dead); if (es.length) { const cx = es.reduce((s, e) => s + e.x, 0) / es.length, cz = es.reduce((s, e) => s + e.z, 0) / es.length; g.p.yaw = Math.atan2(-(cx - g.p.x), -(cz - g.p.z)); g.p.pitch = 0.05; } g.step(1); if (es.length === 3 && g.shots.length >= 3 && i > 600) break; }
  g.G.quality = 2; g.render(); });
await pg.screenshot({ path: 'shots/variants.png' }); console.log(errs); await close();
