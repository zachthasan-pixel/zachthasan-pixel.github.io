import { open } from './lib.mjs';
const { pg, errs, close } = await open();
for (const kind of ['wraith', 'stinger', 'brute', 'tyrant']) {
  await pg.evaluate((kind) => { const g = window.__ew; if (g.S.state !== 'playing') { g.startRun(false); } g.S.queue.length = 0; g.S.waveActive = false; g.S.betweenT = 0; while (g.enemies.length) { const e = g.enemies[0]; g.G.scene.remove(e.obj); g.enemies.splice(0, 1); }
    g.p.x = 0; g.p.z = 9; g.p.yaw = 0; g.p.pitch = 0; const d = kind === 'tyrant' ? 8 : kind === 'brute' ? 5.5 : 4; const e = g.spawnEnemy(kind, 0, 9 - d); e.state = 'recover'; e.t = -999; e.cd = 999; const e2 = g.spawnEnemy(kind, -d * 0.6, 9 - d); e2.state = 'recover'; e2.t = -999; e2.yaw = Math.PI / 2; e2.stagger = 0; g.step(1); e2.obj.rotation.y = Math.PI / 2; e.obj.rotation.y = 0; g.G.quality = 2; g.render(); }, kind);
  await pg.screenshot({ path: 'shots/face-' + kind + '.png' });
}
console.log(errs); await close();
