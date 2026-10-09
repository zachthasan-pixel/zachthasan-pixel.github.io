// ---------------------------------------------------------------------------
// Screens, buttons, input, main loop.
// ---------------------------------------------------------------------------
const ptr = { x: -1, y: -1, touch: false, down: false };
let BTN = [];

const UPG = [
  { k: 'bag', name: 'Bigger Sack', desc: '+1 bag slot, every run', max: 4, cost: l => [150, 600, 2000, 6500][l] },
  { k: 'luck', name: 'Lucky Snout', desc: '+8% chest luck (better rarities)', max: 5, cost: l => Math.round(110 * Math.pow(2.3, l)) },
  { k: 'hp', name: 'Thick Skin', desc: '+15% Max HP', max: 5, cost: l => Math.round(80 * Math.pow(2.2, l)) },
  { k: 'dmg', name: 'Sharp Claws', desc: '+15% Damage', max: 5, cost: l => Math.round(80 * Math.pow(2.2, l)) },
  { k: 'sell', name: 'Haggler', desc: '+20% gold from selling', max: 5, cost: l => Math.round(100 * Math.pow(2.1, l)) },
  { k: 'insure', name: 'Overflow Insurance', desc: 'Survive your first overflow each run', max: 1, cost: () => 3000 },
];

function button(r, label, fn, opts) {
  opts = opts || {};
  const hov = inRect(ptr.x, ptr.y, r) && !ptr.touch;
  const dis = opts.disabled;
  const col = opts.col || '#f2c14e';
  ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(r.x + 4, r.y + 5, r.w, r.h);
  panel(r.x, r.y, r.w, r.h, dis ? '#2a2238' : hov ? shade(col, 0.2) : col, OUT, 3);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(r.x + 3, r.y + 3, r.w - 6, 3);
  txt(label, r.x + r.w / 2, r.y + r.h / 2 + 1, opts.size || LAY.fs * 1.0, dis ? '#7a6f92' : '#2a1640', 'center', false, true);
  if (!dis) BTN.push({ r, fn });
}

// ---------------------------------------------------------------- title ----
function drawTitle() {
  drawWorld();
  const P = LAY.P;
  drawHero(LAY.hx, LAY.gy, P, { gear: demoGear, moving: true, legT: game.t * 10, eyes: (game.t % 2.7) < 0.15, fill: 0.5 + 0.5 * Math.sin(game.t) });
  // falling demo chests
  const ph = (game.t % 3) / 3;
  const cx = LAY.hx + (30 - ph * 30) * P, cy = LAY.gy - Math.max(0, 1 - ph * 3) * 60 * P;
  const cs = chestSprites(RAR[Math.floor(game.t / 3) % 6].c);
  drawSprite(cs.base, cx, cy, P); drawSprite(cs.lid, cx, cy - 6 * P, P);
  ctx.fillStyle = 'rgba(8,4,16,0.55)'; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, LAY.scene.h, W, H - LAY.scene.h);
  const fs = LAY.fs, cx2 = W / 2;
  const ts = Math.min(W / 13, H / 11, 54);
  const wob = Math.sin(game.t * 2) * 3;
  txt('INFINITE', cx2, H * 0.12 + wob, ts * 0.62, '#ffe08a', 'center', false, true);
  txt('LOOT GOBLIN', cx2, H * 0.12 + ts * 1.05 + wob, ts, '#ff9a1f', 'center', false, true);
  txt('ONE-BUTTON DUNGEON', cx2, H * 0.12 + ts * 1.95, ts * 0.36, '#c46bff', 'center', false, true);
  const lines = ['Your goblin runs and fights on his own.', 'YOU manage the loot. A chest drops every 3 seconds.', 'If your bag overflows... you explode.'];
  lines.forEach((l, i) => txt(l, cx2, H * 0.12 + ts * 2.7 + i * fs * 1.45, fs * 1.0, i === 2 ? '#ff5a76' : '#e8e0ff', 'center', true));
  const bw = Math.min(300, W - 40), bh = Math.round(fs * 2.9);
  let y = Math.max(LAY.scene.h + 10, H * 0.12 + ts * 2.7 + fs * 5.2);
  button({ x: cx2 - bw / 2, y, w: bw, h: bh }, save.runs ? 'RUN AGAIN' : 'PLAY', () => { AU.sfx('click'); newRun(); }, { size: fs * 1.3 });
  y += bh + 12;
  const hw = (bw - 10) / 2;
  button({ x: cx2 - bw / 2, y, w: hw, h: bh * 0.8 }, 'BANK', () => { AU.sfx('click'); game.state = 'bank'; }, { col: '#c46bff', size: fs * 0.9 });
  button({ x: cx2 - bw / 2 + hw + 10, y, w: hw, h: bh * 0.8 }, 'HOW TO', () => { AU.sfx('click'); game.state = 'help'; }, { col: '#4ea8ff', size: fs * 0.9 });
  y += bh * 0.8 + 18;
  const info = 'Best ' + save.best + ' m  ·  Gold ' + fmt(save.gold) + (save.bestItem ? '  ·  Best find: ' + save.bestItem.n : '');
  const isz = Math.min(fs * 0.9, (W - 20) / (info.length * 0.52));
  txt(info, cx2, Math.min(H - 16, y + 8), isz, save.bestItem ? RAR[save.bestItem.r].c : '#a99fc4', 'center', true);
  muteCorner();
}
const demoGear = {
  weapon: { icon: 'dagger', rarity: R_LEG }, helm: { rarity: 3 }, armor: { rarity: 4 }, boots: { rarity: 2 },
};
function muteCorner() {
  const bs = Math.round(LAY.fs * 2.1);
  LAY.muteBtn = { x: W - 12 - bs, y: 12, w: bs, h: bs };
  iconButton(LAY.muteBtn, save.muted ? 'muted' : 'sound');
  BTN.push({ r: LAY.muteBtn, fn: () => AU.setMuted(!save.muted) });
}

