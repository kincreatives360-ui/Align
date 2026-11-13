// Choreography, batch G (see tools/choreo2-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a slide, a stack or a sphere is implied only by how the cards move and where they
// sit. Cards curve in 3D (bend / bendY = curvature, 1/radius) to follow the shapes they ride.
import { TAU, clamp01, sstep, smoother, wrap, ease, lerp } from './math.js';
import { stepU, frame3, P_EASE } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};

// 0 before a, 1 after b, eased between
const win = (p, a, b, ez = ease.inOutCubic) => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rotY3 = (v, a) => { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; };
// rotate v about the unit axis k by angle a (Rodrigues)
const rotV = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d]; };
// a soft limit: linear for small values, easing into ±m (no clipped corners in the bend)
const soft = (v, m) => m * Math.tanh(v / m);

/* ---------- Slide: an S-shaped chute that swings through the frame and pitches toward you, with an arc-length table ---------- */
const slideCache = {key: ''};
function slidePath(P, E){
  const key = [P.swingS, P.turnsS, P.reach, P.drop, E.asp.toFixed(3)].join();
  if (slideCache.key === key) return slideCache;
  const ax = P.swingS * .8 * Math.min(1.3, Math.max(.75, E.asp / 1.25)), nT = P.turnsS, hy = P.drop;
  // u in [0,1]: steadily down the frame, swinging side to side (narrowing as it nears you), pitching toward you ever faster
  const C = u => [-ax * Math.cos(PI * nT * u) * (1 - .25 * u), hy * (.52 - 1.08 * u), -1.15 + P.reach * 1.75 * Math.pow(u, 1.5)];
  const N = 900, us = [], S = [0];
  let prev = C(0);
  for (let k = 1; k <= N; k++){ const c = C(k / N); S.push(S[k - 1] + Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2])); prev = c; }
  return Object.assign(slideCache, {key, C, N, S, L: S[N]});
}
// u at arc length s (binary search in the table)
function slideU(sp, s){
  let lo = 0, hi = sp.N; s = Math.max(0, Math.min(sp.L, s));
  while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (sp.S[mid] <= s) lo = mid; else hi = mid; }
  return (lo + (s - sp.S[lo]) / Math.max(1e-9, sp.S[hi] - sp.S[lo])) / sp.N;
}

/* ---------- Pulse Grid: a periodic soft peak (von Mises), with its first and second derivatives in beat time ---------- */
// exactly periodic in t with period 1, smooth to every order; sd ≈ sg for small sg. Returns [value, d/dt, d²/dt²]
function vm(t, sg){
  const k = 1 / ((TAU * sg) ** 2), th = TAU * t, c = Math.cos(th), s = Math.sin(th), v = Math.exp(k * (c - 1));
  return [v, -v * k * s * TAU, v * TAU * TAU * (k * k * s * s - k * c)];
}

export const CHOREO_G = [
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
      const n = E.n, h = n / 2, u = stepU(E.p, n, P.rest, ease[P.ease] || ease.inOutCubic);
      // r: 0 the hero, > 0 the left fan (still to come), < 0 the right fan (already shown); ±n/2 is the hidden crossover
      const r = wrap(i - u + h, n) - h, ar = Math.abs(r), side = r > 0 ? -1 : 1, A = P.stackAngle * D2R, w = E.w;
      const fw = Math.min(1.15, Math.max(.8, E.asp / 1.25)), x1 = (w * .5 + w * .5 * Math.cos(A) + .1 + P.stackGap) * fw, Zh = .3;
      // a fan slot (k >= 1, continuous): further out and back with depth, turned toward the centre, fanned open, shaded
      const slot = k => { const j = k - 1; return {x: side * (x1 + j * P.layer * .9), y: -.015 * j, z: -.32 - j * P.layer * .9, ry: -side * A,
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
    camera: (P, E) => ({eye: [P.camSide * .9, .3 + P.camHigh, 3.9], target: [P.camSide * .1, -.05, -.4]}),
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
    fill: (P, E) => { const cols = Math.round(P.cols), rowsG = Math.round(P.rowsG); return {cols, rowsG, count: cols * rowsG}; },
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
    fill: (P, E) => { const colsW = Math.round(P.colsW), rowsW = Math.round(P.rowsW); return {colsW, rowsW, count: colsW * rowsW}; },
    camera(P, E){
      const W = E.w * (1 + P.gapW) * Math.round(P.colsW), km = TAU * P.cover / W, Rm = 1 / km, g = win(E.p, .2, .38, ease.inOutSine) - win(E.p, .62, .8, ease.inOutSine);
      const zw = -Rm + Rm * E.D / .62;
      return {eye: [0, .12 * g, lerp(E.D, lerp(E.D, zw, P.dolly), g)], target: [0, 0, -Rm * g]};
    },
    layout(i, P, E){
      const cols = E.colsW, rows = E.rowsW, c = i % cols, r = Math.floor(i / cols), ez = ease[P.ease] || ease.inOutCubic, p = E.p;
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
        const rot = v => { const a = rotY3(v, spin), c2 = Math.cos(tl), s2 = Math.sin(tl); return [a[0], a[1] * c2 - a[2] * s2, a[1] * s2 + a[2] * c2]; };
        N = rot(N); X = rot(X); pos = [N[0] * R, N[1] * R, N[2] * R - R];
      }
      // near the poles the cards shrink with the circle of latitude, so neighbours keep touching rather than overlapping
      const s = Math.cos(gy * TAU * P.cover / W * Wi) * .985 + .015;
      const m = frame3(pos[0], pos[1], pos[2], X, N);
      return {m, s, bend: TAU * P.cover / W * Wi * P.hug, bendY: TAU * P.cover / W * Wi * P.hug, b: 1 - P.backShade * clamp01(.5 - .5 * N[2]) * Wi, img: i % E.n};
    }},
];
