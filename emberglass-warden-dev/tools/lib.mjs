// Test helpers: serve a build folder and open it in headless Chromium (software WebGL).
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.glb': 'model/gltf-binary', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2' };
export function serve(dir, port) {
  return new Promise((res) => { const srv = http.createServer((q, r) => { const u = q.url.split('?')[0]; const f = path.join(dir, u === '/' ? 'index.html' : u); fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); r.end(d); } }); }).listen(port, () => res(srv)); });
}
export async function launch() {
  return chromium.launch({ executablePath: process.env.CHROME || '/opt/pw-browsers/chromium', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'] });
}
// Opens a build; returns { pg, errs, reqs, close }. opts: { build, w, h, ctx (context options), init (fn run before page scripts), route (fn(pg)) , manual }
export async function open(o = {}) {
  const dir = path.resolve('builds', o.build || 'itch'); const port = 8700 + Math.floor(Math.random() * 200);
  const srv = await serve(dir, port); const b = await launch();
  const ctx = await b.newContext(Object.assign({ viewport: { width: o.w || 1280, height: o.h || 720 }, deviceScaleFactor: o.dsf || 1 }, o.ctx || {}));
  const pg = await ctx.newPage(); const errs = [], reqs = [];
  pg.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  pg.on('pageerror', (e) => errs.push('PAGEERROR ' + e.message));
  pg.on('request', (r) => reqs.push(r.url()));
  pg.on('response', (r) => { if (r.status() >= 400) errs.push('HTTP ' + r.status() + ' ' + r.url()); });
  if (o.init) await pg.addInitScript(o.init);
  if (o.route) await o.route(pg);
  await pg.goto('http://localhost:' + port + '/');
  await pg.waitForFunction(() => window.__ew && window.__ew.S.state === 'menu', null, { timeout: 90000 });
  if (o.manual !== false) await pg.evaluate(() => { window.__ew.manual = true; });
  return { pg, errs, reqs, port, close: async () => { await b.close(); srv.close(); } };
}
