import {
  VS_FULL, FS_BG, VS_CARD, FS_CARD, FS_SHADOW, FS_FLARE, FS_POST, VS_SIDE, FS_SIDE
} from './shaders';
import { mat4, lookAt } from '../engine/math';
import { faceSize, paintFace, faceLayers } from './faces';
import type { FrameDescriptor, CardDesc, FaceRef, FaceEntry } from '../state/types';

const VIDEO_MAX = 1024;
const VIDEO_BLUR_MS = 90;

interface VideoElement extends HTMLVideoElement {
  _ver?: number;
  _ft?: number;
}

interface Program {
  p: WebGLProgram;
  /** Cached uniform locations (null = the shader optimised that uniform away). */
  loc: Record<string, WebGLUniformLocation | null>;
  /** GLSL type of each active uniform, so `u()` can pick uniform1i vs uniform1f. */
  ty: Record<string, number>;
}

interface FramebufferEntry {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export class Renderer {
  canvas: HTMLCanvasElement;
  gl: WebGL2RenderingContext;
  aniso: [number, number] | null;
  progs: Record<string, Program>;
  maxTex: number;
  buffers: WebGLBuffer[];
  full: WebGLVertexArrayObject;
  mesh: WebGLVertexArrayObject;
  meshCount: number;
  side: WebGLVertexArrayObject;
  sideCount: number;
  faces: Map<string, FaceEntry>;
  live: Set<FaceEntry>;
  exact: boolean;
  targets: Map<string, FramebufferEntry>;
  label: WebGLTexture;
  labelOn: boolean;
  white: WebGLTexture;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: true,
    });
    if (!gl) throw new Error('WebGL2 is not available in this browser.');
    this.gl = gl;
    this.maxTex = (gl.getParameter(gl.MAX_TEXTURE_SIZE) as number) || 2048;
    this.buffers = [];

    // Anisotropic filtering
    const af = gl.getExtension('EXT_texture_filter_anisotropic');
    this.aniso = af
      ? [af.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(16, gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT) as number)]
      : null;

    // Compile programs
    this.progs = {
      bg: this.program(VS_FULL, FS_BG),
      card: this.program(VS_CARD, FS_CARD),
      shadow: this.program(VS_CARD, FS_SHADOW),
      flare: this.program(VS_FULL, FS_FLARE),
      post: this.program(VS_FULL, FS_POST),
      side: this.program(VS_SIDE, FS_SIDE),
    };

    // Fullscreen triangle
    this.full = gl.createVertexArray()!;
    gl.bindVertexArray(this.full);
    const fb = gl.createBuffer()!;
    this.buffers.push(fb);
    gl.bindBuffer(gl.ARRAY_BUFFER, fb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.progs.bg, this.progs.flare, this.progs.post]) {
      const l = gl.getAttribLocation(p.p, 'aPos');
      if (l >= 0) {
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
      }
    }

    // Card mesh: 40x16 grid for smooth bending
    const CX = 40, CY = 16;
    const verts: number[] = [];
    const idx: number[] = [];
    for (let y = 0; y <= CY; y++) for (let x = 0; x <= CX; x++) verts.push(x / CX, y / CY);
    for (let y = 0; y < CY; y++) {
      for (let x = 0; x < CX; x++) {
        const a = y * (CX + 1) + x;
        const b = a + 1;
        const c = a + CX + 1;
        const d = c + 1;
        idx.push(a, b, d, a, d, c);
      }
    }
    this.meshCount = idx.length;
    this.mesh = gl.createVertexArray()!;
    gl.bindVertexArray(this.mesh);
    const vb = gl.createBuffer()!;
    this.buffers.push(vb);
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    for (const p of [this.progs.card, this.progs.shadow]) gl.bindAttribLocation(p.p, 0, 'aUV');
    const ib = gl.createBuffer()!;
    this.buffers.push(ib);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);

    // Side mesh for thick cards
    const SU = 128;
    const sv: number[] = [];
    for (let u = 0; u < SU; u++) sv.push(u, 0, u + 1, 0, u + 1, 1, u, 0, u + 1, 1, u, 1);
    this.sideCount = sv.length / 2;
    this.side = gl.createVertexArray()!;
    gl.bindVertexArray(this.side);
    const sb = gl.createBuffer()!;
    this.buffers.push(sb);
    gl.bindBuffer(gl.ARRAY_BUFFER, sb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(sv), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.faces = new Map();
    this.live = new Set();
    this.exact = false;
    this.targets = new Map();

    // Label texture
    this.label = this.texture();
    this.labelOn = false;

    // White 1x1 texture
    this.white = this.texture();
    gl.bindTexture(gl.TEXTURE_2D, this.white);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([255, 255, 255, 255]));
  }

  program(vs: string, fs: string): Program {
    const gl = this.gl;
    const sh = (t: number, src: string) => {
      const s = gl.createShader(t)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s) + '\n' + src.split('\n').slice(0, 3).join('\n'));
      }
      return s;
    };
    const p = gl.createProgram()!;
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, vs.includes('aUV') ? 'aUV' : 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)!);

    const ty: Record<string, number> = {};
    const count = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS) as number;
    for (let i = 0; i < count; i++) {
      const info = gl.getActiveUniform(p, i);
      if (info) ty[info.name.replace(/\[0\]$/, '')] = info.type;
    }
    return { p, loc: {}, ty };
  }

  /**
   * Set a uniform. Numbers go to uniform1i when the shader declares an int, bool or
   * sampler (calling uniform1f on an int uniform is a GL error that is silently
   * ignored, which is how `uLensMode` never took effect), otherwise to uniform1f.
   */
  u(prog: Program, name: string, v: unknown): void {
    const gl = this.gl;
    if (v === undefined || v === null) return;
    if (!(name in prog.loc)) prog.loc[name] = gl.getUniformLocation(prog.p, name);
    const l = prog.loc[name];
    if (l === null) return;

    if (typeof v === 'number') {
      const t = prog.ty[name];
      if (t === gl.INT || t === gl.BOOL || t === gl.SAMPLER_2D) gl.uniform1i(l, Math.round(v));
      else gl.uniform1f(l, v);
      return;
    }
    if (typeof v === 'boolean') {
      gl.uniform1i(l, v ? 1 : 0);
      return;
    }
    const o = v as { i?: number; length?: number };
    if (o.i !== undefined) {
      gl.uniform1i(l, o.i);
      return;
    }
    const arr = v as Float32Array | number[];
    if (arr.length === 16) gl.uniformMatrix4fv(l, false, arr);
    else if (arr.length === 2) gl.uniform2fv(l, arr);
    else if (arr.length === 3) gl.uniform3fv(l, arr);
    else if (arr.length === 4) gl.uniform4fv(l, arr);
  }

  texture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  upload(tex: WebGLTexture, src: TexImageSource, mips: boolean): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mips) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso[0], this.aniso[1]);
    }
  }

  /**
   * The GPU textures for a card face, built once and cached.
   *
   * Paints the media onto a canvas at the card's aspect, uploads it as the sharp
   * texture (with mipmaps), then uploads three blurred copies for depth of field.
   * The old version uploaded a blank placeholder and wrote one texture past the end
   * of the 4-element array.
   */
  face(item: FaceRef, aspect: number, res: number): FaceEntry {
    const vid = item.kind === 'video';
    if (vid) {
      const video = item.img as VideoElement;
      res = Math.min(res, VIDEO_MAX, Math.max(256, video.videoWidth || 0, video.videoHeight || 0));
    }
    res = Math.max(2, Math.min(res, this.maxTex));

    const k = `${item.key}|${aspect.toFixed(3)}|${res}`;
    const hit = this.faces.get(k);
    if (hit) {
      hit.used = performance.now();
      if (vid) this.live.add(hit);
      return hit;
    }

    const { w, h } = faceSize(aspect, res);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    paintFace(canvas, item);

    const tex = [this.texture(), this.texture(), this.texture(), this.texture()];
    this.upload(tex[0], canvas, true);
    faceLayers(canvas).forEach((layer, i) => this.upload(tex[i + 1], layer, false));

    const entry: FaceEntry = {
      tex,
      w,
      h,
      used: performance.now(),
      face: { key: item.key, aspect, res, kind: 'image', img: canvas },
      info: { sharp: true },
    };
    if (vid) {
      const video = item.img as VideoElement;
      entry.k = k;
      entry.item = item;
      entry.ver = video._ver;
      entry.vt = video.currentTime;
      entry.blurT = performance.now();
      this.live.add(entry);
    }
    this.faces.set(k, entry);
    if (this.faces.size > 160) this.evict();
    return entry;
  }

  /** Video faces used by this frame repaint in place when their video has a new frame. */
  syncVideos(blurred: Set<FaceEntry>): void {
    if (!this.live.size) return;
    const now = performance.now();

    for (const e of this.live) {
      if (this.faces.get(e.k!) !== e) continue;
      const src = e.item!;
      const v = src.img as VideoElement;
      const fresh = v._ver !== e.ver || (!v.paused && now - (v._ft || 0) > 250 && v.currentTime !== e.vt);
      if (fresh) {
        e.ver = v._ver;
        e.vt = v.currentTime;
        paintFace(e.face.img as HTMLCanvasElement, src);
        this.update(e.tex[0], e.face.img, true);
        e.stale = true;
      }
      // The blurred copies are expensive, so refresh them at most every VIDEO_BLUR_MS
      // and only for faces that are actually drawn blurred this frame.
      if (e.stale && blurred.has(e) && (this.exact || now - (e.blurT ?? 0) >= VIDEO_BLUR_MS)) {
        faceLayers(e.face.img as HTMLCanvasElement).forEach((layer, i) => this.upload(e.tex[i + 1], layer, false));
        e.stale = false;
        e.blurT = now;
      }
    }
    this.live.clear();
  }

  update(tex: WebGLTexture, src: TexImageSource, mips: boolean): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
  }

  evict(): void {
    const list = [...this.faces.entries()].sort((a, b) => a[1].used - b[1].used);
    for (const [k, e] of list.slice(0, 40)) {
      e.tex.forEach(t => this.gl.deleteTexture(t));
      this.faces.delete(k);
    }
  }

  dropFaces(match?: string): void {
    for (const [k, e] of [...this.faces.entries()]) {
      if (!match || k.startsWith(match)) {
        e.tex.forEach(t => this.gl.deleteTexture(t));
        this.faces.delete(k);
      }
    }
  }

  target(name: string, w: number, h: number): FramebufferEntry {
    const gl = this.gl;
    let t = this.targets.get(name);
    if (t && t.w === w && t.h === h) return t;
    if (t) {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    }
    const tex = this.texture();
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    const fbo = gl.createFramebuffer()!;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    t = { tex, fbo, w, h };
    this.targets.set(name, t);
    return t;
  }

  setLabels(canvas: HTMLCanvasElement | null): void {
    if (!canvas) {
      this.labelOn = false;
      return;
    }
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, this.label);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    this.labelOn = true;
  }

  bindTex(unit: number, tex: WebGLTexture): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
  }

  /** Main render entry point. */
  render(desc: FrameDescriptor, out: FramebufferEntry | null = null): void {
    const gl = this.gl;
    if (gl.isContextLost()) return;
    const { W, H } = desc;

    // Resolve every card's face to GPU textures. `entries[i]` belongs to `desc.cards[i]`;
    // the descriptor itself is left untouched so it can be reused (e.g. for snapshots).
    const entries = desc.cards.map(c => this.face(c.face, c.face.aspect, c.face.res || 256));
    const flareEntries = desc.flare?.a && desc.flare?.b
      ? [
          this.face(desc.flare.a, desc.flare.a.aspect, desc.flare.a.res || 256),
          this.face(desc.flare.b, desc.flare.b.aspect, desc.flare.b.res || 256),
        ] as [FaceEntry, FaceEntry]
      : null;
    const blurred = new Set<FaceEntry>();
    desc.cards.forEach((card, i) => {
      if (card.blur > 0.002) blurred.add(entries[i]);
    });
    if (flareEntries && desc.flare.u.uBlurO > 0.002) blurred.add(flareEntries[0]);
    if (flareEntries && desc.flare.u.uBlurN > 0.002) blurred.add(flareEntries[1]);
    this.syncVideos(blurred);

    const scene = this.target(out ? 'scene-' + W + 'x' + H : 'scene', W, H);
    gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
    gl.viewport(0, 0, W, H);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.BLEND);

    // Background
    const b = desc.bg;
    if (b && !b.transparent) {
      const P = this.progs.bg;
      gl.useProgram(P.p);
      gl.bindVertexArray(this.full);
      this.u(P, 'uRes', [W, H]);
      this.u(P, 'uMode', { i: b.mode });
      this.u(P, 'uC0', b.c[0]);
      this.u(P, 'uC1', b.c[1] || [0, 0, 0]);
      this.u(P, 'uC2', b.c[2] || [0, 0, 0]);
      this.u(P, 'uC3', b.c[3] || [0, 0, 0]);
      this.u(P, 'uPhase', b.phase);
      this.u(P, 'uCycles', b.cycles);
      this.u(P, 'uScale', b.scale);
      this.u(P, 'uAngle', b.angle);
      this.u(P, 'uAmt', b.amt);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    if (desc.flare && flareEntries) {
      this.drawFlare(desc, flareEntries);
    } else {
      this.drawCards(desc, entries);
    }

    // Build mip chain for post-processing
    gl.bindTexture(gl.TEXTURE_2D, scene.tex);
    gl.generateMipmap(gl.TEXTURE_2D);

    // Post-processing
    gl.disable(gl.BLEND);
    gl.bindFramebuffer(gl.FRAMEBUFFER, out ? out.fbo : null);
    gl.viewport(0, 0, W, H);
    const P = this.progs.post;
    const p = desc.post;
    gl.useProgram(P.p);
    gl.bindVertexArray(this.full);
    this.bindTex(0, scene.tex);
    this.u(P, 'uScene', { i: 0 });
    this.bindTex(1, this.labelOn && p.labels ? this.label : this.white);
    this.u(P, 'uLabel', { i: 1 });
    this.u(P, 'uLabelOn', this.labelOn && p.labels ? 1 : 0);
    this.u(P, 'uRes', [W, H]);
    this.u(P, 'uSeed', p.seed);
    this.u(P, 'uAlphaOut', b && b.transparent ? 1 : 0);
    for (const k in p.u) this.u(P, k, p.u[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  drawCards(desc: FrameDescriptor, entries: FaceEntry[]): void {
    const gl = this.gl;
    const { W, H } = desc;
    const cam = desc.camera;
    const proj = mat4.perspective(cam.fov, W / H, 0.05, 200);
    const view = lookAt(cam.eye, cam.target || [0, 0, 0], cam.up || [0, 1, 0]);
    const VP = mat4.mul(proj, view);

    // Depth-sort back to front
    const list = desc.cards
      .map((c: CardDesc, i: number) => ({ c, i }))
      .filter(({ c }) => c.opacity > 0.002)
      .map(({ c, i }) => {
        const m = c.m || mat4.model(c.x, c.y, c.z, c.rx, c.ry, c.rz, c.sx, c.sy);
        const w = mat4.transform(view, c.x, c.y, c.z);
        return { c, i, m, depth: w[2] + (c.zBias || 0) };
      })
      .sort((a, b) => a.depth - b.depth);

    const S = this.progs.shadow;
    const C = this.progs.card;
    const E = this.progs.side;
    const sh = desc.shadow;

    gl.bindVertexArray(this.mesh);
    for (const { c, i, m } of list) {
      // Shadow
      if (sh && sh.on && sh.alpha > 0) {
        gl.useProgram(S.p);
        this.u(S, 'uModel', mat4.mul(mat4.translation(0, -sh.offset * c.h * c.sy, -0.01), m));
        this.u(S, 'uVP', VP);
        const soft = sh.soft * c.h;
        this.u(S, 'uSize', [c.w, c.h]);
        this.u(S, 'uExpand', [soft * 1.5, soft * 1.5]);
        this.u(S, 'uBend', c.bend || 0);
        this.u(S, 'uBendY', c.bendY || 0);
        this.u(S, 'uOff', 0);
        this.u(S, 'uRadius', c.radius);
        this.u(S, 'uSoft', soft);
        this.u(S, 'uAlpha', sh.alpha * c.opacity);
        this.u(S, 'uColor', sh.color);
        gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_SHORT, 0);
      }

      // Thick card edges
      let off = 0;
      if (c.thick > 0) {
        const fx = m[8], fy = m[9], fz = m[10];
        const seen = fx * (cam.eye[0] - m[12]) + fy * (cam.eye[1] - m[13]) + fz * (cam.eye[2] - m[14]);
        if (seen < 0) off = -c.thick;
        gl.useProgram(E.p);
        gl.bindVertexArray(this.side);
        this.u(E, 'uModel', m);
        this.u(E, 'uVP', VP);
        this.u(E, 'uCam', cam.eye);
        this.u(E, 'uSize', [c.w, c.h]);
        this.u(E, 'uRadius', c.radius);
        this.u(E, 'uThick', c.thick);
        this.u(E, 'uBend', c.bend || 0);
        this.u(E, 'uBendY', c.bendY || 0);
        this.u(E, 'uEdgeCol', c.edgeCol);
        this.u(E, 'uOpacity', c.opacity);
        this.u(E, 'uBright', c.bright);
        gl.drawArrays(gl.TRIANGLES, 0, this.sideCount);
        gl.bindVertexArray(this.mesh);
      }

      // Card face
      gl.useProgram(C.p);
      const textures = entries[i].tex;
      for (let i = 0; i < 4; i++) {
        this.bindTex(i, textures[i]);
        this.u(C, 'uT' + i, { i });
      }
      this.u(C, 'uModel', m);
      this.u(C, 'uVP', VP);
      this.u(C, 'uCam', cam.eye);
      this.u(C, 'uSize', [c.w, c.h]);
      this.u(C, 'uExpand', [0, 0]);
      this.u(C, 'uBend', c.bend || 0);
      this.u(C, 'uBendY', c.bendY || 0);
      this.u(C, 'uOff', off);
      this.u(C, 'uRadius', c.radius);
      this.u(C, 'uOpacity', c.opacity);
      this.u(C, 'uBlur', c.blur);
      this.u(C, 'uShade', c.shade);
      this.u(C, 'uBorder', c.border);
      this.u(C, 'uGlare', c.glare);
      this.u(C, 'uGlareP', c.glareP);
      this.u(C, 'uBackMix', c.backMix);
      this.u(C, 'uBackCol', c.backCol);
      this.u(C, 'uBright', c.bright);
      this.u(C, 'uTint', c.tint);
      this.u(C, 'uTintA', c.tintA);
      this.u(C, 'uGlassW', c.glassW);
      this.u(C, 'uGlassR', c.glassR);
      this.u(C, 'uGlassD', c.glassD);
      this.u(C, 'uCrumple', c.crumple || 0);
      this.u(C, 'uCrSeed', c.crSeed || 0);
      gl.drawElements(gl.TRIANGLES, this.meshCount, gl.UNSIGNED_SHORT, 0);
    }
    gl.bindVertexArray(null);
  }

  drawFlare(desc: FrameDescriptor, faces: [FaceEntry, FaceEntry]): void {
    const gl = this.gl;
    const F = this.progs.flare;
    const f = desc.flare!;
    gl.useProgram(F.p);
    gl.bindVertexArray(this.full);
    const names = ['uTexA0', 'uTexA1', 'uTexA2', 'uTexA3', 'uTexB0', 'uTexB1', 'uTexB2', 'uTexB3'];
    for (let i = 0; i < 4; i++) {
      this.bindTex(i, faces[0].tex[i]);
      this.bindTex(4 + i, faces[1].tex[i]);
    }
    names.forEach((n, i) => this.u(F, n, { i }));
    this.u(F, 'uRes', [desc.W, desc.H]);
    for (const k in f.u) this.u(F, k, f.u[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  // Render to offscreen buffer and read back (thumbnails, image export)
  snapshot(desc: FrameDescriptor): ImageData {
    const gl = this.gl;
    const { W, H } = desc;
    const t = this.target('snap-' + W + 'x' + H, W, H);
    this.render(desc, t);
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const img = new ImageData(W, H);
    const row = W * 4;
    for (let y = 0; y < H; y++) {
      const src = (H - 1 - y) * row;
      for (let i = 0; i < row; i += 4) {
        const a = px[src + i + 3];
        const k = a ? 255 / a : 0;
        img.data[y * row + i] = Math.min(255, px[src + i] * k);
        img.data[y * row + i + 1] = Math.min(255, px[src + i + 1] * k);
        img.data[y * row + i + 2] = Math.min(255, px[src + i + 2] * k);
        img.data[y * row + i + 3] = a;
      }
    }
    return img;
  }

  /** Free every GPU object this renderer made. */
  dispose(): void {
    const gl = this.gl;
    this.faces.forEach(e => e.tex.forEach(t => gl.deleteTexture(t)));
    this.faces.clear();
    this.live.clear();
    this.targets.forEach(t => {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    });
    this.targets.clear();
    gl.deleteTexture(this.label);
    gl.deleteTexture(this.white);
    this.buffers.forEach(b => gl.deleteBuffer(b));
    this.buffers = [];
    gl.deleteVertexArray(this.full);
    gl.deleteVertexArray(this.mesh);
    gl.deleteVertexArray(this.side);
    Object.values(this.progs).forEach(p => gl.deleteProgram(p.p));
  }

  /**
   * Forget everything without touching the GL context. Used after a context loss,
   * when every object is already gone and deleting them would only raise errors.
   */
  abandon(): void {
    this.faces.clear();
    this.live.clear();
    this.targets.clear();
    this.buffers = [];
  }
}
