// Static game data: regions, enemy types, missions, upgrades, endings.

export const REGIONS = [
  { id: 'na', name: 'North America', lat: 40, lon: -98, lost: 'Missile production lost: missiles cost +50%' },
  { id: 'eu', name: 'Europe', lat: 50, lon: 12, lost: 'Targeting network lost: laser range reduced' },
  { id: 'ea', name: 'East Asia', lat: 35, lon: 116, lost: 'Energy grids lost: energy regen −30%' },
  { id: 'sa', name: 'South Asia', lat: 22, lon: 78, lost: 'Morale collapse: score ×0.7' },
  { id: 'af', name: 'Africa', lat: 6, lon: 20, lost: 'Launch sites lost: interceptors cost +50%' },
  { id: 'sam', name: 'South America', lat: -14, lon: -58, lost: 'Climate shield lost: planetary shield duration halved' },
];

export const FACTIONS = {
  veyr: { name: 'Veyr Swarm', color: 0xff7a1a, glow: 0xffa040 },
  nhal: { name: 'Nhal Collective', color: 0x9fd8ff, glow: 0x3fa9ff },
  orun: { name: 'Orun Harvesters', color: 0x8cff6a, glow: 0xb060ff },
};

export const ENEMY = {
  scout: { faction: 'veyr', hp: 18, speed: 4.4, dmg: 3, score: 50, size: 0.42, label: 'Veyr scout' },
  bomber: { faction: 'veyr', hp: 55, speed: 2.8, dmg: 10, score: 120, size: 0.7, label: 'Veyr bomber' },
  shield: { faction: 'nhal', hp: 70, shield: 70, speed: 2.3, dmg: 2, score: 200, size: 0.75, label: 'Nhal shield ship' },
  pod: { faction: 'orun', hp: 110, speed: 2.0, dmg: 1.6, score: 220, size: 0.8, label: 'Orun landing pod' },
  mothership: { faction: 'orun', hp: 1500, shield: 300, speed: 0, dmg: 0, score: 3000, size: 3.2, label: 'Orun carrier' },
};

// Each mission: five waves. Composition is scaled by the mission's `scale`.
const W = (t, scout = 0, bomber = 0, shield = 0, pod = 0) => ({ t, scout, bomber, shield, pod });
export const MISSIONS = [
  { name: 'First Contact', hours: 'H+00', scale: 1,
    brief: 'Alien scouts have entered orbit above the research station in the North Pacific. Lasers only. Learn how the satellites track targets: tap a ship to focus fire.',
    waves: [W(0, 4), W(18, 6), W(38, 7, 1), W(60, 8, 2), W(85, 10, 3)] },
  { name: 'Falling Stars', hours: 'H+06', scale: 1.05,
    brief: 'The first landing pods are falling toward South Asia and Africa. Pods are armored: use MISSILES (key 2) and destroy anything that lands before it drains the region.',
    waves: [W(0, 5, 1), W(20, 4, 2, 0, 1), W(42, 6, 2, 0, 2), W(66, 6, 3, 0, 2), W(92, 8, 3, 0, 3)] },
  { name: 'Blackout Over Tokyo', hours: 'H+14', scale: 1.15, event: 'blackout',
    brief: 'Nhal hackers are inside the grid. Satellites will go dark in rotation. Shield ships are immune to lasers until you break their shields with an EMP (key 4) or missiles.',
    waves: [W(0, 4, 1, 1), W(20, 5, 2, 1), W(44, 6, 2, 2), W(70, 6, 3, 2, 1), W(96, 8, 3, 3, 1)] },
  { name: 'The Atlantic Graveyard', hours: 'H+20', scale: 1.25,
    brief: 'Evacuation fleets are lifting from Europe and North America. Bombers are coming in waves. Interceptor squadrons (key 3) can meet them far from the atmosphere.',
    waves: [W(0, 6, 3), W(18, 6, 4), W(40, 8, 4, 1), W(64, 8, 5, 1, 1), W(90, 10, 6, 2, 1)] },
  { name: 'Lunar Silence', hours: 'H+27', scale: 1.35, boss: 'mini',
    brief: 'The Moon base has gone silent. An Orun carrier is holding station beyond the Lunar Approach, launching pods. Its shield cycles; EMP it, then hit it with everything.',
    waves: [W(0, 5, 2, 1), W(22, 6, 2, 1, 1), W(48, 6, 3, 2, 2), W(80, 8, 3, 2, 2), W(110, 8, 4, 2, 3)] },
  { name: 'The Harvest Begins', hours: 'H+34', scale: 1.45,
    brief: 'Intercepted pods are full of people, not weapons. They are harvesting. Every landed pod now drains population fast. Nothing may touch the ground.',
    waves: [W(0, 6, 2, 1, 2), W(20, 6, 3, 1, 3), W(44, 8, 3, 2, 3), W(70, 8, 4, 2, 4), W(98, 10, 4, 3, 5)] },
  { name: 'The Broken Alliance', hours: 'H+41', scale: 1.6, event: 'missiles-locked',
    brief: 'Governments are deadlocked over nuclear retaliation. Missile launch authority is suspended for the first 45 seconds. Hold the line with lasers, interceptors and shields.',
    waves: [W(0, 8, 3, 1), W(20, 8, 4, 2, 1), W(45, 10, 4, 2, 2), W(72, 10, 5, 3, 3), W(100, 12, 6, 3, 3)] },
  { name: 'Ghost Signal', hours: 'H+52', scale: 1.7,
    brief: 'Deep-space arrays have found an ancient signal, sent from Earth, centuries ago. The Nhal are jamming it. Shield ships everywhere. Energy is tight: spend it well.',
    waves: [W(0, 6, 2, 3), W(20, 8, 3, 3, 1), W(45, 8, 4, 4, 2), W(72, 10, 4, 4, 3), W(100, 12, 5, 5, 3)] },
  { name: 'The World Shield', hours: 'H+63', scale: 1.85, event: 'world-shield',
    brief: 'All remaining regions are feeding power to one global defense grid. Energy regenerates twice as fast this mission. The armada is throwing everything at the planet.',
    waves: [W(0, 10, 4, 2, 2), W(20, 10, 5, 3, 3), W(45, 12, 5, 3, 4), W(72, 12, 6, 4, 4), W(100, 14, 7, 4, 5)] },
  { name: 'Last Orbit', hours: 'H+71', scale: 2.0, boss: 'flagship',
    brief: 'The flagship has arrived. Destroy it and the fleet breaks. Whatever happens in the next ten minutes decides what humanity becomes.',
    waves: [W(0, 8, 3, 2, 2), W(25, 10, 4, 3, 3), W(55, 10, 5, 3, 4), W(90, 12, 6, 4, 4), W(125, 14, 6, 4, 5)] },
];

