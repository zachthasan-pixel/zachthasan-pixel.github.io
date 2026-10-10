// ---------------------------------------------------------------------------
// Loot: rarities, affixes, absurd legendary synergies, curses, item factory.
// ---------------------------------------------------------------------------
const RAR = [
  { k: 'common', name: 'Common', c: '#b9b6cc', m: 1.0, affixes: 0 },
  { k: 'uncommon', name: 'Uncommon', c: '#5fd35f', m: 1.3, affixes: 1 },
  { k: 'rare', name: 'Rare', c: '#4ea8ff', m: 1.7, affixes: 2 },
  { k: 'epic', name: 'Epic', c: '#c46bff', m: 2.3, affixes: 3 },
  { k: 'legendary', name: 'Legendary', c: '#ff9a1f', m: 3.2, affixes: 2 },
  { k: 'cursed', name: 'Cursed', c: '#ff3b5c', m: 4.6, affixes: 2 },
];
const R_LEG = 4, R_CUR = 5;

const SLOTS = ['weapon', 'helm', 'armor', 'boots', 'ring', 'amulet'];
const SLOT_NAME = { weapon: 'Weapon', helm: 'Helm', armor: 'Armor', boots: 'Boots', ring: 'Ring', amulet: 'Amulet' };
const SLOT_ICON = { weapon: 'sword', helm: 'helm', armor: 'armor', boots: 'boots', ring: 'ring', amulet: 'amulet' };

// Weapon families: dmg multiplier, attack-speed multiplier.
const WEAPONS = {
  sword: { dmg: 1.0, spd: 1.0, names: ['Sword', 'Blade', 'Cutlass', 'Butter Knife (Large)'] },
  axe: { dmg: 1.35, spd: 0.8, names: ['Axe', 'Cleaver', 'Hatchet', 'Lumber Licker'] },
  dagger: { dmg: 0.6, spd: 1.65, names: ['Dagger', 'Shiv', 'Stabber', 'Pointy Stick'] },
  hammer: { dmg: 1.9, spd: 0.6, names: ['Hammer', 'Maul', 'Bonker', 'Mallet'] },
  staff: { dmg: 0.85, spd: 1.0, cleave: true, names: ['Staff', 'Wand', 'Rod', 'Twig of Power'] },
};
const BASES = {
  helm: ['Helm', 'Cooking Pot', 'Bucket', 'Crown', 'Hood', 'Skull Cap'],
  armor: ['Mail', 'Plate', 'Robe', 'Barrel', 'Tunic', 'Cuirass'],
  boots: ['Boots', 'Sandals', 'Greaves', 'Clogs', 'Sneakers', 'Treads'],
  ring: ['Ring', 'Band', 'Loop', 'Signet'],
  amulet: ['Amulet', 'Talisman', 'Charm', 'Locket', 'Pendant'],
};
const PREFIX = [
  ['Rusty', 'Chipped', 'Damp', 'Borrowed', 'Mediocre', 'Slightly Used'],
  ['Sturdy', 'Polished', 'Goblin-Forged', 'Shiny', 'Decent'],
  ['Gleaming', 'Runed', 'Vicious', 'Swift', 'Gilded'],
  ['Ancient', 'Abyssal', 'Radiant', 'Unhinged', 'Overclocked'],
  ['Mythic'],
  ['Cursed', 'Haunted', 'Forbidden', 'Accursed', 'Very Bad'],
];
const SUFFIXES = ['of Greed', 'of Haste', 'of the Bat', 'of Questionable Origin', 'of Overkill',
  'of Hoarding', 'of a Thousand Blinks', 'of Taxes', 'of the Goblin King', 'of Big Numbers', 'of Regret'];

