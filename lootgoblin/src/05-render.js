// ---------------------------------------------------------------------------
// Layout + rendering.
// ---------------------------------------------------------------------------
const LAY = { bag: [], gear: {}, goldPos: { x: 0, y: 0 }, goldPulse: 0 };

function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, 2.5);
  W = window.innerWidth; H = window.innerHeight;
  cvs.width = Math.round(W * DPR); cvs.height = Math.round(H * DPR);
  layout();
}
function layout() {
  const portrait = H > W * 1.05;
  LAY.portrait = portrait;
  let S, sceneH;
  if (!portrait) {
    sceneH = Math.round(H * 0.55);
    const ph = H - sceneH;
    S = Math.floor(Math.min((ph - 46) / 3.25, (W - 60) / 12.6));
    S = clamp(S, 30, 84);
    const g = Math.round(S * 0.1), gap = Math.round(S * 0.55);
    const gearW = 3 * S + 2 * g, bagW = BAG_COLS * S + (BAG_COLS - 1) * g, sellW = Math.round(S * 1.5);
    const total = gearW + gap + bagW + gap + sellW;
    let x = Math.round((W - total) / 2), y = sceneH + Math.round(S * 0.42) + 6;
    LAY.gearLabel = { x, y: y - 8 };
    SLOTS.forEach((k, i) => { LAY.gear[k] = { x: x + (i % 3) * (S + g), y: y + Math.floor(i / 3) * (S + g), w: S, h: S }; });
    x += gearW + gap;
    LAY.bagLabel = { x, y: y - 8 };
    for (let i = 0; i < MAXBAG; i++) LAY.bag[i] = { x: x + (i % BAG_COLS) * (S + g), y: y + Math.floor(i / BAG_COLS) * (S + g), w: S, h: S };
    LAY.bagRect = { x, y, w: bagW, h: 3 * S + 2 * g };
    x += bagW + gap;
    LAY.sell = { x, y, w: sellW, h: 2 * S + g };
    LAY.g = g;
  } else {
    S = Math.floor(Math.min((W - 24) / 6.6, (H * 0.58 - 40) / 6.3));
    S = clamp(S, 30, 80);
    sceneH = Math.round(Math.max(H * 0.4, H - (6.3 * S + 44)));
    const g = Math.round(S * 0.1);
    const rowW = 6 * S + 5 * g;
    const x0 = Math.round((W - rowW) / 2);
    let y = sceneH + Math.round(S * 0.42) + 6;
    LAY.gearLabel = { x: x0, y: y - 8 };
    SLOTS.forEach((k, i) => { LAY.gear[k] = { x: x0 + i * (S + g), y, w: S, h: S }; });
    y += S + Math.round(S * 0.55) + 6;
    LAY.bagLabel = { x: x0, y: y - 8 };
    for (let i = 0; i < MAXBAG; i++) LAY.bag[i] = { x: x0 + (i % BAG_COLS) * (S + g), y: y + Math.floor(i / BAG_COLS) * (S + g), w: S, h: S };
    LAY.bagRect = { x: x0, y, w: rowW, h: 3 * S + 2 * g };
    y += 3 * S + 2 * g + Math.round(S * 0.25);
    LAY.sell = { x: x0, y, w: rowW, h: Math.max(38, Math.round(S * 0.8)) };
    LAY.g = g;
  }
  LAY.S = S;
  LAY.scene = { x: 0, y: 0, w: W, h: sceneH };
  LAY.P = Math.max(2, Math.floor(sceneH / 66));
  LAY.gy = Math.round(sceneH * 0.82);
  LAY.hx = Math.round(Math.min(W * 0.26, W / 2 - 40));
  LAY.viewU = (W - LAY.hx) / LAY.P;
  LAY.fs = clamp(S * 0.29, 12, 18);
}

