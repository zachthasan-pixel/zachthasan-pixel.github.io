// Renders store covers at exact pixel sizes: key art + HTML title. node tools/make-covers.mjs
import { launch } from './lib.mjs';
import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('.'); const out = path.join(root, 'store-art'); fs.mkdirSync(out, { recursive: true });
const b64 = (f) => fs.readFileSync(path.join(root, f)).toString('base64');
const font = b64('node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff2');
const art = { land: 'assets/store/keyart-landscape.png', port: 'assets/store/keyart-portrait.png', sq: 'assets/store/keyart-square.png' };
// [file, w, h, art, background-position, title css (empty = no title)]
const jobs = [
  ['cover-landscape-1920x1080.png', 1920, 1080, 'land', 'center', 'left:70px;top:60px;font-size:150px;text-align:left'],
  ['cover-portrait-800x1200.png', 800, 1200, 'port', 'center', 'left:0;right:0;top:50px;font-size:104px;text-align:center'],
  ['cover-square-800x800.png', 800, 800, 'sq', 'center', 'left:0;right:0;top:34px;font-size:92px;text-align:center'],
  ['poki-thumbnail-1024x1024.png', 1024, 1024, 'sq', 'center', ''],
  ['itch-cover-630x500.png', 630, 500, 'land', '62% center', 'left:22px;top:20px;font-size:62px;text-align:left'],
];
const b = await launch();
for (const [file, w, h, a, pos, tcss] of jobs) {
  const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  await pg.setContent(`<style>@font-face{font-family:CP;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:700}
  body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:#000 url(data:image/png;base64,${b64(art[a])}) ${pos}/cover no-repeat}
  .sh{position:absolute;inset:0;background:${tcss ? (tcss.includes('center') ? 'linear-gradient(180deg,#05061acc 0%,#05061a66 22%,#05061a00 40%)' : 'radial-gradient(ellipse at 0% 0%,#05061ad0 0%,#05061a70 32%,#05061a00 58%)') : 'none'}}
  .t{position:absolute;${tcss};font-family:CP;font-weight:700;line-height:.9;letter-spacing:.05em;color:#fff;text-shadow:0 0 .25em #ff7a2a,0 .06em .1em #000c}
  .t em{display:block;font-style:normal;font-size:1.28em;background:linear-gradient(180deg,#ffe08a 0%,#ff9a3c 45%,#f0501e 100%);-webkit-background-clip:text;color:transparent;text-shadow:none;filter:drop-shadow(0 0 .12em #ff6a1a) drop-shadow(0 .05em .06em #000)}</style>
  <div class="sh"></div>${tcss ? '<div class="t">EMBERGLASS<em>WARDEN</em></div>' : ''}`);
  await pg.evaluate(() => document.fonts.ready); await pg.waitForTimeout(300);
  await pg.screenshot({ path: path.join(out, file) }); await pg.close(); console.log(file);
}
await b.close();
