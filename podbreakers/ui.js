/* Pod Breakers - UI: HUD, menus, armory, xenodex, missions, daily */
(function (PB) {
  'use strict';
  var U = PB.U, S = PB.save;
  var $ = function (id) { return document.getElementById(id); };
  var UI = PB.UI = {};

  // ---------------- meta: daily, streak, missions ----------------
  var Meta = PB.Meta = {};
  Meta.today = function () { return U.dateKey(); };
  Meta.dailyMod = function () { var r = U.seeded(U.hash('pb' + Meta.today())); return { mod: PB.MODS[Math.floor(r() * PB.MODS.length)], zone: Math.min(S.zonesUnlocked - 1, Math.floor(r() * 4)) }; };
  Meta.checkDaily = function () {
    var today = Meta.today(), msgs = [];
    if (S.streak.last !== today) {
      var y = new Date(); y.setDate(y.getDate() - 1);
      S.streak.count = (S.streak.last === U.dateKey(y)) ? S.streak.count + 1 : 1;
      S.streak.last = today;
      if (S.runs > 0 || S.streak.count > 1) { var bonus = 40 * Math.min(7, S.streak.count); S.credits += bonus; msgs.push('Day ' + S.streak.count + ' login bonus: +' + bonus + ' credits'); }
    }
    if (S.daily.date !== today) { S.daily = { date: today, done: false, best: 0 }; }
    if (S.missions.date !== today) {
      var r = U.seeded(U.hash('m' + today)), pool = PB.MISSION_T.slice(), list = [];
      for (var i = 0; i < 3; i++) {
        var t = pool.splice(Math.floor(r() * pool.length), 1)[0], tier = Math.min(2, Math.floor(r() * 2 + Math.min(1, S.runs / 15)));
        list.push({ id: t.id, txt: t.txt.replace('{n}', t.n[tier]), n: t.n[tier], p: 0, reward: t.reward[tier], done: false, claimed: false });
      }
      S.missions = { date: today, list: list };
    }
    PB.persist();
    return msgs;
  };
  Meta.progress = function (id, val, isMax) {
    var changed = false;
    S.missions.list.forEach(function (m) {
      if (m.id !== id || m.done) return;
      m.p = isMax ? Math.max(m.p, val) : m.p + val;
      if (m.p >= m.n) { m.p = m.n; m.done = true; changed = true; UI.toast('MISSION COMPLETE!', '#ffd23f'); PB.audio.sfx('dex'); }
    });
    return changed;
  };
  Meta.claimAll = function () {
    var tot = 0; S.missions.list.forEach(function (m) { if (m.done && !m.claimed) { m.claimed = true; tot += m.reward; } });
    if (tot) { S.credits += tot; PB.persist(); }
    return tot;
  };

  // ---------------- show/hide ----------------
  UI.show = function (id) { $(id).classList.remove('hidden'); };
  UI.hide = function (id) { $(id).classList.add('hidden'); };
  UI.isShown = function (id) { return !$(id).classList.contains('hidden'); };

  // ---------------- HUD ----------------
  var last = {};
  function set(id, v) { if (last[id] !== v) { last[id] = v; $(id).textContent = v; } }
  function w(id, p) { var v = Math.max(0, Math.min(100, p * 100)).toFixed(1) + '%'; if (last[id] !== v) { last[id] = v; $(id).style.width = v; } }
  UI.hud = function (g) {
    var h = g.hero;
    w('hpFill', h.hp / h.maxHp); set('hpTxt', 'DEFENDER ' + Math.ceil(Math.max(0, h.hp)) + '/' + Math.round(h.maxHp));
    w('genFill', g.gen.hp / g.gen.maxHp); set('genTxt', 'SHIELD GENERATOR ' + Math.ceil(Math.max(0, g.gen.hp)));
    set('waveTxt', g.wave ? (g.boss ? '☠ ' : '') + 'WAVE ' + g.wave : 'GET READY');
    set('waveSub', g.waveSub || '');
    set('scoreTxt', U.fmt(g.score));
    set('coresTxt', '◆ ' + Math.floor(g.cores) + ' CORES');
    w('xpFill', g.xp / g.xpNeed); set('lvlTxt', 'LV ' + g.level);
    var dk = $('abDash'), sk = $('abStrike');
    var dr = 1 - Math.min(1, h.dashCd / h.dashMax); dk.querySelector('.cd').style.height = (dr * 100) + '%'; dk.classList.toggle('ready', h.dashCd <= 0);
    sk.querySelector('.cd').style.height = (g.strike * 100) + '%'; sk.classList.toggle('ready', g.strike >= 1);
    var td = $('tDash'), ts = $('tStrike');
    td.style.opacity = h.dashCd <= 0 ? 1 : 0.45; ts.style.opacity = g.strike >= 1 ? 1 : 0.45;
    ts.innerHTML = g.strike >= 1 ? 'STRIKE' : 'STRIKE<br>' + Math.floor(g.strike * 100) + '%';
    set('autoTag', PB.input.lastDevice === 'touch' ? '' : g.autoOn ? 'AUTO-FIRE ON (F)' : 'MANUAL AIM (F = AUTO)');
    var gh = $('stickGhost'); if (gh) gh.style.display = PB.input.stickActive ? 'none' : 'flex';
  };
  UI.flash = function () { var f = $('flash'); f.style.transition = 'none'; f.style.opacity = 0.7; setTimeout(function () { f.style.transition = 'opacity .5s'; f.style.opacity = 0; }, 40); };
  UI.combo = function (n) { var c = $('combo'); if (n >= 5) { c.textContent = n + 'x COMBO'; c.style.opacity = 1; } else c.style.opacity = 0; };
  UI.alert = function (on) { $('alert').classList.toggle('hidden', !on); };
  var toastQ = [], toastBusy = 0;
  UI.toast = function (txt, color) { toastQ.push([txt, color]); if (toastQ.length > 3) toastQ.shift(); };
  UI.tick = function (dt) {
    toastBusy -= dt;
    if (toastBusy <= 0 && toastQ.length) {
      var t = toastQ.shift(), box = $('toasts'); box.innerHTML = '';
      var d = document.createElement('div'); d.className = 'toast'; d.textContent = t[0]; d.style.color = t[1] || '#fff'; box.appendChild(d);
      toastBusy = toastQ.length ? 0.7 : 1.1;
    }
  };
  UI.clearToasts = function () { toastQ = []; $('toasts').innerHTML = ''; };
  UI.hint = function (txt) { var h = $('hint'); if (!txt) { h.classList.add('hidden'); return; } h.innerHTML = txt; h.classList.remove('hidden'); };
  UI.build = function (txt, p) { var b = $('build'); if (!txt) { b.classList.add('hidden'); return; } b.classList.remove('hidden'); set('buildTxt', txt); $('buildFill').style.width = (p * 100) + '%'; };
  // off-screen pod arrows
  var arrowEls = [];
  UI.arrows = function (list) {
    var box = $('arrows');
    while (arrowEls.length < list.length) {
      var e = document.createElement('div'); e.className = 'arw';
      e.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34"><circle cx="17" cy="17" r="15" fill="#0b1030cc" stroke="currentColor" stroke-width="3"/><path d="M17 5 L26 20 L8 20 Z" fill="currentColor"/></svg>';
      box.appendChild(e); arrowEls.push(e);
    }
    for (var i = 0; i < arrowEls.length; i++) {
      var el = arrowEls[i];
      if (i >= list.length) { el.style.display = 'none'; continue; }
      var a = list[i]; el.style.display = 'block'; el.style.left = a.x + 'px'; el.style.top = a.y + 'px';
      el.style.color = a.color; el.style.transform = 'rotate(' + a.ang + 'rad)';
    }
  };
  UI.setKeys = function (touch) {
    $('keys').innerHTML = touch ? '' : 'WASD move · MOUSE aim · HOLD CLICK fire · F auto-fire<br>SPACE dash · E / RIGHT CLICK strike · P pause · M mute';
    $('kDash').textContent = touch ? '' : 'SPACE'; $('kStrike').textContent = touch ? '' : 'E';
    $('abil').classList.toggle('hidden', touch);
    if (touch) UI.show('touch'); else UI.hide('touch');
  };

  // ---------------- level-up cards ----------------
  UI.cards = function (opts, cb) {
    var wrap = $('cardWrap'); wrap.innerHTML = '';
    var chosen = false, armed = false;
    setTimeout(function () { armed = true; }, 350); // prevent accidental click-through
    opts.forEach(function (o, i) {
      var c = document.createElement('div'); c.className = 'card ' + ['', 'rare', 'epic'][o.rar];
      c.innerHTML = '<div class="rr">' + PB.RARITY[o.rar] + '</div><div class="ic">' + o.icon + '</div><div class="nm">' + o.name + '</div><div class="ds">' + o.desc + '</div><div class="ds" style="opacity:.6">' + (o.lvl ? 'Level ' + (o.lvl + 1) + ' of ' + o.max : 'NEW') + '</div><div class="key">' + (PB.input.lastDevice === 'touch' ? '' : '[' + (i + 1) + ']') + '</div>';
      c.addEventListener('click', function () { if (!armed || chosen) return; chosen = true; cb(o); });
      wrap.appendChild(c);
    });
    UI._cardKey = function (n) { if (!armed || chosen || n < 1 || n > opts.length) return; chosen = true; cb(opts[n - 1]); };
    UI.show('cards');
  };

  // ---------------- menu ----------------
  UI.refreshMenu = function () {
    var ri = PB.rankInfo();
    $('mRank').textContent = '★ ' + ri.name.toUpperCase() + '  ' + U.fmt(ri.xp) + '/' + U.fmt(ri.need);
    $('mCredits').textContent = '⬢ ' + U.fmt(S.credits) + ' CREDITS';
    var z = PB.ZONES[S.zone], best = S.best[S.zone] || 0;
    $('zoneName').innerHTML = (S.zone + 1) + '. ' + z.name.toUpperCase() + '<br><small style="opacity:.75">Best wave ' + best + ' · pay x' + z.payMul + '</small>';
    $('zPrev').disabled = S.zone <= 0;
    $('zNext').disabled = S.zone >= S.zonesUnlocked - 1;
    var dm = Meta.dailyMod();
    var md = S.missions.list.filter(function (m) { return m.done && !m.claimed; }).length;
    $('dailyBox').innerHTML = '<b style="color:var(--or)">DAILY CHALLENGE: ' + dm.mod.name.toUpperCase() + '</b> in ' + PB.ZONES[dm.zone].name + '<br>' + dm.mod.desc +
      '<br>' + (S.daily.done ? '✅ Completed today. Best wave ' + S.daily.best : 'Reach wave 5 for <span class="cr">+400 credits</span>') +
      ' <button class="btn sm" id="bDaily">' + (S.daily.done ? 'REPLAY' : 'PLAY DAILY') + '</button>' +
      '<br>🔥 Login streak: ' + S.streak.count + ' day' + (S.streak.count === 1 ? '' : 's') + (md ? ' · <b class="cr">' + md + ' mission reward' + (md > 1 ? 's' : '') + ' ready!</b>' : '');
    $('bDaily').onclick = function () { PB.audio.sfx('click'); PB.startRun({ daily: true }); };
  };
  UI.menu = function () {
    UI.hide('hud'); UI.hide('touch'); UI.hide('over'); UI.hide('pause'); UI.hide('cards');
    UI.refreshMenu(); UI.show('menu');
  };

  // ---------------- modals ----------------
  function modal(html) { $('modalBody').innerHTML = html; UI.show('modal'); }
  UI.closeModal = function () { UI.hide('modal'); if (UI.isShown('menu')) UI.refreshMenu(); if (UI.isShown('over')) PB.refreshOver && PB.refreshOver(); };
  UI.armory = function (tab) {
    tab = tab || 'perks';
    var h = '<h2>ARMORY</h2><div class="cr" style="margin-bottom:8px">⬢ ' + U.fmt(S.credits) + ' credits</div><div class="tabs"><button class="btn sm tab ' + (tab === 'perks' ? 'on' : '') + '" data-tab="perks">PERKS</button><button class="btn sm tab ' + (tab === 'weapons' ? 'on' : '') + '" data-tab="weapons">WEAPONS</button></div><div class="grid">';
    if (tab === 'perks') {
      PB.PERKS.forEach(function (p) {
        var l = PB.perkLvl(p.id), cost = PB.perkCost(p), max = l >= 5;
        h += '<div class="item"><h3>' + p.icon + ' ' + p.name + '</h3><div>' + p.desc + '</div><div class="pips">' + [0, 1, 2, 3, 4].map(function (i) { return '<i class="' + (i < l ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
          (max ? '<b>MAXED</b>' : '<button class="btn sm" data-perk="' + p.id + '" ' + (S.credits < cost ? 'disabled' : '') + '>UPGRADE ⬢ ' + U.fmt(cost) + '</button>') + '</div>';
      });
    } else {
      PB.WEAPON_ORDER.forEach(function (id) {
        var wp = PB.WEAPONS[id], own = S.weapons[id], eq = S.weapon === id;
        h += '<div class="item"><h3>' + wp.icon + ' ' + wp.name + '</h3><div>' + wp.desc + '</div><div style="opacity:.7;margin:4px 0">Damage ' + wp.dmg + (wp.count > 1 ? ' x' + wp.count : '') + ' · ' + wp.rate + ' shots/s</div>' +
          (eq ? '<b style="color:var(--cy)">EQUIPPED</b>' : own ? '<button class="btn sm" data-equip="' + id + '">EQUIP</button>' : '<button class="btn sm" data-buy="' + id + '" ' + (S.credits < wp.cost ? 'disabled' : '') + '>UNLOCK ⬢ ' + U.fmt(wp.cost) + '</button>') + '</div>';
      });
    }
    modal(h + '</div>');
    var body = $('modalBody');
    body.querySelectorAll('[data-tab]').forEach(function (b) { b.onclick = function () { PB.audio.sfx('click'); UI.armory(b.dataset.tab); }; });
    body.querySelectorAll('[data-perk]').forEach(function (b) { b.onclick = function () { var p = PB.PERKS.filter(function (x) { return x.id === b.dataset.perk; })[0], c = PB.perkCost(p); if (S.credits >= c) { S.credits -= c; S.perks[p.id] = PB.perkLvl(p.id) + 1; PB.persist(); PB.audio.sfx('build'); } UI.armory('perks'); }; });
    body.querySelectorAll('[data-buy]').forEach(function (b) { b.onclick = function () { var wp = PB.WEAPONS[b.dataset.buy]; if (S.credits >= wp.cost) { S.credits -= wp.cost; S.weapons[b.dataset.buy] = true; S.weapon = b.dataset.buy; PB.persist(); PB.audio.sfx('levelup'); } UI.armory('weapons'); }; });
    body.querySelectorAll('[data-equip]').forEach(function (b) { b.onclick = function () { S.weapon = b.dataset.equip; PB.persist(); PB.audio.sfx('click'); UI.armory('weapons'); }; });
  };
  UI.dex = function () {
    var found = PB.DEX_ORDER.filter(function (k) { return S.dex[k]; }).length;
    var h = '<h2>XENODEX</h2><div style="opacity:.85;margin-bottom:10px">' + found + ' / ' + PB.DEX_ORDER.length + ' species catalogued. Kill milestones give permanent bonus damage against that species.</div><div class="dex">';
    PB.DEX_ORDER.forEach(function (k) {
      var D = PB.ENEMIES[k], n = S.dex[k] || 0, tier = PB.DEX_TIERS.filter(function (t) { return n >= t; }).length;
      var next = PB.DEX_TIERS[tier];
      h += '<div class="item ' + (n ? '' : 'lock') + '"><img src="' + D.img + '" alt="" style="' + (k === 'behemoth' ? 'filter:hue-rotate(-20deg) saturate(1.4)' : '') + '"><h3>' + (n ? D.name : '???') + '</h3>' +
        (n ? '<div style="opacity:.85">' + D.lore + '</div><div style="margin-top:4px">Defeated: ' + U.fmt(n) + ' · Tier ' + ['-', 'I', 'II', 'III'][tier] + ' (+' + tier * 5 + '% dmg)' + (next ? '<br><small style="opacity:.7">Next tier at ' + next + '</small>' : '') + '</div>' : '<div style="opacity:.6">Defeat one to catalogue it.</div>') + '</div>';
    });
    modal(h + '</div>');
  };
  UI.missions = function () {
    var h = '<h2>DAILY MISSIONS</h2><div style="opacity:.8;margin-bottom:10px">New missions every day. Progress counts across all runs.</div><div class="grid">';
    S.missions.list.forEach(function (m) {
      h += '<div class="item"><h3>' + (m.claimed ? '✅ ' : m.done ? '🎁 ' : '🎯 ') + m.txt + '</h3><div class="pips"><i class="on" style="flex:' + Math.max(0.001, m.p / m.n) + '"></i><i style="flex:' + (1 - m.p / m.n + 0.001) + '"></i></div>' + U.fmt(m.p) + ' / ' + U.fmt(m.n) + ' · reward <span class="cr">⬢ ' + m.reward + '</span></div>';
    });
    var ready = S.missions.list.some(function (m) { return m.done && !m.claimed; });
    h += '</div><button class="btn big" id="bClaim" ' + (ready ? '' : 'disabled') + '>CLAIM REWARDS</button>';
    var ri = PB.rankInfo();
    h += '<h3 style="margin-top:14px">RANK: ' + ri.name.toUpperCase() + '</h3><div style="opacity:.8">Earn rank from score. Next: ' + (PB.RANKS[ri.lvl + 1] || 'MAX') + ' (' + U.fmt(ri.xp) + ' / ' + U.fmt(ri.need) + ')</div>';
    h += '<div style="opacity:.8;margin-top:6px">Runs: ' + S.runs + ' · Aliens defeated: ' + U.fmt(S.totalKills) + ' · Pods broken: ' + U.fmt(S.totalPods) + '</div>';
    modal(h);
    $('bClaim').onclick = function () { var t = Meta.claimAll(); if (t) { PB.audio.sfx('levelup'); UI.toast('+' + t + ' CREDITS', '#ffd23f'); } UI.missions(); };
  };
  UI.settings = function () {
    var s = S.settings;
    modal('<h2>SETTINGS</h2><button class="btn" id="sSfx">SOUND: ' + (s.sfx ? 'ON' : 'OFF') + '</button><button class="btn" id="sMus">MUSIC: ' + (s.music ? 'ON' : 'OFF') + '</button><button class="btn" id="sQ">GRAPHICS: ' + ['LOW', 'MEDIUM', 'HIGH'][PB.W.quality] + '</button>' +
      '<h3 style="margin-top:14px">HOW TO PLAY</h3><div style="text-align:left;line-height:1.6;font-size:clamp(12px,1.9vmin,15px)">• Alien pods crash down. <b>Shoot a pod before its ring runs out</b> and the aliens inside never hatch.<br>• Protect the <b>Shield Generator</b> in the centre. If it falls, or you fall, the run ends.<br>• Collect <b style="color:var(--lime)">◆ cores</b> and stand on a glowing pad near the generator to build or upgrade a turret.<br>• Pink gems give XP. Each level lets you pick an upgrade card.<br>• Kills charge the <b>Orbital Strike</b>. Use it on big groups and bosses.<br>• Spend credits in the Armory between runs. Bosses arrive on waves 5 and 10.</div>' +
      '<div style="opacity:.55;font-size:11px;margin-top:10px">Font: Russo One (SIL Open Font License). Engine: three.js (MIT). Art made with Higgsfield.</div>');
    $('sSfx').onclick = function () { s.sfx = !s.sfx; PB.persist(); PB.audio.apply(); UI.settings(); };
    $('sMus').onclick = function () { s.music = !s.music; PB.persist(); PB.audio.apply(); UI.settings(); };
    $('sQ').onclick = function () { PB.W.setQuality((PB.W.quality + 1) % 3); PB.manualQuality = true; UI.settings(); };
  };

  // ---------------- wiring ----------------
  UI.wire = function () {
    $('bPlay').onclick = function () { PB.audio.sfx('click'); PB.startRun({}); };
    $('zPrev').onclick = function () { if (S.zone > 0) { S.zone--; PB.persist(); PB.previewZone(); UI.refreshMenu(); } };
    $('zNext').onclick = function () { if (S.zone < S.zonesUnlocked - 1) { S.zone++; PB.persist(); PB.previewZone(); UI.refreshMenu(); } };
    $('bArmory').onclick = function () { PB.audio.sfx('click'); UI.armory(); };
    $('bOverArmory').onclick = function () { PB.audio.sfx('click'); UI.armory(); };
    $('bDex').onclick = function () { PB.audio.sfx('click'); UI.dex(); };
    $('bMissions').onclick = function () { PB.audio.sfx('click'); UI.missions(); };
    $('bSettings').onclick = function () { PB.audio.sfx('click'); UI.settings(); };
    $('bClose').onclick = function () { PB.audio.sfx('click'); UI.closeModal(); };
    $('bResume').onclick = function () { PB.resume(); };
    $('bQuit').onclick = function () { PB.quitRun(); };
    $('bAgain').onclick = function () { PB.audio.sfx('click'); PB.again(); };
    $('bMenu').onclick = function () { PB.audio.sfx('click'); PB.toMenu(); };
    function tog(k, id) { S.settings[k] = !S.settings[k]; PB.persist(); PB.audio.apply(); UI.pauseLabels(); }
    $('bMute').onclick = function () { tog('sfx'); };
    $('bMusic').onclick = function () { tog('music'); };
    var tb = function (id, fn) { $(id).addEventListener('touchstart', function (e) { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); $(id).addEventListener('mousedown', function (e) { e.stopPropagation(); fn(); }); };
    tb('tDash', function () { PB.input.dashPressed = true; });
    tb('tStrike', function () { PB.input.strikePressed = true; });
    tb('tPause', function () { PB.input.pausePressed = true; });
    $('abDash').style.pointerEvents = 'auto'; $('abStrike').style.pointerEvents = 'auto';
    $('abDash').onclick = function () { PB.input.dashPressed = true; };
    $('abStrike').onclick = function () { PB.input.strikePressed = true; };
  };
  UI.pauseLabels = function () {
    $('bMute').textContent = 'SOUND: ' + (S.settings.sfx ? 'ON' : 'OFF');
    $('bMusic').textContent = 'MUSIC: ' + (S.settings.music ? 'ON' : 'OFF');
  };
})(window.PB);
