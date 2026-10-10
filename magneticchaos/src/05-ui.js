// ---------------------------------------------------------------------------
// DOM overlays, HUD, pause handling, adaptive quality and the main loop.
// ---------------------------------------------------------------------------
const $ = id => document.getElementById(id);
const UI = {
  paused: false, lastMouse: null, bannerT: 0, msT: 0, shown: '',
  init() {
    this.el = {
      hud: $('hud'), time: $('time'), best: $('best'), tier: $('tier'), banner: $('banner'),
      bName: $('bannerName'), bSub: $('bannerSub'), pulse: $('pulse'), pulseFill: $('pulseFill'),
      pulseLabel: $('pulseLabel'), combo: $('combo'), title: $('title'), over: $('over'), pause: $('pause'),
      titleBest: $('titleBest'), oTime: $('oTime'), oCause: $('oCause'), oNew: $('oNew'), oRank: $('oRank'),
      oBest: $('oBest'), oGrazes: $('oGrazes'), oCombo: $('oCombo'), oAnoms: $('oAnoms'),
      revive: $('btnRevive'), toast: $('toast'), mute: $('btnMute'), pauseBtn: $('btnPause'),
      hint: $('hint'),
    };
    const on = (id, fn) => $(id).addEventListener('click', e => { e.stopPropagation(); AU.init(); fn(); });
    on('btnPlay', () => this.play());
    on('btnRetry', () => this.retry());
    on('btnMenu', () => this.menu());
    on('btnMenu2', () => { this.resume(); this.menu(); });
    on('btnResume', () => this.resume());
    on('btnRevive', () => this.revive());
    on('btnMute', () => this.toggleMute());
    on('btnPause', () => (this.paused ? this.resume() : this.pause()));
    this.el.pulse.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); if (Game.state === 'play') Game.tryPulse(); });
    window.addEventListener('pointermove', e => { if (e.pointerType !== 'touch') this.lastMouse = [e.clientX, e.clientY]; }, { passive: true });
    window.addEventListener('pointerdown', e => { if (e.pointerType === 'touch') document.body.classList.add('touch'); }, { passive: true });
    if (window.matchMedia && matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.autoPause(); });
    window.addEventListener('blur', () => this.autoPause());
    window.addEventListener('focus', () => { if (!this.paused) AU.resume(); });
    window.addEventListener('resize', () => { View.resize(); GL.resize(); });
    this.syncMute();
    this.el.titleBest.textContent = Stats.best > 0 ? 'BEST  ' + Stats.best.toFixed(2) + 's  ·  ' + tierFor(Stats.best) : '';
  },
  show(el, yes) { el.classList.toggle('hidden', !yes); },
  play() {
    if (Game.state !== 'title') return;   // Enter on a focused button fires key + click
    AU.click();
    this.show(this.el.title, false); this.show(this.el.over, false);
    this.showHud();
    Game.start();
  },
  retry() {
    if (Game.state !== 'over' || Portal.pending) return;
    AU.click();
    this.show(this.el.over, false);
    Portal.midgame(() => { this.showHud(); Game.start(); });
  },
  menu() {
    AU.click();
    Portal.gameplayStop();
    this.show(this.el.over, false); this.show(this.el.pause, false); this.hideHud();
    this.el.titleBest.textContent = Stats.best > 0 ? 'BEST  ' + Stats.best.toFixed(2) + 's  ·  ' + tierFor(Stats.best) : '';
    this.show(this.el.title, true);
    Game.toTitle();
  },
  revive() {
    if (Game.state !== 'over' || Game.revived || Portal.pending) return;
    Portal.rewarded(ok => {
      if (ok) { this.show(this.el.over, false); this.showHud(); Game.revive(); }
      else this.toast('No video available right now');
    });
  },
  showHud() { this.show(this.el.hud, true); document.body.classList.add('playing'); this.el.hint.classList.remove('gone'); this.hintT = 6; },
  hideHud() { this.show(this.el.hud, false); document.body.classList.remove('playing'); this.el.banner.classList.remove('on'); },
  showOver() {
    const t = Game.t, prev = Stats.best, isNew = t > prev;
    if (isNew) { Stats.best = t; Store.set('best', t); if (prev > 0) Portal.happy(); }
    const causes = { wall: 'The Spark touched the wall', opp: 'Opposite-charge contact', sing: 'Swallowed by the singularity' };
    const e = this.el;
    e.oTime.textContent = t.toFixed(2);
    e.oCause.textContent = causes[Game.cause] || '';
    e.oRank.textContent = tierFor(t);
    e.oBest.textContent = Stats.best.toFixed(2) + 's';
    e.oGrazes.textContent = Game.grazes;
    e.oCombo.textContent = '×' + Game.bestCombo;
    e.oAnoms.textContent = Game.survived;
    this.show(e.oNew, isNew && prev > 0);
    this.show(e.revive, Portal.hasRewarded && !Game.revived);
    this.show(e.over, true);
    setTimeout(() => { const b = $('btnRetry'); if (b && !e.over.classList.contains('hidden')) b.focus({ preventScroll: true }); }, 50);
  },
  pause() {
    if (Game.state !== 'play' || this.paused) return;
    this.paused = true;
    this.show(this.el.pause, true);
    AU.suspend();
    Portal.gameplayStop();
  },
  autoPause() { if (Game.state === 'play') this.pause(); else AU.suspend(); },
  resume() {
    if (!this.paused) return;
    this.paused = false;
    this.show(this.el.pause, false);
    AU.init(); AU.resume();
    Input.pulse = false;
    Portal.gameplayStart();
  },
  toggleMute() { Settings.muted = !Settings.muted; Store.set('muted', Settings.muted); this.syncMute(); AU.applyGain(); },
  syncMute() { this.el.mute.classList.toggle('muted', Settings.muted); this.el.mute.setAttribute('aria-label', Settings.muted ? 'Unmute' : 'Mute'); },
  onKey(k) {
    if (k === 'KeyM') { this.toggleMute(); return; }
    if (this.paused) { if (k === 'Enter' || k === 'Space' || k === 'KeyP' || k === 'Escape') this.resume(); return; }
    if (Game.state === 'play') {
      if (k === 'Space') Game.tryPulse();
      else if (k === 'KeyP' || k === 'Escape') this.pause();
    } else if (Game.state === 'title') {
      if (k === 'Enter' || k === 'Space') this.play();
    } else if (Game.state === 'over') {
      if (k === 'Enter' || k === 'Space' || k === 'KeyR') this.retry();
    }
  },
  banner(name, sub, col) {
    const b = this.el.banner;
    this.el.bName.textContent = name; this.el.bSub.textContent = sub;
    b.style.setProperty('--bc', col ? `rgb(${col.map(v => Math.round(v * 255)).join(',')})` : '');
    b.classList.remove('on'); void b.offsetWidth; b.classList.add('on');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = setTimeout(() => b.classList.remove('on'), 2200);
  },
  milestone(sec, tier, isTier) {
    const t = this.el.tier;
    t.textContent = isTier ? tier : sec + ' SECONDS';
    t.classList.toggle('big', isTier);
    t.classList.remove('on'); void t.offsetWidth; t.classList.add('on');
    this.el.time.classList.remove('pop'); void this.el.time.offsetWidth; this.el.time.classList.add('pop');
  },
  pulseReady() { this.el.pulse.classList.remove('flash'); void this.el.pulse.offsetWidth; this.el.pulse.classList.add('flash'); },
  pulseDenied() { this.el.pulse.classList.remove('deny'); void this.el.pulse.offsetWidth; this.el.pulse.classList.add('deny'); },
  toast(msg) {
    const t = this.el.toast; t.textContent = msg; t.classList.add('on');
    clearTimeout(this.toastTimer); this.toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
  },
  hud(dt) {
    if (Game.state !== 'play' && Game.state !== 'dying') return;
    const e = this.el, txt = Game.t.toFixed(2);
    if (txt !== this.shown) { e.time.textContent = txt; this.shown = txt; }
    const bestTxt = Stats.best > 0 ? (Game.t > Stats.best ? 'NEW BEST' : 'BEST ' + Stats.best.toFixed(2)) : 'SURVIVE';
    if (bestTxt !== this.bestShown) { e.best.textContent = bestTxt; e.best.classList.toggle('hot', Game.t > Stats.best && Stats.best > 0); this.bestShown = bestTxt; }
    const m = Math.round(Game.meter * 100);
    if (m !== this.mShown) {
      e.pulseFill.style.transform = `scaleX(${Game.meter})`;
      e.pulse.classList.toggle('ready', Game.meter >= 1);
      e.pulseLabel.textContent = Game.meter >= 1 ? (document.body.classList.contains('touch') ? 'PULSE READY · TAP' : 'PULSE READY · CLICK / SPACE') : 'GRAZE DEBRIS TO CHARGE';
      this.mShown = m;
    }
    const cb = Game.combo >= 2 ? '×' + Game.combo : '';
    if (cb !== this.cShown) { e.combo.textContent = cb; this.cShown = cb; if (cb) { e.combo.classList.remove('bump'); void e.combo.offsetWidth; e.combo.classList.add('bump'); } }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) e.hint.classList.add('gone'); }
  },
};

