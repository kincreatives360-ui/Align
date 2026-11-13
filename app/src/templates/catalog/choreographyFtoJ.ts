import type { Env, Template, CardPose } from '../types';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl } from '../referenceControls';
import { ab, aim, clamp01, ease, fillSlots, frame3 as makeFrame3, lerp, M, P_EASE, rel, RX, RY, RZ, stepU, TAU, T, wrap, wrapFade } from '../kit';

const PI = Math.PI;
const D2R = PI / 180;
const sstep = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
type ChoreoParams = Record<string, any>;
type ChoreoEnv = Env & Record<string, any>;
type Vec = [number, number, number];
type ChoreoRaw = Omit<Template, 'params' | 'layout' | 'fill' | 'camera'> & {
  params?: unknown[];
  layout: (i: number, P: ChoreoParams, E: ChoreoEnv) => CardPose;
  fill?: (P: ChoreoParams, E: ChoreoEnv) => Record<string, unknown>;
  camera?: (P: ChoreoParams, E: ChoreoEnv) => { eye: number[]; target: number[] };
};
const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const seg = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const G = (group: string): ReferenceControl => ({ group });
const NEW: Pick<Template, 'cat' | 'frame' | 'isNew'> = { cat: 'choreo', isNew: true, frame: '5:4' };
const frame3 = (x: number, y: number, z: number, X: number[], Z: number[]) => makeFrame3(x, y, z, X as Vec, Z as Vec);
const normalizeChoreo = (templates: ChoreoRaw[]): Template[] => templates.map(template => ({ ...template, params: adaptReferenceControls((template.params ?? []) as ReferenceControl[]), camera: template.camera as Template['camera'] } as Template));

const CHOREO_F_TEMPLATES: Template[] = normalizeChoreo((() => {
  const bell = (d: number, r: number): number => { const t = clamp01(Math.abs(d) / Math.max(1e-4, r)); return 1 - t * t * t * (t * (t * 6 - 15) + 10); };
  const flickU = (p: number, P: ChoreoParams): number => { const B = Math.round(P.beats), per = Math.round(P.riffle), c = p * B, k = Math.floor(c), f = c - k, run = 1 - P.rest;
    const t = clamp01(f / run);
    return (k + lerp(ease.inOutSine(t), ease.inOutQuint(t), P.snap)) * per; };
  const sphereAt = (p: number, P: ChoreoParams, vx: number): number[] => [vx * .62 * Math.sin(TAU * p), .48 * Math.sin(TAU * 2 * p + .7) * P.sphereRoam, -.35 + .55 * Math.cos(TAU * p) * P.sphereRoam];
  const templates: ChoreoRaw[] = [
  /* 3. Proximity Ring: a ring of curved photos that always fan toward you; the ring turns slowly while a focus sweeps
     round it at its own pace, and each photo it reaches blooms outward, lifts and flattens to face you */
  {...NEW, id: 'proximity-ring', name: 'Proximity Ring', n: 12, aspect: .8, cardH: .44, dur: 16, fov: 30,
    desc: 'A ring of photos where each one blooms outward as the focus sweeps round.',
    params: [G('Layout'), range('radius', 'Radius', .6, 1.6, 1.08), range('camHigh', 'Camera height', 0, 1, .42), range('fan', 'Face camera', 0, 1, .55, .01, {hint: 'how far the cards at the sides turn toward you'}),
      G('Motion'), whole('spinLaps', 'Ring turns', -2, 2, 1), whole('sweeps', 'Focus sweeps', 1, 4, 2, {hint: 'times the focus goes round per cycle'}), range('bloom', 'Bloom', 0, 1, .6), range('reachR', 'Focus width', .3, 1.5, .7),
      G('Look'), range('curve', 'Card curve', 0, 1.5, 1), range('depthShade', 'Depth shade', 0, .6, .3), off('farBlur', 'Far blur', 1)],
    fill: (P, E) => { const R = P.radius, N = Math.max(6, Math.min(40, Math.round(TAU * R / (E.w * 1.18)))); return {count: N}; },
    camera(P, E){ const d = E.D * .84 + P.radius * .55, a = P.camHigh * .55; return {eye: [0, Math.sin(a) * d, Math.cos(a) * d + P.radius * .1], target: [0, .06, P.radius * .1]}; },
    layout(i, P, E){
      const N = E.count, R = P.radius, spin = TAU * P.spinLaps * E.p, th = i / N * TAU + spin, sweep = TAU * (Math.round(P.sweeps) + P.spinLaps) * E.p;
      // focus on the ring, in world angle; d = angular distance
      let d = wrap(th - sweep + PI, TAU) - PI; const g = bell(d, P.reachR), bloom = P.bloom * g;
      const r = R * (1 + .32 * bloom), x = r * Math.sin(th), z = r * Math.cos(th), front = Math.cos(th);
      // yaw: outward at the front, fanned back toward the camera at the sides and back (never past ±70°, never mirrored)
      const yaw = Math.sin(th) * lerp(1.22, .45, P.fan) * (1 - .5 * bloom);
      return {x, y: .2 * bloom * E.h + .02 * Math.sin(th * 2), z, ry: yaw, s: (1 + .45 * bloom) * (1 + .12 * front),
        bend: P.curve * front / r * (1 - .7 * bloom), zBias: bloom * .02,
        b: 1 - P.depthShade * clamp01(.5 - front * .5) * (1 - bloom), blur: P.farBlur * clamp01(.5 - front * .5) * .55 * (1 - bloom), img: i % E.n};
    }},

  /* 4. Repel Field: a loose 3D field of photos; an invisible sphere drifts through it and the cards part around it,
     turning their faces away from its centre and curving round its surface, then settle back as it passes */
  {...NEW, id: 'repel-field', name: 'Repel Field', n: 12, aspect: .8, cardH: .26, dur: 16, fov: 30,
    desc: 'A floating field of photos parts around an invisible sphere moving through it.',
    params: [G('Layout'), range('density', 'Density', .6, 1.4, 1, .01, {unit: '×'}), whole('layers', 'Layers', 1, 4, 2), range('depthGap', 'Layer depth', .2, 1, .6), range('scatter', 'Scatter', 0, 1, .4),
      G('Motion'), range('sphere', 'Sphere size', .3, 1.2, .75), range('force', 'Push', 0, 1.5, 1.15), range('sphereRoam', 'Roam', 0, 1, .7), range('float', 'Float', 0, 1, .35),
      G('Look'), range('wrapCurve', 'Wrap curve', 0, 1.5, .9), range('depthShade', 'Depth shade', 0, .6, .25), range('farBlur', 'Depth blur', 0, 1, .35)],
    fill(P, E){ const px = E.w * 2.3 / P.density, py = E.h * 1.85 / P.density, L = Math.round(P.layers);
      const cols = Math.min(11, Math.ceil(E.vx * 2.3 / px)), rows = Math.min(8, Math.ceil(E.vy * 2.3 / py));
      return {px, py, cols, rows, L, count: Math.min(120, cols * rows * L)}; },
    layout(i, P, E){
      const per = E.cols * E.rows, l = Math.floor(i / per), j = i % per, c = j % E.cols, r = Math.floor(j / E.cols);
      const jx = (E.rnd(i, 1) - .5) * P.scatter * .7, jy = (E.rnd(i, 2) - .5) * P.scatter * .7, sh = l % 2 ? .5 : 0;
      const zl = -(l - (E.L - 1) * .35) * P.depthGap, depthK = 1 - zl / 3.7;
      let x0 = (c - (E.cols - 1) / 2 + sh + jx) * E.px * depthK, y0 = ((E.rows - 1) / 2 - r + sh * .5 + jy) * E.py * depthK;
      // a slow float, whole cycles per loop
      const ph = E.rnd(i, 3) * TAU; x0 += P.float * .03 * Math.sin(TAU * E.p + ph); y0 += P.float * .04 * Math.sin(TAU * 2 * E.p + ph * 1.7);
      const z0 = zl + P.float * .05 * Math.cos(TAU * E.p + ph * 2.3);
      const S = sphereAt(E.p, P, E.vx), v = [x0 - S[0], y0 - S[1], (z0 - S[2]) * 1.15], d = Math.hypot(v[0], v[1], v[2]) || 1e-4, R = P.sphere;
      // pushed out toward the shell: full at the centre, nothing beyond ~1.9 R (smooth both ends)
      const k = bell(d, R * 1.9), push = P.force * R * k * k * .95, u = [v[0] / d, v[1] / d, v[2] / d];
      const x = x0 + u[0] * push, y = y0 + u[1] * push, z = z0 + u[2] * push * .9;
      // face away from the centre, blended in by the same falloff; never more than ~65° so faces stay readable
      const tilt = Math.min(1.1, k * 1.25), Z = [u[0] * tilt, u[1] * tilt, 1], X = [1, 0, -u[0] * tilt];
      const zn = clamp01((-z + .4) / 2.2);
      return {m: frame3(x, y, z, X, Z), bend: P.wrapCurve * k / (R + .2), bendY: P.wrapCurve * .6 * k / (R + .2), s: 1 + .18 * k,
        b: 1 - P.depthShade * zn, blur: P.farBlur * zn * .5, img: i % E.n};
    }},

  /* 5. Flicker: a pile seen face on, the next photos waiting a little behind and above. Each beat riffles a run of
     cards: the front one folds forward and dissolves as it comes at you, the next rises into its place. The riffle
     accelerates out of the hold and lands softly in the next hold */
  {...NEW, id: 'flicker', name: 'Flicker', n: 8, aspect: .8, cardH: 1.22, dur: 9, fov: 30,
    desc: 'Photos riffle past in place like a flip book, slow to a hold, then riffle on.',
    params: [G('Layout'), whole('beats', 'Holds', 1, 4, 2), whole('riffle', 'Cards per riffle', 3, 12, 6), range('stackDepth', 'Pile depth', 0, 1, .5), range('peek', 'Peek', 0, 1, .6),
      G('Motion'), range('rest', 'Hold', .15, .8, .45), range('snap', 'Snap', 0, 1, .6, .01, {hint: 'riffles faster in the middle, landing gently'}), range('fold', 'Page fold', 0, 1, .55), range('flyIn', 'Fly past', 0, 1, .55),
      G('Look'), range('curl', 'Page curl', 0, 1.5, .8), range('pileShade', 'Pile shade', 0, .6, .3), off('motionBlur', 'Motion blur', 1)],
    // the slot ring is exactly one loop's worth of cards, so p = 1 lands on p = 0
    fill: (P, _E) => ({count: Math.round(P.beats) * Math.round(P.riffle)}),
    layout(i, P, E){
      const N = E.count, B = Math.round(P.beats), per = Math.round(P.riffle);
      const u = flickU(E.p, P) % N, r0 = wrap(i - u, N), r = r0 > N - 1 ? r0 - N : r0;
      const sp = Math.abs(flickU(E.p + .002, P) - flickU(E.p - .002, P)) / .004 / (B * per);
      if (r < 0){
        // leaving: fold forward from the bottom edge, rise, curl and dissolve while flying toward the lens
        const t = -r, e = smoother(0, 1, t), h = E.h;
        const m = M(T(0, -h / 2 + .06 * e, .9 * P.flyIn * e), RX(P.fold * 1.25 * e), T(0, h / 2, 0));
        return {m, s: 1 + .2 * P.flyIn * e, bendY: -P.curl * 1.6 * Math.sin(PI * Math.min(1, t * 1.2)), o: 1 - smoother(.15, .85, t), zBias: .03,
          blur: P.motionBlur * Math.min(1, sp * .15) * e, img: i % E.n};
      }
      // waiting: a short pile behind, each a touch higher and smaller; deepest ones fade in so none ever pops
      const vis = Math.min(5, N - 1.5), e = r, dz = -.18 * P.stackDepth * e - .02 * e, dy = .07 * P.peek * e;
      return {x: 0, y: dy, z: dz, s: 1 - .025 * e, o: 1 - smoother(vis - 1.5, vis, e), bendY: -P.curl * .25 * clamp01(1 - e) * clamp01(sp * .2),
        b: 1 - P.pileShade * clamp01(e / 3), blur: P.motionBlur * Math.min(1, sp * .1) * clamp01(1 - e), img: i % E.n};
    }},

  /* 6. Bent Marquee: two or three bands of photos each wrapped round an unseen cylinder, tilted so they cross;
     every card curves exactly to its cylinder and scrolls round it, fading as it turns away at the sides */
  {...NEW, id: 'bent-marquee', name: 'Bent Marquee', n: 10, aspect: 1.25, cardH: .4, dur: 22, fov: 30,
    desc: 'Curved ribbons of photos wrap around unseen cylinders and cross at angles.',
    params: [G('Layout'), whole('bands', 'Ribbons', 1, 3, 2), range('cross', 'Cross angle', 0, 40, 16, 1, {unit: '°'}), range('radius', 'Cylinder size', .7, 2, 1, .01, {unit: '×'}), range('gap', 'Gap', 0, .5, .08),
      range('spreadY', 'Ribbon spacing', 0, 1, .35),
      G('Motion'), whole('laps', 'Turns', 1, 3, 1, {unit: '×'}), seg('flowDir', 'Direction', {alt: 'Opposite', same: 'Same'}, 'alt'), range('surgeM', 'Surge', 0, 1, .2),
      G('Look'), range('depthShade', 'Edge shade', 0, .6, .3), range('sideFade', 'Side fade', 0, 1, .7), off('edgeBlur', 'Edge blur', 1)],
    fill(P, E){ const R = Math.max(1.35, E.vx * 1.1) * P.radius, B = Math.round(P.bands), pitch = E.w * (1 + P.gap), per = Math.max(8, Math.floor(TAU * R / pitch));
      return {R, B, per, count: B * per}; },
    layout(i, P, E){
      const b = Math.floor(i / E.per), j = i % E.per, B = E.B, R = E.R, mid = (B - 1) / 2;
      const dir = P.flowDir === 'alt' && b % 2 ? -1 : 1, tilt = (B === 1 ? .5 : b % 2 ? -1 : 1) * P.cross * D2R;
      // scroll: whole turns per loop, with a gentle surge (speed swells and eases twice per loop)
      const ph = TAU * P.laps * E.p, flow = dir * (ph + P.surgeM * .25 * Math.sin(2 * ph) / Math.max(1, P.laps));
      const th = wrap(j / E.per * TAU + flow + b * .7 + PI, TAU) - PI, front = Math.cos(th);
      const y = (b - mid) * P.spreadY * E.h * 2.1, zc = -R - b * .12 + (B - 1) * .06;
      const m = M(T(0, y, zc), RZ(tilt), RY(th), T(0, 0, R));
      const vis = smoother(.0, .55, front);
      return {m, bend: 1 / R, o: lerp(1, vis, P.sideFade) * smoother(-.05, .2, front), b: 1 - P.depthShade * (1 - front), blur: P.edgeBlur * (1 - front) * .6, zBias: .002 * b, img: (j + b * 3) % E.n};
    }},

  /* 8. Cover Bend: coverflow, stepping a photo at a time. The side cards are spaced by their own turned width, so
     each one sits fully clear of its neighbours and of the centre photo. Cards turning between the sides and the
     centre curve like a page in mid-turn: flat when facing you, flat when stacked, curved only while they turn */
  {...NEW, id: 'cover-bend', name: 'Cover Bend', n: 8, aspect: .8, cardH: .9, step: true, perCard: 1.6, fov: 30,
    desc: 'A coverflow where every photo curves like a page as it turns to face you.',
    params: [G('Layout'), range('sideX', 'Centre gap', 0, .6, .12), range('pitchS', 'Side gap', 0, .4, .06), range('angle', 'Side angle', 30, 75, 58, 1, {unit: '°'}), range('camHigh', 'Camera height', -.4, .6, .08),
      G('Motion'), range('hold', 'Hold', 0, .9, .5), {...P_EASE, def: 'inOutCubic'}, range('pagecurl', 'Page curve', 0, 2, 1.1), range('heroLift', 'Front lift', 0, 1, .4),
      G('Look'), range('sideShade', 'Side shade', 0, .6, .25), off('reflect', 'Side blur', 1)],
    fill: (_P, E) => { const k = Math.max(1, Math.ceil(13 / E.n)); return {count: E.n * k}; },
    camera(P, E){ return {eye: [0, P.camHigh, E.D * 1.04], target: [0, 0, 0]}; },
    layout(i, P, E){
      const N = E.count, u = stepU(E.p, E.n, E.hold, E.ez), r = rel(i, u, N), A = P.angle * D2R;
      // a: 0 at the centre, ±1 on the sides, reached within one step so every side card has the full turn
      const ar = Math.min(1, Math.abs(r)), a = Math.sign(r) * ar * ar * (3 - 2 * ar);
      // a turned card covers about w·cos A across the screen (a touch more at its near edge): space the sides by that
      const pS = E.w * (Math.cos(A) * 1.06 + P.pitchS), X0 = E.w * (.5 + .5 * Math.cos(A) * 1.06 + P.sideX);
      // slide linearly in r (r itself is eased by the step, so nothing kinks): neighbouring cards then always stay at
      // least one side spacing apart, even mid-step, so they never cross
      const x = Math.sign(r) * (X0 * ar + pS * Math.max(0, Math.abs(r) - 1)), z = -.35 * E.w * a * a + P.heroLift * .25 * (1 - a * a);
      // curvature peaks mid-turn and is zero flat-on and on the sides; the leading edge curls toward you
      const turn = a * (1 - a * a) * 2.6;
      return {x, y: 0, z, ry: A * a, bend: P.pagecurl * turn * 1.6 / E.w,
        o: wrapFade(r, N), b: 1 - P.sideShade * a * a, blur: P.reflect * a * a * .4, img: i % E.n};
    }},

  ];
  return templates;
})());

