// Game data: enemies, upgrades, armory, blades, ranks, daily trials.

export const ENEMY = {
  wraith: { name: 'Fang Wraith', model: 'wraith', hp: 30, speed: 6.2, radius: 0.9, size: 2.0, hover: 1.25, dmg: 12, shards: 2, score: 100, cost: 1, glow: [1.0, 0.25, 0.9] },
  stinger: { name: 'Spore Stinger', model: 'stinger', hp: 24, speed: 3.6, radius: 0.9, size: 1.8, hover: 1.9, dmg: 10, shards: 3, score: 150, cost: 1.5, glow: [0.55, 1.0, 0.2] },
  brute: { name: 'Shard Brute', model: 'brute', hp: 120, speed: 2.7, radius: 1.5, size: 3.6, hover: 1.7, dmg: 26, shards: 7, score: 400, cost: 3, glow: [1.0, 0.55, 0.15] },
  shade: { name: 'Frost Shade', model: 'wraith', swz: 1, hp: 18, speed: 8.4, radius: 0.7, size: 1.5, hover: 1.2, dmg: 9, shards: 2, score: 130, cost: 0.8, glow: [0.3, 0.9, 1.0], wind: 0.32 },
  mortar: { name: 'Blight Mortar', model: 'stinger', swz: 2, hp: 46, speed: 3.0, radius: 1.0, size: 2.2, hover: 2.2, dmg: 9, shards: 5, score: 260, cost: 2.2, glow: [1.0, 0.35, 0.2], volley: 3 },
  tyrant: { name: 'Rift Tyrant', model: 'tyrant', hp: 1300, speed: 3.5, radius: 2.2, size: 6.0, hover: 2.9, dmg: 24, shards: 40, score: 3000, cost: 99, glow: [0.7, 0.35, 1.0], boss: true },
};

// Run upgrades (pick 1 of 3 after each wave).
export const UPGRADES = [
  { id: 'edge', name: 'Keen Edge', icon: '⚔', desc: '+20% blade damage', max: 6 },
  { id: 'reach', name: 'Long Reach', icon: '↔', desc: '+15% blade reach', max: 4 },
  { id: 'swift', name: 'Swift Hands', icon: '≫', desc: '+15% swing speed', max: 4 },
  { id: 'vital', name: 'Vital Core', icon: '✚', desc: '+25 max integrity and heal 25', max: 6 },
  { id: 'leech', name: 'Leech Blade', icon: '❤', desc: 'Heal 2 integrity per kill', max: 4 },
  { id: 'reserve', name: 'Deep Reserves', icon: '▰', desc: '+30 max energy', max: 4 },
  { id: 'recover', name: 'Quick Recovery', icon: '⟳', desc: '+35% energy regeneration', max: 4 },
  { id: 'dash2', name: 'Twin Dash', icon: '➟', desc: '+1 dash charge', max: 2 },
  { id: 'parry', name: 'Parry Master', icon: '◈', desc: 'Wider parry window. Parries release a shockwave', max: 3 },
  { id: 'battery', name: 'Burst Battery', icon: '⚡', desc: 'Rift Burst charges 40% faster', max: 3 },
  { id: 'nova', name: 'Nova Burst', icon: '✹', desc: 'Rift Burst is 35% bigger and stronger', max: 3 },
  { id: 'chain', name: 'Chain Spark', icon: 'ϟ', desc: 'Kills arc lightning to a nearby beast', max: 4 },
  { id: 'reflect', name: 'Mirror Edge', icon: '◐', desc: 'Deflected spores hit twice as hard', max: 3 },
  { id: 'heavy', name: 'Heavy Hitter', icon: '⬇', desc: 'Heavy strikes charge faster and hit 30% harder', max: 3 },
  { id: 'magnet', name: 'Shard Lens', icon: '◆', desc: '+50% shards this run', max: 3 },
  { id: 'thorn', name: 'Thorn Guard', icon: '✸', desc: 'Blocked hits burn the attacker', max: 3 },
  { id: 'wind', name: 'Second Wind', icon: '☀', desc: 'Once per run, rise again at 40% integrity', max: 1 },
];