// Regular affixes. v(t) = base value at rarity tier t (0..5).
const AFX = {
  dmgPct: { base: 0.12, txt: v => '+' + pct(v) + ' Damage', a: (s, v) => { s.dmgPct += v; } },
  apsPct: { base: 0.10, txt: v => '+' + pct(v) + ' Attack Speed', a: (s, v) => { s.apsPct += v; } },
  crit: { base: 0.04, txt: v => '+' + pct(v) + ' Crit Chance', a: (s, v) => { s.crit += v; } },
  critMul: { base: 0.25, txt: v => '+' + pct(v) + ' Crit Damage', a: (s, v) => { s.critMul += v; } },
  hpPct: { base: 0.10, txt: v => '+' + pct(v) + ' Max HP', a: (s, v) => { s.hpPct += v; } },
  dr: { base: 0.035, txt: v => pct(v) + ' Damage Reduction', a: (s, v) => { s.dr += v; } },
  regen: { base: 0.006, txt: v => 'Regenerate ' + (v * 100).toFixed(1) + '% HP/s', a: (s, v) => { s.regen += v; } },
  lifesteal: { base: 0.02, txt: v => pct(v) + ' Lifesteal', a: (s, v) => { s.lifesteal += v; } },
  goldPct: { base: 0.15, txt: v => '+' + pct(v) + ' Gold Found', a: (s, v) => { s.goldPct += v; } },
  thorns: { base: 0.2, txt: v => 'Reflect ' + pct(v) + ' of damage taken', a: (s, v) => { s.thorns += v; } },
  speedPct: { base: 0.06, txt: v => '+' + pct(v) + ' Run Speed', a: (s, v) => { s.speedPct += v; } },
  luck: { base: 0.06, txt: v => '+' + pct(v) + ' Chest Luck', a: (s, v) => { s.luck += v; } },
};
const AFX_KEYS = Object.keys(AFX);
// Rare-only affixes that change the inventory itself.
const AFX_SPECIAL = {
  bag: { txt: v => '+' + v + ' Bag Slot' + (v > 1 ? 's' : ''), a: (s, v) => { s.bagBonus += v; }, warn: true },
  cleave: { txt: () => 'Attacks hit every enemy in reach', a: s => { s.cleave = true; } },
};

