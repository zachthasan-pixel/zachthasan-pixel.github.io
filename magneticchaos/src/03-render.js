// ---------------------------------------------------------------------------
// WebGL renderer. Three passes per frame:
//   1. sprites  -> scene texture (additive glow quads, one draw call)
//   2. trail    -> ping-pong texture: max(previous * decay, scene) = motion trails
//   3. composite-> screen: background grid, arena rim, lensing for anomalies,
//                  bloom from the trail, chromatic aberration, tonemap, grain.
// Plain WebGL 1 so it runs everywhere, including old phones and portal iframes.
// ---------------------------------------------------------------------------
const SPRITE_VS = `
attribute vec2 aPos; attribute vec2 aCorner; attribute vec2 aSize; attribute float aAng;
attribute vec4 aCol; attribute float aShape;
uniform vec2 uScale; uniform vec2 uCam;
varying vec2 vUV; varying vec4 vCol; varying float vShape;
void main() {
  float c = cos(aAng), s = sin(aAng);
  vec2 o = aCorner * aSize;
  o = vec2(o.x * c - o.y * s, o.x * s + o.y * c);
  vec2 p = (aPos + o - uCam) * uScale;
  gl_Position = vec4(p.x, -p.y, 0.0, 1.0);
  vUV = aCorner; vCol = aCol; vShape = aShape;
}`;
const SPRITE_FS = `
precision mediump float;
varying vec2 vUV; varying vec4 vCol; varying float vShape;
void main() {
  float d = length(vUV);
  float f;
  if (vShape < 0.5) f = exp(-d * d * 4.5) * (1.0 - smoothstep(0.85, 1.0, d));
  else if (vShape < 1.5) { float k = (d - 0.86) * 16.0; f = exp(-k * k); }
  else if (vShape < 2.5) f = smoothstep(1.0, 0.8, d) + exp(-d * d * 3.0) * 0.3;
  else f = smoothstep(1.0, 0.15, d);
  gl_FragColor = vec4(vCol.rgb * (vCol.a * f), 1.0);
}`;
const QUAD_VS = `
attribute vec2 aPos; varying vec2 vUV;
void main() { vUV = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;
const TRAIL_FS = `
precision mediump float;
varying vec2 vUV; uniform sampler2D uPrev; uniform sampler2D uScene; uniform float uDecay;
void main() {
  vec3 p = texture2D(uPrev, vUV).rgb * uDecay - 2.0 / 255.0;
  gl_FragColor = vec4(max(p, texture2D(uScene, vUV).rgb), 1.0);
}`;
const COMP_FS = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
varying vec2 vUV;
uniform sampler2D uScene; uniform sampler2D uTrail;
uniform vec2 uRes; uniform vec4 uZone[4]; uniform vec3 uRim; uniform vec4 uRimFx; uniform vec3 uRimCol;
uniform float uTime; uniform float uAberr; uniform float uTwist; uniform vec3 uFlash; uniform float uDark;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  float aspect = uRes.x / uRes.y;
  vec2 uv = vUV, c = uRim.xy;
  if (uTwist != 0.0) {
    vec2 d = uv - c; d.x *= aspect;
    float r = length(d) / uRim.z;
    float a = uTwist * exp(-r * r * 1.4);
    float cs = cos(a), sn = sin(a);
    d = vec2(d.x * cs - d.y * sn, d.x * sn + d.y * cs); d.x /= aspect;
    uv = c + d;
  }
  vec3 tint = vec3(0.0), ring = vec3(0.0); float horizon = 0.0;
  for (int i = 0; i < 4; i++) {
    vec4 z = uZone[i];
    if (z.w == 0.0) continue;
    vec2 d = uv - z.xy; d.x *= aspect;
    float r = length(d) + 1e-5; vec2 n = d / r; n.x /= aspect;
    if (z.w > 0.0) {
      float m = 1.0 - smoothstep(z.z * 0.55, z.z, r);
      uv += n * sin(r / z.z * 30.0 - uTime * 5.0) * 0.0032 * z.w * m;
      tint += vec3(0.02, 0.07, 0.17) * m * z.w;
      float e = (r - z.z) / (z.z * 0.025);
      ring += vec3(0.3, 0.65, 1.0) * exp(-e * e) * 0.45 * z.w;
    } else {
      float s = -z.w, h = z.z;
      uv += n * (h * h * 1.1 / r) * s;
      horizon = max(horizon, (1.0 - smoothstep(h * 0.85, h * 1.08, r)) * s);
      float e = (r - h * 1.2) / (h * 0.1);
      ring += vec3(1.0, 0.55, 0.22) * exp(-e * e) * 0.9 * s;
    }
  }
  vec2 ab = (uv - 0.5) * uAberr;
  vec3 col = vec3(texture2D(uScene, uv + ab).r, texture2D(uScene, uv).g, texture2D(uScene, uv - ab).b);
  vec3 tr = texture2D(uTrail, uv).rgb;
  vec2 px = 1.0 / uRes;
  vec3 bl = vec3(0.0);
  bl += texture2D(uTrail, uv + vec2( 4.0,  0.0) * px).rgb;
  bl += texture2D(uTrail, uv + vec2(-2.0,  3.5) * px).rgb;
  bl += texture2D(uTrail, uv + vec2(-2.0, -3.5) * px).rgb;
  bl += texture2D(uTrail, uv + vec2(-10.0, 0.0) * px).rgb;
  bl += texture2D(uTrail, uv + vec2( 5.0,  8.7) * px).rgb;
  bl += texture2D(uTrail, uv + vec2( 5.0, -8.7) * px).rgb;
  bl += texture2D(uTrail, uv + vec2( 0.0, 16.0) * px).rgb * 0.7;
  bl += texture2D(uTrail, uv + vec2(13.9, -8.0) * px).rgb * 0.7;
  bl += texture2D(uTrail, uv + vec2(-13.9,-8.0) * px).rgb * 0.7;
  bl /= 8.1;
  vec2 q = uv - c; q.x *= aspect;
  float rr = length(q) / uRim.z, ang = atan(q.y, q.x);
  vec3 bg = vec3(0.010, 0.012, 0.028) + vec3(0.030, 0.018, 0.070) * exp(-rr * rr * 1.6);
  float spokes = smoothstep(0.992, 1.0, cos(ang * 24.0 + uTime * 0.05));
  float rings = smoothstep(0.96, 1.0, cos(rr * 3.14159 * 8.0 - uTime * 0.4));
  bg += vec3(0.30, 0.38, 0.95) * (spokes * 0.5 + rings) * 0.02 * (1.0 - smoothstep(0.98, 1.0, rr));
  bg *= mix(1.0, 0.4, smoothstep(1.0, 1.03, rr));
  float rimD = abs(rr - 1.0) * uRim.z * uRes.y;
  float rim = exp(-rimD * rimD / 3.0) + exp(-rimD / 12.0) * 0.28;
  float danger = uRimFx.y * smoothstep(0.55, 1.0, cos(ang - uRimFx.x));
  vec3 rimCol = mix(uRimCol, vec3(1.0, 0.1, 0.12), clamp(danger, 0.0, 1.0));
  bg += rimCol * rim * (0.5 + uRimFx.z * 0.7 + danger * 1.6);
  vec3 o = bg + tint + ring + col + tr * 0.5 + bl * 0.75;
  o = 1.0 - exp(-o * 1.3);
  o *= 1.0 - horizon;
  vec2 vq = (vUV - 0.5) * vec2(aspect, 1.0);
  o *= 1.0 - smoothstep(0.55, 1.35, length(vq)) * 0.65;
  o = o * (1.0 - uDark) + uFlash;
  o += (hash(vUV * uRes + fract(uTime) * 91.7) - 0.5) * 0.025;
  gl_FragColor = vec4(o, 1.0);
}`;

