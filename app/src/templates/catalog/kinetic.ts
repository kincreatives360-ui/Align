import type { Env, P, Template } from '../types';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl } from '../referenceControls';
import { ab, aim, clamp01, ease, fibo, frame3, lerp, M, num, RX, RY, RZ, stepU, TAU, T, wrap } from '../kit';

const PI = Math.PI;
type HouseSpot = { x: number; y: number; rx?: number; rz?: number };
type KineticEnv = Env & { spots?: HouseSpot[] };

const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, min, max, def, 1, extra);
const cyc = (key: string, label: string, min: number, max: number, def: number) => whole(key, label, min, max, def, { unit: '×', hint: 'whole cycles per loop, so it stays seamless' });
const off = (key: string, label: string, max: number, def = 0, step = 0.01) => range(key, label, 0, max, def, step, { off: true });
const group = (name: string): ReferenceControl => ({ group: name });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
const NEW = { isNew: true, frame: '5:4' as const };
const sstep = (a: number, b: number, value: number): number => { const t = clamp01((value - a) / (b - a)); return t * t * (3 - 2 * t); };

function houseFill(P: P, E: Env): Record<string, unknown> {
  const h = E.h, lean = num(P.lean, 0.3), tentGap = num(P.tentGap, 0.05), tw = 2 * h * Math.sin(lean) + tentGap, lh = h * Math.cos(lean), spots: HouseSpot[] = [];
  let base = -0.82;
  for (let level = 0; level < 3; level++) {
    const tents = 3 - level;
    for (let tent = 0; tent < tents; tent++) {
      const cx = (tent - (tents - 1) / 2) * tw;
      spots.push({ x: cx - h / 2 * Math.sin(lean), y: base + lh / 2, rz: -lean }, { x: cx + h / 2 * Math.sin(lean), y: base + lh / 2, rz: lean });
    }
    for (let tent = 0; tent < tents - 1; tent++) spots.push({ x: (tent - (tents - 2) / 2) * tw, y: base + lh + 0.01, rx: -PI / 2 });
    base += lh + 0.015;
  }
  return { spots, count: spots.length };
}

function ripplesFill(P: P): Record<string, number> {
  return { count: Math.round(num(P.rings, 5)) * Math.round(num(P.per, 16)) };
}

