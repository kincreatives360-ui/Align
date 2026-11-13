import type { Template, P, Env, CardPose } from '../types';
import type { StyleTree } from '../../state/types';
import { TAU, clamp01, lerp, num, str, wrap, M, RX, RY, RZ, T } from '../kit';
import {
  cylinderCamera, cylinderLayout, doubleRingFill, doubleRingLayout, helixFill, helixLayout,
  orbitLayout, ringFill, ringLayout2, ringR, ribbonLoopFill, ribbonLoopLayout,
  saturnFill, saturnLayout, sphereFill, sphereLayout, spiralLayout, tunnelFill, tunnelLayout, wheelFill, wheelLayout,
} from '../layouts';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl, ReferenceToggleControl } from '../referenceControls';

const PI = Math.PI;
type GlassStyle = Partial<StyleTree['glass']>;
const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const group = (group: string): ReferenceControl => ({ group });
const segment = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const toggle = (key: string, label: string, def: boolean): ReferenceToggleControl => ({ key, label, type: 'toggle', def });
const params = (controls: ReferenceControl[]) => adaptReferenceControls(controls);
function glassStyle(edges: GlassStyle, extra: GlassStyle = {}): Template['style'] {
  return { glass: { on: true, mode: 'per', amount: 0, top: 0, bottom: 0, left: 0, right: 0, width: 0.28, refraction: 0.62, curve: 'panel', dispersion: 0.7, soften: 0.45, feather: 0, highlight: 0.32, bulge: 0.4, ...edges, ...extra } };
}
const origin = [0, 0, 0] as [number, number, number];
const ringCamera = (P: P, E: Env) => { const d = ringR(P, E) + E.D * 1.15; return { eye: [0, d * num(P.tilt, 0.6) * 0.7, d] as [number, number, number], target: origin }; };
const doubleRingCamera = (P: P, E: Env) => ({ eye: [0, num(P.tilt, 0.35) * 3.2, 3.2 * num(P.radius, 1.1) + E.D] as [number, number, number], target: origin });
const orbitCamera = (P: P, E: Env) => ({ eye: [0, num(P.tilt, 0.16) * 3, E.D + 0.6] as [number, number, number], target: origin });
const ribbonLoopCamera = (P: P, E: Env) => ({ eye: [0, (E.D + 0.6) * num(P.tilt, 0.55) * 0.7, E.D + 0.6] as [number, number, number], target: origin });

function turbineLayout(i: number, P: P, E: Env): CardPose {
  const R = 0.6 * num(P.radius, 1), a = (i / E.n + E.p * Math.round(num(P.laps, 1))) * TAU;
  const m = M(RX(num(P.tilt, 0.42)), RY(num(P.yaw, -0.18)), RZ(a), RY(num(P.cone)), T(R, 0, 0), RZ(PI / 2), RY(num(P.blade, 1.05) + num(P.flutter) * Math.sin(a * 3)), RX(num(P.pitchB)));
  return { m, bend: num(P.curve, 0.5), b: 1 - num(P.dim) * (1 - m[10]) / 2, s: 1 + num(P.pop) * clamp01(m[14] / R) };
}
function vortexLayout(i: number, P: P, E: Env): CardPose {
  const a = (i / E.n + E.p * Math.round(num(P.laps, 1))) * TAU;
  const m = M(RX(num(P.tilt, 0.2)), RY(num(P.yaw, 0.12)), RZ(a), RY(num(P.cone)), T(0.4 * num(P.radius, 1), 0, 0), RZ(PI / 2 + num(P.swirl, 0.55) + num(P.flutter) * Math.sin(a * 3)), RY(num(P.lean, 0.95)));
  return { m, bend: num(P.curve, 1.5), b: 1 - num(P.dim) * (1 - m[10]) / 2 };
}
function pinwheelLayout(i: number, P: P, E: Env): CardPose {
  const a = (i / E.n + E.p * Math.round(num(P.laps, 1))) * TAU, rock = Math.sin(E.p * TAU) * num(P.rock, 0.14);
  const m = M(RX(num(P.tilt, 0.38) + rock), RY(num(P.yaw, -0.25)), RZ(a), RY(num(P.cone)), T(0.5 * num(P.radius, 1), 0, 0), RZ(num(P.rake, 0.5)), RY(num(P.twist, 0.7)));
  return { m, bend: num(P.curve, 0.8), b: 1 - num(P.dim) * (1 - m[10]) / 2 };
}
function tornadoLayout(i: number, P: P, E: Env): CardPose {
  const f = i / Math.max(1, E.n - 1), H = num(P.height, 1.95), slope = num(P.flare, 1.25) * 0.62 / H;
  const R = (num(P.tip, 0.22) + num(P.flare, 1.25) * 0.62 * f) * num(P.radius, 1);
  const a = i / num(P.perTurn, 14) * TAU + E.p * TAU * (Math.round(num(P.laps, 1)) + Math.round(num(P.shear) * (1 - f))), c = Math.cos(a);
  return { x: R * Math.sin(a) + num(P.whip) * Math.sin(E.p * TAU + f * TAU) * (1 - f), z: R * c, y: (0.97 - f * 1.95) * H / 1.95, ry: a, rx: -Math.atan(slope), bend: Math.min(3, 1 / R), b: 1 - num(P.dim, 0.45) + num(P.dim, 0.45) * Math.max(0, c), o: 1 - num(P.fadeBack) * clamp01(-c) };
}

