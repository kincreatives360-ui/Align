import type { ProjectState, FrameBackground, CameraDesc, CardDesc, ShadowDesc, PostDesc, FaceRef } from '../state/types';
import { byId } from '../templates/registry';
import { clipInfo, wrapTime } from './timing';
import { buildCamera, computeViewExtents } from './camera';
import { deterministicRnd } from './random';
import { mat4, TAU, D2R, wrap, clamp01, ease, hexToRgb } from './math';
import {
  groupMatrix,
  bendFor,
  animOrder,
  applyAnimIn,
  applyTilt,
  applyShape,
  applySpin,
  applyWave,
  applyDisplacement,
} from './layout';
import { bgDesc } from './media';

/** The complete frame descriptor returned by buildFrame. */
export interface FrameDescriptor {
  W: number;
  H: number;
  bg: FrameBackground | null;
  camera: CameraDesc;
  cards: CardDesc[];
  shadow: ShadowDesc | null;
  flare: any | null;
  post: PostDesc;
}

/** Build a frame descriptor from project state and time. */
export function buildFrame(
  state: ProjectState,
  clipTime: number,
  width: number,
  height: number,
  opts: { rate?: number; thumb?: boolean; resBoost?: number } = {}
): FrameDescriptor {
  const template = byId(state.templateId);
  const P = state.params;
  const style = state.style;

  const desc: FrameDescriptor = {
    W: width,
    H: height,
    bg: null,
    camera: null,
    cards: [],
    shadow: null,
    flare: null,
    post: null,
  };

  // Get clip info for seamless looping
  const clip = clipInfo({ template, params: P, export: state.export });
  const rate = opts.rate ?? clip.rate;

  // T is clip time; motion runs at seamless-loop rate on top of template speed
  const Tc = clipTime;
  const T = clipTime * rate;
  const T2 = T * (P.speed || 1);

  // Handle flare template separately (placeholder for now)
  if (template.kind === 'flare') {
    // TODO: Implement flare template
    desc.bg = bgDesc(style, 0);
    desc.post = postDesc(style, 0, Tc, opts.thumb ?? false);
    return desc;
  }

  // Card count
  const n = template.fixedN ? template.n : Math.max(1, Math.round(P.count || template.n));

  // Loop phase
  let p = wrapTime(T2 / durationRef(template, P), 1);
  if (String(P.dir) === '-1') p = wrap(1 - p, 1);

  // Easing > Stepped: continuous templates can hold on each step
  if (!template.step && P.motion === 'stepped') {
    const k = Math.round(P.steps) || n;
    const hold = P.hold ?? 0.5;
    const ez = ease[P.ease as keyof typeof ease] || ease.inOutQuint;
    const c = p * k;
    const f = c - Math.floor(c);
    p = wrap((Math.floor(c) + ez(clamp01((f - hold) / Math.max(1e-3, 1 - hold)))) / k, 1);
  }

  // Background
  desc.bg = bgDesc(style, p);

  // Camera
  const aspect = width / height;
  desc.camera = buildCamera(state, template, aspect, p);

  // View extents for layout
  const { vx, vy } = computeViewExtents(desc.camera, P, aspect, template);

  // Deterministic RNG
  const seed = state.media.seed || 1;
  const rnd = deterministicRnd(seed);

  // Env for template layout
  const cardAspect = cardAspectForState(state, template);
  const h = (template.cardH || 0.8) * (P.size || 1);
  const w = h * cardAspect;
  const D = 1 / Math.tan(desc.camera.fov / 2);
  const gs = Math.abs(P.scale ?? 1) || 1;
  const Dz = Math.hypot(desc.camera.eye[0], desc.camera.eye[1], desc.camera.eye[2]) || D;

  const E: Env = {
    p,
    n,
    asp: aspect,
    w,
    h,
    D,
    vx,
    vy,
    rnd,
    ez: ease[P.ease as keyof typeof ease] || ease.inOutQuint,
    hold: P.hold ?? 0.5,
    m: n,
  };

  // Template may provide its own camera
  const c0 = template.camera ? template.camera(P, E) : {};

  // Group matrix (pose/transform/pan)
  const G = groupMatrix(P, p);

  // Animation in order
  const anim = P.animIn ? animOrder(P, n, E) : null;
  const aEase = ease[P.animEase as keyof typeof ease] || ease.outQuint;

  // Media order
  const order = orderFor(state, n);

  // Texture resolution
  const res = opts.thumb
    ? 192
    : quantRes(Math.max(w, h) * height / 2 * (template.resBoost || 1.3) * (opts.resBoost || 1));

  // Style shortcuts
  const sc = style.card;
  const sh = style.shade;
  const sd = style.shadow;
  const cg = style.cardGlass;

  // Focus distance for depth of field
  const focusDist = Math.hypot(
    desc.camera.eye[0] - desc.camera.target[0],
    desc.camera.eye[1] - desc.camera.target[1],
    desc.camera.eye[2] - desc.camera.target[2]
  ) + (style.blur.focus || 0);

  // Template may add extra cards via fill
  let N = n;
  if (template.fill) {
    const F = template.fill(P, E);
    Object.assign(E, F);
    N = F.count ?? n;
  }

  // Build each card
  for (let i = 0; i < N; i++) {
    const L = template.layout(i, P, E) || {};
    const ai = L.aspect || cardAspect;
    const hi = L.h || h;
    const wi = L.w || hi * ai;

    // Card identity for media assignment
    const k = L.img ?? i % n;

    // Base transform from layout
    let M0 = L.m || mat4.model(
      L.x || 0, L.y || 0, L.z || 0,
      L.rx || 0, L.ry || 0, L.rz || 0,
      1, 1
    );

    let sc0 = L.s ?? 1;
    let o0 = (L.o ?? 1) * (P.fade ?? 1);
    let blur0 = L.blur || 0;

    const px = M0[12];
    const py = M0[13];
    const pz = M0[14];

    // Displacement
    const disp = applyDisplacement(P, p, k);
    blur0 += 0; // displacement doesn't add blur

    // Wave
    const waveResult = applyWave(P, px, py, p, k);

    // Animation in
    let local: Float32Array | null = null;
    let ay = 0;
    let dz = 0;
    if (anim) {
      const animResult = applyAnimIn(P, k, Tc, n, E, o0, blur0, sc0);
      o0 = animResult.o0;
      blur0 = animResult.blur0;
      ay += animResult.ay;
      dz += animResult.dz;
      local = animResult.local;
      sc0 = animResult.sc0;
    }

    // Tilt
    const tilt = applyTilt(P, k, E, p);

    // Shape
    const shape = applyShape(P, k, n, h);
    if (shape.sY || shape.sZ) {
      M0 = mat4.mul(M0, mat4.translation(0, shape.sY, shape.sZ));
    }

    // Spin
    const spin = applySpin(P, k, p);
    const tx = tilt.tx;
    const ty = tilt.ty + spin;
    const tz = tilt.tz;
    if (tx || ty || tz) {
      M0 = mat4.mul(M0, mat4.model(0, 0, 0, tx * D2R, ty * D2R, tz * D2R, 1, 1));
    }

    // Local transform (from animIn spin)
    if (local) M0 = mat4.mul(M0, local);

    // Scale
    if (sc0 !== 1) M0 = mat4.mul(M0, mat4.scaling(sc0, sc0, 1));

    // Wave tilt (pivots each card about its own centre)
    if (waveResult.wave) {
      M0 = mat4.mul(
        mat4.translation(px, py, pz),
        mat4.mul(waveResult.wave, mat4.mul(mat4.translation(-px, -py, -pz), M0))
      );
    }

    // Displacement offset
    dz += disp.dz + waveResult.dz;
    ay += disp.ay + waveResult.ay;
    if (dz || ay) M0 = mat4.mul(mat4.translation(0, ay, dz), M0);

    // Apply group matrix
    const m = G ? mat4.mul(G, M0) : M0;

    const cx = m[12];
    const cy = m[13];
    const cz = m[14];

    // Depth of field blur
    const dist = Math.hypot(
      desc.camera.eye[0] - cx,
      desc.camera.eye[1] - cy,
      desc.camera.eye[2] - cz
    );
    const dBlur = style.blur.on ? style.blur.depth * Math.abs(dist - focusDist) * 0.45 : 0;

    // Bend
    const bend = bendFor(P, L, p, k);

    // Glare phase
    const glareP = L.glareP ?? (wrap(p, 1) * 2.8 - 0.8);

    // Card descriptor
    desc.cards.push({
      m,
      x: cx,
      y: cy,
      z: cz,
      rx: 0,
      ry: 0,
      rz: 0,
      sx: 1,
      sy: 1,
      w: wi,
      h: hi,
      ...bend,
      zBias: L.zBias || 0,
      thick: (P.thick || 0) * Math.min(wi, hi),
      edgeCol: hexToRgb(P.edgeCol || '#ffffff'),
      face: { key: '', aspect: ai, res: 0, kind: 'image' }, // placeholder, filled by renderer
      radius: sc.radius * Math.min(wi, hi),
      opacity: o0 * sc.opacity,
      blur: clamp01(blur0 + dBlur),
      shade: sh.on ? sh.amount : 0,
      border: sc.border,
      glare: ((L.glare || 0) + (sh.on && sh.sweep ? 0.35 : 0)) * (sh.on ? sh.glare : 0),
      glareP,
      backMix: sc.back === 'solid' ? 0 : 1,
      backCol: hexToRgb(sc.backColor),
      bright: (L.b ?? 1) * sc.brightness,
      tint: hexToRgb(sc.tint),
      tintA: sc.tintA,
      glassW: cg.on ? cg.width : 0,
      glassR: cg.refraction,
      glassD: cg.dispersion,
      crumple: L.crumple || 0,
      crSeed: L.crSeed ?? (k * 0.6180339 % 1),
    });
  }

  // Shadow
  desc.shadow = {
    on: sd.on,
    alpha: sd.alpha,
    soft: sd.soft,
    offset: sd.offset,
    color: hexToRgb(sd.color),
  };

  // Post-processing
  desc.post = postDesc(style, p, Tc, opts.thumb ?? false);

  return desc;
}

