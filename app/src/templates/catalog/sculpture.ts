import type { Env, P, Template } from '../types';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl } from '../referenceControls';
import { ab, aim, clamp01, ease, fibo, fillSlots, frame3, lerp, M, num, str, bool, rel, RX, RY, RZ, S, TAU, T } from '../kit';
import { mulberry } from '../../engine/math';

const PI = Math.PI;
type Vec3 = [number, number, number];
type CubeMove = { ax: number; ly: number; d: number };
type CubeSticker = { m: Float32Array; q: Vec3; mv?: CubeMove };
type SculptureEnv = Env & { cube?: { stickers: CubeSticker[]; f?: number } };

const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, min, max, def, 1, extra);
const turns = (key: string, label: string, def = 1) => whole(key, label, -3, 3, def, { unit: '×', hint: 'whole turns per loop, so it stays seamless' });
const cyc = (key: string, label: string, min: number, max: number, def: number) => whole(key, label, min, max, def, { unit: '×', hint: 'whole cycles per loop, so it stays seamless' });
const off = (key: string, label: string, max: number, def = 0, step = 0.01) => range(key, label, 0, max, def, step, { off: true });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
const NEW = { isNew: true, frame: '5:4' as const };
const sstep = (a: number, b: number, value: number): number => { const t = clamp01((value - a) / (b - a)); return t * t * (3 - 2 * t); };
const pulse = (p: number, a: number, b: number, c: number, d: number): number => sstep(a, b, p) - sstep(c, d, p);

const FACES: [Vec3, Float32Array][] = [
  [[1, 0, 0], RY(PI / 2)], [[-1, 0, 0], RY(-PI / 2)], [[0, 1, 0], RX(-PI / 2)],
  [[0, -1, 0], RX(PI / 2)], [[0, 0, 1], new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])], [[0, 0, -1], RY(PI)],
];
const AXIS_ROT = [RX, RY, RZ];

function seededRng(seed: number): () => number {
  return mulberry(Math.imul(seed | 0, 2654435761));
}

function rotateCubie(q: Vec3, move: CubeMove): void {
  const matrix = AXIS_ROT[move.ax](move.d * PI / 2);
  const [x, y, z] = q;
  const rotated = [matrix[0] * x + matrix[4] * y + matrix[8] * z, matrix[1] * x + matrix[5] * y + matrix[9] * z, matrix[2] * x + matrix[6] * y + matrix[10] * z].map(Math.round) as Vec3;
  q[0] = rotated[0]; q[1] = rotated[1]; q[2] = rotated[2];
}

function rubikState(P: P, E: Env): { stickers: CubeSticker[]; f?: number } {
  const c = E.h * 1.02, stickers: CubeSticker[] = [];
  for (const [face, rotation] of FACES) {
    const axis = face.findIndex(value => value !== 0), u = (axis + 1) % 3, v = (axis + 2) % 3;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const q: Vec3 = [0, 0, 0]; q[axis] = face[axis]; q[u] = a; q[v] = b;
      const pos = q.map((value, k) => (k === axis ? value * 1.5 : value) * c);
      stickers.push({ m: M(T(pos[0], pos[1], pos[2]), rotation), q });
    }
  }

  const random = seededRng(num(P.shuffle, 4) * 17 + 3), moves: CubeMove[] = [];
  const count = Math.round(num(P.moves, 6));
  for (let k = 0; k < count; k++) {
    let ax: number, ly: number;
    do { ax = Math.floor(random() * 3); ly = Math.floor(random() * 3) - 1; }
    while (moves.length && moves[moves.length - 1].ax === ax && moves[moves.length - 1].ly === ly);
    moves.push({ ax, ly, d: random() < 0.5 ? 1 : -1 });
  }
  const all = moves.concat(moves.slice().reverse().map(move => ({ ...move, d: -move.d })));
  const U = E.p * all.length, done = Math.floor(U), f = E.ez(clamp01((U - done - num(P.pause, 0.3)) / Math.max(0.05, 1 - num(P.pause, 0.3))));
  const turn = (sticker: CubeSticker, move: CubeMove, amount: number) => { sticker.m = M(AXIS_ROT[move.ax](move.d * amount * PI / 2), sticker.m); };
  for (let k = 0; k < done; k++) {
    const move = all[k];
    for (const sticker of stickers) if (sticker.q[move.ax] === move.ly) { turn(sticker, move, 1); rotateCubie(sticker.q, move); }
  }
  if (done < all.length) {
    const move = all[done];
    for (const sticker of stickers) if (sticker.q[move.ax] === move.ly) { turn(sticker, move, f); sticker.mv = move; }
    return { stickers, f };
  }
  return { stickers };
}

