// Choreography, batch B (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: tiers, lines, waves and carpets are implied by where the cards sit and
// how they move, never drawn.
import { TAU, clamp01, sstep, smoother, wrap, ease, lerp } from './math.js';
import { rel, ab, wrapFade, fillSlots, M, T, RX, RY, RZ, frame3, P_GAP } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const cycles = (key, label, min, max, def) => whole(key, label, min, max, def, {unit: '×', hint: 'whole cycles per loop, so it stays seamless'});
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};
const smooth = t => smoother(0, 1, t);

/* ---------- Barrel Wave: the wave's cross-section ---------- */
// The sheet is symmetric about its trough: walking out from the middle toward either edge, the tangent turns by c
// radians in all — slowly at first, then faster — so both sides ramp up into walls and curl over toward each other,
// closing into a tube from the left and the right at once. half(s) returns [lateral, height, tangent angle] at arc
// length s ≥ 0 from the trough; the other side is its mirror.
function curlPt(s, Ls, c, pw){
  const N = Math.max(2, Math.ceil(s / Ls * 28)), ds = s / N; let u = 0, y = 0;
  for (let j = 0; j < N; j++){ const ph = c * Math.pow((j + .5) * ds / Ls, pw); u += Math.cos(ph) * ds; y += Math.sin(ph) * ds; }
  return [u, y, c * Math.pow(s / Ls, pw)];
}
// When closed the sheet is a true circle (radius R = Ls/π, its centre at height R), so the two lips meet over the
// top instead of each rolling into its own scroll; cMax is the turn that leaves a slim gap between them.
let barrelMemo = {key: '', v: null};
function barrelCentre(P, E){
  const rows = Math.round(P.rows), pS = E.h * (1 + P.gap), Ls = rows / 2 * pS, key = [rows, pS].join('|');
  if (barrelMemo.key === key) return barrelMemo.v;
  const gap = pS * .1; let lo = PI * .5, hi = PI;
  for (let k = 0; k < 40; k++){ const m = (lo + hi) / 2; if (Ls * Math.sin(m) / m > gap / 2) lo = m; else hi = m; }
  barrelMemo = {key, v: {R: Ls / PI, Ls, pS, cMax: lo}};
  return barrelMemo.v;
}

