import type { CardPose, Env, P, Template } from '../types';
import {
  ab,
  clamp01,
  ease,
  fillSlots,
  frame3,
  lerp,
  num,
  rel,
  sgn,
  stepSpeed,
  stepU,
  str,
  stripFill,
  TAU,
  wrap,
  wrapFade,
} from '../kit';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl, ReferenceSelectControl } from '../referenceControls';

type DynamicEnv = Env & Record<string, any>;
type Vec3 = [number, number, number];
type Formation = (i: number, count: number, random: (key: number) => number) => [number, number, number, number, number];

const PI = Math.PI;
const D2R = PI / 180;
const sstep = (a: number, b: number, value: number): number => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({
  key, label, type: 'range', min, max, step, def, ...extra,
});
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, min, max, def, 1, extra);
const turns = (key = 'whirl', label = 'Turns', def = 1): ReferenceRangeControl => whole(key, label, -3, 3, def, { unit: '\u00d7', hint: 'whole turns per loop, so it stays seamless' });
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const select = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSelectControl => ({ key, label, type: 'select', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
const E = (env: Env): DynamicEnv => env as DynamicEnv;

function shelfLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const r = rel(i, e.p * e.n, e.m);
  const x0 = r * e.w * num(P.pitch, 0.2);
  const x = x0 + num(P.centreGap, 0) * e.w * 0.5 * Math.tanh(x0 / (e.w * 0.3));
  const ex = ab(x) / e.asp;
  const ry = -sgn(x) * lerp(PI / 2, num(P.angle, 86) * D2R, sstep(0, e.w * 0.9 * num(P.turnZone, 1), ab(x)));
  return {
    x,
    y: num(P.pull) * e.h * 0.35 * (1 - sstep(0, e.w * 1.5, ab(x))),
    z: -num(P.arc) * x * x * 0.25,
    ry,
    s: 1 - num(P.sizeMix) * 0.35 * e.rnd(i % e.n, 4),
    blur: num(P.edgeBlur, 0.55) * sstep(0.55, 1.15, ex),
    b: 1 - num(P.edgeDim) * sstep(0.3, 1.1, ex),
    o: wrapFade(r, e.m) * (1 - num(P.edgeFade) * sstep(0.5, 1.2, ex)),
  };
}

function portalRingFill(_P: P, env: Env): Record<string, unknown> {
  const e = E(env);
  return { count: e.n * Math.round(num(_P.rings, 3)) };
}

function portalRingLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const rings = Math.round(num(P.rings, 3));
  const j = Math.floor(i / e.n);
  const s = i % e.n;
  const u = Math.pow(wrap(j / rings + e.p, 1), Math.pow(2, num(P.rush)));
  const length = 22 * num(P.depthLen, 1);
  const dist = length * Math.pow(0.3 / length, u);
  const z = e.D - dist;
  const cx = num(P.veer) * (1 - u) ** 2 * 3;
  const a = (s / e.n + e.p * num(P.whirl, 1)) * TAU + j * (1.7 + num(P.twistStep) * PI);
  const rr = num(P.radius, 1.02) * (1 + num(P.open, 0.4) * (s / e.n - 0.5));
  const lx = Math.cos(a) * rr;
  const y0 = Math.sin(a) * rr;
  const y = y0 * Math.cos(num(P.tilt, 0.32));
  return {
    x: lx + cx,
    y,
    z: z + y0 * Math.sin(num(P.tilt, 0.32)),
    ry: -lx * 0.22 * num(P.faceIn, 1),
    rx: y * 0.12 * num(P.faceIn, 1),
    b: 1 - num(P.fog) * (1 - u) * 0.85,
    o: sstep(0, 0.12, u) * sstep(0.35, 1.2, dist),
    img: i,
  };
}

function iconDrumFill(_P: P, env: Env): Record<string, unknown> {
  const e = E(env);
  return { count: e.n * Math.round(num(_P.rows, 1)) };
}

function iconDrumLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const n = e.n;
  const j = Math.floor(i / n);
  const s = i % n;
  const rows = Math.round(num(P.rows, 1));
  const turnsCount = n * ab(Math.round(num(P.whirl, 1)));
  const radius = Math.max(0.4, n * e.w * (1 + num(P.gap, 0.04)) / TAU)
    * num(P.drumR, 1) * (1 + num(P.breathe) * 0.15 * Math.sin(TAU * e.p * 2));
  const click = num(P.click);
  const q = click && turnsCount
    ? lerp(e.p, stepU(e.p, turnsCount, 0.55, ease.inOutCubic) / turnsCount, click)
    : e.p;
  const a = (s / n + q * num(P.whirl, 1) + (j % 2) * 0.5 / n) * TAU;
  const c = Math.max(0, Math.cos(a));
  return {
    x: radius * Math.sin(a),
    y: (j - (rows - 1) / 2) * e.h * (1 + num(P.gap, 0.04)) + num(P.ringTilt) * radius * 0.35 * Math.cos(a),
    z: radius * Math.cos(a) - radius,
    ry: a,
    s: 1 + num(P.magnify) * 0.3 * c ** 4,
    b: 1 - num(P.backDim, 0.38) * (1 - c),
    blur: num(P.backBlur) * (1 - c) * 0.6,
    img: i,
  };
}

function crumpleLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const u = stepU(e.p, e.n, e.hold, e.ez);
  const r = rel(i, u, e.m);
  const ar = ab(r);
  const k = num(P.crush, 0.75) * sstep(0.1, num(P.crushAt, 1), ar);
  const pop = num(P.recoil) * sstep(0, 0.35, ar) * (1 - sstep(0.35, 1, ar));
  return {
    x: r * e.w * (1 + num(P.gap, 0.03)),
    y: -num(P.drop) * k * e.h * 0.45,
    z: -k * num(P.sink, 0.12),
    s: (1 - num(P.shrink, 0.1) * k) * (1 + pop * 0.15),
    rz: (e.rnd(i % e.n, 3) - 0.5) * num(P.twistR, 0.45) * k - num(P.roll) * r * k * 0.8,
    crumple: k,
    b: 1 - num(P.ballDim) * k,
    o: wrapFade(r, e.m),
  };
}

function haloLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const a = (i / e.n + e.p * num(P.whirl, 1)) * TAU;
  const radius = num(P.radius, 1.2) * (1 + num(P.scatter) * 0.35 * (e.rnd(i, 4) - 0.5));
  const ca = Math.cos(a);
  const x = radius * Math.sin(a) * (1 + num(P.oval) * 0.6);
  const zr = radius * ca;
  const y0 = num(P.crown) * 0.22 * Math.cos(3 * a)
    + num(P.scatter) * 0.3 * (e.rnd(i, 5) - 0.5)
    + num(P.bob) * 0.08 * Math.sin(TAU * (2 * e.p + e.rnd(i, 6)));
  return {
    x,
    y: -zr * Math.sin(num(P.tilt, 0.5)) * 0.8 + y0,
    z: zr * Math.cos(num(P.tilt, 0.5)) - radius * 0.35,
    ry: Math.sin(a) * num(P.lean, 0.25),
    b: 1 - num(P.backDim, 0.14) * (1 - ca),
    blur: num(P.backBlur) * (1 - ca) * 0.4,
  };
}

