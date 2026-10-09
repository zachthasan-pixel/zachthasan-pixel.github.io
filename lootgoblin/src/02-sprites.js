// ---------------------------------------------------------------------------
// Pixel art. Every sprite is a list of strings; one char = one pixel.
// '.' is transparent. Palettes map chars to colours and can be swapped per
// draw (armor tint, rarity accents) — results are cached.
// ---------------------------------------------------------------------------
const OUT = '#1a1022';
const BASE_PAL = {
  o: OUT, g: '#6cc644', G: '#3f8a2c', w: '#ffffff', k: OUT, t: '#fff6d8', c: '#8a5a2b', C: '#5e3c1c',
  f: '#2f6b22', h: '#9aa3b0', H: '#5c6370',
};

const SPR = {
  // Goblin hero: head + torso, faces right. Eye = w/k at cols 9-10.
  body: [
    '................',
    '......ooooo.....',
    '.....oggggggo...',
    'oo..ogggggwwgo..',
    'ogoogggggwkggo..',
    '.oggggggggggggo.',
    '..oogggggggGGgo.',
    '....ogGtGtGGGo..',
    '.....oGGGGGGo...',
    '....occcccccco..',
    '...occcccccccgo.',
    '....occcccccco..',
  ],
  legs: [
    ['.....oCCCCCo....', '.....oG..oG.....', '....of...of.....', '....ff...ff.....'],
    ['.....oCCCCCo....', '....oG....oG....', '...of......of...', '...ff......ff...'],
    ['.....oCCCCCo....', '.....oG..oG.....', '....of...of.....', '....ff...ff.....'],
    ['.....oCCCCCo....', '......oGoG......', '......offo......', '......ffff......'],
  ],
  helm: [
    '......oooooo....',
    '.....ohhhhhho...',
    '....ohHhhhhhho..',
    '...ohhhhhhhhhho.',
  ],
  slime: [
    '................', '................', '................', '................',
    '................', '.......oooo.....', '.....oossssoo...', '....osssssssso..',
    '...osskwssskwso.', '...ossssssssso..', '..ossssssssssso.', '..osSssssssSsso.',
    '..oSSSSSSSSSSSo.', '...ooooooooooo..', '................', '................',
  ],
  skeleton: [
    '......oooo......', '.....owwwwo.....', '....owwwwwwo....', '....okwwkwwo....',
    '....owwwwwwo....', '.....owkkwo.....', '......owwo......', '....oowwwwoo....',
    '...owowwwwowo...', '...ow.owwo.wo...', '......owwo......', '.....owwwwo.....',
    '.....ow..wo.....', '.....ow..wo.....', '....oww..wwo....', '................',
  ],
  bat: [
    '................', '................', 'o..............o', 'oo....o..o....oo',
    'obo..oboobo..obo', 'obbooobbbbooobbo', '.obbbbbbbbbbbbo.', '..obbbrbbrbbbo..',
    '...obbbbbbbbo...', '....oobbbboo....', '......obbo......', '.......oo.......',
    '................', '................', '................', '................',
  ],
  orc: [
    '....oooooooo....', '...oqqqqqqqqo...', '..oqqrqqqqrqqo..', '..oqqqqqqqqqqo..',
    '..oqtqqqqqqtqo..', '...oqqqqqqqqo...', '..ooaaaaaaaaoo..', '.oqoaaammaaaoqo.',
    '.oqoaaammaaaoqo.', '.oqoaaaaaaaaoqo.', '..o.oaaaaaao.o..', '....oqqo.oqqo...',
    '....oqqo.oqqo...', '...oqqqo.oqqqo..', '...ooooo.ooooo..', '................',
  ],
  mimic: [
    '................', '................', '...oooooooooo...', '..oyyyyyyyyyyo..',
    '..obbbbbbbbbbo..', '..otototototoo..', '..okkkkkkkkkko..', '..okkrrrrrrkko..',
    '..otototototoo..', '..obbbbyybbbbo..', '..obbbbyybbbbo..', '..obbbbbbbbbbo..',
    '..oooooooooooo..', '................', '................', '................',
  ],
  ghost: [
    '......oooo......', '....oowwwwoo....', '...owwwwwwwwo...', '..owkkwwkkwwwo..',
    '..owkkwwkkwwwo..', '..owwwwwwwwwwo..', '..owwwookwwwwo..', '..owwwwwwwwwwo..',
    '..owwwwwwwwwwo..', '..owwwwwwwwwwo..', '..owowwowwowwo..', '..oo.oo.oo.oo...',
    '................', '................', '................', '................',
  ],
  eye: [
    '.....oooooo.....', '...oowwwwwwoo...', '..owwwrwwwwwwo..', '.owwwwwiiiwwwwo.',
    '.owwwwiiiiiwwwo.', 'owrwwiikkkiiwwwo', 'owwwwiikkkiiwrwo', 'owwwwiikkkiiwwwo',
    '.owwwwiiiiiwwwo.', '.owwrwwiiiwwwwo.', '..owwwwwwwrwwo..', '...oowwwwwwoo...',
    '.....oooooo.....', '................', '................', '................',
  ],
  chestBase: [
    'oyyyyyyyyyyyyo', 'obbbbbryrbbbbo', 'obbbbbbybbbbbo', 'obbbbbbbbbbbbo',
    'oBBBBBBBBBBBBo', 'oooooooooooooo',
  ],
  chestLid: [
    '..oooooooooo..', '.obbbbbbbbbbo.', 'obbbbbbbbbbbbo', 'orrrrrrrrrrrro',
  ],
  coin: ['.oooo.', 'oggGGo', 'ogGggo', 'ogGggo', 'oggGGo', '.oooo.'],
  tophat: ['...oooooo...', '...okkkko...', '...okkkko...', '...orrrro...', '.oooooooooo.'],
  crown: ['o..o..o..o', 'oyoyoyoyoy', 'oyyyyyyyyo', 'oyryyyryyo', 'oooooooooo'],
};

