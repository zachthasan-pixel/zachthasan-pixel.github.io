/* Pod Breakers - boot, loop, run lifecycle */
(function (PB) {
  'use strict';
  var U = PB.U, W = PB.W, S = PB.save, I = PB.input, UI = PB.UI, A = PB.audio, GM = PB.Game, P = PB.platform;
  var $ = function (id) { return document.getElementById(id); };
  var state = 'boot'; // boot | menu | play | paused | cards | dying | over
  var acc = 0, lastT = 0, deathT = 0, deathCause = '';
  PB.manualQuality = false;

  function setTouchUI() { UI.setKeys(I.lastDevice === 'touch' || PB.isTouchDevice); }

  // ---------- run lifecycle ----------
  PB.startRun = function (opts) {
    UI.hide('menu'); UI.hide('over'); UI.hide('modal'); UI.hide('pause'); UI.hide('cards');
    UI.clearToasts();
    PB.Meta.checkDaily();
    var g = GM.newRun(opts || {});
    g.paid = { credits: 0, rank: 0 };
    UI.show('hud'); setTouchUI(); bossBar(null);
    state = 'play'; acc = 0;
    A.musicStart(); A.intensity = 0.2;
    I.dashPressed = false; I.strikePressed = false; I.pausePressed = false; I.startLatch = false;
  };
  PB.onBegin = function () { P.gameplayStart(); A.init(); };
  PB.pause = function () {
    if (state !== 'play') return;
    state = 'paused'; P.gameplayStop(); A.setPaused(true);
    var touch = I.lastDevice === 'touch';
    $('pauseInfo').innerHTML = (touch ? 'Left side: move · auto-aim & auto-fire<br>DASH and STRIKE buttons on the right' : 'WASD / ZQSD / Arrows move · Mouse aim · Hold click fire · F auto-fire<br>Space / Shift dash · E / Right click strike · P resume · M mute') +
      '<br><br>Zone: ' + GM.g.Z.name + ' · Wave ' + GM.g.wave + ' · Level ' + GM.g.level + ' · Weapon: ' + PB.WEAPONS[GM.g.weapon].name +
      '<br>Upgrades: ' + (Object.keys(GM.g.up).map(function (k) { var u = PB.UPGRADES.filter(function (x) { return x.id === k; })[0]; return u ? u.icon + u.name + ' ' + GM.g.up[k] : ''; }).join(' · ') || 'none yet');
    UI.pauseLabels(); UI.show('pause');
  };
  PB.resume = function () {
    if (state !== 'paused') return;
    UI.hide('pause'); state = 'play'; A.setPaused(false); I.mdown = false;
    if (GM.g.started) P.gameplayStart();
  };
  PB.quitRun = function () { UI.hide('pause'); finishRun(true); PB.toMenu(); };
  PB.toMenu = function () {
    P.gameplayStop(); GM.clear(); state = 'menu'; A.intensity = 0.1; bossBar(null);
    var msgs = PB.Meta.checkDaily(); UI.menu(); msgs.forEach(function (m) { UI.toast(m, '#ffd23f'); });
  };
  PB.again = function () {
    var opts = { daily: GM.g && GM.g.daily };
    UI.hide('over');
    if (P.name === 'poki') {
      state = 'ad'; A.master && A.master.gain.setValueAtTime(0, A.ctx.currentTime);
      P.commercialBreak().then(function () { A.apply(); PB.startRun(opts); });
    } else PB.startRun(opts);
  };
  PB.previewZone = function () {};

  GM.onDeath = function (cause) {
    var g = GM.g; if (!g || g.over) return;
    g.over = true; deathCause = cause; deathT = 1.3; state = 'dying';
    P.gameplayStop(); A.sfx('lose'); W.addShake(1);
    var x = cause === 'gen' ? 0 : g.hero.x, z = cause === 'gen' ? 0 : g.hero.z;
    W.burst(x, 1.5, z, cause === 'gen' ? 0x3ff0ff : 0xff9a2e, 80, 14, 1, 0.5); W.ring(x, z, 1, 16, 0.8, 0xffffff);
    UI.hint(null); UI.build(null);
  };

  function finishRun(quit) {
    var g = GM.g; if (!g) return null;
    var reached = g.wave - (g.waveState === 'clear' ? 0 : 1);
    var credits = Math.round((g.kills * 2 + g.podsBroken * 5 + Math.max(0, reached) * 20 + g.bossKills * 150) * g.Z.payMul * (g.daily ? 1.25 : 1));
    if (S.runs === 0 && !g.paid.recruit) { credits += 150; g.paid.recruit = true; }
    var rank = Math.round(g.score / 10);
    var dc = credits - g.paid.credits, dr = rank - g.paid.rank;
    S.credits += dc; S.rankXp += dr; g.paid.credits = credits; g.paid.rank = rank;
    if (!g.paid.counted) { S.runs++; g.paid.counted = true; }
    if (g.daily) S.daily.best = Math.max(S.daily.best, g.wave);
    var bestKey = g.zone, prevBest = S.best[bestKey] || 0, newBest = g.wave > prevBest;
    if (newBest) S.best[bestKey] = g.wave;
    PB.persist();
    return { credits: credits, newBest: newBest, rank: rank };
  }

  function showOver() {
    var g = GM.g, res = finishRun(false);
    state = 'over';
    var ri = PB.rankInfo();
    $('overTitle').textContent = deathCause === 'gen' ? 'GENERATOR DESTROYED' : 'DEFENDER DOWN';
    var md = S.missions.list.filter(function (m) { return m.done && !m.claimed; }).length;
    $('overStats').innerHTML =
      '<div class="stat"><span>Wave reached</span><b>' + g.wave + (res.newBest ? ' <span style="color:var(--or)">NEW BEST!</span>' : '') + '</b></div>' +
      '<div class="stat"><span>Score</span><b>' + U.fmt(g.score) + '</b></div>' +
      '<div class="stat"><span>Aliens defeated</span><b>' + U.fmt(g.kills) + '</b></div>' +
      '<div class="stat"><span>Pods smashed in time</span><b>' + g.podsBroken + '</b></div>' +
      '<div class="stat"><span>Pods that hatched</span><b>' + g.podsHatched + '</b></div>' +
      '<div class="stat"><span>Best combo</span><b>' + g.bestCombo + 'x</b></div>' +
      '<div class="stat"><span>Credits earned</span><b class="cr">+' + U.fmt(res.credits) + ' ⬢</b></div>' +
      '<div class="stat"><span>Rank</span><b>' + ri.name + ' (' + U.fmt(ri.xp) + '/' + U.fmt(ri.need) + ')</b></div>' +
      '<div style="margin:8px 0;opacity:.85;font-size:clamp(11px,1.8vmin,14px)">' + nextGoal(g) + (md ? '<br><b class="cr">🎁 ' + md + ' mission reward' + (md > 1 ? 's' : '') + ' ready in MISSIONS</b>' : '') + '</div>';
    var rr = $('reviveRow');
    if (P.hasRewarded && !g.revived) {
      rr.innerHTML = '<button class="btn" id="bRevive" style="background:linear-gradient(180deg,#5a3aa0,#3a2270);border-color:#a080ff">🎬 Watch ad to revive</button>';
      rr.classList.remove('hidden');
      $('bRevive').onclick = function () {
        rr.classList.add('hidden'); state = 'ad';
        if (A.master) A.master.gain.setValueAtTime(0, A.ctx.currentTime);
        P.rewarded().then(function (ok) {
          A.apply();
          if (ok) { UI.hide('over'); GM.revive(); state = 'play'; P.gameplayStart(); }
          else state = 'over';
        });
      };
    } else rr.classList.add('hidden');
    UI.hide('hud'); UI.hide('touch'); UI.show('over'); A.intensity = 0.1;
  }
  PB.refreshOver = function () {};
  function nextGoal(g) {
    var cheapest = null;
    PB.PERKS.forEach(function (p) { if (PB.perkLvl(p.id) < 5) { var c = PB.perkCost(p); if (!cheapest || c < cheapest.c) cheapest = { c: c, n: p.name }; } });
    if (cheapest && S.credits >= cheapest.c) return '💡 You can afford <b>' + cheapest.n + '</b> in the Armory!';
    if (g.wave < 5) return '💡 Next goal: reach wave 5 and defeat the Behemoth.';
    if (g.wave < 10) return '💡 Next goal: survive wave 10 to unlock ' + (PB.ZONES[g.zone + 1] ? PB.ZONES[g.zone + 1].name : 'glory') + '.';
    return '💡 Try the Daily Challenge for bonus credits.';
  }

  // ---------- level-up cards ----------
  function openCards() {
    var g = GM.g; state = 'cards'; P.gameplayStop(); A.sfx('levelup');
    W.burst(g.hero.x, 1.5, g.hero.z, 0xc46bff, 40, 9, 0.8, 0.4); W.ring(g.hero.x, g.hero.z, 0.5, 6, 0.5, 0xc46bff);
    UI.cards(GM.cardOptions(), function (c) {
      A.sfx('pick'); GM.applyCard(c); g.pendingLv--;
      UI.hide('cards'); I.mdown = false;
      if (g.pendingLv > 0) { setTimeout(openCards, 150); return; }
      state = 'play'; P.gameplayStart();
    });
  }

  // ---------- boss bar ----------
  var bb = null;
  function bossBar(e) {
    if (!bb) {
      bb = document.createElement('div'); bb.style.cssText = 'position:absolute;left:50%;top:64px;transform:translateX(-50%);width:min(60vw,520px);text-align:center;font-size:clamp(11px,1.8vmin,15px);text-shadow:0 2px 3px #000';
      bb.innerHTML = '<div id="bbName"></div><div class="bar2" style="height:12px"><i id="bbFill" style="background:linear-gradient(90deg,#ff3fa4,#b04bff)"></i></div>';
      $('hud').appendChild(bb);
    }
    bb.style.display = e ? 'block' : 'none'; bb._e = e;
    if (e) $('bbName').textContent = '☠ ' + e.D.name.toUpperCase();
  }
  UI.bossBar = bossBar;

  // ---------- input actions ----------
  PB.onKey = function (code) {
    if (state === 'cards' && /^Digit[1-3]$/.test(code)) UI._cardKey(+code.slice(5));
    if (state === 'menu' && (code === 'Enter') && !UI.isShown('modal')) PB.startRun({});
    if (state === 'over' && code === 'Enter') PB.again();
  };
  PB.onBlur = function () { if (state === 'play' && GM.g && GM.g.started) PB.pause(); };
  document.addEventListener('visibilitychange', function () { if (document.hidden) PB.onBlur(); });
  PB.toggleMute = function () { A.muted = !A.muted; A.apply(); UI.toast(A.muted ? 'MUTED' : 'SOUND ON', '#fff'); };
  P.onMute(function () { A.apply(); });

  // ---------- loop ----------
  var fpsAcc = 0, fpsN = 0, lowT = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    var dt = Math.min(0.1, (t - lastT) / 1000 || 0.016); lastT = t;
    frame(dt);
  }
  function frame(dt) {
    var g = GM.g;
    UI.tick(dt);
    if (I.pausePressed) { I.pausePressed = false; if (state === 'play' && g && g.started) PB.pause(); else if (state === 'paused') PB.resume(); }
    if (g && (state === 'play' || state === 'dying')) {
      var scale = 1;
      if (g.hitstop > 0) { g.hitstop -= dt; scale = 0.08; }
      if (state === 'dying') { scale = 0.3; deathT -= dt; if (deathT <= 0) showOver(); }
      acc += dt * scale;
      var steps = 0;
      while (acc >= GM.DT && steps < 6) {
        if (state === 'play' || state === 'dying') GM.step(GM.DT);
        acc -= GM.DT; steps++;
        if (state === 'play' && g.pendingLv > 0 && !g.over) { openCards(); acc = 0; break; }
      }
      if (steps >= 6) acc = 0;
      W.updateFx(dt * scale);
      A.intensity = Math.min(1, 0.25 + g.enemies.length / 40 + (g.boss ? 0.4 : 0));
      if (bb && bb._e) { $('bbFill').style.width = Math.max(0, bb._e.hp / bb._e.maxHp * 100) + '%'; if (bb._e.dead) bossBar(null); }
      else if (g.boss) bossBar(g.boss);
    } else if (g) W.updateFx(0);
    if (g) GM.frame(dt);
    if (state !== 'menu' && state !== 'boot') W.render();
    // auto-quality
    if (!PB.manualQuality && state === 'play') {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 2) { var fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; if (fps < 42 && W.quality > 0) { lowT++; if (lowT >= 2) { W.setQuality(W.quality - 1); lowT = 0; } } else lowT = 0; }
    }
  }

  // ---------- boot ----------
  function boot() {
    var fill = $('loadFill');
    P.init().then(function () {
      P.loadingStart(); fill.style.width = '40%';
      W.init($('c'));
      var q = PB.store.get('quality', null);
      W.setQuality(PB.isTouchDevice ? 1 : 2);
      UI.wire(); fill.style.width = '70%';
      PB.Meta.checkDaily();
      // warm up shaders with a quick run build, then decide first screen
      setTimeout(function () {
        fill.style.width = '100%';
        P.loadingDone();
        $('loading').style.display = 'none';
        if (PB.firstVisit || S.runs === 0) PB.startRun({});
        else PB.toMenu();
        requestAnimationFrame(loop);
      }, 60);
    });
  }
  window.addEventListener('pointerdown', function (e) { if (e.pointerType === 'touch' || PB.isTouchDevice) { I.lastDevice = 'touch'; if (state === 'play') setTouchUI(); } else if (e.pointerType === 'mouse' && I.lastDevice === 'touch') { I.lastDevice = 'kb'; if (state === 'play') setTouchUI(); } }, true);

  

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window.PB);
