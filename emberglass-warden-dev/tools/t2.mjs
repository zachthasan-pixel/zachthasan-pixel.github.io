import { open } from './lib.mjs';
const { pg, errs, close } = await open({ w: 640, h: 480 });
await pg.evaluate(() => { const g = window.__ew; g.startRun(false); g.S.queue.length = 0; g.S.waveActive = false; g.G.vm.visible = false; document.getElementById('hud').style.display = 'none'; document.getElementById('hint').style.display = 'none'; g.step(1); g.S.state = 'x'; });
for (const k of ['wraith', 'stinger', 'brute', 'tyrant']) for (const v of ['front', 'side', 'top']) {
  await pg.evaluate(([k, v]) => { const g = window.__ew; while (g.enemies.length) { g.G.scene.remove(g.enemies[0].obj); g.enemies.splice(0, 1); }
    const e = g.spawnEnemy(k, 0, 0); e.obj.scale.setScalar(1); e.obj.rotation.set(0, 0, 0); e.obj.position.set(0, e.d.hover, 0); const s = e.d.size * 1.1, c = g.G.camera;
    if (v === 'front') c.position.set(0, e.d.hover, s); else if (v === 'side') c.position.set(s, e.d.hover, 0); else c.position.set(0, e.d.hover + s, 0.01);
    c.lookAt(0, e.d.hover, 0); for (const m of e.mats) m.userData.u.uGlow.value = 1; g.G.quality = 1; g.render(); }, [k, v]);
  await pg.screenshot({ path: `shots/m-${k}-${v}.png` });
}
console.log(errs); await close();
