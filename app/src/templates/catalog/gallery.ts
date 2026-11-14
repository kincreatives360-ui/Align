import type { Env, P, Template, CardPose } from '../types';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl, ReferenceSelectControl } from '../referenceControls';
import { ab, aim, clamp01, lerp, M, num, rel, RY, RX, RZ, S, stepU, stripFill, str, TAU, T, wrap, wrapFade } from '../kit';

const PI = Math.PI;
type GalleryEnv = Env & {
  Rs?: number; cols?: number; rows?: number; gx?: number; gy?: number;
  salon?: Array<{ x: number; y: number; h: number; a: number }>;
  Lx?: number; copies?: number;
  G?: number; cell?: number[]; moving?: number; from?: number; to?: number; f?: number;
};

const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, def = 0, step = 0.01) => range(key, label, 0, max, def, step, { off: true });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const select = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSelectControl => ({ key, label, type: 'select', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
const NEW = { isNew: true, frame: '5:4' as const };
const SALON: [number, number][][] = [[[0.75, 1.3]], [[1.4, 0.62], [1, 0.58]], [[1.5, 0.86]], [[1, 0.4], [1, 0.4], [1, 0.4]], [[0.8, 0.8], [1.3, 0.5]], [[0.7, 1.05]]];

function fisheyeFill(P: P, E: Env): Record<string, number> {
  const Rs = lerp(7, 1.3, num(P.bulge, 0.78)), gx = E.w * (1 + num(P.gap, 0.16)), gy = E.h * (1 + num(P.gap, 0.16));
  const ax = Math.min(1.5, (E.vx + E.w) / Rs * 1.15) + 0.35, ay = Math.min(1.5, (E.vy + E.h) / Rs * 1.15) + 0.35;
  const cols = Math.min(24, 2 * Math.ceil(ax * Rs / gx) + 1), rows = Math.min(20, 2 * Math.ceil(ay * Rs / gy) + 1);
  return { Rs, cols, rows, gx, gy, count: cols * rows };
}
function fisheyeLayout(i: number, P: P, E0: Env): CardPose {
  const E = E0 as GalleryEnv, cols = Number(E.cols), rows = Number(E.rows), c = i % cols, r = Math.floor(i / cols), k = 1 + num(P.breath) * 0.4 * (0.5 - 0.5 * Math.cos(TAU * E.p));
  const ux = wrap(c + (r % 2) * num(P.brick) * 0.5 + E.p * num(P.driftX, 1) * cols, cols) - cols / 2 + 0.5;
  const uy = wrap(r + E.p * num(P.driftY, 1) * rows, rows) - rows / 2 + 0.5;
  let th = ux * Number(E.gx) / Number(E.Rs) * k, ph = uy * Number(E.gy) / Number(E.Rs) * k;
  if (num(P.swirl)) { const g = num(P.swirl) * Math.hypot(th, ph), c0 = Math.cos(g), sn = Math.sin(g); [th, ph] = [th * c0 - ph * sn, th * sn + ph * c0]; }
  const cp = Math.cos(ph), Rs = Number(E.Rs), nx = Math.sin(th) * cp, ny = Math.sin(ph), nz = Math.cos(th) * cp;
  const psi = Math.acos(Math.max(-1, Math.min(1, nz))), facing = aim(nx, ny, nz);
  const o = clamp01((1.5 - psi) * 3) * clamp01((cols / 2 - ab(ux)) * 2) * clamp01((rows / 2 - ab(uy)) * 2);
  return { x: Rs * nx, y: Rs * ny, z: Rs * (nz - 1), rx: facing.rx * (1 - num(P.flatten)), ry: facing.ry * (1 - num(P.flatten)), o, b: 1 - num(P.edgeShade, 0.3) * (1 - nz), blur: num(P.edgeBlur) * clamp01(psi / 1.3), img: r * cols + c };
}
function salonFill(P: P, E: Env): Record<string, unknown> {
  const pat = SALON.map(col => col.map(([a, h]) => [a, Math.pow(h, num(P.contrast, 1))] as [number, number]));
  const gap = num(P.gap, 0.1) * E.h, cards: Array<{ x: number; y: number; h: number; a: number }> = [];
  let x = 0, pi = 0;
  while (cards.length < E.n) {
    const col = pat[pi++ % pat.length], wCol = Math.max(...col.map(([a, h]) => a * h)) * E.h;
    const hCol = col.reduce((sum, [, h]) => sum + h * E.h, 0) + gap * (col.length - 1);
    let y = hCol / 2;
    const dy = (E.rnd(pi, 5) - 0.5) * num(P.stagger, 0.5) * 0.3;
    for (const [a, h] of col) {
      if (cards.length >= E.n) break;
      const hh = h * E.h;
      cards.push({ x: x + wCol / 2, y: y - hh / 2 + dy, h: hh, a });
      y -= hh + gap;
    }
    x += wCol + gap * 1.6;
  }
  const copies = Math.max(1, Math.min(8, Math.ceil((2 * E.vx + 2 * E.w) / x))) + 1;
  return { salon: cards, Lx: x, copies, count: E.n * copies };
}
function salonLayout(i: number, P: P, E0: Env): CardPose {
  const E = E0 as GalleryEnv, k = i % E.n, c = E.salon![k], L = Number(E.Lx) * Number(E.copies);
  const x = wrap(c.x + Math.floor(i / E.n) * Number(E.Lx) - E.p * Number(E.Lx) * Math.round(num(P.passes, 1)), L) - L / 2;
  const q = Math.min(1, ab(x) / E.asp);
  return { x, y: c.y, z: (E.rnd(k, 6) - 0.5) * num(P.depth, 0.12) + num(P.approach) * 0.5 * (1 - q) ** 2,
    rz: (E.rnd(k, 7) - 0.5) * num(P.crooked) + num(P.swing) * Math.sin(TAU * (2 * E.p + E.rnd(k, 8))), h: c.h, aspect: c.a,
    o: clamp01((L / 2 - ab(x)) / (E.w * 0.8)), b: 1 - num(P.edgeDim) * q, blur: num(P.edgeBlur) * q * q };
}
function mirrorFill(P: P, E: Env): Record<string, number> {
  const F = stripFill(E, E.vx, E.w * (1 + num(P.gap, 0.14)));
  return { m: F.m, count: 2 * F.m };
}
function mirrorLayout(i: number, P: P, E: Env): CardPose {
  const j = i % E.m, refl = i >= E.m, r = rel(j, E.p * E.n, E.m), x = r * E.w * (1 + num(P.gap, 0.14));
  const floor = num(P.floor, -0.42), y = floor + E.h / 2 + num(P.hop, 0.06) * ab(Math.sin(PI * r * Math.round(num(P.hops, 1))));
  const z = -num(P.arc, 0.35) * x * x * 0.35, ry = -num(P.arc, 0.35) * x * 0.3, rz = num(P.tip) * Math.sin(TAU * r * Math.round(num(P.hops, 1)));
  const o = wrapFade(r, E.m), b = 1 - num(P.edgeDim) * Math.min(1, ab(x) / E.asp);
  if (!refl) return { x, y, z, ry, rz, o, b };
  return { m: M(T(x, 2 * floor - y - num(P.rGap, 0.01), z), RY(ry), RZ(-rz), S(1, -1, 1)), o: o * num(P.reflect, 0.32), b: 0.85 * b, blur: num(P.rBlur, 0.15), zBias: -1 };
}
function puzzleRng(seed: number): () => number {
  let state = (seed * 2654435761) >>> 0;
  return () => { state = (state + 0x6D2B79F5) | 0; let t = Math.imul(state ^ (state >>> 15), 1 | state); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function puzzleFill(P: P, E: Env): Record<string, unknown> {
  const G = Math.round(num(P.grid, 4)), N = G * G, random = puzzleRng(num(P.shuffle, 7) * 31 + G), K = Math.round(num(P.moves, 12));
  let empty = N - 1, prev = -1;
  const walk: number[] = [];
  for (let k = 0; k < K; k++) {
    const neighbors = [empty - G, empty + G, empty % G ? empty - 1 : -1, empty % G < G - 1 ? empty + 1 : -1].filter(cell => cell >= 0 && cell < N && cell !== prev);
    const cell = neighbors[Math.floor(random() * neighbors.length)];
    walk.push(cell); prev = empty; empty = cell;
  }
  const steps = walk.concat(walk.slice(0, -1).reverse(), [N - 1]);
  const cell = Array.from({ length: N - 1 }, (_, index) => index), at = Array.from({ length: N }, (_, index) => index < N - 1 ? index : -1);
  const U = E.p * steps.length, done = Math.floor(U), f = (E.ez as (value: number) => number)(clamp01((U - done - num(P.pause, 0.35)) / Math.max(0.05, 1 - num(P.pause, 0.35))));
  empty = N - 1;
  let moving = -1, from = -1, to = -1;
  for (let k = 0; k <= done && k < steps.length; k++) {
    const c = steps[k], tile = at[c];
    if (k === done) { moving = tile; from = c; to = empty; break; }
    at[empty] = tile; cell[tile] = empty; at[c] = -1; empty = c;
  }
  return { G, cell, moving, from, to, f, count: N - 1 };
}
function puzzleLayout(i: number, P: P, E0: Env): CardPose {
  const E = E0 as GalleryEnv, G = Number(E.G), pitch = 1.86 / G;
  const pos = (c: number): [number, number] => [(c % G - (G - 1) / 2) * pitch, ((G - 1) / 2 - Math.floor(c / G)) * pitch];
  let [x, y] = pos(E.cell![i]), z = 0, rx = 0, ry = 0;
  if (i === E.moving) {
    const [x0, y0] = pos(Number(E.from)), [x1, y1] = pos(Number(E.to)), k = Math.sin(PI * Number(E.f));
    x = lerp(x0, x1, Number(E.f)); y = lerp(y0, y1, Number(E.f)); z = num(P.liftT, 0.06) * k;
    ry = num(P.tip) * k * Math.sign(x1 - x0); rx = -num(P.tip) * k * Math.sign(y1 - y0);
  }
  return { x, y, z, rx, ry, rz: (E.rnd(i, 1) - 0.5) * num(P.loose) * 0.4, h: pitch * (1 - num(P.gap, 0.06)), aspect: 1,
    zBias: i === E.moving ? 2 : 0, b: i === E.moving ? 1 : 1 - num(P.restDim), img: i };
}
function slotFill(P: P): Record<string, number> { return { count: Math.round(num(P.reels, 3)) * 8 }; }
function slotLayout(i: number, P: P, E: Env): CardPose {
  const R = Math.round(num(P.reels, 3)), reel = Math.floor(i / 8), k = i % 8, Sp = Number(P.spins ?? 2), adv = 8 / Sp + 8 * Math.round(num(P.laps, 2));
  const q = E.p * Sp, j = Math.floor(q), f = q - j, requestedStagger = num(P.stagger, 0.08), fullStagger = Math.min(requestedStagger * Math.max(0, R - 1), 0.275), stagger = R > 1 ? fullStagger / (R - 1) : requestedStagger, st = 0.06 + reel * stagger, len = 0.72 - (R - 1) * stagger * 0.2;
  const g = f < st ? 0 : f > st + len ? 1 : (() => { const t = (f - st) / len, c1 = 1.70158 * num(P.bounce, 1), c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; })();
  const turn = (j * adv + g * adv) / 8 * TAU, a = k / 8 * TAU - turn, rad = E.h * 1.04 * num(P.reelR, 1) / (2 * Math.tan(PI / 8)), ca = Math.cos(a);
  const sp = f > st && f < st + len ? (1 - (f - st) / len) : 0, won = f < st ? 1 - sstep(st - 0.04, st, f) : sstep(st + len, st + len + 0.06, f);
  return { x: (reel - (R - 1) / 2) * E.w * (1 + num(P.gap, 0.12)), y: rad * Math.sin(a), z: rad * ca - rad, rx: -a,
    s: 1 + num(P.winner) * Math.pow(Math.max(0, ca), 6) * won, o: clamp01((ca + 0.1) * 3), b: 1 - num(P.drumShade, 0.45) + num(P.drumShade, 0.45) * Math.max(0, ca),
    blur: Math.min(0.8, sp * num(P.mblur, 1.2)), img: reel * 8 + k };
}
function sstep(a: number, b: number, value: number): number { const t = clamp01((value - a) / (b - a)); return t * t * (3 - 2 * t); }
function apertureFill(P: P, E: Env): Record<string, number> { return { count: E.n + Math.round(num(P.blades, 8)) }; }
function apertureLayout(i: number, P: P, E: Env): CardPose {
  const n = E.n, u = stepU(E.p, n, E.hold, E.ez), k = Math.floor(u), f = u - k, c = Math.sin(PI * f);
  if (i < n) { const show = f < 0.5 ? wrap(k, n) : wrap(k + 1, n); return { o: i === show ? 1 : 0, s: 1.02 - 0.04 * c, zBias: 0, b: 1 - num(P.heroDim) * c }; }
  const B = Math.round(num(P.blades, 8)), b = i - n, ph = b / B * TAU + num(P.twist, 0.7) * c + Math.round(num(P.irisTurn)) * E.p * TAU, r = lerp(num(P.open, 2.05), num(P.closed, 0.26), c);
  return { x: r * Math.cos(ph), y: r * Math.sin(ph), z: 0.05 + b * 0.002, rz: ph + PI / 2 + c * num(P.roll, 0.4), h: num(P.bladeW, 0.62), w: num(P.blade, 1.5), aspect: num(P.blade, 1.5) / num(P.bladeW, 0.62), b: num(P.bladeTone, 0.9), zBias: 5 + b * 0.01, img: n + b };
}
function moodBoardLayout(i: number, P: P, E: Env): CardPose {
  const k = i % E.n, r = rel(i, E.p * E.n, E.m), random = (seed: number) => E.rnd(k, seed), layer = random(3);
  const z = (layer < 0.34 ? -1.8 : layer < 0.68 ? -0.7 : 0.45) * num(P.depth, 0.7);
  return { x: r * E.w * num(P.spacing, 0.42), y: (random(1) - 0.5) * num(P.spanY, 1.5) + Math.sin(TAU * (E.p * Math.round(num(P.floatN, 2)) + random(5))) * num(P.float, 0.06),
    z, rz: (random(4) - 0.5) * 0.35 * num(P.scatter, 0.6), ry: num(P.turn) * (random(6) - 0.5) * 1.2,
    s: 0.7 + random(2) * num(P.sizeMix, 0.45), blur: Math.min(0.6, ab(z) * 0.28 * num(P.dof, 0.55)),
    b: 1 - num(P.farDim) * clamp01(-z / 1.8) * 0.6, o: wrapFade(r, E.m), zBias: z };
}

export const GALLERY_TEMPLATES: Template[] = [
  { ...NEW, id: 'crate', name: 'Vinyl Crate', cat: 'gallery', n: 40, aspect: 0.8, cardH: 0.36, dur: 36,
    desc: 'A ring of photos standing edge-on like records in a crate, turning slowly under a high camera.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('oval', 'Oval', -0.5, 0.5, 0), range('tilt', 'View angle', 0, 1.4, 0.72), range('lean', 'Lean', -1, 1, 0.18), group('Motion'), whole('revs', 'Turns', -2, 2, 1), off('pull', 'Pull-out', 0.6), range('wobble', 'Wobble', 0, 0.4, 0.06), whole('wobSp', 'Wobble speed', 0, 4, 2), group('Look'), range('backShade', 'Back shade', 0, 0.6, 0.2), off('fog', 'Depth blur', 1)]),
    layout(i, P, E) { const R = 0.9 * num(P.radius, 1), a = (i / E.n + E.p * Math.round(num(P.revs, 1))) * TAU, c = Math.cos(a), y = num(P.wobble, 0.06) * Math.sin(a * 3 + E.p * TAU * Math.round(num(P.wobSp, 2))) + num(P.pull) * Math.pow(Math.max(0, c), 12); return { m: M(RX(num(P.tilt, 0.72)), T(R * (1 + num(P.oval)) * Math.sin(a), y, R * (1 - num(P.oval)) * c), RY(a + PI / 2 + num(P.lean, 0.18))), b: 1 - num(P.backShade, 0.2) + num(P.backShade, 0.2) * c, blur: num(P.fog) * (0.5 - 0.5 * c) }; } },
  { ...NEW, id: 'fisheye', name: 'Fisheye Wall', cat: 'gallery', n: 24, aspect: 0.8, cardH: 0.6, dur: 60, desc: 'An endless wall of photos drifting diagonally under a fisheye lens; the edges bow away.',
    params: params([group('Layout'), range('bulge', 'Bulge', 0, 1, 0.78), range('gap', 'Gap', 0, 0.8, 0.16), off('brick', 'Brick offset', 1), off('flatten', 'Face camera', 1), group('Motion'), whole('driftX', 'Drift X', -2, 2, 1, { unit: '\u00d7', hint: 'whole wall widths per loop, so every photo comes back to its place' }), whole('driftY', 'Drift Y', -2, 2, 1, { unit: '\u00d7' }), off('breath', 'Lens breathe', 1), off('swirl', 'Lens swirl', 1), group('Look'), range('edgeShade', 'Edge shade', 0, 1, 0.3), off('edgeBlur', 'Edge blur', 1)]), fill: fisheyeFill, layout: fisheyeLayout },
  { ...NEW, id: 'planetarium', name: 'Planetarium', cat: 'gallery', n: 80, aspect: 0.8, cardH: 1.2, dur: 40, fov: 72, desc: 'Stand inside a slowly turning sphere of photos; a soft spotlight follows your gaze.',
    params: params([group('Layout'), range('radius', 'Radius', 2, 6, 3.2), range('jitter', 'Scatter', 0, 1, 0.45), off('band', 'Band', 1), range('axis', 'Axis tilt', -0.6, 1.2, 0.32), group('Motion'), whole('whirl', 'Turns', -3, 3, 1, { unit: '\u00d7', hint: 'whole turns per loop, so it stays seamless' }), range('swell', 'Breathe', 0, 0.3, 0.04), off('nod', 'Nod', 0.6), group('Look'), range('focus', 'Spotlight', 0.3, 4, 1.5), range('aimX', 'Spotlight pan', -0.8, 0.8, 0), range('dreamy', 'Haze', 0, 1, 0.35)]),
    camera: () => ({ eye: [0, 0, 0], target: [0, 0, -1] }),
    layout(i, P, E) { const y0 = (1 - 2 * (i + 0.5) / E.n) * (1 - num(P.band) * 0.85), r0 = Math.sqrt(Math.max(0, 1 - y0 * y0)), g = i * 2.399963229728653; let x = Math.cos(g) * r0, y = y0, z = Math.sin(g) * r0; x += (E.rnd(i, 1) - 0.5) * 0.5 * num(P.jitter, 0.45); y += (E.rnd(i, 2) - 0.5) * 0.5 * num(P.jitter, 0.45); z += (E.rnd(i, 3) - 0.5) * 0.5 * num(P.jitter, 0.45); const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l; const a = E.p * TAU * num(P.whirl, 1), ca = Math.cos(a), sa = Math.sin(a), tl = num(P.axis, 0.32) + num(P.nod) * Math.sin(E.p * TAU), ct = Math.cos(tl), st = Math.sin(tl); [x, z] = [x * ca + z * sa, -x * sa + z * ca]; [y, z] = [y * ct - z * st, y * st + z * ct]; const R = num(P.radius, 3.2) * (1 + num(P.swell, 0.04) * Math.sin(TAU * (2 * E.p + E.rnd(i, 4)))), c = -z * Math.cos(num(P.aimX)) + x * Math.sin(num(P.aimX)); return { x: x * R, y: y * R, z: z * R, ...aim(-x, -y, -z), o: Math.pow(sstep(-0.2, 1, c), num(P.focus, 1.5)), b: 0.75 + 0.25 * Math.max(0, c), blur: (1 - Math.max(0, c)) * num(P.dreamy, 0.35) }; } },
  { ...NEW, id: 'dock', name: 'Thumb Dock', cat: 'gallery', n: 8, aspect: 0.8, step: true, perCard: 2.2, desc: 'A full-bleed hero with a dock of thumbnails; the dock scrolls and each thumb becomes the hero.',
    params: params([group('Layout'), segment('orient', 'Dock', { v: 'Vertical', h: 'Horizontal' }, 'v'), range('thumb', 'Thumb size', 0.5, 2, 1), range('side', 'Dock position', -1, 1, 0), range('gap', 'Gap', 0, 0.8, 0.18), group('Motion'), range('zoom', 'Hero zoom', 0, 0.25, 0.07), range('pan', 'Hero pan', -1, 1, 0), off('slideIn', 'Slide in', 1), range('pop', 'Active pop', 0, 0.6, 0.28), group('Look'), range('heroTone', 'Hero brightness', 0.5, 1.2, 0.96), off('falloff', 'Thumb falloff', 1)]), fill: (_P, E) => ({ count: 2 * E.n }),
    layout(i, P, E) { const n = E.n, u = stepU(E.p, n, E.hold, E.ez), k = Math.floor(u), f = u - k; if (i < n) { const cur = wrap(k, n), nxt = wrap(k + 1, n), live = i === cur ? 1 : i === nxt ? 2 : 0, age = live === 1 ? 1 + f : f, s = 1 + num(P.zoom, 0.07) * age * 0.5; return { x: num(P.pan) * (s - 1) * E.asp + (live === 2 ? (1 - f) * num(P.slideIn) * 2 * E.asp : 0), h: 2.04, aspect: E.asp, s, o: live === 1 ? 1 : live === 2 ? f : 0, zBias: live === 2 ? 2 : live, b: num(P.heroTone, 0.96) }; } const j = i - n, r = rel(j, u, n), th = 0.24 * num(P.thumb, 1), pitch = th * (1 + num(P.gap, 0.18)), near = 1 - Math.min(1, ab(r)), H = str(P.orient, 'v') === 'h'; return { x: H ? r * pitch : num(P.side) * (E.asp - th), y: H ? num(P.side) * (1 - th) : -r * pitch, z: 0.05, h: th, aspect: 1, s: 1 + num(P.pop, 0.28) * near, o: wrapFade(r, n) * (1 - num(P.falloff) * Math.min(1, ab(r) / 3)), zBias: 10 + near, img: j }; } },
  { ...NEW, id: 'salon', name: 'Salon Wall', cat: 'gallery', n: 17, aspect: 0.8, cardH: 0.8, dur: 34, mods: { poseRy: -16 }, desc: 'A salon-style hang of mixed sizes gliding past, like walking a crowded gallery wall.',
    params: params([group('Layout'), range('gap', 'Gap', 0, 0.8, 0.1), range('contrast', 'Size contrast', 0, 1.5, 1), range('stagger', 'Stagger', 0, 1, 0.5), range('depth', 'Depth', 0, 0.5, 0.12), off('crooked', 'Crooked', 0.3), group('Motion'), whole('passes', 'Walk speed', 1, 3, 1, { unit: '\u00d7', hint: 'whole cycles per loop, so it stays seamless' }), off('swing', 'Swing', 0.15), off('approach', 'Approach', 1), group('Look'), off('edgeDim', 'Edge dim', 1), off('edgeBlur', 'Edge blur', 1)]), fill: salonFill, layout: salonLayout },
  { ...NEW, id: 'mirror', name: 'Mirror Floor', cat: 'gallery', n: 10, aspect: 0.8, cardH: 0.7, dur: 22, desc: 'Photos walk along a glossy floor, each with its reflection, on a gentle arc.',
    params: params([group('Layout'), range('gap', 'Gap', 0, 0.8, 0.14), range('floor', 'Floor height', -0.9, 0, -0.42), range('arc', 'Arc', 0, 1, 0.35), group('Motion'), range('hop', 'Hop', 0, 0.3, 0.06), whole('hops', 'Hops per card', 1, 3, 1), off('tip', 'Tip', 0.4), group('Look'), range('reflect', 'Reflection', 0, 0.8, 0.32), range('rGap', 'Reflection gap', 0, 0.3, 0.01), range('rBlur', 'Reflection blur', 0, 1, 0.15), off('edgeDim', 'Edge dim', 1)]), fill: mirrorFill, layout: mirrorLayout },
  { ...NEW, id: 'rack-focus', name: 'Rack Focus', cat: 'gallery', n: 18, aspect: 0.8, cardH: 0.72, dur: 26, desc: 'Drift through a deep field of photos; each one snaps into focus as it passes the focal plane.',
    params: params([group('Layout'), range('depth', 'Depth', 4, 16, 10), range('spread', 'Spread', 0.2, 2, 1), off('tunnel', 'Tunnel', 1), range('crooked', 'Crooked', 0, 1.2, 0.12), group('Motion'), range('spiral', 'Spiral', -2, 2, 0, 0.01, { unit: ' turns' }), off('pull', 'Focus pull', 3), group('Look'), range('focal', 'Focus distance', -3, 1.5, -0.4), range('blur', 'Blur', 0, 1.5, 0.8), off('dimOOF', 'Out-of-focus dim', 0.8), range('fadeIn', 'Fade in', 0.02, 0.5, 0.14)]),
    layout(i, P, E) { const s = wrap(i / E.n + E.p, 1), z = lerp(-num(P.depth, 10), 2, s), vis = (E.D - z) / E.D, ax = E.asp * vis * 0.62 * num(P.spread, 1), ay = vis * 0.58 * num(P.spread, 1); let x = (E.rnd(i, 1) - 0.5) * 2 * ax, y = (E.rnd(i, 2) - 0.5) * 2 * ay; if (num(P.tunnel)) { const g = E.rnd(i, 4) * TAU, k = 0.75 + 0.25 * E.rnd(i, 5); x = lerp(x, Math.cos(g) * ax * k, num(P.tunnel)); y = lerp(y, Math.sin(g) * ay * k, num(P.tunnel)); } if (num(P.spiral)) { const g = num(P.spiral) * TAU * s, c = Math.cos(g), sn = Math.sin(g); [x, y] = [x * c - y * sn, x * sn + y * c]; } const bl = clamp01(ab(z - num(P.focal, -0.4) - num(P.pull) * Math.sin(E.p * TAU)) * 0.22 * num(P.blur, 0.8)); return { x, y, z, rz: (E.rnd(i, 3) - 0.5) * num(P.crooked, 0.12), blur: bl, b: 1 - num(P.dimOOF) * bl, o: sstep(0, num(P.fadeIn, 0.14), s) * (1 - sstep(0.86, 1, s)) }; } },
  { ...NEW, id: 'page-turn', name: 'Page Turn', cat: 'gallery', n: 8, aspect: 0.8, step: true, perCard: 1.5, cardH: 0.95, mods: { poseRx: 24, poseRy: -12 }, desc: 'A photo book: each page curls over the spine to reveal the next spread.',
    params: params([group('Form'), off('openV', 'Book open', 0.6), off('gutter', 'Gutter', 0.3), range('lift', 'Lift', 0, 0.6, 0.35), range('curl', 'Curl', 0, 2, 0.9), group('Motion'), off('flutter', 'Flutter', 1), off('swing', 'Swing out', 1), group('Look'), range('pageShade', 'Page shade', 0, 0.6, 0.04), range('backTone', 'Back page tone', 0.5, 1.2, 1)]), fill: (_P, E) => ({ count: 2 * E.n }),
    layout(i, P, E) { const n = Math.max(4, E.n), j = i % E.n, back = i >= E.n, half = n / 2, u = stepU(E.p, E.n, E.hold, E.ez), s = wrap(u - j, E.n), oa = num(P.openV); let th: number, z: number, zb: number, tp = 0; if (s < 1) { th = oa + (PI - 2 * oa) * s; z = 0; zb = 6; tp = s; } else if (s < half) { th = PI - oa; z = (half - s) * 0.004; zb = 3 - s / n; } else if (s < half + 1) { th = PI - oa + (PI + 2 * oa) * (s - half); z = -0.02; zb = -2; } else { th = oa; z = (s - half) * 0.004; zb = 1 + s / n; } const bend = Math.sin(th) * num(P.curl, 0.9) + num(P.flutter) * Math.sin(TAU * tp) * 0.8; const m = M(T(0, Math.sin(PI * tp) * num(P.lift, 0.35) * 0.3, z), RY(-th), RX(-num(P.swing) * 0.5 * Math.sin(PI * tp)), T(E.w / 2 + num(P.gutter), 0, 0)); const front = Math.cos(th) > 0 || th > PI * 1.5; if (!back) return { m, bend, zBias: zb + (front ? 0.5 : 0), b: 1 - num(P.pageShade, 0.04) + num(P.pageShade, 0.04) * Math.cos(th), img: j }; return { m: M(m, T(0, 0, -0.003), RY(PI)), bend: -bend, zBias: zb + (front ? 0 : 0.5), b: num(P.backTone, 1), img: wrap(j + Math.floor(E.n / 2), E.n) }; } },
  { ...NEW, id: 'puzzle', name: 'Sliding Puzzle', cat: 'gallery', n: 24, fixedN: true, aspect: 1, cardH: 0.42, dur: 20, desc: 'A sliding tile puzzle that shuffles itself, then slides every tile back home.',
    params: params([group('Layout'), whole('grid', 'Grid', 3, 6, 4), range('gap', 'Gap', 0, 0.8, 0.06), off('loose', 'Loose tiles', 1), group('Motion'), whole('moves', 'Moves', 4, 30, 12), whole('shuffle', 'Shuffle', 1, 50, 7), range('pause', 'Pause', 0, 0.8, 0.35), select('ease', 'Easing', { inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear' }, 'inOutQuint'), range('liftT', 'Lift', 0, 0.4, 0.06), off('tip', 'Tip', 0.8), group('Look'), off('restDim', 'Rest dim', 0.6)]), fill: puzzleFill, layout: puzzleLayout },
  { ...NEW, id: 'river', name: 'Photo River', cat: 'gallery', n: 26, aspect: 0.8, cardH: 0.55, dur: 28, fov: 40, desc: 'Photos float down a winding river toward you, turning slowly on the current.',
    params: params([group('Layout'), range('meander', 'Meander', 0, 1.5, 1), range('bends', 'Bends', 0.5, 3, 1.35), range('width', 'River width', 0, 1.5, 0.9), range('far', 'Distance', 4, 20, 10), range('tiltUp', 'Tilt up', 0, 1.3, 0.32), group('Motion'), whole('twirl', 'Twirl', -3, 3, 1, { unit: '\u00d7' }), range('bob', 'Bob', 0, 0.1, 0.025), off('rock', 'Rock', 0.5), group('Look'), off('haze', 'Distance haze', 1), off('farDim', 'Distance dim', 0.8)]),
    camera: (_P, E) => ({ eye: [0, 1.7, E.D * 0.95], target: [0, -0.35, -1.2] }),
    layout(i, P, E) { const s = wrap(i / E.n + E.p, 1), z = lerp(-num(P.far, 10), 2.2, s), x = num(P.meander, 1) * Math.sin(s * TAU * num(P.bends, 1.35) + 0.7) * (1.2 - s * 0.5) + (E.rnd(i, 1) - 0.5) * num(P.width, 0.9), w = TAU * (2 * E.p + E.rnd(i, 2)), y = -0.5 + num(P.bob, 0.025) * Math.sin(w); return { m: M(T(x, y, z), RX(-PI / 2 + num(P.tiltUp, 0.32)), RY(num(P.rock) * Math.cos(w)), RZ(E.rnd(i, 3) * TAU + num(P.twirl, 1) * E.p * TAU * (i % 2 ? 1 : -1))), o: sstep(0, 0.2, s) * (1 - sstep(0.9, 1, s)), b: 1 - num(P.farDim) * (1 - s), blur: num(P.haze) * (1 - s) ** 2 }; } },
  { ...NEW, id: 'slots', name: 'Slot Reels', cat: 'gallery', n: 17, aspect: 1, cardH: 0.5, dur: 9, desc: 'Reels of photos spin up, stop one after another with a bounce, and spin again.',
    params: params([group('Layout'), whole('reels', 'Reels', 1, 6, 3), range('gap', 'Gap', 0, 0.8, 0.12), range('reelR', 'Reel radius', 0.8, 1.6, 1), group('Motion'), segment('spins', 'Spins per loop', { '1': '1', '2': '2', '4': '4' }, '2'), whole('laps', 'Laps', 1, 4, 2), range('stagger', 'Stop delay', 0, 0.2, 0.08), range('bounce', 'Bounce', 0, 2, 1), group('Look'), range('drumShade', 'Drum shade', 0, 1, 0.45), range('mblur', 'Motion blur', 0, 3, 1.2), off('winner', 'Winner pop', 0.3)]), fill: slotFill, layout: slotLayout },
  { ...NEW, id: 'aperture', name: 'Aperture', cat: 'gallery', n: 7, aspect: 0.8, step: true, perCard: 2.4, cardH: 1.5, desc: 'Photo blades close like a camera iris, and open on the next image.',
    params: params([group('Layout'), whole('blades', 'Blades', 5, 12, 8), range('blade', 'Blade length', 0.8, 2.2, 1.5), range('bladeW', 'Blade width', 0.3, 1.2, 0.62), range('open', 'Open width', 1.2, 2.6, 2.05), range('closed', 'Closed size', 0, 0.8, 0.26), group('Motion'), range('twist', 'Twist', 0, 1.5, 0.7), range('roll', 'Blade roll', 0, 1.5, 0.4), whole('irisTurn', 'Iris turns', -2, 2, 0), group('Look'), range('bladeTone', 'Blade tone', 0.3, 1.2, 0.9), off('heroDim', 'Hero dim', 1)]), fill: apertureFill, layout: apertureLayout },
  { ...NEW, id: 'mood-board', name: 'Mood Board', cat: 'gallery', n: 14, aspect: 0.8, cardH: 0.44, dur: 48, desc: 'A dense collage of photos on three depth layers drifts past with deep parallax and a soft focus falloff.',
    params: params([group('Layout'), range('spacing', 'Spacing', 0.25, 0.8, 0.42), range('spanY', 'Height', 0.5, 2.5, 1.5), range('scatter', 'Scatter', 0, 1, 0.6), range('sizeMix', 'Size mix', 0, 1, 0.45), range('depth', 'Parallax', 0, 1, 0.7), off('turn', '3D scatter', 1), group('Motion'), range('float', 'Float', 0, 0.3, 0.06), whole('floatN', 'Float speed', 1, 4, 2, { unit: '\u00d7' }), group('Look'), range('dof', 'Depth blur', 0, 1, 0.55), off('farDim', 'Depth dim', 1)]),
    fill: (P, E) => stripFill(E, E.vx * (1 + num(P.depth, 0.7) * 1.4) + E.w, E.w * num(P.spacing, 0.42)), layout: moodBoardLayout },
];