function sstep(a: number, b: number, value: number): number { const t = clamp01((value - a) / (b - a)); return t * t * (3 - 2 * t); }
function archesFill(P: P, E: Env): { A: number; c: number; count: number } {
  const A = Math.round(num(P.gates, 5)), c = Math.max(5, Math.ceil(PI * num(P.radius, 1.15) * (num(P.span, 180) / 180) * Math.max(1, num(P.tall, 1)) / (E.w * (1 + num(P.gap, 0.06))) ) + 1);
  return { A, c, count: A * c };
}
function archesLayout(i: number, P: P, E: Env): CardPose {
  const c = Number(E.c), A = Number(E.A), j = Math.floor(i / c), s = i % c, u = wrap(j / A + E.p, 1), Z = A * num(P.spacing, 2.2), z = lerp(-Z + 1.5, 1.5, u);
  const sp = num(P.span, 180) / 180 * PI, a = sp * s / (c - 1) + (PI - sp) / 2, R = num(P.radius, 1.15) * (1 + num(P.open) * 0.6 * sstep(-1.5, 1.5, z));
  const g = j * num(P.gateTwist) * 1.2 + num(P.roll) * Math.sin(PI * u) * PI * 0.5, lx = Math.cos(a) * R, ly = Math.sin(a) * R * num(P.tall, 1), cg = Math.cos(g), sg = Math.sin(g);
  return { x: lx * cg - ly * sg, y: -0.7 + lx * sg + ly * cg, z, rz: a - PI / 2 + g, b: 1 - num(P.fog) * (1 - u) * 0.85, o: sstep(0, 0.2, u) * (1 - sstep(E.D - 1.6, E.D - 0.6, z)) * (1 - sstep(0.9, 1, u)), img: j * c + s };
}
function lanternFill(P: P, E: Env): { L: number; c: number; count: number } { const L = Math.round(num(P.rings, 4)); return { L, c: E.n, count: L * E.n }; }
function lanternLayout(i: number, P: P, E: Env): CardPose {
  const c = Number(E.c), L = Number(E.L), j = Math.floor(i / c), s = i % c, v = j - (L - 1) / 2, R0 = Math.max(0.5, c * E.w * (1 + num(P.gap, 0.06)) / TAU);
  const R = R0 * (1 - num(P.waist, 0.22) * (v / Math.max(1, L / 2)) ** 2) * (1 + num(P.taper) * 0.35 * v / Math.max(1, L / 2));
  const a = (s / c + (j % 2 && str(P.turnMode, 'counter') !== 'same' ? -1 : 1) * E.p * num(P.whirl, 1)) * TAU + j * num(P.ringOffset, 0.4), front = Math.max(0, Math.cos(a));
  const sway = num(P.sway) * 0.3 * Math.sin(TAU * E.p * 2) * ((L - 1) / 2 - v) / Math.max(1, L - 1);
  return { x: R * Math.sin(a) + sway, y: v * E.h * (1 + num(P.gap, 0.06) * 2), z: R * Math.cos(a) - R0, ry: a, bend: 1 / R, b: 1 - num(P.backShade, 0.28) + num(P.backShade, 0.28) * front, blur: num(P.backBlur) * (1 - front) * 0.5, img: j * 3 + s };
}

