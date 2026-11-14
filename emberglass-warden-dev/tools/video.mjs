// Renders a preview video frame by frame. node tools/video.mjs land|port [frames]
import { open } from './lib.mjs';
import { execSync } from 'node:child_process'; import fs from 'node:fs';
const mode = process.argv[2] || 'land', W = mode === 'land' ? 1280 : 720, H = mode === 'land' ? 720 : 1080, FPS = 30, N = +(process.argv[3] || 510);
const dir = 'video-frames/' + mode; fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
const t = await open({ w: W, h: H }); const pg = t.pg;
await pg.addStyleTag({ content: '#hint{display:none!important}#banner{display:none!important}' });
await pg.evaluate(() => { const g = window.__ew; g.save.tut = { move: 1, slash: 1, heavy: 1, dash: 1, parry: 1, deflect: 1, burst: 1, armor: 1 }; g.startRun(false); g.S.up.edge = 2; g.S.up.chain = 1; g.S.up.swift = 1; g.G.quality = 2;
  const ad = (a, b) => { let d = (a - b) % 6.2832; if (d > 3.1416) d -= 6.2832; if (d < -3.1416) d += 6.2832; return d; };
  let k = 0, tgt = null;
  window.vstep = (n) => { for (let i = 0; i < n; i++, k++) { g.p.hp = g.p.maxHp; if (g.S.state === 'upgrade') g.pickUpgrade(0);
    const live = g.enemies.filter((q) => !q.dead && q.state !== 'spawn'); if (!tgt || tgt.dead || k % 90 === 0) tgt = live.sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0] || null;
    const s = g.shots.find((q) => !q.friendly && Math.hypot(q.x - g.p.x, q.z - g.p.z) < 5); const e = tgt;
    if (e) { const d = Math.hypot(e.x - g.p.x, e.z - g.p.z), want = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.p.yaw += ad(want, g.p.yaw) * 0.07; g.p.pitch += (Math.atan2(e.y - 1.65, d) * 0.75 - g.p.pitch) * 0.05;
      const far = e.d.boss ? 6.5 : 3.0; g.keys.KeyW = d > far; g.keys.KeyS = d < far - 1.4; g.keys.KeyD = (k % 400) < 120 && d < 8; const aimed = Math.abs(ad(want, g.p.yaw)) < 0.5;
      g.inp.block = ['windup', 'sweepW', 'lunge'].includes(e.state) && d < 7 && e.t > (e.d.boss ? 0.5 : 0.28);
      if (!g.inp.block && aimed && d < (e.d.boss ? 7 : 4.6) && k % 38 === 0) g.inp.atkPressed = true;
      if (s && k % 20 === 0) g.inp.atkPressed = true; if (e.state === 'charge' && d < 9) g.inp.dash = true; }
    else { g.keys.KeyW = false; g.keys.KeyD = false; }
    g.step(1); } };
  g.jumpWave(3); window.vstep(150); });
for (let f = 0; f < N; f++) {
  if (f === 170) await pg.evaluate(() => { const g = window.__ew; g.jumpWave(8); g.p.burst = 60; });
  if (f === 250) await pg.evaluate(() => { const g = window.__ew; g.p.burst = 100; g.inp.burst = true; });
  if (f === 330) await pg.evaluate(() => { const g = window.__ew; g.jumpWave(5); g.p.x = 0; g.p.z = 14; g.p.yaw = 0; });
  await pg.evaluate(() => { window.vstep(4); window.__ew.render(); });
  await pg.screenshot({ path: `${dir}/f${String(f).padStart(4, '0')}.jpg`, quality: 92, type: 'jpeg' });
  if (mode === 'land' && [60, 150, 256, 300, 400, 470].includes(f)) await pg.screenshot({ path: `store-art/screenshot-${[60, 150, 256, 300, 400, 470].indexOf(f) + 1}-1280x720.png` });
  if (f % 30 === 0) console.log(mode, f, new Date().toISOString().slice(11, 19));
}
console.log('errs', t.errs.length); await t.close();
const [ow, oh, cover] = mode === 'land' ? [1920, 1080, 'store-art/cover-landscape-1920x1080.png'] : [1080, 1620, 'store-art/cover-portrait-800x1200.png'];
const outf = `store-art/preview-${mode === 'land' ? 'landscape' : 'portrait'}-${ow}x${oh}.mp4`;
execSync(`ffmpeg -y -loglevel error -loop 1 -t 1 -framerate ${FPS} -i ${cover} -framerate ${FPS} -i ${dir}/f%04d.jpg -filter_complex "[0:v]scale=${ow}:${oh}:flags=lanczos,setsar=1,fps=${FPS}[a];[1:v]scale=${ow}:${oh}:flags=lanczos,setsar=1[b];[a][b]concat=n=2:v=1:a=0[v]" -map "[v]" -an -c:v libx264 -pix_fmt yuv420p -crf 20 -movflags +faststart ${outf}`);
console.log(outf, (fs.statSync(outf).size / 1048576).toFixed(1) + ' MB');
