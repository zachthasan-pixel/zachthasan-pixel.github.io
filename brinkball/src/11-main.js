// ---------------------------------------------------------------------------
// Boot and main loop.
// ---------------------------------------------------------------------------
(function boot() {
  Save.load();
  Missions.ensure();
  R.init($('cv'));
  Input.init($('cv'));
  UI.init();
  let last = performance.now();
  const loop = now => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    Input.pollPads();
    if (!UI.paused && !Portal.adActive) G.frame(dt);
    R.draw(UI.paused || Portal.adActive ? 0 : dt);
    UI.hud();
    requestAnimationFrame(loop);
  };
  Portal.init().then(() => {
    Portal.loadingStart();
    Portal.loadingStop();
    // First visit: straight into a short warm-up match. Afterwards: the menu, one click from play.
    if (!Save.d.tutorial) { UI.firstMatch = false; G.start('tutorial'); UI.show(null); }
    else { G.start('demo'); UI.show('menu'); }
    requestAnimationFrame(loop);
  });
})();