const FORMS: Formation[] = [
  (_i, count) => [0, 0, 2.6, 0, count - _i],
  (i, count) => {
    const a = lerp(-1.25, 1.25, i / Math.max(1, count - 1));
    return [Math.sin(a) * 1.02, 0.32 - Math.cos(a) * 0.7, 1.05, a * 0.5, i];
  },
  (i, count) => {
    const c = i % 5;
    const r = Math.floor(i / 5);
    const rows = Math.ceil(count / 5);
    return [(c - 2) * 0.44, 0.62 - r * 1.24 / Math.max(1, rows - 1), 1.15, 0, r];
  },
  (_i, count, random) => [(random(1) - 0.5) * 2.1, (random(2) - 0.5) * 1.35, 0.42 + random(3) * 0.62, (random(4) - 0.5) * 0.35, random(5) * count],
  (_i, count) => {
    const width = 1.02;
    const height = 0.64;
    const perimeter = 4 * (width + height);
    const u = _i / count * perimeter;
    const [x, y] = u < 2 * width
      ? [-width + u, height]
      : u < 2 * width + 2 * height
        ? [width, height - (u - 2 * width)]
        : u < 4 * width + 2 * height
          ? [width - (u - 2 * width - 2 * height), -height]
          : [-width, -height + (u - 4 * width - 2 * height)];
    return [x, y, 0.3, 0, _i];
  },
  (_i, count) => {
    const cols = Math.max(2, Math.ceil(Math.sqrt(count * 1.5)));
    const rows = Math.ceil(count / cols);
    const c = _i % cols;
    const r = Math.floor(_i / cols);
    return [(c - (cols - 1) / 2) * 2.05 / cols, ((rows - 1) / 2 - r) * 1.3 / rows, 0.2, 0, _i];
  },
  (_i, count, random) => {
    const a = random(6) * TAU;
    const d = Math.sqrt(random(7)) * 0.42;
    return [Math.cos(a) * d * 1.35, Math.sin(a) * d, 0.55 + random(8) * 0.45, (random(9) - 0.5) * 0.5, random(5) * count];
  },
];

function formationsLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const count = e.n;
  const segment = e.p * FORMS.length;
  const k = Math.floor(segment) % FORMS.length;
  const f = segment - Math.floor(segment);
  const random = (key: number) => e.rnd(i, 20 + key);
  const a = FORMS[k](i, count, random);
  const b = FORMS[(k + 1) % FORMS.length](i, count, random);
  const orderType = str(P.staggerBy, 'random');
  const order = orderType === 'sweep'
    ? i / Math.max(1, count - 1)
    : orderType === 'centre'
      ? Math.min(1, Math.hypot(a[0], a[1]) / 1.25)
      : random(0);
  const hold = num(P.formHold, 0.42);
  const stagger = num(P.stagger, 0.35);
  const start = hold + order * stagger * (1 - hold) * 0.5;
  const length = (1 - hold) * (1 - stagger * 0.5);
  const t = e.ez(clamp01((f - start) / Math.max(1e-3, length)));
  const mix = (key: number) => lerp(a[key], b[key], t);
  const fly = Math.sin(PI * t);
  const swirl = num(P.swirl) * PI * fly;
  const cs = Math.cos(swirl);
  const sn = Math.sin(swirl);
  const x0 = mix(0) * num(P.formScale, 1);
  const y0 = mix(1) * num(P.formScale, 1);
  return {
    x: x0 * cs - y0 * sn,
    y: x0 * sn + y0 * cs,
    z: fly * num(P.lift, 0.25) * random(10) + num(P.depthMix) * (random(11) - 0.5) * 1.2,
    s: mix(2),
    rz: mix(3) + swirl,
    ry: Math.round(num(P.flips)) * TAU * t,
    blur: num(P.flightBlur) * fly * 0.5,
    zBias: mix(4) * 0.002 + fly,
  };
}

interface RollPath {
  pts: [number, number, number, number][];
  lengths: number[];
  length: number;
  entry: number;
}

