// Choreography, batch F (see tools/choreo2-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a lens, a sphere, a cylinder or a table are implied only by how the cards move.
import { TAU, clamp01, sstep, smoother, wrap, ease, lerp } from './math.js';
import { rel, stepU, wrapFade, M, T, RX, RY, RZ, frame3, P_EASE } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};

// 0 before a, 1 after b, eased between
const win = (p, a, b, ez = ease.inOutSine) => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
// soft bell: 1 at d = 0, falling smoothly to ~0 by d = r (zero slope at both ends, so nothing ever kinks)
const bell = (d, r) => { const t = clamp01(Math.abs(d) / Math.max(1e-4, r)); return 1 - t * t * t * (t * (t * 6 - 15) + 10); };
const gauss = (d, r) => Math.exp(-((d / Math.max(1e-4, r)) ** 2));
// error function (Abramowitz–Stegun 7.1.26), for the dock's integrated magnification
const erf = x => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
// Proximity Wave: the lens wanders a closed Lissajous loop (whole frequencies, so it is seamless)
const lensAt = (p, P, ax, ay) => [ax * Math.sin(TAU * p + .3), ay * Math.sin(TAU * Math.round(P.lensLoops) * p + 1.1)];
// Proximity Dock: where the focus is along the row (a slow glide back and forth, sine so the speed never jumps)
const dockFocus = (p, P, A) => A * Math.sin(TAU * p) * (1 + .12 * Math.sin(TAU * 2 * p) * P.wander);
// Flicker: continuous position through the pile: each beat riffles `per` cards, decelerating into a hold
const flickU = (p, P) => { const B = Math.round(P.beats), per = Math.round(P.riffle), c = p * B, k = Math.floor(c), f = c - k, run = 1 - P.rest;
  // zero speed at both ends; snap blends a gentle sine toward a quintic that races through the middle
  const t = clamp01(f / run);
  return (k + lerp(ease.inOutSine(t), ease.inOutQuint(t), P.snap)) * per; };
