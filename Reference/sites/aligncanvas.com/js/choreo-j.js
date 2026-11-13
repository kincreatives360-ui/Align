// Choreography, batch J (see tools/choreo2-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a pen, a cinema screen or a rubber stamp is implied only by how the cards move.
import { TAU, clamp01, sstep, smoother, wrap, ease, lerp } from './math.js';
import { ab, rel, M, T, RX, RY, RZ, frame3 } from './kit.js';

const PI = Math.PI;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
const G = group => ({group});
// the width to compose for: narrower frames are already zoomed out by the engine, so don't shrink twice
const AW = E => Math.max(1, E.asp);
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};

// 0 before a, 1 after b, eased between
const win = (p, a, b, ez = ease.inOutCubic) => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
// 0 before a, 1 after b, with zero speed and acceleration at both ends (the long, silky ease)
const glide = (p, a, b) => smoother(a, b, p);
// small vector kit
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = a => Math.hypot(a[0], a[1], a[2]);
// a card riding a curve f(t): centre on the curve, width along the tangent, facing (roughly) Z, curved to the
// path's bend toward/away from its face (the engine's `bend` is curvature, negative = concave toward the face)
function onCurve(f, t, Z, e = 1e-3){
  const a = f(t - e), c = f(t), b = f(t + e), d1 = sub(b, a), sp = len(d1) / (2 * e) || 1;
  const acc = [(b[0] - 2 * c[0] + a[0]) / (e * e), (b[1] - 2 * c[1] + a[1]) / (e * e), (b[2] - 2 * c[2] + a[2]) / (e * e)];
  const m = frame3(c[0], c[1], c[2], d1, Z), N = [m[8], m[9], m[10]];
  return {m, c, bend: -dot(acc, N) / (sp * sp), tan: d1};
}

export const CHOREO_J = [
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
      const path = t => {
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
      const pen = t => .5 * t + .5 * ease.inOutSine(t), dt = P.drawTime, nb = P.nib;
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
      const env = q => q >= 1 ? 0 : glide(q, a1, a2) - glide(q, a3, a4);
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
      const fit = Math.min(2 * E.vx * .9 / (C * pitch), 2 * E.vy * .86 / (Rr * pitch)), px = [], py = [], key = [];
      for (let j = 0; j < N; j++){ px.push((j % C - (C - 1) / 2) * pitch * fit); py.push(-(Math.floor(j / C) - (Rr - 1) / 2) * pitch * fit); }
      for (let j = 0; j < N; j++) key.push(P.order === 'rows' ? j : P.order === 'centre' ? Math.hypot(px[j], py[j]) + E.rnd(j, 5) * .01 : E.rnd(j, 4));
      const rank = new Array(N); [...key.keys()].sort((a, b) => key[a] - key[b] || a - b).forEach((j, r) => { rank[j] = r; });
      return {N, px, py, rank, fit, pf: pitch * fit, count: 2 * N};
    },
    layout(i, P, E){
      const {N, px, py, rank, fit, pf} = E, g = i >= N ? 1 : 0, j = i % N, dt = P.dropTime;
      // two sets take turns: set 1 stamps in over the first half, set 0 over the second; each lives half a loop
      const land = (gg, q) => (gg ? .03 : .53) + dt + P.stampSpan * (N > 1 ? rank[q] / (N - 1) : 0);
      const age = (gg, q) => wrap(E.p - land(gg, q) + dt, 1) - dt, a = age(g, j), life = .5;
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