/** Template base duration in seconds. */
function durationRef(t: { dur?: number; step?: boolean; perCard?: number; fixedN?: boolean; n: number }, P: Record<string, any>): number {
  if (t.step) {
    const n = t.fixedN ? t.n : (P.count as number ?? t.n);
    const per = t.perCard ?? 1.4;
    return per * n;
  }
  return t.dur ?? 10;
}

/** Card aspect from state or template. */
function cardAspectForState(state: ProjectState, template: { aspect: number }): number {
  const a = state.style.card.aspect;
  if (!a || a === 'auto') return template.aspect;
  const [x, y] = a.split(':').map(Number);
  return x / y;
}

/** Media order (in-order or shuffled). */
function orderFor(state: ProjectState, n: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (state.media.order === 'shuffle') {
    const R = mulberry(state.media.seed || 1);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(R() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
  }
  return idx;
}

/** Quantize texture resolution to a ladder. */
const RES_STEPS = [192, 256, 384, 512, 768, 1024, 1536, 2048, 3072];
function quantRes(px: number): number {
  return RES_STEPS.find(r => r >= px) || 3072;
}

/** Background descriptor. */
function bgDesc(style: any, phase: number): FrameBackground {
  const b = style.bg;
  const BG_MODES: Record<string, number> = {
    solid: 0, linear: 1, radial: 2, mesh: 3, aurora: 4,
    grid: 5, dots: 6, holo: 7, spotlight: 8, plasma: 9,
  };
  return {
    mode: BG_MODES[b.mode] ?? 0,
    c: b.c.map(hexToRgb),
    phase,
    cycles: Math.max(1, Math.round(b.cycles || 1)),
    scale: b.scale ?? 1,
    angle: (b.angle ?? 34) * D2R,
    amt: b.amt ?? 1,
    transparent: !!b.transparent,
  };
}

/** Post-processing descriptor. */
function postDesc(style: any, phase: number, T: number, thumb: boolean): PostDesc {
  const g = style.glass;
  const L = style.lens;
  const fx = style.fx;

  const edges = !g.on
    ? [0, 0, 0, 0]
    : g.mode === 'all'
      ? [g.amount, g.amount, g.amount, g.amount]
      : [g.top, g.bottom, g.left, g.right];

  const shape = L.shape === 'circle'
    ? [L.w, L.w, 1]
    : L.shape === 'square'
      ? [L.w, L.h, 0.35]
      : [L.w, L.h, 1];

  // Lens center with motion
  let lx = L.x;
  let ly = L.y;
  if (L.motion === 'drift') {
    lx += Math.sin(phase * TAU) * 0.12;
    ly += Math.cos(phase * TAU) * 0.06;
  }
  if (L.motion === 'sweep') lx = 0.5 + Math.sin(phase * TAU) * 0.3;
  if (L.motion === 'orbit') {
    lx = 0.5 + Math.cos(phase * TAU) * 0.22;
    ly = 0.5 + Math.sin(phase * TAU) * 0.18;
  }

  const bgC0 = style.bg.c[0];
  const bgTransparent = style.bg.transparent;

  return {
    labels: !thumb && (style.labels.on || style.title?.on || style.logo?.on),
    seed: Math.floor(T * 60) % 997,
    u: {
      uEdge: edges,
      uEW: g.width,
      uER: g.refraction,
      uED: g.dispersion,
      uES: g.soften,
      uEF: g.feather,
      uEH: g.highlight,
      uEB: g.bulge ?? 0.35,
      uEX: g.stretch ?? 0,
      uEdgeTint: bgTransparent ? [1, 1, 1] : hexToRgb(bgC0),
      uECurve: { i: { panel: 0, lens: 1, wave: 2 }[g.curve] ?? 0 },
      uLensOn: L.on ? 1 : 0,
      uLensMode: { i: L.mode === 'hole' ? 1 : 0 },
      uLensC: [lx, 1 - ly],
      uLensS: [shape[0] / 2, shape[1] / 2],
      uLensR: shape[2],
      uLensRef: L.refraction,
      uLensFrost: L.frost,
      uLensDisp: L.dispersion,
      uLensBevel: L.bevel,
      uLensHi: L.highlight,
      uLensMag: L.magnify,
      uLensShadow: L.shadow,
      uLensTint: hexToRgb(L.tint),
      uLensTintA: L.tintA,
      uGrain: fx.grain,
      uVig: fx.vignette,
      uBloom: fx.bloom,
      uChroma: fx.chroma,
      uContrast: fx.contrast,
      uSat: fx.saturation,
      uExposure: fx.exposure,
      uEdgeBlur: style.blur.on ? style.blur.edge : 0,
    },
  };
}

/** Mulberry32 PRNG. */
function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}