// Permanent upgrades bought with shards in the Armory.
export const ARMORY = [
  { id: 'hull', name: 'Hull Plating', desc: '+10 starting integrity', max: 5, cost: [40, 80, 140, 220, 320] },
  { id: 'hone', name: 'Honed Blade', desc: '+6% blade damage', max: 5, cost: [50, 100, 170, 260, 380] },
  { id: 'cap', name: 'Capacitor', desc: '+10 starting energy', max: 5, cost: [40, 80, 140, 220, 320] },
  { id: 'lens', name: 'Shard Attractor', desc: '+10% shards earned', max: 5, cost: [60, 120, 200, 300, 450] },
  { id: 'head', name: 'Head Start', desc: 'Begin each run with a random upgrade', max: 2, cost: [150, 400] },
  { id: 'reroll', name: 'Reroll Charm', desc: '+1 upgrade reroll per run', max: 3, cost: [80, 180, 320] },
];

export const BLADES = [
  { id: 'ember', name: 'Ember', color: 0xff8a2a, unlock: null },
  { id: 'azure', name: 'Azure', color: 0x3cc8ff, unlock: null },
  { id: 'verdant', name: 'Verdant', color: 0x54ff7a, unlock: { type: 'wave', n: 5, text: 'Reach wave 5' } },
  { id: 'violet', name: 'Violet', color: 0xb46bff, unlock: { type: 'wave', n: 10, text: 'Reach wave 10' } },
  { id: 'crimson', name: 'Crimson', color: 0xff3355, unlock: { type: 'boss', n: 3, text: 'Defeat 3 Rift Tyrants' } },
  { id: 'star', name: 'Starlight', color: 0xf4f8ff, unlock: { type: 'daily', n: 3, text: 'Clear wave 5 in 3 Daily Trials' } },
];

export const RANKS = [
  { name: 'Initiate', xp: 0 }, { name: 'Sentinel', xp: 3000 }, { name: 'Vanguard', xp: 10000 },
  { name: 'Blademaster', xp: 25000 }, { name: 'Riftwarden', xp: 60000 }, { name: 'Emberglass Legend', xp: 150000 },
];

export const TRIALS = [
  { id: 'glass', name: 'Glass Blade', desc: 'You deal double damage and take double damage.' },
  { id: 'swarm', name: 'Swarm Night', desc: '50% more beasts, each with less health.' },
  { id: 'storm', name: 'Spore Storm', desc: 'Stingers arrive from wave 1 and fire faster.' },
  { id: 'surge', name: 'Rift Surge', desc: 'Rift Burst charges three times faster.' },
  { id: 'heavy', name: 'Titan Hour', desc: 'Brutes arrive from wave 2. Heavy strikes hit twice as hard.' },
  { id: 'drain', name: 'Thin Air', desc: 'Energy regenerates slowly, but kills restore energy.' },
];

export const BIOMES = [
  { name: 'Violet Rift', sky: 0xffffff, fog: 0x0b1030, light: 0x9db4ff, accent: 0x7a5cff },
  { name: 'Ember Wastes', sky: 0xffb38a, fog: 0x1e0c10, light: 0xffc49a, accent: 0xff7a2a },
  { name: 'Verdant Deep', sky: 0x9affc8, fog: 0x06201c, light: 0xa8ffd8, accent: 0x38ffa0 },
];

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Returns the list of enemy kinds for a wave.
export function waveList(wave, rng, trial) {
  const out = [];
  const add = (k, n) => { for (let i = 0; i < n; i++) out.push(k); };
  if (wave % 5 === 0) {
    add('tyrant', 1);
    if (wave >= 10) { add('wraith', Math.min(6, wave / 5)); add('stinger', Math.min(4, wave / 5 - 1)); }
    return out;
  }
  if (wave === 1) add('wraith', 3);
  else if (wave === 2) add('wraith', 5);
  else if (wave === 3) { add('wraith', 4); add('stinger', 2); }
  else if (wave === 4) { add('wraith', 3); add('stinger', 2); add('brute', 1); }
  else {
    let budget = 5 + wave * 1.25;
    const kinds = ['wraith', 'wraith', 'stinger', 'brute'];
    if (wave >= 6) kinds.push('shade', 'shade');
    if (wave >= 9) kinds.push('mortar');
    if (wave >= 13) kinds.push('brute', 'mortar');
    let guard = 0;
    while (budget > 0.9 && guard++ < 60) {
      const k = kinds[Math.floor(rng() * kinds.length)];
      const c = ENEMY[k].cost;
      if (c > budget + 0.5) continue;
      out.push(k); budget -= c;
    }
  }
  if (trial === 'storm' && wave < 3) add('stinger', 2);
  if (trial === 'heavy' && wave >= 2 && wave < 4) add('brute', 1);
  if (trial === 'swarm') { const n = Math.ceil(out.length * 0.5); for (let i = 0; i < n; i++) out.push(out[i % out.length] === 'brute' ? 'wraith' : out[i % out.length]); }
  // shuffle
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