function rollPath(P: P, env: DynamicEnv): RollPath {
  const pts: RollPath['pts'] = [];
  const sway = num(P.sway, 0.6);
  const roll = num(P.roll, 0.22);
  const dr = Math.max(0.014, num(P.thick) * Math.min(env.w, env.h) * 1.1) * num(P.layerGap, 1);
  const top = 0.42;
  const flutter = num(P.flutter) * 0.22;
  const phase = TAU * env.p * 2;
  const xs = (v: number) => 0.62 * sway * Math.sin(PI * (num(P.snake, 1.3) * v + 0.15)) - 0.12 + flutter * Math.sin(phase - v * 5) * (1 - v);
  for (let k = 0; k <= 96; k++) {
    const v = k / 96;
    pts.push([xs(v), lerp(top - 2.72 * num(P.reach, 1), top, v), 1.5 * (1 - v) ** 2 * num(P.reach, 1), 0]);
  }
  const x1 = xs(1);
  const turnsCount = 4.5;
  const steps = Math.round(turnsCount * 56);
  for (let k = 1; k <= steps; k++) {
    const f = k / steps * turnsCount * TAU;
    const r = Math.max(0.03, roll - dr * f / TAU);
    pts.push([x1, top + r * Math.sin(f), -roll + r * Math.cos(f), 1 / r]);
  }
  const lengths = [0];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1];
    const b = pts[k];
    lengths.push(lengths[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  return { pts, lengths, length: lengths[lengths.length - 1], entry: lengths[96] };
}

function along(path: RollPath, distance: number): { p: Vec3; t: Vec3; k: number } {
  const { pts, lengths } = path;
  let lo = 0;
  let hi = lengths.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (lengths[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const t = (distance - lengths[lo]) / Math.max(1e-6, lengths[hi] - lengths[lo]);
  const length = Math.max(1e-6, lengths[hi] - lengths[lo]);
  return {
    p: [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)],
    t: [(b[0] - a[0]) / length, (b[1] - a[1]) / length, (b[2] - a[2]) / length],
    k: lerp(a[3], b[3], t),
  };
}

function filmRollFill(P: P, env: Env): Record<string, unknown> {
  const e = E(env);
  const path = rollPath(P, e);
  const length = num(P.flutter) ? rollPath({ ...P, flutter: 0 }, e).length : path.length;
  const count = e.n * Math.max(1, Math.min(14, Math.ceil(length / (e.h * (1 + num(P.gap, 0.03))) / e.n)));
  return { path, m: count, count };
}

function filmRollLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const path = e.path as RollPath;
  const distance = wrap((i - e.p * e.n) / e.m, 1) * path.length;
  const q = along(path, distance);
  const [tx, ty, tz] = q.t;
  let X: Vec3 = [1 - tx * tx, -tx * ty, -tx * tz];
  let Z: Vec3 = [0, -tz, ty];
  const twist = num(P.twist);
  if (twist) {
    const b = twist * PI * Math.max(0, 1 - distance / path.entry);
    const c = Math.cos(b);
    const sn = Math.sin(b);
    const rotate = (v: Vec3): Vec3 => [
      v[0] * c + (ty * v[2] - tz * v[1]) * sn,
      v[1] * c + (tz * v[0] - tx * v[2]) * sn,
      v[2] * c + (tx * v[1] - ty * v[0]) * sn,
    ];
    X = rotate(X);
    Z = rotate(Z);
  }
  const pitch = path.length / e.m;
  const opacity = sstep(0, pitch * 2, distance) * sstep(path.length, path.length - pitch * 3, distance);
  return {
    m: frame3(q.p[0], q.p[1], q.p[2], X, Z),
    bendY: q.k,
    o: opacity,
    b: 1 - num(P.rollShade) * sstep(path.entry, path.entry + pitch * 6, distance),
    blur: num(P.nearBlur) * 0.6 * (1 - sstep(0, path.entry * 0.5, distance)),
    zBias: -Math.max(0, distance - path.entry) * 0.2,
    w: e.w,
    h: e.h * Math.min(1, pitch / (e.h * (1 + num(P.gap, 0.03)))),
  };
}

function glassRowLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const u0 = stepU(e.p, e.n, e.hold, e.ez);
  const drift = num(P.drift);
  const u = drift ? lerp(u0, e.p * e.n, drift) : u0;
  const r = rel(i, u, e.m);
  const ar = ab(r);
  const x = r * e.w * (1 + num(P.gap, 0.06));
  const stretch = num(P.stretch);
  const motionBlur = num(P.mblur);
  const speed = stretch || motionBlur ? stepSpeed(e.p, e.n, e.hold, e.ez) : 0;
  const g = speed / (speed + 3);
  return {
    x,
    y: num(P.slope) * r * e.h * 0.18,
    z: -num(P.arc) * x * x * 0.2 - num(P.sideDepth) * Math.min(ar, 2) * 0.35,
    ry: -num(P.sideTurn) * Math.tanh(r) * 0.7,
    s: 1 + num(P.focus) * 0.2 * (1 - sstep(0, 1, ar)),
    b: 1 - num(P.sideDim) * sstep(0.4, 1.6, ar),
    blur: motionBlur * 0.5 * g,
    w: e.w * (1 + stretch * 0.4 * g),
    o: wrapFade(r, e.m),
  };
}

