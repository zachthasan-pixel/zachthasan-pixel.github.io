/* Pod Breakers - synthesized audio (no files) */
(function (PB) {
  'use strict';
  var A = PB.audio = { ctx: null, master: null, sfxBus: null, musBus: null, muted: false, ready: false, intensity: 0 };
  var noiseBuf = null, lastPlay = {};
  A.init = function () {
    if (A.ctx) { if (A.ctx.state !== 'running') A.ctx.resume(); return; }
    var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try { A.ctx = new AC(); } catch (e) { return; }
    var c = A.ctx;
    A.master = c.createGain(); A.master.gain.value = 0.8;
    var comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
    A.master.connect(comp); comp.connect(c.destination);
    A.sfxBus = c.createGain(); A.sfxBus.connect(A.master);
    A.musBus = c.createGain(); A.musBus.gain.value = 0.34; A.musBus.connect(A.master);
    noiseBuf = c.createBuffer(1, c.sampleRate * 1.5, c.sampleRate);
    var d = noiseBuf.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    A.ready = true; A.apply();
  };
  A.apply = function () {
    if (!A.ready) return;
    var s = PB.save.settings, sdkM = PB.platform && PB.platform.sdkMuted;
    var t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime((A.muted || sdkM) ? 0 : 0.8, t, 0.02);
    A.sfxBus.gain.setTargetAtTime(s.sfx ? 1 : 0, t, 0.02);
    A.musBus.gain.setTargetAtTime(s.music ? 0.34 : 0, t, 0.05);
  };
  A.setPaused = function (p) { A.duck = p; if (A.ready) A.musBus.gain.setTargetAtTime(p ? 0.08 : (PB.save.settings.music ? 0.34 : 0), A.ctx.currentTime, 0.1); };
  function ok(name, gap) {
    if (!A.ready || A.ctx.state !== 'running') return false;
    var t = A.ctx.currentTime; if (lastPlay[name] && t - lastPlay[name] < (gap || 0.03)) return false;
    lastPlay[name] = t; return true;
  }
  function env(g, t, a, peak, dec) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); }
  function osc(type, f0, f1, dur, vol, dest, delay) {
    var c = A.ctx, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    env(g, t, 0.005, vol, dur); o.connect(g); g.connect(dest || A.sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, fType, f0, f1, dest, delay, q) {
    var c = A.ctx, t = c.currentTime + (delay || 0), s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = noiseBuf; f.type = fType || 'lowpass'; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q || 1;
    env(g, t, 0.004, vol, dur); s.connect(f); f.connect(g); g.connect(dest || A.sfxBus); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  A.sfx = function (n, p) {
    p = p || 1;
    switch (n) {
      case 'shoot': if (!ok(n, 0.05)) return; osc('square', 900 * p, 260 * p, 0.08, 0.05); noise(0.05, 0.04, 'highpass', 3000); break;
      case 'scatter': if (!ok(n, 0.1)) return; noise(0.2, 0.22, 'lowpass', 2600, 300); osc('sawtooth', 220, 60, 0.15, 0.08); break;
      case 'arc': if (!ok(n, 0.07)) return; noise(0.1, 0.08, 'bandpass', 4000, 1200, null, 0, 4); osc('sawtooth', 1400, 300, 0.09, 0.04); break;
      case 'rail': if (!ok(n, 0.1)) return; osc('sawtooth', 2200, 80, 0.4, 0.12); noise(0.3, 0.15, 'highpass', 1500, 6000); break;
      case 'turret': if (!ok(n, 0.06)) return; osc('square', 600, 200, 0.06, 0.025); break;
      case 'hit': if (!ok(n, 0.035)) return; osc('triangle', 500 * p, 150, 0.06, 0.06); break;
      case 'kill': if (!ok(n, 0.04)) return; noise(0.18, 0.13, 'lowpass', 1800 * p, 200); osc('sine', 300 * p, 60, 0.18, 0.1); break;
      case 'splat': if (!ok(n, 0.05)) return; noise(0.22, 0.12, 'bandpass', 900, 200, null, 0, 2); break;
      case 'boom': if (!ok(n, 0.05)) return; noise(0.7 * p, 0.45, 'lowpass', 1400, 60); osc('sine', 120, 30, 0.6 * p, 0.35); break;
      case 'whistle': if (!ok(n, 0.15)) return; osc('sine', 1800, 300, 1.1, 0.05); break;
      case 'impact': if (!ok(n, 0.08)) return; noise(0.45, 0.35, 'lowpass', 900, 50); osc('sine', 90, 35, 0.4, 0.3); break;
      case 'podbreak': if (!ok(n, 0.05)) return; noise(0.3, 0.2, 'highpass', 800, 4000); osc('square', 300, 900, 0.12, 0.06); osc('sine', 1200, 1800, 0.15, 0.06, null, 0.06); break;
      case 'hatch': if (!ok(n, 0.1)) return; noise(0.4, 0.2, 'bandpass', 400, 1200, null, 0, 3); osc('sawtooth', 110, 55, 0.4, 0.08); break;
      case 'pickup': if (!ok(n, 0.03)) return; osc('sine', 1200 + Math.random() * 300, 1900, 0.06, 0.035); break;
      case 'xp': if (!ok(n, 0.03)) return; osc('triangle', 1500 + Math.random() * 400, 2200, 0.05, 0.025); break;
      case 'levelup': if (!ok(n, 0.3)) return; [523, 659, 784, 1047].forEach(function (f, i) { osc('square', f, 0, 0.16, 0.06, null, i * 0.07); osc('sine', f * 2, 0, 0.2, 0.03, null, i * 0.07); }); break;
      case 'pick': osc('triangle', 700, 1400, 0.12, 0.08); break;
      case 'click': if (!ok(n, 0.04)) return; osc('sine', 900, 1300, 0.05, 0.05); break;
      case 'dash': if (!ok(n, 0.1)) return; noise(0.25, 0.14, 'bandpass', 600, 3000, null, 0, 2); break;
      case 'hurt': if (!ok(n, 0.15)) return; osc('sawtooth', 220, 90, 0.2, 0.12); noise(0.12, 0.1, 'lowpass', 1200); break;
      case 'gen': if (!ok(n, 0.4)) return; osc('square', 180, 140, 0.25, 0.05); osc('square', 180, 140, 0.25, 0.05, null, 0.3); break;
      case 'build': osc('square', 400, 800, 0.1, 0.06); osc('square', 800, 1600, 0.12, 0.05, null, 0.1); break;
      case 'strikeCall': osc('sine', 300, 1200, 0.6, 0.08); break;
      case 'strike': noise(1.4, 0.6, 'lowpass', 3000, 40); osc('sawtooth', 160, 25, 1.2, 0.3); osc('sine', 60, 20, 1.2, 0.4); break;
      case 'spit': if (!ok(n, 0.1)) return; noise(0.15, 0.1, 'bandpass', 1500, 400, null, 0, 3); break;
      case 'orb': if (!ok(n, 0.1)) return; osc('sine', 600, 300, 0.2, 0.05); break;
      case 'roar': if (!ok(n, 0.8)) return; osc('sawtooth', 90, 45, 1.2, 0.2); noise(1.0, 0.2, 'lowpass', 600, 100); break;
      case 'wave': [392, 523, 659].forEach(function (f, i) { osc('square', f, 0, 0.22, 0.05, null, i * 0.11); }); break;
      case 'lose': [392, 330, 262, 196].forEach(function (f, i) { osc('triangle', f, f * 0.98, 0.35, 0.09, null, i * 0.22); }); break;
      case 'dex': [880, 1175, 1568].forEach(function (f, i) { osc('sine', f, 0, 0.18, 0.06, null, i * 0.08); }); break;
    }
  };

  // ---------- music: simple synthwave sequencer ----------
  var mus = { on: false, step: 0, next: 0, bpm: 124, timer: null };
  var scales = [[0, 3, 7, 10], [0, 3, 5, 7], [0, 5, 7, 10], [0, 3, 7, 8]];
  var roots = [45, 41, 43, 40]; // A, F, G, E
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function note(type, freq, t, dur, vol, cutoff) {
    var c = A.ctx, o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = type; o.frequency.value = freq; f.type = 'lowpass'; f.frequency.value = cutoff || 2000;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f); f.connect(g); g.connect(A.musBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(kind, t, vol) {
    var c = A.ctx;
    if (kind === 'k') { var o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g); g.connect(A.musBus); o.start(t); o.stop(t + 0.25); }
    else { var s = c.createBufferSource(), f = c.createBiquadFilter(), g2 = c.createGain(); s.buffer = noiseBuf; f.type = kind === 's' ? 'bandpass' : 'highpass'; f.frequency.value = kind === 's' ? 1800 : 7000; g2.gain.setValueAtTime(vol, t); g2.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 's' ? 0.16 : 0.04)); s.connect(f); f.connect(g2); g2.connect(A.musBus); s.start(t, Math.random()); s.stop(t + 0.2); }
  }
  function schedule() {
    if (!mus.on || !A.ready) return;
    var c = A.ctx, spb = 60 / mus.bpm / 4;
    while (mus.next < c.currentTime + 0.15) {
      var s = mus.step, bar = Math.floor(s / 16) % 4, st = s % 16, t = mus.next, I = A.intensity;
      var root = roots[bar], sc = scales[bar];
      if (st % 4 === 0) drum('k', t, 0.5);
      if (I > 0.25 && (st === 4 || st === 12)) drum('s', t, 0.18);
      if (st % 2 === 1) drum('h', t, I > 0.5 ? 0.06 : 0.035);
      if (st % 2 === 0) note('sawtooth', mtof(root - 12 + (st % 8 === 6 ? 12 : 0)), t, spb * 1.8, 0.09, 500 + I * 900);
      if (I > 0.4 && st % 3 === 0) note('square', mtof(root + 12 + sc[(s * 7 + bar) % 4]), t, spb * 1.2, 0.025, 2400);
      if (st === 0) { for (var k = 0; k < 3; k++) note('triangle', mtof(root + 12 + sc[k]), t, spb * 15, 0.02, 1500); }
      mus.step++; mus.next += spb;
    }
  }
  A.musicStart = function () { if (!A.ready) return; if (mus.on) return; mus.on = true; mus.next = A.ctx.currentTime + 0.1; if (!mus.timer) mus.timer = setInterval(schedule, 50); };
  A.musicStop = function () { mus.on = false; };
  // iOS: resume audio after interruptions on any touch/click
  ['touchend', 'click', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function () { A.init(); if (A.ctx && A.ctx.state !== 'running') A.ctx.resume(); }, true); });
})(window.PB);
