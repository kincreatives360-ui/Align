// Flare Duo: the flaring glass-edge card transition, with motion traced frame by frame from the reference video.
import { clamp01, sstep, wrap } from './math.js';

// edge position per 60fps frame (px on a 1600-wide canvas, card spans 80..1520)
const REF_PX = [50, 53, 60, 71, 88, 114, 145, 183, 227, 277, 332, 390, 451, 512, 572, 630, 685, 738, 792, 848, 904, 960, 1020, 1082,
  1144, 1205, 1264, 1320, 1370, 1414, 1452, 1484, 1508, 1520, 1526, 1527, 1525, 1522, 1520];
// the recording has frame-timing jitter, so smooth the speed before integrating it back
const REF = (() => {
  let v = REF_PX.slice(1).map((x, i) => x - REF_PX[i]);
  const k = [1, 4, 6, 4, 1];
  for (let pass = 0; pass < 3; pass++)
    v = v.map((_, i) => { let s = 0, w = 0; k.forEach((kw, j) => { const n = i + j - 2; if (n >= 0 && n < v.length){ s += v[n] * kw; w += kw; } }); return s / w; });
  const pos = [REF_PX[0]]; v.forEach(d => pos.push(pos[pos.length - 1] + d));
  const end = pos[pos.length - 1], scale = (REF_PX[REF_PX.length - 1] - REF_PX[0]) / (end - REF_PX[0]);
  return pos.map(x => (REF_PX[0] + (x - REF_PX[0]) * scale - 80) / 1440);
})();
function refCurve(u){
  const f = clamp01(u) * (REF.length - 1), i = Math.min(REF.length - 2, Math.floor(f)), t = f - i;
  const p0 = REF[Math.max(0, i - 1)], p1 = REF[i], p2 = REF[i + 1], p3 = REF[Math.min(REF.length - 1, i + 2)];
  return p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
}
const CURVES = {
  reference: refCurve,
  sine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  cubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  quint: t => t < .5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  expo: t => t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  linear: t => t,
};
const landCache = new Map();
function landFrac(name, ease){
  if (landCache.has(name)) return landCache.get(name);
  let f = 1; for (let i = 0; i <= 200; i++) if (ease(i / 200) >= .995){ f = i / 200; break; }
  landCache.set(name, f); return f;
}

export const FLARE_PARAMS = [
  {key: 'count', label: 'Cards', type: 'range', min: 2, max: 30, step: 1},
  {key: 'width', label: 'Card width', type: 'range', min: .4, max: 1, step: .005, def: .9},
  {key: 'speed', label: 'Speed', type: 'range', min: .25, max: 2.5, step: .01, def: 1},
  {key: 'fdir', label: 'Direction', type: 'seg', options: {'1': 'Left → right', '-1': 'Right → left'}, def: '1'},
  {group: 'Timing'},
  {key: 'hold', label: 'Still hold', type: 'range', min: 0, max: 4, step: .01, def: .27, unit: 's'},
  {key: 'antic', label: 'Wind-up', type: 'range', min: 0, max: 1, step: .01, def: .3, unit: 's'},
  {key: 'sweep', label: 'Sweep', type: 'range', min: .2, max: 2, step: .01, def: .633, unit: 's'},
  {key: 'settle', label: 'Settle', type: 'range', min: 0, max: 1.2, step: .01, def: .3, unit: 's'},
  {key: 'curve', label: 'Sweep curve', type: 'select', options: {reference: 'Reference (traced)', sine: 'Gentle', cubic: 'Smooth', quint: 'Snappy', expo: 'Expo', linear: 'Linear'}, def: 'reference'},
  {group: 'Flaring edge'},
  {key: 'peak', label: 'Peak height', type: 'range', min: 0, max: 1.2, step: .01, def: .55},
  {key: 'edge', label: 'Edge height', type: 'range', min: 0, max: 1, step: .01, def: .28},
  {key: 'spread', label: 'Flare width', type: 'range', min: .01, max: .3, step: .005, def: .095},
  {key: 'handoff', label: 'Hand-off', type: 'range', min: .02, max: .3, step: .01, def: .16},
  {key: 'pinch', label: 'Mid pinch', type: 'range', min: 0, max: .95, step: .01, def: .35},
  {key: 'rim', label: 'Glass rim', type: 'range', min: 0, max: 60, step: 1, def: 28, unit: 'px'},
  {key: 'edgeShadow', label: 'Edge shadow', type: 'range', min: 0, max: 2, step: .05, def: .8},
  {group: 'Lens blur'},
  {key: 'fblur', label: 'Blur', type: 'range', min: 0, max: 96, step: 1, def: 95, unit: 'px'},
  {key: 'blurSpread', label: 'Blur reach', type: 'range', min: .03, max: .6, step: .01, def: .13},
  {key: 'chroma', label: 'Colour split', type: 'range', min: 0, max: 1.5, step: .01, def: .5},
];
export function flareDefaults(n){
  const P = {count: n};
  FLARE_PARAMS.forEach(p => { if (p.key && p.def !== undefined) P[p.key] = p.def; });
  return P;
}
const segLen = P => P.hold + P.antic + P.sweep + P.settle;
export const flareDuration = (P, n) => Math.max(.01, segLen(P) * n);

