import type { Template, Env, P, CardPose } from '../types';
import type { StyleTree } from '../../state/types';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl, ReferenceSelectControl, ReferenceToggleControl } from '../referenceControls';
import { ab, clamp01, ease, fillSlots, laneFill, lerp, M, num, RX, RZ, stepU, str, TAU, T, tiltPt, wrap } from '../kit';
import { fanLayout, masonryFill, masonryLayout, tiltGridFill, tiltGridLayout } from '../layouts';

type GlassStyle = Partial<StyleTree['glass']>;
type StackEnv = Env & { cols?: number; base?: number; pitch?: number; mc?: number };
const PI = Math.PI;
const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const select = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSelectControl => ({ key, label, type: 'select', options, def });
const toggle = (key: string, label: string, def: boolean): ReferenceToggleControl => ({ key, label, type: 'toggle', def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
const sstep = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const glassStyle = (edges: GlassStyle, extra: GlassStyle = {}) => ({ glass: { on: true, mode: 'per' as const, amount: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0.28, refraction: 0.62, stretch: 0, bulge: 0.4, curve: 'panel' as const, dispersion: 0.7, soften: 0.45, feather: 0, highlight: 0.32, ...edges, ...extra } });
const stackCamera = (P: P, E: Env) => ({ eye: [0, num(P.tilt) * 3, E.D + 0.8] as [number, number, number], target: [0, 0, 0] as [number, number, number] });

function stackShuffleLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, u = stepU(E.p, n, E.hold, E.ez), delta = i - u, r = ab(delta);
  const j1 = (E.rnd(i, 3) - 0.5) * num(P.scatter), j2 = (E.rnd(i, 4) - 0.5) * num(P.scatter);
  const slot = (rr: number) => ({ x: rr * E.w * 0.07 * num(P.spread, 1) + j1 * E.w * 0.15, y: rr * E.h * 0.04 * num(P.spread, 1) + j2 * E.h * 0.1, z: -rr * num(P.deckDepth, 0.22), s: 1 - rr * num(P.shrink, 0.05), b: 1 - rr * num(P.deckShade, 0.1), rz: rr * num(P.fanAngle) * 0.06 + j2 * 0.25, blur: rr * num(P.deckBlur) * 0.15 });
  if (delta < 0 && delta > -1) {
    const q = -delta, from = slot(0), to = slot(n - 1), w = Math.sin(q * PI);
    return { x: lerp(from.x, to.x, q) + w * E.w * num(P.throwX, 1.05), y: lerp(from.y, to.y, q) + w * E.h * 0.5 * num(P.throwLift), z: lerp(from.z, to.z, q), s: lerp(from.s, to.s, q), rz: lerp(from.rz, to.rz, q) + w * num(P.throwSpin, 0.12), b: lerp(1, to.b, q), blur: lerp(from.blur, to.blur, q), zBias: q < 0.5 ? 2 : 0, o: lerp(1, clamp01(5.5 - (n - 1)), sstep(0.5, 1, q)) };
  }
  return { ...slot(r), o: clamp01(5.5 - r) };
}
function cardDropLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, u = stepU(E.p, n, E.hold, ease.linear), r = wrap(i - u + 1, n) - 1;
  const rz0 = (E.rnd(i, 1) - 0.5) * 0.5 * num(P.mess, 0.5), x0 = (E.rnd(i, 2) - 0.5) * 0.3 * num(P.mess, 0.5);
  if (r > 0) {
    const q = clamp01(1 - r), land = ease[str(P.land, 'outBack') as keyof typeof ease] ?? ease.outBack, e = land(q), d = (1 - e) * num(P.height, 2.6), from = str(P.from, 'top'), sx = from === 'left' ? -1 : from === 'right' ? 1 : 0;
    return { y: sx ? 0 : d, x: x0 + sx * d * 1.4, rz: rz0 + (1 - q) * num(P.spinIn, 0.6) * (sx || 1), o: r < 1 ? 1 : 0, zBias: 3, s: 1 + (1 - q) * num(P.zoomIn, 0.1) };
  }
  const d = -r;
  return { x: x0 + d * num(P.slide) * E.w * 0.6, y: -d * 0.012 * num(P.pile, 1), z: -d * 0.03 * num(P.pile, 1), rz: rz0, o: d < 7 ? 1 : clamp01(8 - d), b: 1 - Math.min(0.3, d * num(P.dim, 0.04)) };
}
function riffleLayout(i: number, P: P, E: Env): CardPose {
  const k = Math.sin(E.p * PI * Math.round(num(P.riffles, 1))) ** 2, half = i % 2, idx = Math.floor(i / 2), side = half ? 1 : -1;
  const order = lerp(i, (idx + (half ? 0 : 0.5)) * 2, k);
  return { x: side * E.w * num(P.split, 0.62) * k, y: order * num(P.lift, 0.012) - 0.05 + num(P.arch) * k * 0.4, z: order * num(P.deep, 0.015), rz: -side * num(P.fan, 0.2) * k, rx: num(P.lay, -0.35), ry: -side * num(P.yaw, 0.25) * k, b: 1 - num(P.dim) * 0.6 * (1 - order / Math.max(1, E.n - 1)) };
}
function cascadeLayout(i: number, P: P, E: Env): CardPose {
  const r = wrap(i - E.p * E.n * Math.round(num(P.laps, 1)), E.n), c = r - E.n / 2;
  return { x: c * E.w * num(P.stepX, 0.38) * num(P.spread, 1), y: -c * E.h * num(P.stepY, 0.1) * num(P.spread, 1), z: -r * num(P.stepZ, 0.2), ry: num(P.turn, -0.35) + num(P.sway) * Math.sin(r / E.n * TAU), o: clamp01(r * 1.5) * clamp01((E.n - r) * 1.5), b: 1 - num(P.dim) * 0.7 * r / E.n, blur: num(P.soft) * r / E.n };
}
function tandemLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, u = stepU(E.p, n, E.hold, E.ez), delta = i - u, r = delta < 0 ? delta + n : delta, side = i % 2 ? 1 : -1;
  if (delta < 0 && delta > -1) { const q = -delta, sq = Math.sin(q * PI); return { x: -side * sq * E.w * num(P.swingW, 0.55), y: sq * num(P.liftT), z: -q * num(P.swingZ, 0.9), ry: side * sq * 0.5 * num(P.turnT, 1), rz: -side * sq * num(P.rollT), o: 1 - q, b: 1 - q * 0.4, blur: q * num(P.soft) }; }
  if (r <= 1) { const sr = Math.sin(r * PI); return { x: side * sr * E.w * num(P.swingW, 0.55) + r * E.w * num(P.offsetX, 0.18), y: sr * num(P.liftT), z: -r * num(P.backZ, 0.55), ry: -side * sr * 0.45 * num(P.turnT, 1), rz: side * sr * num(P.rollT), b: 1 - r * (1 - num(P.backB, 0.65)), blur: r * num(P.soft), zBias: r < 0.5 ? 1 : 0 }; }
  return { x: E.w * num(P.offsetX, 0.18), z: -num(P.backZ, 0.55), o: clamp01(2 - r), b: num(P.backB, 0.65), blur: num(P.soft) };
}
function stackPeelLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, u = stepU(E.p, n, E.hold, E.ez), delta = i - u, r = delta < 0 ? delta + n : delta, shown = Math.round(num(P.shown, 6));
  const slot = (rr: number) => ({ y: rr * E.h * num(P.rise, 0.1), z: -rr * num(P.stepZ, 0.2), s: Math.max(0.05, 1 - rr * num(P.shrink, 0.04)), b: Math.max(0, 1 - rr * num(P.dim, 0.08)) });
  if (delta < 0 && delta > -1) { const q = -delta, sq = Math.sin(q * PI), from = slot(0), to = slot(n - 1); return { x: sq * E.w * num(P.peelSide), y: lerp(from.y, to.y, q) + sq * E.h * num(P.peelH, 1.05), z: lerp(from.z, to.z, q), rx: -sq * num(P.peelRot, 0.8), rz: sq * num(P.peelTwist), s: lerp(from.s, to.s, q), b: lerp(1, to.b, q), zBias: q < 0.55 ? 2 : 0, o: lerp(1, clamp01(shown - (n - 1)), sstep(0.5, 1, q)) }; }
  return { ...slot(r), o: clamp01(shown - r) };
}
function gridWaveLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 6)), rows = Math.ceil(E.n / cols), c = i % cols, r = Math.floor(i / cols), origin = str(P.origin, 'center');
  const x = (c - (cols - 1) / 2 + (r % 2) * num(P.rowOff)) * E.w * (1 + num(P.gap, 0.16));
  const y = -(r - (rows - 1) / 2) * E.h * (1 + num(P.gap, 0.16));
  let d: number, ux: number, uy: number;
  if (origin === 'left') { d = x + 3; ux = 1; uy = 0; }
  else if (origin === 'top') { d = 3 - y; ux = 0; uy = -1; }
  else if (origin === 'corner') { d = (x - y) * Math.SQRT1_2 + 3; ux = Math.SQRT1_2; uy = -Math.SQRT1_2; }
  else { d = Math.hypot(x, y); ux = x / (d + 0.01); uy = y / (d + 0.01); }
  const ph = d * num(P.freq, 2.2) - E.p * TAU * Math.round(num(P.waves, 1)), sp = Math.sin(ph), cp = Math.cos(ph) * num(P.amp, 0.35) * num(P.rock, 0.5);
  return { x, y, z: sp * num(P.amp, 0.35), rx: cp * uy, ry: -cp * ux, b: 1 - num(P.crest) * 0.45 * (1 - sp), s: 1 + num(P.pop) * Math.max(0, sp) };
}
function bentoLayout(i: number, P: P, E: Env): CardPose {
  const tiles = [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 2, 1], [0, 2, 1, 1], [1, 2, 2, 1], [3, 2, 1, 1]];
  const [tx, ty, tw, th] = tiles[i % tiles.length], unit = Math.min(2 * E.asp * 0.9 / 4, 2 * 0.88 / 3) * num(P.grid, 1), g = unit * num(P.gap, 0.06);
  const w = tw * unit - g, h = th * unit - g, x = (tx + tw / 2 - 2) * unit * (P.mirror ? -1 : 1), y = -(ty + th / 2 - 1.5) * unit;
  const order = str(P.order, 'in'), j = order === 'rev' ? E.n - 1 - i : order === 'rand' ? E.rnd(i, 3) * (E.n - 1) : i, from = str(P.from, 'below'), d = j * num(P.stagger, 0.04);
  const inn = ease.outQuint(clamp01((E.p - d) / 0.25)), outStart = num(P.outAt, 0.52) + d, outDuration = Math.max(0.001, Math.min(0.2, 1 - outStart)), out = ease.inCubic(clamp01((E.p - outStart) / outDuration)), e = inn * (1 - out), tr = (1 - e) * num(P.travel, 0.15);
  return { x: x + (from === 'left' ? -tr : from === 'right' ? tr : 0), y: y - (from === 'below' ? tr : from === 'above' ? -tr : 0), w, h, aspect: w / h, s: num(P.scaleIn, 0.9) + (1 - num(P.scaleIn, 0.9)) * e, o: e, blur: (1 - e) * num(P.blurIn, 0.8) };
}
function infiniteGridFill(P: P, E: Env): Record<string, number> {
  const cols0 = Math.round(num(P.cols, 6)), rows0 = Math.ceil(E.n / cols0), mc = fillSlots(E.vx * 1.6 + E.w, E.w * (1 + num(P.gap, 0.12)), cols0, rows0, 160);
  const m = fillSlots(E.vy / Math.max(0.25, Math.cos(num(P.tilt, 0.8))) + E.h, E.h * (1 + num(P.gap, 0.12)), rows0, mc, 640);
  return { m, mb: rows0, mc, count: m * mc };
}
function infiniteGridLayout(i: number, P: P, E0: Env): CardPose {
  const E = E0 as StackEnv, cols0 = Math.round(num(P.cols, 6)), cols = E.mc ?? cols0, rows = E.m, c = i % cols, r = Math.floor(i / cols);
  const gx = E.w * (1 + num(P.gap, 0.12)), gy = E.h * (1 + num(P.gap, 0.12));
  const uc = wrap(c + E.p * cols0 * Math.round(num(P.driftX, 1)), cols), ur = wrap(r + E.p * num(E.mb) * Math.round(num(P.driftY, 1)), rows);
  const [X, Y, Z] = tiltPt((uc - (cols - 1) / 2 + num(P.rowOff) * (0.5 - 0.5 * Math.cos(ur * PI))) * gx, (ur - (rows - 1) / 2) * gy, num(P.zig) * Math.cos(uc * PI), -num(P.tilt, 0.8), 0);
  return { x: X, y: Y, z: Z, rx: -num(P.tilt, 0.8), o: clamp01(uc * 1.2) * clamp01((cols - uc) * 1.2 - 0.2) * clamp01(ur * 1.2) * clamp01((rows - ur) * 1.2 - 0.2) * (1 - num(P.fog) * clamp01(-Z / 3)), s: 1 + num(P.pop) * Math.pow(Math.max(0, 1 - Math.hypot(X, Y) / 1.2), 2), img: (r % num(E.mb)) * cols0 + c % cols0 };
}
function isoWallFill(P: P, E: Env): Record<string, number> {
  const cols = Math.round(num(P.cols, 6));
  return { ...laneFill(E, (E.vx + E.vy) * 1.4 * Math.max(1, Math.cos(0.95) / Math.max(0.25, Math.cos(num(P.view, 0.95)))), E.h * (1 + num(P.gap, 0.16)), cols) };
}
function isoWallLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 6)), rows = E.m, c = i % cols, r = Math.floor(i / cols), odd = c % 2;
  const ur = wrap(r + E.p * num(E.mb) * Math.round(odd ? num(P.oddDir, -1) : num(P.evenDir, 1)), rows), gx = E.w * (1 + num(P.gap, 0.16)), gy = E.h * (1 + num(P.gap, 0.16));
  const m = M(RX(-num(P.view, 0.95)), RZ(num(P.rot, 0.75)), T((c - (cols - 1) / 2) * gx, (ur - (rows - 1) / 2) * gy, odd ? num(P.zig) : -num(P.zig)));
  return { m, o: clamp01(ur * 1.5) * clamp01((rows - ur) * 1.5 - 0.3) * (1 - num(P.fog) * clamp01(-m[14] / 3)), b: 1 - num(P.dim) * Number(odd), img: (r % num(E.mb)) * cols + c };
}
function framesLayout(i: number, P: P, E: Env): CardPose {
  const c = i % 3, r = Math.floor(i / 3), x = (c - 1) * E.w * (1 + num(P.gap, 0.1)), y = -(r - 1) * E.h * (1 + num(P.gap, 0.1));
  const cyc = E.p * 9, k = Math.floor(cyc), f = cyc - k, order = str(P.order, 'mix'), focus = order === 'seq' ? k % 9 : order === 'rev' ? 8 - k % 9 : [4, 0, 8, 2, 6, 1, 7, 3, 5][k % 9];
  const e = ease.inOutCubic(sstep(0, num(P.inT, 0.35), f)) * (1 - ease.inOutCubic(sstep(0.7, 1, f)));
  if (i === focus) { const g = str(P.go, 'center') === 'place' ? 1 : 1 - e; return { x: x * g, y: y * g, z: e * num(P.lift, 0.6), ry: e * num(P.tiltF), s: lerp(1, num(P.zoom, 2.6), e), zBias: 5 }; }
  return { x, y, blur: e * num(P.soft, 0.7), b: 1 - num(P.dim, 0.35) * e, s: 1 - num(P.shrink, 0.05) * e };
}
function mosaicFlipLayout(i: number, P: P, E: Env): CardPose {
  const tiles = Math.ceil(E.n / 2), t = i % tiles, side = Math.floor(i / tiles), cols = Math.round(num(P.cols, 4)), rows = Math.ceil(tiles / cols), c = t % cols, r = Math.floor(t / cols);
  const x = (c - (cols - 1) / 2 + (r % 2) * num(P.rowOff)) * E.w * (1 + num(P.gap, 0.1)), y = -(r - (rows - 1) / 2) * E.h * (1 + num(P.gap, 0.1)), pattern = str(P.pattern, 'diag');
  const dl = pattern === 'rows' ? r : pattern === 'cols' ? c : pattern === 'ripple' ? Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) * 1.4 : pattern === 'random' ? E.rnd(t, 4) * (cols + rows - 2) : c + r;
  const ph = wrap(E.p - dl * num(P.wave, 0.05), 1), th = PI * (ease.inOutCubic(sstep(0.05, 0.05 + num(P.flipT, 0.3), ph)) - ease.inOutCubic(sstep(0.55, 0.55 + num(P.flipT, 0.3), ph))), a = th + side * PI, vertical = str(P.axis, 'y') === 'x';
  return { x, y, z: Math.sin(th) * num(P.lift, 0.25), ry: vertical ? 0 : a, rx: vertical ? a : 0, o: Math.cos(a) > 0 ? 1 : 0, b: 1 - num(P.shade, 0.4) + num(P.shade, 0.4) * ab(Math.cos(th)) };
}
function assembleLayout(i: number, P: P, E: Env): CardPose {
  const cols = Math.round(num(P.cols, 4)), rows = Math.ceil(E.n / cols), c = i % cols, r = Math.floor(i / cols), from = str(P.from, 'center'), order = str(P.order, 'in');
  const gx = (c - (cols - 1) / 2) * E.w * (1 + num(P.gap, 0.1)), gy = -(r - (rows - 1) / 2) * E.h * (1 + num(P.gap, 0.1));
  const px = (E.rnd(i, 1) - 0.5) * 1.1 * num(P.mess, 0.7), py = (E.rnd(i, 2) - 0.5) * 0.55 * num(P.mess, 0.7) + (from === 'below' ? -1.1 : from === 'above' ? 1.1 : 0), pr = (E.rnd(i, 3) - 0.5) * 1.2 * num(P.mess, 0.7);
  const j = order === 'rev' ? E.n - 1 - i : order === 'rand' ? E.rnd(i, 4) * (E.n - 1) : order === 'center' ? Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) / Math.max(0.5, Math.hypot((cols - 1) / 2, (rows - 1) / 2)) * (E.n - 1) : i;
  const d = j / Math.max(1, E.n - 1) * num(P.stagger, 0.08), k = ease.inOutCubic(sstep(0.04 + d, 0.34 + d, E.p)) * (1 - ease.inOutCubic(sstep(0.52 + d, 0.82 + d, E.p)));
  return { x: lerp(px, gx, k), y: lerp(py, gy, k), z: Math.sin(k * PI) * num(P.lift, 0.35), rz: lerp(pr, 0, k), rx: Math.sin(k * PI) * num(P.tumble, 0.2), s: lerp(num(P.pileS, 1.45), 1, k), zBias: (1 - k) * i * 0.02, blur: (1 - k) * num(P.soft), b: 1 - (1 - k) * num(P.dim) * 0.6 };
}
function deckDiveLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, u = stepU(E.p, n, E.hold, E.ez), s = wrap(i - u + 1, n) - 1;
  if (s < 0) {
    const e = -s, k = ease.inCubic(e), c = Math.cos(num(P.throwAngle) * PI / 180), sn = Math.sin(num(P.throwAngle) * PI / 180), fx = -0.8 * c - 1.9 * sn, fy = -0.8 * sn + 1.9 * c;
    return { x: -0.25 + k * fx * num(P.lift, 1.1), y: k * fy * num(P.lift, 1.1), z: k * 1.6 * num(P.lift, 1.1), rx: -k * num(P.tumble, 0.9), rz: (E.rnd(i, 1) - 0.5) * k * 0.6, o: 1 - sstep(0.55, 1, e), zBias: 50 };
  }
  return { x: s * num(P.depth, 0.38) * num(P.drift, 0.3) - 0.25, y: s * num(P.rise, 0.07) - 0.08, z: -s * num(P.depth, 0.38), rz: (E.rnd(i, 2) - 0.5) * num(P.messy, 0.05) * Math.min(1, s) + num(P.fan) * s * 0.08, b: 1 - Math.min(0.35, s * num(P.stackDim, 0.05)), blur: s * num(P.stackBlur, 0.035), o: 1 - sstep(n - 1.6, n - 1, s), zBias: -s };
}
function counterColsFill(P: P, E: Env): Record<string, number> {
  const cols = Math.round(num(P.cols, 5)), base = Math.ceil(E.n / cols), pitch = E.h * (1 + num(P.gap, 0.06)), m = fillSlots(E.vy * 1.4 + E.h, pitch, base, cols);
  return { cols, base, m, pitch, count: m * cols };
}
function counterColsLayout(i: number, P: P, E0: Env): CardPose {
  const E = E0 as StackEnv, c = i % Number(E.cols), r = Math.floor(i / Number(E.cols)), odd = c % 2;
  const q = num(P.tick) ? lerp(E.p, stepU(E.p, Number(E.base), 0.55, ease.inOutCubic) / Number(E.base), num(P.tick)) : E.p;
  const v = wrap(r + (odd ? -Math.round(num(P.pace, 1)) : 1) * q * Number(E.base), E.m) - E.m / 2 + 0.5;
  const y0 = v * Number(E.pitch) + num(P.colShift) * Number(odd) * Number(E.pitch) * 0.5, xl = (c - (Number(E.cols) - 1) / 2) * E.w * (1 + num(P.gap, 0.06)), k = num(P.curve, 0.55) / 2.2, ky = num(P.vCurve) * 0.45;
  let x = xl, z = 0, ry = 0, y = y0, rx = 0;
  if (k > 0.01) { const g = xl * k; x = Math.sin(g) / k; z = (Math.cos(g) - 1) / k; ry = g; }
  if (ky > 0.01) { const g = y0 * ky; y = Math.sin(g) / ky; z += (Math.cos(g) - 1) / ky; rx = -g; }
  const e = sstep(0.25, 1, ab(y0) / E.vy);
  return { x, y, z: z + (odd ? -1 : 1) * num(P.split) * 0.25, rx, ry, bend: k, b: 1 - num(P.edgeDim) * e, blur: num(P.edgeBlur) * e * 0.6, o: clamp01((E.m / 2 - ab(v)) * 1.2), img: (r % Number(E.base)) * Number(E.cols) + c };
}
function gridZoomLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, cols = Math.round(num(P.cols, 4)), rows = Math.ceil(n / cols);
  const pos = (j: number): [number, number] => [(j % cols - (cols - 1) / 2) * E.w * (1 + num(P.gap, 0.1)), ((rows - 1) / 2 - Math.floor(j / cols)) * E.h * (1 + num(P.gap, 0.1))];
  const seg = E.p * n, kk = Math.floor(seg) % n, l = seg - Math.floor(seg), zf = 2 * num(P.fill, 0.94) / E.h, ov = num(P.overview, 1), order = str(P.route, 'in') === 'shuffle' ? shuffled(n, 7) : null;
  const k = order ? order[kk] : kk, k2 = order ? order[(kk + 1) % n] : (kk + 1) % n;
  const out = E.ez(sstep(0, 0.22, l)), inn = E.ez(sstep(0.3 + num(P.gridHold, 0.04), 0.56 + num(P.gridHold, 0.04), l)), pk = pos(k), pn = pos(k2);
  const zoom = l < 0.3 ? lerp(zf, ov, out) : lerp(ov, zf, inn), f = l < 0.3 ? [lerp(pk[0], 0, out), lerp(pk[1], 0, out)] : [lerp(0, pn[0], inn), lerp(0, pn[1], inn)];
  const focus = l < 0.3 ? (i === k ? 1 - out : 0) : (i === k2 ? inn : 0), [gx, gy] = pos(i), zoomRange = zf - ov, dim = Math.abs(zoomRange) < 1e-6 ? 0 : (zoom - ov) / zoomRange;
  const g = num(P.swing) * 0.5 * (1 - dim), cg = Math.cos(g), sg = Math.sin(g), X = (gx - f[0]) * zoom, Y = (gy - f[1]) * zoom;
  return { x: X * cg - Y * sg, y: X * sg + Y * cg, rz: g, s: zoom, b: 1 - num(P.dimOthers, 0.4) * dim * (1 - focus), blur: num(P.blurOthers) * dim * (1 - focus) * 0.6, zBias: focus };
}
function shuffled(n: number, seed: number): number[] {
  let s = (seed * 2654435761) >>> 0;
  const random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const order = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
  return order;
}
function dealLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, cols = Math.round(num(P.cols, 4)), rows = Math.ceil(n / cols), c = i % cols, r = Math.floor(i / cols), w = num(P.dealSpan, 0.3) / n, ft = 0.13 * num(P.flight, 1), deck = str(P.deckPos, 'bl');
  const t = sstep(0.02 + i * w, 0.02 + ft + i * w, E.p) * (1 - sstep(0.56 + (n - 1 - i) * w, 0.56 + ft + (n - 1 - i) * w, E.p));
  const e = E.ez(t), lift = Math.sin(PI * e), messy = num(P.messy);
  const gx = (c - (cols - 1) / 2) * E.w * (1 + num(P.gap, 0.1)) + messy * (E.rnd(i, 3) - 0.5) * E.w * 0.3, gy = ((rows - 1) / 2 - r) * E.h * (1 + num(P.gap, 0.1)) + messy * (E.rnd(i, 5) - 0.5) * E.h * 0.2;
  const dx = deck === 'c' ? 0 : (deck === 'br' ? 1 : -1) * E.asp * 0.95, dy = -0.85;
  return { x: lerp(dx, gx, e), y: lerp(dy, gy, e), z: lift * num(P.arc, 0.7) * 0.7 + (1 - e) * (n - i) * 0.004, ry: (1 - e) * PI * num(P.flipAmt, 1), rz: (1 - e) * 0.25 + lift * (E.rnd(i, 2) - 0.5) * num(P.toss, 0.5) + messy * (E.rnd(i, 4) - 0.5) * 0.35 * e, b: 1 - num(P.deckShade) * (1 - e), zBias: (1 - e) * (n - i) * 0.01 + lift };
}
const classicStackShuffleParams = params([
  group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('deckDepth', 'Deck depth', 0.05, 0.6, 0.22), range('shrink', 'Shrink', 0, 0.12, 0.05, 0.005), range('fanAngle', 'Fan', -1, 1, 0), off('scatter', 'Scatter', 1),
  group('Motion'), range('throwX', 'Throw distance', 0.5, 2, 1.05), range('throwSpin', 'Throw turn', -0.6, 0.6, 0.12), range('throwLift', 'Throw lift', -1, 1, 0),
  group('Look'), range('deckShade', 'Deck shade', 0, 0.2, 0.1, 0.005), off('deckBlur', 'Deck blur', 1),
]);