export const KINETIC_TEMPLATES: Template[] = [
  { ...NEW, id: 'pendulum', name: 'Pendulum Wave', cat: 'kinetic', n: 12, aspect: 0.8, cardH: 0.3, dur: 60,
    mods: { poseRy: -52, poseRx: 10 },
    desc: 'A row of hanging photos, each swinging a little faster than the last, weaving waves in and out of sync.',
    params: params([group('Layout'), range('pivot', 'Pivot height', -0.2, 1.2, 0.6), range('length', 'String', 0.3, 1.4, 0.6), range('lenRamp', 'String ramp', -0.6, 0.6, 0), range('gap', 'Gap', 0, 0.8, 0.12),
      group('Motion'), whole('base', 'Base swings', 4, 30, 14, { hint: 'whole swings per loop for the slowest card' }), cyc('stepN', 'Speed step', 1, 3, 1), range('amp', 'Swing', 0.1, 1.2, 0.62), off('phase', 'Phase spread', 1),
      group('Look'), range('swingShade', 'Swing shade', 0, 0.6, 0.15), off('mblur', 'Motion blur', 1)]),
    layout(i, P, E) {
      const w = TAU * ((Math.round(num(P.base, 14)) + i * Math.round(num(P.stepN, 1))) * E.p + i / E.n * num(P.phase));
      const th = num(P.amp, 0.62) * Math.cos(w), x = (i - (E.n - 1) / 2) * E.w * (1 + num(P.gap, 0.12));
      const L = num(P.length, 0.6) * (1 + num(P.lenRamp) * (E.n > 1 ? i / (E.n - 1) * 2 - 1 : 0));
      return { m: M(T(x, num(P.pivot, 0.6), 0), RX(th), T(0, -L, 0)), b: 1 - num(P.swingShade, 0.15) + num(P.swingShade, 0.15) * Math.cos(th), blur: num(P.mblur) * 0.6 * ab(Math.sin(w)) };
    } },

  { ...NEW, id: 'fountain', name: 'Fountain', cat: 'kinetic', n: 30, aspect: 0.8, cardH: 0.3, dur: 9,
    desc: 'Photos burst up from below the frame in tumbling arcs and rain back down.',
    params: params([group('Layout'), range('height', 'Height', 0.4, 1.6, 1), range('spread', 'Spread', 0.2, 2, 1), range('depthF', 'Depth', 0, 4, 1.6), off('drag', 'Air drag', 1),
      group('Motion'), whole('bursts', 'Arcs per loop', 1, 4, 2), off('volley', 'Volley', 1), range('whirl', 'Tumble', 0, 3, 1.2), whole('flip', 'Flips', 0, 3, 0, { unit: ' turns' }),
      group('Look'), range('grow', 'Launch grow', 0, 0.8, 0.35), off('mblur', 'Motion blur', 1)]),
    layout(i, P, E) {
      const s = wrap(E.p * Math.round(num(P.bursts, 2)) + i / E.n * (1 - num(P.volley) * 0.85), 1), base = -E.vy - E.h * 0.8;
      const peak = (2 * E.vy + E.h) * num(P.height, 1) * (0.72 + 0.28 * E.rnd(i, 1)), dir = (E.rnd(i, 2) - 0.5) * 2;
      const sx = lerp(s, 1 - (1 - s) * (1 - s), num(P.drag));
      const x = dir * E.vx * 0.95 * num(P.spread, 1) * sx, y = base + 4 * peak * s * (1 - s), z = (E.rnd(i, 3) - 0.5) * num(P.depthF, 1.6);
      const whirl = num(P.whirl, 1.2);
      return { x, y, z, rz: dir * whirl * TAU * s * 0.5, rx: (E.rnd(i, 4) - 0.5) * whirl * TAU * s,
        ry: Math.round(num(P.flip)) * TAU * s * (E.rnd(i, 5) < 0.5 ? -1 : 1), s: 1 - num(P.grow, 0.35) + num(P.grow, 0.35) * sstep(0, 0.25, s), blur: num(P.mblur) * 0.6 * ab(1 - 2 * s) };
    } },

  { ...NEW, id: 'leaves', name: 'Falling Leaves', cat: 'kinetic', n: 22, aspect: 0.8, cardH: 0.34, dur: 16,
    desc: 'Photos drift down like leaves, swaying, turning and tipping as they fall.',
    params: params([group('Layout'), range('depth', 'Depth', 0, 4, 2.4), range('spread', 'Spread', 0.2, 2, 1), range('wind', 'Wind', -1, 1, 0),
      group('Motion'), whole('nearSp', 'Near layer speed', 1, 3, 2, { unit: '×' }), range('sway', 'Sway', 0, 1, 0.45), whole('swings', 'Swings per fall', 1, 4, 2), range('flip', 'Flutter', 0, 1.5, 0.6), whole('twirl', 'Spin', 0, 2, 0, { unit: ' turns' }),
      group('Look'), range('depthDim', 'Depth dim', 0, 0.6, 0.15), off('dof', 'Depth blur', 1)]),
    layout(i, P, E) {
      const layer = E.rnd(i, 1), depth = num(P.depth, 2.4), z = lerp(-depth, 0.7, layer), vis = (E.D * E.vy - z) / E.D, sp = layer > 0.5 ? Math.round(num(P.nearSp, 2)) : 1;
      const s = wrap(i / E.n * sp + E.p * sp, 1), w = TAU * (Math.round(num(P.swings, 2)) * s + E.rnd(i, 2));
      const spread = num(P.spread, 1), sway = num(P.sway, 0.45), wind = num(P.wind);
      const x = (E.rnd(i, 3) - 0.5) * 2 * (E.vx / E.vy) * vis * 0.85 * spread + sway * Math.sin(w) * 0.5 + wind * (s - 0.5) * 1.2 * (E.vx / E.vy) * vis;
      const y = (0.5 - s) * 2 * (vis + E.h), twirl = Math.round(num(P.twirl));
      const flutter = num(P.flip, 0.6), depthDim = num(P.depthDim, 0.15);
      return { x, y, z, rz: -sway * Math.cos(w) * 0.7 + twirl * TAU * s * (E.rnd(i, 4) < 0.5 ? -1 : 1), ry: flutter * Math.sin(w * 0.5 + i), rx: flutter * 0.4 * Math.cos(w),
        b: 1 - depthDim + depthDim * layer, blur: num(P.dof) * (1 - layer) * 0.7 };
    } },

  { ...NEW, id: 'murmuration', name: 'Murmuration', cat: 'kinetic', n: 64, aspect: 0.8, cardH: 0.14, dur: 24,
    desc: 'A flock of tiny photos wheels across the frame like starlings, stretching and folding as it turns.',
    params: params([group('Form'), range('flock', 'Flock size', 0.3, 1.5, 0.8), range('flockH', 'Flock height', 0.1, 1.5, 0.6), range('stretch', 'Stretch', 0, 2, 1), range('jit', 'Swarm jitter', 0, 0.4, 0.1),
      group('Motion'), cyc('loops', 'Path loops', 1, 3, 1), range('roam', 'Roam', 0, 1.2, 0.45), range('breath', 'Breathe', 0, 0.5, 0.2), range('flap', 'Flutter', 0, 1, 0.4),
      group('Look'), range('sizeMix', 'Size mix', 0, 1, 0.4), off('depthShade', 'Depth shade', 0.6)]),
    layout(i, P, E) {
      const t = E.p * TAU, tl = t * Math.round(num(P.loops, 1)), roam = num(P.roam, 0.45);
      const C = [roam * Math.sin(tl), roam * 0.5 * Math.sin(2 * tl + 0.6), roam * 0.8 * Math.sin(tl + 1.3)];
      const V = [Math.cos(tl), Math.cos(2 * tl + 0.6), 0.8 * Math.cos(tl + 1.3)], vl = Math.hypot(...V) || 1;
      const R = num(P.flock, 0.8) * (0.55 + num(P.breath, 0.2) * Math.sin(2 * t)), d = fibo(i, E.n), q = E.rnd(i, 1) * TAU, jit = num(P.jit, 0.1);
      let o = [d[0] * R + jit * Math.sin(3 * t + q), d[1] * R * num(P.flockH, 0.6) + jit * Math.cos(2 * t + q), d[2] * R + jit * Math.sin(4 * t + q * 2)];
      const along = (o[0] * V[0] + o[1] * V[1] + o[2] * V[2]) / vl * num(P.stretch, 1) * 0.6;
      o = o.map((v, k) => v + V[k] / vl * along);
      const z = C[2] + o[2], sizeMix = num(P.sizeMix, 0.4);
      return { x: C[0] + o[0], y: C[1] + o[1], z, rz: Math.atan2(V[1], V[0]) * 0.5, ry: num(P.flap, 0.4) * Math.sin(TAU * 6 * E.p + q),
        s: 1 - sizeMix / 2 + sizeMix * E.rnd(i, 2), b: 1 - num(P.depthShade) * clamp01(0.5 - z * 0.6) };
    } },

  { ...NEW, id: 'serpent', name: 'Serpent', cat: 'kinetic', n: 18, aspect: 0.8, cardH: 0.34, dur: 14,
    desc: 'A chain of photos slithers through space, each one following the one in front.',
    params: params([group('Form'), range('reach', 'Reach', 0.4, 1.4, 0.85), range('rise', 'Height', 0, 1.5, 0.58), whole('coils', 'Coils', 1, 5, 3), range('spacing', 'Spacing', 0.4, 2.5, 1), range('taper', 'Taper', 0, 0.9, 0.55),
      group('Motion'), cyc('laps', 'Laps', 1, 3, 1), off('undulate', 'Undulate', 0.3), range('bank', 'Bank', 0, 1.5, 0.6),
      group('Look'), off('tailFade', 'Tail fade', 1), off('tailShade', 'Tail shade', 0.7)]),
    layout(i, P, E) {
      const coils = Math.round(num(P.coils, 3)), reach = num(P.reach, 0.85), rise = num(P.rise, 0.58);
      const path = (u: number): [number, number, number] => { const a = u * TAU; return [reach * 1.05 * Math.sin(a), reach * rise * Math.sin(2 * a + 0.5), reach * 0.9 * Math.sin(coils * a)]; };
      const u = E.p * Math.round(num(P.laps, 1)) - i * 0.028 * num(P.spacing, 1), [x, y, z] = path(u), [x2, y2, z2] = path(u + 0.002), tx = x2 - x, ty = y2 - y, tz = z2 - z;
      const f = i / Math.max(1, E.n - 1), yu = y + num(P.undulate, 0.3) * Math.sin(TAU * 3 * E.p - i * 0.7);
      return { m: frame3(x, yu, z, [tx, ty * num(P.bank, 0.6), tz], [-tz * 0.5, 0, 1]), s: 1 - num(P.taper, 0.55) * f,
        o: clamp01((E.n - i) / 2.5) * (1 - num(P.tailFade) * f), b: 1 - num(P.tailShade, 0.7) * f, zBias: -i * 0.01 };
    } },

  { ...NEW, id: 'slinky', name: 'Slinky', cat: 'kinetic', n: 8, aspect: 0.8, step: true, perCard: 0.8, cardH: 0.7,
    desc: 'Photos flip one by one over an arch from one stack to the other, then all the way back.',
    params: params([group('Form'), range('arch', 'Arch', 0.3, 1.4, 0.8), range('apart', 'Distance', 0.5, 1.5, 1), range('depth', 'Stack depth', 0, 0.2, 0.07), range('fan', 'Stack fan', 0, 0.15, 0.03), range('arcZ', 'Arc depth', -1, 1, 0.25),
      group('Motion'), whole('flips', 'Flips', 1, 3, 1), off('tumble', 'Tumble', 1.5), off('pop', 'Flight pop', 0.5),
      group('Look'), range('stackShade', 'Stack shade', 0, 0.15, 0.05), off('mblur', 'Motion blur', 1)]),
    layout(i, P, E) {
      const n = E.n, U = stepU(E.p, 2 * n, E.hold, E.ez), j0 = i, j1 = 2 * n - 1 - i, X = 0.72 * num(P.apart, 1), F = 2 * Math.round(num(P.flips, 1)) - 1;
      const stack = (side: number, k: number) => ({ x: side * X + k * num(P.fan, 0.03) * side, y: -0.12 - k * 0.025, z: -k * num(P.depth, 0.07), b: 1 - Math.min(0.35, k * num(P.stackShade, 0.05)) });
      const fly = (e: number, from: number) => { const c = Math.sin(PI * e); return { x: lerp(from * X, -from * X, e), y: -0.12 + num(P.arch, 0.8) * c, z: num(P.arcZ, 0.25) * c,
        ry: PI * e * F, rz: num(P.tumble) * c * from, s: 1 + num(P.pop) * c, blur: num(P.mblur) * 0.6 * c, zBias: 20 }; };
      if (U < j0) return { ...stack(-1, i - U) };
      if (U < j0 + 1) return { ...fly(U - j0, -1) };
      if (U < j1) return { ...stack(1, Math.max(0, U < n ? U - i - 1 : j1 - U)), ry: PI };
      if (U < j1 + 1) return { ...fly(U - j1, 1), ry: PI + PI * (U - j1) * F };
      return { ...stack(-1, U - j1 - 1) };
    } },

  { ...NEW, id: 'house', name: 'House of Cards', cat: 'kinetic', n: 15, fixedN: true, aspect: 0.7, cardH: 0.48, dur: 14,
    mods: { poseRx: 12 },
    desc: 'Photos fly in one by one to build a house of cards, hold for a breath, then it all collapses.',
    params: params([group('Form'), range('lean', 'Lean', 0.15, 0.5, 0.3), range('tentGap', 'Tent spacing', 0, 0.3, 0.05),
      group('Motion'), range('build', 'Build time', 0.4, 0.75, 0.6), range('dropH', 'Drop height', 0.4, 2.4, 1.2), range('spinIn', 'Spin in', 0, 3, 0.6), range('toss', 'Toss', 0, 2, 1), range('scatter', 'Collapse', 0.3, 2, 1), range('gravity', 'Gravity', 2.5, 6, 3.4),
      group('Look'), off('levelShade', 'Level shade', 0.5), off('crashBlur', 'Collapse blur', 1)]),
    fill: houseFill,
    layout(i, P, E0) {
      const E = E0 as KineticEnv, sp = E.spots?.[i] ?? { x: 0, y: 0 }, N = E.spots?.length ?? 0, build = num(P.build, 0.6), t0 = i / Math.max(1, N) * build * 0.92;
      const e = ease.outCubic(clamp01((E.p - t0) / 0.1)), fromX = (E.rnd(i, 1) - 0.5) * 3, fromY = E.vy + num(P.dropH, 1.2), bt = 1 - num(P.levelShade) * clamp01((0.4 - sp.y) / 1.2);
      if (E.p < 0.8) return { x: lerp(fromX, sp.x, e), y: lerp(fromY, sp.y, e), z: lerp(0.8, 0, e), rx: lerp(1.2, sp.rx ?? 0, e), rz: lerp((E.rnd(i, 2) - 0.5) * 3 * num(P.toss, 1), sp.rz ?? 0, e), ry: lerp(num(P.spinIn, 0.6), 0, e), b: bt };
      const q = (E.p - 0.8) / 0.2, d = (E.rnd(i, 3) - 0.5) * 2 * num(P.scatter, 1);
      return { x: sp.x + d * q * 1.2, y: sp.y - num(P.gravity, 3.4) * q * q - 0.3 * q, z: (E.rnd(i, 4) - 0.3) * q,
        rx: (sp.rx ?? 0) + d * q * 2, rz: (sp.rz ?? 0) + d * q * 3, b: bt, blur: num(P.crashBlur) * q * 0.8 };
    } },

  { ...NEW, id: 'hourglass', name: 'Hourglass', cat: 'kinetic', n: 56, aspect: 0.8, cardH: 0.2, dur: 16,
    desc: 'Photos swirl down through the neck of an hourglass and spread into the lower bulb.',
    params: params([group('Form'), range('bulb', 'Bulb width', 0.5, 1.6, 1.05), range('neck', 'Neck', 0.02, 0.3, 0.05), range('neckLen', 'Neck length', 0, 0.4, 0.06), range('round', 'Bulb roundness', 0.4, 2, 1), range('tilt', 'View angle', 0, 0.8, 0.3),
      group('Motion'), cyc('flow', 'Flow speed', 1, 3, 1), whole('swirl', 'Swirl', -4, 4, 2, { unit: '×' }), whole('tumble', 'Tumble', 0, 3, 0, { unit: ' turns' }),
      group('Look'), range('backShade', 'Back shade', 0, 0.6, 0.25), range('sizeFall', 'Size falloff', 0, 1, 0.6)]),
    layout(i, P, E) {
      const bulb = num(P.bulb, 1.05), neck = num(P.neck, 0.05), tilt = num(P.tilt, 0.3), s = wrap(i / E.n + E.p * Math.round(num(P.flow, 1)), 1);
      const top = (E.vy + E.h + bulb * Math.sin(tilt)) / Math.cos(tilt), a0 = E.rnd(i, 1) * TAU, nl = num(P.neckLen, 0.06), round = num(P.round, 1);
      let y: number, r: number;
      if (s < 0.46) { const q = s / 0.46; y = lerp(top, nl, q); r = lerp(bulb, neck, Math.pow(q, 0.7 * round)); }
      else if (s < 0.54) { const q = (s - 0.46) / 0.08; y = lerp(nl, -nl, q); r = neck; }
      else { const q = (s - 0.54) / 0.46; y = lerp(-nl, -top, q); r = lerp(neck, bulb, Math.pow(q, 0.55 * round)); }
      const a = a0 + s * TAU * num(P.swirl, 2), x = r * Math.cos(a), z = r * Math.sin(a), X = x, Y = y * Math.cos(tilt) - z * Math.sin(tilt), Z = y * Math.sin(tilt) + z * Math.cos(tilt);
      return { x: X, y: Y, z: Z, rz: a * 0.15, ry: Math.round(num(P.tumble)) * TAU * s,
        s: 1 - num(P.sizeFall, 0.6) + num(P.sizeFall, 0.6) * r / Math.max(bulb, 0.1), b: 1 - num(P.backShade, 0.25) + num(P.backShade, 0.25) * (z / Math.max(r, 0.01) * 0.5 + 0.5) };
    } },

  { ...NEW, id: 'big-bang', name: 'Big Bang', cat: 'kinetic', n: 40, aspect: 0.8, cardH: 0.36, dur: 12,
    desc: 'A tight deck explodes into a spinning cloud of photos, then implodes back into the deck.',
    params: params([group('Form'), range('radius', 'Radius', 0.4, 2.5, 0.95), off('flatten', 'Flatten', 0.9), range('shell', 'Shell thickness', 0, 1, 0.4),
      group('Motion'), range('blast', 'Blast time', 0.08, 0.4, 0.2), range('burstSpread', 'Burst spread', 0, 0.3, 0.05), range('hang', 'Hang time', 0.2, 0.6, 0.4), range('whirl', 'Whirl', 0, 3, 1), range('wild', 'Chaos', 0, 1, 0.5),
      group('Look'), off('flash', 'Flash', 1), off('cloudBlur', 'Cloud blur', 1)]),
    layout(i, P, E) {
      const t0 = 0.06 + E.rnd(i, 1) * num(P.burstSpread, 0.05), h0 = 0.3 + num(P.hang, 0.4), out = ease.outExpo(clamp01((E.p - t0) / num(P.blast, 0.2)));
      const back = ease.inOutCubic(clamp01((E.p - h0) / 0.26)), w = out * (1 - back), d = fibo(i, E.n), dy = d[1] * (1 - num(P.flatten));
      const radius = num(P.radius, 0.95), shell = num(P.shell, 0.4), R = radius * (1 - shell / 2 + shell * E.rnd(i, 2)), ang = TAU * num(P.whirl, 1) * sstep(t0, h0 + 0.26, E.p);
      const ca = Math.cos(ang), sa = Math.sin(ang), sx = d[0] * ca + d[2] * sa, sz = -d[0] * sa + d[2] * ca, A = aim(sx, dy, sz), spin = (E.rnd(i, 3) - 0.5) * TAU * num(P.wild, 0.5);
      const flash = num(P.flash), cloudBlur = num(P.cloudBlur);
      return { x: lerp((E.rnd(i, 4) - 0.5) * 0.02, sx * R, w), y: lerp(i * 0.004 - 0.08, dy * R * 0.85, w), z: lerp(-i * 0.012, sz * R, w),
        ry: A.ry * w, rx: A.rx * w, rz: lerp((E.rnd(i, 5) - 0.5) * 0.08, spin, w), b: 1 + flash * Math.sin(PI * out) * (1 - back), blur: cloudBlur * w * 0.7 * E.rnd(i, 6) };
    } },

  { ...NEW, id: 'gears', name: 'Gears', cat: 'kinetic', n: 24, fixedN: true, aspect: 0.55, cardH: 0.26, dur: 16,
    desc: 'Two meshing gears with photos for teeth, turning against each other.',
    params: params([group('Form'), segment('ratio', 'Ratio', { '12': '1 : 1', '16': '2 : 1', '18': '3 : 1' }, '16'), range('pitchK', 'Tooth spacing', 0.9, 1.6, 1.22), range('mesh', 'Mesh', 0.6, 1.3, 0.92), range('meshPh', 'Mesh offset', -1, 1, 0), off('layer', 'Layer depth', 0.6), range('tilt', 'Tilt', 0, 1, 0.25),
      group('Motion'), whole('turns', 'Turns', 1, 3, 1, { unit: '×' }), off('tick', 'Tick', 1),
      group('Look'), range('smallTone', 'Small gear tone', 0.5, 1.2, 0.92), off('toothShade', 'Tooth shade', 0.5)]),
    layout(i, P, E) {
      const N1 = Number(P.ratio) || 16, N2 = 24 - N1, big = i < N1, N = big ? N1 : N2, k = big ? i : i - N1, pitch = E.w * num(P.pitchK, 1.22), R = N * pitch / TAU;
      const R1 = N1 * pitch / TAU, R2 = N2 * pitch / TAU, d = R1 + R2 + E.h * num(P.mesh, 0.92), cx = big ? -d * R2 / (R1 + R2) : d * R1 / (R1 + R2);
      const u = E.p * Math.round(num(P.turns, 1)) * N1, ku = Math.floor(u), fu = u - ku, a1 = TAU / N1 * (ku + lerp(fu, sstep(0.55, 1, fu), num(P.tick)));
      const a = big ? a1 + k / N * TAU : -N1 / N2 * a1 + k / N * TAU + PI + PI / N2 * (1 + num(P.meshPh));
      const tilt = num(P.tilt, 0.25), layer = num(P.layer);
      return { m: M(RX(tilt), T(cx + (R + E.h / 2) * Math.cos(a), (R + E.h / 2) * Math.sin(a), big ? 0 : layer), RZ(a - PI / 2)),
        b: (big ? 1 : num(P.smallTone, 0.92)) * (1 - num(P.toothShade) * (0.5 - 0.5 * Math.sin(a))) };
    } },

  { ...NEW, id: 'ferris', name: 'Ferris Wheel', cat: 'kinetic', n: 12, aspect: 0.8, cardH: 0.32, dur: 30,
    desc: 'Photos ride a big wheel like gondolas, staying upright and swaying as they go round.',
    params: params([group('Form'), range('radius', 'Radius', 0.4, 2.5, 1), range('hub', 'Hub height', -0.5, 0.6, 0.1), range('arm', 'Arm length', 0.3, 1.2, 0.56),
      group('Motion'), cyc('rides', 'Turns', 1, 3, 1), range('sway', 'Sway', 0, 0.5, 0.14), cyc('swayN', 'Sway speed', 1, 8, 4), off('lag', 'Sway lag', 1), range('depth', 'Wheel rock', 0, 1, 0.3),
      group('Look'), range('nightShade', 'Shade', 0, 0.6, 0.15), off('topPop', 'Top pop', 0.4)]),
    layout(i, P, E) {
      const R = 0.82 * num(P.radius, 1), a = i / E.n * TAU + E.p * TAU * Math.round(num(P.rides, 1)), px = R * Math.sin(a), py = num(P.hub, 0.1) + R * Math.cos(a), ca = Math.cos(a);
      const sw = num(P.sway, 0.14) * Math.sin(2 * a + E.p * TAU * Math.round(num(P.swayN, 4)) + i * num(P.lag) * PI);
      return { m: M(RY(num(P.depth, 0.3) * 0.5 * Math.sin(E.p * TAU)), T(px, py, 0), RZ(sw), T(0, -E.h * num(P.arm, 0.56), 0)),
        s: 1 + num(P.topPop) * Math.pow(Math.max(0, ca), 4), b: 1 - num(P.nightShade, 0.15) + num(P.nightShade, 0.15) * ca };
    } },

  { ...NEW, id: 'cradle', name: "Newton's Cradle", cat: 'kinetic', n: 5, aspect: 1, cardH: 0.36, dur: 3.2,
    desc: 'Hanging photos click back and forth like a Newton’s cradle.',
    params: params([group('Form'), range('pivotY', 'Pivot height', 0.4, 1.4, 0.95), range('length', 'String', 0.5, 1.4, 0.95), range('spacing', 'Spacing', 0.9, 1.5, 1.01), whole('movers', 'Movers', 1, 2, 1, { hint: 'how many photos swing out on each side' }),
      group('Motion'), range('amp', 'Swing', 0.2, 1.1, 0.5), whole('beats', 'Swings per loop', 1, 4, 1), off('kick', 'Kick', 0.15), off('swivel', 'Swivel', 1),
      group('Look'), off('mblur', 'Motion blur', 1), off('restShade', 'Rest shade', 0.4)]),
    layout(i, P, E) {
      const n = E.n, ph = wrap(E.p * Math.round(num(P.beats, 1)), 1), x = (i - (n - 1) / 2) * E.w * num(P.spacing, 1.01), mv = Math.max(1, Math.min(Math.round(num(P.movers, 1)), Math.floor(n / 2)));
      const left = n === 1 || i < mv, right = n === 1 || i >= n - mv, sp = num(P.mblur) * 0.5 * ab(Math.cos(TAU * ph));
      let th = 0, bl = 0;
      if (left && ph < 0.5) { th = -num(P.amp, 0.5) * Math.sin(TAU * ph); bl = sp; }
      if (right && ph >= 0.5) { th = num(P.amp, 0.5) * Math.sin(TAU * (ph - 0.5)); bl = sp; }
      if (n === 1) th = num(P.amp, 0.5) * Math.sin(TAU * ph);
      if (!left && !right && num(P.kick)) { const g = (v: number) => Math.exp(-v * v / 0.0006); th = num(P.kick) * (g(ph - 0.5) - g(ph) - g(ph - 1)); }
      return { m: M(T(x, num(P.pivotY, 0.95), 0), RZ(th), T(0, -num(P.length, 0.95), 0), RY(num(P.swivel) * th * 1.5)),
        b: left || right ? 1 : 1 - num(P.restShade), blur: bl };
    } },

  { ...NEW, id: 'ripples', name: 'Ripple Rings', cat: 'kinetic', n: 17, aspect: 0.8, cardH: 0.26, dur: 14,
    desc: 'Rings of photos spread out from the centre like ripples on water, a new ring every beat.',
    params: params([group('Form'), whole('rings', 'Rings', 2, 8, 5), whole('per', 'Per ring', 4, 24, 16), range('reach', 'Reach', 0.6, 1.6, 1.25), off('align', 'Point outward', 1), range('tilt', 'Water angle', 0, 1.3, 0.95),
      group('Motion'), cyc('waves', 'Waves', 1, 3, 1), range('twist', 'Twist', -2, 2, 0.5), off('swell', 'Swell', 0.3),
      group('Look'), range('grow', 'Grow', 0, 1.2, 0.7), range('fadeAt', 'Fade start', 0.3, 0.95, 0.85)]),
    fill: ripplesFill,
    layout(i, P, E) {
      const Rn = Math.round(num(P.rings, 5)), C = Math.round(num(P.per, 16)), j = Math.floor(i / C), k = i % C, q = wrap(j / Rn + E.p * Math.round(num(P.waves, 1)), 1);
      const tilt = num(P.tilt, 0.95), Rmax = num(P.reach, 1.25) * Math.hypot(E.vx, E.vy) / Math.max(0.35, Math.cos(tilt) + 0.2), r = q * Rmax;
      const a = k / C * TAU + j * 0.37 + num(P.twist, 0.5) * q * TAU * 0.25, px = r * Math.cos(a), pz = r * Math.sin(a), hz = num(P.swell) * 0.5 * Math.sin(TAU * 2 * q);
      return { m: M(T(px, pz * Math.cos(tilt), -pz * Math.sin(tilt)), RX(-tilt), T(0, 0, hz), RZ(a + PI / 2 * (1 - num(P.align)))),
        s: sstep(0, 0.12, q) * (0.55 + num(P.grow, 0.7) * q), o: 1 - sstep(num(P.fadeAt, 0.85), 1, q), img: j * C + k };
    } },

  { ...NEW, id: 'domino-run', name: 'Domino Run', cat: 'kinetic', n: 18, aspect: 0.64, cardH: 0.5, dur: 8,
    mods: { poseRx: 12 },
    desc: 'Photos stand like dominoes along an S-curve into the distance; a toppling wave runs down the line, then they stand back up.',
    params: params([group('Layout'), range('sway', 'Curve', 0, 1, 0.6), whole('bends', 'Bends', 1, 3, 1), range('length', 'Length', 2, 6, 3.6), off('messy', 'Wobble', 1),
      group('Motion'), range('wave', 'Wave', 0.2, 0.8, 0.5), range('topple', 'Topple', 0.2, 1, 1), range('fallTime', 'Fall time', 0.4, 3, 1, 0.01, { unit: '×' }), range('riseTime', 'Rise time', 0.4, 1.5, 1, 0.01, { unit: '×' }),
      group('Look'), off('fallShade', 'Fallen shade', 0.6), off('farBlur', 'Distance blur', 1)]),
    layout(i, P, E) {
      const n = E.n, bends = Math.round(num(P.bends, 1)), sway = num(P.sway, 0.6), length = num(P.length, 3.6), at = (t: number): [number, number] => [lerp(-1.05, 1.3, t) + sway * 0.5 * Math.sin(t * TAU * bends), 0.8 - t * length];
      const t = i / Math.max(1, n - 1), [x, z] = at(t), [x2, z2] = at(t + 0.002), [x0, z0] = at(t - 0.002), [xn, zn] = at(t + 1 / Math.max(1, n - 1));
      const ry = Math.atan2(x2 - x0, z2 - z0) + num(P.messy) * (E.rnd(i, 1) - 0.5) * 0.6, gap = Math.hypot(xn - x, zn - z);
      const rest = i === n - 1 ? PI / 2 * 0.97 : Math.asin(Math.min(1, gap / E.h * 0.98));
      const u = wrap(E.p - t * num(P.wave, 0.5), 1), a = rest * num(P.topple, 1) * ease.inCubic(sstep(0, 0.08 * num(P.fallTime, 1), u)) * (1 - ease.inOutCubic(sstep(0.62, 0.62 + 0.24 * num(P.riseTime, 1), u)));
      return { m: M(T(x, -0.45, z), RY(ry + PI), RX(-a), T(0, E.h / 2, 0)), b: 1 - num(P.fallShade) * a / (PI / 2), blur: num(P.farBlur) * t * 0.6 };
    } },
];