const STILL = {w: 1.0001, ampO: 0, ampN: 0, spO: .09, spN: .09, blurO: 0, blurN: 0, rimO: 0, rimN: 0, newTop: 1, mix: 1};
function motionAt(P, tt){
  const Ta = P.antic, Ts = P.sweep, Tr = P.settle, ease = CURVES[P.curve] || refCurve;
  const ant0 = Ta > 0 ? sstep(0, Ta, tt) : 1;
  const p = tt < Ta ? ease(0) * ant0 : ease(clamp01((tt - Ta) / Ts));
  const pc = clamp01(p);
  // wind-up growth eases out after the sweep starts, so the flare never stops growing mid-turn
  const ant = sstep(0, Ta + Ts * .25, tt);
  // the settle starts the moment the edge lands
  const since = tt - (Ta + Ts * landFrac(P.curve, ease));
  const rel = Tr > 0 ? clamp01(since / Tr) : (since >= 0 ? 1 : 0);
  const decay = Math.pow(1 - sstep(0, 1, rel), 1.3);
  const A = P.edge + (P.peak - P.edge) * Math.sin(Math.PI * pc);
  // the flare flows from the old card to the new one through the middle
  const X = sstep(.5 - P.handoff, .5 + P.handoff, pc);
  const pinch = 1 - P.pinch * Math.exp(-Math.pow((pc - .5) / .14, 2));
  return {
    w: p, ampO: A * ant * (1 - X), ampN: A * X * decay,
    spO: P.spread * (1.3 + (.8 - 1.3) * sstep(.2, .5, pc)) * pinch,
    spN: P.spread * (.8 + .2 * sstep(.5, 1, pc)) * pinch * (1 + .6 * sstep(0, Tr * .5, since)),
    blurO: P.fblur * sstep(0, Ta * .5, tt) * (1 - sstep(.35, .62, pc)),
    blurN: P.fblur * sstep(.38, .65, pc) * (1 - sstep(-.05, Tr, since)),
    rimO: sstep(Ta * .7, Ta + Ts * .12, tt) * (1 - X), rimN: X * (1 - sstep(-.02, .2, since)),
    newTop: X >= .5 ? 1 : 0, mix: sstep(Ta * .5, Ta + Ts + Tr * .4, tt),
  };
}
// which two cards are on screen and how far the transition between them has got
export function flareState(P, n, T){
  const seg = segLen(P), total = seg * n;
  T = wrap(T, total);
  const idx = Math.min(n - 1, Math.floor(T / seg)), lt = T - idx * seg;
  if (n < 2 || lt < P.hold) return {a: idx, b: idx, m: STILL};
  return {a: idx, b: (idx + 1) % n, m: motionAt(P, lt - P.hold)};
}
// card rectangle in output px for a frame of W×H
export function flareRect(P, W, H, aspect){
  const cw = Math.min(P.width * W, P.width / .9 * .7 * H * aspect), ch = cw / aspect;
  return {cw, ch};
}
export function flareUniforms(P, m, W, H, rect, style, blurFracs){
  const res = W / 1600, {cw, ch} = rect;
  return {
    uC: [W / 2, H / 2], uH: [cw / 2, ch / 2], uR: style.card.radius * Math.min(cw, ch),
    uW: m.w, uDir: Number(P.fdir), uShadow: style.shadow.on ? style.shadow.alpha / .3 * .3 : 0,
    uBorder: style.card.border, uEdgeSh: P.edgeShadow, uChroma: P.chroma, uBlurSp: P.blurSpread, uRim: P.rim * res, uNewTop: m.newTop,
    uAmpO: m.ampO, uSpO: m.spO, uBlurO: m.blurO * res, uRimO: m.rimO,
    uAmpN: m.ampN, uSpN: m.spN, uBlurN: m.blurN * res, uRimN: m.rimN,
    uLv: blurFracs.map(f => f * cw),
  };
}