const CHOREO_G_TEMPLATES: Template[] = normalizeChoreo((() => {
  const win = (p: number, a: number, b: number, ez = ease.inOutCubic): number => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
  const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: number[], b: number[]): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a: number[]): number[] => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const rotY3 = (v: number[], a: number): number[] => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
  const rotV = (v: number[], k: number[], a: number): number[] => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d]; };
  const soft = (v: number, m: number): number => m * Math.tanh(v / m);
  const slideCache: any = { key: '' };
  const slidePath = (P: ChoreoParams, E: ChoreoEnv): any => {
    const key = [P.swingS, P.turnsS, P.reach, P.drop, E.asp.toFixed(3)].join();
    if (slideCache.key === key) return slideCache;
    const ax = P.swingS * .8 * Math.min(1.3, Math.max(.75, E.asp / 1.25)), nT = P.turnsS, hy = P.drop;
    const C = (u: number): number[] => [-ax * Math.cos(PI * nT * u) * (1 - .25 * u), hy * (.52 - 1.08 * u), -1.15 + P.reach * 1.75 * Math.pow(u, 1.5)];
    const N = 900, S = [0]; let prev = C(0);
    for (let k = 1; k <= N; k++){ const c = C(k / N); S.push(S[k - 1] + Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])); prev = c; }
    return Object.assign(slideCache, { key, C, N, S, L: S[N] });
  };
  const slideU = (sp: any, s: number): number => {
    let lo = 0, hi = sp.N; s = Math.max(0, Math.min(sp.L, s));
    while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (sp.S[mid] <= s) lo = mid; else hi = mid; }
    return (lo + (s - sp.S[lo]) / Math.max(1e-9, sp.S[hi] - sp.S[lo])) / sp.N;
  };
  const vm = (t: number, sg: number): number[] => {
    const k = 1 / ((TAU * sg) ** 2), th = TAU * t, c = Math.cos(th), s = Math.sin(th), v = Math.exp(k * (c - 1));
    return [v, -v * k * s * TAU, v * TAU * TAU * (k * k * s * s - k * c)];
  };
  const templates: ChoreoRaw[] = [

  /* 11. Sheet Slide: two fanned stacks flank centre stage. Each photo slides out of the left fan with an S-flex, arcs forward
     to face you, holds big, then slides on into the right fan. The back sheets of the two fans cross over unseen, behind. */
  {...NEW, id: 'sheet-slide', name: 'Sheet Slide', n: 9, aspect: .8, cardH: 1, step: true, perCard: 2.8, fov: 30,
    desc: 'Flexible photos slide out of a side-on stack, flexing as they go.',
    params: [G('Layout'), range('stackAngle', 'Stack angle', 30, 75, 58, 1, {unit: '°'}), range('layer', 'Layer spacing', .04, .2, .1),
      range('fanStep', 'Fan', 0, 8, 2.5, .1, {unit: '°'}), range('stackGap', 'Stack distance', -.2, .4, .06), range('camHigh', 'Camera height', -.6, .8, .12),
      G('Motion'), range('rest', 'Hold', .1, .8, .48), {...P_EASE, def: 'inOutCubic'}, range('flexAmt', 'S-flex', 0, 2, 1),
      range('arcLift', 'Arc toward you', 0, 1, .55), range('handOver', 'Hand-over', 0, .4, .22, .01, {hint: 'the leaving photo goes first, the next one follows'}),
      G('Look'), range('stackCurve', 'Stack curve', 0, 1.2, .35), range('stackShade', 'Stack shade', 0, .6, .26), off('stackBlur', 'Stack blur', 1)],
    camera: (P, E) => ({eye: [0, P.camHigh, E.D * 1.04], target: [0, -.02, 0]}),
    layout(i, P, E){
      const n = E.n, h = n / 2, u = stepU(E.p, n, P.rest, ease[P.ease as keyof typeof ease] || ease.inOutCubic);
      // r: 0 the hero, > 0 the left fan (still to come), < 0 the right fan (already shown); ±n/2 is the hidden crossover
      const r = wrap(i - u + h, n) - h, ar = Math.abs(r), side = r > 0 ? -1 : 1, A = P.stackAngle * D2R, w = E.w;
      const fw = Math.min(1.15, Math.max(.8, E.asp / 1.25)), x1 = (w * .5 + w * .5 * Math.cos(A) + .1 + P.stackGap) * fw, Zh = .3;
      // a fan slot (k >= 1, continuous): further out and back with depth, turned toward the centre, fanned open, shaded
      const slot = (k: number) => { const j = k - 1; return {x: side * (x1 + j * P.layer * .9), y: -.015 * j, z: -.32 - j * P.layer * .9, ry: -side * A,
        rz: -side * P.fanStep * D2R * j, b: 1 - P.stackShade * Math.min(1, (j + 1) / 3.5), blur: P.stackBlur * Math.min(1, j / 3) * .5}; };
      // long eased fade toward the crossover at the back of the fans
      const o = 1 - smoother(h - 1.3, h - .12, ar);
      if (ar >= 1){ const S = slot(ar); return {...S, bend: P.stackCurve, o, img: i}; }
      // g: 0 at centre stage, 1 at the front of a fan. The leaving photo moves early, the arriving one late, so they never meet
      const inc = r > 0, g = inc ? 1 - smoother(P.handOver, 1, 1 - r) : smoother(0, 1 - P.handOver, -r), S = slot(1);
      const arc = Math.sin(PI * g), turn = sstep(.08, 1, g), sf = inc ? -1 : 1;
      // the S-flex: the sheet bows toward you as it is drawn, whips the other way, then settles flat as it faces you
      const flex = P.flexAmt * 1.5 * Math.sin(TAU * g) * arc * sf;
      return {x: S.x * g, y: .05 * arc, z: lerp(Zh, S.z, g) + P.arcLift * (inc ? .6 : .2) * arc, ry: S.ry * turn, rz: side * .07 * P.flexAmt * arc * sf,
        bend: flex + P.stackCurve * g, bendY: P.flexAmt * .35 * arc * arc, b: lerp(1, S.b, g), zBias: inc ? .02 : 0, img: i};
    }},

  /* 14. Slide: photos ride an S-shaped chute that swings through the frame and pitches toward you, lying in its trough */
  {...NEW, id: 'slide', name: 'Slide', n: 8, aspect: .8, cardH: .54, dur: 10, fov: 34,
    desc: 'Photos ride down a curved slide, bending to its shape.',
    params: [G('Layout'), range('swingS', 'Swing', .3, 1.3, 1.05), range('turnsS', 'Turns', 1.5, 3.5, 2, .5), range('drop', 'Height', 1.4, 2.6, 2),
      range('reach', 'Toward you', .5, 1.3, 1), range('camSide', 'Camera side', -1, 1, 0), range('camHigh', 'Camera height', -.5, 1, .25),
      G('Motion'), whole('laps', 'Rides per loop', 1, 3, 1), range('gravity', 'Gravity', 0, .6, .35, .01, {hint: 'slow at the top, fast at the bottom'}), range('bank', 'Bank', 0, 1.5, .8),
      range('upright', 'Stay upright', 0, 1, .45, .01, {hint: 'how much each photo stays level instead of pointing down the chute'}),
      G('Look'), range('trough', 'Trough curve', 0, 1.5, .95), range('hug', 'Hug the slide', 0, 1.5, 1), range('topShade', 'Top shade', 0, .6, .18), off('nearBlur', 'Near blur', 1)],
    camera: (P, _E) => ({eye: [P.camSide * .9, .3 + P.camHigh, 3.9], target: [P.camSide * .1, -.05, -.4]}),
    layout(i, P, E){
      const sp = slidePath(P, E), n = E.n, fi = wrap(E.p * Math.round(P.laps) + i / n, 1), a = P.gravity;
      // gravity as a time warp: slow at the top, quickening down the chute (the wrap is hidden by the fades)
      const q = (1 - a) * fi + a * fi * fi, u = slideU(sp, q * sp.L), e = 1.5e-3;
      const c = sp.C(u), ca = sp.C(Math.max(0, u - e)), cb = sp.C(Math.min(1, u + e)), du = Math.min(1, u + e) - Math.max(0, u - e);
      const v = [(cb[0] - ca[0]) / du, (cb[1] - ca[1]) / du, (cb[2] - ca[2]) / du], Tn = norm(v), v2 = dot(v, v);
      const ac = [(cb[0] - 2 * c[0] + ca[0]) / (e * e), (cb[1] - 2 * c[1] + ca[1]) / (e * e), (cb[2] - 2 * c[2] + ca[2]) / (e * e)];
      const at = dot(ac, Tn), kv = [(ac[0] - Tn[0] * at) / v2, (ac[1] - Tn[1] * at) / v2, (ac[2] - Tn[2] * at) / v2];
      // the chute's floor faces the camera; it banks into each turn like a bobsled run
      const eye = [P.camSide * .9, .3 + P.camHigh, 3.9], cam = norm([eye[0] - c[0], eye[1] - c[1], eye[2] - c[2]]);
      let Z = norm([cam[0] - Tn[0] * dot(cam, Tn), cam[1] - Tn[1] * dot(cam, Tn), cam[2] - Tn[2] * dot(cam, Tn)]);
      const side = cross(Tn, Z), kLat = dot(kv, side);
      Z = rotV(Z, Tn, soft(-P.bank * kLat * .22, .7));
      // each photo rides head-up (its height along the chute), eased toward level so it never tips too far
      const up = [0, 1, 0], Yu = norm([up[0] - Z[0] * Z[1], up[1] - Z[1] * Z[1], up[2] - Z[2] * Z[1]]), Yt = [-Tn[0], -Tn[1], -Tn[2]];
      const Y = norm([lerp(Yt[0], Yu[0], P.upright), lerp(Yt[1], Yu[1], P.upright), lerp(Yt[2], Yu[2], P.upright)]), X = cross(Y, Z);
      // the card lies in the trough (curved across), and bends along the chute's pitch where it curves toward or away from you
      const kn = dot(kv, Z), ty = dot(Tn, Y), tx = dot(Tn, X);
      const o = smoother(0, .09, q) * (1 - smoother(.84, .97, q));
      return {m: frame3(c[0], c[1], c[2], X, Z), bend: soft(-P.trough * 1.3 - kn * P.hug * tx * tx, 3), bendY: soft(-kn * P.hug * ty * ty, 3),
        s: lerp(.86, 1, smoother(0, .2, q)), b: 1 - P.topShade * (1 - smoother(0, .35, q)), blur: P.nearBlur * smoother(.7, .95, q) * .5, o, img: i};
    }},

  /* 17. Pulse Grid: soft heartbeat rings spread from an origin; each photo swells toward you and curves with the ripple */
  {...NEW, id: 'pulse-grid', name: 'Pulse Grid', n: 20, aspect: .8, cardH: .4, dur: 7, fov: 30,
    desc: 'Heartbeat pulses run out from the centre, popping each photo forward in turn.',
    params: [G('Layout'), whole('cols', 'Columns', 3, 7, 5), whole('rowsG', 'Rows', 2, 5, 4), range('gapG', 'Gap', 0, .5, .1),
      seg('origin', 'Origin', {center: 'Centre', side: 'Side', corner: 'Corner'}, 'center'), range('camTilt', 'Camera tilt', -1, 1, .25),
      G('Motion'), whole('beats', 'Beats per loop', 1, 4, 2), range('spreadT', 'Ring travel', .15, .7, .38, .01, {hint: 'how long a ring takes to reach the far corner, as a share of a beat'}),
      range('dub', 'Second beat', 0, 1, .6), range('softP', 'Softness', .6, 1.6, 1, .01, {unit: '×'}), range('recoil', 'Recoil', 0, 1, .35),
      G('Look'), range('popZ', 'Swell', 0, 1.5, 1), range('tiltK', 'Tilt', 0, 1.5, .8), range('curveK', 'Ripple curve', 0, 1.5, .9), range('restDim', 'Rest shade', 0, .5, .14)],
    fill: (P, _E) => { const cols = Math.round(P.cols), rowsG = Math.round(P.rowsG); return {cols, rowsG, count: cols * rowsG}; },
    camera(P, E){ const d = E.D * 1.04, a = P.camTilt * .35; return {eye: [0, -Math.sin(a) * d, Math.cos(a) * d], target: [0, 0, 0]}; },
    layout(i, P, E){
      const cols = E.cols, rows = E.rowsG, c = i % cols, r = Math.floor(i / cols);
      const px = E.w * (1 + P.gapG), py = E.h * (1 + P.gapG), hw = (cols - 1) / 2 * px, hh = (rows - 1) / 2 * py;
      const x = (c - (cols - 1) / 2) * px, y = ((rows - 1) / 2 - r) * py;
      const ox = P.origin === 'center' ? 0 : -hw, oy = P.origin === 'corner' ? -hh : 0;
      const dm = Math.hypot(Math.max(Math.abs(-hw - ox), Math.abs(hw - ox)), Math.max(Math.abs(-hh - oy), Math.abs(hh - oy))) || 1;
      const dx = x - ox, dy = y - oy, d = Math.hypot(dx, dy), ux = d > 1e-6 ? dx / d : 0, uy = d > 1e-6 ? dy / d : 0;
      // the heartbeat in beat time: a lub, a softer dub, then a slow shallow recoil; each a smooth periodic peak
      const kk = P.spreadT / dm, tau = E.p * Math.round(P.beats) - d * kk, sg = .075 * P.softP;
      const parts = [[0, 1, sg], [.17, .65 * P.dub, sg * .9], [.4, -.22 * P.recoil, sg * 2.2]];
      let W = 0, W1 = 0, W2 = 0;
      for (const [t0, amp, s] of parts){ const [v, v1, v2] = vm(tau - t0, s); W += amp * v; W1 += amp * v1; W2 += amp * v2; }
      // the grid as a surface z(d): height, slope and curvature from the waveform (d/dd = -kk d/dt)
      const A = .3 * P.popZ, z = A * W, slope = -A * kk * W1, d2 = A * kk * kk * W2;
      const kr = -d2 / Math.pow(1 + slope * slope, 1.5) * P.curveK, kt = -slope / (d + .25) * P.curveK;
      const Z = [-slope * ux * P.tiltK, -slope * uy * P.tiltK, 1];
      const lift = clamp01(W);
      return {m: frame3(x, y, z, [1, 0, 0], Z), s: 1 + .07 * P.popZ * lift, bend: soft(kr * ux * ux + kt * uy * uy, 2.5), bendY: soft(kr * uy * uy + kt * ux * ux, 2.5),
        b: 1 - P.restDim * (1 - lift), img: i % E.n};
    }},

  /* 18. Wrap: a flat grid curls round an unseen sphere (outer columns first), the globe turns once, then it unrolls flat */
  {...NEW, id: 'wrap', name: 'Wrap', n: 24, aspect: 1.25, cardH: .21, dur: 14, fov: 30,
    style: {card: {back: 'solid', backColor: '#dedee3'}},
    desc: 'Photos wrap round an invisible sphere, then unwrap into a flat grid.',
    params: [G('Layout'), whole('colsW', 'Columns', 5, 9, 8), whole('rowsW', 'Rows', 2, 4, 3), range('gapW', 'Gap', 0, .3, .06),
      range('cover', 'Wrap', .5, 1, 1, .01, {hint: 'how far round the sphere the grid reaches'}), range('dolly', 'Camera follow', 0, 1, .85),
      G('Motion'), range('stagger', 'Curl lead', 0, .12, .06, .01, {hint: 'outer columns curl first and unroll last'}), whole('turns', 'Globe turns', 0, 2, 1),
      range('tiltG', 'Globe tilt', -30, 30, 12, 1, {unit: '°'}), {...P_EASE, def: 'inOutCubic'},
      G('Look'), range('hug', 'Card curve', 0, 1.3, 1), range('backShade', 'Far shade', 0, .7, .35)],
    fill: (P, _E) => { const colsW = Math.round(P.colsW), rowsW = Math.round(P.rowsW); return {colsW, rowsW, count: colsW * rowsW}; },
    camera(P, E){
      const W = E.w * (1 + P.gapW) * Math.round(P.colsW), km = TAU * P.cover / W, Rm = 1 / km, g = win(E.p, .2, .38, ease.inOutSine) - win(E.p, .62, .8, ease.inOutSine);
      const zw = -Rm + Rm * E.D / .62;
      return {eye: [0, .12 * g, lerp(E.D, lerp(E.D, zw, P.dolly), g)], target: [0, 0, -Rm * g]};
    },
    layout(i, P, E){
      const cols = E.colsW, rows = E.rowsW, c = i % cols, r = Math.floor(i / cols), ez = ease[P.ease as keyof typeof ease] || ease.inOutCubic, p = E.p;
      const px = E.w * (1 + P.gapW), py = E.h * (1 + P.gapW), W = px * cols, gx = (c - (cols - 1) / 2) * px, gy = ((rows - 1) / 2 - r) * py;
      const e = cols > 1 ? Math.abs(gx) / ((cols - 1) / 2 * px) : 0, st = P.stagger;
      const Wi = win(p, .08 + st * (1 - e), .34 + st * (1 - e), ez) - win(p, .62 + st * e, .86 + st * e, ez);
      const k = TAU * P.cover / W * Wi;
      let pos, X, N;
      if (k < 1e-5){ pos = [gx, gy, 0]; X = [1, 0, 0]; N = [0, 0, 1]; }
      else {
        const R = 1 / k, lon = gx * k, lat = gy * k, cl = Math.cos(lat);
        N = [cl * Math.sin(lon), Math.sin(lat), cl * Math.cos(lon)]; X = [Math.cos(lon), 0, -Math.sin(lon)];
        // the globe turns about its own centre (only while wrapped) and leans a little toward you
        const spin = TAU * Math.round(P.turns) * win(p, .3, .7, ease.inOutSine), tl = P.tiltG * D2R * Wi;
        const rot = (v: number[]) => { const a = rotY3(v, spin), c2 = Math.cos(tl), s2 = Math.sin(tl); return [a[0], a[1] * c2 - a[2] * s2, a[1] * s2 + a[2] * c2]; };
        N = rot(N); X = rot(X); pos = [N[0] * R, N[1] * R, N[2] * R - R];
      }
      // near the poles the cards shrink with the circle of latitude, so neighbours keep touching rather than overlapping
      const s = Math.cos(gy * TAU * P.cover / W * Wi) * .985 + .015;
      const m = frame3(pos[0], pos[1], pos[2], X, N);
      return {m, s, bend: TAU * P.cover / W * Wi * P.hug, bendY: TAU * P.cover / W * Wi * P.hug, b: 1 - P.backShade * clamp01(.5 - .5 * N[2]) * Wi, img: i % E.n};
    }},

  ];
  return templates;
})());