// ----------------------------------------------------------------- help ----
function drawHelp() {
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs, w = Math.min(W - 24, 640), x = (W - w) / 2;
  let y = 30;
  txt('HOW TO PLAY', W / 2, y, Math.min(fs * 1.6, W / 14), '#ffe08a', 'center', false, true);
  y += fs * 2.4;
  const tips = [
    ['#e8e0ff', 'Your goblin charges forward and fights by himself. You never control him.'],
    ['#f2c14e', 'A chest drops every 3 seconds. The loot flies straight into your BAG.'],
    ['#ff5a76', 'If loot arrives and your bag is full, you EXPLODE. Watch the timer.'],
    ['#5fd35f', 'Drag gear onto the matching GEAR slot to equip it (or drop it on the goblin, or double-tap it). A green arrow means it is better.'],
    ['#f2c14e', 'Drag anything to SELL for gold. Right-click (or hover + S) also sells. Gold buys permanent upgrades in the BANK.'],
    ['#4ee0ff', 'Potions and bombs: drag them onto the dungeon. Bombs explode in your bag if you wait too long.'],
    ['#ff9a1f', 'Legendaries break the game. Read them: some make you lose HP every time you BLINK.'],
    ['#ff3b5c', 'Cursed items are huge, and they bite back. Some shrink your bag. A shrinking bag can burst.'],
    ['#c46bff', 'A boss waits every 250 m. Beat it to spin the JACKPOT.'],
  ];
  for (const [c, t] of tips) {
    const lines = wrap(t, w - 30, fs * 0.98, true);
    ctx.fillStyle = c; ctx.fillRect(x, y - fs * 0.45, 8, 8);
    lines.forEach((l, i) => txt(l, x + 18, y + i * fs * 1.3, fs * 0.98, c === '#e8e0ff' ? c : shade(c, 0.35), 'left', true));
    y += lines.length * fs * 1.3 + fs * 0.6;
  }
  txt('Desktop: hover an item and press E to equip/use, S to sell. Esc pauses, M mutes.', W / 2, y + fs * 0.4, Math.min(fs * 0.85, (W - 20) / 48), '#a99fc4', 'center', true);
  const bw = Math.min(260, W - 40);
  button({ x: W / 2 - bw / 2, y: Math.min(H - fs * 3.6, y + fs * 1.8), w: bw, h: fs * 2.6 }, 'GOT IT', () => {
    AU.sfx('click');
    if (game.wasPlaying && run && !run.dead) { game.state = 'play'; game.paused = true; } else game.state = 'title';
    game.wasPlaying = false;
  });
}

