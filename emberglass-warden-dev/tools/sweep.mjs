import { open } from './lib.mjs';
import { execSync } from 'node:child_process';
const sizes = [[907, 510], [1216, 684], [1077, 606], [821, 462], [1366, 768], [1920, 1080], [1536, 864], [1280, 720], [640, 360], [836, 470], [1031, 580], [800, 450, 'm'], [1080, 607, 'm'], [844, 390, 'm'], [390, 844, 'm']];
const only = process.argv[2];
for (const [w, h, m] of sizes) {
  if (only && only !== w + 'x' + h) continue;
  const t = await open({ w, h, ctx: m ? { hasTouch: true, isMobile: true } : {} }); const tag = w + 'x' + h + (m ? 'm' : '');
  const shot = async (n) => { await t.pg.evaluate(() => { const g = window.__ew; g.G.quality = 1; g.render(); }); await t.pg.screenshot({ path: `shots/v-${tag}-${n}.png` }); };
  await shot('menu');
  await t.pg.evaluate(() => { const g = window.__ew; g.startRun(false); g.jumpWave(5); for (let i = 0; i < 700; i++) { g.p.hp = g.p.maxHp; const e = g.enemies[0]; if (e) { g.p.yaw = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.p.pitch = 0.12; } g.step(1); } g.S.combo = 7; g.S.score = 123456; g.S.runShards = 88; g.p.burst = 100; g.step(1); });
  await shot('play');
  await t.pg.evaluate(() => { const g = window.__ew; g.jumpWave(2); g.S.queue.length = 0; g.step(400); }); await shot('upg');
  await t.pg.evaluate(() => { const g = window.__ew; g.pickUpgrade(0); g.step(5); g.pause(); }); await shot('pause');
  await t.pg.evaluate(() => { const g = window.__ew; g.resume(); g.gameOver(); }); await shot('over');
  await t.pg.evaluate(() => { const g = window.__ew; g.toMenu(); document.getElementById('armBtn').click(); }); await shot('arm');
  const touch = await t.pg.evaluate(() => window.__ew.S.touch);
  console.log(tag, 'touch:', touch, 'errs:', t.errs.length);
  await t.close();
}
