// Signature templates (modelled on reference reels) and more gallery motion. Same contract as templates.js:
// layout(i, P, E) places card i for the loop phase E.p in [0,1), and every value is periodic in E.p.
import { TAU, clamp01, sstep, wrap, ease, lerp, loopDelta } from './math.js';
import { rel, stepU, stepSpeed, ab, sgn, wrapFade, fillSlots, stripFill, M, T, RX, RY, RZ, frame3,
  P_EASE, P_GAP, P_COLS } from './kit.js';

export const Y_CATEGORIES = [['signature', 'Signature']];

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const turns = (key = 'whirl', label = 'Turns', def = 1) => whole(key, label, -3, 3, def, {unit: '×', hint: 'whole turns per loop, so it stays seamless'});
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const G = group => ({group});
const NEW = {isNew: true, set: 'photos', frame: '5:4'};
// a seeded shuffle of 0..n-1 that doesn't depend on the media seed
function shuffled(n, seed){
  let s = (seed * 2654435761) >>> 0; const r = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const a = Array.from({length: n}, (_, i) => i);
  for (let i = n - 1; i > 0; i--){ const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

/* ===================== Signature ===================== */
// Film Roll: the strip's centre line, sampled by arc length — an S-curve rising from near the camera into
// a roll that winds backwards round a horizontal axis, a little tighter each turn
function rollPath(P, E){
  const pts = [], sway = P.sway, r0 = P.roll, dr = Math.max(.014, (P.thick || 0) * Math.min(E.w, E.h) * 1.1) * P.layerGap, top = .42, fl = P.flutter * .22, ph = TAU * E.p * 2;
  // the loose end flutters in whole waves per loop; the roll end stays put
  const xs = v => .62 * sway * Math.sin(PI * (P.snake * v + .15)) - .12 + fl * Math.sin(ph - v * 5) * (1 - v);
  for (let k = 0; k <= 96; k++){ const v = k / 96; pts.push([xs(v), lerp(top - 2.72 * P.reach, top, v), 1.5 * (1 - v) * (1 - v) * P.reach, 0]); }
  const x1 = xs(1), turnsN = 4.5, steps = Math.round(turnsN * 56);
  for (let k = 1; k <= steps; k++){
    const f = k / steps * turnsN * TAU, r = Math.max(.03, r0 - dr * f / TAU);
    pts.push([x1, top + r * Math.sin(f), -r0 + r * Math.cos(f), 1 / r]);
  }
  const S = [0];
  for (let k = 1; k < pts.length; k++){ const a = pts[k - 1], b = pts[k]; S.push(S[k - 1] + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])); }
  return {pts, S, L: S[S.length - 1], entry: S[96]};
}
function along(path, s){
  const {pts, S} = path; let lo = 0, hi = S.length - 1;
  while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (S[mid] <= s) lo = mid; else hi = mid; }
  const a = pts[lo], b = pts[hi], t = (s - S[lo]) / Math.max(1e-6, S[hi] - S[lo]), l = Math.max(1e-6, S[hi] - S[lo]);
  return {p: [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)], t: [(b[0] - a[0]) / l, (b[1] - a[1]) / l, (b[2] - a[2]) / l], k: lerp(a[3], b[3], t)};
}
// Formations: where card i of N sits in each shape, as [x, y, scale, roll, layer]
const FORMS = [
  (i, N) => [0, 0, 2.6, 0, N - i],
  (i, N) => { const a = lerp(-1.25, 1.25, i / Math.max(1, N - 1)); return [Math.sin(a) * 1.02, .32 - Math.cos(a) * .7, 1.05, a * .5, i]; },
  (i, N) => { const c = i % 5, r = Math.floor(i / 5), rows = Math.ceil(N / 5); return [(c - 2) * .44, .62 - r * 1.24 / Math.max(1, rows - 1), 1.15, 0, r]; },
  (i, N, R) => [(R(1) - .5) * 2.1, (R(2) - .5) * 1.35, .42 + R(3) * .62, (R(4) - .5) * .35, R(5) * N],
  (i, N) => { const W = 1.02, H = .64, per = 4 * (W + H), u = i / N * per;
    const [x, y] = u < 2 * W ? [-W + u, H] : u < 2 * W + 2 * H ? [W, H - (u - 2 * W)] : u < 4 * W + 2 * H ? [W - (u - 2 * W - 2 * H), -H] : [-W, -H + (u - 4 * W - 2 * H)];
    return [x, y, .3, 0, i]; },
  (i, N) => { const cols = Math.max(2, Math.ceil(Math.sqrt(N * 1.5))), rows = Math.ceil(N / cols), c = i % cols, r = Math.floor(i / cols);
    return [(c - (cols - 1) / 2) * 2.05 / cols, ((rows - 1) / 2 - r) * 1.3 / rows, .2, 0, i]; },
  (i, N, R) => { const a = R(6) * TAU, d = Math.sqrt(R(7)) * .42; return [Math.cos(a) * d * 1.35, Math.sin(a) * d, .55 + R(8) * .45, (R(9) - .5) * .5, R(5) * N]; },
];