const CHOREO_H_TEMPLATES: Template[] = normalizeChoreo((() => {
  const sm5 = (t: number): number => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
  const add = (a: number[], b: number[], k = 1): number[] => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const sub = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a: number[], b: number[]): number[] => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a: number[]): number => Math.hypot(a[0], a[1], a[2]);
  const norm = (a: number[]): number[] => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const rotV = (v: number[], k: number[], a: number): number[] => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d]; };
  const soft = (v: number, m: number): number => m * Math.tanh(v / m);
  const ringR = (P: ChoreoParams, E: ChoreoEnv): number => E.n * E.w * (1 + P.ringGap) / TAU;
  const ringDist = (P: ChoreoParams, E: ChoreoEnv): number => (ringR(P, E) + E.w * .55) * E.D / (1.25 * .94) / P.ringFill;
  const slalomX = (s: number, P: ChoreoParams): number => -P.swing * Math.cos(PI * s / P.gateGap);
  const slalomDX = (s: number, P: ChoreoParams): number => P.swing * PI / P.gateGap * Math.sin(PI * s / P.gateGap);
  const slalomDDX = (s: number, P: ChoreoParams): number => P.swing * (PI / P.gateGap) ** 2 * Math.cos(PI * s / P.gateGap);
  const fallPath = (s: number, P: ChoreoParams, h: number): any => {
    const R = .08 + .24 * P.lip, Lp = 1.5, La = R * PI / 2, top = .5 * P.lipH;
    const ang = (q: number): number => Math.max(0, Math.min(PI / 2, (q - Lp) / R));
    const pt = (q: number): number[] => { if (q < Lp) return [0, top, -(Lp - q)]; if (q < Lp + La){ const a = ang(q); return [0, top - R + R * Math.cos(a), R * Math.sin(a)]; } return [0, top - R - (q - Lp - La), R]; };
    const a = (ang(s - h / 2) + ang(s + h / 2)) / 2, ovl = Math.max(0, Math.min(s + h / 2, Lp + La) - Math.max(s - h / 2, Lp));
    const c = pt(s);
    return { c, N: [0, Math.cos(a), Math.sin(a)], bend: ovl / (h * R), fall: Math.max(0, s - Lp - La), Lp, La };
  };
  const ribbonCache = new Map<string, any>();
  const ribbonPath = (P: ChoreoParams, E: ChoreoEnv): any => {
    const key = [P.loopW, P.loopH, P.loopD, P.spiral, E.asp.toFixed(3)].join();
    let c = ribbonCache.get(key); if (c) return c;
    const ax = .92 * P.loopW * Math.min(1.25, Math.max(.75, E.asp)) / 1.25, ay = .42 * P.loopH, az = .85 * P.loopD, sp = P.spiral;
    const C = (t: number): number[] => [ax * (Math.sin(t) + .18 * sp * Math.sin(3 * t)), ay * (Math.sin(2 * t) + .35 * sp * Math.cos(3 * t)), az * (Math.cos(t) + .25 * sp * Math.sin(2 * t))];
    const N = 1536, pts: number[][] = [], S = [0];
    for (let k = 0; k <= N; k++) pts.push(C(k / N * TAU));
    for (let k = 1; k <= N; k++) S.push(S[k - 1] + len(sub(pts[k], pts[k - 1])));
    c = { C, N, S, L: S[N] };
    if (ribbonCache.size > 24) ribbonCache.clear();
    ribbonCache.set(key, c); return c;
  };
  const ribbonT = (rp: any, s: number): number => {
    s = wrap(s, rp.L); let lo = 0, hi = rp.N;
    while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (rp.S[mid] <= s) lo = mid; else hi = mid; }
    const f = (s - rp.S[lo]) / Math.max(1e-9, rp.S[hi] - rp.S[lo]);
    return (lo + f) / rp.N * TAU;
  };
  const templates: ChoreoRaw[] = [

  /* 22. Ring Wave: a large turning ring of curved photos; a tumbling wave runs round it. The far side fades away (long and
     eased, with the shade), and the backs are plain, so a mirrored photo never shows */
  {...NEW, id: 'ring-wave', name: 'Ring Wave', n: 12, aspect: .8, cardH: .64, dur: 16, fov: 30,
    style: {card: {back: 'solid', backColor: '#e4e4e8'}},
    desc: 'A ring of curved photos with a flip wave running around it.',
    params: [G('Layout'), range('ringGap', 'Gap', 0, .5, .12), range('ringFill', 'Fill frame', .6, 1.2, 1), range('ringTilt', 'Ring tilt', -25, 25, 6, 1, {unit: '°'}),
      range('camHigh', 'Camera height', -.6, 1.2, .45),
      G('Motion'), whole('ringSpin', 'Ring turns', -2, 2, 1, {hint: 'whole turns of the ring per loop'}), whole('waves', 'Waves', 1, 4, 1), range('waveLen', 'Wave length', .1, .5, .24),
      whole('flips', 'Flips', 1, 2, 1), range('waveLift', 'Wave lift', 0, 1, .45),
      G('Look'), range('curve', 'Card curve', 0, 1.5, 1), range('farFade', 'Far side fade', 0, 1, 1), range('backDim', 'Back shade', 0, 1, .4), off('backBlur', 'Back blur', 1)],
    camera(P, E){ const d = ringDist(P, E), el = P.camHigh * .32; return {eye: [0, Math.sin(el) * d, Math.cos(el) * d], target: [0, -.04, 0]}; },
    layout(i, P, E){
      const n = E.n, R = ringR(P, E), a = i / n * TAU + Math.round(P.ringSpin) * TAU * E.p;
      // the wave runs over the cards: each one tumbles forward a whole turn as it passes, rising a little; the turn lingers
      // near face-on and passes quickly through the back
      const t = wrap(Math.round(P.waves) * E.p - i / n, 1) / P.waveLen, inW = t < 1 ? t : 0;
      const fe = sm5(inW), flip = Math.round(P.flips) * TAU * (.4 * fe + .6 * sm5(fe)), bump = Math.sin(PI * inW) ** 2;
      const m = M(RX(P.ringTilt * D2R), RY(a), T(0, P.waveLift * E.h * .5 * bump, R + bump * E.w * .25 * P.waveLift), RX(-flip));
      // depth: 0 at the front, 1 at the very back. Cards fade out well before they would turn their backs to you
      const back = clamp01(.5 - .5 * Math.cos(a)), o = 1 - P.farFade * sm5((back - .4) / .2);
      return {m, bend: P.curve / R * (1 - .6 * bump), s: 1 + .06 * bump, o, b: 1 - P.backDim * back, blur: P.backBlur * back * .5, glare: bump * .5, glareP: inW * 2 - .5};
    }},

  /* 26. Slalom: the camera carves between photos staged on alternating sides of its line */
  {...NEW, id: 'slalom', name: 'Slalom', n: 8, aspect: .8, cardH: .7, dur: 16, fov: 42,
    desc: 'The camera weaves between photos placed on alternating sides of a path.',
    params: [G('Layout'), range('gateGap', 'Gate spacing', .8, 2.6, 1.15), range('gateOut', 'Gate offset', .35, 1.2, .5), range('swing', 'Weave', 0, .6, .24),
      range('camHigh', 'Camera height', -.4, .5, .08), off('scatter', 'Height scatter', 1),
      G('Motion'), range('bank', 'Bank', 0, 1.5, .4), range('look', 'Look into turns', 0, 1.5, .6), range('faceCam', 'Face camera', 0, 1, .75),
      G('Look'), range('curve', 'Card curve', 0, 1.5, .5), off('farBlur', 'Distance blur', 1), range('farFade', 'Horizon fade', .3, 1, .7)],
    fill: (_P, E) => { const m = 2 * Math.ceil(Math.max(E.n, 10) / 2); return {m, count: m}; },
    camera: (_P, _E) => ({eye: [0, 0, 0], target: [0, 0, -1]}),
    layout(i, P, E){
      const m = E.m, sp = P.gateGap, Lt = m * sp, sc = E.p * Lt, side = i % 2 ? 1 : -1;
      // distance ahead of the camera along the line: cards wrap from just behind it to the far end, hidden there
      const ds = wrap(i * sp - sc + .7, Lt) - .7;
      const xw = side * (P.gateOut + P.swing), dx = xw - slalomX(sc, P);
      const th = Math.atan(slalomDX(sc, P)) * P.look, bank = -Math.atan(slalomDDX(sc, P) * .35) * P.bank * .6;
      let x = dx * Math.cos(th) - ds * Math.sin(th), z = -(dx * Math.sin(th) + ds * Math.cos(th));
      let y = -P.camHigh + P.scatter * (E.rnd(i % E.n, 4) - .5) * .5;
      const cb = Math.cos(bank), sb = Math.sin(bank); [x, y] = [x * cb - y * sb, x * sb + y * cb];
      // each photo turns partly toward the approaching camera, and partly to face along the line
      const f = aim(-x, -y, -z), ry = lerp(-th, f.ry, P.faceCam), rx = f.rx * P.faceCam;
      const o = sstep(-.35, .35, ds) * (1 - sstep(Lt * P.farFade - 2.5, Lt * P.farFade, ds + .7));
      return {m: M(T(x, y, z), RZ(bank), RY(ry), RX(rx)), o, bend: -P.curve * .9, blur: P.farBlur * sstep(2.5, 9, ds) * .6, img: i % E.n};
    }},

  /* 27. Waterfall: lanes of photos glide to a rounded lip, curl over it and fall away, accelerating */
  {...NEW, id: 'waterfall', name: 'Waterfall', n: 9, aspect: 1.25, cardH: .34, dur: 14, fov: 30,
    desc: 'Photos pour over a curved edge like water and fall away.',
    params: [G('Layout'), whole('lanes', 'Lanes', 1, 4, 3), range('laneGap', 'Lane gap', 0, .4, .1), range('lip', 'Lip roundness', 0, 1, .55), range('lipH', 'Lip height', .3, 1.3, 1),
      range('camHigh', 'Camera height', .2, 2, 1.5),
      G('Motion'), whole('flow', 'Flow', 1, 3, 2, {hint: 'how many times each photo goes over per loop'}), range('flutter', 'Flutter', 0, 1, .45), range('spreadF', 'Spread', 0, 1, .35), range('drag', 'Drag', 0, 1, .4, .01, {hint: 'lower lanes hang back'}),
      G('Look'), range('lipBend', 'Lip bend', 0, 1.2, 1), range('topShade', 'Top shade', 0, .5, .16), off('fallBlur', 'Fall blur', 1)],
    fill: (P, _E) => { const L = Math.round(P.lanes); return {L, per: 6, count: L * 6}; },
    camera: (P, _E) => ({eye: [0, .55 * P.camHigh + .25, 3.6], target: [0, -.02, 0]}),
    layout(i, P, E){
      const L = E.L, per = E.per, lane = i % L, j = Math.floor(i / L), h = E.h;
      const tau = wrap(Math.round(P.flow) * E.p + (j + ((lane * 2.3) % L) / L * (1 - P.drag * .6)) / per, 1);
      // glide slowly to the lip, then fall with gravity; speed is continuous where the fall begins
      const ta = .62, R = .08 + .24 * P.lip, base = 1.5 + R * PI / 2, v0 = base / ta, g = 2 * (2.5 - v0 * (1 - ta)) / ((1 - ta) ** 2);
      const s = tau < ta ? v0 * tau : base + v0 * (tau - ta) + .5 * Math.max(0, g) * (tau - ta) ** 2;
      const F = fallPath(s, P, h), fall = F.fall, fl = sstep(0, .9, fall);
      const lx = (lane - (L - 1) / 2) * E.w * (1 + P.laneGap), seed = E.rnd(i, 3) * TAU;
      const x = lx * (1 + P.spreadF * fall * .25) + P.flutter * .06 * fl * Math.sin(fall * 3.1 + seed);
      const rz = P.flutter * .22 * fl * Math.sin(fall * 2.3 + seed), rx = -P.flutter * .18 * fl * Math.sin(fall * 1.7 + seed * 1.3);
      const m = M(frame3(x, F.c[1], F.c[2] + fall * .06, [1, 0, 0], F.N), RZ(rz), RX(rx));
      const o = sm5(tau / .14) * (1 - sstep(1.05, 2.05, fall));
      const onTop = 1 - clamp01(F.N[2] * 1.6);
      return {m, o, bendY: P.lipBend * F.bend, bend: P.flutter * .5 * fl * Math.sin(fall * 2 + seed), b: 1 - P.topShade * onTop, blur: P.fallBlur * sstep(.3, 1.6, fall) * .5,
        s: lerp(.9, 1, sm5(tau / .2)), img: (lane + j * L) % E.n};
    }},

  /* 30. Gymnast Ribbon: a long silk band of photos follows a looping 3D line, tapering to its tail. The band rolls and
     curves with the loop, but every photo on it stays upright and faces you */
  {...NEW, id: 'gymnast-ribbon', name: 'Gymnast Ribbon', n: 10, aspect: 1.1, cardH: .3, dur: 16, fov: 30,
    desc: 'A long ribbon of photos loops and spirals through the air.',
    params: [G('Layout'), whole('length', 'Ribbon length', 8, 40, 22), range('loopW', 'Loop width', .5, 1.4, 1), range('loopH', 'Loop height', .3, 1.6, 1), range('loopD', 'Loop depth', 0, 1.6, 1),
      range('spiral', 'Spiral', 0, 1.5, .8), range('ribbonGap', 'Gap', 0, .3, .015),
      G('Motion'), whole('laps', 'Laps', 1, 3, 1), range('twist', 'Twist', 0, 1, .45), range('taper', 'Taper', 0, .8, .5), range('follow', 'Follow the band', 0, 4, 2.5),
      G('Look'), range('curve', 'Ribbon curve', 0, 1.5, 1), off('farBlur', 'Distance blur', 1), range('farShade', 'Distance shade', 0, .6, .25)],
    fill: (P, _E) => ({count: Math.round(P.length)}),
    layout(i, P, E){
      const rp = ribbonPath(P, E), m = E.count, taper = (j: number) => 1 - P.taper * (m > 1 ? j / (m - 1) : 0) ** 1.3;
      // arc position: the head runs whole laps per loop; each card sits a card-width behind the one before
      let back = 0; for (let j = 0; j < i; j++) back += E.w * (taper(j) + taper(j + 1)) / 2 * (1 + P.ribbonGap);
      const sh = Math.round(P.laps) * rp.L * E.p, t = ribbonT(rp, sh - back), e = 2e-3;
      const c = rp.C(t), ca = rp.C(t - e), cb = rp.C(t + e), v = sub(cb, ca), Tn = norm(v);
      const acc = [(cb[0] - 2 * c[0] + ca[0]) / (e * e), (cb[1] - 2 * c[1] + ca[1]) / (e * e), (cb[2] - 2 * c[2] + ca[2]) / (e * e)], sp2 = dot(v, v) / (4 * e * e);
      const kv = add(acc, Tn, -dot(acc, Tn)).map(a => a / Math.max(1e-6, sp2));
      // the band keeps its face toward the camera (never its back), with a slow twist that rolls along its length
      const cam = norm(sub([0, 0, E.D], c));
      let Z = add(cam, Tn, -dot(cam, Tn)); if (len(Z) < 1e-3) Z = cam; Z = norm(Z);
      Z = norm(add(rotV(Z, Tn, P.twist * .7 * Math.sin(2 * t + 1.2)), cam, .35));
      // each photo is set upright on the band: its width starts from the level direction in the band's plane and leans
      // toward the band's run by how level that run is (d), so it follows the silk on the sweeps, but a loop that runs
      // leftward or straight up never turns a photo over (the lean is at most ~35°, and it is 0 where the run is vertical)
      let X = [1 - Z[0] * Z[0], -Z[0] * Z[1], -Z[0] * Z[2]]; if (len(X) < 1e-3) X = [0, 0, -1]; X = norm(X);
      const Tp = norm(add(Tn, Z, -dot(Tn, Z))), d = dot(Tp, X); X = norm(add(X, Tp, P.follow * d));
      const Y = cross(Z, X), kn = -dot(kv, Z) * P.curve, tx = dot(Tn, X), ty = dot(Tn, Y);
      const tp = taper(i), far = clamp01(-c[2] / 1.4);
      return {m: frame3(c[0], c[1], c[2], X, Z), s: tp, bend: soft(kn * tx * tx, 4), bendY: soft(kn * ty * ty, 4), o: sstep(0, .6, (m - 1 - i) / 2 + .2),
        b: 1 - P.farShade * far, blur: P.farBlur * far * .5, img: i % E.n};
    }},

  ];
  return templates;
})());

