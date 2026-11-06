/* Pod Breakers - procedural 3D models (hero, aliens, pods, generator, turrets, pickups) */
(function (PB) {
  'use strict';
  var W = PB.W, U = PB.U;
  var M = PB.Models = {};
  var G = {}; // shared geometries
  function geo() {
    if (G.sph) return;
    G.sph = new THREE.SphereGeometry(1, 20, 14);
    G.sphLo = new THREE.SphereGeometry(1, 10, 8);
    G.cyl = new THREE.CylinderGeometry(1, 1, 1, 10);
    G.cone = new THREE.ConeGeometry(1, 1, 10);
    G.box = new THREE.BoxGeometry(1, 1, 1);
    G.cap = new THREE.CapsuleGeometry(1, 1, 4, 10);
    G.ico = new THREE.IcosahedronGeometry(1, 0);
    G.oct = new THREE.OctahedronGeometry(1, 0);
    G.bell = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    G.torus = new THREE.TorusGeometry(1, 0.08, 8, 40);
    G.brain = new THREE.IcosahedronGeometry(1, 2);
    G.limb = new THREE.CylinderGeometry(1, 1, 1, 6); G.limb.translate(0, -0.5, 0); // pivot at top
  }
  function std(c, o) { return new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.55, metalness: 0.1 }, o || {})); }
  function basic(c) { return new THREE.MeshBasicMaterial({ color: c }); }
  function mesh(g, m, sx, sy, sz, x, y, z, parent) {
    var o = new THREE.Mesh(g, m); o.scale.set(sx, sy == null ? sx : sy, sz == null ? sx : sz); o.position.set(x || 0, y || 0, z || 0);
    o.castShadow = true; if (parent) parent.add(o); return o;
  }
  M.std = std;

  // ---------------- hero ----------------
  M.hero = function () {
    geo();
    var g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    var white = std(0xeef0f5, { roughness: 0.35, metalness: 0.25 }), orange = std(0xff8a24, { roughness: 0.4, metalness: 0.2 }), dark = std(0x2a2e3a, { roughness: 0.6, metalness: 0.4 });
    var cyan = new THREE.MeshStandardMaterial({ color: 0x0a2a33, emissive: 0x3ff0ff, emissiveIntensity: 2.2, roughness: 0.2 });
    var legs = [];
    for (var i = 0; i < 2; i++) {
      var hip = new THREE.Group(); hip.position.set(i ? 0.22 : -0.22, 0.95, 0); body.add(hip);
      mesh(G.limb, dark, 0.16, 0.5, 0.16, 0, 0, 0, hip);
      var shin = new THREE.Group(); shin.position.y = -0.48; hip.add(shin);
      mesh(G.limb, white, 0.19, 0.48, 0.19, 0, 0, 0, shin);
      mesh(G.box, orange, 0.26, 0.14, 0.36, 0, -0.48, 0.05, shin);
      legs.push(hip);
    }
    mesh(G.cap, white, 0.36, 0.28, 0.3, 0, 1.38, 0, body);
    mesh(G.box, orange, 0.52, 0.32, 0.12, 0, 1.45, 0.25, body);
    mesh(G.box, dark, 0.56, 0.12, 0.42, 0, 1.0, 0, body);
    mesh(G.sph, orange, 0.2, 0.17, 0.22, -0.43, 1.66, 0, body); mesh(G.sph, orange, 0.2, 0.17, 0.22, 0.43, 1.66, 0, body);
    mesh(G.box, dark, 0.48, 0.55, 0.26, 0, 1.45, -0.32, body);
    mesh(G.box, cyan, 0.08, 0.36, 0.04, -0.14, 1.45, -0.46, body); mesh(G.box, cyan, 0.08, 0.36, 0.04, 0.14, 1.45, -0.46, body);
    var head = new THREE.Group(); head.position.y = 1.98; body.add(head);
    mesh(G.sph, white, 0.3, 0.3, 0.32, 0, 0, 0, head);
    mesh(G.sph, cyan, 0.24, 0.12, 0.2, 0, 0.0, 0.17, head);
    // gun arm
    var gun = new THREE.Group(); gun.position.set(0.28, 1.42, 0.25); body.add(gun);
    mesh(G.box, dark, 0.16, 0.2, 0.95, 0, 0, 0.3, gun);
    mesh(G.box, white, 0.2, 0.12, 0.4, 0, 0.12, 0.15, gun);
    mesh(G.cyl, cyan, 0.07, 0.5, 0.07, 0, 0, 0.55, gun).rotation.x = Math.PI / 2;
    mesh(G.sph, dark, 0.12, 0.12, 0.12, -0.18, -0.05, 0.1, gun);
    var muzzle = new THREE.Object3D(); muzzle.position.set(0, 0, 0.85); gun.add(muzzle);
    var flash = W.glowSprite(0x3ff0ff, 1.4, 0); flash.position.copy(muzzle.position); gun.add(flash);
    var ringM = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.05, 40), new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
    ringM.rotation.x = -Math.PI / 2; ringM.position.y = 0.05; g.add(ringM);
    var light = new THREE.PointLight(0x3ff0ff, 0.8, 9); light.position.set(0, 2.2, 0.4); g.add(light);
    return { group: g, body: body, legs: legs, gun: gun, muzzle: muzzle, flash: flash, ring: ringM, mats: [white, orange] };
  };

  // ---------------- aliens ----------------
  function eye(parent, x, y, z, s, color) {
    mesh(G.sphLo, basic(color || 0xffffff), s, s, s, x, y, z, parent).castShadow = false;
  }
  M.alien = function (type, elite) {
    geo();
    var D = PB.ENEMIES[type], g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    var R = { group: g, body: body, legs: [], parts: [], mats: [], type: type };
    var main;
    if (type === 'skitter') {
      main = std(0x6a1fd0, { roughness: 0.25, metalness: 0.35 });
      mesh(G.sph, main, 0.5, 0.3, 0.7, 0, 0.55, -0.1, body);
      mesh(G.sph, main, 0.32, 0.26, 0.32, 0, 0.6, 0.55, body);
      mesh(G.cone, main, 0.12, 0.4, 0.12, 0, 0.9, -0.1, body);
      var eg = 0xb6ff3a; eye(body, -0.12, 0.72, 0.8, 0.08, eg); eye(body, 0.12, 0.72, 0.8, 0.08, eg); eye(body, -0.2, 0.62, 0.78, 0.06, eg); eye(body, 0.2, 0.62, 0.78, 0.06, eg);
      for (var i = 0; i < 6; i++) {
        var side = i < 3 ? -1 : 1, k = i % 3, hip = new THREE.Group(); hip.position.set(side * 0.35, 0.6, 0.35 - k * 0.38); body.add(hip);
        var leg = mesh(G.limb, main, 0.05, 0.75, 0.05, 0, 0, 0, hip); hip.rotation.z = side * 1.0; hip.userData.side = side; hip.userData.ph = k * 2.1 + (side > 0 ? 1 : 0);
        R.legs.push(hip);
      }
    } else if (type === 'gloop') {
      main = new THREE.MeshStandardMaterial({ color: 0x8cff20, emissive: 0x3a8a00, emissiveIntensity: 0.6, roughness: 0.1, transparent: true, opacity: 0.78 });
      var blob = mesh(G.sph, main, 0.95, 0.85, 0.95, 0, 0.85, 0, body); R.parts.push(blob);
      var core = W.glowSprite(0xc8ff60, 1.6, 0.8); core.position.y = 0.8; body.add(core);
      [[-0.32, 1.05, 0.62], [0.32, 1.05, 0.62], [0, 1.4, 0.55]].forEach(function (p) {
        eye(body, p[0], p[1], p[2], 0.2); mesh(G.sphLo, basic(0x111111), 0.09, 0.09, 0.09, p[0], p[1], p[2] + 0.16, body);
      });
    } else if (type === 'stalker') {
      main = std(0x1aa898, { roughness: 0.45 });
      var dark = std(0x0d5a52);
      for (var j = 0; j < 2; j++) {
        var lh = new THREE.Group(); lh.position.set(j ? 0.2 : -0.2, 1.4, 0); body.add(lh);
        mesh(G.limb, main, 0.15, 1.4, 0.15, 0, 0, 0, lh); R.legs.push(lh);
      }
      mesh(G.cap, main, 0.34, 0.6, 0.28, 0, 1.85, 0.05, body).rotation.x = 0.3;
      var hd = mesh(G.sph, dark, 0.3, 0.26, 0.6, 0, 2.5, 0.25, body); hd.rotation.x = -0.4;
      eye(body, 0, 2.55, 0.8, 0.16, 0xff8a1a);
      var glowE = W.glowSprite(0xff8a1a, 0.9, 0.9); glowE.position.set(0, 2.55, 0.86); body.add(glowE);
      for (var a = 0; a < 2; a++) {
        var sh = new THREE.Group(); sh.position.set(a ? 0.3 : -0.3, 2.1, 0.1); body.add(sh);
        mesh(G.limb, main, 0.1, 1.3, 0.1, 0, 0, 0, sh); sh.rotation.x = -0.3; sh.rotation.z = a ? -0.15 : 0.15; R.parts.push(sh);
      }
    } else if (type === 'wisp') {
      main = new THREE.MeshStandardMaterial({ color: 0x1a8cff, emissive: 0x0a6aff, emissiveIntensity: 1.6, roughness: 0.15, transparent: true, opacity: 0.88, side: THREE.DoubleSide });
      mesh(G.bell, main, 0.8, 0.7, 0.8, 0, 0, 0, body);
      var wc = W.glowSprite(0xbff8ff, 1.8, 0.95); wc.position.y = 0.2; body.add(wc);
      var tm = new THREE.MeshBasicMaterial({ color: 0x3ad0ff, transparent: true, opacity: 0.9 });
      for (var t = 0; t < 7; t++) {
        var ta = t / 7 * 6.28, tg = new THREE.Group(); tg.position.set(Math.cos(ta) * 0.5, 0, Math.sin(ta) * 0.5); body.add(tg);
        mesh(G.limb, tm, 0.06, 1.4, 0.06, 0, 0, 0, tg).castShadow = false; tg.userData.ph = t; R.legs.push(tg);
      }
    } else if (type === 'spitter') {
      main = std(0xff9a1a, { roughness: 0.5 });
      var sac = mesh(G.sph, main, 0.8, 0.75, 0.8, 0, 1.0, 0, body); R.parts.push(sac);
      var spot = std(0xffe040, { emissive: 0x8a6000, emissiveIntensity: 0.5 });
      for (var s = 0; s < 9; s++) { var sa = s * 2.4, sy = 0.7 + (s % 3) * 0.25; mesh(G.sphLo, spot, 0.13, 0.13, 0.08, Math.cos(sa) * 0.72, sy, Math.sin(sa) * 0.72, body); }
      var mouth = mesh(G.torus, basic(0x9dff2e), 0.38, 0.38, 0.6, 0, 1.35, 0.55, body); mouth.rotation.x = -0.6;
      var mg = W.glowSprite(0x9dff2e, 1.2, 0.9); mg.position.set(0, 1.4, 0.62); body.add(mg);
      for (var p = 0; p < 8; p++) { var pa = p / 8 * 6.28, pet = mesh(G.cone, std(0xff6a10), 0.14, 0.5, 0.14, Math.cos(pa) * 0.45 + 0, 1.6, Math.sin(pa) * 0.45 + 0.35, body); pet.rotation.set(Math.sin(pa) * 0.9 - 0.5, 0, -Math.cos(pa) * 0.9); }
      for (var q = 0; q < 4; q++) mesh(G.sph, std(0xd06a10), 0.22, 0.3, 0.22, (q % 2 ? 0.45 : -0.45), 0.25, (q < 2 ? 0.4 : -0.4), body);
    } else if (type === 'brute' || type === 'behemoth') {
      main = std(0xe0207a, { roughness: 0.3, metalness: 0.15 });
      var under = std(0x5a1a3a);
      mesh(G.sph, under, 1.0, 0.8, 1.35, 0, 1.25, 0, body);
      for (var pl = 0; pl < 4; pl++) { var pm = mesh(G.sph, main, 0.95 - pl * 0.08, 0.45, 0.5, 0, 1.75 - pl * 0.05, 0.75 - pl * 0.5, body); pm.rotation.x = 0.3; }
      mesh(G.sph, main, 0.6, 0.5, 0.55, 0, 1.15, 1.25, body);
      var horn = mesh(G.cone, std(0xffb0d0, { roughness: 0.3 }), 0.22, 1.1, 0.22, 0, 1.75, 1.6, body); horn.rotation.x = 0.7;
      eye(body, -0.3, 1.3, 1.68, 0.1, 0xffe030); eye(body, 0.3, 1.3, 1.68, 0.1, 0xffe030);
      for (var l = 0; l < 4; l++) { var bl = new THREE.Group(); bl.position.set(l % 2 ? 0.7 : -0.7, 1.0, l < 2 ? 0.7 : -0.7); body.add(bl); mesh(G.limb, under, 0.24, 1.0, 0.24, 0, 0, 0, bl); bl.userData.ph = l * 1.6; R.legs.push(bl); }
      if (type === 'behemoth') {
        for (var sp = 0; sp < 6; sp++) { var spk = mesh(G.cone, main, 0.18, 0.9, 0.18, (sp % 2 ? 0.4 : -0.4), 2.2, 0.5 - Math.floor(sp / 2) * 0.55, body); spk.rotation.z = sp % 2 ? -0.4 : 0.4; }
        var bg = W.glowSprite(0xff3fa4, 4, 0.5); bg.position.y = 1.5; body.add(bg);
      }
    } else if (type === 'overmind') {
      main = std(0x9a3aff, { roughness: 0.35, emissive: 0x3a0a6a, emissiveIntensity: 0.6, flatShading: true });
      mesh(G.brain, main, 1.3, 1.0, 1.2, 0, 0, 0, body);
      var plate = std(0x3a1a5a, { metalness: 0.5, roughness: 0.3 });
      mesh(G.sph, plate, 1.35, 0.4, 1.25, 0, -0.45, 0, body);
      var oc = W.glowSprite(0xff3fa4, 3.2, 0.95); oc.position.set(0, -0.2, 1.0); body.add(oc);
      eye(body, 0, -0.25, 1.15, 0.22, 0xff60c0);
      for (var tt = 0; tt < 6; tt++) {
        var tA = tt / 6 * 6.28, chain = new THREE.Group(); chain.position.set(Math.cos(tA) * 0.9, -0.5, Math.sin(tA) * 0.9); body.add(chain);
        var prev = chain;
        for (var seg = 0; seg < 5; seg++) { var sg = new THREE.Group(); sg.position.y = seg ? -0.45 : 0; prev.add(sg); mesh(G.sph, main, 0.28 - seg * 0.04, 0.3, 0.28 - seg * 0.04, 0, -0.2, 0, sg); prev = sg; sg.userData.ph = tt + seg * 0.6; R.legs.push(sg); }
      }
      for (var cr = 0; cr < 4; cr++) { var cry = mesh(G.oct, new THREE.MeshStandardMaterial({ color: 0xd090ff, emissive: 0xa040ff, emissiveIntensity: 1.5 }), 0.18, 0.32, 0.18, 0, 0, 0, g); cry.userData.ph = cr * 1.57; R.parts.push(cry); }
    }
    R.mats.push(main);
    var sc = (D.boss ? 1 : 1) * (type === 'behemoth' ? 2.0 : type === 'overmind' ? 2.3 : 1);
    if (elite) {
      sc *= 1.3;
      var halo = W.glowSprite(0xffd23f, 3.2, 0.55); halo.position.y = 0.4; g.add(halo); R.halo = halo;
      var crown = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.25, 30), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
      crown.rotation.x = -Math.PI / 2; crown.position.y = 0.06; g.add(crown);
    }
    body.scale.setScalar(sc);
    R.baseEmissive = main.emissive.clone(); R.baseEI = main.emissiveIntensity;
    return R;
  };

  M.animAlien = function (R, t, moving, extra) {
    var ty = R.type;
    if (ty === 'skitter') { R.legs.forEach(function (h) { h.rotation.x = Math.sin(t * 22 + h.userData.ph) * 0.6 * moving; }); R.body.position.y = Math.abs(Math.sin(t * 22)) * 0.06 * moving; }
    else if (ty === 'gloop') { var b = Math.abs(Math.sin(t * 7)); R.body.scale.y = R.body.scale.x * (0.85 + b * 0.25); R.body.position.y = b * 0.35 * moving; }
    else if (ty === 'stalker') { R.legs[0].rotation.x = Math.sin(t * 9) * 0.6 * moving; R.legs[1].rotation.x = -Math.sin(t * 9) * 0.6 * moving; R.parts[0].rotation.x = -0.3 + Math.sin(t * 9) * 0.4 * moving; R.parts[1].rotation.x = -0.3 - Math.sin(t * 9) * 0.4 * moving; R.body.rotation.x = extra ? -0.35 : 0; R.body.position.y = extra ? -0.4 : 0; }
    else if (ty === 'wisp') { R.legs.forEach(function (h) { h.rotation.x = Math.sin(t * 4 + h.userData.ph) * 0.35; h.rotation.z = Math.cos(t * 3.5 + h.userData.ph) * 0.3; }); R.body.position.y = Math.sin(t * 2.5) * 0.3; }
    else if (ty === 'spitter') { var p = 1 + Math.sin(t * 5) * 0.05 + (extra || 0) * 0.25; R.parts[0].scale.set(0.8 * p, 0.75 * p, 0.8 * p); }
    else if (ty === 'brute' || ty === 'behemoth') { R.legs.forEach(function (h) { h.rotation.x = Math.sin(t * (extra ? 18 : 8) + h.userData.ph) * 0.5 * moving; }); R.body.rotation.x = extra ? 0.15 : 0; }
    else if (ty === 'overmind') { R.legs.forEach(function (h) { h.rotation.x = Math.sin(t * 2.2 + h.userData.ph) * 0.35; h.rotation.z = Math.cos(t * 1.8 + h.userData.ph) * 0.25; }); R.body.position.y = Math.sin(t * 1.4) * 0.4; R.parts.forEach(function (c) { var a = t * 1.2 + c.userData.ph; c.position.set(Math.cos(a) * 4.2, 1.2 + Math.sin(t * 2 + c.userData.ph) * 0.5, Math.sin(a) * 4.2); c.rotation.y = t * 3; }); }
  };

  // ---------------- pod ----------------
  var crackTex = null;
  M.pod = function () {
    geo();
    if (!crackTex) crackTex = W.canvasTex(256, 256, function (g, w, h) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineCap = 'round';
      for (var i = 0; i < 18; i++) { g.lineWidth = 1 + Math.random() * 3; g.beginPath(); var x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (var k = 0; k < 6; k++) { x += U.rand(-30, 30); y += U.rand(-10, 40); g.lineTo(x, y); } g.stroke(); }
    });
    var g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    var mat = std(0x1a1222, { roughness: 0.35, metalness: 0.3, emissive: 0xff2a9a, emissiveMap: crackTex, emissiveIntensity: 1.6 });
    var egg = mesh(G.sph, mat, 1.0, 1.45, 1.0, 0, 1.1, 0, body);
    for (var r = 0; r < 6; r++) { var rib = mesh(G.sph, std(0x2a1a32, { roughness: 0.3, metalness: 0.4 }), 0.14, 1.3, 0.3, 0, 1.15, 0, body); rib.position.set(Math.cos(r * 1.047) * 0.88, 1.1, Math.sin(r * 1.047) * 0.88); rib.rotation.y = -r * 1.047; }
    var glow = W.glowSprite(0xff3fa4, 3.4, 0.5); glow.position.y = 1.2; body.add(glow);
    var timer = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 40, 1, 0, Math.PI * 2), new THREE.MeshBasicMaterial({ color: 0xff3fa4, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    timer.rotation.x = -Math.PI / 2; timer.position.y = 0.07; g.add(timer);
    var trail = W.glowSprite(0xff7ac8, 2.5, 0.9); trail.visible = false; g.add(trail);
    return { group: g, body: body, egg: egg, mat: mat, glow: glow, timer: timer, trail: trail, mats: [mat] };
  };

  // ---------------- generator ----------------
  M.generator = function () {
    geo();
    var g = new THREE.Group();
    var metal = std(0x5a6274, { metalness: 0.7, roughness: 0.35 }), dark = std(0x23262f, { metalness: 0.6, roughness: 0.4 });
    var cy = new THREE.MeshStandardMaterial({ color: 0x0a3040, emissive: 0x3ff0ff, emissiveIntensity: 1.6 });
    mesh(G.cyl, dark, 2.6, 0.5, 2.6, 0, 0.25, 0, g);
    mesh(G.cyl, metal, 2.0, 0.6, 2.0, 0, 0.8, 0, g);
    for (var i = 0; i < 4; i++) { var a = i * Math.PI / 2 + 0.785, pil = mesh(G.box, metal, 0.4, 3.4, 0.4, Math.cos(a) * 1.5, 2.2, Math.sin(a) * 1.5, g); pil.rotation.y = -a; mesh(G.box, cy, 0.1, 2.6, 0.42, Math.cos(a) * 1.72, 2.2, Math.sin(a) * 1.72, g).rotation.y = -a; }
    mesh(G.cyl, dark, 0.6, 3.6, 0.6, 0, 2.6, 0, g);
    var orb = mesh(G.sph, cy, 0.85, 0.85, 0.85, 0, 4.6, 0, g);
    var glow = W.glowSprite(0x3ff0ff, 4.5, 0.45); glow.position.y = 4.6; g.add(glow);
    var rings = [];
    for (var r = 0; r < 3; r++) { var rg = new THREE.Mesh(G.torus, new THREE.MeshBasicMaterial({ color: 0x3ff0ff })); rg.scale.setScalar(1.3 + r * 0.35); rg.position.y = 4.6; g.add(rg); rings.push(rg); }
    var dome = new THREE.Mesh(new THREE.SphereGeometry(3.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.08, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    g.add(dome);
    var light = new THREE.PointLight(0x3ff0ff, 2.2, 22); light.position.y = 5; g.add(light);
    return { group: g, orb: orb, rings: rings, dome: dome, glow: glow, light: light };
  };

  // ---------------- turret ----------------
  M.pad = function () {
    var g = new THREE.Group();
    var d = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 0.2, 24), std(0x3a3f4c, { metalness: 0.6, roughness: 0.4 })); d.position.y = 0.1; d.receiveShadow = true; g.add(d);
    var ring = new THREE.Mesh(new THREE.RingGeometry(1.05, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0x7aff1a, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.22; g.add(ring);
    var glow = W.glowSprite(0xa6ff3a, 4, 0.5); glow.position.y = 0.6; g.add(glow);
    var arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), new THREE.MeshBasicMaterial({ color: 0xa6ff3a })); arrow.rotation.x = Math.PI; arrow.position.y = 2.2; g.add(arrow);
    return { group: g, ring: ring, glow: glow, arrow: arrow };
  };
  M.turret = function (lvl) {
    geo();
    var g = new THREE.Group(), metal = std(0xdde2ea, { metalness: 0.5, roughness: 0.3 }), dark = std(0x2a2e3a, { metalness: 0.6 });
    var col = [0xff8a24, 0xff8a24, 0x3ff0ff, 0xff3fa4][lvl];
    var acc = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: col, emissiveIntensity: 2 });
    mesh(G.cyl, dark, 0.8, 0.5, 0.8, 0, 0.45, 0, g);
    var head = new THREE.Group(); head.position.y = 1.05; g.add(head);
    mesh(G.box, metal, 1.0, 0.55, 1.0, 0, 0, 0, head);
    mesh(G.box, acc, 1.02, 0.1, 0.6, 0, 0.12, 0, head);
    var bars = lvl >= 3 ? [-0.2, 0.2] : lvl === 2 ? [-0.14, 0.14] : [0];
    bars.forEach(function (x) { var b = mesh(G.cyl, dark, 0.09, 0.9, 0.09, x, 0, 0.75, head); b.rotation.x = Math.PI / 2; });
    var muz = new THREE.Object3D(); muz.position.set(0, 0, 1.2); head.add(muz);
    for (var s = 0; s < lvl; s++) mesh(G.sph, acc, 0.07, 0.07, 0.07, -0.3 + s * 0.15, 0.32, -0.3, head);
    return { group: g, head: head, muzzle: muz, color: col };
  };

  // ---------------- pickups & projectiles ----------------
  var pickMats = {};
  M.pickup = function (kind) {
    geo();
    if (!pickMats[kind]) pickMats[kind] = kind === 'xp' ? new THREE.MeshStandardMaterial({ color: 0x400a30, emissive: 0xff4ad0, emissiveIntensity: 2.2 }) :
      kind === 'core' ? new THREE.MeshStandardMaterial({ color: 0x1a4000, emissive: 0xa6ff3a, emissiveIntensity: 2.2 }) : new THREE.MeshStandardMaterial({ color: 0x401010, emissive: 0xff4a5a, emissiveIntensity: 2 });
    var g = new THREE.Group();
    var m = new THREE.Mesh(kind === 'xp' ? G.oct : kind === 'core' ? G.ico : G.sph, pickMats[kind]);
    m.scale.setScalar(kind === 'xp' ? 0.22 : kind === 'core' ? 0.3 : 0.32); g.add(m);
    return { group: g, m: m };
  };
  var boltGeo = null;
  M.bolt = function (color, size) {
    geo();
    if (!boltGeo) { boltGeo = new THREE.CapsuleGeometry(0.09, 0.9, 2, 6); boltGeo.rotateX(Math.PI / 2); }
    var g = new THREE.Group();
    var core = new THREE.Mesh(boltGeo, new THREE.MeshBasicMaterial({ color: 0xffffff })); core.scale.setScalar(size || 1); g.add(core);
    var gl = W.glowSprite(color, 1.3 * (size || 1), 0.9); g.add(gl);
    return { group: g, core: core, glow: gl };
  };
  M.orb = function (color, size) {
    geo();
    var g = new THREE.Group();
    var c = new THREE.Mesh(G.sphLo, new THREE.MeshBasicMaterial({ color: color })); c.scale.setScalar(0.25 * (size || 1)); g.add(c);
    var gl = W.glowSprite(color, 1.6 * (size || 1), 0.9); g.add(gl);
    return { group: g, core: c, glow: gl };
  };
})(window.PB);