const GL = {
  gl: null, ok: false, max: 6000, n: 0, data: null, idx: 0,
  init(canvas) {
    this.canvas = canvas;
    const opts = { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' };
    let gl = null;
    try { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) return false;
    this.gl = gl;
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.ok = false; }, false);
    canvas.addEventListener('webglcontextrestored', () => { this.setup(); this.resize(); }, false);
    this.setup();
    return this.ok;
  },
  shader(type, src) {
    const gl = this.gl, s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost()) throw new Error(gl.getShaderInfoLog(s));
    return s;
  },
  program(vs, fs, attrs) {
    const gl = this.gl, p = gl.createProgram();
    gl.attachShader(p, this.shader(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, this.shader(gl.FRAGMENT_SHADER, fs));
    attrs.forEach((a, i) => gl.bindAttribLocation(p, i, a));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const name = gl.getActiveUniform(p, i).name.replace('[0]', '');
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  },
  setup() {
    const gl = this.gl;
    try {
      this.sprite = this.program(SPRITE_VS, SPRITE_FS, ['aPos', 'aCorner', 'aSize', 'aAng', 'aCol', 'aShape']);
      this.trail = this.program(QUAD_VS, TRAIL_FS, ['aPos']);
      this.comp = this.program(QUAD_VS, COMP_FS, ['aPos']);
    } catch (e) {
      console.error(e); this.ok = false; return;
    }
    this.data = new Float32Array(this.max * 48);
    const cx = [-1, 1, 1, -1], cy = [-1, -1, 1, 1];
    for (let i = 0; i < this.max; i++) for (let v = 0; v < 4; v++) {
      this.data[i * 48 + v * 12 + 2] = cx[v]; this.data[i * 48 + v * 12 + 3] = cy[v];
    }
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(gl.ARRAY_BUFFER, this.data.byteLength, gl.DYNAMIC_DRAW);
    const ix = new Uint16Array(this.max * 6);
    for (let i = 0; i < this.max; i++) {
      const v = i * 4, o = i * 6;
      ix[o] = v; ix[o + 1] = v + 1; ix[o + 2] = v + 2; ix[o + 3] = v; ix[o + 4] = v + 2; ix[o + 5] = v + 3;
    }
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ix, gl.STATIC_DRAW);
    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.targets = null; this.tw = 0;
    this.ok = true;
  },
  target(w, h) {
    const gl = this.gl, tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h };
  },
  resize() {
    if (!this.ok) return;
    const gl = this.gl, k = View.dpr * View.quality;
    const w = Math.max(2, Math.round(View.w * k)), h = Math.max(2, Math.round(View.h * k));
    if (this.canvas.width !== w || this.canvas.height !== h) { this.canvas.width = w; this.canvas.height = h; }
    if (this.targets && this.tw === w && this.th === h) return;
    if (this.targets) this.targets.forEach(t => { gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fb); });
    this.tw = w; this.th = h;
    const hw = Math.max(2, w >> 1), hh = Math.max(2, h >> 1);
    this.targets = [this.target(w, h), this.target(hw, hh), this.target(hw, hh)];
    this.ping = 1;
  },
  begin() { this.n = 0; },
  // x, y centre (world), w, h half-extents, ang rotation, rgb + alpha, shape:
  // 0 soft glow, 1 ring, 2 solid disc, 3 shard.
  spr(x, y, w, h, ang, r, g, b, a, shape) {
    if (this.n >= this.max || a <= 0.003) return;
    const d = this.data;
    let o = this.n * 48;
    for (let v = 0; v < 4; v++, o += 12) {
      d[o] = x; d[o + 1] = y; d[o + 4] = w; d[o + 5] = h; d[o + 6] = ang;
      d[o + 7] = r; d[o + 8] = g; d[o + 9] = b; d[o + 10] = a; d[o + 11] = shape;
    }
    this.n++;
  },
  dot(x, y, s, c, a, shape) { this.spr(x, y, s, s, 0, c[0], c[1], c[2], a, shape || 0); },
  quadDraw(prog) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    for (let i = 1; i < 6; i++) gl.disableVertexAttribArray(i);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.useProgram(prog.p);
  },
  frame(U) {
    if (!this.ok || this.gl.isContextLost()) return;
    const gl = this.gl, S = this.targets[0];
    let A = this.targets[this.ping], B = this.targets[3 - this.ping];
    // 1. sprites
    gl.bindFramebuffer(gl.FRAMEBUFFER, S.fb);
    gl.viewport(0, 0, S.w, S.h);
    gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    if (this.n) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      gl.useProgram(this.sprite.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.data.subarray(0, this.n * 48));
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
      const st = 48, sizes = [2, 2, 2, 1, 4, 1];
      let off = 0;
      for (let i = 0; i < 6; i++) {
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, sizes[i], gl.FLOAT, false, st, off);
        off += sizes[i] * 4;
      }
      gl.uniform2f(this.sprite.u.uScale, 2 * View.scale / View.w, 2 * View.scale / View.h);
      gl.uniform2f(this.sprite.u.uCam, U.camX, U.camY);
      gl.drawElements(gl.TRIANGLES, this.n * 6, gl.UNSIGNED_SHORT, 0);
      gl.disable(gl.BLEND);
    }
    // 2. trails
    gl.bindFramebuffer(gl.FRAMEBUFFER, B.fb);
    gl.viewport(0, 0, B.w, B.h);
    this.quadDraw(this.trail);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, A.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.uniform1i(this.trail.u.uPrev, 0); gl.uniform1i(this.trail.u.uScene, 1);
    gl.uniform1f(this.trail.u.uDecay, U.decay);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.ping = 3 - this.ping;
    // 3. composite
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const c = this.comp, u = c.u;
    this.quadDraw(c);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, S.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, B.tex);
    gl.uniform1i(u.uScene, 0); gl.uniform1i(u.uTrail, 1);
    gl.uniform2f(u.uRes, View.w, View.h);
    gl.uniform4fv(u.uZone, U.zones);
    gl.uniform3f(u.uRim, U.rimX, U.rimY, U.rimR);
    gl.uniform4f(u.uRimFx, U.dangerAng, U.danger, U.beat, 0);
    gl.uniform3fv(u.uRimCol, U.rimCol);
    gl.uniform1f(u.uTime, U.time % 1000);
    gl.uniform1f(u.uAberr, U.aberr);
    gl.uniform1f(u.uTwist, U.twist);
    gl.uniform3fv(u.uFlash, U.flash);
    gl.uniform1f(u.uDark, U.dark);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
};
