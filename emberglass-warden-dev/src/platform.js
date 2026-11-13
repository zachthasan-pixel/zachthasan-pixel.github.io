// Platform adapter: itch (no SDK), crazygames (SDK v3), poki (SDK v2).
/* global __PLATFORM__ */
const P = __PLATFORM__;
let cg = null, playing = false, onMute = () => {};

export const platform = {
  name: P,
  async init(muteCb) {
    onMute = muteCb || onMute;
    try {
      if (P === 'crazygames' && window.CrazyGames) {
        await window.CrazyGames.SDK.init();
        cg = window.CrazyGames.SDK;
        if (cg.environment === 'disabled') { cg = null; return; }
        try { onMute(!!cg.game.settings.muteAudio); cg.game.addSettingsChangeListener((s) => onMute(!!s.muteAudio)); } catch (e) {}
      } else if (P === 'poki' && window.PokiSDK) {
        await window.PokiSDK.init().catch(() => {});
      }
    } catch (e) { cg = null; }
  },
  loadingStart() { try { cg && cg.game.loadingStart(); } catch (e) {} },
  loadingStop() { try { if (cg) cg.game.loadingStop(); else if (P === 'poki' && window.PokiSDK) window.PokiSDK.gameLoadingFinished(); } catch (e) {} },
  gameplayStart() {
    if (playing) return; playing = true;
    try { if (cg) cg.game.gameplayStart(); else if (P === 'poki' && window.PokiSDK) window.PokiSDK.gameplayStart(); } catch (e) {}
  },
  gameplayStop() {
    if (!playing) return; playing = false;
    try { if (cg) cg.game.gameplayStop(); else if (P === 'poki' && window.PokiSDK) window.PokiSDK.gameplayStop(); } catch (e) {}
  },
  happytime() { try { cg && cg.game.happytime(); } catch (e) {} },
  // Poki only: ad break when heading back into gameplay. Calls done() when finished.
  commercialBreak(before, done) {
    if (P === 'poki' && window.PokiSDK) {
      try { window.PokiSDK.commercialBreak(before).then(done, done); return; } catch (e) {}
    }
    done();
  },
  isMobile() {
    try { if (cg && cg.getSystemInfo) { const t = cg.getSystemInfo().device.type; return t === 'mobile' || t === 'tablet'; } } catch (e) {}
    return window.matchMedia && window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  },
};
