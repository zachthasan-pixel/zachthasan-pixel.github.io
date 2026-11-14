/* The Arcade: remembers nothing about you except, on your own device, which game you
   played last. Best scores are read from where each game already keeps them. */
(function () {
  "use strict";
  var data = [];
  try { data = JSON.parse(document.getElementById("arcade-data").textContent) || []; } catch (e) {}
  var bySlug = {};
  data.forEach(function (g) { bySlug[g.slug] = g; });

  function store(k, v) {
    try {
      if (v === undefined) return window.localStorage.getItem(k);
      window.localStorage.setItem(k, v);
    } catch (e) { return null; }
  }

  // A game's best score, or null. Each game saves in its own way; games.json says where.
  function readBest(cfg) {
    if (!cfg || !cfg.key) return null;
    var raw = store(cfg.key);
    if (raw === null || raw === undefined) return null;
    var v;
    try { v = JSON.parse(raw); } catch (e) { v = raw; }
    if (cfg.path) {
      var parts = String(cfg.path).split(".");
      for (var i = 0; i < parts.length; i++) { if (v === null || typeof v !== "object") return null; v = v[parts[i]]; }
    }
    var n = Number(v);
    return isFinite(n) && n > 0 ? { n: Math.round(n), label: cfg.label || "Best" } : null;
  }

  function showBests() {
    var spots = document.querySelectorAll("[data-game]");
    for (var i = 0; i < spots.length; i++) {
      var g = bySlug[spots[i].getAttribute("data-game")];
      var out = spots[i].querySelector("[data-best]");
      if (!g || !out) continue;
      var b = readBest(g.best);
      if (b) { out.textContent = b.label + " " + b.n.toLocaleString(); out.hidden = false; }
    }
  }
  showBests();
  window.addEventListener("pageshow", showBests);
  window.addEventListener("focus", showBests);

  // Front door: if you have played here before, offer that game first.
  var heroTitle = document.getElementById("arc-hero-title");
  if (heroTitle) {
    var last = bySlug[store("arcade_last")];
    if (last) {
      document.getElementById("arc-hero-kicker").textContent = "Jump back in";
      heroTitle.textContent = last.title;
      document.getElementById("arc-hero-line").textContent = last.tagline;
      document.getElementById("arc-hero-play").href = last.slug + ".html";
      var cover = document.getElementById("arc-hero-cover");
      cover.href = last.slug + ".html";
      var img = cover.querySelector("img");
      img.src = last.cover; img.alt = last.title;
    }
  }

  // A game page: nothing loads until Play is pressed.
  var stage = document.getElementById("arc-stage");
  var startBtn = document.getElementById("arc-start");
  if (!stage || !startBtn) return;
  var wrap = document.querySelector(".arc-play-wrap");
  var slug = wrap ? wrap.getAttribute("data-game") : "";
  var src = stage.getAttribute("data-src");
  var fsBtn = document.getElementById("arc-fs");
  var canFs = !!(stage.requestFullscreen || stage.webkitRequestFullscreen);

  startBtn.addEventListener("click", function () {
    store("arcade_last", slug);
    // On a phone the game gets the whole screen on its own page; the Back button returns here.
    if (window.matchMedia("(max-width: 760px)").matches) { window.location.href = src; return; }
    var frame = document.createElement("iframe");
    frame.src = src;
    frame.title = stage.getAttribute("data-title") || "Game";
    frame.setAttribute("allow", "fullscreen; autoplay; gamepad");
    frame.setAttribute("allowfullscreen", "");
    frame.addEventListener("load", function () { try { frame.contentWindow.focus(); } catch (e) {} });
    stage.classList.add("is-playing");
    stage.appendChild(frame);
    if (canFs && fsBtn) fsBtn.hidden = false;
    window.setInterval(showBests, 4000);
  });

  if (fsBtn) {
    fsBtn.addEventListener("click", function () {
      var on = document.fullscreenElement || document.webkitFullscreenElement;
      if (on) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
      var frame = stage.querySelector("iframe");
      if (frame) { try { frame.contentWindow.focus(); } catch (e) {} }
    });
    var label = function () { fsBtn.textContent = (document.fullscreenElement || document.webkitFullscreenElement) ? "Exit full screen" : "Full screen"; };
    document.addEventListener("fullscreenchange", label);
    document.addEventListener("webkitfullscreenchange", label);
  }
})();