// Item icons, 12x12. m/M metal, w/W wood, a/A accent (rarity), g/G gold, l/L liquid, x white, k dark, r red.
const ICON = {
  sword: ['..........oo', '.........omo', '........omo.', '.......omo..', '......omo...', '.....omo....',
    '..o.omo.....', '..oaao......', '...aaao.....', '..owoaa.....', '.owo..o.....', '.oo.........'],
  axe: ['......ooo...', '.....ommmo..', '....ommmmmo.', '....omMwmmo.', '.....oowMmo.', '.....owo.oo.',
    '....owo.....', '...owo......', '..owo.......', '.oao........', '.oo.........', '............'],
  dagger: ['............', '..........o.', '.........omo', '........omo.', '.......omo..', '......omo...',
    '....oaao....', '.....aao....', '....owoa....', '...owo......', '...oo.......', '............'],
  hammer: ['..oooooooo..', '.ommmmmmmmo.', '.omMMMMMMmo.', '.ommmmmmmmo.', '..oooaaooo..', '.....owo....',
    '.....owo....', '.....owo....', '.....owo....', '.....oao....', '.....owo....', '.....ooo....'],
  staff: ['....oaao....', '...oaAAao...', '...oaAAao...', '....oaao....', '.....owo....', '.....owo....',
    '....owo.....', '....owo.....', '...owo......', '...owo......', '..owo.......', '..oo........'],
  helm: ['............', '....oooo....', '...ommmmo...', '..ommmmmmo..', '..oaaaaaao..', '..ommmmmmo..',
    '..om.kk.mo..', '..omkkkkmo..', '..om.kk.mo..', '..oo....oo..', '............', '............'],
  armor: ['............', '..oo....oo..', '.omao..oamo.', '.ommmoommmo.', '.ommmaammmo.', '..ommmmmmo..',
    '..ommaammo..', '..ommmmmmo..', '..ommmmmmo..', '..oaaaaaao..', '...oooooo...', '............'],
  boots: ['............', '............', '...oooo.....', '...owwo.....', '...owwo.....', '...owwo.....',
    '...owwoooo..', '...owwwwwwo.', '...oaaaaaao.', '...oooooooo.', '............', '............'],
  ring: ['............', '....oaao....', '...oaAAao...', '....oaao....', '...oggggo...', '..og....go..',
    '..og....go..', '..og....go..', '...oggggo...', '....oooo....', '............', '............'],
  amulet: ['..o......o..', '...o....o...', '....o..o....', '.....oo.....', '....oggo....', '...ogaago...',
    '..ogaAAago..', '...ogaago...', '....oggo....', '.....oo.....', '............', '............'],
  potion: ['....oooo....', '....owwo....', '.....oo.....', '....o..o....', '...ollllo...', '..olllllLo..',
    '..olxlllLo..', '..olllllLo..', '..oLLLLLLo..', '...oooooo...', '............', '............'],
  bomb: ['.........x..', '........xg..', '.......oo...', '......o.....', '....oooo....', '...okkkko...',
    '..okkxkkko..', '..okxkkkko..', '..okkkkkko..', '..okkkkkko..', '...okkkko...', '....oooo....'],
  rock: ['............', '............', '............', '....oooo....', '...oMmmMo...', '..oMmmmmMo..',
    '..oMmmmMMo..', '.oMMmmMMMMo.', '.oMMMMMMMMo.', '..oooooooo..', '............', '............'],
  sock: ['...oooooo...', '...oxxxxo...', '...orrrro...', '...oxxxxo...', '...oxxxxo...', '...oxxxxo...',
    '...oxxxxoo..', '...oxxxxxxo.', '...oxxxxxxo.', '....oooooo..', '............', '............'],
  receipt: ['...oooooo...', '...oxxxxo...', '...oxkkxo...', '...oxxxxo...', '...oxkkxo...', '...oxxxxo...',
    '...oxkkxo...', '...oxxxxo...', '...oxkxxo...', '...oxoxoxo..', '............', '............'],
};
const ICON_PAL = {
  o: OUT, m: '#d6dbe3', M: '#7d8590', w: '#a8743c', W: '#6b4423', a: '#b8b8c8', A: '#ffffff',
  g: '#f2c14e', G: '#b8862b', l: '#ff4f6d', L: '#b02745', x: '#ffffff', k: '#3a3f58', r: '#d94a4a',
};