export const SCULPTURE_TEMPLATES: Template[] = [
  { ...NEW, id: 'rubik', name: "Rubik's Cube", cat: 'sculpture', n: 54, fixedN: true, aspect: 1, cardH: 0.3, dur: 16,
    desc: 'A cube of 54 photo stickers that scrambles itself layer by layer, then solves itself.',
    params: params([group('Layout'), whole('moves', 'Moves', 2, 16, 6), whole('shuffle', 'Shuffle', 1, 50, 4), { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 0.8, step: 0.01, def: 0.08 }, range('view', 'View tilt', -0.5, 1.2, 0.5),
      group('Motion'), range('pause', 'Pause', 0, 0.8, 0.3), { key: 'ease', label: 'Easing', type: 'select', options: { inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear' }, def: 'inOutQuint' }, turns('whirl', 'Turns'), off('turnPop', 'Turn pop', 0.5),
      group('Look'), off('faceShade', 'Face shade', 0.6), off('turnBlur', 'Turn blur', 1)]),
    fill(P, E) { return { cube: rubikState(P, E), count: 54 }; },
    layout(i, P, E) {
      const env = E as SculptureEnv, cube = env.cube, state = cube?.stickers[i];
      if (!state) return {};
      const G = M(RX(num(P.view, 0.5)), RY(0.7 + TAU * E.p * num(P.whirl, 1))), move = state.mv;
      const lift = move ? Math.sin(PI * (cube?.f ?? 0)) : 0;
      let L = state.m;
      const pop = num(P.turnPop, 0.5);
      if (move && pop) {
        const offset: Vec3 = [0, 0, 0]; offset[move.ax] = move.ly * pop * lift * E.h;
        L = M(T(...offset), L);
      }
      const matrix = M(G, L, S(1 - num(P.gap, 0.08), 1 - num(P.gap, 0.08), 1));
      return { m: matrix, aspect: 1, b: 0.96 * (1 - num(P.faceShade) * (1 - Math.max(0, matrix[10]))), blur: num(P.turnBlur) * 0.6 * lift };
    } },

  { ...NEW, id: 'morph', name: 'Morph', cat: 'sculpture', n: 48, fixedN: true, aspect: 0.8, cardH: 0.22, dur: 18,
    desc: 'Forty-eight photos flow from a sphere into a cube, a flat wall and a double helix, and back.',
    params: params([group('Form'), range('shape', 'Size', 0.6, 1.5, 1, 0.01, { key: 'shape' }), off('scatter', 'Scatter', 0.4), range('helix', 'Helix twist', 0.2, 1, 0.52), off('wallCurve', 'Wall curve', 1),
      group('Motion'), range('shapeHold', 'Hold shape', 0.2, 0.8, 0.5, 0.01, { key: 'shapeHold' }), range('stagger', 'Ripple', 0, 0.5, 0.25), turns('whirl', 'Turns'), off('tumble', 'Tumble', 1), off('burst', 'Burst', 1),
      group('Look'), off('backShade', 'Back shade', 0.6)]),
    layout(i, P, E) {
      const size = num(P.shape, 1), helix = num(P.helix, 0.52), wallCurve = num(P.wallCurve), shapeList: [() => [Vec3, Vec3], () => [Vec3, Vec3], () => [Vec3, Vec3], () => [Vec3, Vec3]] = [
        () => { const direction = fibo(i, 48); return [direction.map(value => value * 0.95 * size) as Vec3, direction]; },
        () => { const faceIndex = Math.floor(i / 8), card = i % 8, index = card < 4 ? card : card + 1, a = index % 3 - 1, b = Math.floor(index / 3) - 1, face = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][faceIndex] as Vec3;
          const axis = face.findIndex(value => value !== 0), u = (axis + 1) % 3, v = (axis + 2) % 3, q: Vec3 = [0, 0, 0]; q[axis] = face[axis] * 0.62; q[u] = a * 0.4; q[v] = b * 0.4; return [q.map(value => value * size) as Vec3, face]; },
        () => { const x = (i % 8 - 3.5) * 0.3 * size; return [[x, (Math.floor(i / 8) - 2.5) * 0.34 * size, -wallCurve * x * x * 0.8], [wallCurve * 1.6 * x, 0, 1]]; },
        () => { const k = Math.floor(i / 2), a = k * helix + (i % 2) * PI; return [[Math.cos(a) * 0.62 * size, (k - 11.5) * 0.07 * size, Math.sin(a) * 0.62 * size], [Math.cos(a), 0, Math.sin(a)]]; },
      ];
      const seg = E.p * 4, k = Math.floor(seg), f = seg - k, stagger = num(P.stagger, 0.25), hold = num(P.shapeHold, 0.5);
      const st = (i / 48) * stagger;
      const e = ease.inOutCubic(clamp01((f - hold - st * (1 - hold)) / Math.max(0.05, (1 - hold) * (1 - stagger))));
      const [p0, n0] = shapeList[k % 4](), [p1, n1] = shapeList[(k + 1) % 4](), A0 = aim(...n0), A1 = aim(...n1);
      let dy = A1.ry - A0.ry; if (dy > PI) dy -= TAU; if (dy < -PI) dy += TAU;
      const ga = TAU * E.p * num(P.whirl, 1), G = RY(ga), burst = num(P.burst), sizeFactor = 1 + burst * 0.6 * Math.sin(PI * e);
      const pos = p0.map((value, c) => (lerp(value, p1[c], e) + (E.rnd(i, 1 + c) - 0.5) * num(P.scatter)) * sizeFactor) as Vec3;
      const wz = -pos[0] * Math.sin(ga) + pos[2] * Math.cos(ga);
      return { m: M(G, T(...pos), RY(A0.ry + dy * e), RX(lerp(A0.rx, A1.rx, e)), RZ(num(P.tumble) * PI * Math.sin(PI * e))), zBias: 0, b: 1 - num(P.backShade) * clamp01(0.5 - wz / (1.3 * size)) };
    } },

  { ...NEW, id: 'gyroscope', name: 'Gyroscope', cat: 'sculpture', n: 36, aspect: 0.8, cardH: 0.26, dur: 20,
    desc: 'Three nested rings of photos spinning on different axes, like a gyroscope in motion.',
    params: params([group('Form'), { key: 'radius', label: 'Radius', type: 'range', min: 0.4, max: 2.5, step: 0.01, def: 1 }, range('gap', 'Ring gap', 0.05, 0.4, 0.18), range('axis', 'Axis tilt', -0.5, 1.2, 0.35), range('hug', 'Ring curve', 0, 2, 1),
      group('Motion'), whole('inner', 'Inner speed', -3, 3, 2, { unit: '×' }), whole('outer', 'Outer speed', -3, 3, 1, { unit: '×' }), whole('run', 'Card run', -3, 3, 1, { unit: '×' }), off('nutate', 'Nutation', 0.4),
      group('Look'), range('ringTone', 'Ring contrast', 0, 0.2, 0.08), off('backShade', 'Back shade', 0.6)]),
    layout(i, P, E) {
      const ring = i % 3, per = Math.ceil(E.n / 3), j = Math.floor(i / 3), t = E.p * TAU, run = Math.round(num(P.run, 1));
      const a = j / per * TAU + t * run * (ring === 1 ? -1 : 1), radius = (1.02 - ring * num(P.gap, 0.18)) * num(P.radius, 1);
      const tilt = RX(num(P.axis, 0.35) + num(P.nutate) * Math.sin(2 * t)), outer = num(P.outer, 1), inner = num(P.inner, 2);
      const Q = ring === 0 ? M(tilt, RY(t * outer)) : ring === 1 ? M(tilt, RY(t * outer), RZ(PI / 2), RX(t * inner)) : M(tilt, RY(t * outer), RX(PI / 2 + t * inner), RZ(t * outer));
      const matrix = M(Q, RY(a), T(0, 0, radius));
      return { m: matrix, bend: -0.6 * num(P.hug, 1) / radius, b: (0.8 + ring * num(P.ringTone, 0.08)) * (1 - num(P.backShade) * clamp01(0.5 - matrix[14] / (2 * radius))) };
    } },

  { ...NEW, id: 'knot', name: 'Torus Knot', cat: 'sculpture', n: 64, aspect: 1.2, cardH: 0.16, dur: 26,
    desc: 'Photos glide along a trefoil knot that loops through itself, scaled like a dragon.',
    params: params([group('Form'), whole('pq', 'Knot', 2, 5, 3, { hint: 'loops around the tube' }), whole('winds', 'Winds', 1, 4, 2, { hint: 'times round the centre' }), range('tube', 'Tube', 0.1, 0.6, 0.3), { key: 'radius', label: 'Radius', type: 'range', min: 0.4, max: 2.5, step: 0.01, def: 0.84 }, range('puff', 'Tube height', 0.5, 2.5, 1.3),
      group('Motion'), turns('whirl', 'Turns', 0), whole('glide', 'Glide', -3, 3, 1, { unit: '×' }), off('breath', 'Breathe', 0.6),
      group('Look'), range('depthShade', 'Depth shade', 0, 0.6, 0.22), off('dof', 'Depth blur', 1)]),
    layout(i, P, E) {
      const q = Math.round(num(P.pq, 3)), winds = Math.round(num(P.winds, 2)), u = i / E.n + E.p * Math.round(num(P.glide, 1)), R = 0.72 * num(P.radius, 0.84);
      const r = num(P.tube, 0.3) * (1 + num(P.breath) * Math.sin(TAU * (3 * u - 2 * E.p))), puff = num(P.puff, 1.3);
      const path = (v: number): Vec3 => { const a = v * TAU; return [(R + r * Math.cos(q * a)) * Math.cos(winds * a), (R + r * Math.cos(q * a)) * Math.sin(winds * a), r * Math.sin(q * a) * puff]; };
      const P0 = path(u), P1 = path(u + 0.001), a = u * TAU, C: Vec3 = [R * Math.cos(winds * a), R * Math.sin(winds * a), 0];
      const tangent: Vec3 = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]], normal: Vec3 = [P0[0] - C[0], P0[1] - C[1], P0[2] - C[2] + 0.3], lit = clamp01(0.5 + P0[2]);
      const G = M(RX(0.42), RY(TAU * E.p * num(P.whirl)));
      return { m: M(G, frame3(...P0, tangent, normal)), b: 1 - num(P.depthShade, 0.22) + num(P.depthShade, 0.22) * lit, blur: num(P.dof) * (1 - lit) * 0.8 };
    } },

  { ...NEW, id: 'kaleido', name: 'Kaleidoscope', cat: 'sculpture', n: 17, aspect: 0.8, cardH: 0.3, dur: 20,
    desc: 'A turning mandala: rings of the same photo repeated in symmetry, breathing in and out.',
    params: params([group('Form'), whole('folds', 'Folds', 3, 12, 6), whole('rings', 'Rings', 1, 5, 3), range('ringStep', 'Ring spacing', 0.15, 0.6, 0.34), range('depth', 'Depth', 0, 0.6, 0.2),
      group('Motion'), turns('whirl', 'Turns'), { key: 'counter', label: 'Counter-rotate', type: 'toggle', def: true }, range('breathe', 'Breathe', 0, 0.5, 0.22), cyc('breaths', 'Breaths', 1, 4, 2), range('rock', 'Rock', 0, 1, 0.3),
      group('Look'), off('ringShade', 'Ring shade', 0.6)]),
    fill(P) { return { count: Math.round(num(P.folds, 6)) * Math.round(num(P.rings, 3)) }; },
    layout(i, P, E) {
      const folds = Math.round(num(P.folds, 6)), rings = Math.round(num(P.rings, 3)), j = Math.floor(i / folds), k = i % folds, t = E.p * TAU;
      const r = (0.22 + num(P.ringStep, 0.34) * j) * (1 + num(P.breathe, 0.22) * Math.sin(Math.round(num(P.breaths, 2)) * t + j * 1.3));
      const counter = bool(P.counter, true), a = k / folds * TAU + j * PI / folds + t * num(P.whirl, 1) * (counter && j % 2 ? -1 : 1);
      return { x: r * Math.cos(a), y: r * Math.sin(a), z: -j * num(P.depth, 0.2) + num(P.depth, 0.2) * 0.5 * Math.sin(t + j), rz: a + PI / 2 + (j % 2 ? PI : 0) + Math.sin(2 * t + j) * num(P.rock, 0.3), s: 0.75 + 0.3 * j,
        b: 1 - num(P.ringShade) * j / Math.max(1, rings - 1), img: j * 5 + 1 };
    } },

  { ...NEW, id: 'bloom', name: 'Bloom', cat: 'sculpture', n: 25, fixedN: true, aspect: 0.55, cardH: 0.82, dur: 12,
    mods: { poseRx: -20 }, style: { card: { radius: 0.5 } },
    desc: 'Photo petals open into a flower, turn, and fold back into a bud.',
    params: params([group('Form'), range('open', 'Open', 0.2, 1, 0.92), range('cup', 'Cup', 0, 1, 0.3), range('petalGrow', 'Petal growth', 0, 0.4, 0.22), range('layerOff', 'Layer offset', 0, 1, 0.32), range('heart', 'Heart size', 0.15, 0.8, 0.42),
      group('Motion'), turns('whirl', 'Turns'), whole('cycles', 'Blooms per loop', 1, 3, 1), off('delay', 'Layer delay', 0.3), off('flutter', 'Flutter', 0.4),
      group('Look'), range('budShade', 'Bud shade', 0, 0.5, 0.2)]),
    layout(i, P, E) {
      const heart = num(P.heart, 0.42);
      if (i === 24) return { h: E.h * heart, aspect: 1, z: 0.02, zBias: 3, img: 7 };
      const layer = i < 6 ? 0 : i < 14 ? 1 : 2, per = [6, 8, 10][layer], k = i - [0, 6, 14][layer], t = E.p * TAU;
      const cycles = Math.round(num(P.cycles, 1)), open = (0.5 - 0.5 * Math.cos((t - layer * num(P.delay) * TAU) * cycles)) * num(P.open, 0.92);
      const phi = k / per * TAU + layer * num(P.layerOff, 0.32) + t * num(P.whirl, 1);
      const beta = lerp(1.45 - layer * 0.12, (0.1 + layer * 0.12) * num(P.cup, 0.3) * 2 - 0.05 * layer, open) + num(P.flutter) * open * Math.sin(2 * t + k * 1.7 + layer);
      const h = E.h * (0.72 + num(P.petalGrow, 0.22) * layer);
      return { m: M(RZ(phi), RX(beta), T(0, h * 0.52, -layer * 0.004)), h, aspect: 0.55, b: 1 - num(P.budShade, 0.2) + num(P.budShade, 0.2) * open, img: layer * 4 + 1 };
    } },

  { ...NEW, id: 'braid', name: 'Braid', cat: 'sculpture', n: 18, aspect: 0.8, cardH: 0.32, dur: 24,
    desc: 'Three strands of photos plait over and under each other as the braid slides by.',
    params: params([group('Form'), range('amp', 'Width', 0.1, 0.8, 0.42), range('wave', 'Wavelength', 1, 6, 2.8), range('depth', 'Depth', 0, 1, 0.5), { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 0.8, step: 0.01, def: 0.05 }, off('twist', 'Twist', 1.2),
      group('Motion'), cyc('slide', 'Slide speed', 1, 3, 1), whole('drift', 'Weave drift', -2, 2, 0, { unit: '×', hint: 'whole cycles per loop, so it stays seamless' }), off('ripple', 'Ripple', 0.6),
      group('Look'), off('underShade', 'Under shade', 0.6), off('underBlur', 'Under blur', 1)]),
    fill(P, E) { const mb = Math.ceil(E.n / 3), m = fillSlots(E.vx + E.w, E.w * (1 + num(P.gap, 0.05)), mb, 3); return { m, mb, count: 3 * m }; },
    layout(i, P, E) {
      const strand = i % 3, k = Math.floor(i / 3), mb = num(E.mb, Math.ceil(E.n / 3)), m = num(E.m, mb);
      const r = rel(k, E.p * mb * Math.round(num(P.slide, 1)), m);
      const x = r * E.w * (1 + num(P.gap, 0.05)), ph = x / num(P.wave, 2.8) * TAU + strand * TAU / 3 + E.p * TAU * Math.round(num(P.drift));
      const amp = num(P.amp, 0.42) * (1 + num(P.ripple) * Math.sin(x * 1.3 - E.p * TAU));
      const y = amp * Math.sin(ph), z = num(P.depth, 0.5) * 0.5 * Math.sin(2 * ph), dy = amp * Math.cos(ph) * TAU / num(P.wave, 2.8), dz = num(P.depth, 0.5) * Math.cos(2 * ph) * TAU / num(P.wave, 2.8);
      const rr = num(P.twist) * Math.cos(ph), under = 0.5 - 0.5 * Math.sin(2 * ph);
      return { m: frame3(x, y, z, [1, dy, dz], [0, -Math.sin(rr), Math.cos(rr)]), o: clamp01((m - Math.abs(r)) * 1.5), b: 1 - num(P.underShade) * under, blur: num(P.underBlur) * under * 0.6, img: (k % mb) * 3 + strand };
    } },

  { ...NEW, id: 'orrery', name: 'Orrery', cat: 'sculpture', n: 22, fixedN: true, aspect: 0.8, cardH: 0.62, dur: 24,
    desc: 'A clockwork solar system: one hero photo in the middle, rings of photos orbiting at their own pace.',
    params: params([group('Form'), range('tilt', 'Tilt', 0.2, 1.45, 1), { key: 'spread', label: 'Spread', type: 'range', min: 0.2, max: 2, step: 0.01, def: 1 }, off('ecc', 'Ellipse', 0.5), off('incline', 'Orbit incline', 0.6), range('sun', 'Sun size', 0.5, 1.6, 1),
      group('Motion'), whole('pace', 'Pace', 1, 3, 1, { unit: '×' }), segment('rhythm', 'Rhythm', { kepler: 'Kepler', locked: 'Locked', outward: 'Outward' }, 'kepler'), off('bob', 'Bob', 0.2),
      group('Look'), range('orbitShade', 'Orbit shade', 0, 0.5, 0.15), off('farBlur', 'Far blur', 1)]),
    layout(i, P, E) {
      if (i === 0) return { zBias: 0, s: num(P.sun, 1) };
      const orbits = [3, 4, 6, 8], rhythm = str(P.rhythm, 'kepler');
      const speeds = (rhythm === 'locked' ? [1, 1, 1, 1] : rhythm === 'outward' ? [1, 2, 3, 4] : [4, 3, 2, 1]).map(value => value * Math.round(num(P.pace, 1)));
      const radii = [0.62, 0.92, 1.22, 1.52];
      let j = i - 1, orbit = 0; while (j >= orbits[orbit]) { j -= orbits[orbit]; orbit++; }
      const a = j / orbits[orbit] * TAU + E.p * TAU * speeds[orbit], r = radii[orbit] * num(P.spread, 1) * 0.84;
      const tilt = num(P.tilt, 1) + num(P.incline) * (orbit - 1.5) * 0.5, px = r * (1 + num(P.ecc)) * Math.cos(a), pz = r * (1 - num(P.ecc)) * Math.sin(a), z = -pz * Math.sin(tilt);
      return { x: px, y: pz * Math.cos(tilt) + num(P.bob) * Math.sin(2 * E.p * TAU + orbit * 1.7 + j), z, h: E.h * [0.42, 0.38, 0.34, 0.3][orbit], b: 1 - num(P.orbitShade, 0.15) + num(P.orbitShade, 0.15) * Math.sin(a), blur: num(P.farBlur) * clamp01(-z * 0.8) };
    } },

  { ...NEW, id: 'sunflower', name: 'Sunflower', cat: 'sculpture', n: 90, aspect: 0.8, cardH: 0.19, dur: 24,
    desc: 'Photos packed in a sunflower spiral, turning while waves pulse out from the centre.',
    params: params([group('Form'), { key: 'spread', label: 'Spread', type: 'range', min: 0.2, max: 2, step: 0.01, def: 1 }, range('diverge', 'Divergence', -4, 4, 0, 0.05, { unit: '°', hint: 'offset from the golden angle' }), segment('facing', 'Card angle', { out: 'Radial', up: 'Upright' }, 'out'), range('cup', 'Cup', -1, 1, 0), range('grow', 'Grow', 0, 1, 0.55),
      group('Motion'), turns('whirl', 'Turns'), range('pulse', 'Pulse', 0, 0.6, 0.25), cyc('waveSp', 'Wave speed', 1, 4, 2), range('waveRings', 'Wave rings', 0.3, 3, 1.1),
      group('Look'), off('glow', 'Wave glow', 0.5)]),
    layout(i, P, E) {
      const spread = num(P.spread, 1), maxRadius = 1.08 * spread, r = maxRadius * Math.sqrt((i + 0.5) / E.n), a = i * (2.399963229728653 + num(P.diverge) * PI / 180) + E.p * TAU * num(P.whirl, 1);
      const wave = Math.sin(TAU * (r * num(P.waveRings, 1.1) - Math.round(num(P.waveSp, 2)) * E.p)), q = r / maxRadius, pulseAmount = num(P.pulse, 0.25);
      return { x: r * Math.cos(a), y: r * Math.sin(a), z: pulseAmount * wave + num(P.cup) * q * q * 0.6, rz: str(P.facing, 'out') === 'up' ? 0 : a - PI / 2,
        s: (1 - num(P.grow, 0.55) * 0.6 + num(P.grow, 0.55) * 0.9 * q) * (1 + 0.18 * wave * pulseAmount * 2), b: 1 + num(P.glow) * wave };
    } },

  { ...NEW, id: 'exploded', name: 'Exploded View', cat: 'sculpture', n: 6, aspect: 0.8, cardH: 1, dur: 10,
    desc: 'A stack of photos seen from above that pulls apart into floating layers, then snaps back together.',
    params: params([group('Form'), { key: 'spread', label: 'Spread', type: 'range', min: 0.2, max: 2, step: 0.01, def: 1 }, range('slide', 'Slide', 0, 0.6, 0.18), range('tilt', 'Tilt', 0.3, 1.3, 0.95), range('twist', 'Twist', 0, 1.5, 0.72), off('fan', 'Fan', 1),
      group('Motion'), range('apart', 'Hold apart', 0, 0.5, 0.24), off('delay', 'Layer delay', 0.15), whole('whirl', 'Turns', 0, 2, 0, { unit: ' turns' }),
      group('Look'), range('layerShade', 'Layer shade', 0, 0.5, 0.15), off('dof', 'Depth blur', 1)]),
    layout(i, P, E) {
      const spread = num(P.spread, 1), apart = num(P.apart, 0.24), fr = i / Math.max(1, E.n - 1), hb = apart / 2;
      const e = ease.inOutCubic(pulse(E.p - (E.n > 1 ? fr - 0.5 : 0) * num(P.delay), 0.08, 0.5 - hb, 0.5 + hb, 0.92));
      const c = i - (E.n - 1) / 2, gap = lerp(0.025, 0.42 * spread, e), slide = num(P.slide, 0.18), twist = num(P.twist, 0.72);
      return { m: M(RX(-num(P.tilt, 0.95)), RZ(twist + Math.round(num(P.whirl)) * TAU * E.p), T((E.rnd(i, 1) - 0.5) * slide * e, (E.rnd(i, 2) - 0.5) * slide * e * 0.6, c * gap), RZ(c * num(P.fan) * 0.25 * e)),
        b: 1 - num(P.layerShade, 0.15) + num(P.layerShade, 0.15) * fr, blur: num(P.dof) * e * (1 - fr) * 0.6 };
    } },

  { ...NEW, id: 'trivision', name: 'Tri-Vision', cat: 'sculpture', n: 21, aspect: 0.28, cardH: 1.15, dur: 9,
    desc: 'A row of turning prisms like a tri-vision billboard; each turn reveals a new set of photos.',
    params: params([group('Layout'), whole('slats', 'Prisms', 3, 12, 7), { key: 'gap', label: 'Gap', type: 'range', min: 0, max: 0.8, step: 0.01, def: 0.04 }, off('curve', 'Billboard curve', 1),
      group('Motion'), range('wave', 'Stagger', 0, 0.1, 0.045), segment('from', 'Wave from', { l: 'Left', c: 'Centre', r: 'Right' }, 'l'), range('pause', 'Pause', 0, 0.5, 0.2), { key: 'ease', label: 'Easing', type: 'select', options: { inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear' }, def: 'inOutQuint' }, off('pop', 'Pop out', 0.4),
      group('Look'), range('faceShade', 'Face shade', 0, 0.6, 0.3), off('turnBlur', 'Turn blur', 1)]),
    fill(P) { return { count: Math.round(num(P.slats, 7)) * 3 }; },
    layout(i, P, E) {
      const slats = Math.round(num(P.slats, 7)), j = i % slats, face = Math.floor(i / slats), u = E.p * 3, k = Math.floor(u), f = u - k;
      const from = str(P.from, 'l'), wave = num(P.wave, 0.045), offset = from === 'r' ? slats - 1 - j : from === 'c' ? ab(j - (slats - 1) / 2) : j;
      const pause = num(P.pause, 0.2), requestedStagger = (slats - 1) * wave, totalStagger = Math.min(requestedStagger, Math.max(0, 1 - pause - 0.15));
      const st = offset * wave * (requestedStagger > 0 ? totalStagger / requestedStagger : 1), win = 1 - totalStagger - pause - 0.05;
      const e = E.ez(clamp01((f - st - pause) / win)), th = (k + e) * TAU / 3;
      const ap = E.w / (2 * Math.tan(PI / 3)), x = (j - (slats - 1) / 2) * E.w * (1 + num(P.gap, 0.04)), curve = num(P.curve), pop = num(P.pop), ce = Math.sin(PI * e), ang = th + face * TAU / 3;
      return { m: M(T(x, 0, -curve * 0.3 * x * x + pop * ce), RY(Math.atan(curve * 0.6 * x)), T(0, 0, -ap), RY(-ang), T(0, 0, ap)), b: 1 - num(P.faceShade, 0.3) + num(P.faceShade, 0.3) * Math.max(0, Math.cos(ang)), blur: num(P.turnBlur) * 0.6 * ce, img: face * slats + j };
    } },
];