export const UPGRADES = [
  { id: 'sat', name: 'Launch Satellite', desc: '+1 laser satellite in orbit', max: 4 },
  { id: 'laser', name: 'Focused Optics', desc: 'Laser damage +30%', max: 4 },
  { id: 'regen', name: 'Fusion Reactors', desc: 'Energy regeneration +25%', max: 4 },
  { id: 'cap', name: 'Capacitor Banks', desc: 'Max energy +30', max: 3 },
  { id: 'volley', name: 'Missile Silos', desc: '+2 missiles per volley', max: 3 },
  { id: 'inter', name: 'Carrier Wings', desc: '+4 interceptors per squadron, longer loiter', max: 3 },
  { id: 'emp', name: 'Pulse Amplifier', desc: 'EMP radius +40%, stun lasts longer', max: 2 },
  { id: 'dome', name: 'Shield Harmonics', desc: 'Planetary shield lasts +6s and heals the region', max: 3 },
  { id: 'repair', name: 'Civil Defense', desc: 'All regions recover 35 population now', max: 99 },
  { id: 'range', name: 'Deep-Space Radar', desc: 'Laser targeting range +25%', max: 2 },
];

export const ENDINGS = [
  { id: 'total', name: 'Total Defense',
    text: 'You order the Lunar Battery to fire through the atmosphere. The flagship dies, and so do the cities beneath it. Earth is free, scarred, and ruled by the people who held the trigger. Historians will argue for a century about whether you were right.',
    bonus: 1.0 },
  { id: 'evac', name: 'Evacuation Protocol',
    text: 'Every interceptor becomes a transport. You trade orbit for lives, lifting millions into the dark while the harvesters take the ground. Humanity survives as a fleet with no home, remembering a blue world and promising to come back.',
    bonus: 0.8 },
  { id: 'signal', name: 'Signal Response',
    text: 'You answer the ghost signal with the only thing the invaders understand: the invitation Earth sent long ago, rewritten. The flagship stops. The pods open. Nobody knows yet whether you have ended a war or started a negotiation that will last a thousand years.',
    bonus: 1.25 },
];
