// Smoke test: node tools/smoke.mjs  (needs builds made with --test)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const dir = path.resolve('builds/itch');
const srv = http.createServer((q, r) => { const f = path.join(dir, q.url === '/' ? 'index.html' : q.url.split('?')[0]); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200); r.end(d); } }); }).listen(8765);
const b = await chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); }); pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
await pg.goto('http://localhost:8765/'); await pg.waitForFunction(() => window.__ew && window.__ew.S.state === 'menu', null, { timeout: 60000 });
await pg.screenshot({ path: 'tools/shot-menu.png' });
const r = await pg.evaluate(() => { const g = window.__ew; g.startRun(false); g.G.quality = 1; g.step(400); const out = { state: g.S.state, wave: g.S.wave, enemies: g.enemies.length, models: Object.keys(g.G.models) };
  // bot: face nearest enemy and attack for 60s of game time
  for (let i = 0; i < 7200 && g.S.state !== 'over'; i++) { if (g.S.state === 'upgrade') g.pickUpgrade(0); const e = g.enemies.find((q) => !q.dead); if (e) { g.p.yaw = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.keys.KeyW = Math.hypot(e.x - g.p.x, e.z - g.p.z) > 2.5; if (i % 50 === 0) g.inp.atkPressed = true; g.inp.block = e.state === 'windup'; } g.step(1); }
  out.after = { state: g.S.state, wave: g.S.wave, kills: g.S.kills, hp: Math.round(g.p.hp), score: Math.floor(g.S.score) }; g.render(); return out; });
await pg.screenshot({ path: 'tools/shot-play.png' });
console.log(JSON.stringify(r)); console.log('errors:', errs.length, errs.slice(0, 5));
await b.close(); srv.close();
