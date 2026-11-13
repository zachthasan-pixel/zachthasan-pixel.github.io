// Procedural WebAudio: sound effects and an adaptive music loop. No audio files.
let ctx = null, master = null, sfxBus = null, musicBus = null, noiseBuf = null;
let muted = false, forcedMute = false, musicOn = false, intensity = 0, nextStep = 0, step = 0, musicTimer = null;

export function initAudio() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted || forcedMute ? 0 : 0.9;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
  master.connect(comp); comp.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.8; sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.32; musicBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function resumeAudio() { if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); }
function applyMute() { if (master) master.gain.setTargetAtTime(muted || forcedMute ? 0 : 0.9, ctx.currentTime, 0.03); }
export function setMuted(m) { muted = m; applyMute(); }
export function setForcedMute(m) { forcedMute = m; applyMute(); }
export function isMuted() { return muted; }
export function setIntensity(v) { intensity = v; }

function tone(type, f0, f1, dur, vol, when = 0, bus = sfxBus) {
  const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
}
function noise(dur, vol, f0, f1, q = 1, type = 'bandpass', when = 0, bus = sfxBus) {
  const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(bus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}

const SFX = {
  swing: (p = 1) => { noise(0.2, 0.3, 500 * p, 2600 * p, 1.4); tone('sawtooth', 190 * p, 90 * p, 0.18, 0.05); },
  heavy: () => { noise(0.34, 0.45, 300, 3200, 1.2); tone('sawtooth', 140, 50, 0.32, 0.12); },
  hit: () => { noise(0.1, 0.5, 2400, 500, 0.8); tone('square', 210, 60, 0.12, 0.2); },
  kill: () => { noise(0.3, 0.4, 3000, 200, 0.7); tone('sine', 520, 80, 0.3, 0.25); tone('triangle', 900, 1500, 0.12, 0.1, 0.03); },
  block: () => { noise(0.08, 0.35, 3500, 1200, 2); tone('square', 320, 180, 0.1, 0.12); },
  parry: () => { [1320, 1980, 2640, 3170].forEach((f, i) => tone('sine', f, f * 0.995, 0.5 - i * 0.07, 0.14 - i * 0.02)); noise(0.06, 0.4, 6000, 3000, 1); },
  deflect: () => { tone('sine', 900, 1900, 0.16, 0.2); noise(0.07, 0.25, 5000, 2500, 2); },
  dash: () => { noise(0.22, 0.35, 1800, 300, 0.9); },
  hurt: () => { tone('sawtooth', 160, 55, 0.3, 0.28); noise(0.18, 0.4, 900, 200, 0.7, 'lowpass'); },
  tele: () => { tone('square', 660, 880, 0.14, 0.07); },
  bossTele: () => { tone('sawtooth', 110, 220, 0.5, 0.16); },
  shot: () => { tone('sine', 700, 240, 0.2, 0.14); noise(0.1, 0.12, 2000, 800, 3); },
  shard: () => { tone('sine', 1400 + Math.random() * 500, 2200, 0.09, 0.07); },
  burst: () => { noise(0.9, 0.7, 4000, 80, 0.5, 'lowpass'); tone('sine', 220, 30, 0.9, 0.5); tone('sawtooth', 880, 110, 0.5, 0.12); },
  ready: () => { tone('sine', 660, 660, 0.12, 0.12); tone('sine', 990, 990, 0.2, 0.12, 0.1); },
  spawn: () => { tone('sine', 90, 260, 0.5, 0.14); noise(0.5, 0.12, 300, 2400, 2); },
  wave: () => { [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, f, 0.34, 0.16, i * 0.09)); },
  boss: () => { [110, 104, 98, 82].forEach((f, i) => tone('sawtooth', f, f, 0.5, 0.2, i * 0.3)); },
  pick: () => { tone('triangle', 660, 660, 0.1, 0.14); tone('triangle', 990, 990, 0.18, 0.14, 0.08); },
  ui: () => { tone('sine', 880, 880, 0.05, 0.08); },
  buy: () => { [784, 988, 1175].forEach((f, i) => tone('sine', f, f, 0.16, 0.12, i * 0.06)); },
  deny: () => { tone('square', 160, 120, 0.14, 0.08); },
  dead: () => { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.98, 0.5, 0.18, i * 0.18)); },
  charge: () => { tone('sine', 300, 900, 0.3, 0.06); },
};
export function sfx(name, arg) { if (!ctx || muted || forcedMute) return; try { SFX[name] && SFX[name](arg); } catch (e) {} }

// --- music: 16-step sequencer in D minor, layers fade in with intensity ---
const ROOTS = [38, 38, 34, 36, 38, 38, 41, 36]; // one root per bar (MIDI)
const ARP = [0, 7, 12, 15, 12, 7, 19, 15];
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
function schedule() {
  if (!musicOn || !ctx) return;
  const spb = 60 / 112 / 4; // 16th note
  while (nextStep < ctx.currentTime + 0.25) {
    const when = Math.max(0, nextStep - ctx.currentTime), bar = Math.floor(step / 16) % ROOTS.length, s = step % 16, root = ROOTS[bar];
    if (s % 8 === 0) { // pad
      [0, 7, 15].forEach((iv) => { const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter(); o.type = 'sawtooth'; o.frequency.value = mtof(root + 12 + iv); f.type = 'lowpass'; f.frequency.value = 500 + intensity * 900; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.05, t + 0.5); g.gain.linearRampToValueAtTime(0.0001, t + spb * 8 + 0.4); o.connect(f); f.connect(g); g.connect(musicBus); o.start(t); o.stop(t + spb * 8 + 0.5); });
    }
    if (s % 4 === 0 || (intensity > 0.5 && s % 2 === 0)) tone('triangle', mtof(root), mtof(root), spb * 1.8, 0.22, when, musicBus);
    if (intensity > 0.15) tone('square', mtof(root + 24 + ARP[(s + bar) % ARP.length]), mtof(root + 24 + ARP[(s + bar) % ARP.length]), spb * 0.9, 0.035 + intensity * 0.03, when, musicBus);
    if (intensity > 0.3) { if (s % 4 === 0) tone('sine', 120, 40, 0.16, 0.5, when, musicBus); if (s % 2 === 1) noise(0.03, 0.07, 8000, 6000, 1, 'highpass', when, musicBus); }
    if (intensity > 0.6 && s % 8 === 4) noise(0.12, 0.2, 1800, 900, 0.8, 'bandpass', when, musicBus);
    nextStep += spb; step++;
  }
}
export function startMusic() { if (!ctx || musicOn) return; musicOn = true; nextStep = ctx.currentTime + 0.1; musicTimer = setInterval(schedule, 80); }
export function stopMusic() { musicOn = false; if (musicTimer) clearInterval(musicTimer); musicTimer = null; }