// ----------------------------------------------------------------- bank ----
function drawBank() {
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs;
  txt('THE GOBLIN BANK', W / 2, 32, Math.min(fs * 1.5, W / 16), '#c46bff', 'center', false, true);
  txt('Gold: ' + fmt(save.gold), W / 2, 32 + fs * 2, fs * 1.2, '#f2c14e', 'center', true);
  const cols = W > 760 ? 3 : W > 480 ? 2 : 1;
  const cw = Math.min(260, (W - 24 - (cols - 1) * 12) / cols), ch = fs * 6.2;
  const totalW = cols * cw + (cols - 1) * 12, x0 = (W - totalW) / 2;
  let y0 = 32 + fs * 3.6;
  UPG.forEach((u, i) => {
    const x = x0 + (i % cols) * (cw + 12), y = y0 + Math.floor(i / cols) * (ch + 12);
    const lv = save.up[u.k], maxed = lv >= u.max, cost = maxed ? 0 : u.cost(lv);
    panel(x, y, cw, ch, '#1a1030', maxed ? '#5fd35f' : '#4a3a6a', 2);
    txt(u.name, x + 12, y + fs * 1.1, fs * 1.05, '#ffe08a', 'left', true);
    txt(u.desc, x + 12, y + fs * 2.35, fs * 0.82, '#d9cff5', 'left', true);
    for (let p = 0; p < u.max; p++) { ctx.fillStyle = p < lv ? '#5fd35f' : '#2e2346'; ctx.fillRect(x + 12 + p * 16, y + fs * 3.3, 12, 8); }
    const br = { x: x + 12, y: y + ch - fs * 2.3, w: cw - 24, h: fs * 1.8 };
    if (maxed) txt('MAXED', x + cw / 2, br.y + br.h / 2, fs * 0.9, '#5fd35f', 'center', false, true);
    else button(br, 'BUY ' + fmt(cost) + 'g', () => {
      if (save.gold < cost) { AU.sfx('deny'); return; }
      save.gold -= cost; save.up[u.k]++; writeSave(); AU.sfx('buy');
    }, { disabled: save.gold < cost, size: fs * 0.75, col: '#5fd35f' });
  });
  const rows = Math.ceil(UPG.length / cols);
  const bw = Math.min(260, W - 40);
  button({ x: W / 2 - bw / 2, y: Math.min(H - fs * 3.4, y0 + rows * (ch + 12) + 8), w: bw, h: fs * 2.5 }, 'BACK', () => { AU.sfx('click'); game.state = run && run.dead ? 'dead' : 'title'; });
}

