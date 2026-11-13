import { clamp01, wrap } from '../engine/math';
import { bgDesc } from './media';
import { buildCamera } from './camera';
import { postDesc } from './buildFrame';

/** Reference edge position curve from traced video. */
const REF_PX = [
  50, 53, 60, 71, 88, 114, 145, 183, 227, 277, 332, 390, 451, 512, 572, 630,
  685, 738, 792, 848, 904, 960, 1020, 1082, 1144, 1205, 1264, 1320, 1370,
  1414, 1452, 1484, 1508, 1520, 1526, 1527, 1525, 1522, 1520,
];

function makeRefCurve() {
  let v = REF_PX.slice(1).map((x, i) => x - REF_PX[i]);
  const k = [1, 4, 6, 4, 1];
  for (let pass = 0; pass < 3; pass++) {
    v = v.map((_, i) => {
      let s = 0, w = 0;
      k.forEach((kw, j) => {
        const n = i + j - 2;
        if (n >= 0 && n < v.length) { s += v[n] * kw; w += kw; }
      });
      return s / w;
    });
  }
  const pos = [REF_PX[0]];
  v.forEach(d => pos.push(pos[pos.length - 1] + d));
  const end = pos[pos.length - 1];
  const scale = (REF_PX[REF_PX.length - 1] - REF_PX[0]) / (end - REF_PX[0]);
  return pos.map(x => (REF_PX[0] + (x - REF_PX[0]) * scale - 80) / 1440);
}

const REF = makeRefCurve();

function refCurve(u: number): number {
  const f = clamp01(u) * (REF.length - 1);
  const i = Math.min(REF.length - 2, Math.floor(f));
  const t = f - i;
  const p0 = REF[Math.max(0, i - 1)];
  const p1 = REF[i];
  const p2 = REF[i + 1];
  const p3 = REF[Math.min(REF.length - 1, i + 2)];
  return p1 + 0.5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}

const CURVES: Record<string, (t: number) => number> = {
  reference: refCurve,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  cubic: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  quint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  expo: t => t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  linear: t => t,
};

const landCache = new Map<string, number>();

function landFrac(name: string, ease: (t: number) => number): number {
  if (landCache.has(name)) return landCache.get(name)!;
  let f = 1;
  for (let i = 0; i <= 200; i++) if (ease(i / 200) >= 0.995) { f = i / 200; break; }
  landCache.set(name, f);
  return f;
}

const STILL = { w: 1.0001, ampO: 0, ampN: 0, spO: 0.09, spN: 0.09, blurO: 0, blurN: 0, rimO: 0, rimN: 0, newTop: 1, mix: 1 };

function sstep(e: number, e2: number, t: number): number {
  if (e === e2) return t >= e ? 1 : 0;
  return clamp01((t - e) / (e2 - e));
}

function segLen(P: Record<string, any>): number {
  return numOr(P.hold, 0) + numOr(P.antic, 0) + numOr(P.sweep, 0) + numOr(P.settle, 0);
}

function motionAt(P: Record<string, any>, tt: number) {
  const Ta = numOr(P.antic, 0);
  const Ts = numOr(P.sweep, 0);
  const Tr = numOr(P.settle, 0);
  const ease = CURVES[String(P.curve)] || refCurve;
  const ant0 = Ta > 0 ? sstep(0, Ta, tt) : 1;
  const p = tt < Ta ? ease(0) * ant0 : ease(clamp01((tt - Ta) / Ts));
  const pc = clamp01(p);
  const ant = sstep(0, Ta + Ts * 0.25, tt);
  const since = tt - (Ta + Ts * landFrac(String(P.curve), ease));
  const rel = Tr > 0 ? clamp01(since / Tr) : (since >= 0 ? 1 : 0);
  const decay = Math.pow(1 - sstep(0, 1, rel), 1.3);
  const A = numOr(P.edge, 0) + (numOr(P.peak, 0) - numOr(P.edge, 0)) * Math.sin(Math.PI * pc);
  const X = sstep(0.5 - numOr(P.handoff, 0), 0.5 + numOr(P.handoff, 0), pc);
  const pinch = 1 - numOr(P.pinch, 0) * Math.exp(-Math.pow((pc - 0.5) / 0.14, 2));
  return {
    w: p,
    ampO: A * ant * (1 - X),
    ampN: A * X * decay,
    spO: numOr(P.spread, 0) * (1.3 + (0.8 - 1.3) * sstep(0.2, 0.5, pc)) * pinch,
    spN: numOr(P.spread, 0) * (0.8 + 0.2 * sstep(0.5, 1, pc)) * pinch * (1 + 0.6 * sstep(0, Tr * 0.5, since)),
    blurO: numOr(P.fblur, 0) * sstep(0, Ta * 0.5, tt) * (1 - sstep(0.35, 0.62, pc)),
    blurN: numOr(P.fblur, 0) * sstep(0.38, 0.65, pc) * (1 - sstep(-0.05, Tr, since)),
    rimO: sstep(Ta * 0.7, Ta + Ts * 0.12, tt) * (1 - X),
    rimN: X * (1 - sstep(-0.02, 0.2, since)),
    newTop: X >= 0.5 ? 1 : 0,
    mix: sstep(Ta * 0.5, Ta + Ts + Tr * 0.4, tt),
  };
}

