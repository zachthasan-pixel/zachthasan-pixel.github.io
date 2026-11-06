/* Pod Breakers - world: renderer, zones, props, particles, fx */
(function (PB) {
  'use strict';
  var U = PB.U;
  var W = PB.W = { colliders: [], shake: 0, quality: 2, arenaR: 38 };
  var glowTex, splatTex, ringGeo, discGeo;

  function canvasTex(w, h, draw) {
    var c = document.createElement('canvas'); c.width = w; c.height = h; var g = c.getContext('2d'); draw(g, w, h);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  W.canvasTex = canvasTex;

  W.init = function (canvas) {
    var r = W.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: 'high-performance' });
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    W.scene = new THREE.Scene();
    W.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 600);
    W.hemi = new THREE.HemisphereLight(0x8a7aff, 0x302018, 0.9); W.scene.add(W.hemi);
    W.sun = new THREE.DirectionalLight(0xffc090, 2.2);
    W.sun.castShadow = true; W.sun.shadow.mapSize.set(2048, 2048);
    var sc = W.sun.shadow.camera; sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 140;
    W.sun.shadow.bias = -0.0006; W.sun.shadow.normalBias = 0.03;
    W.scene.add(W.sun); W.scene.add(W.sun.target);
    glowTex = canvasTex(64, 64, function (g, w) { var gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    glowTex.encoding = THREE.LinearEncoding;
    W.glowTex = glowTex;
    splatTex = canvasTex(128, 128, function (g) {
      g.fillStyle = '#fff';
      for (var i = 0; i < 14; i++) { var a = Math.random() * 6.28, d = Math.random() * 38; g.globalAlpha = 0.5 + Math.random() * 0.5; g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 6 + Math.random() * 18, 0, 6.28); g.fill(); }
      g.globalAlpha = 1; g.beginPath(); g.arc(64, 64, 26, 0, 6.28); g.fill();
    });
    splatTex.encoding = THREE.LinearEncoding;
    ringGeo = new THREE.RingGeometry(0.85, 1, 48); ringGeo.rotateX(-Math.PI / 2);
    discGeo = new THREE.CircleGeometry(1, 32); discGeo.rotateX(-Math.PI / 2);
    W.particles = makeParticles(2600, THREE.AdditiveBlending);
    W.smoke = makeParticles(700, THREE.NormalBlending);
    W.scene.add(W.particles.points); W.scene.add(W.smoke.points);
    W.zoneGroup = new THREE.Group(); W.scene.add(W.zoneGroup);
    initFx();
    W.resize();
    window.addEventListener('resize', W.resize);
  };

  W.setQuality = function (q) {
    W.quality = q;
    var dpr = window.devicePixelRatio || 1;
    W.renderer.setPixelRatio(q === 2 ? Math.min(dpr, 2) : q === 1 ? Math.min(dpr, 1.25) : 0.85);
    W.renderer.shadowMap.enabled = q > 0;
    W.sun.castShadow = q > 0;
    if (q === 1) W.sun.shadow.mapSize.set(1024, 1024);
    if (W.sun.shadow.map) { W.sun.shadow.map.dispose(); W.sun.shadow.map = null; }
    W.scene.traverse(function (o) { if (o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
    W.resize();
  };

  W.resize = function () {
    var w = window.innerWidth, h = window.innerHeight;
    W.renderer.setSize(w, h, false);
    W.camera.aspect = w / h;
    W.camera.fov = w / h < 1 ? 62 : 50;
    W.camera.updateProjectionMatrix();
    W.camH = w / h < 1 ? 23 : 15.5; W.camZ = w / h < 1 ? 10 : 10.5;
    if (W.particles) {
      var s = W.renderer.domElement.height / (2 * Math.tan(W.camera.fov * Math.PI / 360));
      W.particles.mat.uniforms.uScale.value = s; W.smoke.mat.uniforms.uScale.value = s;
    }
  };

  // ---------- particles ----------
  function makeParticles(max, blending) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(max * 3), col = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alpha, 1));
    var mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 800 } },
      vertexShader: 'attribute float size;attribute float alpha;attribute vec3 color;varying vec3 vC;varying float vA;uniform float uScale;void main(){vC=color;vA=alpha;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=max(1.0,size*uScale/-mv.z);gl_Position=projectionMatrix*mv;}',
      fragmentShader: blending === THREE.AdditiveBlending ?
        'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;float a=pow(1.0-d*2.0,1.6);gl_FragColor=vec4(vC*(0.6+a*1.4),vA*a);}' :
        'varying vec3 vC;varying float vA;void main(){float d=length(gl_PointCoord-0.5);if(d>0.5)discard;float a=smoothstep(0.5,0.15,d);gl_FragColor=vec4(vC,vA*a);}',
      transparent: true, depthWrite: false, blending: blending
    });
    var pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    var P = { points: pts, mat: mat, max: max, n: 0, pos: pos, col: col, size: size, alpha: alpha,
      v: new Float32Array(max * 3), life: new Float32Array(max), maxl: new Float32Array(max), s0: new Float32Array(max), grav: new Float32Array(max), grow: new Float32Array(max), a0: new Float32Array(max), cursor: 0 };
    for (var i = 0; i < max; i++) alpha[i] = 0;
    P.spawn = function (x, y, z, vx, vy, vz, life, sz, r, g, b, grav, grow, a0) {
      var i = P.cursor; P.cursor = (P.cursor + 1) % max;
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      P.v[i * 3] = vx; P.v[i * 3 + 1] = vy; P.v[i * 3 + 2] = vz;
      col[i * 3] = r; col[i * 3 + 1] = g; col[i * 3 + 2] = b;
      P.life[i] = life; P.maxl[i] = life; P.s0[i] = sz; size[i] = sz; P.grav[i] = grav || 0; P.grow[i] = grow || 0; P.a0[i] = a0 == null ? 1 : a0; alpha[i] = P.a0[i];
    };
    P.update = function (dt) {
      for (var i = 0; i < max; i++) {
        if (P.life[i] <= 0) continue;
        P.life[i] -= dt;
        if (P.life[i] <= 0) { alpha[i] = 0; continue; }
        var k = i * 3;
        P.v[k + 1] -= P.grav[i] * dt;
        var drag = 1 - 1.8 * dt; P.v[k] *= drag; P.v[k + 2] *= drag;
        pos[k] += P.v[k] * dt; pos[k + 1] += P.v[k + 1] * dt; pos[k + 2] += P.v[k + 2] * dt;
        if (pos[k + 1] < 0.05) { pos[k + 1] = 0.05; P.v[k + 1] *= -0.3; }
        var t = P.life[i] / P.maxl[i];
        alpha[i] = P.a0[i] * Math.min(1, t * 2.2);
        size[i] = P.s0[i] * (1 + P.grow[i] * (1 - t));
      }
      var g = P.points.geometry;
      g.attributes.position.needsUpdate = true; g.attributes.alpha.needsUpdate = true; g.attributes.size.needsUpdate = true; g.attributes.color.needsUpdate = true;
    };
    P.clear = function () { for (var i = 0; i < max; i++) { P.life[i] = 0; alpha[i] = 0; } };
    return P;
  }

  var tmpC = new THREE.Color();
  W.burst = function (x, y, z, color, n, speed, life, size, grav) {
    tmpC.set(color);
    var q = W.quality === 0 ? 0.5 : 1; n = Math.max(1, Math.round(n * q));
    for (var i = 0; i < n; i++) {
      var a = Math.random() * 6.283, e = Math.random() * 1.2 - 0.2, s = speed * (0.35 + Math.random() * 0.75);
      W.particles.spawn(x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + speed * 0.3, Math.sin(a) * Math.cos(e) * s,
        life * (0.6 + Math.random() * 0.6), size * (0.6 + Math.random() * 0.8), tmpC.r, tmpC.g, tmpC.b, grav == null ? 14 : grav, 0);
    }
  };
  W.smokePuff = function (x, y, z, n, color, size) {
    tmpC.set(color || 0x333040);
    for (var i = 0; i < n; i++) {
      W.smoke.spawn(x + U.rand(-0.6, 0.6), y + U.rand(0, 0.6), z + U.rand(-0.6, 0.6), U.rand(-1.5, 1.5), U.rand(1, 3), U.rand(-1.5, 1.5), U.rand(0.8, 1.6), (size || 1.4) * U.rand(0.7, 1.3), tmpC.r, tmpC.g, tmpC.b, -0.5, 1.8, 0.55);
    }
  };

  // ---------- fx pools: rings, decals, lightning, glows ----------
  var rings = [], decals = [], bolts = [];
  function initFx() {
    for (var i = 0; i < 24; i++) {
      var m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.visible = false; m.renderOrder = 3; W.scene.add(m); rings.push({ m: m, t: 0, life: 0, r0: 0, r1: 0 });
    }
    for (var j = 0; j < 70; j++) {
      var d = new THREE.Mesh(discGeo, new THREE.MeshBasicMaterial({ map: splatTex, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0.8 }));
      d.visible = false; d.renderOrder = 1; d.position.y = 0.03; W.scene.add(d); decals.push({ m: d, t: 0, life: 0 });
    }
    for (var k = 0; k < 16; k++) {
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(10 * 3), 3));
      var l = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xd090ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      l.visible = false; l.frustumCulled = false; W.scene.add(l); bolts.push({ l: l, t: 0 });
    }
  }
  var ri = 0, di = 0, bi = 0;
  W.ring = function (x, z, r0, r1, life, color, y) {
    var R = rings[ri]; ri = (ri + 1) % rings.length;
    R.m.visible = true; R.m.position.set(x, y || 0.12, z); R.t = 0; R.life = life; R.r0 = r0; R.r1 = r1; R.m.material.color.set(color);
  };
  W.decal = function (x, z, size, color, op) {
    var D = decals[di]; di = (di + 1) % decals.length;
    D.m.visible = true; D.m.position.set(x, 0.02 + di * 0.0004, z); D.m.scale.setScalar(size); D.m.rotation.y = Math.random() * 6.28;
    D.m.material.color.set(color); D.m.material.opacity = op || 0.75; D.op = op || 0.75; D.t = 0; D.life = 14;
  };
  W.lightning = function (x1, y1, z1, x2, y2, z2, color) {
    var B = bolts[bi]; bi = (bi + 1) % bolts.length;
    var a = B.l.geometry.attributes.position.array;
    for (var i = 0; i < 10; i++) {
      var t = i / 9, j = (i === 0 || i === 9) ? 0 : 0.7;
      a[i * 3] = U.lerp(x1, x2, t) + U.rand(-j, j); a[i * 3 + 1] = U.lerp(y1, y2, t) + U.rand(-j, j) * 0.6; a[i * 3 + 2] = U.lerp(z1, z2, t) + U.rand(-j, j);
    }
    B.l.geometry.attributes.position.needsUpdate = true; B.l.material.color.set(color || 0xd090ff); B.l.visible = true; B.t = 0.09;
  };
  W.glowSprite = function (color, scale, opacity) {
    var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: opacity == null ? 0.9 : opacity }));
    s.scale.setScalar(scale); return s;
  };
  W.clearFx = function () {
    rings.forEach(function (R) { R.m.visible = false; }); decals.forEach(function (D) { D.m.visible = false; }); bolts.forEach(function (B) { B.l.visible = false; });
    W.particles.clear(); W.smoke.clear();
  };
  W.updateFx = function (dt) {
    W.particles.update(dt); W.smoke.update(dt);
    for (var i = 0; i < rings.length; i++) {
      var R = rings[i]; if (!R.m.visible) continue; R.t += dt; var k = R.t / R.life;
      if (k >= 1) { R.m.visible = false; continue; }
      var r = U.lerp(R.r0, R.r1, 1 - Math.pow(1 - k, 2)); R.m.scale.set(r, 1, r); R.m.material.opacity = 1 - k;
    }
    for (var j = 0; j < decals.length; j++) {
      var D = decals[j]; if (!D.m.visible) continue; D.t += dt;
      if (D.t > D.life) { D.m.visible = false; continue; }
      if (D.t > D.life - 3) D.m.material.opacity = D.op * (D.life - D.t) / 3;
    }
    for (var b = 0; b < bolts.length; b++) { var B = bolts[b]; if (!B.l.visible) continue; B.t -= dt; if (B.t <= 0) B.l.visible = false; else B.l.material.opacity = Math.min(1, B.t / 0.05); }
  };

  // ---------- zone building ----------
  function std(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.8, metalness: 0.05 }, opts || {})); }
  W.std = std;
  function noiseGround(base, base2, kind) {
    return canvasTex(512, 512, function (g, w, h) {
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      for (var i = 0; i < 180; i++) {
        g.globalAlpha = 0.05 + Math.random() * 0.08; g.fillStyle = Math.random() < 0.7 ? base2 : 'rgba(0,0,0,1)';
        var bx = Math.random() * w, by = Math.random() * h, br = 10 + Math.random() * 50;
        var gr = g.createRadialGradient(bx, by, 0, bx, by, br); gr.addColorStop(0, g.fillStyle); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.beginPath(); g.arc(bx, by, br, 0, 6.28); g.fill();
      }
      if (kind === 'city') { // grass blades
        g.globalAlpha = 0.5;
        for (var gb = 0; gb < 1600; gb++) { var gx = Math.random() * w, gy = Math.random() * h; g.strokeStyle = Math.random() < 0.5 ? '#5d7f48' : '#2a3f26'; g.lineWidth = 1; g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx + U.rand(-2, 2), gy - U.rand(3, 7)); g.stroke(); }
      }
      g.globalAlpha = 1;
      for (var j = 0; j < 2500; j++) {
        g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.08)';
        var s = 1 + Math.random() * 2.5; g.fillRect(Math.random() * w, Math.random() * h, s, s);
      }
      if (kind === 'magma') {
        g.strokeStyle = '#ff6a1a'; g.lineWidth = 2; g.globalAlpha = 0.6;
        for (var k = 0; k < 14; k++) { g.beginPath(); var x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (var s2 = 0; s2 < 6; s2++) { x += U.rand(-40, 40); y += U.rand(-40, 40); g.lineTo(x, y); } g.stroke(); }
      }
      if (kind === 'frost') {
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1;
        for (var f = 0; f < 30; f++) { g.beginPath(); var fx = Math.random() * w, fy = Math.random() * h; g.moveTo(fx, fy); g.lineTo(fx + U.rand(-60, 60), fy + U.rand(-60, 60)); g.stroke(); }
      }
    });
  }
  function plazaTex(kind) {
    return canvasTex(512, 512, function (g, w, h) {
      var base = { city: '#4c4a55', desert: '#7a6650', frost: '#6f8496', magma: '#2c282c' }[kind];
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      var n = 8, s = w / n;
      for (var y = 0; y < n; y++) for (var x = 0; x < n; x++) {
        var l = Math.random() * 0.12 - 0.06; g.fillStyle = l > 0 ? 'rgba(255,255,255,' + l + ')' : 'rgba(0,0,0,' + (-l) + ')';
        g.fillRect(x * s + 2, y * s + 2, s - 4, s - 4);
      }
      g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3;
      for (var i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
      for (var c = 0; c < 12; c++) { g.strokeStyle = 'rgba(0,0,0,.4)'; g.lineWidth = 1.5; g.beginPath(); var cx = Math.random() * w, cy = Math.random() * h; g.moveTo(cx, cy); for (var k = 0; k < 4; k++) { cx += U.rand(-30, 30); cy += U.rand(-30, 30); g.lineTo(cx, cy); } g.stroke(); }
    });
  }
  function windowTex() {
    return canvasTex(128, 256, function (g, w, h) {
      g.fillStyle = '#222033'; g.fillRect(0, 0, w, h);
      for (var y = 8; y < h - 8; y += 18) for (var x = 8; x < w - 8; x += 20) {
        var on = Math.random(); g.fillStyle = on < 0.3 ? '#ffcf7a' : on < 0.38 ? '#7ae0ff' : '#14121e'; g.fillRect(x, y, 12, 10);
      }
    });
  }

  W.setZone = function (zi, mod) {
    var Z = PB.ZONES[zi], night = mod === 'night';
    while (W.zoneGroup.children.length) {
      var o = W.zoneGroup.children.pop();
      o.traverse(function (c) {
        if (c.geometry) c.geometry.dispose();
        if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach(function (m) { if (m.map && m.map.dispose) m.map.dispose(); m.dispose(); });
      });
    }
    W.colliders = [];
    var G = W.zoneGroup;
    // sky dome
    var skyMat = new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(Z.sky[0]).multiplyScalar(night ? 0.3 : 1) }, mid: { value: new THREE.Color(Z.sky[1]).multiplyScalar(night ? 0.25 : 1) }, low: { value: new THREE.Color(Z.sky[2]).multiplyScalar(night ? 0.2 : 1) } },
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: 'uniform vec3 top;uniform vec3 mid;uniform vec3 low;varying vec3 vP;float h(vec3 p){return fract(sin(dot(p,vec3(12.9898,78.233,45.164)))*43758.5453);}void main(){float y=vP.y;vec3 c=mix(low,mid,smoothstep(-0.05,0.18,y));c=mix(c,top,smoothstep(0.18,0.75,y));vec3 q=floor(vP*260.0);float s=step(0.996,h(q))*smoothstep(0.25,0.8,y);c+=vec3(s);gl_FragColor=vec4(c,1.0);}',
      side: THREE.BackSide, depthWrite: false, fog: false
    });
    var sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), skyMat); sky.renderOrder = -10; G.add(sky);
    W.scene.fog = new THREE.Fog(new THREE.Color(Z.fog).multiplyScalar(night ? 0.3 : 1), 55, 190);
    W.hemi.color.set(Z.amb); W.hemi.groundColor.set(0x2a2018); W.hemi.intensity = night ? 0.4 : 0.62;
    W.sun.color.set(Z.sun); W.sun.intensity = night ? 0.7 : 1.9;
    W.renderer.toneMappingExposure = night ? 1.15 : 0.95;
    // mothership silhouette
    var ms = new THREE.Group();
    var hull = new THREE.Mesh(new THREE.CylinderGeometry(55, 70, 8, 40, 1), std(0x15111f, { roughness: 0.5, metalness: 0.6, fog: false }));
    ms.add(hull);
    var dome = new THREE.Mesh(new THREE.SphereGeometry(28, 24, 12, 0, 6.28, 0, 1.4), std(0x1c1730, { fog: false })); dome.position.y = 3; ms.add(dome);
    var lightRing = new THREE.Mesh(new THREE.TorusGeometry(66, 1.2, 8, 60), new THREE.MeshBasicMaterial({ color: 0xff3fa4, fog: false })); lightRing.rotation.x = Math.PI / 2; lightRing.position.y = -3; ms.add(lightRing);
    var core = W.glowSprite(0xff3fa4, 60, 0.6); core.material.fog = false; core.position.y = -8; ms.add(core);
    ms.position.set(-60, 95, -230); ms.rotation.z = 0.08; G.add(ms); W.mothership = ms;
    // ground
    var gt = noiseGround(Z.ground, Z.ground2, Z.prop); gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(14, 14); gt.anisotropy = 4;
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), std(0xffffff, { map: gt, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; G.add(ground);
    var pt = plazaTex(Z.prop); pt.wrapS = pt.wrapT = THREE.RepeatWrapping; pt.repeat.set(3, 3);
    var plaza = new THREE.Mesh(new THREE.CircleGeometry(13, 48), std(0xffffff, { map: pt, roughness: 0.9 }));
    plaza.rotation.x = -Math.PI / 2; plaza.position.y = 0.01; plaza.receiveShadow = true; G.add(plaza);
    // arena boundary lights
    var postGeo = new THREE.CylinderGeometry(0.18, 0.25, 1.4, 6), postMat = std(0x30323e, { metalness: 0.5 }), capMat = new THREE.MeshBasicMaterial({ color: 0x3ff0ff });
    for (var i = 0; i < 40; i++) {
      var a = i / 40 * Math.PI * 2, p = new THREE.Mesh(postGeo, postMat); p.position.set(Math.cos(a) * 40, 0.7, Math.sin(a) * 40); G.add(p);
      var cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), capMat); cap.position.set(p.position.x, 1.5, p.position.z); G.add(cap);
    }
    var edge = new THREE.Mesh(new THREE.RingGeometry(39.7, 40.2, 96), new THREE.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
    edge.rotation.x = -Math.PI / 2; edge.position.y = 0.04; G.add(edge);
    buildProps(Z.prop, night);
    // turret pads
    W.padPositions = [[7, 7], [-7, 7], [7, -7], [-7, -7]];
  };

  function addCollider(x, z, r) { W.colliders.push({ x: x, z: z, r: r }); }
  function buildProps(kind, night) {
    var G = W.zoneGroup, rng = U.seeded(kind.length * 77 + 3);
    function R(a, b) { return a + rng() * (b - a); }
    var winTex = kind === 'city' ? windowTex() : null;
    // outer ring scenery (outside arena, no colliders)
    for (var i = 0; i < 46; i++) {
      var a = i / 46 * Math.PI * 2 + R(-0.05, 0.05), d = R(48, 78), x = Math.cos(a) * d, z = Math.sin(a) * d, m;
      if (kind === 'city') {
        var h = R(8, 30), w = R(6, 12);
        var t = winTex.clone(); t.needsUpdate = true; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.round(w / 5), Math.round(h / 9));
        m = new THREE.Mesh(new THREE.BoxGeometry(w, h, R(6, 12)), [std(0x3a3848), std(0x3a3848), std(0x2a2836), std(0x2a2836), std(0xffffff, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: night ? 1.4 : 0.7 }), std(0xffffff, { map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: night ? 1.4 : 0.7 })]);
        m.position.set(x, h / 2, z); m.lookAt(0, h / 2, 0);
        if (rng() < 0.35) { m.rotation.z = R(-0.08, 0.08); }
      } else if (kind === 'desert') {
        var hh = R(6, 22);
        m = new THREE.Mesh(new THREE.CylinderGeometry(R(5, 9), R(9, 14), hh, 7), std(0xa86a3e, { flatShading: true }));
        m.position.set(x, hh / 2 - 0.5, z); m.rotation.y = R(0, 6);
      } else if (kind === 'frost') {
        var ch = R(6, 20);
        m = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), std(0x9fe8ff, { emissive: 0x2a8acc, emissiveIntensity: night ? 0.9 : 0.35, roughness: 0.2, metalness: 0.1, transparent: true, opacity: 0.9, flatShading: true }));
        m.scale.set(R(2, 4), ch, R(2, 4)); m.position.set(x, ch * 0.6, z); m.rotation.set(R(-0.2, 0.2), R(0, 6), R(-0.2, 0.2));
      } else {
        var sh = R(6, 24);
        m = new THREE.Mesh(new THREE.ConeGeometry(R(3, 6), sh, 6), std(0x1a1214, { flatShading: true, roughness: 0.6 }));
        m.position.set(x, sh / 2, z); m.rotation.y = R(0, 6);
      }
      m.castShadow = false; m.receiveShadow = true; G.add(m);
    }
    if (kind === 'magma') {
      for (var l = 0; l < 10; l++) {
        var la = R(0, 6.28), ld = R(44, 60), pool = new THREE.Mesh(new THREE.CircleGeometry(R(3, 7), 20), new THREE.MeshBasicMaterial({ color: 0xff5a10 }));
        pool.rotation.x = -Math.PI / 2; pool.position.set(Math.cos(la) * ld, 0.05, Math.sin(la) * ld); G.add(pool);
      }
      var lavaLight = new THREE.PointLight(0xff5020, 1.2, 80); lavaLight.position.set(0, 6, 0); G.add(lavaLight);
    }
    if (kind === 'city') {
      // trees and lamps between ring and arena
      for (var tI = 0; tI < 22; tI++) {
        var ta = R(0, 6.28), td = R(41.5, 47), tx = Math.cos(ta) * td, tz = Math.sin(ta) * td;
        var trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 2.4, 6), std(0x4a3022)); trunk.position.set(tx, 1.2, tz); G.add(trunk);
        var crown = new THREE.Mesh(new THREE.IcosahedronGeometry(R(1.6, 2.4), 0), std(0x3f7a3a, { flatShading: true })); crown.position.set(tx, 3.4, tz); crown.castShadow = true; G.add(crown);
      }
    }
    // inner cover objects (with colliders)
    var covers = [[20, 6], [-18, 12], [6, -21], [-14, -20], [26, -14], [-27, -4], [12, 25], [-6, 28], [30, 14], [-24, 22]];
    covers.forEach(function (c, idx) {
      var x = c[0] + R(-2, 2), z = c[1] + R(-2, 2), grp = new THREE.Group(), r = 1.6;
      if (kind === 'city') {
        if (idx % 2 === 0) { // wrecked car
          var body = new THREE.Mesh(new THREE.BoxGeometry(3.8, 1.1, 1.9), std(U.pick([0x8a2a2a, 0x2a5a8a, 0x7a7a30, 0x505058]), { roughness: 0.5, metalness: 0.4 })); body.position.y = 0.75; grp.add(body);
          var cab = new THREE.Mesh(new THREE.BoxGeometry(2, 0.8, 1.7), std(0x22252e, { roughness: 0.3, metalness: 0.6 })); cab.position.set(-0.2, 1.65, 0); grp.add(cab);
          for (var wi = 0; wi < 4; wi++) { var wh = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.3, 10), std(0x111111)); wh.rotation.x = Math.PI / 2; wh.position.set(wi < 2 ? 1.2 : -1.2, 0.4, wi % 2 ? 0.95 : -0.95); grp.add(wh); }
          grp.rotation.y = R(0, 6.28); grp.rotation.z = R(-0.1, 0.1); r = 2;
        } else { // concrete barriers
          for (var bI = 0; bI < 2; bI++) { var bar = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.7), std(0x9a968e)); bar.position.set(0, 0.55, bI * 1.1 - 0.55); bar.rotation.y = R(-0.2, 0.2); grp.add(bar); }
          grp.rotation.y = R(0, 6.28); r = 1.6;
        }
      } else if (kind === 'desert') {
        var rock = new THREE.Mesh(new THREE.DodecahedronGeometry(R(1.4, 2.2), 0), std(0xb07a4a, { flatShading: true })); rock.position.y = 0.8; rock.scale.y = 0.7; grp.add(rock);
        var crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 1.2), std(0x7a5a30)); crate.position.set(1.4, 0.6, 0.6); crate.rotation.y = 0.5; grp.add(crate); r = 2;
      } else if (kind === 'frost') {
        var ice = new THREE.Mesh(new THREE.IcosahedronGeometry(R(1.3, 2), 0), std(0xcff4ff, { roughness: 0.15, flatShading: true, emissive: 0x2a6a9a, emissiveIntensity: 0.25 })); ice.position.y = 1; ice.scale.y = 1.3; grp.add(ice); r = 1.8;
      } else {
        var mr = new THREE.Mesh(new THREE.DodecahedronGeometry(R(1.4, 2.1), 0), std(0x2a1c1c, { flatShading: true })); mr.position.y = 0.9; grp.add(mr);
        var glow = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 0), new THREE.MeshBasicMaterial({ color: 0xff6a20 })); glow.position.set(0.9, 0.3, 0.8); grp.add(glow); r = 1.9;
      }
      grp.position.set(x, 0, z);
      grp.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      G.add(grp); addCollider(x, z, r);
    });
  }

  // ---------- camera & render ----------
  W.updateCamera = function (dt, fx, fz, ax, az) {
    var cam = W.camera, tx = fx + ax * 0.18, tz = fz + az * 0.18;
    if (!W.camT) W.camT = new THREE.Vector3(tx, 0, tz);
    var k = 1 - Math.exp(-dt * 6);
    W.camT.x += (tx - W.camT.x) * k; W.camT.z += (tz - W.camT.z) * k;
    W.shake = Math.max(0, W.shake - dt * 2.2);
    var s = W.shake * W.shake * 1.4;
    cam.position.set(W.camT.x + U.rand(-s, s), W.camH + U.rand(-s, s) * 0.5, W.camT.z + W.camZ + U.rand(-s, s));
    cam.lookAt(W.camT.x, 0, W.camT.z - 1);
    W.sun.position.set(W.camT.x + 22, 40, W.camT.z + 16); W.sun.target.position.set(W.camT.x, 0, W.camT.z);
    if (W.mothership) W.mothership.rotation.y += dt * 0.02;
  };
  W.addShake = function (v) { W.shake = Math.min(1.2, W.shake + v); };
  W.render = function () { W.renderer.render(W.scene, W.camera); };

  // screen <-> world helpers
  var ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -1.0), v2 = new THREE.Vector2(), hit = new THREE.Vector3();
  W.screenToGround = function (sx, sy) {
    v2.set(sx / window.innerWidth * 2 - 1, -(sy / window.innerHeight) * 2 + 1);
    ray.setFromCamera(v2, W.camera);
    if (ray.ray.intersectPlane(plane, hit)) return hit; return null;
  };
  var pv = new THREE.Vector3();
  W.worldToScreen = function (x, y, z) {
    pv.set(x, y, z).project(W.camera);
    return { x: (pv.x + 1) / 2 * window.innerWidth, y: (1 - pv.y) / 2 * window.innerHeight, behind: pv.z > 1 };
  };
})(window.PB);