// -------------------------------------------------------------- results ----
function drawDead() {
  drawWorld();
  ctx.fillStyle = 'rgba(8,4,16,0.82)'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs, cx = W / 2;
  let y = H * 0.1;
  const ts = Math.min(W / 11, 46);
  txt(run.exploded ? 'KA-BOOM!' : 'YOU DIED', cx, y, ts, run.exploded ? '#ff9a1f' : '#ff3b5c', 'center', false, true);
  y += ts * 1.1;
  txt(run.cause, cx, y, Math.min(fs * 1.15, (W - 20) / (run.cause.length * 0.55)), '#e8e0ff', 'center', true);
  y += fs * 2.4;
  const rows = [
    ['DEPTH', Math.floor(run.depth) + ' m' + (run.record ? '  NEW BEST!' : ''), run.record ? '#ffe08a' : '#fff'],
    ['LOOT OPENED', String(run.opened), '#fff'],
    ['ENEMIES SLAIN', String(run.kills), '#fff'],
    ['GOLD BANKED', '+' + fmt(run.gold), '#f2c14e'],
  ];
  const w = Math.min(380, W - 40);
  for (const [a, b, c] of rows) {
    txt(a, cx - w / 2, y, fs * 0.95, '#a99fc4', 'left', true);
    txt(b, cx + w / 2, y, fs * 1.1, c, 'right', true);
    y += fs * 1.7;
  }
  if (run.bestItem) {
    txt('BEST FIND', cx - w / 2, y, fs * 0.95, '#a99fc4', 'left', true);
    const nm = run.bestItem.name;
    txt(nm, cx + w / 2, y, Math.min(fs * 1.05, (w * 0.62) / (nm.length * 0.5)), RAR[run.bestItem.rarity].c, 'right', true);
    y += fs * 1.7;
  }
  y += fs * 0.8;
  const tip = deathTip();
  wrap(tip, w, fs * 0.9, true).forEach((l, i) => txt(l, cx, y + i * fs * 1.2, fs * 0.9, '#7fd7ff', 'center', true));
  y += fs * 3.2;
  const bw = Math.min(300, W - 40), bh = fs * 2.8;
  button({ x: cx - bw / 2, y: Math.min(y, H - bh * 2 - 30), w: bw, h: bh }, 'RUN AGAIN', () => { AU.sfx('click'); newRun(); }, { size: fs * 1.2 });
  const hw = (bw - 10) / 2, y2 = Math.min(y, H - bh * 2 - 30) + bh + 12;
  button({ x: cx - bw / 2, y: y2, w: hw, h: bh * 0.8 }, 'BANK', () => { AU.sfx('click'); game.state = 'bank'; }, { col: '#c46bff', size: fs * 0.9 });
  button({ x: cx - bw / 2 + hw + 10, y: y2, w: hw, h: bh * 0.8 }, 'MENU', () => { AU.sfx('click'); game.state = 'title'; }, { col: '#4ea8ff', size: fs * 0.9 });
}
function deathTip() {
  if (run._tip) return run._tip;
  const c = run.cause;
  let t;
  if (/overflow|burst/i.test(c)) t = save.up.insure ? 'Tip: sell junk the moment it lands. The bag never waits for you.' : 'Tip: Overflow Insurance in the BANK saves you from your first overflow.';
  else if (/Blink/i.test(c)) t = 'Tip: that legendary drains HP every blink. Pair it with lifesteal or regen... or stop blinking.';
  else if (/bomb/i.test(c)) t = 'Tip: throw bombs onto the dungeon before the fuse hits zero.';
  else if (/curse|cursed/i.test(c)) t = 'Tip: cursed items are strong, but read the red line first.';
  else t = 'Tip: keep upgrading your weapon. Enemies grow stronger every few metres.';
  run._tip = t; return t;
}

// ---------------------------------------------------------------- pause ----
function drawPause() {
  ctx.fillStyle = 'rgba(8,4,16,0.78)'; ctx.fillRect(0, 0, W, H);
  const fs = LAY.fs, bw = Math.min(280, W - 40), bh = fs * 2.7;
  txt('PAUSED', W / 2, H * 0.3, Math.min(fs * 2, W / 9), '#ffe08a', 'center', false, true);
  button({ x: W / 2 - bw / 2, y: H * 0.42, w: bw, h: bh }, 'RESUME', () => { AU.sfx('click'); game.paused = false; });
  button({ x: W / 2 - bw / 2, y: H * 0.42 + bh + 14, w: bw, h: bh }, 'HOW TO PLAY', () => { AU.sfx('click'); game.paused = false; game.state = 'help'; game.wasPlaying = true; }, { col: '#4ea8ff' });
  button({ x: W / 2 - bw / 2, y: H * 0.42 + 2 * (bh + 14), w: bw, h: bh }, 'GIVE UP', () => { AU.sfx('click'); game.paused = false; die('Gave up. The loot wins this time.', false); }, { col: '#ff5a76' });
  muteCorner();
}


