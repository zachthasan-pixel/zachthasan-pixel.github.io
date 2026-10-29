// ---------------------------------------------------------------------------
// Game data: ranks, abilities, arenas, cosmetics, missions, CPU names.
// ---------------------------------------------------------------------------
const RANKS = [
  { name: 'Bronze', rp: 0, col: '#d08a52' },
  { name: 'Silver', rp: 250, col: '#c9d3e0' },
  { name: 'Gold', rp: 550, col: '#ffcf4a' },
  { name: 'Platinum', rp: 900, col: '#5fe3d0' },
  { name: 'Diamond', rp: 1350, col: '#7fb4ff' },
  { name: 'Champion', rp: 1900, col: '#ff6fb1' },
  { name: 'Legend', rp: 2600, col: '#ffffff' },
];
function rankOf(rp) {
  let i = 0;
  while (i + 1 < RANKS.length && rp >= RANKS[i + 1].rp) i++;
  const r = RANKS[i], next = RANKS[i + 1];
  // Three divisions inside each tier (III, II, I), except Legend.
  let div = '', frac = 1;
  if (next) {
    const span = next.rp - r.rp, into = rp - r.rp;
    const d = Math.min(2, Math.floor(into / (span / 3)));
    div = ['III', 'II', 'I'][d];
    frac = (into - d * span / 3) / (span / 3);
  }
  return { i, name: r.name, div, col: r.col, label: r.name + (div ? ' ' + div : ''), frac, next };
}
// CPU skill 0..1 grows with rank so the game stays a challenge as you climb.
function skillFor(rp) { return clamp(0.22 + rp / 2600 * 0.78, 0.22, 1); }

const ABILITIES = {
  shock: { name: 'Shockwave', icon: '💥', cd: 6.5, rank: 0, desc: 'Blast everyone nearby away from you.' },
  anchor: { name: 'Anchor', icon: '⚓', cd: 7, rank: 1, desc: 'Turn to iron for 1.6 s. You barely budge, they bounce off.' },
  blink: { name: 'Blink', icon: '✨', cd: 5, rank: 2, desc: 'Teleport a short hop. Crosses gaps, if you aim well.' },
  magnet: { name: 'Magnet', icon: '🧲', cd: 8, rank: 3, desc: 'Pull rivals in, then fling them out.' },
};
const ABILITY_KEYS = Object.keys(ABILITIES);

// Arena themes. unlock = rank tier index needed.
const ARENAS = {
  meadow: { name: 'Meadow', unlock: 0, top: ['#7bd36a', '#6cc65d'], side: '#3f7f3a', edge: '#b8f0a0', sky: ['#28215a', '#7a4f9e', '#f29d8b'], rings: 7, feature: 'none', desc: 'The classic. Tiles crumble from the edge in.' },
  pinball: { name: 'Pinball', unlock: 0, top: ['#ffcf6b', '#f6bf55'], side: '#a8692b', edge: '#fff0b8', sky: ['#13204a', '#2e4f9a', '#61c4d8'], rings: 7, feature: 'bumpers', desc: 'Bumpers fling anything that touches them.', minRp: 120 },
  glacier: { name: 'Glacier', unlock: 1, top: ['#bfe9ff', '#a7dcfa'], side: '#5a8fb8', edge: '#ffffff', sky: ['#0b1a3a', '#244a7a', '#9fd5f0'], rings: 7, feature: 'ice', desc: 'Slippery ice. Momentum is everything.' },
  sweeper: { name: 'Sweeper', unlock: 2, top: ['#f59ac0', '#ec86b0'], side: '#9a3f6c', edge: '#ffd6e8', sky: ['#1d0f33', '#5b2068', '#ff8a6b'], rings: 7, feature: 'sweeper', desc: 'A spinning beam sweeps the arena. Jump it with a dash.' },
  islands: { name: 'Islands', unlock: 3, top: ['#e5c38f', '#d9b47c'], side: '#8a6436', edge: '#fff1cf', sky: ['#082431', '#16566a', '#5fd0b5'], rings: 7, feature: 'islands', desc: 'Four islands joined by bridges that do not last.' },
  volcano: { name: 'Volcano', unlock: 4, top: ['#6d6a78', '#5d5a68'], side: '#2f2b38', edge: '#c9c3d8', sky: ['#1a0606', '#5a1410', '#ff6a2b'], rings: 7, feature: 'vents', desc: 'Vents erupt and blast you upward. Watch the glow.' },
};
const ARENA_KEYS = Object.keys(ARENAS);

