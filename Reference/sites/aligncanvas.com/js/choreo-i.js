// Choreography, batch I (see tools/choreo2-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a sign's bracket, a swatch book's rivet or a dealer's deck are implied only by
// how the cards move and where they sit.
import { TAU, clamp01, sstep, smoother, wrap, lerp } from './math.js';
import { rel, stepU, ab, wrapFade, fillSlots, M, T, RX, RY, RZ, frame3 } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};

// a smooth start that springs past the end and settles: zero speed at both ends, overshoot set by k (0 = none)
const springIn = (t, k) => { if (t <= 0) return 0; if (t >= 1) return 1; const s = t * t * (3 - 2 * t), c = 1.70158 * k; return 1 + (c + 1) * (s - 1) ** 3 + c * (s - 1) ** 2; };
const swin = (p, a, b, k) => springIn((p - a) / Math.max(1e-4, b - a), k);
// 0 before a, 1 after b, with zero speed and acceleration at both ends (the long, silky ease)
const glide = (p, a, b) => smoother(a, b, p);
// rate of change of f at p (per unit p), for bends and leans that follow the motion
const rate = (f, p, d = .002) => (f(p + d) - f(p - d)) / (2 * d);
// a soft bump: 0 with zero slope at both ends, 1 in the middle
const bump = t => t <= 0 || t >= 1 ? 0 : Math.sin(PI * t) ** 2;

/* ---------- Sign: one damped pendulum driven by how hard the row of hanging points accelerates ---------- */
// the same push drives every sign, so it is solved once per setting: two loops from rest, keeping the second, so it
// is periodic; then scaled so the largest swing is 1 (the Swing control sets the angle). Sampled at any phase q, so
// each sign can answer a moment after its neighbour.
const signCache = new Map();
function signSwing(P, E, q){
  const n = E.n, key = [n, E.hold, P.ease, P.damp, P.swingRate].join();
  let tab = signCache.get(key);
  if (!tab){
    const N = 240 * n, dp = 1 / N, w = TAU * n * P.swingRate, z = .08 + .5 * P.damp, u = p => stepU(wrap(p, 1), n, E.hold, E.ez) + Math.floor(p) * n;
    let th = 0, v = 0; tab = new Float32Array(N + 1);
    for (let s = 0; s < 2 * N; s++){
      const p = s * dp, acc = (u(p + dp) - 2 * u(p) + u(p - dp)) / (dp * dp);
      v += (-w * w * th - 2 * z * w * v - acc) * dp; th += v * dp;
      if (s >= N) tab[s - N] = th;
    }
    tab[N] = tab[0];
    let mx = 1e-6; for (const t of tab) mx = Math.max(mx, ab(t));
    for (let s = 0; s <= N; s++) tab[s] /= mx;
    signCache.set(key, tab); if (signCache.size > 24) signCache.delete(signCache.keys().next().value);
  }
  const f = wrap(q, 1) * (tab.length - 1), k = Math.floor(f);
  return lerp(tab[k], tab[Math.min(k + 1, tab.length - 1)], f - k);
}

/* ---------- S-Wall: the S as an arc-length table, so cards keep an even spacing round the bends ---------- */
const sCache = new Map();
function sPath(X, A){
  const key = X.toFixed(3) + ',' + A.toFixed(3);
  let t = sCache.get(key);
  if (!t){
    const N = 256, xs = new Float32Array(N + 1), ss = new Float32Array(N + 1), k = PI / X;
    let s = 0;
    for (let j = 0; j <= N; j++){ const x = -X + 2 * X * j / N; if (j){ const x0 = xs[j - 1]; s += Math.hypot(x - x0, A * (Math.sin(k * x) - Math.sin(k * x0))); } xs[j] = x; ss[j] = s; }
    t = {xs, ss, L: s, k}; sCache.set(key, t); if (sCache.size > 24) sCache.delete(sCache.keys().next().value);
  }
  return t;
}
const sAt = (t, s) => { const {xs, ss} = t; let lo = 0, hi = ss.length - 1; s = Math.max(0, Math.min(t.L, s));
  while (hi - lo > 1){ const m = (lo + hi) >> 1; if (ss[m] < s) lo = m; else hi = m; }
  return lerp(xs[lo], xs[hi], (s - ss[lo]) / Math.max(1e-6, ss[hi] - ss[lo])); };

/* ---------- Spiral Deal: where card i is along the spiral (0 the deck, s_i its place) ---------- */
function dealS(i, n, p, P){
  const si = Math.sqrt(lerp(.07, 1, n > 1 ? i / (n - 1) : 1)), rank = n - 1 - i, span = .3 * P.dealSpan / Math.max(1, n - 1), fl = .16 * P.flightTime;
  // outermost first, so no card flies over one already placed; gathered back innermost first, in one long sweep
  const t0 = .04 + rank * span, out = swin(p, t0, t0 + fl, P.settle), g0 = .64 + (i / Math.max(1, n - 1)) * .12 * P.dealSpan;
  const gl = Math.min(.17 * P.flightTime, .97 - g0), back = glide(p, g0, g0 + gl);
  return {s: si * (out - back), fly: bump((p - t0) / fl) + bump((p - g0) / gl), out, back};
}

export const CHOREO_I = [
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
      const sw = q => signSwing(P, E, q), q0 = E.p - lag * r;
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
      const op = q => swin(q, .05 + dc * st, .05 + dc * st + ot, P.overshoot);
      const ang = P.closeWay === 'back'
        ? q => ai * (op(q) - swin(q, .56 + (1 - dc) * st, .56 + (1 - dc) * st + ot, P.overshoot * .5))
        : q => lerp(ai * op(q), -A / 2, swin(q, .52 + (1 - f) * st, .52 + (1 - f) * st + ot, P.overshoot * .4)) * (1 - glide(q, .8, .97));
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
      const sp = s => { const a = PI / 2 + rot - s * P.turns * TAU, r = r0 * sstep(0, .1, s) + (1 - r0) * s; return [Rx * r * Math.cos(a), Ry * r * Math.sin(a)]; };
      // the dealt spiral is lopsided, so the whole layout slides to centre it as the deal spreads (and back as it drains)
      let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
      for (let j = 0; j < n; j++){ const q = sp(Math.sqrt(lerp(.07, 1, n > 1 ? j / (n - 1) : 1))); bx0 = Math.min(bx0, q[0]); bx1 = Math.max(bx1, q[0]); by0 = Math.min(by0, q[1]); by1 = Math.max(by1, q[1]); }
      const spread = glide(E.p, .04, .5) - glide(E.p, .64, .95), ox = -(bx0 + bx1) / 2 * spread, oy = -(by0 + by1) / 2 * spread;
      const pt = s => { const [x, y] = sp(s); return [x + ox, y + oy, V * ((x / Rx) ** 2 + (y / Ry) ** 2)]; };
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
