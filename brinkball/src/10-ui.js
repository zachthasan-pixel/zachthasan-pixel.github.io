// ---------------------------------------------------------------------------
// UI: menus, HUD, locker, results, Party and Daily screens (plain DOM).
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const UI = {
  paused: false, screen: null, firstMatch: true, lockerTab: 'skin', anyInput: false,
  init() {
    const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); AU.init(); AU.ui(); fn(e); });
    on('btnPlay', () => this.go('royale'));
    on('btnAgain', () => this.again());
    on('btnHome', () => this.toMenu());
    on('btnDouble', () => this.doubleCoins());
    on('btnParty', () => this.show('partySetup'));
    on('btnPartyBack', () => this.show('menu'));
    on('btnPartyGo', () => { G.party = { score: [0, 0], round: 1 }; this.go('party'); });
    on('btnNextRound', () => this.nextRound());
    on('btnPartyQuit', () => this.toMenu());
    on('btnDaily', () => this.dailyIntro());
    on('btnDailyGo', () => this.go('daily'));
    on('btnDailyBack', () => this.show('menu'));
    on('btnLocker', () => this.openLocker());
    on('lockerBack', () => { Save.write(); this.show('menu'); });
    on('btnGift', () => this.gift());
    on('btnResume', () => this.togglePause(false));
    on('btnQuit', () => { this.paused = false; AU.applyGain(); this.toMenu(); });
    on('btnMusic', () => { Save.d.music = Save.d.music ? 0 : 1; Save.write(); AU.applyGain(); this.musicLabel(); });
    on('btnMute', () => this.toggleMute());
    on('btnPause', () => this.togglePause());
    document.querySelectorAll('#botSeg button').forEach(b => b.addEventListener('click', () => {
      AU.ui(); Save.d.partyBots = +b.dataset.n; Save.write(); this.segSync();
    }));
    document.querySelectorAll('.tabs button').forEach(b => b.addEventListener('click', () => {
      AU.ui(); this.lockerTab = b.dataset.tab; this.renderLocker();
    }));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { if (G.mode !== 'demo' && (G.state === 'play' || G.state === 'countdown') && !this.paused) this.togglePause(true); AU.suspend(); }
      else if (!this.paused) AU.resume();
    });
    const markInput = () => {
      this.anyInput = true;
      if (G.mode && G.mode !== 'demo' && (G.state === 'play' || G.state === 'countdown') && !this.paused && !this.screen) Portal.gameplayStart();
    };
    addEventListener('keydown', markInput); addEventListener('pointerdown', markInput);
    this.syncMute(); this.segSync(); this.musicLabel();
  },
  show(id) {
    for (const s of ['menu', 'locker', 'result', 'partySetup', 'partyRound', 'dailyIntro', 'pause']) $(s).classList.toggle('hidden', s !== id);
    this.screen = id || null; this.shownAt = performance.now();
    if (id === 'menu') this.refreshMenu();
    const inMatch = !id && G.mode && G.mode !== 'demo';
    $('hud').classList.toggle('hidden', !(inMatch || id === 'pause' || (id === 'result' && G.state === 'spectate')));
    $('touch').classList.toggle('hidden', !inMatch);
    $('btnPause').classList.toggle('hidden', !inMatch);
  },
  // --- flow ------------------------------------------------------------------
  go(mode) {
    const start = () => {
      G.start(mode);
      this.show(null);
      Portal.gameplayStart();
    };
    // An ad break may play before going back into gameplay (never before the first match).
    if (this.firstMatch) { this.firstMatch = false; start(); }
    else Portal.midgame(start);
  },
  again() {
    if (G.mode === 'daily') return this.go('daily');
    this.go('royale');
  },
  toMenu() {
    Portal.gameplayStop();
    AU.stopMusic();
    G.start('demo');
    this.show('menu');
  },
  nextRound() {
    const P = G.party;
    if (P.score[0] >= 3 || P.score[1] >= 3) { P.score = [0, 0]; P.round = 0; }
    P.round++;
    this.go('party');
  },
  onMatchStart() {
    const m = G.mode, A = G.arena.def;
    $('pscore').classList.toggle('hidden', m !== 'party');
    $('left').classList.toggle('hidden', m === 'party');
    $('modeTag').classList.toggle('low', m === 'party');
    $('ab1').classList.toggle('hidden', m === 'party');
    $('touch').classList.toggle('party', m === 'party');
    $('feed').innerHTML = '';
    $('hint').className = '';
    let tag = A.name.toUpperCase();
    if (m === 'daily') tag = 'DAILY · ' + G.mod.name.toUpperCase() + ' · ' + tag;
    if (m === 'party') tag = 'ROUND ' + G.party.round + ' · ' + tag;
    if (m === 'tutorial') tag = 'WARM-UP';
    $('modeTag').textContent = tag;
    if (m === 'party') { $('s1').textContent = G.party.score[0]; $('s2').textContent = G.party.score[1]; }
    const p1 = G.players[0];
    if (p1) {
      document.querySelectorAll('.tbtn.ab[data-slot="1"] span, #ab1 .ico').forEach(e => { e.textContent = ABILITIES[p1.ability].icon; });
      $('ab1').querySelector('.lbl').textContent = m === 'party' ? 'E' : 'E';
    }
    const p2 = G.players[1];
    if (p2) document.querySelectorAll('.tbtn.ab[data-slot="2"] span').forEach(e => { e.textContent = ABILITIES[p2.ability].icon; });
    if (m === 'tutorial') this.tutorialHint(0);
    else if (m !== 'demo' && Save.d.stats.matches < 3 && !Input.touch) this.hintFor('Hold SPACE or the mouse button to charge a big dash', 4);
    if (m === 'party') this.hintFor(Input.touch ? 'P1 left half · P2 right half' : 'P1: WASD + Space · P2: Arrows + Enter', 3);
  },
  hintFor(text, secs) {
    const h = $('hint'); h.innerHTML = text; h.className = 'on';
    clearTimeout(this.hintT); this.hintT = setTimeout(() => { h.className = ''; }, secs * 1000);
  },
  tutorialHint(step) {
    const t = Input.touch;
    const lines = [
      t ? 'Drag on the left side to roll' : 'Move with <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>, the arrows or the mouse',
      t ? 'Tap <b>DASH</b> to slam into a rival!' : 'Tap <kbd>SPACE</kbd> or click to <b>DASH</b> into a rival!',
      t ? 'HOLD <b>DASH</b>, then let go, for a charged hit' : '<b>HOLD</b> <kbd>SPACE</kbd> then let go for a charged hit',
      t ? 'Tap 💥 for a Shockwave' : 'Press <kbd>E</kbd> or right-click for a 💥 Shockwave',
      'Knock them all off the edge! The more <b style="color:#ff7a4a">%</b>, the further they fly',
    ];
    const h = $('hint'); h.innerHTML = lines[step]; h.className = 'on';
    clearTimeout(this.hintT);
    if (step === 4) this.hintT = setTimeout(() => { h.className = ''; }, 5000);
  },
  big(text, col) {
    if (!text) return;
    const b = $('bigText'); b.textContent = text; b.style.color = col || '#fff';
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
  },
  feedMsg(html, col) {
    const f = $('feed'), d = document.createElement('div');
    d.innerHTML = html; if (col) d.style.color = col;
    f.prepend(d);
    while (f.children.length > 4) f.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 3500);
    setTimeout(() => d.remove(), 4200);
  },
  toast(html) {
    const t = $('toast'), d = document.createElement('div');
    d.innerHTML = html; t.appendChild(d);
    setTimeout(() => d.remove(), 3200);
  },
  abilityUsed() {},
  stick(slot, x, y, dx, dy, on) {
    const s = $('stick' + slot);
    s.classList.toggle('on', on);
    if (!on) return;
    s.style.left = x + 'px'; s.style.top = y + 'px';
    s.firstElementChild.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  },
  hud() {
    if (!G.mode || G.mode === 'demo') return;
    $('leftN').textContent = G.alive().length;
    for (const o of G.players) {
      const ab = ABILITIES[o.ability], f = clamp(o.abCd / ab.cd, 0, 1);
      if (o.slot === 1) {
        $('ab1').querySelector('.cd').style.transform = 'scaleY(' + f + ')';
        $('ab1').classList.toggle('ready', f === 0);
      }
      document.querySelectorAll('.tbtn.ab[data-slot="' + o.slot + '"]').forEach(b => b.classList.toggle('cool', f > 0));
      document.querySelectorAll('.tbtn.dash[data-slot="' + o.slot + '"]').forEach(b => b.classList.toggle('cool', o.dashCd > 0));
    }
  },
  // --- results -------------------------------------------------------------------
  showResult(res) {
    if (!res || this.screen === 'result') return;
    const S = Save.d;
    const daily = res.mode === 'daily', tut = res.mode === 'tutorial';
    if (tut) { S.tutorial = 1; Save.write(); }
    $('rKicker').textContent = daily ? 'DAILY CHALLENGE · ' + G.mod.name.toUpperCase() : tut ? 'WARM-UP' : 'ROYALE · ' + G.arena.def.name.toUpperCase();
    $('rPlace').textContent = res.place === 1 ? 'WINNER!' : '#' + res.place;
    $('rPlace').style.color = res.place === 1 ? '#ffe25a' : res.place <= 3 ? '#9fe8ff' : '#ffffff';
    const subs = { 1: 'Last one standing. Unstoppable!', 2: 'So close! One more?', 3: 'On the podium.' };
    let sub = subs[res.place] || (res.kos ? 'You took ' + res.kos + ' with you.' : 'Stay away from the edge!');
    if (daily) sub = 'Score <b>' + res.dailyScore + '</b>' + (res.newBest ? ' · NEW BEST TODAY' : ' · best ' + S.daily.best) + ' · 🔥 ' + res.dailyStreak + '-day streak';
    if (res.streakBonus) sub += ' · win streak bonus +' + res.streakBonus;
    $('rSub').innerHTML = sub;
    clearTimeout(this.hintT); $('hint').className = '';
    $('rKos').textContent = res.kos;
    $('rTime').textContent = Math.round(res.time) + 's';
    $('rCoins').textContent = '+' + res.coins;
    const rr = $('rRank');
    rr.classList.toggle('hidden', daily);
    if (!daily) {
      const before = rankOf(res.rpBefore), after = rankOf(S.rp);
      rr.querySelector('.rk').textContent = after.label;
      rr.querySelector('.rk').style.color = after.col;
      const bar = rr.querySelector('.bar i');
      bar.style.transition = 'none'; bar.style.width = (after.i === before.i && before.div === after.div ? before.frac : 0) * 100 + '%';
      void bar.offsetWidth; bar.style.transition = ''; bar.style.width = after.frac * 100 + '%';
      const d = rr.querySelector('.delta');
      d.textContent = (res.rp >= 0 ? '+' : '') + res.rp + ' RP';
      d.className = 'delta ' + (res.rp >= 0 ? 'up' : 'down');
    }
    const u = $('rUnlocks'); u.innerHTML = '';
    if (res.rankUp) u.innerHTML += '<div>⬆ Promoted to ' + res.rankUp + '!</div>';
    for (const x of res.unlocks) u.innerHTML += '<div>🔓 Unlocked: ' + x + '</div>';
    if (res.firstDaily) u.innerHTML += '<div>🔥 Daily streak bonus paid</div>';
    $('btnDouble').classList.toggle('hidden', !(Portal.hasRewarded && res.coins > 0));
    $('btnDouble').disabled = false;
    $('btnAgain').firstChild.textContent = tut ? 'PLAY ROYALE' : daily ? 'TRY AGAIN' : 'PLAY AGAIN';
    if (res.place === 1) AU.win(); else if (G.state !== 'ending') AU.lose();
    if (res.place === 1) Portal.happy();
    this.show('result');
    this.syncCoins();
  },
  doubleCoins() {
    const r = G.result; if (!r || r.doubled) return;
    $('btnDouble').disabled = true;
    Portal.rewarded(ok => {
      if (!ok) { $('btnDouble').disabled = false; return; }
      r.doubled = true; Save.d.coins += r.coins; Save.write();
      $('rCoins').textContent = '+' + r.coins * 2; AU.coin();
      $('btnDouble').classList.add('hidden'); this.syncCoins();
    });
  },
  partyRound(w) {
    const P = G.party;
    const won = P.score[0] >= 3 ? 1 : P.score[1] >= 3 ? 2 : 0;
    $('s1').textContent = P.score[0]; $('s2').textContent = P.score[1];
    $('prKicker').textContent = won ? 'MATCH OVER' : 'ROUND ' + P.round;
    const who = $('prWho');
    if (won) { who.textContent = 'P' + won + ' WINS THE MATCH!'; who.style.color = won === 1 ? '#ffe25a' : '#5fb8ff'; Portal.happy(); }
    else if (w && w.human) { who.textContent = w.name + ' WINS'; who.style.color = w.slot === 1 ? '#ffe25a' : '#5fb8ff'; }
    else { who.textContent = w ? w.name + ' (CPU) WINS' : 'NOBODY WINS'; who.style.color = '#ffffff'; }
    $('prS1').textContent = P.score[0]; $('prS2').textContent = P.score[1];
    $('btnNextRound').textContent = won ? 'REMATCH' : 'NEXT ROUND';
    this.show('partyRound');
  },
  // --- pause / mute ------------------------------------------------------------
  togglePause(force) {
    const inMatch = G.mode && G.mode !== 'demo' && (G.state === 'play' || G.state === 'countdown');
    const want = force === undefined ? !this.paused : force;
    if (want && !inMatch) return;
    if (want === this.paused) return;
    this.paused = want;
    if (want) { this.show('pause'); Portal.gameplayStop(); }
    else { this.show(null); Portal.gameplayStart(); AU.resume(); }
    AU.applyGain();
  },
  toggleMute() { Save.d.muted = Save.d.muted ? 0 : 1; Save.write(); AU.init(); AU.applyGain(); this.syncMute(); },
  syncMute() { $('btnMute').classList.toggle('muted', !!Save.d.muted); },
  musicLabel() { $('btnMusic').textContent = 'MUSIC: ' + (Save.d.music ? 'ON' : 'OFF'); },
  segSync() { document.querySelectorAll('#botSeg button').forEach(b => b.classList.toggle('on', +b.dataset.n === Save.d.partyBots)); },
  // Enter / Space / gamepad A press the main button of the open screen.
  onKey(e) {
    if (!this.screen || this.screen === 'locker') return false;
    if (e.code !== 'Enter' && e.code !== 'Space' && e.code !== 'NumpadEnter') return false;
    return this.padConfirm();
  },
  padConfirm() {
    if (performance.now() - this.shownAt < 900) return !!this.screen; // don't let a held dash skip the results
    const map = { menu: 'btnPlay', result: 'btnAgain', partySetup: 'btnPartyGo', partyRound: 'btnNextRound', dailyIntro: 'btnDailyGo', pause: 'btnResume' };
    const id = map[this.screen];
    if (!id) return false;
    $(id).click();
    return true;
  },
  // --- menu ----------------------------------------------------------------------
  syncCoins() { document.querySelectorAll('.coins b').forEach(b => { b.textContent = Save.d.coins; }); },
  refreshMenu() {
    const S = Save.d, rk = rankOf(S.rp);
    const chip = $('rankChip');
    chip.querySelector('.rk').textContent = rk.label; chip.querySelector('.rk').style.color = rk.col;
    chip.querySelector('.bar i').style.width = rk.frac * 100 + '%';
    chip.querySelector('small').textContent = rk.next ? (rk.next.rp - S.rp) + ' RP to ' + rk.next.name : 'Top rank!';
    this.syncCoins();
    $('btnGift').classList.toggle('hidden', S.gift === todayKey());
    $('btnGift').classList.toggle('glow', S.gift !== todayKey());
    $('dailySub').textContent = S.daily.day === todayKey() ? 'best ' + S.daily.best : 'new twist today!';
    $('btnDaily').classList.toggle('glow', S.daily.day !== todayKey());
    const M = Missions.ensure();
    let h = '<div class="mhead">DAILY MISSIONS</div>';
    for (const m of M.list) {
      h += '<div class="mission' + (m.done ? ' done' : '') + '"><span class="rw">' + (m.done ? '✔' : '+' + m.reward + ' 🪙') + '</span>' + Missions.text(m) +
        '<div class="mbar"><i style="width:' + Math.round(m.prog / m.n * 100) + '%"></i></div></div>';
    }
    $('missions').innerHTML = h;
  },
  gift() {
    const S = Save.d; if (S.gift === todayKey()) return;
    S.gift = todayKey(); const c = 50 + randi(0, 5) * 10; S.coins += c; Save.write();
    AU.coin(); this.toast('🎁 Daily gift: <b>+' + c + ' 🪙</b> Come back tomorrow for another!');
    this.refreshMenu();
  },
  dailyIntro() {
    const key = todayKey(), rng = makeRng(key * 7 + 3);
    const arena = ARENA_KEYS[Math.floor(rng() * ARENA_KEYS.length)];
    const mod = MODIFIERS[1 + Math.floor(rng() * (MODIFIERS.length - 1))];
    const d = new Date();
    $('dDate').textContent = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    $('dMod').textContent = mod.name;
    $('dModDesc').textContent = mod.desc;
    $('dArena').textContent = 'Arena: ' + ARENAS[arena].name + ' · ' + ARENAS[arena].desc;
    const D = Save.d.daily;
    $('dBest').textContent = D.day === key ? D.best : '–';
    const live = D.lastDay && (dayNumber(key) - dayNumber(D.lastDay) <= 1);
    $('dStreak').textContent = live ? D.streak : 0;
    this.show('dailyIntro');
  },
  // --- locker ----------------------------------------------------------------------
  openLocker() { this.show('locker'); this.renderLocker(); },
  renderLocker() {
    const S = Save.d, tab = this.lockerTab, tier = rankOf(S.rp).i;
    document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const grid = $('grid'); grid.innerHTML = '';
    const note = $('lockerNote');
    note.textContent = tab === 'ability' ? 'Abilities unlock as you climb the ranks. Pick one to take into battle.' : 'Cosmetics only. Earn coins by playing, winning and finishing missions.';
    const list = tab === 'skin' ? SKINS : tab === 'hat' ? HATS : ABILITIES;
    for (const k in list) {
      const it = list[k], d = document.createElement('button');
      d.className = 'item';
      let owned, selected, locked = false, label;
      if (tab === 'ability') {
        locked = it.rank > tier; owned = !locked; selected = S.ability === k;
        d.innerHTML = '<span class="ab">' + it.icon + '</span>' + it.name + '<span class="desc">' + (locked ? '🔒 Reach ' + RANKS[it.rank].name : it.desc) + '</span>';
      } else {
        owned = !!S.owned[k]; selected = (tab === 'skin' ? S.skin : S.hat) === k;
        locked = !owned && it.rank && it.rank > tier;
        const cv = document.createElement('canvas'); cv.width = 112; cv.height = 112;
        paintCreature(cv, tab === 'skin' ? k : S.skin, tab === 'hat' ? k : 'none');
        d.appendChild(cv);
        label = document.createElement('span'); label.textContent = it.name; d.appendChild(label);
        const pr = document.createElement('span'); pr.className = 'price';
        pr.textContent = owned ? (selected ? 'EQUIPPED' : 'OWNED') : locked ? '🔒 ' + RANKS[it.rank].name : '🪙 ' + it.price;
        d.appendChild(pr);
      }
      if (selected) d.classList.add('sel');
      if (locked) d.classList.add('locked');
      d.addEventListener('click', () => this.lockerPick(tab, k));
      grid.appendChild(d);
    }
    paintCreature($('preview'), S.skin, S.hat, ABILITIES[S.ability].icon);
    this.syncCoins();
  },
  lockerPick(tab, k) {
    const S = Save.d, tier = rankOf(S.rp).i;
    if (tab === 'ability') {
      if (ABILITIES[k].rank > tier) { AU.deny(); this.toast('🔒 Reach ' + RANKS[ABILITIES[k].rank].name + ' to unlock ' + ABILITIES[k].name); return; }
      S.ability = k;
    } else {
      const it = (tab === 'skin' ? SKINS : HATS)[k];
      if (!S.owned[k]) {
        if (it.rank && it.rank > tier) { AU.deny(); this.toast('🔒 Reach ' + RANKS[it.rank].name + ' to buy ' + it.name); return; }
        if (S.coins < it.price) { AU.deny(); this.toast('Need ' + (it.price - S.coins) + ' more 🪙. Win matches and finish missions!'); return; }
        S.coins -= it.price; S.owned[k] = 1; AU.coin(); this.toast('Bought ' + it.name + '!');
      }
      if (tab === 'skin') S.skin = k; else S.hat = k;
    }
    AU.ui(); Save.write(); this.renderLocker();
  },
};

// Draw a creature into a small canvas (locker grid and preview).
function paintCreature(cv, skin, hat, badge) {
  const c = cv.getContext('2d'), w = cv.width, h = cv.height, r = w * 0.3;
  c.clearRect(0, 0, w, h);
  const keep = R.c; R.c = c;
  const sk = SKINS[skin];
  c.save(); c.translate(w / 2, h * 0.56);
  c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, r * 0.95, r * 0.9, r * 0.25, 0, 0, TAU); c.fill();
  const g = c.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, sk.c1); g.addColorStop(1, sk.c2);
  c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
  if (sk.pattern) R.pattern(sk, r);
  c.fillStyle = 'rgba(255,255,255,0.45)'; c.beginPath(); c.ellipse(-r * 0.38, -r * 0.45, r * 0.32, r * 0.18, -0.6, 0, TAU); c.fill();
  R.face({ look: 0.35, blink: 1, hitFlash: 0, emote: 1, dashing: false, charging: 0, falling: 0 }, r);
  R.hat(hat, r);
  c.restore();
  if (badge) { c.font = Math.round(w * 0.16) + 'px ' + FONT; c.textAlign = 'center'; c.fillText(badge, w * 0.82, h * 0.2); }
  R.c = keep;
}