export const STACK_TEMPLATES: Template[] = [
  { id: 'stack-shuffle', name: 'Stack Shuffle', cat: 'stack', n: 7, aspect: 0.8, step: true, cardH: 1.25, perCard: 1.4, frame: '5:4', desc: 'The top card slides out and tucks in behind the deck.', params: classicStackShuffleParams, layout: stackShuffleLayout },
  { id: 'fan', name: 'Fan', cat: 'stack', n: 7, aspect: 0.72, cardH: 1.05, dur: 7, frame: '16:9', desc: 'A hand of cards that opens and closes.', params: params([group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('pivot', 'Pivot', 0.5, 4, 1.9), range('fanLean', 'Lean', -0.8, 0.8, 0), range('layering', 'Layer depth', 0, 0.15, 0.012, 0.001), group('Motion'), range('minOpen', 'Closed spread', 0, 1, 0.2, 0.01, { percent: true }), whole('beats', 'Beats', 1, 4, 1, { unit: '×', hint: 'whole cycles per loop, so it stays seamless' }), off('cascade', 'Cascade', 1), range('cardTurn', 'Card turn', -1, 1, 0), group('Look'), off('outerShade', 'Outer shade', 0.6), off('outerBlur', 'Outer blur', 1)]), layout: fanLayout },
  { id: 'masonry', name: 'Masonry', cat: 'stack', n: 18, aspect: 0.8, cardH: 0.62, dur: 26, frame: '4:5', desc: 'Columns drift in opposite directions and melt into the top and bottom.', style: glassStyle({ top: 1, bottom: 1 }, { width: 0.2, refraction: 0.65, bulge: 0.3 }), params: params([group('Layout'), range('cols', 'Columns', 1, 5, 3, 1), range('gap', 'Gap', 0, 0.8, 0.07), off('colSpace', 'Column spacing', 0.6), off('colOffset', 'Column offset', 1), off('barrel', 'Barrel', 1), off('colDepth', 'Column depth', 1.5), group('Motion'), segment('flow', 'Flow', { alt: 'Alternate', same: 'Same way' }, 'alt'), whole('oddSpeed', 'Fast columns', 1, 3, 1, { unit: '×', hint: 'whole cycles per loop, so it stays seamless' }), group('Look'), range('edgeFade', 'Edge fade', 0.2, 3, 0.8), off('edgeBlur', 'Edge blur', 1)]), fill: masonryFill, layout: masonryLayout },
  { id: 'tilt-grid', name: 'Tilt Grid', cat: 'stack', n: 30, aspect: 0.8, cardH: 0.6, dur: 24, frame: '4:5', desc: 'An endless tilted wall of images, edged in glass.', style: glassStyle({ top: 0.7, bottom: 1, left: 0.8, right: 0.8 }, { width: 0.18, refraction: 0.55, bulge: 0.2 }), params: params([group('Layout'), range('cols', 'Columns', 1, 8, 6, 1), range('tilt', 'Camera tilt', -1, 1.2, 0.85), range('gap', 'Gap', 0, 0.8, 0.12), range('gridTurn', 'Rotation', -0.6, 0.6, 0.18), off('brick', 'Row offset', 1), off('faceCam', 'Face camera', 1), group('Motion'), segment('flow', 'Columns', { same: 'Together', alt: 'Alternate' }, 'same'), off('centreLift', 'Lift at centre', 1), group('Look'), off('farShade', 'Far shade', 0.8), off('farBlur', 'Far blur', 1)]), camera: stackCamera, fill: tiltGridFill, layout: tiltGridLayout },
  { id: 'card-drop', name: 'Card Drop', cat: 'stack', n: 10, aspect: 0.8, step: true, cardH: 1.05, perCard: 1.1, frame: '5:4', desc: 'Photos drop onto a loose pile, one after another.', params: params([group('Layout'), range('mess', 'Messiness', 0, 1, 0.5), range('pile', 'Pile depth', 0, 3, 1, 0.01, { unit: '×' }), range('slide', 'Push aside', -1, 1, 0, 0.01, { hint: 'the card underneath slides away as the next lands' }), group('Motion'), segment('from', 'Drop from', { top: 'Above', left: 'Left', right: 'Right' }, 'top'), range('height', 'Drop height', 1, 5, 2.6), select('land', 'Landing', { outBack: 'Bounce', outCubic: 'Soft', outExpo: 'Snap', outElastic: 'Elastic' }, 'outBack'), range('spinIn', 'Spin in', -2, 2, 0.6), group('Look'), range('zoomIn', 'Drop scale', 0, 0.5, 0.1), range('dim', 'Pile dim', 0, 0.12, 0.04, 0.005)]), layout: cardDropLayout },
  { id: 'riffle', name: 'Riffle', cat: 'stack', n: 10, aspect: 0.8, cardH: 0.85, dur: 6, frame: '5:4', desc: 'The deck splits in two and riffles back together.', params: params([group('Layout'), range('split', 'Split width', 0.2, 1.2, 0.62), range('lift', 'Stack height', 0, 0.04, 0.012, 0.001), range('deep', 'Stack depth', 0, 0.06, 0.015, 0.001), range('lay', 'Deck tilt', -1, 0.5, -0.35), group('Motion'), whole('riffles', 'Riffles per loop', 1, 3, 1, { unit: '×' }), off('arch', 'Arch', 1, { hint: 'the halves lift as they split' }), range('fan', 'Fan', 0, 1, 0.2), range('yaw', 'Turn', 0, 1, 0.25), group('Look'), off('dim', 'Depth dim', 1)]), layout: riffleLayout },
  { id: 'cascade', name: 'Cascade', cat: 'stack', n: 10, aspect: 0.8, cardH: 1, dur: 16, frame: '16:9', desc: 'A staircase of images flowing down and away.', params: params([group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('stepX', 'Step across', 0, 1, 0.38), range('stepY', 'Step down', -0.4, 0.4, 0.1), range('stepZ', 'Step depth', 0, 0.6, 0.2), range('turn', 'Card turn', -1.2, 1.2, -0.35), group('Motion'), whole('laps', 'Passes per loop', 1, 3, 1, { unit: '×' }), off('sway', 'Sway', 0.6, { hint: 'cards swing as they travel' }), group('Look'), off('dim', 'Depth dim', 1), off('soft', 'Depth blur', 1)]), layout: cascadeLayout },
  { id: 'tandem', name: 'Tandem', cat: 'stack', n: 6, aspect: 0.8, step: true, cardH: 1.25, perCard: 1.4, frame: '5:4', desc: 'Two cards trade places, swinging past each other.', params: params([group('Layout'), range('offsetX', 'Back offset', 0, 0.5, 0.18), range('backZ', 'Back depth', 0.2, 1.5, 0.55), group('Motion'), range('swingW', 'Swing width', 0, 1.2, 0.55), range('swingZ', 'Swing depth', 0, 2, 0.9), range('turnT', 'Swing turn', 0, 2.5, 1, 0.01, { unit: '×' }), range('liftT', 'Swing lift', -0.5, 0.5, 0), off('rollT', 'Swing roll', 0.5), group('Look'), range('backB', 'Back brightness', 0.2, 1, 0.65), off('soft', 'Back blur', 1)]), layout: tandemLayout },
  { id: 'stack-peel', name: 'Stack Peel', cat: 'stack', n: 7, aspect: 0.8, step: true, cardH: 1.2, perCard: 1.3, frame: '5:4', desc: 'The top photo peels up and away to the back of the stack.', params: params([group('Layout'), range('rise', 'Step up', -0.3, 0.3, 0.1), range('stepZ', 'Step depth', 0, 0.6, 0.2), range('shrink', 'Shrink', 0, 0.12, 0.04, 0.005), range('shown', 'Cards shown', 2, 8, 6, 1), group('Motion'), range('peelH', 'Peel height', 0.3, 2, 1.05), range('peelRot', 'Peel curl', -1.5, 1.5, 0.8), range('peelSide', 'Peel sideways', -1, 1, 0), range('peelTwist', 'Peel twist', -1, 1, 0), group('Look'), range('dim', 'Stack dim', 0, 0.2, 0.08, 0.005)]), layout: stackPeelLayout },
  { id: 'grid-wave', name: 'Grid Wave', cat: 'stack', n: 30, aspect: 0.8, cardH: 0.42, dur: 10, frame: '16:9', desc: 'A grid of images rippling like water.', params: params([group('Layout'), range('cols', 'Columns', 1, 8, 6, 1), range('gap', 'Gap', 0, 0.8, 0.16), range('tilt', 'Camera tilt', -1, 1.2, 0.45), off('rowOff', 'Row offset', 0.5), segment('origin', 'Wave from', { center: 'Centre', left: 'Left', top: 'Top', corner: 'Corner' }, 'center'), group('Motion'), range('amp', 'Wave height', 0, 1, 0.35), range('freq', 'Ripple density', 0.5, 5, 2.2), whole('waves', 'Waves per loop', 1, 4, 1, { unit: '×' }), range('rock', 'Card rock', 0, 1.5, 0.5), group('Look'), off('crest', 'Trough shade', 1), off('pop', 'Crest pop', 0.4)]), camera: stackCamera, layout: gridWaveLayout },
  { id: 'bento', name: 'Bento Reveal', cat: 'stack', n: 7, fixedN: true, aspect: 1, cardH: 0.5, dur: 7, frame: '16:9', desc: 'A bento grid of photos that builds in, holds, and clears.', params: params([group('Layout'), range('gap', 'Gap', 0, 0.8, 0.06), range('grid', 'Grid size', 0.6, 1.1, 1, 0.01, { unit: '×' }), toggle('mirror', 'Mirror', false), group('Motion'), range('stagger', 'Stagger', 0, 0.06, 0.04, 0.005), segment('order', 'Order', { in: 'In order', rev: 'Reverse', rand: 'Random' }, 'in'), segment('from', 'Enter from', { below: 'Below', above: 'Above', left: 'Left', right: 'Right' }, 'below'), range('travel', 'Travel', 0, 1, 0.15), range('outAt', 'Clear at', 0.35, 0.56, 0.52), group('Look'), range('blurIn', 'Blur in', 0, 1, 0.8), range('scaleIn', 'Scale in', 0.5, 1.2, 0.9)]), layout: bentoLayout },
  { id: 'infinite-grid', name: 'Infinite Grid', cat: 'stack', n: 36, aspect: 0.8, cardH: 0.6, dur: 24, frame: '16:9', desc: 'An endless grid drifting diagonally under a tilted camera.', params: params([group('Layout'), range('cols', 'Columns', 1, 8, 6, 1), range('tilt', 'Camera tilt', -1, 1.2, 0.8), range('gap', 'Gap', 0, 0.8, 0.12), off('rowOff', 'Row offset', 0.5), off('zig', 'Column zigzag', 0.5), group('Motion'), range('driftX', 'Drift across', -2, 2, 1, 1, { unit: '×' }), range('driftY', 'Drift forward', -2, 2, 1, 1, { unit: '×' }), group('Look'), off('fog', 'Distance fade', 1), off('pop', 'Centre pop', 0.5)]), fill: infiniteGridFill, layout: infiniteGridLayout },
  { id: 'iso-wall', name: 'Isometric Wall', cat: 'stack', n: 30, aspect: 0.8, cardH: 0.7, dur: 24, frame: '16:9', desc: 'An isometric wall of photos, columns sliding past each other.', params: params([group('Layout'), range('cols', 'Columns', 1, 8, 6, 1), range('gap', 'Gap', 0, 0.8, 0.16), range('view', 'View angle', 0.3, 1.3, 0.95), range('rot', 'Rotation', -1.5, 1.5, 0.75), off('zig', 'Column depth', 0.6), group('Motion'), range('evenDir', 'Even columns', -2, 2, 1, 1, { unit: '×' }), range('oddDir', 'Odd columns', -2, 2, -1, 1, { unit: '×' }), group('Look'), off('dim', 'Odd column shade', 0.6), off('fog', 'Depth fade', 1)]), fill: isoWallFill, layout: isoWallLayout },
  { id: 'frames', name: 'Frames', cat: 'stack', n: 9, fixedN: true, aspect: 0.8, step: true, cardH: 0.58, perCard: 1.6, frame: '16:9', desc: 'A 3×3 wall where each photo in turn steps forward.', style: { blur: { on: true, depth: 0 } }, params: params([group('Layout'), range('gap', 'Gap', 0, 0.8, 0.1), segment('go', 'Focus moves', { center: 'To centre', place: 'In place' }, 'center'), group('Motion'), range('zoom', 'Zoom', 1.2, 3.5, 2.6), segment('order', 'Order', { mix: 'Shuffle', seq: 'In order', rev: 'Reverse' }, 'mix'), range('inT', 'Zoom time', 0.1, 0.45, 0.35), range('lift', 'Lift', 0, 1.5, 0.6), range('tiltF', 'Focus turn', -0.6, 0.6, 0), group('Look'), range('soft', 'Background blur', 0, 1, 0.7), range('dim', 'Background dim', 0, 0.8, 0.35), range('shrink', 'Background shrink', 0, 0.3, 0.05)]), layout: framesLayout },
  { id: 'mosaic-flip', name: 'Mosaic Flip', cat: 'stack', n: 24, aspect: 0.8, cardH: 0.5, dur: 7, frame: '16:9', desc: 'Tiles flip over in a diagonal wave to reveal new photos.', params: params([group('Layout'), range('cols', 'Columns', 1, 6, 4, 1), range('gap', 'Gap', 0, 0.8, 0.1), off('rowOff', 'Brick offset', 0.5), group('Motion'), range('wave', 'Wave delay', 0, 0.12, 0.05, 0.005), select('pattern', 'Wave pattern', { diag: 'Diagonal', rows: 'Rows', cols: 'Columns', ripple: 'Ripple', random: 'Random' }, 'diag'), segment('axis', 'Flip axis', { y: 'Sideways', x: 'Over the top' }, 'y'), range('flipT', 'Flip time', 0.15, 0.45, 0.3), range('lift', 'Flip lift', 0, 0.8, 0.25), group('Look'), range('shade', 'Flip shade', 0, 1, 0.4)]), layout: mosaicFlipLayout },
  { id: 'assemble', name: 'Assemble', cat: 'stack', n: 12, aspect: 0.8, cardH: 0.5, dur: 8, frame: '5:4', desc: 'A loose pile of photos flies into a neat grid, holds, then tumbles back.', params: params([group('Layout'), range('cols', 'Columns', 1, 6, 4, 1), range('gap', 'Gap', 0, 0.8, 0.1), range('mess', 'Messiness', 0, 1, 0.7), range('pileS', 'Pile scale', 0.6, 2, 1.45), segment('from', 'Pile at', { center: 'Centre', below: 'Below', above: 'Above' }, 'center'), group('Motion'), range('stagger', 'Stagger', 0, 0.1, 0.08, 0.002), segment('order', 'Order', { in: 'In order', rev: 'Reverse', center: 'Centre out', rand: 'Random' }, 'in'), range('lift', 'Lift', 0, 1, 0.35), range('tumble', 'Tumble', -1, 1, 0.2), group('Look'), off('soft', 'Pile blur', 1), off('dim', 'Pile dim', 1)]), layout: assembleLayout },
  { id: 'deck-dive', name: 'Deck Dive', cat: 'stack', n: 10, aspect: 0.8, step: true, cardH: 0.8, perCard: 1.5, frame: '5:4', isNew: true, mods: { poseRy: -24, poseRx: 6 }, desc: 'A deep stack of photos marches forward; the front card lifts off and sails past the camera to reveal the next.', params: params([group('Layout'), range('depth', 'Depth', 0.15, 0.7, 0.38), range('rise', 'Rise', 0, 0.2, 0.07), range('drift', 'Sideways', -1, 1, 0.3), range('fan', 'Fan', -1, 1, 0), range('messy', 'Messy', 0, 0.5, 0.05), group('Motion'), range('lift', 'Lift off', 0, 2, 1.1), range('throwAngle', 'Throw angle', -180, 180, 0, 1, { unit: '°' }), range('tumble', 'Tumble', 0, 3, 0.9), group('Look'), range('stackDim', 'Depth dim', 0, 0.12, 0.05, 0.005), range('stackBlur', 'Depth blur', 0, 0.12, 0.035, 0.005)]), layout: deckDiveLayout },
  { id: 'counter-cols', name: 'Counter Columns', cat: 'stack', n: 15, aspect: 0.8, cardH: 0.5, dur: 26, frame: '5:4', isNew: true, mods: { poseRx: 14, poseRy: -12, poseRz: 10 }, desc: 'Columns of photos wrapped round a drum scroll in opposite directions, like a wall of departure boards.', params: params([group('Layout'), range('cols', 'Columns', 1, 8, 5, 1), range('gap', 'Gap', 0, 0.8, 0.06), range('curve', 'Curve', 0, 1.2, 0.55), off('vCurve', 'Roll curve', 1), off('colShift', 'Column offset', 1), off('split', 'Depth split', 1), group('Motion'), whole('pace', 'Counter pace', 0, 3, 1, { unit: '×', hint: 'how fast the odd columns run the other way' }), off('tick', 'Tick', 1, { hint: 'columns click along a row at a time, like a flap board' }), group('Look'), off('edgeDim', 'Edge dim', 1), off('edgeBlur', 'Edge blur', 1)]), fill: counterColsFill, layout: counterColsLayout },
  { id: 'grid-zoom', name: 'Grid Zoom', cat: 'stack', n: 12, aspect: 0.8, cardH: 0.4, dur: 28, frame: '5:4', isNew: true, desc: 'The camera dives into one photo of a grid until it fills the frame, pulls back, then dives into the next.', params: params([group('Layout'), range('cols', 'Columns', 1, 6, 4, 1), range('gap', 'Gap', 0, 0.8, 0.1), range('fill', 'Fill', 0.6, 1.2, 0.94), range('overview', 'Overview zoom', 0.6, 1.4, 1, 0.01, { unit: '×' }), group('Motion'), range('gridHold', 'Grid pause', 0, 0.25, 0.04), segment('route', 'Order', { in: 'In order', shuffle: 'Shuffled' }, 'in'), range('swing', 'Swing', -1, 1, 0), select('ease', 'Easing', { inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear' }, 'inOutQuint'), group('Look'), range('dimOthers', 'Dim others', 0, 1, 0.4), off('blurOthers', 'Blur others', 1)]), layout: gridZoomLayout },
  { id: 'deal', name: 'Deal', cat: 'stack', n: 12, aspect: 0.8, cardH: 0.44, dur: 11, frame: '5:4', isNew: true, mods: { poseRx: 24 }, style: { card: { back: 'solid', backColor: '#17171b' } }, desc: 'Cards flip off a deck and land face-up in a grid, hold a moment, then fly back into the deck.', params: params([group('Layout'), range('cols', 'Columns', 1, 6, 4, 1), range('gap', 'Gap', 0, 0.8, 0.1), segment('deckPos', 'Deck', { bl: 'Left', c: 'Centre', br: 'Right' }, 'bl'), off('messy', 'Messy grid', 1), group('Motion'), range('arc', 'Arc', 0, 1.5, 0.7), range('dealSpan', 'Deal stagger', 0, 0.3, 0.3), range('flight', 'Flight time', 0.4, 1, 1, 0.01, { unit: '×' }), range('flipAmt', 'Flip', 0, 2, 1, 0.01, { unit: '×' }), range('toss', 'Toss spin', 0, 1.5, 0.5), group('Look'), off('deckShade', 'Deck shade', 0.8)]), layout: dealLayout },
];

