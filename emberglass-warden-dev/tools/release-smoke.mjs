// Loads release builds (no test hooks) the way a player would: node tools/release-smoke.mjs <dir-with-build-folders-or-single-build> [file]
import { launch, serve } from './lib.mjs'; import path from 'node:path'; import fs from 'node:fs';
const targets = process.argv.slice(2); let fail = 0; const b = await launch();
for (const tg of targets) {
  const isFile = tg.startsWith('file:'); const dir = path.resolve(tg.replace(/^file:/, ''));
  let srv = null, url; if (isFile) url = 'file://' + dir + '/index.html'; else { srv = await serve(dir, 8950 + Math.floor(Math.random() * 40)); url = 'http://localhost:' + srv.address().port + '/'; }
  const pg = await b.newPage({ viewport: { width: 1280, height: 720 } }); const errs = [];
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); }); pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  await pg.route('**/crazygames-sdk-v3.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.CrazyGames={SDK:{environment:"local",init:async()=>{},game:{settings:{muteAudio:false},addSettingsChangeListener(){},loadingStart(){},loadingStop(){},gameplayStart(){},gameplayStop(){},happytime(){}}}};' }));
  await pg.route('**/poki-sdk.js', (r) => r.fulfill({ contentType: 'text/javascript', body: 'window.PokiSDK={init:()=>Promise.resolve(),gameLoadingFinished(){},gameplayStart(){},gameplayStop(){},commercialBreak:()=>Promise.resolve()};' }));
  await pg.goto(url); await pg.waitForSelector('#menu:not(.hidden)', { timeout: 90000 });
  const hooks = await pg.evaluate(() => typeof window.__ew); await pg.click('#playBtn'); await pg.waitForSelector('#hud:not(.hidden)', { timeout: 20000 }); await pg.waitForTimeout(2500);
  const sdk = fs.readFileSync(path.join(dir, 'index.html'), 'utf8'); const tag = sdk.includes('crazygames-sdk') ? 'crazygames-sdk' : sdk.includes('poki-sdk') ? 'poki-sdk' : 'no-sdk';
  const pass = errs.length === 0 && hooks === 'undefined'; if (!pass) fail++;
  console.log((pass ? 'PASS ' : 'FAIL ') + tg + '  [' + tag + '] hooks:' + hooks + ' errors:' + errs.length + ' ' + errs.slice(0, 2).join(' | ')); await pg.close(); if (srv) srv.close();
}
await b.close(); process.exit(fail ? 1 : 0);
