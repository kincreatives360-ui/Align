// WebGL2 renderer. Each frame: background + cards (or the Flare Duo) into a mipmapped scene buffer,
// then one post pass for liquid glass, bloom, grade, grain and labels.
import { VS_FULL, FS_BG, VS_CARD, FS_CARD, FS_SHADOW, FS_FLARE, FS_POST, VS_SIDE, FS_SIDE } from './shaders.js';
import { mat4, lookAt } from './math.js';
import { renderFace, paintFace, faceLayers, analyse } from './faces.js';
// video faces: the longest side is capped, and blur layers refresh at most this often in the preview
const VIDEO_MAX = 1024, VIDEO_BLUR_MS = 90;

export class Renderer {
  constructor(canvas){
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, antialias: true});
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    // anisotropic filtering keeps photos sharp on cards turned steeply away from the camera
    const af = gl.getExtension('EXT_texture_filter_anisotropic');
    this.aniso = af ? [af.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT))] : null;
    this.progs = {
      bg: this.program(VS_FULL, FS_BG), card: this.program(VS_CARD, FS_CARD), shadow: this.program(VS_CARD, FS_SHADOW),
      flare: this.program(VS_FULL, FS_FLARE), post: this.program(VS_FULL, FS_POST), side: this.program(VS_SIDE, FS_SIDE),
    };
    // fullscreen triangle
    this.full = gl.createVertexArray(); gl.bindVertexArray(this.full);
    const fb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, fb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.progs.bg, this.progs.flare, this.progs.post]){ const l = gl.getAttribLocation(p.p, 'aPos'); if (l >= 0){ gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); } }
    // card grid: enough columns and rows to bend smoothly around cylinders and rings, either way
    const CX = 40, CY = 16, verts = [], idx = [];
    for (let y = 0; y <= CY; y++) for (let x = 0; x <= CX; x++) verts.push(x / CX, y / CY);
    for (let y = 0; y < CY; y++) for (let x = 0; x < CX; x++){ const a = y * (CX + 1) + x, b = a + 1, c = a + CX + 1, d = c + 1; idx.push(a, b, d, a, d, c); }
    this.meshCount = idx.length;
    this.mesh = gl.createVertexArray(); gl.bindVertexArray(this.mesh);
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const p of [this.progs.card, this.progs.shadow]) gl.bindAttribLocation(p.p, 0, 'aUV');
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    // the edge walls of thick cards: a strip round the card's outline, front to back
    const SU = 128, sv = [];
    for (let u = 0; u < SU; u++) sv.push(u, 0, u + 1, 0, u + 1, 1, u, 0, u + 1, 1, u, 1);
    this.sideCount = sv.length / 2;
    this.side = gl.createVertexArray(); gl.bindVertexArray(this.side);
    const sb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, sb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sv), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
    this.faces = new Map();
    this.live = new Set(); this.exact = false;
    this.targets = new Map();
    this.label = this.texture();
    this.labelOn = false;
    this.white = this.texture(); gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }
  program(vs, fs){
    const gl = this.gl;
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 3).join('\n')); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, vs.includes('aUV') ? 'aUV' : 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return {p, loc: {}};
  }
  u(prog, name, v){
    const gl = this.gl;
    let l = prog.loc[name];
    if (l === undefined) l = prog.loc[name] = gl.getUniformLocation(prog.p, name);
    if (l === null) return;
    if (typeof v === 'number') gl.uniform1f(l, v);
    else if (v && v.i !== undefined) gl.uniform1i(l, v.i);
    else if (v.length === 16) gl.uniformMatrix4fv(l, false, v);
    else if (v.length === 2) gl.uniform2fv(l, v);
    else if (v.length === 3) gl.uniform3fv(l, v);
    else if (v.length === 4) gl.uniform4fv(l, v);
  }
  texture(){
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  upload(tex, src, mips){
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mips){ gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso[0], this.aniso[1]); }
  }
  // face textures are cached by media item, card aspect and resolution
  face(item, key, aspect, res){
    const vid = item.kind === 'video';
    if (vid) res = Math.min(res, VIDEO_MAX, Math.max(256, item.img.videoWidth || 0, item.img.videoHeight || 0));
    const k = `${key}|${aspect.toFixed(3)}|${res}`;
    let e = this.faces.get(k);
    if (e){ e.used = performance.now(); if (vid) this.live.add(e); return e; }
    const face = renderFace(item, aspect, res);
    const layers = faceLayers(face);
    e = {tex: [this.texture(), this.texture(), this.texture(), this.texture()], w: face.width, h: face.height, used: performance.now(), face, info: analyse(face)};
    this.upload(e.tex[0], face, true);
    layers.forEach((l, i) => this.upload(e.tex[i + 1], l, false));
    if (vid){ e.k = k; e.item = item; e.ver = item.img._ver; e.vt = item.img.currentTime; e.blurT = performance.now(); this.live.add(e); }
    this.faces.set(k, e);
    if (this.faces.size > 160) this.evict();
    return e;
  }
  // Video faces used by this frame repaint in place when their video has a new frame: once per face
  // entry per rendered frame, however many cards show it. The three blur layers are slower to build, so
  // they refresh only for faces that are blurred right now, and in the preview at most every VIDEO_BLUR_MS
  // (every frame while exporting, when `exact` is set).
  syncVideos(desc){
    if (!this.live.size) return;
    const blurred = new Set(), now = performance.now();
    if (desc.flare){ if (desc.flare.u.uBlurO > 0) blurred.add(desc.flare.a); if (desc.flare.u.uBlurN > 0) blurred.add(desc.flare.b); }
    for (const c of desc.cards) if (c.blur > .002 && c.face) blurred.add(c.face);
    for (const e of this.live){
      if (this.faces.get(e.k) !== e) continue;
      const v = e.item.img;
      // a playing video's own frame callbacks say when a new frame is up; otherwise go by its clock
      const fresh = v._ver !== e.ver || (!v.paused && now - (v._ft || 0) > 250 && v.currentTime !== e.vt);
      if (fresh){ e.ver = v._ver; e.vt = v.currentTime; paintFace(e.face, e.item); this.update(e.tex[0], e.face, true); e.stale = true; }
      if (e.stale && blurred.has(e) && (this.exact || now - e.blurT >= VIDEO_BLUR_MS)){
        faceLayers(e.face).forEach((l, i) => this.upload(e.tex[i + 1], l, false));
        e.stale = false; e.blurT = now;
      }
    }
    this.live.clear();
  }
  update(tex, src, mips){
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  }
  evict(){
    const list = [...this.faces.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of list.slice(0, 40)){ e.tex.forEach(t => this.gl.deleteTexture(t)); this.faces.delete(k); }
  }
  dropFaces(match){
    for (const [k, e] of [...this.faces.entries()]) if (!match || k.startsWith(match)){ e.tex.forEach(t => this.gl.deleteTexture(t)); this.faces.delete(k); }
  }
  target(name, w, h){
    const gl = this.gl;
    let t = this.targets.get(name);
    if (t && t.w === w && t.h === h) return t;
    if (t){ gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
    const tex = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    t = {tex, fbo, w, h};
    this.targets.set(name, t);
    return t;
  }
  setLabels(canvas){
    if (!canvas){ this.labelOn = false; return; }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.label);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.labelOn = true;
  }
  bindTex(unit, tex){ const gl = this.gl; gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); }

  /* desc: {W, H, bg, camera, cards, shadow, flare, post}; out: null (canvas) or {fbo} */
  render(desc, out = null){
    const gl = this.gl, {W, H} = desc;
    this.syncVideos(desc);
    const scene = this.target(out ? 'scene-' + W + 'x' + H : 'scene', W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);
    const b = desc.bg;
    if (!b.transparent){
      const P = this.progs.bg; gl.useProgram(P.p); gl.bindVertexArray(this.full);
      this.u(P, 'uRes', [W, H]); this.u(P, 'uMode', {i: b.mode});
      this.u(P, 'uC0', b.c[0]); this.u(P, 'uC1', b.c[1]); this.u(P, 'uC2', b.c[2]); this.u(P, 'uC3', b.c[3]);
      this.u(P, 'uPhase', b.phase); this.u(P, 'uCycles', b.cycles); this.u(P, 'uScale', b.scale); this.u(P, 'uAngle', b.angle); this.u(P, 'uAmt', b.amt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    if (desc.flare) this.drawFlare(desc);
    else this.drawCards(desc);
    gl.bindTexture(gl.TEXTURE_2D, scene.tex); gl.generateMipmap(gl.TEXTURE_2D);
    // post
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    gl.viewport(0, 0, W, H);
    const P = this.progs.post, p = desc.post;
    gl.useProgram(P.p); gl.bindVertexArray(this.full);
    this.bindTex(0, scene.tex); this.u(P, 'uScene', {i: 0});
    this.bindTex(1, this.labelOn && p.labels ? this.label : this.white); this.u(P, 'uLabel', {i: 1});
    this.u(P, 'uLabelOn', this.labelOn && p.labels ? 1 : 0);
    this.u(P, 'uRes', [W, H]); this.u(P, 'uSeed', p.seed); this.u(P, 'uAlphaOut', b.transparent ? 1 : 0);
    for (const k in p.u) this.u(P, k, p.u[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }
  drawCards(desc){
    const gl = this.gl, {W, H} = desc, cam = desc.camera;
    const proj = mat4.perspective(cam.fov, W / H, .05, 200);
    const view = lookAt(cam.eye, cam.target || [0, 0, 0], cam.up || [0, 1, 0]);
    const VP = mat4.mul(proj, view);
    // depth-sort back to front so translucent edges blend correctly
    const list = desc.cards.filter(c => c.opacity > .002).map(c => {
      const m = c.m || mat4.model(c.x, c.y, c.z, c.rx, c.ry, c.rz, c.sx, c.sy);
      const w = mat4.transform(view, c.x, c.y, c.z);
      return {c, m, depth: w[2] + (c.zBias || 0)};
    }).sort((a, b) => a.depth - b.depth);
    const S = this.progs.shadow, C = this.progs.card, E = this.progs.side, sh = desc.shadow;
    gl.bindVertexArray(this.mesh);
    for (const {c, m} of list){
      if (sh.on && sh.alpha > 0){
        gl.useProgram(S.p);
        // the shadow is the card itself, dropped a little below and behind it in world space
        this.u(S, 'uModel', mat4.mul(mat4.translation(0, -sh.offset * c.h * c.sy, -.01), m)); this.u(S, 'uVP', VP);
        const soft = sh.soft * c.h;
        this.u(S, 'uSize', [c.w, c.h]); this.u(S, 'uExpand', [soft * 1.5, soft * 1.5]); this.u(S, 'uBend', c.bend || 0); this.u(S, 'uBendY', c.bendY || 0); this.u(S, 'uOff', 0);
        this.u(S, 'uRadius', c.radius); this.u(S, 'uSoft', soft); this.u(S, 'uAlpha', sh.alpha * c.opacity); this.u(S, 'uColor', sh.color);
        gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_SHORT, 0);
      }
      // a thick card: its edge walls first, then whichever face is turned to the camera on top
      let off = 0;
      if (c.thick > 0){
        const fx = m[8], fy = m[9], fz = m[10], seen = fx * (cam.eye[0] - m[12]) + fy * (cam.eye[1] - m[13]) + fz * (cam.eye[2] - m[14]);
        if (seen < 0) off = -c.thick;
        gl.useProgram(E.p); gl.bindVertexArray(this.side);
        this.u(E, 'uModel', m); this.u(E, 'uVP', VP); this.u(E, 'uCam', cam.eye);
        this.u(E, 'uSize', [c.w, c.h]); this.u(E, 'uRadius', c.radius); this.u(E, 'uThick', c.thick);
        this.u(E, 'uBend', c.bend || 0); this.u(E, 'uBendY', c.bendY || 0);
        this.u(E, 'uEdgeCol', c.edgeCol); this.u(E, 'uOpacity', c.opacity); this.u(E, 'uBright', c.bright);
        gl.drawArrays(gl.TRIANGLES, 0, this.sideCount);
        gl.bindVertexArray(this.mesh);
      }
      gl.useProgram(C.p);
      for (let i = 0; i < 4; i++){ this.bindTex(i, c.face.tex[i]); this.u(C, 'uT' + i, {i}); }
      this.u(C, 'uModel', m); this.u(C, 'uVP', VP); this.u(C, 'uCam', cam.eye);
      this.u(C, 'uSize', [c.w, c.h]); this.u(C, 'uExpand', [0, 0]); this.u(C, 'uBend', c.bend || 0); this.u(C, 'uBendY', c.bendY || 0); this.u(C, 'uOff', off);
      this.u(C, 'uRadius', c.radius); this.u(C, 'uOpacity', c.opacity); this.u(C, 'uBlur', c.blur);
      this.u(C, 'uShade', c.shade); this.u(C, 'uBorder', c.border); this.u(C, 'uGlare', c.glare); this.u(C, 'uGlareP', c.glareP);
      this.u(C, 'uBackMix', c.backMix); this.u(C, 'uBackCol', c.backCol); this.u(C, 'uBright', c.bright);
      this.u(C, 'uTint', c.tint); this.u(C, 'uTintA', c.tintA);
      this.u(C, 'uGlassW', c.glassW); this.u(C, 'uGlassR', c.glassR); this.u(C, 'uGlassD', c.glassD);
      this.u(C, 'uCrumple', c.crumple || 0); this.u(C, 'uCrSeed', c.crSeed || 0);
      gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }
  drawFlare(desc){
    const gl = this.gl, F = this.progs.flare, f = desc.flare;
    gl.useProgram(F.p); gl.bindVertexArray(this.full);
    const names = ['uTexA0', 'uTexA1', 'uTexA2', 'uTexA3', 'uTexB0', 'uTexB1', 'uTexB2', 'uTexB3'];
    for (let i = 0; i < 4; i++){ this.bindTex(i, f.a.tex[i]); this.bindTex(4 + i, f.b.tex[i]); }
    names.forEach((n, i) => this.u(F, n, {i}));
    this.u(F, 'uRes', [desc.W, desc.H]);
    for (const k in f.u) this.u(F, k, f.u[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  // render to an offscreen buffer and read it back (thumbnails, image export)
  snapshot(desc, ctx2d){
    const gl = this.gl, {W, H} = desc;
    const t = this.target('snap-' + W + 'x' + H, W, H);
    this.render(desc, t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const img = new ImageData(W, H), row = W * 4;
    for (let y = 0; y < H; y++){
      const src = (H - 1 - y) * row;
      for (let i = 0; i < row; i += 4){
        const a = px[src + i + 3], k = a ? 255 / a : 0;
        // the buffer holds premultiplied colour; ImageData wants straight alpha
        img.data[y * row + i] = Math.min(255, px[src + i] * k); img.data[y * row + i + 1] = Math.min(255, px[src + i + 1] * k);
        img.data[y * row + i + 2] = Math.min(255, px[src + i + 2] * k); img.data[y * row + i + 3] = a;
      }
    }
    if (ctx2d){ ctx2d.canvas.width = W; ctx2d.canvas.height = H; ctx2d.putImageData(img, 0, 0); }
    return img;
  }
}