export const RING_TEMPLATES: Template[] = [
  { id: 'spiral', name: 'Spiral Collection', cat: 'ring', n: 28, aspect: 1.6, cardH: 0.27, dur: 24, fov: 36, frame: '16:9', desc: 'A twisting ring of curled cards.', style: glassStyle({ top: 1, bottom: 1 }, { width: 0.2, refraction: 0.55, bulge: 0.25 }),
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('twist', 'Twists', 0, 3, 1.5, 0.5), range('curve', 'Card curve', 0, 2, 1.6), range('ellipse', 'Ellipse', 0.4, 1.6, 1, 0.01, { unit: '×' }), range('lean', 'Ring lean', -0.8, 1.2, 0.32), group('Motion'), range('tumble', 'Tumble', 0, 3, 1, 0.01, { unit: '×' }), range('curlRate', 'Curl speed', 0, 4, 2, 1, { unit: '×', hint: 'whole cycles per loop, so it stays seamless' }), range('ringTurns', 'Ring turns', 0, 3, 1, 1, { unit: ' turns' }), group('Look'), off('backShade', 'Back shade', 0.8), off('edgeFade', 'Edge-on fade', 0.9)]), layout: spiralLayout },
  { id: 'cylinder', name: 'Cylinder', cat: 'ring', n: 14, aspect: 0.72, cardH: 1, dur: 26, frame: '5:4', desc: 'A turning wall of curved panels.', style: glassStyle({ left: 1, right: 1 }, { width: 0.24, refraction: 0.6 }),
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('gap', 'Gap', 0, 0.8, 0.05), range('ellipse', 'Ellipse', 0.6, 1.6, 1, 0.01, { unit: '×' }), segment('facing', 'Card facing', { out: 'Outward', cam: 'Camera' }, 'out'), range('tilt', 'Camera tilt', -1, 1.2, 0.06), group('Motion'), off('rimWave', 'Rim wave', 1), off('surge', 'Surge', 1), group('Look'), off('pop', 'Front scale', 0.4), range('backShade', 'Back shade', 0, 0.9, 0.45), off('backFade', 'Back fade', 1)]), camera: cylinderCamera, layout: cylinderLayout },
  { id: 'orbit', name: 'Orbit', cat: 'ring', n: 8, aspect: 0.8, cardH: 0.85, dur: 20, frame: '5:4', desc: 'Images orbit in depth with a soft focus pull.', style: { blur: { on: true, depth: 0.22 } },
    params: params([group('Layout'), range('rx', 'Width', 0.5, 3, 1.9), range('rz', 'Depth', 0.3, 3, 1.5), range('tilt', 'Camera tilt', -1, 1.2, 0.16), range('incline', 'Incline', -1, 1, 0), segment('facing', 'Card facing', { cam: 'Camera', out: 'Outward' }, 'cam'), group('Motion'), off('bob', 'Bob', 1), range('surge', 'Front rush', -0.6, 0.6, 0), group('Look'), off('pop', 'Front scale', 0.5), off('backShade', 'Back shade', 0.8), off('backFade', 'Back fade', 1)]), camera: orbitCamera, layout: orbitLayout },
  { id: 'ring', name: 'Ring', cat: 'ring', n: 12, aspect: 0.8, cardH: 0.68, dur: 18, frame: '5:4', desc: 'A tilted ring of curved cards with liquid-glass sides.', style: glassStyle({ left: 1, right: 1 }, { width: 0.26, refraction: 0.7, bulge: 0.4 }),
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Camera tilt', -1, 1.2, 0.6), range('gap', 'Gap', 0, 0.8, 0.14), range('squash', 'Ellipse', 0.4, 1.6, 1, 0.01, { unit: '×' }), segment('face', 'Cards face', { out: 'Outward', in: 'Inward', cam: 'Camera' }, 'out'), group('Motion'), whole('laps', 'Turns per loop', 1, 3, 1, { unit: ' turns' }), off('wob', 'Wave', 0.5, { hint: 'two crests the cards ride over' }), group('Look'), range('curl', 'Card curve', 0, 2, 1, 0.01, { unit: '×' }), off('dim', 'Back dim', 1), off('fadeBack', 'Back fade', 1), off('pop', 'Front pop', 0.6)]), camera: ringCamera, fill: ringFill, layout: ringLayout2 },
  { id: 'double-ring', name: 'Double Ring', cat: 'ring', n: 20, aspect: 0.8, cardH: 0.72, dur: 22, frame: '5:4', desc: 'Two rings turning against each other.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1.1), range('tilt', 'Camera tilt', -1, 1.2, 0.35), range('sep', 'Separation', 0, 1.5, 0.62), range('squash', 'Ellipse', 0.4, 1.6, 1, 0.01, { unit: '×' }), range('lean', 'Ring lean', -0.6, 0.6, 0, 0.01, { hint: 'tips the two rings apart' }), segment('face', 'Cards face', { out: 'Outward', in: 'Inward', cam: 'Camera' }, 'out'), group('Motion'), range('topTurns', 'Top ring turns', -3, 3, 1, 1, { unit: ' turns' }), range('botTurns', 'Bottom ring turns', -3, 3, -1, 1, { unit: ' turns' }), off('offs', 'Bottom ring offset', 0.5, { hint: 'shifts the bottom ring by part of a card' }), group('Look'), range('curl', 'Card curve', 0, 2, 1, 0.01, { unit: '×' }), off('dim', 'Back dim', 1)]), camera: doubleRingCamera, fill: doubleRingFill, layout: doubleRingLayout },
  { id: 'helix', name: 'Helix', cat: 'ring', n: 18, aspect: 0.8, cardH: 0.5, dur: 20, frame: '5:4', desc: 'A spiral staircase of images turning in the dark.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('pitch', 'Pitch', 0.05, 0.5, 0.16), range('turns', 'Spacing', 0.2, 1.2, 0.55), range('squash', 'Ellipse', 0.4, 1.6, 1, 0.01, { unit: '×' }), range('taper', 'Taper', -1, 1, 0, 0.01, { hint: 'narrows the spiral toward one end' }), group('Motion'), whole('laps', 'Turns per loop', 1, 3, 1, { unit: ' turns' }), range('climb', 'Climb', -2, 2, 0, 1, { unit: '×', hint: 'cards ride up or down the spiral' }), group('Look'), range('curl', 'Card curve', 0, 2, 1, 0.01, { unit: '×' }), range('dim', 'Back dim', 0, 1, 0.5), off('fadeBack', 'Back fade', 1), off('pop', 'Front pop', 0.6)]), fill: helixFill, layout: helixLayout },
  { id: 'sphere', name: 'Sphere', cat: 'ring', n: 34, aspect: 1, cardH: 0.3, dur: 24, frame: '1:1', desc: 'Images tiled over a slowly turning globe.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('axis', 'Axis tilt', -1, 1, 0.25), range('flat', 'Squash', 0.4, 1.6, 1, 0.01, { unit: '×' }), segment('face', 'Cards face', { out: 'Outward', cam: 'Camera' }, 'out'), group('Motion'), whole('laps', 'Turns per loop', 1, 3, 1, { unit: ' turns' }), toggle('counter', 'Counter-turn halves', false), off('breathe', 'Breathe', 0.3), group('Look'), range('dim', 'Back dim', 0, 1, 1), off('fadeBack', 'Back fade', 1), off('pop', 'Front pop', 0.6)]), fill: sphereFill, layout: sphereLayout },
  { id: 'ribbon-loop', name: 'Ribbon Loop', cat: 'ring', n: 16, aspect: 0.8, cardH: 0.5, dur: 22, frame: '5:4', desc: 'A twisted loop of cards banking through the frame.', style: glassStyle({ left: 1, right: 1 }, { width: 0.24, refraction: 0.65 }),
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Camera tilt', -1, 1.2, 0.55), range('wide', 'Width', 0.4, 1.6, 0.95), range('deep', 'Depth', 0.2, 1.5, 0.7), range('lobes', 'Waves', 1, 4, 2, 1, { hint: 'rises and dips round the loop' }), group('Motion'), range('twist', 'Twist', 0, 1.5, 0.7), range('bank', 'Bank', 0, 1.5, 0.55), whole('laps', 'Laps per loop', 1, 3, 1, { unit: ' turns' }), group('Look'), off('curl', 'Card curve', 2), off('dim', 'Back dim', 1), off('pop', 'Front pop', 0.6)]), camera: ribbonLoopCamera, fill: ribbonLoopFill, layout: ribbonLoopLayout },
  { id: 'tunnel', name: 'Tunnel', cat: 'ring', n: 32, aspect: 0.8, cardH: 0.5, dur: 14, frame: '16:9', desc: 'Fly down a tunnel lined with images.', style: { blur: { on: true, depth: 0.3 } },
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), whole('per', 'Per ring', 4, 12, 8), range('oval', 'Width', 0.5, 1.5, 1, 0.01, { unit: '×' }), range('len', 'Length', 6, 24, 12, 0.1), range('twistT', 'Ring twist', 0, 1.5, 0.4), segment('face', 'Cards', { cam: 'Face you', wall: 'Line the walls' }, 'cam'), group('Motion'), range('roll', 'Roll', -2, 2, 0, 1, { unit: ' turns' }), off('snake', 'Snake', 1, { hint: 'the far end swings side to side' }), group('Look'), off('fog', 'Far fade', 1), off('dim', 'Far dim', 1)]), fill: tunnelFill, layout: tunnelLayout },
  { id: 'wheel', name: 'Wheel', cat: 'ring', n: 12, aspect: 0.8, cardH: 0.36, dur: 20, frame: '1:1', desc: 'Images arranged like the hours of a clock, turning slowly.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Tilt', -1, 1, 0.35), range('yaw', 'Turn', -1, 1, 0), segment('upright', 'Cards', { radial: 'Radial', upright: 'Upright' }, 'radial'), range('fan', 'Fan', -1, 1, 0, 0.01, { hint: 'turns every card about its own centre' }), range('lean', 'Lean', -1, 1, 0), group('Motion'), whole('laps', 'Turns per loop', -3, 3, 1, { unit: ' turns' }), off('pulse', 'Pulse', 0.5), group('Look'), off('pop', 'Top pop', 0.8), off('dim', 'Bottom dim', 1)]), fill: wheelFill, layout: wheelLayout },
  { id: 'saturn', name: 'Saturn', cat: 'ring', n: 15, aspect: 0.8, cardH: 0.36, dur: 20, frame: '5:4', desc: 'A hero image with a ring of smaller images orbiting around it.', style: { blur: { on: true, depth: 0.25 } },
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Ring tilt', -1, 1.2, 0.42), range('oval', 'Ring shape', 0.5, 1.6, 1, 0.01, { unit: '×' }), range('rise', 'Ring height', -1, 1, 0), range('hero', 'Hero size', 1.2, 4, 2.6), segment('face', 'Moons face', { cam: 'Camera', out: 'Outward' }, 'cam'), group('Motion'), whole('laps', 'Orbits per loop', 1, 3, 1, { unit: ' turns' }), range('sway', 'Hero sway', 0, 3, 1, 0.01, { unit: '×' }), group('Look'), range('moon', 'Moon size', 0.5, 1.6, 1, 0.01, { unit: '×' }), range('dim', 'Back dim', 0, 1, 0.3)]), fill: saturnFill, layout: saturnLayout },
  { id: 'turbine', name: 'Turbine', cat: 'ring', n: 30, aspect: 0.8, cardH: 0.6, dur: 24, frame: '5:4', desc: 'A spinning ring of photos set like turbine blades.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Tilt', -1, 1.2, 0.42), range('yaw', 'Turn', -1, 1, -0.18), range('cone', 'Cone', -1, 1, 0), range('blade', 'Blade angle', -1.5, 1.5, 1.05), range('pitchB', 'Blade pitch', -1, 1, 0), group('Motion'), whole('laps', 'Turns per loop', -3, 3, 1, { unit: ' turns' }), off('flutter', 'Flutter', 0.6, { hint: 'blades open and close three times a turn' }), group('Look'), range('curve', 'Card curve', 0, 2, 0.5), off('dim', 'Back dim', 1), off('pop', 'Front pop', 0.5)]), layout: turbineLayout },
  { id: 'vortex', name: 'Vortex', cat: 'ring', n: 22, aspect: 0.8, cardH: 0.78, dur: 22, frame: '5:4', desc: 'Curled photos swirling round a centre like petals.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Tilt', -1, 1, 0.2), range('yaw', 'Turn', -1, 1, 0.12), range('swirl', 'Swirl', -1.5, 1.5, 0.55), range('lean', 'Petal lean', -1.5, 1.5, 0.95), range('cone', 'Cone', -1, 1, 0), group('Motion'), whole('laps', 'Turns per loop', -3, 3, 1, { unit: ' turns' }), off('flutter', 'Flutter', 0.6, { hint: 'petals open and close three times a turn' }), group('Look'), range('curve', 'Card curve', 0, 2, 1.5), off('dim', 'Back dim', 1)]), layout: vortexLayout },
  { id: 'pinwheel', name: 'Pinwheel', cat: 'ring', n: 6, aspect: 0.8, cardH: 1, dur: 14, frame: '5:4', desc: 'A few large curled photos turning like a pinwheel in 3D.',
    params: params([group('Layout'), range('radius', 'Radius', 0.4, 2.5, 1), range('tilt', 'Tilt', -1, 1, 0.38), range('yaw', 'Turn', -1, 1, -0.25), range('rake', 'Blade rake', -1.5, 1.5, 0.5), range('twist', 'Twist', -1.5, 1.5, 0.7), range('cone', 'Cone', -1, 1, 0), group('Motion'), whole('laps', 'Turns per loop', -3, 3, 1, { unit: ' turns' }), range('rock', 'Rock', 0, 0.5, 0.14), group('Look'), range('curve', 'Card curve', 0, 2, 0.8), off('dim', 'Back dim', 1)]), layout: pinwheelLayout },
  { id: 'tornado', name: 'Tornado', cat: 'ring', n: 72, aspect: 0.8, cardH: 0.16, dur: 20, frame: '5:4', mods: { poseRx: 8 }, desc: 'A cone of small photos spiralling round like a tornado.',
    params: params([group('Layout'), whole('perTurn', 'Per turn', 6, 24, 14), range('radius', 'Radius', 0.4, 2.5, 1), range('flare', 'Cone', 0, 2, 1.25), range('height', 'Height', 1, 3, 1.95), range('tip', 'Tip size', 0.05, 0.6, 0.22), group('Motion'), whole('laps', 'Turns per loop', 1, 3, 1, { unit: ' turns' }), range('shear', 'Shear', -2, 2, 0, 1, { hint: 'the top turns faster or slower than the bottom' }), off('whip', 'Whip', 0.5), group('Look'), range('dim', 'Back dim', 0, 1, 0.45), off('fadeBack', 'Back fade', 1)]), layout: tornadoLayout },
  { id: 'arches', name: 'Arch Gates', cat: 'ring', n: 14, aspect: 0.8, cardH: 0.3, dur: 18, frame: '5:4', isNew: true, desc: 'Glide through a corridor of arches built from photos; each gate opens round you as you pass.',
    params: params([group('Layout'), whole('gates', 'Arches', 2, 7, 5), range('radius', 'Radius', 0.7, 1.8, 1.15), range('gap', 'Gap', 0, 0.8, 0.06), range('spacing', 'Spacing', 1, 4, 2.2), range('span', 'Span', 120, 300, 180, 1, { unit: '°' }), range('tall', 'Height', 0.6, 1.6, 1, 0.01, { unit: '×' }), off('gateTwist', 'Twist', 1, { hint: 'each gate turns a little further round the corridor' }), group('Motion'), off('open', 'Open up', 1), range('roll', 'Roll', -1, 1, 0), group('Look'), off('fog', 'Fog', 1)]), fill: archesFill, layout: archesLayout },
  { id: 'lantern', name: 'Lantern Rings', cat: 'ring', n: 12, aspect: 0.8, cardH: 0.36, dur: 30, frame: '5:4', isNew: true, mods: { poseRx: 8 }, desc: 'Stacked rings of photos turn in alternating directions, like the bands of a paper lantern.',
    params: params([group('Layout'), whole('rings', 'Rings', 2, 6, 4), range('gap', 'Gap', 0, 0.8, 0.06), range('waist', 'Waist', 0, 0.6, 0.22), range('taper', 'Taper', -1, 1, 0), range('ringOffset', 'Ring offset', 0, 3.14, 0.4), group('Motion'), whole('whirl', 'Turns', -3, 3, 1, { unit: '×', hint: 'whole turns per loop, so it stays seamless' }), segment('turnMode', 'Rings turn', { counter: 'Counter', same: 'Same way' }, 'counter'), off('sway', 'Sway', 1), group('Look'), range('backShade', 'Back shade', 0, 0.8, 0.28), off('backBlur', 'Back blur', 1)]), fill: lanternFill, layout: lanternLayout },
];