const CHOREO_I_TEMPLATES: Template[] = normalizeChoreo((() => {
  const springIn = (t: number, k: number): number => { if (t <= 0) return 0; if (t >= 1) return 1; const s = t * t * (3 - 2 * t), c = 1.70158 * k; return 1 + (c + 1) * (s - 1) ** 3 + c * (s - 1) ** 2; };
  const swin = (p: number, a: number, b: number, k: number): number => springIn((p - a) / Math.max(1e-4, b - a), k);
  const glide = (p: number, a: number, b: number): number => smoother(a, b, p);
  const rate = (f: (p: number) => number, p: number, d = .002): number => (f(p + d) - f(p - d)) / (2 * d);
  const bump = (t: number): number => t <= 0 || t >= 1 ? 0 : Math.sin(PI * t) ** 2;
  const signCache = new Map<string, Float32Array>();
  const signSwing = (P: ChoreoParams, E: ChoreoEnv, q: number): number => {
    const n = E.n, key = [n, E.hold, P.ease, P.damp, P.swingRate].join();
    let tab = signCache.get(key);
    if (!tab){
      const N = 240 * n, dp = 1 / N, w = TAU * n * P.swingRate, z = .08 + .5 * P.damp, u = (p: number): number => stepU(wrap(p, 1), n, E.hold, E.ez) + Math.floor(p) * n;
      let th = 0, v = 0; tab = new Float32Array(N + 1);
      for (let s = 0; s < 2 * N; s++){
        const p = s * dp, acc = (u(p + dp) - 2 * u(p) + u(p - dp)) / (dp * dp);
        v += (-w * w * th - 2 * z * w * v - acc) * dp; th += v * dp;
        if (s >= N) tab[s - N] = th;
      }
      tab[N] = tab[0];
      let mx = 1e-6; for (const t of tab) mx = Math.max(mx, ab(t));
      for (let s = 0; s <= N; s++) tab[s] /= mx;
      signCache.set(key, tab); if (signCache.size > 24) signCache.delete(signCache.keys().next().value!);
    }
    const f = wrap(q, 1) * (tab.length - 1), k = Math.floor(f);
    return lerp(tab[k], tab[Math.min(k + 1, tab.length - 1)], f - k);
  };
  const sCache = new Map<string, any>();
  const sPath = (X: number, A: number): any => {
    const key = X.toFixed(3) + ',' + A.toFixed(3);
    let t = sCache.get(key);
    if (!t){
      const N = 256, xs = new Float32Array(N + 1), ss = new Float32Array(N + 1), k = PI / X;
      let s = 0;
      for (let j = 0; j <= N; j++){ const x = -X + 2 * X * j / N; if (j){ const x0 = xs[j - 1]; s += Math.hypot(x - x0, A * (Math.sin(k * x) - Math.sin(k * x0))); } xs[j] = x; ss[j] = s; }
      t = { xs, ss, L: s, k }; sCache.set(key, t); if (sCache.size > 24) sCache.delete(sCache.keys().next().value!);
    }
    return t;
  };
  const sAt = (t: any, s: number): number => { const { xs, ss } = t; let lo = 0, hi = ss.length - 1; s = Math.max(0, Math.min(t.L, s));
    while (hi - lo > 1){ const m = (lo + hi) >> 1; if (ss[m] < s) lo = m; else hi = m; }
    return lerp(xs[lo], xs[hi], (s - ss[lo]) / Math.max(1e-6, ss[hi] - ss[lo])); };
  const dealS = (i: number, n: number, p: number, P: ChoreoParams): any => {
    const si = Math.sqrt(lerp(.07, 1, n > 1 ? i / (n - 1) : 1)), rank = n - 1 - i, span = .3 * P.dealSpan / Math.max(1, n - 1), fl = .16 * P.flightTime;
    const t0 = .04 + rank * span, out = swin(p, t0, t0 + fl, P.settle), g0 = .64 + (i / Math.max(1, n - 1)) * .12 * P.dealSpan;
    const gl = Math.min(.17 * P.flightTime, .97 - g0), back = glide(p, g0, g0 + gl);
    return { s: si * (out - back), fly: bump((p - t0) / fl) + bump((p - g0) / gl), out, back };
  };
  const templates: ChoreoRaw[] = [

  /* 33. Sign: hero photos hang from unseen brackets on a gentle arc; each step the arc glides on and every sign answers
     with a damped swing in 3D (side to side and in and out of the frame, tracing a small ellipse), each a moment after
     its neighbour, so the row ripples like a street of signs in a gust */
  {...NEW, id: 'sign', name: 'Sign', n: 6, aspect: 1.25, cardH: 1.06, step: true, perCard: 2.8, fov: 30, mods: {hold: .4, ease: 'inOutCubic'},
    desc: 'A hero photo swings gently like a hanging sign; the next one swings in.',
    params: [G('Layout'), range('chain', 'Chain length', 0, .8, .22), range('spacingS', 'Spacing', .8, 1.6, 1.05, .01, {unit: '×', hint: 'below 1 the neighbours come further into the frame'}),
      range('arcS', 'Arc', 0, 1.5, .8, .01, {hint: 'how far the row of signs curves away into depth'}), range('hang', 'Hang height', -.4, .4, .04), range('camSide', 'Camera side', -1, 1, .12),
      G('Motion'), range('swing', 'Swing', 0, 40, 11, 1, {unit: '°'}), range('swingRate', 'Swing rate', .6, 2.5, 1.1), range('damp', 'Damping', 0, 1, .35),
      range('follow', 'Follow-through', 0, 1, .55, .01, {hint: 'each sign answers a moment after the one before'}), range('depthSwing', 'Depth swing', 0, 1, .6), range('breeze', 'Breeze', 0, 1, .3),
      G('Look'), range('curve', 'Card curve', 0, 1.5, .55), range('sideShade', 'Side shade', 0, 1, .3), range('sheen', 'Glare', 0, 1, .5, .01, {hint: 'shows with Shine on'})],
    camera: (P, E) => ({eye: [P.camSide * 1.2, .12, E.D], target: [0, 0, -.1]}),
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), r = rel(i, u, n), ar = ab(r);
      // the brackets sit on a shallow arc: neighbours recede and turn a little, so the row has depth
      const sp = (E.vx * .62 + E.w * .55) * P.spacingS, a0 = P.arcS * .42, R = a0 > 1e-3 ? sp / a0 : 0;
      const x = R ? R * Math.sin(r * a0) : r * sp, z = R ? -R * (1 - Math.cos(r * a0)) : 0;
      // the swing: the shared damped response, sampled a little later the further along the row (follow-through);
      // the in-and-out swing runs a quarter period behind, so the sign traces a soft ellipse, not a flat arc
      const per = 1 / (n * P.swingRate), lag = P.follow * per * .22, A = P.swing * D2R;
      const sw = (q: number) => signSwing(P, E, q), q0 = E.p - lag * r;
      const ph = E.rnd(i, 4) * TAU, bz = Math.sin(TAU * n * E.p + ph);
      const th = sw(q0) * A + P.breeze * .045 * bz, phi = P.depthSwing * (sw(q0 - per * .25) * A * .8 + P.breeze * .04 * Math.sin(TAU * n * E.p + ph + 1.3));
      // air pushes a fast-moving sign into a deeper curve
      const om = ab(rate(sw, q0, .0015)) * per / TAU, air = Math.min(1, om * 1.2);
      const L = P.chain + E.h / 2, top = P.hang + E.h / 2 + P.chain;
      const m = M(T(x, top, z), RY(r * a0 * .8), RZ(th), RX(phi), T(0, -L, 0));
      return {m, bend: -P.curve * (.42 + .38 * air) / E.w, b: 1 - P.sideShade * Math.min(1, ar) * .7,
        o: (1 - smoother(1.25, 1.95, ar)) * wrapFade(r, n), glare: P.sheen, glareP: .45 + phi * 3 + th * .9, zBias: -ar * .01, img: i};
    }},

  /* 35. Swatch Fan: tall photos pinned near the bottom bloom open from the middle into a wide fan, each turning back
     toward upright so every photo stays readable; then the fan sweeps shut into one side and swings home as a stack */
  {...NEW, id: 'swatch-fan', name: 'Swatch Fan', n: 7, aspect: .46, cardH: 1.1, dur: 12, fov: 30, style: {card: {radius: .12}},
    desc: 'Photos pivot from one corner and fan out like a swatch book.',
    params: [G('Layout'), range('fanS', 'Spread', 60, 200, 150, 1, {unit: '°'}), range('upright', 'Keep upright', 0, 1, .5, .01, {hint: 'each photo turns back toward level as it fans'}),
      range('pin', 'Pin inset', .05, .5, .16), range('slideOut', 'Slide out', 0, 1, .55, .01, {hint: 'swatches slide out from the rivet as they fan, so each photo shows more'}), range('rise', 'Rise', 0, 1, .35, .01, {hint: 'the open fan climbs toward you like a spiral stair'}), range('camTilt', 'Camera tilt', -1, 1, .2),
      G('Motion'), seg('closeWay', 'Close', {sweep: 'Sweep shut', back: 'Fold back'}, 'sweep'), range('openTime', 'Open time', .5, 1.6, 1, .01, {unit: '×'}),
      range('staggerS', 'Stagger', 0, 1, .6), range('overshoot', 'Overshoot', 0, 1, .3), off('drift', 'Breathe', 1),
      G('Look'), range('swFlex', 'Swatch flex', 0, 1, .5), range('curveS', 'Card curve', 0, 1.5, .5), range('stackShade', 'Stack shade', 0, 1, .3)],
    camera: (P, E) => ({eye: [0, P.camTilt * E.D * .45, E.D], target: [0, 0, 0]}),
    layout(i, P, E){
      const n = E.n, f = n > 1 ? i / (n - 1) : .5, A = P.fanS * D2R, ai = (.5 - f) * A, dc = ab(f - .5) * 2;
      const ot = .2 * P.openTime, st = .14 * P.staggerS;
      // open: from the middle outward; close: retrace, or sweep into the right-hand swatch and swing home together
      const op = (q: number) => swin(q, .05 + dc * st, .05 + dc * st + ot, P.overshoot);
      const ang = P.closeWay === 'back'
        ? (q: number) => ai * (op(q) - swin(q, .56 + (1 - dc) * st, .56 + (1 - dc) * st + ot, P.overshoot * .5))
         : (q: number) => lerp(ai * op(q), -A / 2, swin(q, .52 + (1 - f) * st, .52 + (1 - f) * st + ot, P.overshoot * .4)) * (1 - glide(q, .8, .97));
      const th = ang(E.p) * (1 + P.drift * .05 * Math.sin(TAU * E.p)), w = rate(ang, E.p);
      const oo = glide(E.p, .05, .1 + ot + st) - glide(E.p, .52, .57 + ot + st);
      // composed so the open fan and the closed stack share a centre, scaled to fit the frame's width
      // the closed stack is shown larger; the open fan shrinks just enough to fit the frame's width
      const ci = P.pin * E.w, ex = P.slideOut * E.h * .32, reach = (E.h - ci + ex) * Math.sin(Math.min(A / 2, PI / 2)) + E.w * .5;
      const sO = Math.min(1, E.vx * .95 / reach, E.vy * 1.9 / (E.h + ex)), sC = Math.min(1.15, E.vy * 1.7 / E.h);
      // grows back to the stack's size only once it is closed and upright again
      const kC = E.p < .5 || P.closeWay === 'back' ? 1 - oo : glide(E.p, .8, .97), sF = lerp(sO, sC, kC);
      const pinY = (-(E.h / 2 - ci) - ex * .5 * oo) * sF;
      const m = M(T(0, pinY, i * .008 + P.rise * .5 * (f - .5) * oo), RZ(th), T(0, (E.h / 2 - ci + ex * oo) * sF, 0), RZ(-th * P.upright));
      return {m, s: sF, bend: -P.curveS * .5 / E.w, bendY: -P.swFlex * w * .025, b: 1 - P.stackShade * (1 - oo) * (1 - f) * .45, img: i};
    }},

  /* 37. Spiral Deal: from a deck in the middle, photos are dealt out along a spiral laid in a shallow bowl, each flying
     in a soft arc toward you and settling into place curved to the bowl; later the spiral drains back into the deck */
  {...NEW, id: 'spiral-deal', name: 'Spiral Deal', n: 12, aspect: .8, cardH: .44, dur: 12, fov: 32,
    desc: 'Photos are dealt along a spiral outward, then gathered back.',
    params: [G('Layout'), range('turns', 'Turns', .5, 2, 1.1), range('spiralSize', 'Size', .6, 1.2, 1, .01, {unit: '×'}), range('bowl', 'Bowl', 0, 1, .45, .01, {hint: 'the outer cards rise toward you and curve round the centre'}),
      seg('orient', 'Photos', {upright: 'Upright', follow: 'Follow spiral'}, 'upright'), range('deckScale', 'Deck size', 1, 2, 1.35, .01, {unit: '×'}), range('camTilt', 'Camera tilt', -1, 1, .2),
      G('Motion'), range('dealSpan', 'Deal pace', .4, 1.4, 1, .01, {unit: '×'}), range('flightTime', 'Flight time', .5, 1.6, 1, .01, {unit: '×'}), range('settle', 'Settle', 0, 1, .3),
      whole('spins', 'Spins', 0, 2, 0), off('rotate', 'Spiral turn', 1),
      G('Look'), range('curve', 'Flight curve', 0, 1.5, .7), range('innerShade', 'Inner shade', 0, 1, .25), off('farBlur', 'Depth blur', 1)],
    camera: (P, E) => ({eye: [0, -P.camTilt * E.D * .45, E.D], target: [0, 0, P.bowl * .15]}),
    layout(i, P, E){
      const n = E.n, d = dealS(i, n, E.p, P), sz = P.spiralSize, V = P.bowl * .55, r0 = .1;
      // an elliptical spiral that fills the frame's shape, on a bowl z = V·r²
      const Rx = Math.max(.45, E.vx - E.w * .62) * sz, Ry = Math.max(.4, E.vy - E.h * .62) * sz, rot = P.rotate * .5 * Math.sin(TAU * E.p);
      const sp = (s: number) => { const a = PI / 2 + rot - s * P.turns * TAU, r = r0 * sstep(0, .1, s) + (1 - r0) * s; return [Rx * r * Math.cos(a), Ry * r * Math.sin(a)]; };
      // the dealt spiral is lopsided, so the whole layout slides to centre it as the deal spreads (and back as it drains)
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
      for (let j = 0; j < n; j++){ const q = sp(Math.sqrt(lerp(.07, 1, n > 1 ? j / (n - 1) : 1))); bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
      const spread = glide(E.p, .04, .5) - glide(E.p, .64, .95), ox = -(bx0 + bx1) / 2 * spread, oy = -(by0 + by1) / 2 * spread;
      const pt = (s: number) => { const [x, y] = sp(s); return [x + ox, y + oy, V * ((x / Rx) ** 2 + (y / Ry) ** 2)]; };
      const s = d.s, c = pt(s), a1 = pt(s - .002), b1 = pt(s + .002), atDeck = 1 - sstep(0, .14, s);
      // across the card: level, or along the spiral (never more than a quarter turn, so no photo hangs upside down)
      let ang = Math.atan2(b1[1] - a1[1], b1[0] - a1[0]); if (ang > PI / 2) ang -= PI; if (ang < -PI / 2) ang += PI;
      ang *= P.orient === 'follow' ? 1 - atDeck : 0;
      const cx = Math.cos(ang), sx = Math.sin(ang), zx = 2 * V * (c[0] - ox) / (Rx * Rx), zy = 2 * V * (c[1] - oy) / (Ry * Ry), g = 1 + zx * zx + zy * zy;
      // the card lies on the bowl and bends with it (concave toward you), and arcs up and curls while it flies
      const kn = 2 * V * (cx * cx / (Rx * Rx) + sx * sx / (Ry * Ry)) / Math.sqrt(g);
      const lift = P.curve * .32 * d.fly, stack = atDeck * i * .006;
      const spin = (1 - d.out + d.back) * Math.round(P.spins) * TAU;
      const m = M(frame3(c[0], c[1], c[2] + lift + stack, [cx, sx, zx * cx + zy * sx], [-zx, -zy, 1]), RZ(spin));
      return {m, s: lerp(1, P.deckScale, atDeck), bend: -kn - P.curve * d.fly * .8 / E.w, b: 1 - P.innerShade * (1 - s) * (1 - atDeck) * .6,
        blur: P.farBlur * (1 - s) * (1 - atDeck) * .5, zBias: d.fly * .08, img: i};
    }},

  /* 38. S-Wall: rows of photos ride an S-shaped wall that swings toward and away from the lens as it scrolls */
  {...NEW, id: 's-wall', name: 'S-Wall', n: 9, aspect: .8, cardH: .5, dur: 18, fov: 36,
    desc: 'A wall of photos bent into an S-curve scrolls past.',
    params: [G('Layout'), whole('rows', 'Rows', 1, 4, 3), range('depthS', 'S depth', 0, 1.6, 1.05), range('gapS', 'Gap', 0, .6, .1), range('twistS', 'Twist', -1, 1, 0, .01, {hint: 'each row bends a little more than the one below'}),
      range('camHigh', 'Camera height', -1, 1, .15), range('camSide', 'Camera side', -1, 1, 0),
      G('Motion'), whole('laps', 'Laps', 1, 3, 1), off('sway', 'Sway', 1, {hint: 'the S rocks gently in depth'}),
      G('Look'), range('curve', 'Card curve', 0, 1.5, 1), range('farDim', 'Distance shade', 0, 1, .3), off('farBlur', 'Distance blur', 1)],
    fill(P, E){
      const R = Math.round(P.rows), X = E.vx * 1.2 + E.w, pitch = E.w * (1 + P.gapS);
      const L = sPath(X, P.depthS * .55 * (1 + .3 * ab(P.twistS))).L, m = fillSlots(L / 2, pitch, E.n, R, 120);
      return {R, X, pitch, mS: m, count: m * R};
    },
    camera: (P, E) => ({eye: [P.camSide * 1.2, P.camHigh * .9, E.D * 1.05], target: [0, 0, -.1]}),
    layout(i, P, E){
      const {R, X, pitch, mS: m} = E, row = Math.floor(i / m), j = i % m;
      const rf = R > 1 ? row / (R - 1) - .5 : 0, A = P.depthS * .55 * (1 + P.twistS * rf * .6) * (1 + P.sway * .2 * Math.sin(TAU * E.p));
      const path = sPath(X, Math.max(1e-3, A)), Ltot = m * pitch;
      const s = wrap(j * pitch + (row % 2) * pitch * .5 + E.p * Math.round(P.laps) * E.n * pitch, Ltot) - (Ltot - path.L) / 2;
      const fade = sstep(0, pitch * 1.2, s) * sstep(0, pitch * 1.2, path.L - s), x = sAt(path, s), k = path.k;
      const z = A * Math.sin(k * x), dz = A * k * Math.cos(k * x), ddz = -A * k * k * Math.sin(k * x);
      const y = (row - (R - 1) / 2) * E.h * (1 + P.gapS);
      const kap = -ddz / Math.pow(1 + dz * dz, 1.5), near = clamp01((A - z) / Math.max(1e-3, 2 * A));
      return {m: frame3(x, y, z, [1, 0, dz], [-dz, 0, 1]), bend: P.curve * kap, o: fade, b: 1 - P.farDim * near * .6, blur: P.farBlur * near * .5,
        img: (j + row * 3) % E.n};
    }},

  ];
  return templates;
})());