// Cosmetics. price 0 = starter. rank = minimum tier to buy (prestige items).
const SKINS = {
  tomato: { name: 'Tomato', c1: '#ff5a4e', c2: '#c7262b', price: 0 },
  sky: { name: 'Sky', c1: '#5fb8ff', c2: '#2a6fd6', price: 120 },
  lime: { name: 'Lime', c1: '#a6f04a', c2: '#4fa82a', price: 120 },
  grape: { name: 'Grape', c1: '#b884ff', c2: '#6b3fd1', price: 160 },
  sunny: { name: 'Sunny', c1: '#ffe25a', c2: '#e0a020', price: 160 },
  mint: { name: 'Mint', c1: '#6ff0c8', c2: '#1fa985', price: 200 },
  bubble: { name: 'Bubblegum', c1: '#ff9ad5', c2: '#e04aa0', price: 220 },
  coal: { name: 'Coal', c1: '#5b5b6b', c2: '#25252f', price: 300 },
  snow: { name: 'Snow', c1: '#ffffff', c2: '#b8c4d8', price: 300 },
  melon: { name: 'Melon', c1: '#7ee06a', c2: '#2f8a3a', price: 380, pattern: 'stripes', pc: '#1d5e27' },
  beach: { name: 'Beach Ball', c1: '#ffffff', c2: '#d8d8e6', price: 450, pattern: 'beach' },
  lava: { name: 'Lava', c1: '#ff8a3a', c2: '#b0201a', price: 520, pattern: 'spots', pc: '#ffd36b', rank: 2 },
  galaxy: { name: 'Galaxy', c1: '#4a3ab8', c2: '#120a3a', price: 700, pattern: 'stars', pc: '#ffffff', rank: 3 },
  gold: { name: 'Solid Gold', c1: '#ffe48a', c2: '#c98a12', price: 1200, pattern: 'shine', rank: 4 },
};
const HATS = {
  none: { name: 'No hat', price: 0 },
  cap: { name: 'Cap', price: 100 },
  bow: { name: 'Bow', price: 120 },
  horns: { name: 'Horns', price: 200 },
  sprout: { name: 'Sprout', price: 150 },
  tophat: { name: 'Top Hat', price: 260 },
  viking: { name: 'Viking', price: 340 },
  chef: { name: 'Chef', price: 300 },
  halo: { name: 'Halo', price: 420, rank: 2 },
  crown: { name: 'Crown', price: 900, rank: 4 },
};

const MISSION_POOL = [
  { id: 'ko', text: 'Knock off {n} rivals', n: [5, 8, 12], reward: [60, 90, 130] },
  { id: 'win', text: 'Win {n} Royale match{es}', n: [1, 2, 3], reward: [80, 140, 200] },
  { id: 'top3', text: 'Finish top 3 in {n} match{es}', n: [2, 3, 5], reward: [60, 90, 140] },
  { id: 'charged', text: 'Knock off {n} rivals with a charged dash', n: [2, 4, 6], reward: [70, 110, 150] },
  { id: 'ability', text: 'Use your ability {n} times', n: [8, 15, 25], reward: [50, 80, 110] },
  { id: 'power', text: 'Grab {n} power-ups', n: [3, 5, 8], reward: [50, 80, 110] },
  { id: 'survive', text: 'Survive {n} seconds in total', n: [180, 300, 480], reward: [50, 80, 120] },
  { id: 'double', text: 'Get a double KO (2 in 3 s)', n: [1, 1, 2], reward: [90, 90, 160] },
  { id: 'party', text: 'Play {n} Party round{s}', n: [3, 5, 8], reward: [40, 60, 90] },
];

const CPU_NAMES = ['Bonk', 'Wobbles', 'Sir Roll', 'Pudding', 'Boulder', 'Zippy', 'Mochi', 'Thud', 'Noodle', 'Biscuit',
  'Gumdrop', 'Tank', 'Pebble', 'Dumpling', 'Rascal', 'Meatball', 'Bubbles', 'Turbo', 'Waffle', 'Chomp', 'Bouncer',
  'Marble', 'Snoot', 'Pickles', 'Rumble', 'Taffy', 'Brick', 'Jelly', 'Bonbon', 'Dozer'];

// Daily modifiers keep the Daily Challenge different every day.
const MODIFIERS = [
  { id: 'none', name: 'Classic', desc: 'No twist. Pure skill.' },
  { id: 'giant', name: 'Giants', desc: 'Everyone is huge and heavy.' },
  { id: 'tiny', name: 'Tiny Terrors', desc: 'Small, fast and fragile.' },
  { id: 'hyper', name: 'Hyper Dash', desc: 'Dash cooldown halved.' },
  { id: 'heavyhit', name: 'Glass Cannons', desc: 'Every hit counts double.' },
  { id: 'powerups', name: 'Power Rain', desc: 'Power-ups drop constantly.' },
  { id: 'quick', name: 'Quick Crumble', desc: 'The arena falls twice as fast.' },
];