// Legendary synergies: power fantasy first, consequences second.
const SPECIALS = [
  { id: 'shiv', slot: 'weapon', sub: 'dagger', name: 'Twitchy Shiv', t: '+500% Attack Speed. You lose 1% HP every time you blink.', a: s => { s.apsPct += 5; s.blinkDrain += 0.01; } },
  { id: 'glass', slot: 'weapon', sub: 'sword', name: 'Glass Greatsword', t: 'x3 Damage. Your Max HP is halved.', a: s => { s.dmgMul *= 3; s.hpMul *= 0.5; } },
  { id: 'tenth', slot: 'weapon', sub: 'hammer', name: 'The Tenth Bonk', t: 'Every 10th hit deals x50 damage.', a: s => { s.every10 += 50; } },
  { id: 'overkill', slot: 'weapon', sub: 'axe', name: 'Overkill Axe', t: 'Crits deal x10 instead of x1.5. +15% Crit Chance.', a: s => { s.critMul += 8.5; s.crit += 0.15; } },
  { id: 'stare', slot: 'amulet', name: 'Eye of the Death Stare', t: 'Every blink zaps ALL enemies for x6 damage. You blink twice as often.', a: s => { s.stare += 6; s.blinkRate *= 2; } },
  { id: 'tax', slot: 'amulet', name: 'Tax-Free Talisman', t: 'Selling heals 8% HP and pays double gold.', a: s => { s.sellHeal += 0.08; s.sellGold += 1; } },
  { id: 'hoard', slot: 'helm', name: "Hoarder's Crown", t: '+15% Damage for every item in your bag.', a: s => { s.perBag += 0.15; } },
  { id: 'shut', slot: 'helm', name: 'Shut-Eye Visor', t: 'Invulnerable while your eyes are closed. You blink twice as often.', a: s => { s.blinkShield = true; s.blinkRate *= 2; } },
  { id: 'fang', slot: 'ring', name: 'Vampire Fang Ring', t: '25% Lifesteal. You cannot regenerate at all.', a: s => { s.lifesteal += 0.25; s.noRegen = true; } },
  { id: 'clover', slot: 'ring', name: 'Four-Leaf Crit Clover', t: '+40% Crit Chance. Every crit heals 2% HP.', a: s => { s.crit += 0.4; s.critHeal += 0.02; } },
  { id: 'sack', slot: 'armor', name: 'Bottomless Sack', t: '+4 Bag Slots. -6% Damage for every item in your bag.', a: s => { s.bagBonus += 4; s.perBag -= 0.06; }, warn: true },
  { id: 'barrel', slot: 'armor', name: 'Spiked Barrel', t: 'Reflect 400% of all damage you take.', a: s => { s.thorns += 4; } },
  { id: 'hose', slot: 'boots', name: 'Firehose Boots', t: 'Chests drop TWICE as fast and roll +1 rarity.', a: s => { s.chestSpeed += 1; s.rarityUp += 1; } },
  { id: 'sock', slot: 'boots', name: "Berserker's Last Sock", t: '+300% Damage while below 35% HP.', a: s => { s.lowHp += 3; } },
];
const CURSES = [
  { id: 'bound', t: 'BOUND: cannot be removed for 25s after equipping.' },
  { id: 'drain', t: 'You lose 2% HP every second.', a: s => { s.drain += 0.02; } },
  { id: 'shrink', t: '-2 Bag Slots.', a: s => { s.bagBonus -= 2; }, warn: true },
  { id: 'rush', t: 'Chests drop 60% faster.', a: s => { s.chestSpeed += 0.6; } },
  { id: 'fragile', t: 'Enemies deal +75% damage.', a: s => { s.enemyDmg += 0.75; } },
  { id: 'eater', t: 'Every blink destroys a random bag item.', a: s => { s.destroyOnBlink = true; } },
  { id: 'junk', t: 'A junk item appears in your bag every 12s.', a: s => { s.junkSpawn = true; } },
  { id: 'boom', t: 'Explodes when sold (40% of your Max HP).' },
];
const POTIONS = [
  { id: 'heal', name: 'Healing Draught', col: '#ff4f6d', t: 'Drink: restore 50% HP.' },
  { id: 'rage', name: 'Rage Brew', col: '#ff8c1a', t: 'Drink: x2 Damage for 10s.' },
  { id: 'haste', name: 'Zoom Juice', col: '#4ee0ff', t: 'Drink: x2 Attack Speed for 10s.' },
  { id: 'greed', name: 'Liquid Greed', col: '#f2c14e', t: 'Drink: x3 Gold for 15s.' },
  { id: 'mystery', name: 'Mystery Slurry', col: '#b45cff', t: 'Drink: ??? (probably fine)' },
];
const JUNK = [
  { icon: 'rock', name: 'A Rock' }, { icon: 'sock', name: 'Single Damp Sock' },
  { icon: 'receipt', name: 'Goblin Tax Receipt' }, { icon: 'rock', name: 'Slightly Bigger Rock' },
  { icon: 'sock', name: "Somebody's Sock" }, { icon: 'receipt', name: 'Coupon (Expired)' },
];

const G = L => Math.pow(1.13, L - 1);
let _uid = 1;

function rollAffixVal(key, tier) {
  return AFX[key].base * (1 + tier * 0.55) * rr(0.8, 1.2);
}
function addAffixes(it, n, tier) {
  const pool = AFX_KEYS.slice();
  if (it.slot === 'weapon') pool.push('dmgPct', 'apsPct', 'crit', 'critMul');
  for (let i = 0; i < n && pool.length; i++) {
    const k = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    if (it.affixes.some(a => a.k === k)) { i--; continue; }
    it.affixes.push({ k, v: rollAffixVal(k, tier) });
  }
}

