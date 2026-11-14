import type { Env, P, Template } from '../types';
import { ab, clamp01, ease, lerp, M, num, rel, RX, RY, RZ, str, stepU, stripFill, TAU, T, wrap } from '../kit';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl, ReferenceSelectControl } from '../referenceControls';

const PI = Math.PI;
const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({
  key, label, type: 'range', min, max, step, def, ...extra,
});
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const select = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSelectControl => ({ key, label, type: 'select', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
const sstep = (a: number, b: number, value: number): number => {
  const t = clamp01((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};

function cubicLayout(i: number, P: P, E: Env) {
  const hw = E.w / 2 * (1 + num(P.gapC) + num(P.breath) * 0.6 * (0.5 - 0.5 * Math.cos(E.p * TAU * 2)));
  const faces: [number, number][] = [[0, 0], [PI / 2, 0], [PI, 0], [-PI / 2, 0], [0, -PI / 2], [0, PI / 2]];
  const [fy, fx] = faces[i % 6];
  const cube = M(
    RX(num(P.tilt, 0.42) + Math.sin(E.p * TAU * Math.round(num(P.wobN, 1))) * 0.25 * num(P.wobble, 0.45)),
    RY(E.p * TAU * Math.round(num(P.turns, 1))),
    RX(E.p * TAU * Math.round(num(P.roll))),
  );
  const m = M(cube, RY(fy), RX(fx), T(0, 0, hw));
  return { m, b: 1 - num(P.shade) * 0.6 * (1 - Math.max(0, m[10])) };
}

function spaceLayout(i: number, P: P, E: Env) {
  const t = wrap(E.p + E.rnd(i, 1), 1);
  const ang = E.rnd(i, 2) * TAU + E.p * TAU * Math.round(num(P.swirl));
  const rad = (num(P.hole, 0.55) + E.rnd(i, 3) * 1.4) * num(P.spread, 1);
  return {
    x: Math.cos(ang) * rad * E.asp * 0.8 * num(P.oval, 1),
    y: Math.sin(ang) * rad * 0.8,
    z: -num(P.depth, 11) + t * (num(P.depth, 11) + 2.2),
    ry: (E.rnd(i, 4) - 0.5) * 0.6 * num(P.jitter, 1),
    rx: (E.rnd(i, 5) - 0.5) * 0.4 * num(P.jitter, 1),
    rz: (E.rnd(i, 6) - 0.5) * 2 * num(P.tumble) * t * PI,
    o: clamp01(t * 5) * clamp01((1 - t) * 5) * (1 - num(P.fog) * (1 - t)),
    b: 1 - num(P.dim) * (1 - t),
  };
}

function flipFlapLayout(i: number, P: P, E: Env) {
  const tiles = Math.ceil(E.n / 2);
  const t = i % tiles;
  const side = Math.floor(i / tiles);
  const u = t - (tiles - 1) / 2;
  const x = u * E.w * (1 + num(P.gap, 0.1));
  const feel = str(P.feel, 'inOutBack') as keyof typeof ease;
  const ez = ease[feel] || ease.inOutBack;
  const from = str(P.from, 'left');
  const dl = from === 'right' ? tiles - 1 - t : from === 'center' ? ab(u) : t;
  const ph = wrap(E.p - dl * num(P.wave, 0.08), 1);
  const th = PI * (ez(sstep(0.05, 0.05 + num(P.flipT, 0.35), ph)) - ez(sstep(0.55, 0.55 + num(P.flipT, 0.35), ph)));
  const a = -th - side * PI;
  const vertical = str(P.axis, 'x') === 'y';
  const un = u / Math.max(1, (tiles - 1) / 2);
  return {
    x,
    z: Math.sin(th) * num(P.lift, 0.3) - num(P.arc) * un * un * 0.8,
    rx: vertical ? 0 : a,
    ry: (vertical ? a : 0) - num(P.arc) * un * 0.5,
    o: Math.cos(a) > 0 ? 1 : 0,
    b: 1 - num(P.shade) + num(P.shade) * ab(Math.cos(th)),
  };
}

function heroTiltLayout(i: number, P: P, E: Env) {
  const sp = E.p * TAU * Math.round(num(P.swayN, 1));
  if (i === 0) return { rx: Math.sin(sp) * 0.12 * num(P.sway, 0.5), ry: Math.sin(sp + 1) * 0.3 * num(P.sway, 0.5), s: num(P.heroS, 1), zBias: 9 };
  const a = (i - 1) / (E.n - 1) * TAU + E.p * TAU * Math.round(num(P.laps, 1));
  return {
    x: Math.sin(a) * num(P.ringW, 3.1),
    y: Math.cos(a * 2) * num(P.waveR, 0.35),
    z: num(P.ringZ, -2.6) + Math.cos(a) * 0.6,
    s: num(P.moon, 0.55),
    blur: num(P.soft, 0.85),
    b: num(P.ringB, 0.55),
    ry: Math.sin(a) * 0.4,
  };
}

function spinLayout(i: number, P: P, E: Env) {
  const th = E.ez(E.p) * TAU * Math.round(num(P.spins, 1));
  const a = th + i * PI;
  const vertical = str(P.axis, 'y') === 'x';
  const sp = Math.sin(E.p * PI);
  const L = {
    ry: vertical ? 0 : a,
    rx: vertical ? a : 0,
    o: Math.cos(a) > 0 ? 1 : 0,
    x: Math.sin(E.p * TAU) * num(P.swing) * E.w * 0.5,
    y: sp * num(P.hop, 0.08),
    z: -sp * num(P.push),
    s: 1 + num(P.zoomS) * sp,
    b: 1 - num(P.shade) * (1 - ab(Math.cos(a))),
  };
  return num(P.lean) ? { ...L, m: M(T(L.x, L.y, L.z), RZ(num(P.lean)), vertical ? RX(a) : RY(a)) } : L;
}

function trioLayout(i: number, P: P, E: Env) {
  const k = [0, -1, 1][i % 3];
  const ph = E.p * TAU * Math.round(num(P.floatN, 1)) + i * 2.1;
  return {
    x: k * E.w * 0.95 * num(P.spread, 1),
    z: -ab(k) * num(P.deep, 0.6),
    ry: -k * num(P.angle, 0.42) + Math.sin(ph + 1) * num(P.sway),
    y: Math.sin(ph) * num(P.float, 0.04) - ab(k) * num(P.drop),
    s: k ? num(P.sideS, 0.9) : 1,
    b: k ? num(P.sideB, 1) : 1,
    blur: k ? num(P.soft) : 0,
    zBias: k ? 0 : 3,
  };
}

function rolodexLayout(i: number, P: P, E: Env) {
  const a0 = TAU / E.n;
  const R = E.h * (1 + num(P.gap, 0.05)) / (2 * Math.tan(PI / E.n)) * num(P.drum, 1);
  const a = rel(i, stepU(E.p, E.n, E.hold, E.ez), E.n) * a0;
  const c = Math.cos(a);
  return {
    m: M(T(Math.sin(a) * num(P.spiral) * E.w, 0, 0), RZ(num(P.tiltD)), T(0, R * Math.sin(a), R * c - R), RX(-a), RY(Math.sin(a) * num(P.twist))),
    b: 1 - num(P.dim, 0.55) + num(P.dim, 0.55) * Math.max(0, c),
    o: 1 - num(P.fadeBack) * clamp01(-c),
    s: 1 + num(P.pop) * Math.pow(Math.max(0, c), 6),
  };
}

function goldenZoomLayout(i: number, P: P, E: Env) {
  const q = wrap(i - E.p * E.n * Math.round(num(P.laps, 1)), E.n);
  const s = Math.pow(num(P.ratio, 0.7), q + num(P.start, -1.1));
  const th = q * num(P.turn, 0.2);
  const r = 0.3 * num(P.spread, 1) * s;
  const k = th * num(P.swirl, 2.2);
  return {
    x: Math.cos(k) * r * 1.2 * (num(P.oval, 1.5) / 1.5),
    y: Math.sin(k) * r * 0.8,
    rz: th + E.p * TAU * Math.round(num(P.spinG)),
    s,
    zBias: q * 0.05,
    o: clamp01(q * 0.9) * clamp01((E.n - q) * 2),
    b: 1 - num(P.dim) * q / E.n,
    blur: num(P.soft) * q / E.n,
  };
}

function corridorLayout(i: number, P: P, E: Env) {
  const rows = Math.round(num(P.rows, 2));
  const side = i % 2 ? 1 : -1;
  const k = Math.floor(i / 2);
  const row = k % rows;
  const m = Math.max(1, Math.ceil(E.n / 2 / rows));
  const j = Math.floor(k / rows);
  const sides = str(P.sides, 'both');
  const Lz = m * E.w * (1 + num(P.gap, 0.45));
  const t = wrap(j / m + E.p * Math.round(num(P.laps, 1)) + (side > 0 ? 0.5 / m : 0), 1);
  const hide = (sides === 'left' && side > 0) || (sides === 'right' && side < 0);
  return {
    x: side * num(P.width, 0.72),
    y: (row - (rows - 1) / 2) * E.h * num(P.rowH, 1.22) + Math.sin(E.p * TAU * 8) * num(P.bob),
    z: E.D - 0.3 - (1 - t) * Lz,
    ry: -side * (PI / 2 - num(P.angle)),
    o: hide ? 0 : clamp01(t * 5) * clamp01((1 - t) * m * 0.9) * (1 - num(P.fog) * (1 - t)),
    b: 1 - num(P.dim, 0.45) + num(P.dim, 0.45) * t,
  };
}

function driftLayout(i: number, P: P, E: Env) {
  const layer = i % 3;
  const k = Math.floor(i / 3);
  const m = Math.max(1, Math.ceil(E.n / 3));
  const speed = (str(P.pace, 'layered') === 'same' ? 1 : layer + 1) * Math.round(num(P.rate, 1));
  const w = [1, 0.5, 0][layer];
  const z = [-1, -0.35, 0.3][layer] * num(P.depth, 1.5);
  const vis = (E.D * E.vy - z) / E.D;
  const t = wrap(k / m + E.rnd(i, 1) * 0.5 / m + E.p * speed, 1);
  const y = (t - 0.5) * (2 * vis + E.h * 2.4);
  const x = (((k * 2 + layer) % 5) / 4 - 0.5 + (E.rnd(i, 2) - 0.5) * 0.18) * 2 * (E.vx / E.vy) * vis * 0.78 * num(P.spread, 1) + Math.sin(t * TAU) * num(P.weave);
  return {
    x, y, z,
    rz: Math.sin(E.p * TAU * speed + i) * num(P.rock, 0.05),
    ry: Math.sin(E.p * TAU + i * 1.7) * num(P.sway, 0.12),
    s: lerp(1, num(P.farS, 1), w),
    o: clamp01(Math.min(t, 1 - t) * 14),
    b: 1 - num(P.dim) * w,
    blur: num(P.soft) * w,
  };
}

function pageFanLayout(i: number, P: P, E: Env) {
  const n = E.n;
  const ripN = Math.round(num(P.ripN, 1));
  const spread = num(P.spread, 0.85) * (1 - num(P.breathe) * 0.35 * (1 - Math.cos(TAU * E.p)));
  const base = lerp(PI / 2 - spread * PI * 0.46, PI / 2 + spread * PI * 0.46, i / Math.max(1, n - 1));
  const th = base + num(P.ripple, 0.35) * 0.5 * Math.sin(TAU * (ripN * E.p - ripN * i / n));
  return {
    m: M(RY(-th), RZ(-num(P.droop)), T(E.w / 2, num(P.stair) * (i / Math.max(1, n - 1) - 0.5) * E.h * 0.3, 0)),
    bend: num(P.curl, 0.3) * 0.6,
    b: 1 - num(P.pageShade, 0.2) + num(P.pageShade, 0.2) * ab(Math.cos(th)),
    blur: num(P.outerBlur) * 0.6 * clamp01(ab(th - PI / 2) / (PI * 0.46)),
    zBias: -ab(th - PI / 2),
  };
}

export const SHOWCASE3D_TEMPLATES: Template[] = [
  {
    id: 'cubic', name: 'Cubic', cat: '3d', n: 6, fixedN: true, frame: '5:4', aspect: 1, cardH: 0.95, dur: 10,
    desc: 'Six photos on a cube tumbling in space.',
    params: params([
      group('Layout'), range('tilt', 'Tilt', -1, 1, 0.42), off('gapC', 'Explode', 1),
      group('Motion'), range('turns', 'Turns per loop', -3, 3, 1, 1, { unit: ' turns' }), range('roll', 'Roll', -2, 2, 0, 1, { unit: ' turns' }),
      range('wobble', 'Wobble', 0, 1, 0.45), whole('wobN', 'Wobble cycles', 1, 4, 1, { unit: '\u00d7' }),
      off('breath', 'Breathe', 1, { hint: 'the faces part and close twice a loop' }), group('Look'), off('shade', 'Face shade', 1),
    ]),
    fill: () => ({ count: 6 }),
    layout: cubicLayout,
  },
  {
    id: 'space', name: 'Space', cat: '3d', n: 24, aspect: 0.8, cardH: 0.55, dur: 16, frame: '5:4',
    desc: 'Photos drift toward you through deep space.',
    style: { blur: { on: true, depth: 0.5 } },
    params: params([
      group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('depth', 'Depth', 4, 20, 11, 0.1), range('hole', 'Clear centre', 0, 1.2, 0.55), range('oval', 'Width', 0.5, 1.6, 1, 0.01, { unit: '\u00d7' }),
      group('Motion'), range('swirl', 'Swirl', -2, 2, 0, 1, { unit: ' turns' }), off('tumble', 'Tumble', 1), range('jitter', 'Card angles', 0, 2.5, 1, 0.01, { unit: '\u00d7' }),
      group('Look'), off('fog', 'Far fade', 1), off('dim', 'Far dim', 1),
    ]),
    fill: (P, E) => {
      const depth = num(P.depth, 11), spread = num(P.spread, 1);
      const layers = Math.ceil(depth / (E.h * 0.8));
      // Ensure minimum 2 cards even with low spread and 2 images
      const count = Math.max(2, Math.min(200, layers * Math.round(Math.max(1, E.n * spread))));
      return { count };
    },
    layout: spaceLayout,
  },
  {
    id: 'flip-flap', name: 'Flip-Flap', cat: '3d', n: 8, aspect: 0.8, cardH: 0.95, dur: 6, frame: '5:4',
    desc: 'A row of panels flipping over one after another.',
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.1), off('arc', 'Row arc', 1),
      group('Motion'), range('wave', 'Wave delay', 0, 0.2, 0.08, 0.005), segment('from', 'Wave from', { left: 'Left', right: 'Right', center: 'Centre' }, 'left'),
      segment('axis', 'Flip axis', { x: 'Over the top', y: 'Sideways' }, 'x'), range('flipT', 'Flip time', 0.15, 0.45, 0.35),
      select('feel', 'Flip feel', { inOutBack: 'Anticipate', inOutCubic: 'Smooth', outBack: 'Overshoot', inOutExpo: 'Snap' }, 'inOutBack'), range('lift', 'Flip lift', 0, 0.8, 0.3),
      group('Look'), off('shade', 'Flip shade', 1),
    ]),
    fill: (_P, E) => ({ count: E.n }),
    layout: flipFlapLayout,
  },
  {
    id: 'hero-tilt', name: 'Hero Tilt', cat: '3d', n: 9, aspect: 0.8, cardH: 1.3, dur: 9, frame: '5:4',
    desc: 'One hero photo tilting gently, with a blurred ring of others behind it.',
    params: params([
      group('Layout'), range('heroS', 'Hero size', 0.6, 1.4, 1, 0.01, { unit: '\u00d7' }), range('ringW', 'Ring width', 1.5, 4.5, 3.1), range('ringZ', 'Ring distance', -5, -1, -2.6), range('moon', 'Ring card size', 0.3, 1, 0.55),
      group('Motion'), range('sway', 'Hero sway', 0, 1, 0.5), whole('swayN', 'Sway cycles', 1, 3, 1, { unit: '\u00d7' }), range('laps', 'Ring turns', -2, 2, 1, 1, { unit: ' turns' }), range('waveR', 'Ring wave', 0, 1, 0.35),
      group('Look'), range('soft', 'Ring blur', 0, 1, 0.85), range('ringB', 'Ring brightness', 0.1, 1, 0.55),
    ]),
    fill: (_P, E) => ({ count: E.n }),
    layout: heroTiltLayout,
  },
  {
    id: 'spin', name: 'Spin', cat: '3d', n: 2, fixedN: true, aspect: 0.8, cardH: 1.2, dur: 3.5, frame: '5:4',
    desc: 'A photo spinning like a coin to reveal another.',
    params: params([
      group('Layout'), segment('axis', 'Spin axis', { y: 'Vertical', x: 'Horizontal' }, 'y'), range('lean', 'Axis lean', -0.6, 0.6, 0),
      group('Motion'), range('spins', 'Spins', 1, 4, 1, 1), select('ease', 'Easing', { inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear' }, 'inOutQuint'), range('hop', 'Hop', 0, 0.5, 0.08), off('push', 'Push back', 1.5), off('swing', 'Swing', 1),
      group('Look'), range('zoomS', 'Spin zoom', -0.4, 0.4, 0), off('shade', 'Edge shade', 1),
    ]),
    fill: () => ({ count: 2 }),
    layout: spinLayout,
  },
  {
    id: 'trio', name: 'Trio', cat: '3d', n: 3, fixedN: true, aspect: 0.8, cardH: 1.25, dur: 8, frame: '5:4',
    desc: 'Three photos posed in a gentle arc, floating.',
    params: params([
      group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('deep', 'Side depth', 0, 1.5, 0.6), range('angle', 'Side turn', -1, 1, 0.42), range('sideS', 'Side scale', 0.5, 1.1, 0.9), range('drop', 'Side drop', -0.4, 0.4, 0),
      group('Motion'), range('float', 'Float', 0, 0.2, 0.04, 0.005), whole('floatN', 'Float cycles', 1, 3, 1, { unit: '\u00d7' }), off('sway', 'Sway', 0.3),
      group('Look'), range('sideB', 'Side brightness', 0.3, 1, 1), off('soft', 'Side blur', 1),
    ]),
    fill: () => ({ count: 3 }),
    layout: trioLayout,
  },
  {
    id: 'rolodex', name: 'Rolodex', cat: '3d', n: 10, aspect: 1.25, step: true, cardH: 0.78, perCard: 1.4, frame: '5:4',
    desc: 'Photos on a drum that flips forward one card at a time.',
    mods: { poseRy: -20 },
    params: params([
      group('Layout'), range('gap', 'Gap', 0, 0.8, 0.05), range('drum', 'Drum size', 0.6, 2, 1, 0.01, { unit: '\u00d7' }), range('tiltD', 'Drum tilt', -0.6, 0.6, 0), range('twist', 'Twist', -0.6, 0.6, 0), off('spiral', 'Spiral', 0.5),
      group('Look'), range('dim', 'Back shade', 0, 1, 0.55), off('fadeBack', 'Back fade', 1), off('pop', 'Front pop', 0.4),
    ]),
    fill: (_P, E) => {
      const res = stripFill(E, E.vx, E.w * (1 + num(_P.gap, 0.05)));
      return { count: Math.min(res.count, E.n) };
    },
    layout: rolodexLayout,
  },
  {
    id: 'golden-zoom', name: 'Infinite Zoom', cat: '3d', n: 12, aspect: 0.8, cardH: 1.3, dur: 20, frame: '5:4',
    desc: 'An endless zoom through photos nested inside each other.',
    params: params([
      group('Layout'), range('ratio', 'Shrink', 0.5, 0.9, 0.7, 0.005), range('turn', 'Turn', -0.8, 0.8, 0.2), range('spread', 'Spread', 0.2, 2, 1),
      range('swirl', 'Spiral rate', 0, 5, 2.2, 0.05), range('oval', 'Spiral shape', 0.4, 2.5, 1.5), range('start', 'Zoom start', -2.5, -0.3, -1.1),
      group('Motion'), range('laps', 'Cards per loop', 1, 3, 1, 1, { unit: '\u00d7' }), range('spinG', 'Spin', -2, 2, 0, 1, { unit: ' turns' }),
      group('Look'), off('dim', 'Depth dim', 1), off('soft', 'Depth blur', 1),
    ]),
    fill: (_P, E) => ({ count: E.n }),
    layout: goldenZoomLayout,
  },
  {
    id: 'corridor', name: 'Gallery Walk', cat: '3d', n: 32, aspect: 0.8, cardH: 0.5, dur: 20, frame: '5:4', fov: 62,
    desc: 'Walk down a gallery hallway with photos hung on both walls.',
    params: params([
      group('Layout'), range('width', 'Hall width', 0.4, 2.5, 0.72), range('gap', 'Gap', 0, 0.8, 0.45), whole('rows', 'Rows', 1, 3, 2), range('rowH', 'Row spacing', 0.9, 2, 1.22), range('angle', 'Wall angle', -0.6, 0.6, 0), segment('sides', 'Walls', { both: 'Both', left: 'Left', right: 'Right' }, 'both'),
      group('Motion'), whole('laps', 'Walk speed', 1, 3, 1, { unit: '\u00d7' }), off('bob', 'Step bob', 0.1, { step: 0.005 }),
      group('Look'), range('dim', 'Far dim', 0, 1, 0.45), off('fog', 'Far fade', 1),
    ]),
    fill: (P, E) => {
      const rows = Math.round(num(P.rows, 2)), m = Math.max(1, Math.ceil(E.n / 2 / rows));
      return { count: rows * 2 * m };
    },
    layout: corridorLayout,
  },
  {
    id: 'drift', name: 'Floating Gallery', cat: '3d', n: 15, aspect: 0.8, cardH: 0.56, dur: 24, frame: '5:4',
    desc: 'Photos float upward at three depths, each layer at its own pace.',
    style: { blur: { on: true, depth: 0.3 } },
    params: params([
      group('Layout'), range('spread', 'Spread', 0.2, 2, 1), range('depth', 'Depth', 0, 3, 1.5), range('farS', 'Back layer size', 0.5, 1.5, 1, 0.01, { unit: '\u00d7' }),
      group('Motion'), whole('rate', 'Rise speed', 1, 3, 1, { unit: '\u00d7' }), segment('pace', 'Layers', { layered: 'Own pace', same: 'Same pace' }, 'layered'), off('weave', 'Weave', 0.5), range('sway', 'Sway', 0, 0.6, 0.12), range('rock', 'Rock', 0, 0.3, 0.05),
      group('Look'), off('dim', 'Back layer dim', 0.7), off('soft', 'Back layer blur', 1),
    ]),
    fill: (_P, E) => ({ count: E.n }),
    layout: driftLayout,
  },
  {
    id: 'page-fan', name: 'Page Fan', cat: '3d', n: 12, aspect: 0.78, cardH: 0.9, dur: 10, frame: '5:4',
    mods: { poseRx: 18 },
    desc: 'Photos hinged on one spine fan open like the pages of a book, while a ripple runs through them.',
    params: params([
      group('Layout'), range('spread', 'Spread', 0.2, 1, 0.85), range('droop', 'Droop', -0.6, 0.6, 0), range('stair', 'Stair', -1, 1, 0), range('curl', 'Page curl', 0, 1, 0.3),
      group('Motion'), range('ripple', 'Ripple', 0, 0.8, 0.35), whole('ripN', 'Ripple count', 1, 3, 1, { unit: '\u00d7' }), off('breathe', 'Breathe', 1, { hint: 'the fan closes a little and opens again each loop' }),
      group('Look'), range('pageShade', 'Page shade', 0, 0.6, 0.2), off('outerBlur', 'Outer blur', 1),
    ]),
    fill: (_P, E) => ({ count: E.n }),
    layout: pageFanLayout,
  },
];
