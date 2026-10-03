// Procedural WebAudio sound: no sample files, so the itch zip stays tiny.
export class Audio {
  constructor() { this.ctx = null; this.muted = false; this.master = null; this.droneOn = false; }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
    return true;
  }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.5; }
  env(node, t0, a, d, peak = 1) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
    node.connect(g); g.connect(this.master);
    return g;
  }
  noise(dur) {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const s = this.ctx.createBufferSource(); s.buffer = b; return s;
  }
  laser() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(1400, t); o.frequency.exponentialRampToValueAtTime(320, t + 0.12);
    this.env(o, t, 0.005, 0.12, 0.12); o.start(t); o.stop(t + 0.15);
  }
  explosion(big = false) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.noise(big ? 1.2 : 0.5);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(big ? 900 : 1800, t); f.frequency.exponentialRampToValueAtTime(60, t + (big ? 1.1 : 0.45));
    n.connect(f); this.env(f, t, 0.01, big ? 1.1 : 0.45, big ? 0.9 : 0.45); n.start(t);
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(big ? 90 : 160, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.5);
    this.env(o, t, 0.01, 0.5, big ? 0.8 : 0.35); o.start(t); o.stop(t + 0.6);
  }
  missile() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.noise(0.7);
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(2400, t + 0.6);
    n.connect(f); this.env(f, t, 0.05, 0.6, 0.35); n.start(t);
  }
  emp() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'square';
    o.frequency.setValueAtTime(80, t); o.frequency.exponentialRampToValueAtTime(2000, t + 0.5); o.frequency.exponentialRampToValueAtTime(40, t + 1.0);
    this.env(o, t, 0.02, 1.0, 0.3); o.start(t); o.stop(t + 1.1);
  }
  shield() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(330 * (i + 1), t + i * 0.08);
      this.env(o, t + i * 0.08, 0.02, 0.5, 0.18); o.start(t + i * 0.08); o.stop(t + i * 0.08 + 0.6);
    }
  }
  interceptors() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(880, t + 0.5);
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1200;
    o.connect(f); this.env(f, t, 0.05, 0.55, 0.22); o.start(t); o.stop(t + 0.7);
  }
  ping(freq = 880) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
    this.env(o, t, 0.01, 0.3, 0.2); o.start(t); o.stop(t + 0.35);
  }
  alarm() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = this.ctx.createOscillator(); o.type = 'square';
      o.frequency.setValueAtTime(620, t + i * 0.25); o.frequency.setValueAtTime(440, t + i * 0.25 + 0.12);
      this.env(o, t + i * 0.25, 0.01, 0.22, 0.12); o.start(t + i * 0.25); o.stop(t + i * 0.25 + 0.25);
    }
  }
  hit() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const n = this.noise(0.15);
    const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2000;
    n.connect(f); this.env(f, t, 0.005, 0.12, 0.15); n.start(t);
  }
  startDrone() {
    if (!this.ctx || this.droneOn) return;
    this.droneOn = true;
    const t = this.ctx.currentTime;
    const g = this.ctx.createGain(); g.gain.value = 0.0; g.connect(this.master);
    g.gain.linearRampToValueAtTime(0.07, t + 4);
    for (const [f, type] of [[55, 'sine'], [82.4, 'triangle'], [110.5, 'sine']]) {
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f;
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = this.ctx.createGain(); lg.gain.value = 1.5; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(g); o.start(t); lfo.start(t);
    }
    this.drone = g;
  }
}
