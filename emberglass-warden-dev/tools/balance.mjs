// Balance probe: three bot skill levels, N runs each, no cheats.
import { open } from './lib.mjs';
const N = +(process.argv[2] || 5);
const t = await open(); const pg = t.pg;
await pg.evaluate(() => { window.runBot = (skill) => { const g = window.__ew; if (g.S.state !== 'menu') g.toMenu(); g.startRun(false); let k = 0; const t0 = g.S.t; const sh0 = g.save.shards; let blockThis = false, lastState = '';
  const ad = (a, b) => { let d = (a - b) % 6.2832; if (d > 3.1416) d -= 6.2832; if (d < -3.1416) d += 6.2832; return d; };
  while (g.S.state !== 'over' && k < 120 * 900) { k++; if (g.S.state === 'upgrade') { g.pickUpgrade(Math.floor(Math.random() * 3)); continue; }
    const live = g.enemies.filter((q) => !q.dead); const e = live.sort((a, b) => Math.hypot(a.x - g.p.x, a.z - g.p.z) - Math.hypot(b.x - g.p.x, b.z - g.p.z))[0];
    if (e) { const d = Math.hypot(e.x - g.p.x, e.z - g.p.z), want = Math.atan2(-(e.x - g.p.x), -(e.z - g.p.z)); g.p.yaw += ad(want, g.p.yaw) * (skill === 0 ? 0.04 : 0.1);
      const atk = live.find((q) => ['windup', 'lunge', 'sweepW', 'charge', 'chargeW'].includes(q.state) && Math.hypot(q.x - g.p.x, q.z - g.p.z) < 8);
      const key = atk ? atk.kind + atk.state : ''; if (key !== lastState) { lastState = key; blockThis = skill === 2 ? true : skill === 1 ? Math.random() < 0.5 : false; }
      g.inp.block = !!atk && blockThis && (skill === 2 ? atk.t > 0.25 : true); if (g.inp.block && atk) g.p.yaw += ad(Math.atan2(-(atk.x - g.p.x), -(atk.z - g.p.z)), g.p.yaw) * 0.3;
      const range = e.d.boss ? 6.5 : 4; g.keys.KeyW = d > range - 1; g.keys.KeyS = skill > 0 && e.d.boss && d < 4;
      if (!g.inp.block && d < range + 0.6 && k % (skill === 0 ? 30 : 40) === 0) g.inp.atkPressed = true;
      if (skill === 2 && g.p.burst >= 100 && live.length >= 3) g.inp.burst = true; if (skill >= 1 && g.p.burst >= 100 && g.p.hp < 40) g.inp.burst = true;
      if (skill >= 1 && atk && atk.state === 'charge') g.inp.dash = true;
      if (skill >= 1 && g.shots.some((q) => !q.friendly && Math.hypot(q.x - g.p.x, q.z - g.p.z) < 4.5) && k % 16 === 0) g.inp.atkPressed = true; }
    g.step(1); }
  return { wave: g.S.wave, secs: Math.round(g.S.t - t0), shards: g.save.shards - sh0, kills: g.S.kills }; }; });
const med = (a) => a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)];
for (const skill of [0, 1, 2]) { const rs = []; for (let i = 0; i < N; i++) rs.push(await pg.evaluate((s) => window.runBot(s), skill));
  console.log(['masher', 'average', 'skilled'][skill], 'waves', rs.map((r) => r.wave).join(','), '| median wave', med(rs.map((r) => r.wave)), 'secs', med(rs.map((r) => r.secs)), 'shards', med(rs.map((r) => r.shards))); }
console.log('errs', t.errs.length); await t.close();