function twistBandFill(P: P, env: Env): Record<string, unknown> {
  const e = E(env);
  const cols = Math.round(num(P.cols, 3));
  const base = Math.ceil(e.n / cols);
  const pitch = e.h * (1 + num(P.gap, 0.06));
  const rows = fillSlots(e.vy + e.h * 2, pitch, base, cols);
  return { cols, base, rows, pitch, count: rows * cols };
}

function twistBandLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const cols = e.cols as number;
  const base = e.base as number;
  const rows = e.rows as number;
  const pitch = e.pitch as number;
  const c = i % cols;
  const r = Math.floor(i / cols);
  const v = wrap(r - e.p * base, rows) - rows / 2 + 0.5;
  const y = v * pitch + num(P.colShift) * (c - (cols - 1) / 2) * pitch * 0.5;
  const th = num(P.twist, 1.15) * Math.sin(y * num(P.twistRate, 1.1) + 0.4 - TAU * e.p * Math.round(num(P.travel)));
  const xl = (c - (cols - 1) / 2) * e.w * (1 + num(P.gap, 0.06));
  const k = num(P.curve, 0.75) / 1.2;
  let x = xl;
  let z = 0;
  let ry = 0;
  if (k > 0.01) {
    const g = xl * k;
    x = Math.sin(g) / k;
    z = (Math.cos(g) - 1) / k;
    ry = g;
  }
  const ct = Math.cos(th);
  const sn = Math.sin(th);
  return {
    x: x * ct + z * sn + num(P.snake) * 0.35 * Math.sin(y * 0.9),
    y,
    z: -x * sn + z * ct,
    ry: ry + th,
    bend: k,
    b: 1 - num(P.turnShade, 0.22) + num(P.turnShade, 0.22) * Math.cos(ry + th),
    o: clamp01((rows / 2 - ab(v)) * 1.2) * (1 - num(P.endFade) * sstep(0.35, 1, ab(y) / e.vy)),
    img: (r % base) * cols + c,
  };
}

function flipTrioLayout(i: number, P: P, env: Env): CardPose {
  const e = E(env);
  const gap = num(P.gap, 0.32);
  const r = rel(i, stepU(e.p, e.n, e.hold, e.ez), e.m);
  const ar = ab(r);
  const flip = -sgn(r) * Math.pow(ar, num(P.timing, 1)) * PI * num(P.flip, 0.85);
  const axis = str(P.axis, 'y');
  const edge = sstep(0, 1.2, ar);
  return {
    x: r * e.w * (1 + gap),
    y: num(P.hop) * e.h * 0.25 * ab(Math.sin(PI * r)),
    z: -ar * num(P.sideDepth, 0.12),
    ry: axis === 'x' ? 0 : axis === 'xy' ? flip * 0.75 : flip,
    rx: axis === 'x' ? flip : axis === 'xy' ? flip * 0.75 : 0,
    rz: -num(P.fan) * r * 0.25,
    s: 1 - num(P.sideScale) * Math.min(ar, 1.5) * 0.4,
    b: 1 - num(P.sideDim) * edge,
    blur: num(P.sideBlur) * edge * 0.6,
    o: wrapFade(r, e.m),
  };
}

const NEW_TEMPLATE = { isNew: true };

