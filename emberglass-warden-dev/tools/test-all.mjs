// Phase 3 reviewer tests. Run: node tools/build.mjs --test && node tools/test-all.mjs
import { open } from './lib.mjs';
import fs from 'node:fs'; import path from 'node:path';
const R = []; const ok = (name, pass, info = '') => { R.push({ name, pass, info }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };
const BOT = `window.bot = (n, o = {}) => { const g = window.__ew; let i = 0; for (; i < n; i++) { if (g.S.state === 'upgrade') g.pickUpgrade(i % 3); if (g.S.state !== 'playing') break;
  const e = g.enemies.filter((q) => !q.dead).sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
  if (e) { const d = Math.hypot(e.x - g.p.x, e.z - g.p.z); g.p.yaw = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.keys.KeyW = d > 2.8; g.keys.KeyA = (i % 600) < 200; if (i % 42 === 0 && d < 5) g.inp.atkPressed = true; g.inp.block = ['windup', 'lunge', 'sweepW', 'charge'].includes(e.state) && d < 7; if (i % 300 === 299) g.inp.dash = true; if (g.p.burst >= 100) g.inp.burst = true; }
  if (o.god && g.p.hp < 60) g.p.hp = g.p.maxHp; g.step(1); } return { steps: i, state: g.S.state, wave: g.S.wave, kills: g.S.kills, hp: Math.round(g.p.hp), score: Math.floor(g.S.score) }; };`;
const sdkMock = (plat) => async (pg) => {
  await pg.addInitScript(() => { window.__log = []; });
  await pg.route('**/crazygames-sdk-v3.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.CrazyGames={SDK:{environment:'crazygames',init:async()=>{__log.push('init')},getSystemInfo:()=>({device:{type:'desktop'}}),game:{settings:{muteAudio:false},addSettingsChangeListener:(f)=>{window.__cgMute=f;__log.push('listener')},loadingStart:()=>__log.push('loadingStart'),loadingStop:()=>__log.push('loadingStop'),gameplayStart:()=>__log.push('gameplayStart'),gameplayStop:()=>__log.push('gameplayStop'),happytime:()=>__log.push('happytime')}}};` }));
  await pg.route('**/poki-sdk.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `window.PokiSDK={init:()=>{__log.push('init');return Promise.resolve()},gameLoadingFinished:()=>__log.push('gameLoadingFinished'),gameplayStart:()=>__log.push('gameplayStart'),gameplayStop:()=>__log.push('gameplayStop'),commercialBreak:(b)=>{__log.push('commercialBreak');b&&b();return new Promise(r=>setTimeout(()=>{__log.push('breakDone');r()},50))},rewardedBreak:()=>Promise.resolve(false)};` }));
};
function checkOrder(log) { // no two starts/stops in a row; nothing between commercialBreak and breakDone
  let last = null, inAd = false; const bad = [];
  for (const e of log) { if (e === 'commercialBreak') inAd = true; else if (e === 'breakDone') inAd = false; else if (inAd && e.startsWith('gameplay')) bad.push('event during ad: ' + e);
    if (e === 'gameplayStart' || e === 'gameplayStop') { if (e === last) bad.push('double ' + e); last = e; } }
  return bad;
}

for (const build of ['itch', 'crazygames', 'poki']) {
  const t = await open({ build, route: sdkMock(build) }); const { pg } = t; await pg.evaluate(BOT);
  const ext = t.reqs.filter((u) => !u.startsWith('http://localhost') && !u.startsWith('data:') && !u.startsWith('blob:'));
  const allowed = build === 'itch' ? [] : build === 'crazygames' ? ['https://sdk.crazygames.com/crazygames-sdk-v3.js'] : ['https://game-cdn.poki.com/scripts/v2/poki-sdk.js'];
  ok(build + ': no unexpected external requests', ext.every((u) => allowed.includes(u)), ext.join(' '));
  await pg.evaluate(() => { window.__ew.startRun(false); });
  let r = await pg.evaluate(() => window.bot(36000, { god: true })); // 5 minutes of game time
  ok(build + ': survives 5 min scripted play', r.steps === 36000 && r.state !== 'loading', JSON.stringify(r));
  await pg.evaluate(() => { const g = window.__ew; g.pause(); }); ok(build + ': pause', await pg.evaluate(() => window.__ew.S.state === 'paused' && !document.getElementById('pause').classList.contains('hidden')));
  const t0 = await pg.evaluate(() => { const g = window.__ew; const a = g.S.t; g.manual = false; return a; }); await pg.waitForTimeout(700);
  ok(build + ': paused game does not advance', await pg.evaluate((a) => { window.__ew.manual = true; return window.__ew.S.t === a; }, t0));
  await pg.evaluate(() => window.__ew.resume()); ok(build + ': resume', await pg.evaluate(() => window.__ew.S.state === 'playing'));
  await pg.evaluate(() => window.__ew.toggleMute()); ok(build + ': mute toggle', await pg.evaluate(() => window.__ew.isMuted() && window.__ew.save.mute)); await pg.evaluate(() => window.__ew.toggleMute());
  await pg.evaluate(() => { const g = window.__ew; g.p.hp = 1; g.p.inv = 0; g.S.up.wind = 0; g.gameOver(); });
  ok(build + ': game over screen', await pg.evaluate(() => window.__ew.S.state === 'over' && !document.getElementById('over').classList.contains('hidden')));
  await pg.evaluate(() => window.__ew.againRun()); await pg.waitForTimeout(300);
  ok(build + ': restart works', await pg.evaluate(() => window.__ew.S.state === 'playing' && window.__ew.S.wave === 1 && window.__ew.p.hp === window.__ew.p.maxHp));
  r = await pg.evaluate(() => window.bot(1200, { god: true }));
  await pg.evaluate(() => { const g = window.__ew; g.p.hp = 1; g.p.inv = 0; g.gameOver(); });
  const saved = await pg.evaluate(() => JSON.parse(localStorage.getItem('emberglass_warden_v1')));
  await pg.reload(); await pg.waitForFunction(() => window.__ew && window.__ew.S.state === 'menu', null, { timeout: 90000 });
  const after = await pg.evaluate(() => window.__ew.save);
  ok(build + ': save survives reload', saved && after.shards === saved.shards && after.best === saved.best && after.best >= 1, 'best ' + after.best + ' shards ' + after.shards);
  const log = await pg.evaluate(() => window.__log || []);
  if (build !== 'itch') {
    const full = await (async () => { // collect a full-session log in a fresh page
      const t2 = await open({ build, route: sdkMock(build) }); await t2.pg.evaluate(BOT);
      await t2.pg.evaluate(() => { const g = window.__ew; g.startRun(false); window.bot(3000, { god: true }); g.pause(); g.resume(); window.bot(600, { god: true }); g.p.hp = 1; g.p.inv = 0; g.gameOver(); g.againRun(); });
      await t2.pg.waitForTimeout(400); await t2.pg.evaluate(() => { window.bot(300, { god: true }); window.__ew.pause(); });
      const l = await t2.pg.evaluate(() => window.__log); const e = t2.errs.slice(); await t2.close(); return { l, e };
    })();
    const bad = checkOrder(full.l); const L = full.l.join(',');
    ok(build + ': SDK event order', bad.length === 0 && (build === 'crazygames' ? L.startsWith('init,listener,loadingStart,loadingStop,gameplayStart') || L.startsWith('init,loadingStart') : L.startsWith('init,gameLoadingFinished,gameplayStart')) , L.slice(0, 400) + (bad.length ? ' BAD: ' + bad.join(';') : ''));
    if (build === 'poki') ok('poki: commercialBreak before restart', /gameplayStop,commercialBreak,breakDone,gameplayStart/.test(L));
    if (build === 'crazygames') { const m = await pg.evaluate(() => { window.__cgMute && window.__cgMute({ muteAudio: true }); return typeof window.__cgMute; }); ok('crazygames: mute setting listener registered', m === 'function'); }
  }
  ok(build + ': zero console errors', t.errs.length === 0, t.errs.slice(0, 3).join(' | '));
  await t.close();
}
// localStorage blocked
{ const t = await open({ init: () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); } }); await t.pg.evaluate(BOT);
  const r = await t.pg.evaluate(() => { window.__ew.startRun(false); const a = window.bot(1500, { god: true }); const g = window.__ew; g.p.hp = 1; g.p.inv = 0; g.gameOver(); return [a, g.S.state]; });
  ok('runs with localStorage blocked', r[1] === 'over' && t.errs.length === 0, JSON.stringify(r[0]) + ' ' + t.errs.slice(0, 2).join('|')); await t.close(); }
// refresh-rate consistency: drive tick() with fake timestamps
{ const t = await open(); const out = {};
  for (const hz of [60, 144, 165]) out[hz] = await t.pg.evaluate((hz) => { const g = window.__ew; g.toMenu(); g.startRun(false); g.S.queue.length = 0; g.S.waveActive = false; g.p.x = 0; g.p.z = 9; g.p.yaw = 0; g.p.vx = g.p.vz = 0;
    const orig = g.G.quality; let now = 1000; g.setLast(now); g.keys.KeyW = true; const n = Math.round(hz * 2); for (let i = 0; i < n; i++) { now += 1000 / hz; if (i === Math.round(hz)) g.inp.dash = true; g.tick(now); } g.keys.KeyW = false; return +(9 - g.p.z).toFixed(2); }, hz);
  const v = Object.values(out); ok('same movement at 60/144/165 Hz', Math.max(...v) - Math.min(...v) < 0.25, JSON.stringify(out)); await t.close(); }
// size audit
for (const b of ['itch', 'itch-offline', 'crazygames', 'poki']) { const d = path.resolve('builds', b); const fl = fs.readdirSync(d); const tot = fl.reduce((s, f) => s + fs.statSync(path.join(d, f)).size, 0); ok(b + ': size', tot < 20 * 1048576 && fl.length < 100 && fl.every((f) => fs.statSync(path.join(d, f)).isFile()), (tot / 1048576).toFixed(2) + ' MB, ' + fl.length + ' files, flat'); }
fs.writeFileSync('shots/test-results.json', JSON.stringify(R, null, 1));
console.log(R.filter((x) => !x.pass).length + ' failures of ' + R.length);