const SIGNATURE = [
  {...NEW, id: 'shelf', name: 'Record Shelf', cat: 'signature', n: 14, aspect: 1, cardH: .92, dur: 32, fov: 30,
    desc: 'Album sleeves stand edge-on along a shelf and lean toward the middle as they glide past.',
    params: [G('Layout'), range('pitch', 'Spacing', .12, .6, .2), off('centreGap', 'Centre gap', 1.5, {hint: 'sleeves part round the middle, like flicking through a crate'}), off('arc', 'Shelf curve', 1), off('sizeMix', 'Sleeve sizes', 1),
      G('Motion'), range('angle', 'Lean', 30, 89, 86, 1, {unit: '°'}), range('turnZone', 'Turn width', .3, 3, 1, .01, {unit: '×'}), off('pull', 'Pull out', 1),
      G('Look'), range('edgeBlur', 'Edge blur', 0, 1, .55), off('edgeDim', 'Edge dim', 1), off('edgeFade', 'Edge fade', 1)],
    fill: (P, E) => stripFill(E, E.vx + E.w * (1 + P.centreGap * .5), E.w * P.pitch),
    layout(i, P, E){
      const r = rel(i, E.p * E.n, E.m), x0 = r * E.w * P.pitch, x = x0 + P.centreGap * E.w * .5 * Math.tanh(x0 / (E.w * .3)), ex = ab(x) / E.asp;
      // faces turn toward the middle; right at the centre a sleeve is edge-on, so its flip from one side to the other never shows
      const ry = -sgn(x) * lerp(PI / 2, P.angle * D2R, sstep(0, E.w * .9 * P.turnZone, ab(x)));
      return {x, y: P.pull * E.h * .35 * (1 - sstep(0, E.w * 1.5, ab(x))), z: -P.arc * x * x * .25, ry, s: 1 - P.sizeMix * .35 * E.rnd(i % E.n, 4),
        blur: P.edgeBlur * sstep(.55, 1.15, ex), b: 1 - P.edgeDim * sstep(.3, 1.1, ex), o: wrapFade(r, E.m) * (1 - P.edgeFade * sstep(.5, 1.2, ex))};
    }},

  {...NEW, id: 'portal-ring', name: 'Spiral Portal', cat: 'signature', n: 18, aspect: 1.3, cardH: .3, dur: 15,
    desc: 'A spiral of screens rushes out of the distance and sweeps past the camera, ring after ring.',
    params: [G('Layout'), whole('rings', 'Rings', 1, 5, 3), range('radius', 'Radius', .5, 2, 1.02), range('open', 'Spiral', 0, 1, .4), range('tilt', 'Tilt', -1, 1, .32),
      off('twistStep', 'Ring offset', 1, {hint: 'each ring turns a little further than the last'}), range('depthLen', 'Tunnel depth', .4, 1.6, 1, .01, {unit: '×'}),
      G('Motion'), turns('whirl', 'Turns', 1), range('rush', 'Rush', -1, 1, 0, .01, {hint: 'below 0 rings arrive fast then ease; above 0 they creep then rush'}), range('veer', 'Veer', -1, 1, 0),
      G('Look'), range('faceIn', 'Face in', 0, 3, 1, .01, {unit: '×'}), off('fog', 'Fog', 1)],
    fill: (P, E) => ({count: E.n * Math.round(P.rings)}),
    layout(i, P, E){
      const R = Math.round(P.rings), j = Math.floor(i / E.n), s = i % E.n, u = Math.pow(wrap(j / R + E.p, 1), Math.pow(2, P.rush));
      // distance shrinks geometrically, so the ring approaches at a steady apparent speed
      const L = 22 * P.depthLen, dist = L * Math.pow(.3 / L, u), z = E.D - dist, cx = P.veer * (1 - u) * (1 - u) * 3;
      const a = (s / E.n + E.p * P.whirl) * TAU + j * (1.7 + P.twistStep * PI), rr = P.radius * (1 + P.open * (s / E.n - .5));
      const lx = Math.cos(a) * rr, y0 = Math.sin(a) * rr, y = y0 * Math.cos(P.tilt);
      return {x: lx + cx, y, z: z + y0 * Math.sin(P.tilt), ry: -lx * .22 * P.faceIn, rx: y * .12 * P.faceIn, b: 1 - P.fog * (1 - u) * .85, o: sstep(0, .12, u) * sstep(.35, 1.2, dist), img: i};
    }},

  {...NEW, id: 'icon-drum', name: 'Icon Drum', cat: 'signature', n: 12, aspect: 1, cardH: .58, dur: 24,
    style: {card: {radius: .24}},
    desc: 'Chunky rounded tiles packed round a turning drum, like an app dock rolled into a wheel.',
    params: [G('Layout'), P_GAP(.04), range('drumR', 'Drum size', .6, 2, 1, .01, {unit: '×'}), whole('rows', 'Rows', 1, 3, 1),
      G('Motion'), turns('whirl', 'Turns', 1), off('click', 'Tick', 1, {hint: 'the drum clicks round tile by tile'}), range('ringTilt', 'Wobble', -1, 1, 0), off('breathe', 'Breathe', 1),
      G('Look'), range('backDim', 'Back shade', 0, 1, .38), off('magnify', 'Magnify', 1), off('backBlur', 'Back blur', 1)],
    fill: (P, E) => ({count: E.n * Math.round(P.rows)}),
    layout(i, P, E){
      const n = E.n, j = Math.floor(i / n), s = i % n, rows = Math.round(P.rows), K = n * ab(Math.round(P.whirl));
      const R = Math.max(.4, n * E.w * (1 + P.gap) / TAU) * P.drumR * (1 + P.breathe * .15 * Math.sin(TAU * E.p * 2));
      const q = P.click && K ? lerp(E.p, stepU(E.p, K, .55, ease.inOutCubic) / K, P.click) : E.p, a = (s / n + q * P.whirl + (j % 2) * .5 / n) * TAU, c = Math.max(0, Math.cos(a));
      return {x: R * Math.sin(a), y: (j - (rows - 1) / 2) * E.h * (1 + P.gap) + P.ringTilt * R * .35 * Math.cos(a), z: R * Math.cos(a) - R, ry: a,
        s: 1 + P.magnify * .3 * c ** 4, b: 1 - P.backDim * (1 - c), blur: P.backBlur * (1 - c) * .6, img: i};
    }},

  {...NEW, id: 'crumple', name: 'Crumple Strip', cat: 'signature', n: 10, aspect: .78, cardH: .86, step: true, perCard: 1.6,
    desc: 'Posters slide along a row; each one scrunches into a ball of paper as it leaves the middle and smooths out as it arrives.',
    params: [G('Layout'), P_GAP(.03), range('crushAt', 'Crush point', .4, 3, 1, .01, {hint: 'how far from the middle a poster is fully crushed'}),
      G('Motion'), range('crush', 'Crumple', 0, 1, .75), range('shrink', 'Shrink', 0, .5, .1), range('sink', 'Push back', 0, 1, .12), off('drop', 'Drop', 1), range('roll', 'Roll', -1, 1, 0),
      range('twistR', 'Random twist', 0, 1.5, .45), off('recoil', 'Pop back', 1, {hint: 'a smoothed poster overshoots a little as it arrives'}),
      G('Look'), off('ballDim', 'Shade', .8)],
    fill: (P, E) => stripFill(E, E.vx, E.w * (1 + P.gap)),
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = rel(i, u, E.m), ar = ab(r), k = P.crush * sstep(.1, P.crushAt, ar), pop = P.recoil * sstep(0, .35, ar) * (1 - sstep(.35, 1, ar));
      return {x: r * E.w * (1 + P.gap), y: -P.drop * k * E.h * .45, z: -k * P.sink, s: (1 - P.shrink * k) * (1 + pop * .15),
        rz: (E.rnd(i % E.n, 3) - .5) * P.twistR * k - P.roll * r * k * .8, crumple: k, b: 1 - P.ballDim * k, o: wrapFade(r, E.m)};
    }},

  {...NEW, id: 'halo', name: 'Halo', cat: 'signature', n: 36, aspect: .78, cardH: .4, dur: 40,
    mods: {poseRz: -7},
    desc: 'A wide halo of front-facing cards circles slowly, the near side sweeping across the far side.',
    params: [G('Layout'), range('radius', 'Radius', .6, 2, 1.2), range('oval', 'Width', -.5, 1, 0), off('crown', 'Crown', 1), off('scatter', 'Scatter', 1), range('tilt', 'View angle', 0, 1.3, .5),
      G('Motion'), turns('whirl', 'Turns', 1), range('lean', 'Lean', 0, 1, .25), off('bob', 'Float', 1),
      G('Look'), range('backDim', 'Depth shade', 0, .45, .14), off('backBlur', 'Back blur', 1)],
    layout(i, P, E){
      const a = (i / E.n + E.p * P.whirl) * TAU, R = P.radius * (1 + P.scatter * .35 * (E.rnd(i, 4) - .5)), ca = Math.cos(a), x = R * Math.sin(a) * (1 + P.oval * .6), zr = R * ca;
      const y0 = P.crown * .22 * Math.cos(3 * a) + P.scatter * .3 * (E.rnd(i, 5) - .5) + P.bob * .08 * Math.sin(TAU * (2 * E.p + E.rnd(i, 6)));
      return {x, y: -zr * Math.sin(P.tilt) * .8 + y0, z: zr * Math.cos(P.tilt) - R * .35, ry: Math.sin(a) * P.lean, b: 1 - P.backDim * (1 - ca), blur: P.backBlur * (1 - ca) * .4};
    }},

  {...NEW, id: 'formations', name: 'Formations', cat: 'signature', n: 96, aspect: .8, cardH: .3, dur: 17,
    desc: 'A hundred small photos regroup: one card, a fanned arc, columns, a scatter, a frame, a dot grid, a cluster, and back to one.',
    params: [G('Shape'), range('formScale', 'Shape size', .5, 1.4, 1, .01, {unit: '×'}), off('depthMix', 'Depth', 1),
      G('Motion'), range('formHold', 'Hold', .1, .8, .42), range('stagger', 'Stagger', 0, .6, .35), {key: 'staggerBy', label: 'Stagger order', type: 'seg', options: {random: 'Random', sweep: 'Sweep', centre: 'Centre out'}, def: 'random'},
      range('lift', 'Lift', 0, 1.5, .25), range('swirl', 'Swirl', -1, 1, 0), whole('flips', 'Flips', 0, 2, 0, {unit: ' turns'}), P_EASE,
      G('Look'), off('flightBlur', 'Motion blur', 1)],
    layout(i, P, E){
      const N = E.n, K = FORMS.length, seg = E.p * K, k = Math.floor(seg) % K, f = seg - Math.floor(seg), R = j => E.rnd(i, 20 + j);
      const a = FORMS[k](i, N, R), b = FORMS[(k + 1) % K](i, N, R), sb = String(P.staggerBy);
      const ord = sb === 'sweep' ? i / Math.max(1, N - 1) : sb === 'centre' ? Math.min(1, Math.hypot(a[0], a[1]) / 1.25) : R(0);
      const hold = P.formHold, st = ord * P.stagger, start = hold + st * (1 - hold) * .5, len = (1 - hold) * (1 - P.stagger * .5);
      const t = E.ez(clamp01((f - start) / Math.max(1e-3, len))), mix = j => lerp(a[j], b[j], t), fly = Math.sin(PI * t);
      const sw = P.swirl * PI * fly, cs = Math.cos(sw), sn = Math.sin(sw), x0 = mix(0) * P.formScale, y0 = mix(1) * P.formScale;
      // cards lift toward the camera mid-flight, so crossing paths never z-fight
      return {x: x0 * cs - y0 * sn, y: x0 * sn + y0 * cs, z: fly * P.lift * R(10) + P.depthMix * (R(11) - .5) * 1.2, s: mix(2), rz: mix(3) + sw, ry: Math.round(P.flips) * TAU * t,
        blur: P.flightBlur * fly * .5, zBias: mix(4) * .002 + fly};
    }},

  {...NEW, id: 'film-roll', name: 'Film Roll', cat: 'signature', n: 16, aspect: 1.55, cardH: .3, dur: 22, frame: '4:5',
    mods: {poseRy: -40, poseRx: 14, offX: .22, offY: -.08},
    desc: 'A strip of photos unspools from a roll and snakes down toward the camera in an S-curve.',
    params: [G('Layout'), range('roll', 'Roll size', .12, .4, .22), range('layerGap', 'Roll looseness', .3, 3, 1, .01, {unit: '×'}), range('reach', 'Unroll length', .5, 1.4, 1, .01, {unit: '×'}),
      range('snake', 'Strip curl', .4, 2.5, 1.3), range('sway', 'Sway', 0, 1, .6), P_GAP(.03),
      G('Motion'), off('flutter', 'Flutter', 1), range('twist', 'Twist', -1, 1, 0, .01, {hint: 'the loose end turns over as it comes toward you'}),
      G('Look'), off('rollShade', 'Roll shade', .8), off('nearBlur', 'Near blur', 1)],
    fill(P, E){
      const path = rollPath(P, E), L = P.flutter ? rollPath({...P, flutter: 0}, E).L : path.L, m = E.n * Math.max(1, Math.min(14, Math.ceil(L / (E.h * (1 + P.gap)) / E.n)));
      return {path, m, count: m};
    },
    layout(i, P, E){
      const {path} = E, s = wrap((i - E.p * E.n) / E.m, 1) * path.L, q = along(path, s);
      const [tx, ty, tz] = q.t; let X = [1 - tx * tx, -tx * ty, -tx * tz], Z = [0, -tz, ty];
      if (P.twist){ const b = P.twist * PI * Math.max(0, 1 - s / path.entry), c = Math.cos(b), sn = Math.sin(b);
        const rot = v => [v[0] * c + (ty * v[2] - tz * v[1]) * sn, v[1] * c + (tz * v[0] - tx * v[2]) * sn, v[2] * c + (tx * v[1] - ty * v[0]) * sn]; X = rot(X); Z = rot(Z); }
      const pitch = path.L / E.m, o = sstep(0, pitch * 2, s) * sstep(path.L, path.L - pitch * 3, s);
      // on the roll, inner layers draw first so the outer turns cover them
      return {m: frame3(q.p[0], q.p[1], q.p[2], X, Z), bendY: q.k, o, b: 1 - P.rollShade * sstep(path.entry, path.entry + pitch * 6, s), blur: P.nearBlur * .6 * (1 - sstep(0, path.entry * .5, s)),
        zBias: -Math.max(0, s - path.entry) * .2, w: E.w, h: E.h * Math.min(1, pitch / (E.h * (1 + P.gap)))};
    }},

  {...NEW, id: 'glass-row', name: 'Glass Gallery', cat: 'signature', n: 10, aspect: .8, cardH: .86, step: true, perCard: 2,
    style: {glass: {on: true, mode: 'per', top: 0, bottom: 0, left: 1, right: 1, width: .34, refraction: .9, curve: 'panel', dispersion: .9, soften: .35, feather: 0, highlight: .35, bulge: .95, stretch: 0}},
    desc: 'A clean row of photos steps along while the frame edges bend them like thick liquid glass.',
    params: [G('Layout'), P_GAP(.06), off('arc', 'Curve', 1), range('slope', 'Slope', -1, 1, 0), range('sideTurn', 'Side turn', -1, 1, 0), off('sideDepth', 'Push back', 1),
      G('Motion'), off('focus', 'Centre zoom', 1), off('drift', 'Glide', 1, {hint: 'keeps the row drifting between steps'}), off('stretch', 'Speed stretch', 1),
      G('Look'), off('sideDim', 'Side dim', 1), off('mblur', 'Motion blur', 1)],
    fill: (P, E) => stripFill(E, E.vx * (1 + P.arc + P.sideDepth), E.w * (1 + P.gap)),
    layout(i, P, E){
      const u0 = stepU(E.p, E.n, E.hold, E.ez), u = P.drift ? lerp(u0, E.p * E.n, P.drift) : u0, r = rel(i, u, E.m), ar = ab(r), x = r * E.w * (1 + P.gap);
      const sp = P.stretch || P.mblur ? stepSpeed(E.p, E.n, E.hold, E.ez) : 0, g = sp / (sp + 3);
      return {x, y: P.slope * r * E.h * .18, z: -P.arc * x * x * .2 - P.sideDepth * Math.min(ar, 2) * .35, ry: -P.sideTurn * Math.tanh(r) * .7, s: 1 + P.focus * .2 * (1 - sstep(0, 1, ar)),
        b: 1 - P.sideDim * sstep(.4, 1.6, ar), blur: P.mblur * .5 * g, w: E.w * (1 + P.stretch * .4 * g), o: wrapFade(r, E.m)};
    }},

  {...NEW, id: 'twist-band', name: 'Twist Band', cat: 'signature', n: 18, aspect: 1.3, cardH: .4, dur: 30,
    mods: {poseRz: -9, poseRx: 6},
    desc: 'Rows of screens ride up a curved band that twists like a ribbon in the air.',
    params: [G('Layout'), P_COLS(3, 5), P_GAP(.06), range('curve', 'Curve', 0, 1.5, .75), off('colShift', 'Column offset', 1), range('snake', 'S-bend', -1, 1, 0),
      G('Motion'), range('twist', 'Twist', 0, 2.5, 1.15), range('twistRate', 'Twist rate', .3, 3, 1.1), whole('travel', 'Twist travel', -3, 3, 0, {unit: '×', hint: 'whole waves per loop, so it stays seamless'}),
      G('Look'), range('turnShade', 'Turn shade', 0, .6, .22), off('endFade', 'Edge fade', 1)],
    fill(P, E){
      const cols = Math.round(P.cols), base = Math.ceil(E.n / cols), pitch = E.h * (1 + P.gap), rows = fillSlots(E.vy + E.h * 2, pitch, base, cols);
      return {cols, base, rows, pitch, count: rows * cols};
    },
    layout(i, P, E){
      const c = i % E.cols, r = Math.floor(i / E.cols), v = wrap(r - E.p * E.base, E.rows) - E.rows / 2 + .5, y = v * E.pitch + P.colShift * (c - (E.cols - 1) / 2) * E.pitch * .5;
      const th = P.twist * Math.sin(y * P.twistRate + .4 - TAU * E.p * Math.round(P.travel)), xl = (c - (E.cols - 1) / 2) * E.w * (1 + P.gap), k = P.curve / 1.2;
      let x = xl, z = 0, ry = 0;
      if (k > .01){ const g = xl * k; x = Math.sin(g) / k; z = (Math.cos(g) - 1) / k; ry = g; }
      const ct = Math.cos(th), st = Math.sin(th);
      return {x: x * ct + z * st + P.snake * .35 * Math.sin(y * .9), y, z: -x * st + z * ct, ry: ry + th, bend: k, b: 1 - P.turnShade + P.turnShade * Math.cos(ry + th),
        o: clamp01((E.rows / 2 - ab(v)) * 1.2) * (1 - P.endFade * sstep(.35, 1, ab(y) / E.vy)), img: (r % E.base) * E.cols + c};
    }},

  {...NEW, id: 'flip-trio', name: 'Flip Trio', cat: 'signature', n: 8, aspect: .82, cardH: .78, step: true, perCard: 2.4,
    style: {glass: {on: true, mode: 'per', top: 0, bottom: 0, left: 1, right: 1, width: .2, refraction: .4, curve: 'wave', dispersion: .9, soften: .2, feather: 0, highlight: .3, bulge: .5, stretch: 2.2}},
    desc: 'Three cards step along; each one flips round as it takes the middle, while the frame edges smear into glass.',
    params: [G('Layout'), P_GAP(.32), range('sideDepth', 'Side depth', 0, 1, .12), off('sideScale', 'Side scale', .6), range('fan', 'Fan', -1, 1, 0),
      G('Motion'), range('flip', 'Flip', 0, 1.2, .85), {key: 'axis', label: 'Flip axis', type: 'seg', options: {y: 'Vertical', x: 'Horizontal', xy: 'Diagonal'}, def: 'y'},
      range('timing', 'Flip timing', .4, 2.5, 1, .01, {hint: 'above 1 the flip waits until the card is nearly centred'}), range('hop', 'Hop', -1, 1, 0),
      G('Look'), off('sideDim', 'Side dim', 1), off('sideBlur', 'Side blur', 1)],
    fill: (P, E) => stripFill(E, E.vx, E.w * (1 + P.gap)),
    layout(i, P, E){
      const r = rel(i, stepU(E.p, E.n, E.hold, E.ez), E.m), ar = ab(r), f = -sgn(r) * Math.pow(ar, P.timing) * PI * P.flip, ax = String(P.axis), e = sstep(0, 1.2, ar);
      return {x: r * E.w * (1 + P.gap), y: P.hop * E.h * .25 * ab(Math.sin(PI * r)), z: -ar * P.sideDepth, ry: ax === 'x' ? 0 : ax === 'xy' ? f * .75 : f, rx: ax === 'x' ? f : ax === 'xy' ? f * .75 : 0,
        rz: -P.fan * r * .25, s: 1 - P.sideScale * Math.min(ar, 1.5) * .4, b: 1 - P.sideDim * e, blur: P.sideBlur * e * .6, o: wrapFade(r, E.m)};
    }},
];