const CHOREO_J_TEMPLATES: Template[] = normalizeChoreo((() => {
  const AW = (E: ChoreoEnv): number => Math.max(1, E.asp);
  const glide = (p: number, a: number, b: number): number => smoother(a, b, p);
  const sub = (a: number[], b: number[]): number[] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a: number[], b: number[]): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a: number[]): number => Math.hypot(a[0], a[1], a[2]);
  const onCurve = (f: (t: number) => number[], t: number, Z: number[], e = 1e-3): any => {
    const a = f(t - e), c = f(t), b = f(t + e), d1 = sub(b, a), sp = len(d1) / (2 * e) || 1;
    const acc = [(b[0] - 2 * c[0] + a[0]) / (e * e), (b[1] - 2 * c[1] + a[1]) / (e * e), (b[2] - 2 * c[2] + a[2]) / (e * e)];
    const m = frame3(c[0], c[1], c[2], d1, Z), N = [m[8], m[9], m[10]];
    return { m, c, bend: -dot(acc, N) / (sp * sp), tan: d1 };
  };
  const templates: ChoreoRaw[] = [

  /* 42. Sketch Path: an unseen pen draws a ribbon through space; photos unroll out of the stroke in its wake, curved
     and turned into the line like screens on a curving rail; the ribbon floats, then an eraser runs the same way and
     the photos curl up, sink and fade */
  {...NEW, id: 'sketch-path', name: 'Sketch Path', n: 9, aspect: .8, cardH: .54, dur: 11, fov: 32,
    desc: 'Photos appear along a curve as if drawing it, then erase.',
    params: [G('Layout'), seg('shape', 'Stroke', {s: 'S-curve', arc: 'Arc', wave: 'Wave'}, 's'), range('strokeW', 'Width', .5, 1.3, 1, .01, {unit: '×'}),
      range('strokeH', 'Height', 0, 1.5, 1, .01, {unit: '×'}), range('strokeZ', 'Depth', 0, 1.5, .8), range('follow', 'Turn with line', 0, 1, .35, .01, {hint: 'how far each photo tilts with the stroke'}),
      range('wrapL', 'Wrap to line', 0, 1, .9, .01, {hint: 'photos turn and curve into the stroke\'s depth'}),
      G('Motion'), range('drawTime', 'Draw time', .25, .45, .4), range('nib', 'Nib softness', .1, .6, .3), seg('erase', 'Erase from', {start: 'Start', end: 'End'}, 'start'),
      range('float', 'Float', 0, 1, .5),
      G('Look'), range('unroll', 'Unroll', 0, 1.5, .8), range('tipPop', 'Pen-tip scale', 0, .4, .12), range('depthShade', 'Depth shade', 0, 1, .35)],
    layout(i, P, E){
      const n = E.n, Lx = Math.min(1.3, AW(E) * .74) * P.strokeW, A = .55 * P.strokeH, Zd = .6 * P.strokeZ, fl = P.float * .05, ph = TAU * E.p;
      // the stroke: ends swing toward you (a concave rail), the middle away; it floats on a slow swell
      const path = (t: number) => {
        const u = t * 2 - 1, sway = fl * Math.sin(ph + u * 1.6), sz = fl * .6 * Math.cos(ph + u);
        if (P.shape === 'arc') return [u * Lx, A * .55 * (1 - u * u) - A * .2 + sway, -Zd * .75 * Math.cos(PI * u * .85) + Zd * .25 + sz];
        if (P.shape === 'wave') return [u * Lx, A * .5 * Math.sin(1.5 * PI * u) + sway, Zd * .45 * Math.cos(1.5 * PI * u) - Zd * .15 + sz];
        return [u * Lx, A * .62 * Math.sin(PI * u) + sway, -Zd * .6 * Math.cos(PI * u) + sz];
      };
      // even spacing along the stroke (arc length), so the photos sit evenly round the bends
      const K = 40, cum = [0]; let prev = path(0);
      for (let k = 1; k <= K; k++){ const q = path(k / K); cum.push(cum[k - 1] + len(sub(q, prev))); prev = q; }
      const Lt = cum[K], sf = (i + .5) / n, tgt = sf * Lt; let k = 1; while (k < K && cum[k] < tgt) k++;
      const t = (k - 1 + (tgt - cum[k - 1]) / Math.max(1e-6, cum[k] - cum[k - 1])) / K;
      // pen and eraser: long sine-eased runs along the stroke; the soft nib overlaps each appearance with the next
      // (half sine, half steady, so the pen never dawdles at the ends of the stroke)
      const pen = (t: number) => .5 * t + .5 * ease.inOutSine(t), dt = P.drawTime, nb = P.nib;
      const d = pen(clamp01((E.p - .01) / dt)) * (1 + nb), e = pen(clamp01((E.p - .99 + dt) / dt)) * (1 + nb);
      const se = P.erase === 'end' ? 1 - sf : sf;
      const a = smoother(0, 1, (d - sf) / nb), rr = smoother(0, 1, (e - se) / nb), v = a * (1 - rr);
      const tip = Math.exp(-(((d - sf - nb * .35) / (nb * .55)) ** 2)) * (1 - rr);
      const C = onCurve(path, t, [0, 0, 1]), c = C.c, tn = C.tan;
      const ry = Math.atan2(-tn[2], tn[0]) * P.wrapL, rz = Math.atan2(tn[1], Math.hypot(tn[0], tn[2])) * P.follow;
      // emerging, a photo lies back and curled, then lifts and unrolls onto the rail; erased, it curls and sinks
      const sc = Math.min(1.25, Math.max(.6, Lt / n * 1.15 / E.w)), rx = P.unroll * (.55 * (1 - a) - .35 * rr);
      const m = M(T(c[0], c[1], c[2]), RY(ry), RZ(rz), T(0, 0, i * .01 - .2 * (1 - v)), RX(rx));
      return {m, s: sc * (.6 + .4 * v) * (1 + P.tipPop * tip), o: smoother(0, .7, v), bend: C.bend * P.wrapL - P.unroll * (1 - v) * 2.2 / E.w,
        b: 1 - P.depthShade * clamp01(-c[2] / .8) * .6, zBias: i * .002, img: i};
    }},

  /* 44. Immersive: photos are curved screens on a ring around you; the one in front swells and wraps round the lens
     like a cinema screen while the others dim and fall back, you drift slowly inside it as it closes in, then it
     unwraps onto the ring and the ring glides on to the next */
  {...NEW, id: 'immersive', name: 'Immersive', n: 5, aspect: 1.6, cardH: .9, dur: 24, fov: 66,
    desc: 'A hero photo curves round you like a cinema screen, then flattens.',
    params: [G('Layout'), range('wrapR', 'Screen distance', .55, 1, .8), range('cover', 'Screen size', .8, 1.4, 1.05, .01, {unit: '×'}),
      range('flatSize', 'Flat size', .6, 1.3, 1, .01, {unit: '×'}), range('ringR', 'Ring curve', .3, 2, 1, .01, {hint: 'how tightly the waiting screens curve round you'}), range('gapI', 'Gap', 0, .5, .12),
      G('Motion'), range('immerse', 'Time inside', .15, .45, .26), range('swell', 'Wrap time', .12, .3, .2), range('glideT', 'Glide time', .15, .35, .24),
      range('pan', 'Pan inside', 0, 1, .5), range('push', 'Push in', 0, 1, .5),
      G('Look'), range('edgeShade', 'Side shade', 0, .6, .3), off('glideBlur', 'Glide blur', 1)],
    layout(i, P, E){
      const n = E.n, D = E.D, F = E.p * n, gt = P.glideT, sw = P.swell, im = P.immerse;
      // one beat per photo: arrive and settle, wrap round the lens, inside, unwrap; the glide on overlaps the unwrap
      const free = Math.max(.04, 1 - gt * .5 - 2 * sw - im), a1 = free * .55, a2 = a1 + sw, a3 = a2 + im, a4 = a3 + sw;
      const env = (q: number) => q >= 1 ? 0 : glide(q, a1, a2) - glide(q, a3, a4);
      const k = Math.floor(F), f = F - k, gl = glide(f, 1 - gt, 1), r = rel(i, k + gl, n), ar = ab(r);
      const fi = wrap(F - i, n), g = env(fi), G0 = env(f), near = Math.min(1, ar);
      // the ring: screens sit on a circle round the viewer, each curved with it
      const H0 = E.h * P.flatSize, W0 = H0 * 1.6, Rr = W0 * 2.6 / Math.max(.05, P.ringR), phi = r * W0 * (1 + P.gapI) / Rr;
      // the wrap: the screen grows to fill the frame at distance R and slides toward the lens, which ends at its arc's
      // centre; inside, the screen slowly closes in (push) and turns past you (pan)
      const R0 = D * P.wrapR, ins = clamp01((fi - a1) / Math.max(.01, a4 - a1)), R = R0 * (1 - P.push * .1 * ins);
      const H = lerp(H0, 2 * R0 / D * P.cover * Math.max(1, E.vy) ** 1.2, g), kap = lerp(1 / Rr, 1 / R, g);
      const x = Rr * Math.sin(phi), z = lerp(Rr * (1 - Math.cos(phi)), D - R, g) - G0 * .6 * near;
      const pan = P.pan * .2 * (2 * ins - 1) * g * (i % 2 ? -1 : 1);
      const m = M(T(0, 0, D), RY(pan), T(0, 0, -D), T(x, 0, z), RY(-phi * (1 - g)));
      return {m, w: H * 1.6, h: H, bend: -kap, o: (1 - smoother(1.2, 1.9, ar)) * (1 - .55 * G0 * near),
        b: 1 - P.edgeShade * near * (1 - g) * .8 - .25 * G0 * near, blur: P.glideBlur * Math.sin(PI * gl) * .4 * (1 - g), zBias: g * .1 - ar * .01};
    }},

  /* 49. Stamp: a full mosaic is restamped one photo at a time: each new photo drops from near the lens, eases down
     onto the old one with a soft press, a gentle ring ripples out through its neighbours, and the old photo slips
     away underneath; halfway round, the first set comes back the same way */
  {...NEW, id: 'stamp', name: 'Stamp', n: 12, aspect: 1, cardH: .5, dur: 12, fov: 32,
    desc: 'Photos stamp down one by one into a mosaic with a soft thud.',
    params: [G('Layout'), whole('cols', 'Columns', 2, 6, 4), whole('rows', 'Rows', 1, 5, 3), range('gGap', 'Gap', 0, .4, .06), off('messy', 'Messy', 1),
      seg('order', 'Order', {scatter: 'Scatter', rows: 'Rows', centre: 'Centre out'}, 'scatter'),
      G('Motion'), range('dropTime', 'Drop time', .06, .2, .12), range('stampSpan', 'Stamp pace', .25, .45, .34, .01, {hint: 'how much of each half-loop the wave of stamps takes'}),
      range('dropH', 'Drop height', .2, 1, .5), range('thud', 'Thud', 0, 1, .5), range('ripple', 'Ripple', 0, 1, .6), range('lean', 'Drop lean', 0, 1, .4),
      G('Look'), range('dropBlur', 'Drop blur', 0, 1, .4), range('dropShade', 'Shade on landing', 0, .6, .1)],
    fill(P, E){
      const C = Math.round(P.cols), Rr = Math.round(P.rows), N = C * Rr, pitch = E.w * (1 + P.gGap);
      const fit = Math.min(2 * E.vx * .9 / (C * pitch), 2 * E.vy * .86 / (Rr * pitch)), px: number[] = [], py: number[] = [], key: number[] = [];
      for (let j = 0; j < N; j++){ px.push((j % C - (C - 1) / 2) * pitch * fit); py.push(-(Math.floor(j / C) - (Rr - 1) / 2) * pitch * fit); }
      for (let j = 0; j < N; j++) key.push(P.order === 'rows' ? j : P.order === 'centre' ? Math.hypot(px[j], py[j]) + E.rnd(j, 5) * .01 : E.rnd(j, 4));
      const rank = new Array(N); [...key.keys()].sort((a, b) => key[a] - key[b] || a - b).forEach((j, r) => { rank[j] = r; });
      return {N, px, py, rank, fit, pf: pitch * fit, count: 2 * N};
    },
    layout(i, P, E){
      const {N, px, py, rank, fit, pf} = E, g = i >= N ? 1 : 0, j = i % N, dt = P.dropTime;
      // two sets take turns: set 1 stamps in over the first half, set 0 over the second; each lives half a loop
      const land = (gg: number, q: number) => (gg ? .03 : .53) + dt + P.stampSpan * (N > 1 ? rank[q] / (N - 1) : 0);
      const age = (gg: number, q: number) => wrap(E.p - land(gg, q) + dt, 1) - dt, a = age(g, j), life = .5;
      if (a > life + .07) return {o: 0, s: .001};
      const x = px[j], y = py[j], r1 = E.rnd(i, 6) - .5, r2 = E.rnd(i, 7) - .5;
      let z = 0, rx = 0, ry = 0, rz = P.messy * (E.rnd(i, 8) - .5) * .12, o = 1, blur = 0, b = 1, dx = 0, dy = 0, s = fit, bend = 0;
      if (a < 0){
        // the drop: a long ease down from near the lens that still arrives with a little weight
        const td = (a + dt) / dt, up = 1 - lerp(td * td, smoother(0, 1, td), .55);
        z = up * P.dropH * E.D * .7; o = smoother(0, .45, td); blur = P.dropBlur * up * .7;
        rx = P.lean * up * (.35 + r1 * .3); rz += P.lean * up * r2 * .6; dx = P.lean * up * r2 * .25; dy = P.lean * up * .12;
        // air under it: the photo bows as it falls and flattens as it meets the mosaic
        bend = -.9 * up * (1 - up) * 4 / E.w;
      } else {
        // the soft press: the fall carries on into a small dip that rebounds and settles, the photo spreading a touch
        const x1 = a / .16, press = Math.sin(PI * .9 * x1) * Math.exp(-2.6 * x1);
        z = -P.thud * .05 * press; s = fit * (1 + P.thud * .03 * press); bend = P.thud * .5 * press / E.w;
        b = 1 - P.dropShade * Math.exp(-a / .05);
        // covered by the next stamp: it slips back and fades out underneath
        const cov = smoother(life, life + .06, a); o = 1 - cov; z -= cov * .02;
        // ripple: every other landing sends a soft ring outward; a settled photo dips and tilts as it passes
        if (P.ripple > 0){
          let dz = 0, gx = 0, gy = 0;
          for (let q = 0; q < N; q++){ if (q === j) continue;
            for (let gg = 0; gg < 2; gg++){ const aq = age(gg, q); if (aq <= 0 || aq > .3) continue;
              const ex = x - px[q], ey = y - py[q], dist = Math.hypot(ex, ey) || 1, front = aq * 12 * pf;
              const w = Math.exp(-(((dist - front) / (pf * .9)) ** 2)) * Math.exp(-aq / .1) * sstep(0, .03, aq) * (1 - sstep(.2, .3, aq));
              dz -= w; gx += w * ex / dist; gy += w * ey / dist; } }
          const k = P.ripple * sstep(0, .04, a); z += k * .04 * dz; ry -= k * .12 * gx; rx += k * .12 * gy;
        }
      }
      return {x: x + dx, y: y + dy, z, rx, ry, rz, s, o, blur, b, bend, zBias: a < 0 ? .2 : .05 * (1 - a),
        img: g ? (j + Math.max(1, Math.floor(E.n / 2))) % E.n : j % E.n};
    }},

  ];
  return templates;
})());

export const CHOREOGRAPHY_F_TO_J_TEMPLATES: Template[] = [
  ...CHOREO_F_TEMPLATES,
  ...CHOREO_G_TEMPLATES,
  ...CHOREO_H_TEMPLATES,
  ...CHOREO_I_TEMPLATES,
  ...CHOREO_J_TEMPLATES,
];
