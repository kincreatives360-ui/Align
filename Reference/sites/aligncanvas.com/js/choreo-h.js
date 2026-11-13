// Choreography, batch H (see tools/choreo2-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a lip of water or a gymnast's stick are implied only by how the cards move and
// where they sit. Cards curve in 3D (bend / bendY) along whatever they travel round.
import { TAU, clamp01, sstep, wrap, lerp } from './math.js';
import { M, T, RX, RY, RZ, frame3, aim } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};

// smootherstep on [0,1]: zero speed and zero acceleration at both ends, the silkiest general-purpose ease
const sm5 = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
// small vector kit
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const rotV = (v, k, a) => { const c = Math.cos(a), s = Math.sin(a), kv = cross(k, v), d = dot(k, v) * (1 - c); return [v[0] * c + kv[0] * s + k[0] * d, v[1] * c + kv[1] * s + k[1] * d, v[2] * c + kv[2] * s + k[2] * d]; };
// a soft limit: linear for small values, easing into ±m
const soft = (v, m) => m * Math.tanh(v / m);

/* ---------- Ring Wave: the ring's radius, and the camera distance that makes it fill the frame ---------- */
const ringR = (P, E) => E.n * E.w * (1 + P.ringGap) / TAU;
const ringDist = (P, E) => (ringR(P, E) + E.w * .55) * E.D / (1.25 * .94) / P.ringFill;

/* ---------- Slalom: the camera's line weaves between gates on alternating sides ---------- */
const slalomX = (s, P) => -P.swing * Math.cos(PI * s / P.gateGap);
const slalomDX = (s, P) => P.swing * PI / P.gateGap * Math.sin(PI * s / P.gateGap);
const slalomDDX = (s, P) => P.swing * (PI / P.gateGap) ** 2 * Math.cos(PI * s / P.gateGap);

/* ---------- Waterfall: the path over the lip, as position, facing and the bend of a card spanning it ---------- */
function fallPath(s, P, h){
  const R = .08 + .24 * P.lip, Lp = 1.5, La = R * PI / 2, top = .5 * P.lipH;
  const ang = q => Math.max(0, Math.min(PI / 2, (q - Lp) / R));
  const pt = q => {
    if (q < Lp) return [0, top, -(Lp - q)];
    if (q < Lp + La){ const a = ang(q); return [0, top - R + R * Math.cos(a), R * Math.sin(a)]; }
    return [0, top - R - (q - Lp - La), R];
  };
  // the card is centred on the path and turned to the mean of its two ends; it bends by the share of it on the lip
  const a = (ang(s - h / 2) + ang(s + h / 2)) / 2, ovl = Math.max(0, Math.min(s + h / 2, Lp + La) - Math.max(s - h / 2, Lp));
  const c = pt(s);
  // on the curve the centre sits a touch inside the chord; push it out along the normal so the card hugs the lip
  return {c, N: [0, Math.cos(a), Math.sin(a)], bend: ovl / (h * R), fall: Math.max(0, s - Lp - La), Lp, La};
}

/* ---------- Gymnast Ribbon: a closed 3D path with a table of arc length, so cards keep their spacing ---------- */
const ribbonCache = new Map();
function ribbonPath(P, E){
  const key = [P.loopW, P.loopH, P.loopD, P.spiral, E.asp.toFixed(3)].join();
  let c = ribbonCache.get(key); if (c) return c;
  const ax = .92 * P.loopW * Math.min(1.25, Math.max(.75, E.asp)) / 1.25, ay = .42 * P.loopH, az = .85 * P.loopD, sp = P.spiral;
  const C = t => [ax * (Math.sin(t) + .18 * sp * Math.sin(3 * t)), ay * (Math.sin(2 * t) + .35 * sp * Math.cos(3 * t)), az * (Math.cos(t) + .25 * sp * Math.sin(2 * t))];
  const N = 1536, pts = [], S = [0];
  for (let k = 0; k <= N; k++) pts.push(C(k / N * TAU));
  for (let k = 1; k <= N; k++) S.push(S[k - 1] + len(sub(pts[k], pts[k - 1])));
  c = {C, N, S, L: S[N]};
  if (ribbonCache.size > 24) ribbonCache.clear();
  ribbonCache.set(key, c); return c;
}
const ribbonT = (rp, s) => {
  s = wrap(s, rp.L); let lo = 0, hi = rp.N;
  while (hi - lo > 1){ const mid = (lo + hi) >> 1; if (rp.S[mid] <= s) lo = mid; else hi = mid; }
  const f = (s - rp.S[lo]) / Math.max(1e-9, rp.S[hi] - rp.S[lo]);
  return (lo + f) / rp.N * TAU;
};

export const CHOREO_H = [
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
    fill: (P, E) => { const m = 2 * Math.ceil(Math.max(E.n, 10) / 2); return {m, count: m}; },
    camera: (P, E) => ({eye: [0, 0, 0], target: [0, 0, -1]}),
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
    fill: (P, E) => { const L = Math.round(P.lanes); return {L, per: 6, count: L * 6}; },
    camera: (P, E) => ({eye: [0, .55 * P.camHigh + .25, 3.6], target: [0, -.02, 0]}),
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
    fill: (P, E) => ({count: Math.round(P.length)}),
    layout(i, P, E){
      const rp = ribbonPath(P, E), m = E.count, taper = j => 1 - P.taper * (m > 1 ? j / (m - 1) : 0) ** 1.3;
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