export const SIGNATURE_TEMPLATES: Template[] = [
  {
    ...NEW_TEMPLATE,
    id: 'shelf', name: 'Record Shelf', cat: 'signature', n: 14, aspect: 1, cardH: 0.92, dur: 32, fov: 30, frame: '5:4',
    desc: 'Album sleeves stand edge-on along a shelf and lean toward the middle as they glide past.',
    params: params([
      group('Layout'), range('pitch', 'Spacing', 0.12, 0.6, 0.2), off('centreGap', 'Centre gap', 1.5, { hint: 'sleeves part round the middle, like flicking through a crate' }), off('arc', 'Shelf curve', 1), off('sizeMix', 'Sleeve sizes', 1),
      group('Motion'), range('angle', 'Lean', 30, 89, 86, 1, { unit: '\u00b0' }), range('turnZone', 'Turn width', 0.3, 3, 1, 0.01, { unit: '\u00d7' }), off('pull', 'Pull out', 1),
      group('Look'), range('edgeBlur', 'Edge blur', 0, 1, 0.55), off('edgeDim', 'Edge dim', 1), off('edgeFade', 'Edge fade', 1),
    ]),
    fill: (P, env) => { const e = E(env); return stripFill(e, e.vx + e.w * (1 + num(P.centreGap) * 0.5), e.w * num(P.pitch, 0.2)); },
    layout: shelfLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'portal-ring', name: 'Spiral Portal', cat: 'signature', n: 18, aspect: 1.3, cardH: 0.3, dur: 15, frame: '5:4',
    desc: 'A spiral of screens rushes out of the distance and sweeps past the camera, ring after ring.',
    params: params([
      group('Layout'), whole('rings', 'Rings', 1, 5, 3), range('radius', 'Radius', 0.5, 2, 1.02), range('open', 'Spiral', 0, 1, 0.4), range('tilt', 'Tilt', -1, 1, 0.32),
      off('twistStep', 'Ring offset', 1, { hint: 'each ring turns a little further than the last' }), range('depthLen', 'Tunnel depth', 0.4, 1.6, 1, 0.01, { unit: '\u00d7' }),
      group('Motion'), turns('whirl', 'Turns', 1), range('rush', 'Rush', -1, 1, 0, 0.01, { hint: 'below 0 rings arrive fast then ease; above 0 they creep then rush' }), range('veer', 'Veer', -1, 1, 0),
      group('Look'), range('faceIn', 'Face in', 0, 3, 1, 0.01, { unit: '\u00d7' }), off('fog', 'Fog', 1),
    ]),
    fill: portalRingFill,
    layout: portalRingLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'icon-drum', name: 'Icon Drum', cat: 'signature', n: 12, aspect: 1, cardH: 0.58, dur: 24, frame: '5:4',
    style: { card: { radius: 0.24 } },
    desc: 'Chunky rounded tiles packed round a turning drum, like an app dock rolled into a wheel.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.04), range('drumR', 'Drum size', 0.6, 2, 1, 0.01, { unit: '\u00d7' }), whole('rows', 'Rows', 1, 3, 1),
      group('Motion'), turns('whirl', 'Turns', 1), off('click', 'Tick', 1, { hint: 'the drum clicks round tile by tile' }), range('ringTilt', 'Wobble', -1, 1, 0), off('breathe', 'Breathe', 1),
      group('Look'), range('backDim', 'Back shade', 0, 1, 0.38), off('magnify', 'Magnify', 1), off('backBlur', 'Back blur', 1),
    ]),
    fill: iconDrumFill,
    layout: iconDrumLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'crumple', name: 'Crumple Strip', cat: 'signature', n: 10, aspect: 0.78, cardH: 0.86, step: true, perCard: 1.6, frame: '5:4',
    desc: 'Posters slide along a row; each one scrunches into a ball of paper as it leaves the middle and smooths out as it arrives.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.03), range('crushAt', 'Crush point', 0.4, 3, 1, 0.01, { hint: 'how far from the middle a poster is fully crushed' }),
      group('Motion'), range('crush', 'Crumple', 0, 1, 0.75), range('shrink', 'Shrink', 0, 0.5, 0.1), range('sink', 'Push back', 0, 1, 0.12), off('drop', 'Drop', 1), range('roll', 'Roll', -1, 1, 0),
      range('twistR', 'Random twist', 0, 1.5, 0.45), off('recoil', 'Pop back', 1, { hint: 'a smoothed poster overshoots a little as it arrives' }),
      group('Look'), off('ballDim', 'Shade', 0.8),
    ]),
    fill: (P, env) => { const e = E(env); return stripFill(e, e.vx, e.w * (1 + num(P.gap, 0.03))); },
    layout: crumpleLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'halo', name: 'Halo', cat: 'signature', n: 36, aspect: 0.78, cardH: 0.4, dur: 40, frame: '5:4',
    mods: { poseRz: -7 },
    desc: 'A wide halo of front-facing cards circles slowly, the near side sweeping across the far side.',
    params: params([
      group('Layout'), range('radius', 'Radius', 0.6, 2, 1.2), range('oval', 'Width', -0.5, 1, 0), off('crown', 'Crown', 1), off('scatter', 'Scatter', 1), range('tilt', 'View angle', 0, 1.3, 0.5),
      group('Motion'), turns('whirl', 'Turns', 1), range('lean', 'Lean', 0, 1, 0.25), off('bob', 'Float', 1),
      group('Look'), range('backDim', 'Depth shade', 0, 0.45, 0.14), off('backBlur', 'Back blur', 1),
    ]),
    fill: (_P, env) => ({ count: env.n }),
    layout: haloLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'formations', name: 'Formations', cat: 'signature', n: 96, aspect: 0.8, cardH: 0.3, dur: 17, frame: '5:4',
    desc: 'A hundred small photos regroup: one card, a fanned arc, columns, a scatter, a frame, a dot grid, a cluster, and back to one.',
    params: params([
      group('Shape'), range('formScale', 'Shape size', 0.5, 1.4, 1, 0.01, { unit: '\u00d7' }), off('depthMix', 'Depth', 1),
      group('Motion'), range('formHold', 'Hold', 0.1, 0.8, 0.42), range('stagger', 'Stagger', 0, 0.6, 0.35), segment('staggerBy', 'Stagger order', { random: 'Random', sweep: 'Sweep', centre: 'Centre out' }, 'random'),
      range('lift', 'Lift', 0, 1.5, 0.25), range('swirl', 'Swirl', -1, 1, 0), whole('flips', 'Flips', 0, 2, 0, { unit: ' turns' }), select('ease', 'Easing', { inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear' }, 'inOutQuint'),
      group('Look'), off('flightBlur', 'Motion blur', 1),
    ]),
    fill: (_P, env) => ({ count: env.n }),
    layout: formationsLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'film-roll', name: 'Film Roll', cat: 'signature', n: 16, aspect: 1.55, cardH: 0.3, dur: 22, frame: '4:5',
    mods: { poseRy: -40, poseRx: 14, offX: 0.22, offY: -0.08 },
    desc: 'A strip of photos unspools from a roll and snakes down toward the camera in an S-curve.',
    params: params([
      group('Layout'), range('roll', 'Roll size', 0.12, 0.4, 0.22), range('layerGap', 'Roll looseness', 0.3, 3, 1, 0.01, { unit: '\u00d7' }), range('reach', 'Unroll length', 0.5, 1.4, 1, 0.01, { unit: '\u00d7' }),
      range('snake', 'Strip curl', 0.4, 2.5, 1.3), range('sway', 'Sway', 0, 1, 0.6), range('gap', 'Gap', 0, 0.8, 0.03),
      group('Motion'), off('flutter', 'Flutter', 1), range('twist', 'Twist', -1, 1, 0, 0.01, { hint: 'the loose end turns over as it comes toward you' }),
      group('Look'), off('rollShade', 'Roll shade', 0.8), off('nearBlur', 'Near blur', 1),
    ]),
    fill: filmRollFill,
    layout: filmRollLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'glass-row', name: 'Glass Gallery', cat: 'signature', n: 10, aspect: 0.8, cardH: 0.86, step: true, perCard: 2, frame: '5:4',
    style: { glass: { on: true, mode: 'per', top: 0, bottom: 0, left: 1, right: 1, width: 0.34, refraction: 0.9, curve: 'panel', dispersion: 0.9, soften: 0.35, feather: 0, highlight: 0.35, bulge: 0.95, stretch: 0 } },
    desc: 'A clean row of photos steps along while the frame edges bend them like thick liquid glass.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.06), off('arc', 'Curve', 1), range('slope', 'Slope', -1, 1, 0), range('sideTurn', 'Side turn', -1, 1, 0), off('sideDepth', 'Push back', 1),
      group('Motion'), off('focus', 'Centre zoom', 1), off('drift', 'Glide', 1, { hint: 'keeps the row drifting between steps' }), off('stretch', 'Speed stretch', 1),
      group('Look'), off('sideDim', 'Side dim', 1), off('mblur', 'Motion blur', 1),
    ]),
    fill: (P, env) => { const e = E(env); return stripFill(e, e.vx * (1 + num(P.arc) + num(P.sideDepth)), e.w * (1 + num(P.gap, 0.06))); },
    layout: glassRowLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'twist-band', name: 'Twist Band', cat: 'signature', n: 18, aspect: 1.3, cardH: 0.4, dur: 30, frame: '5:4',
    mods: { poseRz: -9, poseRx: 6 },
    desc: 'Rows of screens ride up a curved band that twists like a ribbon in the air.',
    params: params([
      group('Layout'), range('cols', 'Columns', 1, 5, 3, 1), range('gap', 'Gap', 0, 0.8, 0.06), range('curve', 'Curve', 0, 1.5, 0.75), off('colShift', 'Column offset', 1), range('snake', 'S-bend', -1, 1, 0),
      group('Motion'), range('twist', 'Twist', 0, 2.5, 1.15), range('twistRate', 'Twist rate', 0.3, 3, 1.1), whole('travel', 'Twist travel', -3, 3, 0, { unit: '\u00d7', hint: 'whole waves per loop, so it stays seamless' }),
      group('Look'), range('turnShade', 'Turn shade', 0, 0.6, 0.22), off('endFade', 'Edge fade', 1),
    ]),
    fill: twistBandFill,
    layout: twistBandLayout,
  },
  {
    ...NEW_TEMPLATE,
    id: 'flip-trio', name: 'Flip Trio', cat: 'signature', n: 8, aspect: 0.82, cardH: 0.78, step: true, perCard: 2.4, frame: '5:4',
    style: { glass: { on: true, mode: 'per', top: 0, bottom: 0, left: 1, right: 1, width: 0.2, refraction: 0.4, curve: 'wave', dispersion: 0.9, soften: 0.2, feather: 0, highlight: 0.3, bulge: 0.5, stretch: 2.2 } },
    desc: 'Three cards step along; each one flips round as it takes the middle, while the frame edges smear into glass.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.32), range('sideDepth', 'Side depth', 0, 1, 0.12), off('sideScale', 'Side scale', 0.6), range('fan', 'Fan', -1, 1, 0),
      group('Motion'), range('flip', 'Flip', 0, 1.2, 0.85), segment('axis', 'Flip axis', { y: 'Vertical', x: 'Horizontal', xy: 'Diagonal' }, 'y'),
      range('timing', 'Flip timing', 0.4, 2.5, 1, 0.01, { hint: 'above 1 the flip waits until the card is nearly centred' }), range('hop', 'Hop', -1, 1, 0),
      group('Look'), off('sideDim', 'Side dim', 1), off('sideBlur', 'Side blur', 1),
    ]),
    fill: (P, env) => { const e = E(env); return stripFill(e, e.vx, e.w * (1 + num(P.gap, 0.32))); },
    layout: flipTrioLayout,
  },
];