/* ===================== more motion ===================== */
const MORE = [
  {...NEW, id: 'pleats', name: 'Pleated Wall', cat: 'carousel', n: 16, aspect: .5, cardH: 1.05, dur: 34,
    desc: 'A panoramic wall of tall photos folded into pleats, curving round you as it glides past and breathes open.',
    params: [G('Layout'), range('fold', 'Fold', 0, 1.2, .62), range('curve', 'Curve', 0, 1, .5), range('spacing', 'Spacing', .7, 1.6, 1, .01, {unit: '×'}), off('jog', 'Height jog', 1),
      G('Motion'), range('breathe', 'Breathe', 0, 1, .55), whole('breaths', 'Breaths', 1, 4, 2, {unit: '×', hint: 'whole breaths per loop, so it stays seamless'}), off('ripple', 'Ripple', 1),
      G('Look'), range('foldShade', 'Fold shade', 0, .6, .16), off('sideDim', 'Edge dim', 1), off('sideBlur', 'Edge blur', 1)],
    fill: (P, E) => stripFill(E, E.vx * 1.6 + E.w, E.w * Math.cos(P.fold) * P.spacing),
    layout(i, P, E){
      const th = P.fold * (1 - P.breathe * .5 * (1 - Math.cos(E.p * TAU * Math.round(P.breaths)))), r = rel(i, E.p * E.n, E.m), s = r * E.w * Math.cos(th) * P.spacing;
      const tc = th + P.ripple * .45 * Math.sin(s * 1.6 - TAU * E.p * 2);
      // the pleat line runs along an arc that bows toward the camera at the sides
      let x = s, z = 0, a = 0;
      if (P.curve > .01){ const Rc = 2.6 / P.curve; a = s / Rc; x = Rc * Math.sin(a); z = Rc * (1 - Math.cos(a)) * .9; }
      const ex = ab(x) / E.asp;
      return {x, y: (i % 2 ? 1 : -1) * P.jog * E.h * .06, z: z - .25, ry: -a + (i % 2 ? -tc : tc), b: (i % 2 ? 1 - P.foldShade : 1) * (1 - P.sideDim * sstep(.4, 1.2, ex)),
        blur: P.sideBlur * .7 * sstep(.5, 1.3, ex), o: wrapFade(r, E.m)};
    }},

  {...NEW, id: 'domino-run', name: 'Domino Run', cat: 'kinetic', n: 18, aspect: .64, cardH: .5, dur: 8,
    mods: {poseRx: 12},
    desc: 'Photos stand like dominoes along an S-curve into the distance; a toppling wave runs down the line, then they stand back up.',
    params: [G('Layout'), range('sway', 'Curve', 0, 1, .6), whole('bends', 'Bends', 1, 3, 1), range('length', 'Length', 2, 6, 3.6), off('messy', 'Wobble', 1),
      G('Motion'), range('wave', 'Wave', .2, .8, .5), range('topple', 'Topple', .2, 1, 1), range('fallTime', 'Fall time', .4, 3, 1, .01, {unit: '×'}), range('riseTime', 'Rise time', .4, 1.5, 1, .01, {unit: '×'}),
      G('Look'), off('fallShade', 'Fallen shade', .6), off('farBlur', 'Distance blur', 1)],
    layout(i, P, E){
      const n = E.n, B = Math.round(P.bends), at = t => [lerp(-1.05, 1.3, t) + P.sway * .5 * Math.sin(t * TAU * B), .8 - t * P.length];
      const t = i / Math.max(1, n - 1), [x, z] = at(t), [x2, z2] = at(t + .002), [x0, z0] = at(t - .002), [xn, zn] = at(t + 1 / Math.max(1, n - 1));
      const ry = Math.atan2(x2 - x0, z2 - z0) + P.messy * (E.rnd(i, 1) - .5) * .6, gap = Math.hypot(xn - x, zn - z);
      // each one leans until it rests on the next; the last one falls flat
      const rest = i === n - 1 ? PI / 2 * .97 : Math.asin(Math.min(1, gap / E.h * .98));
      const u = wrap(E.p - t * P.wave, 1), a = rest * P.topple * ease.inCubic(sstep(0, .08 * P.fallTime, u)) * (1 - ease.inOutCubic(sstep(.62, .62 + .24 * P.riseTime, u)));
      // faces turn back toward the camera, and each one topples away from it, onto the next
      return {m: M(T(x, -.45, z), RY(ry + PI), RX(-a), T(0, E.h / 2, 0)), b: 1 - P.fallShade * a / (PI / 2), blur: P.farBlur * t * .6};
    }},

  {...NEW, id: 'crossfire', name: 'Crossfire', cat: 'carousel', n: 12, aspect: .8, cardH: .42, dur: 30,
    mods: {poseRx: 10},
    desc: 'Four lanes of photos cross in an X at different depths and stream past each other in opposite directions.',
    params: [G('Layout'), {key: 'lanes', label: 'Lanes', type: 'seg', options: {'2': 'Two', '4': 'Four'}, def: '4'}, P_GAP(.08), range('angle', 'Angle', 0, 45, 20, 1, {unit: '°'}),
      range('laneOff', 'Lane spread', .4, 1.6, .95), range('depth', 'Depth', 0, 1.5, .8), range('arc', 'Curve', 0, 1, .35),
      G('Motion'), off('ripple', 'Ripple', 1), range('lean', 'Lean', -1, 1, 0),
      G('Look'), off('laneDim', 'Back dim', .7), off('laneBlur', 'Back blur', 1)],
    fill(P, E){ const F = stripFill(E, Math.hypot(E.vx, E.vy) * 1.5, E.w * (1 + P.gap)); return {m: F.m, count: (String(P.lanes) === '2' ? 2 : 4) * F.m}; },
    layout(i, P, E){
      const lane = Math.floor(i / E.m), j = i % E.m, dir = lane % 2 ? -1 : 1, a = dir * P.angle * D2R, off = (lane < 2 ? 0 : (lane % 2 ? P.laneOff : -P.laneOff));
      const r = rel(j, dir * E.p * E.n, E.m), d = r * E.w * (1 + P.gap), z = -lane * P.depth * .5 - P.arc * d * d * .12;
      const pr = off + P.ripple * .18 * Math.sin(d * 2.2 - TAU * E.p * 2), ln = lane / 3;
      return {x: d * Math.cos(a) - pr * Math.sin(a), y: d * Math.sin(a) + pr * Math.cos(a), z, rz: a, ry: -P.arc * d * .25 + P.lean * dir * .5, b: 1 - P.laneDim * ln, blur: P.laneBlur * ln * .6,
        o: wrapFade(r, E.m), img: j + lane * 3};
    }},

  {...NEW, id: 'arches', name: 'Arch Gates', cat: 'ring', n: 14, aspect: .8, cardH: .3, dur: 18,
    desc: 'Glide through a corridor of arches built from photos; each gate opens round you as you pass.',
    params: [G('Layout'), whole('gates', 'Arches', 2, 7, 5), range('radius', 'Radius', .7, 1.8, 1.15), P_GAP(.06), range('spacing', 'Spacing', 1, 4, 2.2),
      range('span', 'Span', 120, 300, 180, 1, {unit: '°'}), range('tall', 'Height', .6, 1.6, 1, .01, {unit: '×'}), off('gateTwist', 'Twist', 1, {hint: 'each gate turns a little further round the corridor'}),
      G('Motion'), off('open', 'Open up', 1), range('roll', 'Roll', -1, 1, 0),
      G('Look'), off('fog', 'Fog', 1)],
    fill(P, E){ const A = Math.round(P.gates), c = Math.max(5, Math.ceil(PI * P.radius * (P.span / 180) * Math.max(1, P.tall) / (E.w * (1 + P.gap))) + 1); return {A, c, count: A * c}; },
    layout(i, P, E){
      const j = Math.floor(i / E.c), s = i % E.c, u = wrap(j / E.A + E.p, 1), Z = E.A * P.spacing, z = lerp(-Z + 1.5, 1.5, u);
      const sp = P.span / 180 * PI, a = sp * s / (E.c - 1) + (PI - sp) / 2, R = P.radius * (1 + P.open * .6 * sstep(-1.5, 1.5, z));
      const g = j * P.gateTwist * 1.2 + P.roll * Math.sin(PI * u) * PI * .5, lx = Math.cos(a) * R, ly = Math.sin(a) * R * P.tall, cg = Math.cos(g), sg = Math.sin(g);
      return {x: lx * cg - ly * sg, y: -.7 + lx * sg + ly * cg, z, rz: a - PI / 2 + g, b: 1 - P.fog * (1 - u) * .85, o: sstep(0, .2, u) * (1 - sstep(E.D - 1.6, E.D - .6, z)) * (1 - sstep(.9, 1, u)), img: j * E.c + s};
    }},

  {...NEW, id: 'deck-dive', name: 'Deck Dive', cat: 'stack', n: 10, aspect: .8, cardH: .8, step: true, perCard: 1.5,
    mods: {poseRy: -24, poseRx: 6},
    desc: 'A deep stack of photos marches forward; the front card lifts off and sails past the camera to reveal the next.',
    params: [G('Layout'), range('depth', 'Depth', .15, .7, .38), range('rise', 'Rise', 0, .2, .07), range('drift', 'Sideways', -1, 1, .3), range('fan', 'Fan', -1, 1, 0), range('messy', 'Messy', 0, .5, .05),
      G('Motion'), range('lift', 'Lift off', 0, 2, 1.1), range('throwAngle', 'Throw angle', -180, 180, 0, 1, {unit: '°'}), range('tumble', 'Tumble', 0, 3, .9),
      G('Look'), range('stackDim', 'Depth dim', 0, .12, .05, .005), range('stackBlur', 'Depth blur', 0, .12, .035, .005)],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), s = wrap(i - u + 1, n) - 1;
      if (s < 0){ const e = -s, k = ease.inCubic(e), c = Math.cos(P.throwAngle * D2R), sn = Math.sin(P.throwAngle * D2R), fx = -.8 * c - 1.9 * sn, fy = -.8 * sn + 1.9 * c;
        return {x: -.25 + k * fx * P.lift, y: k * fy * P.lift, z: k * 1.6 * P.lift, rx: -k * P.tumble, rz: (E.rnd(i, 1) - .5) * k * .6, o: 1 - sstep(.55, 1, e), zBias: 50}; }
      const fadeIn = 1 - sstep(n - 1.6, n - 1, s);
      return {x: s * P.depth * P.drift - .25, y: s * P.rise - .08, z: -s * P.depth, rz: (E.rnd(i, 2) - .5) * P.messy * Math.min(1, s) + P.fan * s * .08,
        b: 1 - Math.min(.35, s * P.stackDim), blur: s * P.stackBlur, o: fadeIn, zBias: -s};
    }},

  {...NEW, id: 'counter-cols', name: 'Counter Columns', cat: 'stack', n: 15, aspect: .8, cardH: .5, dur: 26,
    mods: {poseRx: 14, poseRy: -12, poseRz: 10},
    desc: 'Columns of photos wrapped round a drum scroll in opposite directions, like a wall of departure boards.',
    params: [G('Layout'), P_COLS(5, 8), P_GAP(.06), range('curve', 'Curve', 0, 1.2, .55), off('vCurve', 'Roll curve', 1), off('colShift', 'Column offset', 1), off('split', 'Depth split', 1),
      G('Motion'), whole('pace', 'Counter pace', 0, 3, 1, {unit: '×', hint: 'how fast the odd columns run the other way'}), off('tick', 'Tick', 1, {hint: 'columns click along a row at a time, like a flap board'}),
      G('Look'), off('edgeDim', 'Edge dim', 1), off('edgeBlur', 'Edge blur', 1)],
    fill(P, E){
      const cols = Math.round(P.cols), base = Math.ceil(E.n / cols), pitch = E.h * (1 + P.gap), m = fillSlots(E.vy * 1.4 + E.h, pitch, base, cols);
      return {cols, base, m, pitch, count: m * cols};
    },
    layout(i, P, E){
      const c = i % E.cols, r = Math.floor(i / E.cols), odd = c % 2, q = P.tick ? lerp(E.p, stepU(E.p, E.base, .55, ease.inOutCubic) / E.base, P.tick) : E.p;
      const v = wrap(r + (odd ? -Math.round(P.pace) : 1) * q * E.base, E.m) - E.m / 2 + .5, y0 = v * E.pitch + P.colShift * odd * E.pitch * .5;
      const xl = (c - (E.cols - 1) / 2) * E.w * (1 + P.gap), k = P.curve / 2.2, ky = P.vCurve * .45;
      let x = xl, z = 0, ry = 0, y = y0, rx = 0;
      if (k > .01){ const g = xl * k; x = Math.sin(g) / k; z = (Math.cos(g) - 1) / k; ry = g; }
      if (ky > .01){ const g = y0 * ky; y = Math.sin(g) / ky; z += (Math.cos(g) - 1) / ky; rx = -g; }
      const e = sstep(.25, 1, ab(y0) / E.vy);
      return {x, y, z: z + (odd ? -1 : 1) * P.split * .25, rx, ry, bend: k, b: 1 - P.edgeDim * e, blur: P.edgeBlur * e * .6, o: clamp01((E.m / 2 - ab(v)) * 1.2), img: (r % E.base) * E.cols + c};
    }},

  {...NEW, id: 'silk', name: 'Silk Ribbon', cat: 'carousel', n: 14, aspect: .8, cardH: .5, dur: 24,
    mods: {poseRz: -12, offY: -.22},
    desc: 'A ribbon of photos ripples and rolls over like silk in the wind as it streams across the frame.',
    params: [G('Layout'), P_GAP(.02), range('freq', 'Frequency', .5, 3, 1.35),
      G('Motion'), range('amp', 'Wave', 0, 1, .8), whole('waves', 'Waves', 1, 4, 2, {unit: '×'}), range('depthW', 'Depth', 0, 1.2, .5), range('roll', 'Roll', 0, 1.5, .75), off('flutter', 'Flutter', 1), range('curl', 'Card curl', 0, 2, .8),
      G('Look'), range('sheen', 'Sheen', 0, .5, .14), off('troughBlur', 'Trough blur', 1)],
    fill: (P, E) => stripFill(E, E.vx * 1.3 + E.w, E.w * (1 + P.gap)),
    layout(i, P, E){
      const r = rel(i, E.p * E.n, E.m), x = r * E.w * (1 + P.gap), k = P.freq, ph = x * k - E.p * TAU * P.waves, A = P.amp, fl = P.flutter * Math.sin(2 * ph + 1);
      return {x, y: Math.sin(ph) * .3 * A + fl * .12, z: Math.cos(ph) * P.depthW * A - .2, ry: Math.atan(Math.sin(ph) * k * .5 * A), rx: Math.sin(ph) * P.roll + fl * .35,
        bend: Math.cos(ph) * k * k * .5 * A * P.curl, b: 1 - P.sheen + P.sheen * Math.cos(ph), blur: P.troughBlur * (1 - Math.cos(ph)) * .3, o: wrapFade(r, E.m)};
    }},

  {...NEW, id: 'grid-zoom', name: 'Grid Zoom', cat: 'stack', n: 12, aspect: .8, cardH: .4, dur: 28,
    desc: 'The camera dives into one photo of a grid until it fills the frame, pulls back, then dives into the next.',
    params: [G('Layout'), P_COLS(4, 6), P_GAP(.1), range('fill', 'Fill', .6, 1.2, .94), range('overview', 'Overview zoom', .6, 1.4, 1, .01, {unit: '×'}),
      G('Motion'), range('gridHold', 'Grid pause', 0, .25, .04), {key: 'route', label: 'Order', type: 'seg', options: {in: 'In order', shuffle: 'Shuffled'}, def: 'in'}, range('swing', 'Swing', -1, 1, 0), P_EASE,
      G('Look'), range('dimOthers', 'Dim others', 0, 1, .4), off('blurOthers', 'Blur others', 1)],
    layout(i, P, E){
      const n = E.n, cols = Math.round(P.cols), rows = Math.ceil(n / cols), pos = j => [(j % cols - (cols - 1) / 2) * E.w * (1 + P.gap), ((rows - 1) / 2 - Math.floor(j / cols)) * E.h * (1 + P.gap)];
      const seg = E.p * n, kk = Math.floor(seg) % n, l = seg - Math.floor(seg), Zf = 2 * P.fill / E.h, ov = P.overview, ord = String(P.route) === 'shuffle' ? shuffled(n, 7) : null;
      const k = ord ? ord[kk] : kk, k2 = ord ? ord[(kk + 1) % n] : (kk + 1) % n;
      // per step: pull back from photo k, hold the grid a beat, dive into the next photo and hold
      const out = E.ez(sstep(0, .22, l)), inn = E.ez(sstep(.3 + P.gridHold, .56 + P.gridHold, l)), pk = pos(k), pn = pos(k2);
      const zoom = l < .3 ? lerp(Zf, ov, out) : lerp(ov, Zf, inn), f = l < .3 ? [lerp(pk[0], 0, out), lerp(pk[1], 0, out)] : [lerp(0, pn[0], inn), lerp(0, pn[1], inn)];
      const focus = l < .3 ? (i === k ? 1 - out : 0) : (i === k2 ? inn : 0), [gx, gy] = pos(i), dim = (zoom - ov) / (Zf - ov);
      const g = P.swing * .5 * (1 - dim), cg = Math.cos(g), sg = Math.sin(g), X = (gx - f[0]) * zoom, Y = (gy - f[1]) * zoom;
      return {x: X * cg - Y * sg, y: X * sg + Y * cg, rz: g, s: zoom, b: 1 - P.dimOthers * dim * (1 - focus), blur: P.blurOthers * dim * (1 - focus) * .6, zBias: focus};
    }},

  {...NEW, id: 'mood-board', name: 'Mood Board', cat: 'gallery', n: 14, aspect: .8, cardH: .44, dur: 48,
    desc: 'A dense collage of photos on three depth layers drifts past with deep parallax and a soft focus falloff.',
    params: [G('Layout'), range('spacing', 'Spacing', .25, .8, .42), range('spanY', 'Height', .5, 2.5, 1.5), range('scatter', 'Scatter', 0, 1, .6), range('sizeMix', 'Size mix', 0, 1, .45),
      range('depth', 'Parallax', 0, 1, .7), off('turn', '3D scatter', 1),
      G('Motion'), range('float', 'Float', 0, .3, .06), whole('floatN', 'Float speed', 1, 4, 2, {unit: '×'}),
      G('Look'), range('dof', 'Depth blur', 0, 1, .55), off('farDim', 'Depth dim', 1)],
    fill: (P, E) => stripFill(E, E.vx * (1 + P.depth * 1.4) + E.w, E.w * P.spacing),
    layout(i, P, E){
      const k = i % E.n, r = rel(i, E.p * E.n, E.m), R = j => E.rnd(k, j), L = R(3), z = (L < .34 ? -1.8 : L < .68 ? -.7 : .45) * P.depth;
      return {x: r * E.w * P.spacing, y: (R(1) - .5) * P.spanY + Math.sin(TAU * (E.p * Math.round(P.floatN) + R(5))) * P.float, z, rz: (R(4) - .5) * .35 * P.scatter, ry: P.turn * (R(6) - .5) * 1.2,
        s: .7 + R(2) * P.sizeMix, blur: Math.min(.6, ab(z) * .28 * P.dof), b: 1 - P.farDim * clamp01(-z / 1.8) * .6, o: wrapFade(r, E.m), zBias: z};
    }},

  {...NEW, id: 'deal', name: 'Deal', cat: 'stack', n: 12, aspect: .8, cardH: .44, dur: 11,
    mods: {poseRx: 24},
    style: {card: {back: 'solid', backColor: '#17171b'}},
    desc: 'Cards flip off a deck and land face-up in a grid, hold a moment, then fly back into the deck.',
    params: [G('Layout'), P_COLS(4, 6), P_GAP(.1), {key: 'deckPos', label: 'Deck', type: 'seg', options: {bl: 'Left', c: 'Centre', br: 'Right'}, def: 'bl'}, off('messy', 'Messy grid', 1),
      G('Motion'), range('arc', 'Arc', 0, 1.5, .7), range('dealSpan', 'Deal stagger', 0, .3, .3), range('flight', 'Flight time', .4, 1, 1, .01, {unit: '×'}), range('flipAmt', 'Flip', 0, 2, 1, .01, {unit: '×'}),
      range('toss', 'Toss spin', 0, 1.5, .5),
      G('Look'), off('deckShade', 'Deck shade', .8)],
    layout(i, P, E){
      const n = E.n, cols = Math.round(P.cols), rows = Math.ceil(n / cols), c = i % cols, r = Math.floor(i / cols), w = P.dealSpan / n, ft = .13 * P.flight, dp = String(P.deckPos);
      const t = sstep(.02 + i * w, .02 + ft + i * w, E.p) * (1 - sstep(.56 + (n - 1 - i) * w, .56 + ft + (n - 1 - i) * w, E.p)), e = E.ez(t), lift = Math.sin(PI * e);
      const gx = (c - (cols - 1) / 2) * E.w * (1 + P.gap) + P.messy * (E.rnd(i, 3) - .5) * E.w * .3, gy = ((rows - 1) / 2 - r) * E.h * (1 + P.gap) + P.messy * (E.rnd(i, 5) - .5) * E.h * .2;
      const dx = dp === 'c' ? 0 : (dp === 'br' ? 1 : -1) * E.asp * .95, dy = -.85;
      return {x: lerp(dx, gx, e), y: lerp(dy, gy, e), z: lift * P.arc * .7 + (1 - e) * (n - i) * .004, ry: (1 - e) * PI * P.flipAmt,
        rz: (1 - e) * .25 + lift * (E.rnd(i, 2) - .5) * P.toss + P.messy * (E.rnd(i, 4) - .5) * .35 * e, b: 1 - P.deckShade * (1 - e), zBias: (1 - e) * (n - i) * .01 + lift};
    }},

  {...NEW, id: 'page-fan', name: 'Page Fan', cat: '3d', n: 12, aspect: .78, cardH: .9, dur: 10,
    mods: {poseRx: 18},
    desc: 'Photos hinged on one spine fan open like the pages of a book, while a ripple runs through them.',
    params: [G('Layout'), range('spread', 'Spread', .2, 1, .85), range('droop', 'Droop', -.6, .6, 0), range('stair', 'Stair', -1, 1, 0), range('curl', 'Page curl', 0, 1, .3),
      G('Motion'), range('ripple', 'Ripple', 0, .8, .35), whole('ripN', 'Ripple count', 1, 3, 1, {unit: '×'}), off('breathe', 'Breathe', 1, {hint: 'the fan closes a little and opens again each loop'}),
      G('Look'), range('pageShade', 'Page shade', 0, .6, .2), off('outerBlur', 'Outer blur', 1)],
    layout(i, P, E){
      const n = E.n, N = Math.round(P.ripN), sp = P.spread * (1 - P.breathe * .35 * (1 - Math.cos(TAU * E.p)));
      const base = lerp(PI / 2 - sp * PI * .46, PI / 2 + sp * PI * .46, i / Math.max(1, n - 1)), th = base + P.ripple * .5 * Math.sin(TAU * (N * E.p - N * i / n));
      return {m: M(RY(-th), RZ(-P.droop), T(E.w / 2, P.stair * (i / Math.max(1, n - 1) - .5) * E.h * .3, 0)), bend: P.curl * .6, b: 1 - P.pageShade + P.pageShade * ab(Math.cos(th)),
        blur: P.outerBlur * .6 * clamp01(ab(th - PI / 2) / (PI * .46)), zBias: -ab(th - PI / 2)};
    }},

  {...NEW, id: 'lantern', name: 'Lantern Rings', cat: 'ring', n: 12, aspect: .8, cardH: .36, dur: 30,
    mods: {poseRx: 8},
    desc: 'Stacked rings of photos turn in alternating directions, like the bands of a paper lantern.',
    params: [G('Layout'), whole('rings', 'Rings', 2, 6, 4), P_GAP(.06), range('waist', 'Waist', 0, .6, .22), range('taper', 'Taper', -1, 1, 0), range('ringOffset', 'Ring offset', 0, 3.14, .4),
      G('Motion'), turns('whirl', 'Turns', 1), {key: 'turnMode', label: 'Rings turn', type: 'seg', options: {counter: 'Counter', same: 'Same way'}, def: 'counter'}, off('sway', 'Sway', 1),
      G('Look'), range('backShade', 'Back shade', 0, .8, .28), off('backBlur', 'Back blur', 1)],
    fill(P, E){ const L = Math.round(P.rings), c = E.n; return {L, c, count: L * c}; },
    layout(i, P, E){
      const j = Math.floor(i / E.c), s = i % E.c, v = j - (E.L - 1) / 2, R0 = Math.max(.5, E.c * E.w * (1 + P.gap) / TAU);
      // the middle rings bulge out, the outer ones tuck in, so the stack reads as one rounded lantern
      const R = R0 * (1 - P.waist * (v / Math.max(1, E.L / 2)) ** 2) * (1 + P.taper * .35 * v / Math.max(1, E.L / 2));
      const a = (s / E.c + (j % 2 && P.turnMode !== 'same' ? -1 : 1) * E.p * P.whirl) * TAU + j * P.ringOffset, c = Math.max(0, Math.cos(a));
      const sw = P.sway * .3 * Math.sin(TAU * E.p * 2) * ((E.L - 1) / 2 - v) / Math.max(1, E.L - 1);
      return {x: R * Math.sin(a) + sw, y: v * E.h * (1 + P.gap * 2), z: R * Math.cos(a) - R0, ry: a, bend: 1 / R, b: 1 - P.backShade + P.backShade * c, blur: P.backBlur * (1 - c) * .5, img: j * 3 + s};
    }},
];

export const Y_TEMPLATES = [...SIGNATURE, ...MORE];
