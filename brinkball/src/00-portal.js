// ---------------------------------------------------------------------------
// Portal layer. build.sh stamps PORTAL as 'web' (itch.io + own site, no ads),
// 'crazygames' or 'poki'. If a portal SDK is missing (adblock, offline, wrong
// domain) every call quietly falls through and the game plays normally.
// ---------------------------------------------------------------------------
const PORTAL = 'web';
const Portal = {
  name: PORTAL, ready: false, playing: false, adActive: false, sdkMute: false, log: [],
  get cg() { return window.CrazyGames && window.CrazyGames.SDK; },
  get poki() { return window.PokiSDK; },
  init() {
    const done = ok => { this.ready = !!ok; };
    try {
      if (PORTAL === 'crazygames' && this.cg) {
        return this.cg.init().then(() => {
          const env = this.cg.environment;
          done(env === 'crazygames' || env === 'local');
          if (!this.ready) return;
          const apply = s => { this.sdkMute = !!(s && s.muteAudio); AU.applyGain(); };
          apply(this.cg.game.settings);
          this.cg.game.addSettingsChangeListener(apply);
        }).catch(() => done(false));
      }
      if (PORTAL === 'poki' && this.poki) {
        // Poki: continue to the game whether init resolves or rejects (ad blockers).
        return this.poki.init().then(() => done(true)).catch(() => done(true));
      }
    } catch (e) { done(false); }
    return Promise.resolve();
  },
  loadingStart() { this._try('loadingStart', () => { if (PORTAL === 'crazygames') this.cg.game.loadingStart(); }); },
  loadingStop() {
    this._try('loadingStop', () => {
      if (PORTAL === 'crazygames') this.cg.game.loadingStop();
      if (PORTAL === 'poki') this.poki.gameLoadingFinished();
    });
  },
  gameplayStart() {
    if (this.playing || this.adActive) return;
    this.playing = true;
    this._try('gameplayStart', () => { if (PORTAL === 'crazygames') this.cg.game.gameplayStart(); else if (PORTAL === 'poki') this.poki.gameplayStart(); });
  },
  gameplayStop() {
    if (!this.playing) return;
    this.playing = false;
    this._try('gameplayStop', () => { if (PORTAL === 'crazygames') this.cg.game.gameplayStop(); else if (PORTAL === 'poki') this.poki.gameplayStop(); });
  },
  happy() { this._try('happytime', () => { if (PORTAL === 'crazygames') this.cg.game.happytime(); }); },
  // Rewarded videos only on Poki. CrazyGames starts games in Basic Launch with ads
  // off, and a reward button that does nothing gets a game rejected.
  get hasRewarded() { return this.ready && PORTAL === 'poki'; },
  // A break before going back into gameplay. cb always runs exactly once.
  midgame(cb) { this._ad('midgame', () => cb()); },
  // Opt-in rewarded video. cb(true) only if the ad was actually watched.
  rewarded(cb) { this._ad('rewarded', cb); },
  pending: false,
  _ad(kind, cb) {
    if (!this.ready || PORTAL === 'web') { cb(false); return; }
    let finished = false;
    this.pending = true;
    const start = () => { this.adActive = true; this.log.push('adStart'); AU.applyGain(); };
    const end = ok => {
      if (finished) return; finished = true;
      this.adActive = false; this.pending = false; this.log.push('adEnd'); AU.applyGain(); cb(ok);
    };
    this.gameplayStop();
    // If the SDK never answers, don't leave the game frozen.
    setTimeout(() => { if (!this.adActive) end(false); }, 8000);
    try {
      if (PORTAL === 'crazygames') {
        this.cg.ad.requestAd(kind, { adStarted: start, adFinished: () => end(true), adError: () => end(false) });
      } else {
        const p = kind === 'rewarded' ? this.poki.rewardedBreak(start) : this.poki.commercialBreak(start);
        p.then(ok => end(kind === 'rewarded' ? !!ok : true)).catch(() => end(false));
      }
    } catch (e) { end(false); }
  },
  _try(name, fn) { this.log.push(name); if (!this.ready) return; try { fn(); } catch (e) { /* never let a portal break the game */ } },
};