// ---------------------------------------------------------------- cover ----
// Store-art composition rendered by the engine itself: open index.html#cover.
function drawCover() {
  const P = Math.max(3, Math.round(H / 105));
  LAY.P = P; LAY.gy = Math.round(H * 0.8); LAY.hx = Math.round(W * 0.3);
  LAY.scene = { x: 0, y: 0, w: W, h: H };
  drawScene();
  ctx.fillStyle = 'rgba(8,4,16,0.35)'; ctx.fillRect(0, 0, W, H);
  const cx = W * 0.63, gy = LAY.gy;
  // legendary beam from an exploding chest
  const beamW = 26 * P;
  const g = ctx.createLinearGradient(0, 0, 0, gy);
  g.addColorStop(0, 'rgba(255,154,31,0)'); g.addColorStop(1, 'rgba(255,154,31,0.75)');
  ctx.fillStyle = g; ctx.fillRect(cx - beamW / 2, 0, beamW, gy - 4 * P);
  const rg = ctx.createRadialGradient(cx, gy - 10 * P, 0, cx, gy - 10 * P, 60 * P);
  rg.addColorStop(0, 'rgba(255,224,138,0.55)'); rg.addColorStop(1, 'rgba(255,224,138,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  const cs = chestSprites('#ff9a1f');
  drawSprite(cs.base, cx, gy, P);
  ctx.save(); ctx.translate(cx - 6 * P, gy - 6 * P); ctx.rotate(-1.0); ctx.drawImage(cs.lid, -P, -4 * P, 14 * P, 4 * P); ctx.restore();
  // loot spraying out
  const loot = [['sword', 4], ['ring', 3], ['amulet', 4], ['helm', 2], ['armor', 3], ['boots', 1], ['dagger', 4], ['hammer', 5], ['staff', 3]];
  loot.forEach(([ic, r], i) => {
    const a = -Math.PI / 2 + (i - (loot.length - 1) / 2) * 0.36, d = (26 + (i % 3) * 8) * P;
    const x = cx + Math.cos(a) * d, y = gy - 16 * P + Math.sin(a) * d * 0.9;
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 9 * P);
    glow.addColorStop(0, hexA(RAR[r].c, 0.6)); glow.addColorStop(1, hexA(RAR[r].c, 0));
    ctx.fillStyle = glow; ctx.fillRect(x - 10 * P, y - 10 * P, 20 * P, 20 * P);
    ctx.save(); ctx.translate(x, y); ctx.rotate((i - 4) * 0.25);
    drawItemIcon({ icon: ic, kind: 'gear', rarity: r }, 0, 0, 13 * P); ctx.restore();
  });
  [['potion', '#ff4f6d', -0.9, 30], ['potion', '#4ee0ff', 0.75, 24], ['bomb', null, 1.15, 34]].forEach(([ic, col, a, d]) => {
    drawItemIcon({ icon: ic, kind: ic, col }, cx + Math.cos(a - Math.PI / 2) * d * P * 1.5, gy - 30 * P + Math.sin(a - Math.PI / 2) * d * P, 11 * P);
  });
  for (let i = 0; i < 28; i++) {
    const x = cx + (hash(i, 3) - 0.5) * 120 * P, y = gy - hash(i, 7) * 70 * P - 10 * P;
    drawSprite(sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin'), x, y, P * 0.8);
  }
  for (let i = 0; i < 60; i++) {
    ctx.fillStyle = pick(['#fff3c4', '#ffe08a', '#ff9a1f']); ctx.globalAlpha = 0.8;
    ctx.fillRect(cx + (hash(i, 11) - 0.5) * 90 * P, gy - hash(i, 13) * 80 * P, P * 0.8, P * 0.8);
  }
  ctx.globalAlpha = 1;
  // the goblin, mid-sprint, sack stuffed
  run = null;
  drawHero(LAY.hx, gy, P * 1.5, { gear: { weapon: { icon: 'dagger', rarity: R_LEG }, helm: { rarity: 3 }, armor: { rarity: 4 }, boots: { rarity: 2 } }, moving: true, legT: 1, eyes: false, fill: 0.75 });
  // a doomed slime
  drawSprite(sprite(SPR.slime, ENEMY_PAL.slime, 'en|slime'), W * 0.88, gy, P * 1.3, false, 1, 1.05, 0.95);
  // number-go-up
  const nums = [['+500% ATK SPEED', W * 0.04, H * 0.42, '#ffe14d', 0.9], ['x9,999!', W * 0.86, H * 0.6, '#ff9a1f', 1.2], ['LEGENDARY!', cx, H * 0.3, '#ffb347', 1.0]];
  const ns = Math.min(W / 11.5, H / 7.5) * 0.3;
  for (const [t, x, y, c, sc] of nums) txt(t, x, y, ns * sc, c, x < W * 0.3 ? 'left' : 'center', true);
  // title
  const ts = Math.min(W / 11.5, H / 7.5);
  ctx.fillStyle = 'rgba(8,4,16,0.55)'; ctx.fillRect(0, 0, W, ts * 2.65);
  txt('INFINITE', W / 2, ts * 0.62, ts * 0.58, '#ffe08a', 'center', false, true);
  txt('LOOT GOBLIN', W / 2, ts * 1.55, ts, '#ff9a1f', 'center', false, true);
  ctx.fillStyle = 'rgba(8,4,16,0.75)'; ctx.fillRect(0, H - ts * 0.95, W, ts * 0.95);
  txt('ONE-BUTTON DUNGEON', W / 2, H - ts * 0.48, ts * 0.42, '#c46bff', 'center', false, true);
}

// ----------------------------------------------------------------- frame ---
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.imageSmoothingEnabled = false;
  BTN = [];
  if (game.state === 'cover') drawCover();
  else if (game.state === 'title') drawTitle();
  else if (game.state === 'help') drawHelp();
  else if (game.state === 'bank') drawBank();
  else if (game.state === 'dead') drawDead();
  else if (game.state === 'play') {
    drawWorld();
    drawInventory();
    drawFx();
    drawHUD();
    BTN.push({ r: LAY.pauseBtn, fn: () => { AU.sfx('click'); game.paused = true; } });
    BTN.push({ r: LAY.muteBtn, fn: () => AU.setMuted(!save.muted) });
    if (run.flash > 0) { ctx.globalAlpha = run.flash * 0.6; ctx.fillStyle = run.flashCol; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    if (!run.dead && !(game.drag && game.drag.moved)) {
      const tipRef = (!ptr.touch && game.hover && getItem(game.hover)) ? game.hover : game.sel;
      if (tipRef && getItem(tipRef)) drawTooltip(tipRef, tipRef.k === 'bag' ? LAY.bag[tipRef.i] : LAY.gear[tipRef.s]);
    }
    if (game.paused) { BTN = []; drawPause(); }
  }
  cvs.className = game.drag && game.drag.moved ? 'grab' : (BTN.some(b => inRect(ptr.x, ptr.y, b.r)) || (game.state === 'play' && hitSlot(ptr.x, ptr.y) && getItem(hitSlot(ptr.x, ptr.y)))) ? 'point' : '';
}

// ----------------------------------------------------------------- input ---
function hitSlot(x, y) {
  if (!run || game.state !== 'play') return null;
  for (const k of SLOTS) if (inRect(x, y, LAY.gear[k])) return { k: 'gear', s: k };
  for (let i = 0; i < run.cap; i++) if (inRect(x, y, LAY.bag[i])) return { k: 'bag', i };
  return null;
}
function hitTarget(x, y) {
  const s = hitSlot(x, y); if (s) return s;
  if (inRect(x, y, LAY.sell)) return { k: 'sell' };
  // generous sell zone: anywhere near the bin
  const sr = LAY.sell;
  if (inRect(x, y, { x: sr.x - 10, y: sr.y - 10, w: sr.w + 20, h: sr.h + 20 })) return { k: 'sell' };
  if (inRect(x, y, LAY.scene)) return { k: 'scene' };
  return null;
}
const sameRef = (a, b) => a && b && a.k === b.k && a.i === b.i && a.s === b.s;
function setPtr(e) {
  const r = cvs.getBoundingClientRect();
  ptr.x = e.clientX - r.left; ptr.y = e.clientY - r.top;
  ptr.touch = e.pointerType === 'touch' || e.pointerType === 'pen';
}
cvs.addEventListener('pointerdown', e => {
  setPtr(e); ptr.down = true; AU.init();
  try { cvs.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
  if (e.button === 2) return;
  for (const b of BTN) if (inRect(ptr.x, ptr.y, b.r)) { b.fn(); return; }
  if (game.state !== 'play' || game.paused || run.dead) return;
  const ref = hitSlot(ptr.x, ptr.y);
  if (ref && getItem(ref)) { game.drag = { src: ref, item: getItem(ref), x0: ptr.x, y0: ptr.y, moved: false }; return; }
  if (game.sel) {
    const tgt = hitTarget(ptr.x, ptr.y);
    if (tgt && getItem(game.sel)) dropOn(game.sel, tgt);
    game.sel = null;
  }
});
cvs.addEventListener('pointermove', e => {
  setPtr(e);
  if (game.drag && !game.drag.moved && Math.hypot(ptr.x - game.drag.x0, ptr.y - game.drag.y0) > 8) { game.drag.moved = true; game.sel = null; }
  game.hover = ptr.touch ? null : hitSlot(ptr.x, ptr.y);
});
function endDrag() {
  const d = game.drag; game.drag = null;
  if (!d || game.state !== 'play' || !run || run.dead) return;
  if (getItem(d.src) !== d.item) return; // it blew up or moved while we held it
  if (d.moved) {
    const tgt = hitTarget(ptr.x, ptr.y - (ptr.touch ? LAY.S * 0.6 : 0)) || hitTarget(ptr.x, ptr.y);
    dropOn(d.src, tgt);
    return;
  }
  const now = performance.now();
  if (game.lastTap && sameRef(game.lastTap.ref, d.src) && now - game.lastTap.t < 380) {
    useItem(d.src); game.sel = null; game.lastTap = null;
  } else if (game.sel && !sameRef(game.sel, d.src)) {
    dropOn(game.sel, d.src); game.sel = null; game.lastTap = null;
  } else {
    game.sel = sameRef(game.sel, d.src) ? null : d.src;
    game.lastTap = { ref: d.src, t: now };
  }
}
cvs.addEventListener('pointerup', e => { setPtr(e); ptr.down = false; endDrag(); if (ptr.touch) game.hover = null; });
cvs.addEventListener('pointercancel', () => { ptr.down = false; game.drag = null; });
cvs.addEventListener('pointerleave', () => { if (!ptr.down) game.hover = null; });
cvs.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (game.state !== 'play' || game.paused || !run || run.dead) return;
  setPtr(e);
  const ref = hitSlot(ptr.x, ptr.y);
  if (ref && getItem(ref)) { sell(ref); if (sameRef(game.sel, ref)) game.sel = null; }
});
window.addEventListener('keydown', e => {
  AU.init();
  const k = e.key.toLowerCase();
  if (k === 'm') { AU.setMuted(!save.muted); return; }
  if (game.state === 'title' && (k === 'enter' || k === ' ')) { e.preventDefault(); newRun(); return; }
  if (game.state === 'dead' && (k === 'enter' || k === ' ' || k === 'r')) { e.preventDefault(); newRun(); return; }
  if (game.state === 'help' && (k === 'escape' || k === 'enter')) { game.state = game.wasPlaying ? 'play' : 'title'; if (game.wasPlaying) { game.paused = true; game.wasPlaying = false; } return; }
  if (game.state === 'bank' && k === 'escape') { game.state = run && run.dead ? 'dead' : 'title'; return; }
  if (game.state !== 'play' || !run || run.dead) return;
  if (k === 'escape' || k === 'p') { game.paused = !game.paused; return; }
  if (game.paused) return;
  const ref = game.hover || game.sel;
  if (ref && getItem(ref)) {
    if (k === 's' || k === 'delete' || k === 'backspace') { sell(ref); game.sel = null; }
    else if (k === 'e' || k === ' ') { e.preventDefault(); useItem(ref); game.sel = null; }
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && game.state === 'play' && run && !run.dead) game.paused = true; });
window.addEventListener('resize', resize);
window.addEventListener('blur', () => { game.drag = null; });

// ------------------------------------------------------------------ loop ---
let lastT = 0;
function frame(t) {
  const dt = Math.min(0.05, (t - lastT) / 1000 || 0);
  lastT = t;
  try { update(dt); render(); } catch (err) { console.error(err); }
  requestAnimationFrame(frame);
}
function boot() {
  loadSave();
  resize();
  if (location.hash === '#cover') game.state = 'cover';
  requestAnimationFrame(frame);
}
// Test/screenshot hook (no effect on normal play).
window.__ilg = { game, get run() { return run; }, newRun, makeGear, makeBomb, makeJunk, makePotion, recompute, save, update, LAY };
window.__ilgAPI = { sell, useItem, equipFrom, previewEquip, dropOn, unequip, spawnEnemy, spawnBoss };
const fontsReady = (document.fonts && document.fonts.load) ? Promise.all([document.fonts.load('16px "Pixelify Sans"'), document.fonts.load('16px "Press Start 2P"')]) : Promise.resolve();
Promise.race([fontsReady, new Promise(r => setTimeout(r, 1500))]).then(boot, boot);