function flareState(P: Record<string, any>, n: number, T: number) {
  const seg = segLen(P);
  const total = seg * n;
  T = wrap(T, total);
  const idx = Math.min(n - 1, Math.floor(T / seg));
  const lt = T - idx * seg;
  if (n < 2 || lt < numOr(P.hold, 0)) return { a: idx, b: idx, m: STILL };
  return { a: idx, b: (idx + 1) % n, m: motionAt(P, lt - numOr(P.hold, 0)) };
}

function flareRect(P: Record<string, any>, W: number, H: number, aspect: number) {
  const cw = Math.min(numOr(P.width, 0.9) * W, numOr(P.width, 0.9) / 0.9 * 0.7 * H * aspect);
  const ch = cw / aspect;
  return { cw, ch };
}

function flareUniforms(
  P: Record<string, any>,
  m: any,
  W: number,
  H: number,
  rect: { cw: number; ch: number },
  style: any,
  blurFracs: number[]
) {
  const res = W / 1600;
  const { cw, ch } = rect;
  return {
    uC: [W / 2, H / 2],
    uH: [cw / 2, ch / 2],
    uR: style.card.radius * Math.min(cw, ch),
    uW: m.w,
    uDir: Number(P.fdir),
    uShadow: style.shadow.on ? style.shadow.alpha / 0.3 * 0.3 : 0,
    uBorder: style.card.border,
    uEdgeSh: numOr(P.edgeShadow, 0),
    uChroma: numOr(P.chroma, 0),
    uBlurSp: numOr(P.blurSpread, 0),
    uRim: numOr(P.rim, 0) * res,
    uNewTop: m.newTop,
    uAmpO: m.ampO,
    uSpO: m.spO,
    uBlurO: m.blurO * res,
    uRimO: m.rimO,
    uAmpN: m.ampN,
    uSpN: m.spN,
    uBlurN: m.blurN * res,
    uRimN: m.rimN,
    uLv: blurFracs.map(f => f * cw),
  };
}

function numOr(v: unknown, def: number): number {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

export function buildFlare(
  state: any,
  template: any,
  clipTime: number,
  width: number,
  height: number,
  style: any,
  clipRate: number
) {
  const P = state.params;
  const T = clipTime * clipRate;
  const T2 = T * (numOr(P.speed, 1) || 1);

  const n = template.fixedN ? template.n : Math.max(1, Math.round(numOr(P.count, template.n) || template.n));
  const fs = flareState(P, n, T2);

  const rect = flareRect(P, width, height, width / height);
  const blurFracs = [0.25, 0.5, 0.75, 1.0]; // 4 mip levels
  const u = flareUniforms(P, fs.m, width, height, rect, style, blurFracs);

  const a = state.media.images[fs.a] || null;
  const b = state.media.images[fs.b] || null;

  const aspect = width / height;
  const camera = buildCamera(state, template, aspect, 0);
  const bg = bgDesc(style, 0);
  const post = postDesc(style, 0, clipTime, false);

  return {
    W: width,
    H: height,
    bg,
    camera,
    cards: [],
    shadow: null,
    flare: {
      a: a ? { key: a.id, aspect: a.width / a.height, res: 1024, kind: a.kind, img: a.id } : null,
      b: b ? { key: b.id, aspect: b.width / b.height, res: 1024, kind: b.kind, img: b.id } : null,
      u,
      rect,
      fs,
    },
    post,
  };
}