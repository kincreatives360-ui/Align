// Choreography, batch E (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
import { TAU, clamp01, sstep, smoother, wrap, lerp } from './math.js';
import { M, T, RX, RZ, P_GAP } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};
const FLAT = RX(-PI / 2);   // a card lying face up, the top of the photo pointing away from the camera

export const CHOREO_E = [
  /* ---------- 41 Flag: a grid hung from an unseen pole, a travelling wave rolling out to the free edge ---------- */
  {...NEW, id: 'flag', name: 'Flag', n: 15, aspect: 1.25, cardH: .34, dur: 8,
    desc: 'Photos form a flag that ripples in the wind from its pole.',
    params: [G('Layout'), whole('flagCols', 'Columns', 2, 8, 5), whole('flagRows', 'Rows', 1, 5, 3), P_GAP(.03), off('droop', 'Droop', 1, {hint: 'the free edge sags a little'}), range('camYaw', 'View angle', -40, 40, 24, 1, {unit: '°'}),
      G('Motion'), whole('gusts', 'Waves', 1, 5, 2, {unit: '×', hint: 'whole waves per loop, so it stays seamless'}), range('wind', 'Wind', .1, 1.3, .95),
      range('waveLen', 'Wavelength', .4, 2, 1, .01, {unit: '×'}), range('diag', 'Slant', -1, 1, .18, .01, {hint: 'the ripples run at an angle, like real cloth'}),
      off('flutter', 'Flutter', 1, {hint: 'a quick second ripple near the free edge'}), off('lull', 'Lulls', 1, {hint: 'the wind drops and picks up again once a loop'}),
      G('Look'), range('foldShade', 'Fold shade', 0, 1, .5)],
    // a level camera turned round the vertical only, so the pole stays upright and the rows stay level
    camera(P, E){ const a = P.camYaw * D2R, d = E.D * 1.04; return {eye: [d * Math.sin(a), 0, d * Math.cos(a) + .12], target: [0, 0, .12]}; },
    fill(P, E){
      const cols = Math.round(P.flagCols), rows = Math.round(P.flagRows), px = E.w * (1 + P.gap), L = cols * px, K = 24 * cols;
      const k = TAU / (L * .5 * P.waveLen), w = TAU * Math.round(P.gusts) * E.p, gust = P.wind * .8 * (1 - P.lull * .55 * (.5 + .5 * Math.cos(TAU * E.p)));
      // each row is its own curve (the slant shifts its phase); x and z are integrated along the cloth so it never stretches
      const curves = [];
      for (let r = 0; r < rows; r++){
        const yr = ((rows - 1) / 2 - r) * E.h * (1 + P.gap), ph = P.diag * yr * 2.2, X = [0], Z = [0], TH = [];
        for (let s = 0; s <= K; s++){
          const d = s / K * L, q = d / L;
          TH.push(gust * Math.pow(q, .75) * Math.sin(k * d - w + ph) + P.flutter * .28 * q * q * Math.sin(3 * k * d - 3 * w + ph * 2));
        }
        for (let s = 1; s <= K; s++){ const a = (TH[s - 1] + TH[s]) / 2, dd = L / K; X.push(X[s - 1] + Math.cos(a) * dd); Z.push(Z[s - 1] + Math.sin(a) * dd); }
        curves.push({X, Z, TH, yr});
      }
      return {cols, rows, px, L, K, curves, count: cols * rows};
    },
    layout(i, P, E){
      const c = i % E.cols, r = Math.floor(i / E.cols), cv = E.curves[r], d = (c + .5) * E.px, f = d / E.L * E.K, s = Math.min(E.K - 1, Math.floor(f)), t = f - s;
      const x = lerp(cv.X[s], cv.X[s + 1], t), z = lerp(cv.Z[s], cv.Z[s + 1], t), th = lerp(cv.TH[s], cv.TH[s + 1], t);
      const kap = (cv.TH[s + 1] - cv.TH[s]) / (E.L / E.K), q = d / E.L, side = 1;
      // light from the front: cloth turned away from it falls into shade
      const lit = clamp01((.45 * Math.sin(th) * side + Math.cos(th)) / 1.1);
      return {x: side * (x - E.L / 2), y: cv.yr - P.droop * .12 * q * q, z, ry: -th * side, bend: -kap,
        b: 1 - P.foldShade * (1 - lit) * .9, img: i};
    }},

  /* ---------- 45 Runway: tiles float down onto a curved road ahead as we glide straight over it ---------- */
  {...NEW, id: 'runway', name: 'Runway', n: 12, aspect: 1, cardH: .5, step: true, perCard: .8, fov: 40,
    desc: 'Photos land in place ahead of the camera to build an endless path to fly over.',
    params: [G('Layout'), whole('lanes', 'Lanes', 1, 4, 3), P_GAP(.06), off('brick', 'Brick offset', 1, {hint: 'neighbouring lanes are offset by half a tile'}),
      range('roadCurve', 'Road curve', -1, 1, .55, .01, {hint: 'the path curves up at the sides like a valley (or down, like a crown); each tile bends with it'}),
      range('crest', 'Horizon curve', 0, 1, .35, .01, {hint: 'the road rolls away over a gentle crest in the distance'}),
      range('landAt', 'Landing point', 1.2, 5, 2.8), range('camH', 'Height', .4, 1.6, .85),
      G('Motion'), range('dropH', 'Drop height', .1, 1.5, .35), range('tip', 'Tip', 0, 1, .55, .01, {hint: 'falling tiles tip toward you so the photo reads, then lie down'}),
      range('fallCurl', 'Fall curl', 0, 1.5, .7, .01, {hint: 'tiles curl as they float down and flatten as they land'}), range('settle', 'Settle', 0, 1, .4), off('tumble', 'Tumble', 1),
      G('Look'), range('farFog', 'Distance fade', 0, 1, .35)],
    camera: (P, E) => ({eye: [0, P.camH, 1.7], target: [0, P.camH * .25 - .22, -2.2]}),
    fill(P, E){
      const L = Math.round(P.lanes), pitch = E.h * (1 + P.gap), span = 2.6 + P.landAt + 2.4, M0 = E.n * Math.max(1, Math.ceil(span / pitch / E.n));
      return {L, pitch, M0, count: M0 * L};
    },
    layout(i, P, E){
      const {L, pitch, M0} = E, lane = i % L, line = Math.floor(i / L), br = P.brick * (lane % 2) * .5, id = (line * L + lane) % E.n;
      // a steady glide straight ahead: every tile moves toward the camera at the same constant speed
      const s = wrap(line + br - E.p * E.n, M0), z = 2.4 - s * pitch, dd = Math.max(0, -z + .3);
      // the road's cross-section is an arc; each lane sits on it, turned to its slope and bent to its curvature
      const pw = E.w * (1 + P.gap), x0 = (lane - (L - 1) / 2) * pw, k = -P.roadCurve * .6 / Math.max(.35, L * pw / 2), ph = x0 * k;
      const x = Math.abs(k) < 1e-4 ? x0 : Math.sin(ph) / k, yc = Math.abs(k) < 1e-4 ? 0 : (Math.cos(ph) - 1) / k;
      // and in the distance it rolls over a crest, the tiles bending over it
      const cr = P.crest * .045, yh = -cr * dd * dd, rxh = -Math.atan(2 * cr * dd);
      // landing: a tile floats down and slows to rest (no hard impact), tipped toward you at first, curled, then flat
      const F = .7, zl = -P.landAt, fa = clamp01((z - (zl - F)) / F), air = (1 - fa) ** 3, g = clamp01((z - zl) / .9);
      const settle = P.settle * .1 * Math.sin(PI * g) ** 2 * (1 - g);
      let y = yc + yh + P.dropH * air, rx = rxh + P.tip * 1.1 * (1 - fa) ** 2 - settle, rz = -ph + P.tumble * (E.rnd(id, 2) - .5) * 1.2 * (1 - fa) ** 2;
      let o = smoother(0, .6, fa);
      // past the camera, tiles sink a little and fade as they leave the frame
      const bz = Math.max(0, z - .6); y -= bz * bz * .9; o *= 1 - sstep(.8, 1.7, z);
      const curl = P.fallCurl * 1.3 * (1 - fa) ** 2 / E.h;
      return {m: M(T(x, y, z), RX(rx), RZ(rz), FLAT), bend: k, bendY: 2 * cr + curl, o, s: lerp(.86, 1, smoother(0, 1, fa)),
        b: 1 - P.farFog * .7 * clamp01((-z - 1) / (P.landAt + 2)), blur: P.farFog * .35 * clamp01((-z - 2) / 4), img: id};
    }},
];