// Repel Field: the invisible sphere's centre on a closed path through the field
const sphereAt = (p, P, vx) => [vx * .62 * Math.sin(TAU * p), .48 * Math.sin(TAU * 2 * p + .7) * P.sphereRoam, -.35 + .55 * Math.cos(TAU * p) * P.sphereRoam];
export const CHOREO_F = [
  /* 1. Proximity Wave: a wall of photos; an invisible lens drifts over it and each card it nears lifts, swells and
     turns toward it, while its neighbours lean back and slide aside a little to make room */
  {...NEW, id: 'proximity-wave', name: 'Proximity Wave', n: 10, aspect: .8, cardH: .4, dur: 14, fov: 30,
    desc: 'An invisible lens drifts across a wall of photos; the ones it passes rise toward you and swell.',
    params: [G('Layout'), range('pitch', 'Spacing', 1, 1.6, 1.14, .01, {unit: '×'}), range('reach', 'Lens size', .3, 1.4, .7), range('camTilt', 'Camera tilt', -30, 30, 10, 1, {unit: '°'}),
      G('Motion'), range('lift', 'Lift', 0, 1.2, .8), range('swell', 'Swell', 0, 1.2, .75), range('lean', 'Lean to lens', 0, 1, .55), range('room', 'Make room', 0, 1, .5),
      whole('lensLoops', 'Lens path', 1, 3, 2, {hint: 'how many loops the lens draws up and down per cycle'}),
      G('Look'), range('cup', 'Card curve', 0, 1.5, .7), range('dimRest', 'Rest shade', 0, .5, .16), off('restBlur', 'Rest blur', 1)],
    fill(P, E){ const px = E.w * P.pitch, py = E.h * P.pitch, cols = Math.min(13, 2 * Math.ceil(E.vx / px * .92) + 1), rows = Math.min(9, 2 * Math.ceil(E.vy / py * .92) + 1);
      return {cols, rows, px, py, count: cols * rows}; },
    camera(P, E){ const a = P.camTilt * D2R, d = E.D * 1.04; return {eye: [0, -Math.sin(a) * d, Math.cos(a) * d], target: [0, 0, 0]}; },
    layout(i, P, E){
      const c = i % E.cols, r = Math.floor(i / E.cols), x0 = (c - (E.cols - 1) / 2) * E.px, y0 = ((E.rows - 1) / 2 - r) * E.py;
      const [lx, ly] = lensAt(E.p, P, Math.min(E.vx * .62, (E.cols - 1) / 2 * E.px * .8), Math.min(E.vy * .5, (E.rows - 1) / 2 * E.py * .7));
      const R = P.reach, dx = x0 - lx, dy = y0 - ly, d = Math.hypot(dx, dy), k = bell(d, R * 1.6), g = gauss(d, R * .55);
      // neighbours slide out from the lens, strongest on the ring just outside it, none under it or far away
      const push = P.room * .12 * R * Math.sin(PI * clamp01(d / (R * 1.6))) * (1 - g * .6), ux = d > 1e-4 ? dx / d : 0, uy = d > 1e-4 ? dy / d : 0;
      const x = x0 + ux * push, y = y0 + uy * push, z = P.lift * .5 * g - .04 * P.room * (k - g);
      // turn toward the lens: the face tilts its far side up toward where the lens is (falls off over the bell)
      const lean = P.lean * .55 * k * (1 - g * .5);
      return {x, y, z, ry: -Math.atan(dx / R) * lean, rx: Math.atan(dy / R) * lean, s: 1 + P.swell * .6 * g,
        bend: P.cup * .9 * g, bendY: P.cup * .4 * g, zBias: g * .02, b: 1 - P.dimRest * (1 - k), blur: P.restBlur * (1 - k) * .35, img: i % E.n};
    }},

  /* 2. Proximity Dock: one row, magnified like a dock under a gliding focus. The magnification is integrated along
     the row, so cards spread apart exactly as much as their neighbours grow and never overlap; the swell is a smooth
     bump in depth and every card tilts and bends to sit on it */
  {...NEW, id: 'proximity-dock', name: 'Proximity Dock', n: 9, aspect: .8, cardH: .36, dur: 12, fov: 30,
    desc: 'A row of curved photos magnifies like a dock as a focus glides back and forth.',
    params: [G('Layout'), range('gap', 'Gap', 0, .5, .12), range('base', 'Baseline', -.8, .4, -.42), range('camHigh', 'Camera height', -.4, 1, .2), range('camYaw', 'Camera angle', -30, 30, 0, 1, {unit: '°'}),
      G('Motion'), range('mag', 'Magnify', 0, 2.5, 1.25, .01, {unit: '×'}), range('width', 'Swell width', .2, 1.2, .6), range('glide', 'Glide', .2, 1, .78, .01, {hint: 'how far along the row the focus travels'}),
      range('wander', 'Wander', 0, 1, .4),
      G('Look'), range('swellZ', 'Swell depth', 0, 1, .55), range('curve', 'Card curve', 0, 2, 1), range('dimRest', 'Rest shade', 0, .5, .12)],
    fill(P, E){ const pitch = E.w * (1 + P.gap), half = E.vx + E.w * (P.mag + 1); return {pitch, count: 2 * Math.ceil(half / pitch) + 1}; },
    camera(P, E){ const a = P.camYaw * D2R, d = E.D * 1.02; return {eye: [Math.sin(a) * d, P.camHigh * .9 + P.base * .4, Math.cos(a) * d], target: [0, P.base * .4 + .02, 0]}; },
    layout(i, P, E){
      const N = E.count, pitch = E.pitch, b = (i - (N - 1) / 2) * pitch, sig = P.width * .9;
      const f = dockFocus(E.p, P, P.glide * Math.min(E.vx * .78, (N - 1) / 2 * pitch * .6));
      // position: the row's own length grows by the magnification it passes over
      const m = P.mag * gauss(b - f, sig), x = b + P.mag * sig * Math.sqrt(PI) / 2 * erf((b - f) / sig);
      const s = 1 + m;
      // the swell as a depth bump z(x): tilt to its slope, bend to its curvature (convex on top)
      const A = P.swellZ * .35, g = gauss(b - f, sig), slope = -2 * (b - f) / (sig * sig) * A * g, curv = A * g * (4 * (b - f) ** 2 / sig ** 4 - 2 / sig ** 2);
      return {x, y: P.base + (s - 1) * E.h / 2, z: A * g, s, ry: -Math.atan(slope) * .8, bend: P.curve * (.25 - curv * .5) / s, zBias: g * .02,
        b: 1 - P.dimRest * (1 - g), img: ((i - Math.floor(N / 2)) % E.n + E.n) % E.n};
    }},

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
    fill: (P, E) => ({count: Math.round(P.beats) * Math.round(P.riffle)}),
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
    fill: (P, E) => { const k = Math.max(1, Math.ceil(13 / E.n)); return {count: E.n * k}; },
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