function makeGear(slot, rarity, level, opts) {
  opts = opts || {};
  const r = RAR[rarity], g = G(level);
  const it = { id: _uid++, kind: 'gear', slot, rarity, level, affixes: [], special: null, curse: null, extra: [] };
  if (slot === 'weapon') {
    const sub = opts.sub || pick(Object.keys(WEAPONS));
    const wd = WEAPONS[sub];
    it.sub = sub; it.icon = sub;
    it.dmg = 11 * g * r.m * wd.dmg * rr(0.9, 1.1);
    it.spd = wd.spd;
    if (wd.cleave) it.extra.push({ k: 'cleave', v: 1 });
    it.base = pick(wd.names);
  } else {
    it.icon = SLOT_ICON[slot];
    it.base = pick(BASES[slot]);
    if (slot === 'helm') it.hp = 26 * g * r.m;
    if (slot === 'armor') { it.hp = 52 * g * r.m; it.affixes.push({ k: 'dr', v: 0.03 * (rarity + 1) }); }
    if (slot === 'boots') { it.hp = 18 * g * r.m; it.affixes.push({ k: 'speedPct', v: 0.04 + 0.02 * rarity }); }
  }
  let n = r.affixes + ((slot === 'ring' || slot === 'amulet') ? 1 : 0);
  addAffixes(it, n, Math.min(rarity, 3));
  // Inventory-bending affixes on rare+ items
  if (rarity >= 2 && rarity < R_LEG && (slot === 'armor' || slot === 'boots' || slot === 'amulet') && rand() < 0.22) {
    it.extra.push({ k: 'bag', v: rarity >= 3 && rand() < 0.4 ? 2 : 1 });
  }
  if (rarity === R_LEG) {
    const sp = opts.special ? SPECIALS.find(s => s.id === opts.special) :
      pick(SPECIALS.filter(s => s.slot === slot)) || null;
    if (sp) {
      it.special = sp.id; it.name = sp.name;
      if (sp.sub && slot === 'weapon' && it.sub !== sp.sub) { // re-roll the weapon base to match
        const wd = WEAPONS[sp.sub]; it.sub = sp.sub; it.icon = sp.sub; it.spd = wd.spd;
        it.dmg = 11 * g * r.m * wd.dmg;
        it.extra = wd.cleave ? [{ k: 'cleave', v: 1 }] : [];
      }
    }
  }
  if (rarity === R_CUR) {
    const pool = CURSES.filter(c => !(opts.noBound && c.id === 'bound'));
    it.curse = (opts.curse ? CURSES.find(c => c.id === opts.curse) : pick(pool)).id;
  }
  if (!it.name) {
    const pre = pick(PREFIX[rarity]);
    it.name = pre + ' ' + it.base + (rarity >= 2 && rand() < 0.5 ? ' ' + pick(SUFFIXES) : '');
  }
  return it;
}
function makePotion(level, id) {
  const p = id ? POTIONS.find(x => x.id === id) : pick(POTIONS);
  return { id: _uid++, kind: 'potion', potion: p.id, name: p.name, col: p.col, icon: 'potion', rarity: 1, level };
}
function makeBomb(level) {
  return { id: _uid++, kind: 'bomb', name: 'Unstable Bomb', icon: 'bomb', rarity: 2, level, fuse: 12 };
}
function makeJunk(level) {
  const j = pick(JUNK);
  return { id: _uid++, kind: 'junk', name: j.name, icon: j.icon, rarity: 0, level };
}

