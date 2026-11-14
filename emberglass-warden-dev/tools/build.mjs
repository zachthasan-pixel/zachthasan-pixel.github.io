// Build flat platform folders: node tools/build.mjs [--test]
// Output: builds/itch, builds/itch-offline (assets inlined for file://), builds/crazygames, builds/poki
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const test = process.argv.includes('--test');
const SDK = {
  itch: '', 'itch-offline': '',
  crazygames: '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>',
  poki: '<script src="https://game-cdn.poki.com/scripts/v2/poki-sdk.js"></script>',
};
const ASSETS = [
  ['assets/models/wraith.glb', 'wraith.glb'], ['assets/models/brute.glb', 'brute.glb'], ['assets/models/stinger.glb', 'stinger.glb'],
  ['assets/models/tyrant.glb', 'tyrant.glb'], ['assets/models/hilt.glb', 'hilt.glb'], ['assets/img/sky.jpg', 'sky.jpg'], ['assets/img/floor.jpg', 'floor.jpg'],
];
const FONTS = [['assets/img/bg.jpg', 'bg.jpg'], ['node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-500-normal.woff2', 'cp500.woff2'], ['node_modules/@fontsource/chakra-petch/files/chakra-petch-latin-700-normal.woff2', 'cp700.woff2']];
const mime = (f) => f.endsWith('.glb') ? 'model/gltf-binary' : f.endsWith('.jpg') ? 'image/jpeg' : 'font/woff2';

for (const plat of Object.keys(SDK)) {
  const out = path.join(root, process.env.EW_OUT || 'builds', plat); fs.rmSync(out, { recursive: true, force: true }); fs.mkdirSync(out, { recursive: true });
  await build({ entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', minify: !test, outfile: path.join(out, 'game.js'), target: 'es2019', logLevel: 'warning',
    define: { __PLATFORM__: JSON.stringify(plat === 'itch-offline' ? 'itch' : plat), __TEST__: test ? 'true' : 'false' } });
  let html = fs.readFileSync(path.join(root, 'src/index.html'), 'utf8').replace('<!--SDK-->', SDK[plat]);
  let css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
  if (plat === 'itch-offline') {
    const map = {}; for (const [src, name] of ASSETS) map[name] = 'data:' + mime(name) + ';base64,' + fs.readFileSync(path.join(root, src)).toString('base64');
    fs.writeFileSync(path.join(out, 'assets.js'), 'window.EW_ASSETS=' + JSON.stringify(map) + ';');
    html = html.replace('<!--ASSETS-->', '<script src="assets.js"></script>');
    for (const [src, name] of FONTS) css = css.replace('url(' + name + ')', 'url(data:' + mime(name) + ';base64,' + fs.readFileSync(path.join(root, src)).toString('base64') + ')');
  } else {
    html = html.replace('<!--ASSETS-->', '');
    for (const [src, name] of [...ASSETS, ...FONTS]) fs.copyFileSync(path.join(root, src), path.join(out, name));
  }
  fs.writeFileSync(path.join(out, 'index.html'), html); fs.writeFileSync(path.join(out, 'style.css'), css);
  const total = fs.readdirSync(out).reduce((s, f) => s + fs.statSync(path.join(out, f)).size, 0);
  console.log(plat.padEnd(13), fs.readdirSync(out).length, 'files', (total / 1048576).toFixed(2), 'MB');
}