export const CHOREO_B = [
  /* 11 Amphitheatre: tiers of photos wrapped round you like the curved screen wall of a giant cinema. Every tier is
     one clean arc: the photos sit at exactly the same pitch, height and tilt, each bent to the arc's own radius, and
     the tiers step up and back with outer tiers scaled to the same angular size, so the columns line up like one
     great curved grid. The rows glide round; a soft band of light sweeps along them */
  {...NEW, id: 'amphitheatre', name: 'Amphitheatre', n: 16, aspect: .8, cardH: .6, dur: 40, fov: 50,
    desc: 'Rows of photos rise in tiers around you like the seats of an amphitheatre.',
    params: [G('Layout'), whole('tiers', 'Tiers', 2, 5, 3), range('stage', 'Stage size', .7, 1.6, 1), range('rake', 'Rise', .9, 1.6, 1.06), range('tierStep', 'Tier depth', 0, 1.5, .6, .01, {hint: 'how far each tier steps back'}),
      range('span', 'Arc', 50, 110, 84, 1, {unit: '°'}), P_GAP(.1),
      range('seatCurve', 'Card curve', 0, 1.5, 1, .01, {hint: 'each photo curves to the arc it sits on'}),
      G('Motion'), cycles('laps', 'Laps', 1, 3, 1), {key: 'tierFlow', label: 'Tiers glide', type: 'seg', options: {same: 'Together', alt: 'Opposite'}, def: 'same'},
      range('crowd', 'Light sweep', 0, 1, .5, .01, {hint: 'a soft band of light runs along the rows'}), cycles('waves', 'Sweeps', 1, 4, 2), range('pan', 'Camera pan', 0, 1, .4),
      G('Look'), range('lean', 'Face the stage', 0, 1, .85), range('view', 'Camera height', -.6, .8, 0), range('sideDim', 'Side shade', 0, 1, .3), off('depthBlur', 'Depth blur', 1)],
    fill(P, E){
      const tiers = Math.round(P.tiers), R0 = 2.5 * P.stage, dth = E.w * (1 + P.gap) / R0, K = Math.round(2 * P.span * D2R / dth) + 4, R = [], S = [], Y = [];
      for (let j = 0; j < tiers; j++){ const s = 1 + j * .2 * P.tierStep; R.push(R0 * s); S.push(s);
        Y.push(j ? Y[j - 1] + E.h * (S[j - 1] + s) / 2 * (1 + P.gap) * P.rake : 0); }
      const mid = (Y[0] + Y[tiers - 1]) / 2;
      return {count: K * tiers, K, dth, tR: R, tS: S, tY: Y.map(y => y - mid)};
    },
    camera(P, E){
      const R0 = 2.5 * P.stage, sw = P.pan * Math.sin(TAU * E.p), ey = -.12 + P.view;
      return {eye: [-sw * .2, ey, R0 * .78], target: [sw * .45, ey * .3 + .02, -R0]};
    },
    layout(i, P, E){
      const K = E.K, j = Math.floor(i / K), q = i % K, R = E.tR[j], sj = E.tS[j], y = E.tY[j], dir = P.tierFlow === 'alt' && j % 2 ? -1 : 1;
      // one slot pitch for every tier, so the columns line up; whole slots per loop keeps it seamless
      const r = wrap(q - E.p * K * Math.round(P.laps) * dir + K / 2, K) - K / 2, th = r * E.dth, thW = K / 2 * E.dth;
      // fade out over the last two slots before the wrap, long and eased
      const edge = sstep(thW - 2.3 * E.dth, thW - .25 * E.dth, ab(th));
      const ph = th * 1.6 - TAU * Math.round(P.waves) * E.p - j * .5, st = P.crowd * Math.pow(.5 + .5 * Math.cos(ph), 4);
      // one tilt per tier (a clean cone, never a ripple): the tier leans to face the eye
      const eyeY = -.12 + P.view, eyeZ = 2.5 * P.stage * .78, rx = P.lean * Math.atan2(y - eyeY, eyeZ + R);
      return {x: R * Math.sin(th), y, z: -R * Math.cos(th), ry: -th, rx, s: sj,
        bend: -P.seatCurve / (R / sj), o: 1 - smooth(edge), b: (1 - P.sideDim * .45 * sstep(.2, 1, ab(th) / (P.span * D2R))) * (1 + st * .1),
        blur: P.depthBlur * (j / Math.max(1, E.tR.length - 1)) * .5, img: (q + j * 5) % E.n};
    }},

  /* 13 Clothesline: pegged photos drift along a sagging line; gusts swing them back, they billow and swing home */
  {...NEW, id: 'clothesline', name: 'Clothesline', n: 10, aspect: .8, cardH: .64, dur: 30,
    desc: 'Photos pegged on a sagging line flutter in the breeze as the line drifts past.',
    params: [G('Layout'), P_GAP(.1), range('sag', 'Sag', 0, .8, .3), range('lineH', 'Line height', -.4, 1, .55), range('lineAng', 'Line angle', -40, 40, 18, 1, {unit: '°'}), off('sizeMix', 'Size mix', 1),
      G('Motion'), cycles('laps', 'Drift', 1, 3, 1), range('gust', 'Gusts', 0, 1, .55), cycles('gusts', 'Gusts per loop', 1, 6, 3), range('flutter', 'Billow', 0, 1, .6, .01, {hint: 'photos curve like cloth as the wind fills them'}),
      range('swingBack', 'Swing back', 0, 1, .4, .01, {hint: 'after a gust the photos swing past and settle'}),
      G('Look'), off('askew', 'Askew', 1, {hint: 'each photo hangs a little crooked from its pegs'}), off('edgeFade', 'Edge fade', 1), range('farBlur', 'Far blur', 0, 1, .3)],
    fill(P, E){ const v = E.vx / Math.cos(P.lineAng * D2R) + E.w, m = fillSlots(v, E.w * (1 + P.gap), E.n); return {m, count: m}; },
    layout(i, P, E){
      const ang = P.lineAng * D2R, r = rel(i, E.p * E.n * Math.round(P.laps), E.m), s = r * E.w * (1 + P.gap), k = i % E.n;
      // a fixed sag between posts just beyond the frame; the photos travel through it, so the line seems to slide along
      const X = E.vx / Math.cos(ang) * 1.05, q = Math.max(-1.3, Math.min(1.3, s / X)), y = P.lineH - P.sag * (1 - q * q), slope = 2 * P.sag * q / X;
      // gusts run along the line: a photo is pushed back on its pegs, swings past on the way home and settles
      const ph = s * 1.5 - TAU * Math.round(P.gusts) * E.p, pz = (a, sh) => Math.pow(.5 + .5 * Math.cos(a), sh);
      const g = P.gust * pz(ph, 3), back = P.gust * P.swingBack * pz(ph + 1.25, 3);
      const fl = Math.sin(TAU * 5 * E.p + k * 2.1) * .6 + Math.sin(TAU * 8 * E.p + k * 1.3) * .4;
      const th = .8 * g - .35 * back + g * .07 * fl + .04 * P.gust * Math.sin(TAU * 2 * E.p + k), sc = 1 - P.sizeMix * .3 * E.rnd(k, 4);
      const tz = Math.atan(slope) * .8 + P.askew * .14 * (E.rnd(k, 5) - .5) + g * .04 * Math.sin(TAU * 4 * E.p + k);
      const ex = ab(s * Math.cos(ang)) / E.vx, zw = -s * Math.sin(ang);
      return {m: M(T(s * Math.cos(ang), y, zw), RY(ang), RZ(tz), RX(th), T(0, -E.h * sc / 2, 0)), s: sc,
        bendY: -P.flutter * (th * 1.5 + .15 * g * fl) / E.h, bend: P.flutter * g * .3 * fl / E.w,
        o: wrapFade(r, E.m) * (1 - P.edgeFade * sstep(.55, 1.05, ex)), blur: P.farBlur * clamp01(-zw / 3) * .6, b: 1 - .12 * clamp01(th)};
    }},

  /* 14 Barrel Wave: rows of photos form a half-pipe whose two sides rise together and curl over toward each other
     into a tube, then open out again, symmetric about the middle, while the columns stream past the camera */
  {...NEW, id: 'barrel-wave', name: 'Barrel Wave', n: 12, aspect: 1.25, cardH: .36, dur: 14, fov: 50,
    desc: 'Photos ride a curling wave that rolls over into a tunnel and breaks again.',
    params: [G('Layout'), whole('rows', 'Rows', 4, 10, 8, {hint: 'photos across the wave, split between the two sides'}), whole('len', 'Length', 8, 20, 12, {hint: 'columns of photos down the wave'}), P_GAP(.05), range('shape', 'Steepness', 1, 2.4, 1.5),
      G('Motion'), range('curl', 'Curl', .4, 1, .97, .01, {hint: 'how far the two sides roll toward each other at the top of each set'}), cycles('sets', 'Sets', 1, 3, 1), range('peel', 'Peel', 0, 1.2, .45, .01, {hint: 'the barrel closes along the wave rather than all at once'}),
      cycles('flow', 'Flow', 1, 8, 4), range('ride', 'Camera line', -1, 1, 0), range('surf', 'Camera surf', 0, 1, .5, .01, {hint: 'the camera rises and dips with the wave'}),
      G('Look'), range('sheet', 'Card curve', 0, 1.3, 1, .01, {hint: 'photos curve with the face of the wave'}), range('lipShade', 'Lip shade', 0, .6, .22), range('farBlur', 'Distance blur', 0, 1, .35)],
    fill(P, E){ const rows = Math.round(P.rows), mb = Math.ceil(E.n / rows), m = mb * Math.max(2, Math.min(Math.ceil(Math.round(P.len) / mb), Math.floor(120 / rows / mb))); return {m, mb, count: m * rows}; },
    camera(P, E){
      const C = barrelCentre(P, E), sf = P.surf * Math.sin(TAU * Math.round(P.sets) * E.p - .6), y = -C.R * .18 + P.ride * .25 + sf * .07;
      // straight down the middle of the tube, so both sides frame the view equally; narrow frames move in a little
      const t = [1.6, y + .02 - sf * .04, 0], k = Math.min(1, E.asp / 1.25) ** .45, e = [-2.2, y + .05, 0];
      return {eye: e.map((v, j) => t[j] + (v - t[j]) * k), target: t};
    },
    layout(i, P, E){
      const rows = Math.round(P.rows), col = Math.floor(i / rows), row = i % rows, C = barrelCentre(P, E), pX = E.w * (1 + P.gap);
      // columns stream toward the camera, as if surfing down the line; they fade in at the far end and out as they pass
      const d = wrap(col - E.p * E.mb * Math.round(P.flow), E.m), x = -1.15 + d * pX;
      // both sides curl together, once a set, peeling along x
      const ph = TAU * Math.round(P.sets) * E.p - (x + 1.15) * P.peel, e = ease.inOutSine(.5 - .5 * Math.cos(ph));
      const c = lerp(.22 * PI, P.curl * C.cMax, e), sv = (row - (rows - 1) / 2) * C.pS, sg = sv < 0 ? -1 : 1, sr = Math.abs(sv);
      // steepness shapes the rising walls; as the barrel closes the profile relaxes to a circle
      const pw = lerp(P.shape, 1, e * e), [u, y, phi] = curlPt(sr, C.Ls, c, pw);
      // the face looks into the tube; on each side the photo's up runs up the wall, so neither side is upside down
      const m = frame3(x, y - C.R, -sg * u, [sg, 0, 0], [0, Math.cos(phi), sg * Math.sin(phi)]);
      // each photo bends to the local curvature of the face, so the rows join into one smooth sheet
      const kap = c * pw * Math.pow(sr / C.Ls, pw - 1) / C.Ls;
      const o = sstep(0, 1.2, d) * sstep(E.m, E.m - 3, d), lip = clamp01((phi - PI * .55) / PI);
      return {m, o, bendY: -P.sheet * kap, b: 1 - P.lipShade * lip, blur: P.farBlur * sstep(2.5, E.m, d) * .7, img: (row * E.mb + col % E.mb) % E.n};
    }},

  /* 15 Magic Carpet: a grid of photos flies as one rippling sheet, weaving and banking, the camera riding behind */
  {...NEW, id: 'magic-carpet', name: 'Magic Carpet', n: 12, aspect: .8, cardH: .4, dur: 16,
    desc: 'A carpet of photos flies through space, rippling as the camera rides along.',
    params: [G('Layout'), whole('cols', 'Columns', 2, 6, 4), whole('rows', 'Rows', 3, 8, 4), P_GAP(.04), range('camBack', 'Camera distance', .6, 1.8, 1), range('camH', 'Camera height', .3, 2, .95),
      G('Motion'), range('ripple', 'Ripple', 0, 1, .6), cycles('ripples', 'Ripples', 1, 6, 2), range('weave', 'Weave', 0, 1, .5), range('bank', 'Bank', 0, 1, .6), range('bob', 'Swoop', 0, 1, .45),
      G('Look'), range('cloth', 'Cloth bend', 0, 1.5, 1, .01, {hint: 'each photo bends with the ripple, so the carpet reads as one cloth'}), range('rimFade', 'Tail fade', 0, 1, .25), off('rimBlur', 'Tail blur', 1)],
    fill: (P, E) => ({count: Math.round(P.cols) * Math.round(P.rows)}),
    camera(P, E){
      // the camera rides behind and above, following the carpet's weave a beat late, with a slow swoop of its own
      const ph = TAU * (E.p - .07), X = P.weave * .55 * Math.sin(ph), d = P.camBack, Y = P.bob * .14 * Math.sin(2 * ph + .7);
      return {eye: [X * .6, P.camH * d + .1 + Y * .6, 2.15 * d + .35], target: [X * .85, -.1 + Y * .8, -.35]};
    },
    layout(i, P, E){
      const cols = Math.round(P.cols), rows = Math.round(P.rows), c = i % cols, r = Math.floor(i / cols), pX = E.w * (1 + P.gap), pZ = E.h * (1 + P.gap);
      const u = (c - (cols - 1) / 2) * pX, v = ((rows - 1) / 2 - r) * pZ, Lv = rows * pZ, kw = TAU / Math.max(1.2, Lv * .85);
      // a ripple runs from the front edge to the back, growing toward the trailing edge like cloth in the wind,
      // with a slower cross-wave along the width
      const W = Math.round(P.ripples), hAt = (a, b) => { const back = clamp01((Lv / 2 - b) / Lv); return P.ripple * .17 * (.35 + .65 * back) * Math.sin(kw * b + TAU * W * E.p) + P.ripple * .05 * Math.sin(2.1 * a + TAU * E.p + b); };
      const hgt = hAt(u, v), e = .02, hu = (hAt(u + e, v) - hAt(u - e, v)) / (2 * e), hv = (hAt(u, v + e) - hAt(u, v - e)) / (2 * e);
      const huu = (hAt(u + e, v) - 2 * hgt + hAt(u - e, v)) / (e * e), hvv = (hAt(u, v + e) - 2 * hgt + hAt(u, v - e)) / (e * e);
      // flight: a weave from side to side, banking into each turn, and swooping over gentle rises
      const ph = TAU * E.p, X = P.weave * .55 * Math.sin(ph), yaw = -P.weave * .32 * Math.cos(ph), roll = -P.bank * .35 * Math.sin(ph);
      const Y = P.bob * .14 * Math.sin(2 * ph + .7), pitch = -P.bob * .12 * Math.cos(2 * ph + .7);
      const card = frame3(u, hgt, -v, [1, hu, 0], [-hu, 1, hv]), tail = clamp01((Lv / 2 - v) / Lv);
      return {m: M(T(X, Y - .02, 0), RY(yaw), RZ(roll), RX(pitch), card), bend: -P.cloth * huu, bendY: -P.cloth * hvv,
        o: 1 - P.rimFade * .6 * tail * tail, blur: P.rimBlur * tail * .5, img: (r * cols + c) % E.n};
    }},
];