function rollRarity(luck, depth, up) {
  const w = [52, 27, 13, 5.5, 1.7, 0.25 + Math.min(4, depth / 220)];
  for (let i = 1; i < 5; i++) w[i] *= Math.pow(1 + luck, i);
  let tot = w.reduce((a, b) => a + b, 0), x = rand() * tot, r = 0;
  for (; r < w.length; r++) { x -= w[r]; if (x <= 0) break; }
  r = Math.min(r, 5);
  if (up && r < R_LEG) r = Math.min(R_LEG, r + up);
  return r;
}
function rollChest(st) {
  const d = st.depth, L = st.level;
  const x = rand();
  const junkP = 0.06 + Math.min(0.1, d / 4000), bombP = 0.05 + Math.min(0.07, d / 3000), potP = 0.1;
  if (x < junkP) return makeJunk(L);
  if (x < junkP + bombP) return makeBomb(L);
  if (x < junkP + bombP + potP) return makePotion(L);
  const slot = rand() < 0.24 ? 'weapon' : pick(SLOTS);
  return makeGear(slot, rollRarity(st.stats.luck, d, st.stats.rarityUp), L);
}
// The scripted opening: the power trip is guaranteed, every run.
function scriptedChest(n, L) {
  switch (n) {
    case 0: return makeGear('weapon', 2, L, { sub: 'sword' });
    case 1: return makeGear('weapon', R_LEG, L + 2, { special: 'shiv' });
    case 2: { const a = makeGear('armor', 3, L + 2); a.affixes.push({ k: 'regen', v: 0.02 }); return a; }
    case 3: return makeJunk(L);
    case 4: return makeGear('amulet', R_LEG, L + 2, { special: 'stare' });
    case 5: return makeBomb(L);
    case 6: return makeGear('helm', 2, L);
    case 7: return makePotion(L, 'heal');
    case 8: return makeGear('boots', 3, L + 1);
    case 9: return makeGear('ring', R_CUR, L + 3, { curse: 'drain' });
  }
  return null;
}

function itemColor(it) { return it.kind === 'potion' ? it.col : RAR[it.rarity].c; }
function sellValue(it, st) {
  if (it.kind === 'junk') return Math.max(1, Math.round(1 * (1 + 0.2 * save.up.sell)));
  const base = 3 * (1 + (it.level - 1) * 0.12) * (it.kind === 'gear' ? RAR[it.rarity].m : 1.2);
  return Math.max(1, Math.round(base * (1 + 0.2 * save.up.sell) * (1 + (st ? st.stats.sellGold : 0))));
}
function itemLines(it) {
  // Returns [{t, c}] describing the item for the tooltip.
  const out = [];
  if (it.kind === 'gear') {
    if (it.dmg) out.push({ t: fmt(it.dmg) + ' Damage' + (it.spd !== 1 ? '  (' + (it.spd > 1 ? 'fast' : 'slow') + ' x' + it.spd + ' speed)' : ''), c: '#ffffff', big: true });
    if (it.hp) out.push({ t: '+' + fmt(it.hp) + ' Max HP', c: '#ffffff', big: true });
    for (const a of it.affixes) out.push({ t: AFX[a.k].txt(a.v), c: '#9fe6a0' });
    for (const a of it.extra) out.push({ t: AFX_SPECIAL[a.k].txt(a.v), c: '#7fd7ff' });
    if (it.special) out.push({ t: '★ ' + SPECIALS.find(s => s.id === it.special).t, c: '#ffb347' });
    if (it.curse) out.push({ t: '☠ ' + CURSES.find(c => c.id === it.curse).t, c: '#ff5a76' });
  } else if (it.kind === 'potion') {
    out.push({ t: POTIONS.find(p => p.id === it.potion).t, c: '#ffffff' });
    out.push({ t: 'Drag onto the dungeon (or double-tap) to drink.', c: '#a99fc4' });
  } else if (it.kind === 'bomb') {
    out.push({ t: 'Throw it at enemies for x15 damage.', c: '#ffffff' });
    out.push({ t: 'Explodes in your bag in ' + Math.ceil(it.fuse) + 's!', c: '#ff5a76' });
    out.push({ t: 'Drag onto the dungeon (or double-tap) to throw.', c: '#a99fc4' });
  } else {
    out.push({ t: 'Completely worthless. Takes up space.', c: '#a99fc4' });
  }
  return out;
}
