/* Pod Breakers - platform adapter. The build script rewrites the next line per portal. */
var PB_PLATFORM = 'itch';
window.PB = window.PB || {};
(function (PB) {
  var playing = false, sdk = null, muteCb = null;
  var P = {
    name: PB_PLATFORM,
    hasRewarded: false,
    allowFullscreenBtn: false,
    sdkMuted: false,
    init: function () { return Promise.resolve(); },
    loadingStart: function () {},
    loadingDone: function () {},
    gameplayStart: function () { if (playing) return; playing = true; this._start(); },
    gameplayStop: function () { if (!playing) return; playing = false; this._stop(); },
    _start: function () {}, _stop: function () {},
    happy: function () {},
    commercialBreak: function () { return Promise.resolve(); },
    rewarded: function () { return Promise.resolve(false); },
    onMute: function (cb) { muteCb = cb; }
  };

  if (PB_PLATFORM === 'poki') {
    P.hasRewarded = true;
    P.init = function () {
      return new Promise(function (res) {
        try {
          if (!window.PokiSDK) return res();
          PokiSDK.init().then(function () { res(); }).catch(function () { res(); });
        } catch (e) { res(); }
      });
    };
    P.loadingDone = function () { try { PokiSDK.gameLoadingFinished(); } catch (e) {} };
    P._start = function () { try { PokiSDK.gameplayStart(); } catch (e) {} };
    P._stop = function () { try { PokiSDK.gameplayStop(); } catch (e) {} };
    P.commercialBreak = function (before) {
      return new Promise(function (res) {
        try { PokiSDK.commercialBreak(function () { if (before) before(); }).then(function () { res(); }).catch(function () { res(); }); }
        catch (e) { res(); }
      });
    };
    P.rewarded = function (before) {
      return new Promise(function (res) {
        try { PokiSDK.rewardedBreak(function () { if (before) before(); }).then(function (ok) { res(!!ok); }).catch(function () { res(false); }); }
        catch (e) { res(false); }
      });
    };
  }

  if (PB_PLATFORM === 'crazygames') {
    P.init = function () {
      return new Promise(function (res) {
        try {
          if (!window.CrazyGames || !CrazyGames.SDK) return res();
          sdk = CrazyGames.SDK;
          sdk.init().then(function () {
            try {
              if (sdk.game && sdk.game.settings) P.sdkMuted = !!sdk.game.settings.muteAudio;
              if (sdk.game && sdk.game.addSettingsChangeListener) sdk.game.addSettingsChangeListener(function (s) {
                P.sdkMuted = !!(s && s.muteAudio);
                if (muteCb) muteCb(P.sdkMuted);
              });
            } catch (e) {}
            res();
          }).catch(function () { sdk = null; res(); });
        } catch (e) { sdk = null; res(); }
      });
    };
    P.loadingStart = function () { try { if (sdk) sdk.game.loadingStart(); } catch (e) {} };
    P.loadingDone = function () { try { if (sdk) sdk.game.loadingStop(); } catch (e) {} };
    P._start = function () { try { if (sdk) sdk.game.gameplayStart(); } catch (e) {} };
    P._stop = function () { try { if (sdk) sdk.game.gameplayStop(); } catch (e) {} };
    P.happy = function () { try { if (sdk) sdk.game.happytime(); } catch (e) {} };
  }

  PB.platform = P;
})(window.PB);