// ---------------------------------------------------------------- scene ----
function hash(a, b) { let h = (a * 374761393 + b * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function drawScene() {
  const sc = LAY.scene, P = LAY.P, gy = LAY.gy;
  const th = THEMES[(run ? run.floor : 0) % THEMES.length];
  const scroll = run ? run.scroll : game.t * 40;
  ctx.fillStyle = th.bg; ctx.fillRect(0, 0, sc.w, sc.h);
  // back wall bricks (parallax 0.6)
  const bw = 16 * P, bh = 8 * P, off = scroll * 0.6 * P;
  const top = Math.round(sc.h * 0.06);
  const rows = Math.ceil((gy - top) / bh);
  for (let r = 0; r < rows; r++) {
    const y = gy - (r + 1) * bh;
    const shift = (r % 2) * bw / 2;
    const c0 = Math.floor((off - shift) / bw) - 1;
    for (let c = c0; c < c0 + Math.ceil(sc.w / bw) + 3; c++) {
      const x = Math.round(c * bw + shift - off);
      const hv = hash(c, r);
      ctx.fillStyle = hv < 0.5 ? th.wall : th.wall2;
      ctx.fillRect(x, y, bw - P, bh - P);
      if (hv > 0.9) { ctx.fillStyle = th.accent; ctx.globalAlpha = 0.35; ctx.fillRect(x, y + bh - 3 * P, bw - P, 2 * P); ctx.globalAlpha = 1; }
      else if (hv < 0.06) { ctx.fillStyle = th.mortar; ctx.fillRect(x + 4 * P, y + 2 * P, 2 * P, 3 * P); }
    }
  }
  // ceiling shadow
  const grd = ctx.createLinearGradient(0, 0, 0, sc.h * 0.45);
  grd.addColorStop(0, 'rgba(5,2,12,0.95)'); grd.addColorStop(1, 'rgba(5,2,12,0)');
  ctx.fillStyle = grd; ctx.fillRect(0, 0, sc.w, sc.h * 0.45);
  // torches
  const tg = 112 * P, toff = scroll * 0.6 * P;
  for (let c = Math.floor(toff / tg) - 1; c < Math.floor(toff / tg) + Math.ceil(sc.w / tg) + 2; c++) {
    const x = Math.round(c * tg - toff + tg * 0.5), y = gy - 30 * P;
    const fl = 0.85 + 0.15 * Math.sin(game.t * 13 + c * 7) + 0.08 * Math.sin(game.t * 31 + c);
    const rg = ctx.createRadialGradient(x, y, 0, x, y, 46 * P * fl);
    rg.addColorStop(0, hexA(th.glow, 0.34)); rg.addColorStop(1, hexA(th.glow, 0));
    ctx.fillStyle = rg; ctx.fillRect(x - 50 * P, y - 50 * P, 100 * P, 100 * P);
    ctx.fillStyle = '#4a3020'; ctx.fillRect(x - P, y, 2 * P, 6 * P);
    ctx.fillStyle = '#2a1a10'; ctx.fillRect(x - 2 * P, y + P, 4 * P, P);
    ctx.fillStyle = th.glow; ctx.fillRect(x - P, y - 3 * P * fl, 2 * P, 3 * P * fl);
    ctx.fillStyle = '#fff3c4'; ctx.fillRect(x - P / 2, y - 2 * P * fl, P, 2 * P * fl);
  }
  // floor
  ctx.fillStyle = th.floor; ctx.fillRect(0, gy, sc.w, sc.h - gy);
  const fw = 24 * P, foff = scroll * P;
  for (let c = Math.floor(foff / fw) - 1; c < Math.floor(foff / fw) + Math.ceil(sc.w / fw) + 2; c++) {
    const x = Math.round(c * fw - foff);
    ctx.fillStyle = th.floor2;
    ctx.fillRect(x, gy + 4 * P, P, sc.h - gy);
    if (hash(c, 99) > 0.6) ctx.fillRect(x + 8 * P, gy + 9 * P, 6 * P, P);
  }
  ctx.fillStyle = shade(th.floor, 0.18); ctx.fillRect(0, gy, sc.w, P);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, gy + P, sc.w, 2 * P);
  // vignette at bottom of scene
  const vg = ctx.createLinearGradient(0, sc.h - 18, 0, sc.h);
  vg.addColorStop(0, 'rgba(11,7,20,0)'); vg.addColorStop(1, 'rgba(11,7,20,1)');
  ctx.fillStyle = vg; ctx.fillRect(0, sc.h - 18, sc.w, 18);
}

function drawSprite(img, x, y, scale, flip, alpha, sx, sy) {
  const w = img.width * scale * (sx || 1), h = img.height * scale * (sy || 1);
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.translate(Math.round(x), Math.round(y));
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(img, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  ctx.restore();
}

function drawHero(x, gy, P, opts) {
  opts = opts || {};
  const gear = opts.gear || (run ? run.gear : {});
  const moving = opts.moving != null ? opts.moving : (run && !run.fighting && !run.jackpot);
  const lt = opts.legT != null ? opts.legT : (run ? run.legT : game.t * 10);
  const frame = moving ? Math.floor(lt) % 4 : 0;
  const bob = moving && (frame === 1 || frame === 3) ? -P : 0;
  const eyes = opts.eyes != null ? opts.eyes : (run && run.eyes > 0);
  const hurt = run && run.hurtT > 0;
  const atk = run ? run.attackAnim : 0;
  const lean = atk > 0 ? 2 * P : 0;
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 6 * P, gy - P, 12 * P, 2 * P);
  // loot sack on the back grows with the bag; turns red when it's about to burst
  const fill = opts.fill != null ? opts.fill : (run ? bagCount() / run.cap : 0.3);
  const sr = (3 + fill * 4) * P, sx = x - 7 * P + lean / 2, sy = gy - 9 * P + bob;
  const full = fill >= 1, pulse = full ? 0.5 + 0.5 * Math.sin(game.t * 18) : 0;
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(sx, sy - sr * 0.6, sr + P, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = full ? (pulse > 0.5 ? '#ff3b5c' : '#b8862b') : '#b8862b';
  ctx.beginPath(); ctx.arc(sx, sy - sr * 0.6, sr, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(sx - sr * 0.5, sy - sr * 1.2, P * 2, P);
  // legs + body + helm
  const armorCol = gear.armor ? RAR[gear.armor.rarity].c : null;
  const bootCol = gear.boots ? RAR[gear.boots.rarity].c : null;
  drawSprite(heroLegs(frame, bootCol), x + lean, gy, P);
  const body = heroBody(armorCol, eyes, hurt);
  drawSprite(body, x + lean, gy - 4 * P + bob, P);
  if (gear.helm) drawSprite(helmSprite(RAR[gear.helm.rarity].c), x + lean, gy - 14 * P + bob, P);
  // weapon in hand, swinging when attacking
  const wp = gear.weapon;
  if (wp) {
    const ic = iconSprite(wp.icon, RAR[wp.rarity].c);
    const hxp = x + 5 * P + lean, hyp = gy - 6 * P + bob;
    const swing = atk > 0 ? (1 - atk / 0.14) : 0;
    const ang = atk > 0 ? lerp(-1.6, 0.9, ease(swing)) : -0.35 + Math.sin(lt * 0.6) * 0.06;
    ctx.save(); ctx.translate(hxp, hyp); ctx.rotate(ang);
    ctx.drawImage(ic, -2 * P, -10 * P, 12 * P, 12 * P);
    ctx.restore();
    if (atk > 0.05) {
      ctx.strokeStyle = hexA(RAR[wp.rarity].c, 0.7); ctx.lineWidth = 2 * P;
      ctx.beginPath(); ctx.arc(hxp, hyp, 12 * P, -1.3, 0.9 * ease(swing)); ctx.stroke();
    }
  } else if (atk > 0.05) {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 9 * P, gy - 8 * P, 3 * P, 2 * P);
  }
}

function enemySprite(e) {
  if (e.type === 'taxman') return sprite(SPR.body, ENEMY_PAL.taxman, 'boss-tax');
  return sprite(SPR[e.type], ENEMY_PAL[e.type], 'en|' + e.type);
}
function drawEnemy(e) {
  const P = LAY.P, x = LAY.hx + e.dx * P - (e.lunge ? 4 * P : 0);
  let y = LAY.gy;
  if (e.fly) y -= (8 + Math.sin(e.bob) * 3) * P * (e.boss ? 1 : 1);
  const sq = e.type === 'slime' ? 1 + Math.sin(e.bob) * 0.08 : 1;
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 6 * P * e.scale, LAY.gy - P, 12 * P * e.scale, 2 * P);
  const img = enemySprite(e);
  const flip = e.type === 'taxman';
  drawSprite(img, x, y, P * e.scale, flip, e.type === 'ghost' ? 0.8 : 1, 2 - sq, sq);
  if (e.type === 'taxman') {
    drawSprite(sprite(SPR.tophat, { o: OUT, k: '#1a1a2e', r: '#c46bff' }, 'tophat'), x - P * e.scale, y - 11 * P * e.scale, P * e.scale);
    drawSprite(sprite(SPR.legs[Math.floor(game.t * 6) % 4], Object.assign({}, ENEMY_PAL.taxman, { f: '#1a1a2e' }), 'taxlegs' + Math.floor(game.t * 6) % 4), x, y + 4 * P * e.scale, P * e.scale, true);
  }
  if (e.bid === 'mimicking') drawSprite(sprite(SPR.crown, { o: OUT, y: '#f2c14e', r: '#e0435f' }, 'crown'), x, y - 12 * P * e.scale, P * e.scale);
  if (e.hurt > 0) {
    ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = e.hurt * 6;
    drawSprite(img, x, y, P * e.scale, flip, null, 2 - sq, sq);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  // HP bar
  if (e.hp < e.maxHp && !e.boss) {
    const bw = 14 * P, bx = x - bw / 2, by = y - 18 * P * e.scale;
    ctx.fillStyle = OUT; ctx.fillRect(bx - 1, by - 1, bw + 2, P + 2);
    ctx.fillStyle = '#ff3b5c'; ctx.fillRect(bx, by, bw * clamp(e.hp / e.maxHp, 0, 1), P);
  }
}

function drawChest(c) {
  const P = LAY.P, x = LAY.hx + c.dx * P, y = LAY.gy - c.h * P;
  const it = c.item, col = c.st === 'spin' ? RAR[Math.floor(c.t * 30) % 5].c : (c.st === 'open' ? itemColor(it) : '#f2c14e');
  const s = chestSprites(col);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 7 * P, LAY.gy - P, 14 * P, 2 * P);
  if (c.st === 'open') {
    const a = Math.max(0, 1 - c.t / 1.2);
    if (a > 0) {
      // rarity light beam
      const bwid = (it.rarity >= 3 ? 16 : 10) * P;
      const g = ctx.createLinearGradient(0, y - 80 * P, 0, y);
      g.addColorStop(0, hexA(col, 0)); g.addColorStop(1, hexA(col, 0.55 * a));
      ctx.fillStyle = g; ctx.fillRect(x - bwid / 2, y - 80 * P, bwid, 80 * P - 4 * P);
    }
    drawSprite(s.base, x, y, P);
    ctx.save(); ctx.translate(x - 6 * P, y - 6 * P); ctx.rotate(-0.9);
    ctx.drawImage(s.lid, -P, -4 * P, 14 * P, 4 * P); ctx.restore();
  } else {
    const shake = c.st === 'spin' ? Math.sin(c.t * 80) * P : 0;
    drawSprite(s.base, x + shake, y, P);
    drawSprite(s.lid, x + shake, y - 6 * P, P);
  }
}

function drawItemIcon(it, x, y, size, alpha) {
  const ic = iconSprite(it.icon, it.kind === 'gear' ? RAR[it.rarity].c : null, it.kind === 'potion' ? it.col : null);
  ctx.save();
  if (alpha != null) ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(ic, Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
  ctx.restore();
}

function drawWorld() {
  const sc = LAY.scene, P = LAY.P;
  ctx.save();
  ctx.beginPath(); ctx.rect(0, 0, sc.w, sc.h); ctx.clip();
  let sh = 0;
  if (run && run.shake > 0) sh = run.shake * 8;
  ctx.translate(rr(-sh, sh), rr(-sh, sh));
  drawScene();
  if (!run) { ctx.restore(); return; }
  for (const c of run.chests) drawChest(c);
  for (let i = run.enemies.length - 1; i >= 0; i--) drawEnemy(run.enemies[i]);
  if (!(run.dead && run.exploded)) drawHero(LAY.hx, LAY.gy, P);
  // death-stare beams
  for (const b of run.beams) {
    ctx.strokeStyle = hexA('#ff3b5c', 1 - b.t / 0.25); ctx.lineWidth = 2 * P;
    ctx.beginPath(); ctx.moveTo(LAY.hx + 3 * P, LAY.gy - 12 * P); ctx.lineTo(LAY.hx + b.dx * P, LAY.gy - b.h * P); ctx.stroke();
  }
  // thrown bombs
  for (const s2 of run.shots) {
    const t = s2.t / s2.dur, x = LAY.hx + lerp(s2.x0, s2.x1, t) * P, y = LAY.gy - (s2.h0 + Math.sin(t * Math.PI) * 26) * P;
    drawItemIcon({ icon: 'bomb', kind: 'bomb' }, x, y, 10 * P);
  }
  // damage numbers
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const n of run.nums) {
    if (n.screen) continue;
    const t = n.t / 0.9, x = LAY.hx + n.dx * P, y = LAY.gy - n.h * P - ease(Math.min(1, t * 1.6)) * 26;
    const sz = Math.round(LAY.fs * (0.9 + 0.35 * n.size) * (t < 0.12 ? 1 + (0.12 - t) * 4 : 1));
    ctx.font = f(sz, true);
    ctx.globalAlpha = t > 0.7 ? (1 - t) / 0.3 : 1;
    ctx.fillStyle = OUT; ctx.fillText(n.text, x + 2, y + 2);
    ctx.fillStyle = n.col; ctx.fillText(n.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFx() {
  for (const p of run.fx) {
    const a = clamp(p.life / (p.max * 0.5), 0, 1);
    if (p.coin) {
      drawSprite(sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin'), p.x, p.y + 3 * 2, 2, false, a);
    } else if (p.icon) {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot || 0);
      drawItemIcon(p.icon, 0, 0, p.size, a); ctx.restore();
    } else {
      ctx.globalAlpha = a; ctx.fillStyle = p.col;
      ctx.fillRect(Math.round(p.x - p.size / 2), Math.round(p.y - p.size / 2), Math.ceil(p.size), Math.ceil(p.size));
    }
  }
  ctx.globalAlpha = 1;
  for (const n of run.nums) {
    if (!n.screen) continue;
    const t = n.t / 0.9;
    ctx.font = f(LAY.fs * 1.1, true); ctx.textAlign = 'center';
    ctx.globalAlpha = 1 - t;
    ctx.fillStyle = OUT; ctx.fillText(n.text, n.x + 2, n.y - t * 30 + 2);
    ctx.fillStyle = n.col; ctx.fillText(n.text, n.x, n.y - t * 30);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------------ text ---
function txt(s, x, y, size, col, align, bold, title) {
  ctx.font = title ? tf(size) : f(size, bold);
  ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = OUT; ctx.fillText(s, x + Math.max(1, size / 10), y + Math.max(1, size / 10));
  ctx.fillStyle = col || '#fff'; ctx.fillText(s, x, y);
}
function wrap(s, maxW, size, bold) {
  ctx.font = f(size, bold);
  const words = s.split(' '), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function panel(x, y, w, h, fill, stroke, lw) {
  ctx.fillStyle = fill || 'rgba(20,12,36,0.94)'; ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke || '#4a3a6a'; ctx.lineWidth = lw || 2;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
}

// ------------------------------------------------------------------- HUD ---
function drawHUD() {
  const fs = LAY.fs, s = run.stats, pad = 12;
  // HP bar
  ctx.font = tf(fs * 1.55);
  const depthW = ctx.measureText(Math.floor(run.depth) + ' m').width;
  const bw = Math.max(110, Math.min(LAY.scene.w * 0.32, 300, W - pad * 2 - (fs * 2.1 * 2 + 6) - depthW - 30)), bh = Math.round(fs * 1.35);
  const x = pad, y = pad;
  const hpF = clamp(run.hp / s.maxHp, 0, 1);
  panel(x, y, bw, bh, '#1a0f2a', OUT, 2);
  const low = hpF < 0.3;
  ctx.fillStyle = low && Math.sin(game.t * 14) > 0 ? '#ff7a8f' : '#e0435f';
  ctx.fillRect(x + 3, y + 3, (bw - 6) * hpF, bh - 6);
  ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x + 3, y + 3, (bw - 6) * hpF, 3);
  txt(fmt(Math.max(0, run.hp)) + ' / ' + fmt(s.maxHp), x + bw / 2, y + bh / 2 + 1, fs * 0.9, '#fff', 'center', true);
  // stat line
  const sl = 'DMG ' + fmt(effDmg()) + '   SPD ' + effAps().toFixed(1) + '/s   DPS ' + fmt(dps());
  txt(sl, x, y + bh + fs * 0.85, fs * 0.85, '#d9cff5', 'left');
  // buffs
  let bx = x;
  const by = y + bh + fs * 2;
  for (const b of run.buffs) {
    const lab = { rage: 'RAGE', haste: 'ZOOM', greed: 'GREED', confuse: 'BLINKY' }[b.id];
    const col = { rage: '#ff8c1a', haste: '#4ee0ff', greed: '#f2c14e', confuse: '#b45cff' }[b.id];
    ctx.font = f(fs * 0.8, true);
    const w = ctx.measureText(lab).width + 26;
    panel(bx, by - fs * 0.6, w, fs * 1.2, hexA(col, 0.25), col, 1);
    txt(lab + ' ' + Math.ceil(b.t), bx + w / 2, by, fs * 0.8, col, 'center', true);
    bx += w + 6;
  }
  // top-right: depth, gold, buttons
  const bs = Math.round(fs * 2.1);
  LAY.pauseBtn = { x: W - pad - bs, y: pad, w: bs, h: bs };
  LAY.muteBtn = { x: W - pad - bs * 2 - 6, y: pad, w: bs, h: bs };
  iconButton(LAY.pauseBtn, 'pause');
  iconButton(LAY.muteBtn, save.muted ? 'muted' : 'sound');
  const rx = LAY.muteBtn.x - 14;
  txt(Math.floor(run.depth) + ' m', rx, pad + fs * 0.9, fs * 1.55, '#ffffff', 'right', false, true);
  txt('BEST ' + Math.max(save.best, Math.floor(run.depth)) + ' m', rx, pad + fs * 2.45, fs * 0.8, '#a99fc4', 'right', true);
  const gp = 1 + (LAY.goldPulse || 0) * 1.5;
  txt(fmt(run.gold), rx - 4, pad + fs * 3.7, fs * 1.1 * gp, '#f2c14e', 'right', true);
  ctx.font = f(fs * 1.1 * gp, true);
  const gw = ctx.measureText(fmt(run.gold)).width;
  drawSprite(sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin'), rx - gw - 16, pad + fs * 3.7 + 7, 2.4);
  LAY.goldPos = { x: rx - gw - 16, y: pad + fs * 3.7 };
  // boss bar
  if (run.boss) {
    const e = run.boss, w = Math.min(LAY.scene.w * 0.5, 420), bx2 = (LAY.scene.w - w) / 2, by2 = LAY.scene.h * 0.18;
    txt(e.name, LAY.scene.w / 2, by2 - fs * 0.9, fs * 0.95, '#ff9a1f', 'center', false, true);
    panel(bx2, by2, w, fs * 0.9, '#1a0f2a', OUT, 2);
    ctx.fillStyle = '#ff9a1f'; ctx.fillRect(bx2 + 3, by2 + 3, (w - 6) * clamp(e.hp / e.maxHp, 0, 1), fs * 0.9 - 6);
  }
  // banner
  if (run.banner) {
    const b = run.banner, a = b.t < 0.3 ? b.t / 0.3 : b.t > 2.4 ? (3 - b.t) / 0.6 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const y2 = LAY.scene.h * 0.36;
    ctx.fillStyle = 'rgba(8,4,16,0.6)'; ctx.fillRect(0, y2 - fs * 1.6, W, fs * 3.4);
    txt(b.title, W / 2, y2 - fs * 0.35, Math.min(fs * 1.35, W / (b.title.length * 1.15)), '#ffe08a', 'center', false, true);
    txt(b.sub, W / 2, y2 + fs * 1.05, fs * 0.95, '#d9cff5', 'center', true);
    ctx.globalAlpha = 1;
  }
  // toasts
  let ty = run.jackpot ? LAY.scene.h * 0.24 + Math.min(W * 0.7, 360) * 0.42 + LAY.fs * 1.6 : LAY.scene.h * (run.banner ? 0.56 : 0.46);
  for (const t of run.toasts) {
    const a = t.t < 0.12 ? t.t / 0.12 : t.t > t.dur - 0.3 ? (t.dur - t.t) / 0.3 : 1;
    ctx.globalAlpha = clamp(a, 0, 1);
    const sz = Math.min(fs * 1.15, (W - 30) / (t.text.length * 0.55));
    txt(t.text, W / 2, ty - (1 - Math.min(1, t.t * 6)) * 8, sz, t.col, 'center', true);
    ty += sz * 1.45;
  }
  ctx.globalAlpha = 1;
  // jackpot reels
  if (run.jackpot) drawJackpot();
}
function iconButton(r, kind) {
  const hov = inRect(ptr.x, ptr.y, r) && !ptr.touch;
  panel(r.x, r.y, r.w, r.h, hov ? '#3a2a5a' : 'rgba(26,15,42,0.85)', '#5a4a7a', 2);
  ctx.fillStyle = '#e8e0ff';
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2, u = r.w / 10;
  if (kind === 'pause') { ctx.fillRect(cx - 2.5 * u, cy - 3 * u, 1.8 * u, 6 * u); ctx.fillRect(cx + 0.7 * u, cy - 3 * u, 1.8 * u, 6 * u); }
  else if (kind === 'play') { ctx.beginPath(); ctx.moveTo(cx - 2 * u, cy - 3 * u); ctx.lineTo(cx + 3 * u, cy); ctx.lineTo(cx - 2 * u, cy + 3 * u); ctx.fill(); }
  else {
    ctx.fillRect(cx - 3.5 * u, cy - 1.2 * u, 2 * u, 2.4 * u);
    ctx.beginPath(); ctx.moveTo(cx - 1.5 * u, cy - 1.2 * u); ctx.lineTo(cx + 1 * u, cy - 3.4 * u); ctx.lineTo(cx + 1 * u, cy + 3.4 * u); ctx.lineTo(cx - 1.5 * u, cy + 1.2 * u); ctx.fill();
    ctx.strokeStyle = kind === 'muted' ? '#ff5a76' : '#e8e0ff'; ctx.lineWidth = Math.max(2, u * 0.7);
    if (kind === 'muted') { ctx.beginPath(); ctx.moveTo(cx + 2 * u, cy - 2 * u); ctx.lineTo(cx + 4.4 * u, cy + 2 * u); ctx.moveTo(cx + 4.4 * u, cy - 2 * u); ctx.lineTo(cx + 2 * u, cy + 2 * u); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(cx + 1.3 * u, cy, 2.6 * u, -0.8, 0.8); ctx.stroke(); }
  }
}
function drawJackpot() {
  const j = run.jackpot, fs = LAY.fs;
  const cw = Math.min(W * 0.7, 360), ch = cw * 0.42, x = (LAY.scene.w - cw) / 2, y = LAY.scene.h * 0.24;
  const a = j.t > 2.8 ? clamp((3.2 - j.t) / 0.4, 0, 1) : clamp(j.t / 0.2, 0, 1);
  ctx.globalAlpha = a;
  panel(x - 6, y - 6, cw + 12, ch + 12, '#f2c14e', OUT, 3);
  panel(x, y, cw, ch, '#2a0d3a', '#ff4fd8', 3);
  txt(j.t > 2.0 ? (j.match === 3 ? 'MEGA JACKPOT!' : j.match === 2 ? 'JACKPOT!' : 'SO CLOSE!') : 'BOSS JACKPOT', x + cw / 2, y - fs * 1.2, fs * 1.1, '#ffe08a', 'center', false, true);
  const rw = (cw - 40) / 3;
  for (let i = 0; i < 3; i++) {
    const rx = x + 10 + i * (rw + 10), ry = y + 10, rh = ch - 20;
    ctx.fillStyle = '#fff7e6'; ctx.fillRect(rx, ry, rw, rh);
    const stopT = 0.8 + i * 0.5;
    const sym = j.t < stopT ? REEL_SYMS[Math.floor(j.t * 22 + i * 3) % REEL_SYMS.length] : j.res[i];
    const it = sym === 'potion' ? { icon: 'potion', kind: 'potion', col: '#ff4f6d' } : sym === 'bomb' ? { icon: 'bomb', kind: 'bomb' } : { icon: sym, kind: 'gear', rarity: R_LEG };
    const off = j.t < stopT ? (j.t * 900) % rh - rh / 2 : 0;
    ctx.save(); ctx.beginPath(); ctx.rect(rx, ry, rw, rh); ctx.clip();
    drawItemIcon(it, rx + rw / 2, ry + rh / 2 + off * 0.2, Math.min(rw, rh) * 0.8);
    ctx.restore();
    ctx.strokeStyle = OUT; ctx.lineWidth = 3; ctx.strokeRect(rx, ry, rw, rh);
  }
  ctx.globalAlpha = 1;
}

// ------------------------------------------------------------- inventory ---
function slotBox(r, col, glow, hot) {
  ctx.fillStyle = hot ? '#3a2a5a' : '#1c1230'; ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(r.x, r.y, r.w, 3);
  if (glow) {
    const g = ctx.createRadialGradient(r.x + r.w / 2, r.y + r.h / 2, 2, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.7);
    g.addColorStop(0, hexA(col, 0.35)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  ctx.strokeStyle = col || '#3d2f5c'; ctx.lineWidth = glow ? 3 : 2;
  ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
}
function drawInventory() {
  const S = LAY.S, fs = LAY.fs;
  ctx.fillStyle = '#0b0714'; ctx.fillRect(0, LAY.scene.h, W, H - LAY.scene.h);
  ctx.fillStyle = '#2a1d45'; ctx.fillRect(0, LAY.scene.h, W, 3);
  const drag = game.drag && game.drag.moved ? game.drag : null;
  const dragIt = drag ? getItem(drag.src) : null;
  const selIt = game.sel ? getItem(game.sel) : null;
  const active = dragIt || selIt;
  // GEAR
  txt('GEAR', LAY.gearLabel.x, LAY.gearLabel.y - fs * 0.3, fs * 0.8, '#a99fc4', 'left', false, true);
  for (const k of SLOTS) {
    const r = LAY.gear[k], it = run.gear[k];
    const can = active && active.kind === 'gear' && active.slot === k && !(drag && drag.src.k === 'gear');
    const hot = (drag && inRect(ptr.x, ptr.y, r)) || (game.hover && game.hover.k === 'gear' && game.hover.s === k);
    slotBox(r, can ? '#ffe08a' : it ? RAR[it.rarity].c : '#3d2f5c', can || (it && it.rarity >= 3), hot);
    if (it && !(drag && drag.src.k === 'gear' && drag.src.s === k)) {
      drawItemIcon(it, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.78);
      if (isBound(it)) { ctx.fillStyle = 'rgba(255,59,92,0.25)'; ctx.fillRect(r.x, r.y, r.w, r.h); txt(Math.ceil(it.boundUntil - run.t) + 's', r.x + r.w - 4, r.y + r.h - fs * 0.6, fs * 0.8, '#ff5a76', 'right', true); }
    } else if (!it) {
      drawItemIcon({ icon: SLOT_ICON[k], kind: 'gear', rarity: 0 }, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.6, 0.18);
    }
    if (game.sel && game.sel.k === 'gear' && game.sel.s === k) selRing(r);
  }
  // BAG
  const n = bagCount(), full = n >= run.cap;
  const ci = chestInterval(), ct = run.jackpot ? ci : Math.max(0, run.chestT);
  const danger = full && !run.dead;
  txt('BAG ' + n + '/' + run.cap, LAY.bagLabel.x, LAY.bagLabel.y - fs * 0.3, fs * 0.8, danger ? '#ff5a76' : '#a99fc4', 'left', false, true);
  // next-chest timer
  ctx.font = tf(fs * 0.8); const lw = ctx.measureText('BAG ' + n + '/' + run.cap).width;
  const tx = LAY.bagLabel.x + lw + 16, ty = LAY.bagLabel.y - fs * 0.3;
  const cs = chestSprites('#f2c14e');
  drawSprite(cs.base, tx + 10, ty + 6, 1.4); drawSprite(cs.lid, tx + 10, ty - 2.4, 1.4);
  ctx.strokeStyle = danger ? '#ff3b5c' : '#f2c14e'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(tx + 10, ty, 15, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - ct / ci)); ctx.stroke();
  txt(danger ? 'FULL! next loot in ' + ct.toFixed(1) + 's' : 'next loot ' + ct.toFixed(1) + 's', tx + 32, ty, fs * 0.85, danger ? (Math.sin(game.t * 16) > 0 ? '#ff3b5c' : '#ffe08a') : '#d9cff5', 'left', true);
  for (let i = 0; i < Math.min(MAXBAG, Math.ceil(Math.max(run.cap, 6) / BAG_COLS) * BAG_COLS); i++) {
    const r = LAY.bag[i];
    if (i >= run.cap) { ctx.fillStyle = 'rgba(28,18,48,0.35)'; ctx.fillRect(r.x, r.y, r.w, r.h); continue; }
    const it = run.bag[i];
    const hot = (drag && inRect(ptr.x, ptr.y, r)) || (game.hover && game.hover.k === 'bag' && game.hover.i === i);
    const pulse = danger ? 0.5 + 0.5 * Math.sin(game.t * 12) : 0;
    slotBox(r, danger ? (pulse > 0.5 ? '#ff3b5c' : '#7a1f33') : it ? itemColor(it) : '#3d2f5c', it && (it.rarity >= 3 || it.kind === 'bomb'), hot);
    if (it && !(drag && drag.src.k === 'bag' && drag.src.i === i)) {
      let jx = 0;
      if (it.kind === 'bomb' && it.fuse < 4) jx = Math.sin(game.t * 50) * 2;
      drawItemIcon(it, r.x + r.w / 2 + jx, r.y + r.h / 2, r.w * 0.78);
      if (it.kind === 'bomb') txt(Math.ceil(it.fuse) + '', r.x + r.w - 5, r.y + fs * 0.7, fs * 0.95, it.fuse < 4 ? '#ff3b5c' : '#ffe08a', 'right', true);
      if (it.kind === 'gear') {
        const pv = previewEquip(it);
        if (pv && pv.dps > 0.05 && it.slot === 'weapon') arrowUp(r);
        else if (pv && !run.gear[it.slot]) arrowUp(r);
        if (it.rarity === R_CUR) txt('☠', r.x + 5, r.y + fs * 0.7, fs * 0.9, '#ff5a76', 'left', true);
      }
    }
    if (game.sel && game.sel.k === 'bag' && game.sel.i === i) selRing(r);
  }
  // SELL bin (on phones it hugs the last visible bag row)
  if (LAY.portrait) {
    const last = LAY.bag[Math.ceil(Math.max(run.cap, 6) / BAG_COLS) * BAG_COLS - 1];
    LAY.sell.y = last.y + last.h + Math.round(S * 0.3);
  }
  const sr = LAY.sell;
  const hotSell = (drag && inRect(ptr.x, ptr.y, sr)) || (selIt && inRect(ptr.x, ptr.y, sr));
  panel(sr.x, sr.y, sr.w, sr.h, hotSell ? '#4a3510' : '#24180c', active ? '#f2c14e' : '#6b5420', active ? 3 : 2);
  const coin = sprite(SPR.coin, { o: OUT, g: '#f2c14e', G: '#b8862b' }, 'coin');
  if (LAY.portrait) {
    drawSprite(coin, sr.x + sr.w / 2 - fs * 2.4, sr.y + sr.h / 2 + 8, 2.6);
    txt('SELL', sr.x + sr.w / 2 + fs * 0.6, sr.y + sr.h / 2, fs * 1.0, '#f2c14e', 'center', false, true);
  } else {
    drawSprite(coin, sr.x + sr.w / 2, sr.y + sr.h * 0.42 + 8, Math.max(2.4, LAY.S / 16));
    txt('SELL', sr.x + sr.w / 2, sr.y + sr.h * 0.66, fs * 0.9, '#f2c14e', 'center', false, true);
    if (active) txt('+' + fmt(sellValue(active, run)) + 'g', sr.x + sr.w / 2, sr.y + sr.h * 0.84, fs * 0.9, '#ffe08a', 'center', true);
  }
  // hint
  if (run.hint && !drag) drawHint(run.hint);
  // dragged item follows the pointer
  if (dragIt) {
    drawItemIcon(dragIt, ptr.x, ptr.y - (ptr.touch ? S * 0.6 : 0), S * 0.95);
    if (inRect(ptr.x, ptr.y, LAY.scene)) {
      const lab = dragIt.kind === 'potion' ? 'DRINK' : dragIt.kind === 'bomb' ? 'THROW!' : dragIt.kind === 'gear' ? 'EQUIP' : '';
      if (lab) txt(lab, ptr.x, ptr.y - S * (ptr.touch ? 1.3 : 0.75), fs * 1.1, '#ffe08a', 'center', true);
    }
  }
}
function arrowUp(r) {
  const s = Math.max(4, r.w / 10), x = r.x + r.w - s * 1.8, y = r.y + r.h - s * 1.6;
  const bob = Math.sin(game.t * 6) * 1.5;
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.moveTo(x - s - 1, y + bob + 1); ctx.lineTo(x, y - s * 1.2 + bob - 1); ctx.lineTo(x + s + 1, y + bob + 1); ctx.fill();
  ctx.fillStyle = '#5fd35f'; ctx.beginPath(); ctx.moveTo(x - s, y + bob); ctx.lineTo(x, y - s * 1.1 + bob); ctx.lineTo(x + s, y + bob); ctx.fill();
}
function selRing(r) {
  const p = 2 + Math.sin(game.t * 8) * 2;
  ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3;
  ctx.strokeRect(r.x - p, r.y - p, r.w + 2 * p, r.h + 2 * p);
}
function drawHint(h) {
  const r = h.ref.k === 'bag' ? LAY.bag[h.ref.i] : LAY.gear[h.ref.s];
  if (!r) return;
  const fs = LAY.fs, w = Math.min(W - 24, 300);
  const lines = wrap(h.text, w - 20, fs * 0.95, true);
  const hh = lines.length * fs * 1.25 + 16;
  let x = clamp(r.x + r.w / 2 - w / 2, 12, W - w - 12), y = r.y - hh - 18 - Math.abs(Math.sin(game.t * 4)) * 6;
  if (y < LAY.scene.h * 0.25) y = r.y + r.h + 14;
  panel(x, y, w, hh, '#ffe08a', OUT, 3);
  lines.forEach((l, i) => { ctx.font = f(fs * 0.95, true); ctx.textAlign = 'left'; ctx.fillStyle = '#2a1640'; ctx.fillText(l, x + 10, y + 10 + fs * 0.6 + i * fs * 1.25); });
  ctx.fillStyle = '#ffe08a'; ctx.beginPath();
  const ax = r.x + r.w / 2;
  if (y < r.y) { ctx.moveTo(ax - 8, y + hh - 2); ctx.lineTo(ax + 8, y + hh - 2); ctx.lineTo(ax, y + hh + 12); }
  else { ctx.moveTo(ax - 8, y + 2); ctx.lineTo(ax + 8, y + 2); ctx.lineTo(ax, y - 12); }
  ctx.fill();
}

// ------------------------------------------------------------- tooltip -----
function drawTooltip(ref, anchor) {
  const it = getItem(ref); if (!it) return;
  const fs = LAY.fs, w = Math.min(W - 16, Math.max(250, fs * 20));
  const col = itemColor(it);
  const rows = [];
  const kindName = it.kind === 'gear' ? RAR[it.rarity].name + ' ' + SLOT_NAME[it.slot] : it.kind === 'potion' ? 'Potion' : it.kind === 'bomb' ? 'Bomb' : 'Junk';
  rows.push({ t: it.name, c: col, size: 1.1, bold: true });
  rows.push({ t: kindName + (it.kind === 'gear' ? ' · Lv ' + it.level : ''), c: '#a99fc4', size: 0.85 });
  for (const l of itemLines(it)) rows.push({ t: l.t, c: l.c, size: l.big ? 1.0 : 0.92, bold: l.big });
  if (it.kind === 'gear' && ref.k === 'bag') {
    const pv = previewEquip(it);
    if (pv) {
      const cmp = run.gear[it.slot] ? 'vs. equipped ' + SLOT_NAME[it.slot].toLowerCase() : 'Empty slot: equip it!';
      rows.push({ t: cmp, c: '#a99fc4', size: 0.85, gap: true });
      rows.push({ t: 'DPS ' + (pv.dps >= 0 ? '▲ +' : '▼ ') + Math.round(pv.dps * 100) + '%    HP ' + (pv.hp >= 0 ? '▲ +' : '▼ ') + Math.round(pv.hp * 100) + '%', c: pv.dps >= 0 ? '#5fd35f' : '#ff5a76', size: 1.0, bold: true, split: pv });
      if (pv.burst) rows.push({ t: '⚠ YOUR BAG WILL SHRINK AND BURST!', c: '#ff3b5c', size: 1.0, bold: true });
      else if (pv.cap < 0) rows.push({ t: '⚠ Bag shrinks by ' + (-pv.cap), c: '#ff9a1f', size: 0.92, bold: true });
      if (isBound(run.gear[it.slot])) rows.push({ t: '⚠ Your current ' + SLOT_NAME[it.slot] + ' is BOUND', c: '#ff5a76', size: 0.92 });
    }
  } else if (it.kind === 'gear' && ref.k === 'gear') {
    const cur = run.gear[it.slot];
    const g2 = Object.assign({}, run.gear); g2[it.slot] = null;
    const cap2 = clamp(6 + save.up.bag + computeStats(g2).bagBonus, 2, MAXBAG);
    if (cap2 < run.cap) rows.push({ t: '⚠ Removing this shrinks your bag by ' + (run.cap - cap2) + '!', c: '#ff3b5c', size: 0.95, bold: true, gap: true });
    if (isBound(cur)) rows.push({ t: 'BOUND for ' + Math.ceil(cur.boundUntil - run.t) + 's', c: '#ff5a76', size: 0.95, bold: true });
  }
  rows.push({ t: 'Sells for ' + fmt(sellValue(it, run)) + 'g', c: '#f2c14e', size: 0.85, gap: true });
  // layout
  const lines = [];
  for (const r of rows) {
    const sz = fs * r.size;
    const parts = r.split ? [r.t] : wrap(r.t, w - 24, sz, r.bold);
    parts.forEach((p, i) => lines.push({ t: p, c: r.c, sz, bold: r.bold, gap: i === 0 && r.gap, split: r.split }));
  }
  let h = 14;
  for (const l of lines) h += l.sz * 1.28 + (l.gap ? 6 : 0);
  h += 6;
  let x = clamp(anchor.x + anchor.w / 2 - w / 2, 8, W - w - 8);
  let y = anchor.y - h - 10;
  if (y < 8) y = Math.min(H - h - 8, anchor.y + anchor.h + 10);
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x + 4, y + 4, w, h);
  panel(x, y, w, h, '#160d26', col, 3);
  ctx.fillStyle = hexA(col, 0.18); ctx.fillRect(x + 3, y + 3, w - 6, fs * 1.6);
  let cy = y + 10;
  for (const l of lines) {
    if (l.gap) { cy += 6; ctx.fillStyle = '#33264f'; ctx.fillRect(x + 10, cy - 4, w - 20, 1); }
    cy += l.sz * 0.64;
    if (l.split) {
      const pv = l.split;
      txt('DPS ' + (pv.dps >= 0 ? '▲ +' : '▼ ') + fmt(Math.round(pv.dps * 100)) + '%', x + 12, cy, l.sz, pv.dps >= -0.005 ? '#5fd35f' : '#ff5a76', 'left', true);
      txt('HP ' + (pv.hp >= 0 ? '▲ +' : '▼ ') + fmt(Math.round(pv.hp * 100)) + '%', x + w / 2 + 10, cy, l.sz, pv.hp >= -0.005 ? '#5fd35f' : '#ff5a76', 'left', true);
    } else txt(l.t, x + 12, cy, l.sz, l.c, 'left', l.bold);
    cy += l.sz * 0.64;
  }
}