const _spriteCache = new Map();
function sprite(rows, pal, key) {
  const k = key || null;
  if (k && _spriteCache.has(k)) return _spriteCache.get(k);
  const w = Math.max.apply(null, rows.map(r => r.length)), h = rows.length;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  for (let j = 0; j < h; j++) for (let i = 0; i < rows[j].length; i++) {
    const ch = rows[j][i];
    if (ch === '.' || ch === ' ') continue;
    const col = pal[ch];
    if (!col) continue;
    x.fillStyle = col; x.fillRect(i, j, 1, 1);
  }
  if (k) _spriteCache.set(k, c);
  return c;
}
function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (amt < 0) { r *= 1 + amt; g *= 1 + amt; b *= 1 + amt; } else { r += (255 - r) * amt; g += (255 - g) * amt; b += (255 - b) * amt; }
  return '#' + [r, g, b].map(v => ('0' + Math.round(v).toString(16)).slice(-2)).join('');
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
}

function heroBody(armorCol, eyesClosed, hurt) {
  const key = 'body|' + armorCol + '|' + eyesClosed + '|' + hurt;
  const pal = Object.assign({}, BASE_PAL);
  if (armorCol) { pal.c = armorCol; pal.C = shade(armorCol, -0.35); }
  if (eyesClosed) { pal.w = BASE_PAL.G; pal.k = BASE_PAL.G; }
  if (hurt) { pal.g = '#ffffff'; pal.G = '#ffd0d0'; }
  return sprite(SPR.body, pal, key);
}
function heroLegs(frame, bootCol) {
  const pal = Object.assign({}, BASE_PAL);
  if (bootCol) pal.f = bootCol;
  return sprite(SPR.legs[frame], pal, 'legs|' + frame + '|' + bootCol);
}
function helmSprite(col) {
  return sprite(SPR.helm, { o: OUT, h: col, H: shade(col, -0.35) }, 'helm|' + col);
}
const ENEMY_PAL = {
  slime: { o: OUT, s: '#4fd1a5', S: '#2b8f72', w: '#ffffff', k: OUT },
  skeleton: { o: OUT, w: '#e8e2cf', k: '#2a2033' },
  bat: { o: OUT, b: '#6d4c9f', r: '#ff3b5c' },
  orc: { o: OUT, q: '#7aa83f', r: '#ff3b3b', t: '#fff6d8', a: '#7a4b2a', m: '#aab2bd' },
  mimic: { o: OUT, y: '#f2c14e', b: '#8a5a2b', t: '#fff6d8', k: '#2a0d16', r: '#e0435f' },
  ghost: { o: '#4a5d8a', w: '#cfe8ff', k: '#2a3354' },
  eye: { o: OUT, w: '#f4f0ff', r: '#e0435f', i: '#c0392b', k: '#120812' },
  taxman: Object.assign({}, BASE_PAL, { g: '#9b6bd6', G: '#6a3fa8', c: '#2b2b44', C: '#1a1a2e' }),
};
function chestSprites(rarCol) {
  const pal = { o: OUT, y: rarCol, b: '#8a5a2b', B: '#5e3c1c', r: rarCol };
  return { base: sprite(SPR.chestBase, pal, 'cb|' + rarCol), lid: sprite(SPR.chestLid, pal, 'cl|' + rarCol) };
}
function iconSprite(name, accent, liquid) {
  const pal = Object.assign({}, ICON_PAL);
  if (accent) { pal.a = accent; pal.A = shade(accent, 0.5); }
  if (liquid) { pal.l = liquid; pal.L = shade(liquid, -0.4); }
  return sprite(ICON[name], pal, 'ic|' + name + '|' + accent + '|' + liquid);
}