// Adaptive resolution: if frames are slow for ~2 s, render at a lower scale.
const Perf = {
  acc: 0, n: 0,
  sample(ms) {
    if (document.hidden || UI.paused) return;
    this.acc += ms; this.n++;
    if (this.n < 120) return;
    const avg = this.acc / this.n; this.acc = 0; this.n = 0;
    if (avg > 21 && View.quality > 0.5) { View.quality = Math.max(0.5, View.quality - 0.2); GL.resize(); }
    else if (avg < 14 && View.quality < 1) { View.quality = Math.min(1, View.quality + 0.1); GL.resize(); }
  },
};

let lastFrame = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (!lastFrame) lastFrame = now;
  const raw = now - lastFrame;
  lastFrame = now;
  if (raw <= 0) return;
  const dt = Math.min(raw / 1000, 0.05);
  Perf.sample(raw);
  if (!UI.paused && !Portal.adActive) Game.update(dt);
  const playing = Game.state === 'play' && !UI.paused;
  AU.setMood(Game.state === 'title' ? 0.05 : Game.intensity, Game.state === 'play' ? Game.danger : 0, playing);
  Game.draw(GL);
  GL.frame(Game.uniforms());
  UI.hud(dt);
}

function boot() {
  View.resize();
  const canvas = $('gl');
  if (!GL.init(canvas)) { $('nogl').classList.remove('hidden'); $('title').classList.add('hidden'); return; }
  GL.resize();
  Input.init(canvas);
  UI.init();
  Game.toTitle();
  requestAnimationFrame(frame);
  Portal.init().then(() => Portal.loadingStop());
  // Debug hook for automated tests and screenshots (harmless for players).
  window.__mc = { Game, F, Input, UI, View, Portal, Perf, GL, AU };
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
