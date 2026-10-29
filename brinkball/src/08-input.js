// ---------------------------------------------------------------------------
// Input: keyboard (QWERTY + AZERTY), mouse, touch joysticks and gamepads.
// Dash is hold-to-charge, release-to-go on every device.
// ---------------------------------------------------------------------------
const KEYS = {
  solo: {
    up: ['KeyW', 'KeyZ', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'KeyQ', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    dash: ['Space', 'KeyJ'], ability: ['KeyE', 'ShiftLeft', 'ShiftRight', 'KeyK'],
  },
  p1: {
    up: ['KeyW', 'KeyZ'], down: ['KeyS'], left: ['KeyA', 'KeyQ'], right: ['KeyD'],
    dash: ['Space', 'KeyF'], ability: ['KeyE', 'KeyG', 'ShiftLeft'],
  },
  p2: {
    up: ['ArrowUp'], down: ['ArrowDown'], left: ['ArrowLeft'], right: ['ArrowRight'],
    dash: ['Enter', 'NumpadEnter', 'Period', 'Numpad0'], ability: ['ShiftRight', 'Slash', 'Comma', 'Numpad1'],
  },
};
const Input = {
  keys: new Set(), mouse: { x: 0, y: 0, on: false, mode: false, down: false }, touch: false,
  slots: [null, { held: false, rel: false, ab: false }, { held: false, rel: false, ab: false }],
  sticks: {}, // touch joysticks by pointerId: {slot, ox, oy, x, y}
  stickVec: [null, [0, 0], [0, 0]], pads: [], padPrev: [{}, {}, {}, {}],
  init(canvas) {
    const isGameKey = c => /^(Arrow|Space)/.test(c);
    addEventListener('keydown', e => {
      if (isGameKey(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(e.code);
      AU.init();
      if (e.code === 'KeyP' || e.code === 'Escape') { UI.togglePause(); return; }
      if (e.code === 'KeyM') { UI.toggleMute(); return; }
      if (UI.onKey(e)) return;
      this.mouse.mode = false;
      this.keyEvent(e.code, true);
    }, { passive: false });
    addEventListener('keyup', e => { this.keys.delete(e.code); this.keyEvent(e.code, false); });
    addEventListener('blur', () => { this.keys.clear(); for (let s = 1; s <= 2; s++) this.slots[s].held = false; });
    addEventListener('wheel', e => e.preventDefault(), { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => this.pdown(e));
    addEventListener('pointermove', e => this.pmove(e));
    addEventListener('pointerup', e => this.pup(e));
    addEventListener('pointercancel', e => this.pup(e));
    addEventListener('touchstart', () => this.setTouch(true), { passive: true });
    // iOS: audio must be resumed from inside a touchend or click.
    addEventListener('touchend', () => AU.init(), { passive: true });
    addEventListener('click', () => AU.init());
    addEventListener('gamepadconnected', () => UI.toast('🎮 Controller connected'));
    // Touch buttons (DASH / ABILITY), one set per player.
    document.querySelectorAll('.tbtn').forEach(b => {
      const slot = +b.dataset.slot, kind = b.dataset.k;
      b.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation(); AU.init();
        if (kind === 'dash') this.slots[slot].held = true; else this.slots[slot].ab = true;
        b.classList.add('down');
      });
      const up = e => { e.preventDefault(); if (kind === 'dash' && this.slots[slot].held) { this.slots[slot].held = false; this.slots[slot].rel = true; } b.classList.remove('down'); };
      b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
    });
    // Tablets get touch controls even with a big screen.
    if (matchMedia('(pointer: coarse)').matches) this.setTouch(true);
  },
  setTouch(on) { if (this.touch === on) return; this.touch = on; document.body.classList.toggle('touch', on); },
  bindsFor(slot) { return G.mode === 'party' ? (slot === 1 ? KEYS.p1 : KEYS.p2) : KEYS.solo; },
  keyEvent(code, down) {
    for (let s = 1; s <= 2; s++) {
      const b = this.bindsFor(s);
      if (b.dash.includes(code)) {
        if (down) this.slots[s].held = true;
        else if (this.slots[s].held) { this.slots[s].held = false; this.slots[s].rel = true; }
      }
      if (down && b.ability.includes(code)) this.slots[s].ab = true;
      if (G.mode !== 'party') break;
    }
  },
  pdown(e) {
    AU.init();
    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      this.setTouch(true);
      let slot = 1;
      if (G.mode === 'party') slot = e.clientX < innerWidth / 2 ? 1 : 2;
      else if (e.clientX > innerWidth * 0.5) { // right side in solo: tap to dash
        this.slots[1].held = true; this.sticks[e.pointerId] = { tap: true }; return;
      }
      this.sticks[e.pointerId] = { slot, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
      UI.stick(slot, e.clientX, e.clientY, 0, 0, true);
      return;
    }
    // mouse
    this.setTouch(false);
    this.mouse.mode = true; this.mouse.on = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY;
    if (G.mode === 'party') { // in Party the mouse is not a player; clicks do nothing in play
      return;
    }
    if (e.button === 0) { this.mouse.down = true; this.slots[1].held = true; }
    if (e.button === 2) this.slots[1].ab = true;
  },
  pmove(e) {
    const st = this.sticks[e.pointerId];
    if (st && !st.tap) {
      st.x = e.clientX; st.y = e.clientY;
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), R = 56;
      if (d > R) { st.ox = st.x - dx / d * R; st.oy = st.y - dy / d * R; } // the base follows the thumb
      UI.stick(st.slot, st.ox, st.oy, st.x - st.ox, st.y - st.oy, true);
      return;
    }
    if (e.pointerType === 'mouse') {
      if (Math.abs(e.clientX - this.mouse.x) + Math.abs(e.clientY - this.mouse.y) > 2) this.mouse.mode = true;
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mouse.on = true;
    }
  },
  pup(e) {
    const st = this.sticks[e.pointerId];
    if (st) {
      if (st.tap) { if (this.slots[1].held) { this.slots[1].held = false; this.slots[1].rel = true; } }
      else UI.stick(st.slot, 0, 0, 0, 0, false);
      delete this.sticks[e.pointerId];
      return;
    }
    if (e.pointerType === 'mouse' && e.button === 0 && this.mouse.down) {
      this.mouse.down = false;
      if (this.slots[1].held) { this.slots[1].held = false; this.slots[1].rel = true; }
    }
  },
  pollPads() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    this.pads = [];
    for (const p of list || []) if (p && p.connected) this.pads.push(p);
    this.pads.forEach((p, i) => {
      const slot = G.mode === 'party' ? (i === 0 ? 1 : 2) : 1;
      if (G.mode === 'party' && i > 1) return;
      const prev = this.padPrev[i], b = k => !!(p.buttons[k] && p.buttons[k].pressed);
      const A = b(0) || b(7), X = b(2) || b(1) || b(5), start = b(9);
      if (A && !prev.A) this.slots[slot].held = true;
      if (!A && prev.A && this.slots[slot].held) { this.slots[slot].held = false; this.slots[slot].rel = true; }
      if (X && !prev.X) this.slots[slot].ab = true;
      if (start && !prev.start) UI.togglePause();
      if ((A && !prev.A) && UI.padConfirm()) this.slots[slot].held = false;
      this.padPrev[i] = { A, X, start };
    });
  },
  padVec(slot) {
    let best = null;
    this.pads.forEach((p, i) => {
      const s = G.mode === 'party' ? (i === 0 ? 1 : 2) : 1;
      if (s !== slot) return;
      let x = p.axes[0] || 0, y = p.axes[1] || 0;
      const b = k => !!(p.buttons[k] && p.buttons[k].pressed);
      if (b(14)) x = -1; if (b(15)) x = 1; if (b(12)) y = -1; if (b(13)) y = 1;
      if (Math.hypot(x, y) > 0.22) best = [x, y];
    });
    return best;
  },
  // Copy the current input onto the human orbs (called every fixed step).
  apply(Gm) {
    for (const o of Gm.players) {
      const s = o.slot, S = this.slots[s];
      let mx = 0, my = 0;
      const b = this.bindsFor(s), k = this.keys, has = l => l.some(c => k.has(c));
      if (has(b.left)) mx -= 1; if (has(b.right)) mx += 1; if (has(b.up)) my -= 1; if (has(b.down)) my += 1;
      const pv = this.padVec(s);
      if (pv) { mx = pv[0]; my = pv[1]; }
      for (const id in this.sticks) {
        const st = this.sticks[id];
        if (st.tap || st.slot !== s) continue;
        const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy);
        if (d > 6) { mx = dx / 56; my = dy / 56; }
      }
      if (s === 1 && Gm.mode !== 'party' && this.mouse.mode && this.mouse.on && !mx && !my && o.canAct()) {
        const [wx, wy] = R.toWorld(this.mouse.x, this.mouse.y);
        const dx = wx - o.x, dy = wy - o.y, d = Math.hypot(dx, dy);
        if (d > 8) { const f = clamp((d - 8) / 70, 0, 1); mx = dx / d * f; my = dy / d * f; }
      }
      o.inMove = [mx, my];
      o.dashHeld = S.held;
      if (S.rel) { S.rel = false; o.wantDash = true; }
      if (S.ab) { S.ab = false; o.wantAbility = true; }
    }
  },
  rumble(p) {
    try {
      for (const pad of this.pads) if (pad.vibrationActuator) pad.vibrationActuator.playEffect('dual-rumble', { duration: 60 + p * 120, strongMagnitude: p, weakMagnitude: p * 0.6 }).catch(() => {});
      if (this.touch && navigator.vibrate && !Save.d.muted) navigator.vibrate(Math.round(10 + p * 25));
    } catch (e) { /* optional */ }
  },
};
