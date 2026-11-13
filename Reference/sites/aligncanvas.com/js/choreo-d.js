// Choreography, batch D (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: stairs, doorways and the crawl's curved plane are implied by how the cards move.
import { TAU, clamp01, sstep, wrap, ease, lerp } from './math.js';
import { ab, M, T, RX, RY, RZ, S, P_GAP, stepU } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};
// quintic smootherstep: zero velocity and acceleration at both ends, for long silky eases
const sm5 = t => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
// a little damped wobble that starts at 0 (follow-through after an impact); t in loop-fraction units since the impact
const wob = (t, freq = 30, damp = 10) => t <= 0 ? 0 : Math.exp(-t * damp) * Math.sin(t * freq);
// a bump that rises and falls back with zero speed at both ends, peaking at `at` of the way through
const bump = (t, at = .5) => { t = clamp01(t); return Math.sin(PI * Math.pow(t, Math.log(.5) / Math.log(at))) ** 3; };
// small keyed cache for tables that only change when the params do
function memo(cache, key, make){ let v = cache.get(key); if (!v){ if (cache.size > 16) cache.clear(); v = make(); cache.set(key, v); } return v; }

/* ---------- Opening Crawl surface ---------- */
// The crawl runs up a vertical sheet, then rolls back over a soft crest onto the receding plane. The lean angle grows
// with a smootherstep over the crest, so the curvature (the cards' bendY) rises and falls smoothly, never kinks.
const CRAWL = new Map();
function crawlPath(lay, Lc){
  return memo(CRAWL, lay + ',' + Lc, () => {
    const N = 240, ys = [0], zs = [0];
    let y = 0, z = 0;
    for (let k = 1; k <= N; k++){ const th = lay * sm5((k - .5) / N), ds = Lc / N; y += Math.cos(th) * ds; z -= Math.sin(th) * ds; ys.push(y); zs.push(z); }
    return s => {
      if (s <= 0) return {y: s, z: 0, th: 0, k: 0};
      if (s >= Lc) return {y: ys[N] + Math.cos(lay) * (s - Lc), z: zs[N] - Math.sin(lay) * (s - Lc), th: lay, k: 0};
      const x = s / Lc * N, q = Math.min(N - 1, Math.floor(x)), f = x - q, u = s / Lc;
      return {y: lerp(ys[q], ys[q + 1], f), z: lerp(zs[q], zs[q + 1], f), th: lay * sm5(u), k: lay * 30 * u * u * (1 - u) * (1 - u) / Lc};
    };
  });
}

export const CHOREO_D = [
  // Tumble: photos hop down an implied flight of steps, one after another from the bottom up, so the cascade ripples
  // up the stairs. Each hop: rock back on the heel, a floaty arc with a full flip (the card flexes like card stock in
  // the air), a soft landing that flexes it the other way, and a damped settle.
  {...NEW, id: 'tumble', name: 'Tumble', n: 5, aspect: 1.2, cardH: .5, dur: 10, fov: 30,
    desc: 'Photos tumble end over end down a flight of steps.',
    params: [G('Layout'), range('run', 'Step depth', .7, 2, .95, .01, {unit: '×'}), range('rise', 'Step height', .2, 1.2, .46), range('side', 'Diagonal', -1, 1, .3),
      range('restUp', 'Tip up', 0, 1.2, .8, .01, {hint: 'how far each photo leans up toward you as it rests on a step'}),
      G('Motion'), range('airTime', 'Air time', .3, .6, .48), range('hop', 'Hop', 0, 1.5, .6), whole('flips', 'Flips', 1, 2, 1, {unit: '×'}),
      range('cascade', 'Cascade', 0, 1, .7, .01, {hint: 'lower photos jump first, so the hop ripples up the stairs'}), range('rock', 'Rock back', 0, 1, .5), range('settle', 'Settle', 0, 1, .6),
      G('Look'), range('paper', 'Paper flex', 0, 1, .6), range('view', 'Camera height', -1, 1.5, 0), off('farDim', 'Top shade', .6)],
    camera: (P, E) => ({eye: [0, 2.2 + P.view, 5], target: [0, -.12, -.1]}),
    layout(i, P, E){
      const n = E.n, fl = P.airTime, w = E.p * n + i + P.cascade * .2 * i / n, j = Math.floor(w), lam = w - j, J = wrap(j, n);
      const run = E.h * P.run, rise = E.h * P.rise, side = E.w * P.side;
      const st = q => [(q - (n - 1) / 2) * side, ((n - 1) / 2 - q) * rise - .1, (q - (n - 1) / 2) * run];
      const t = clamp01((lam - (1 - fl)) / fl), a = st(J), b = st(J + 1), up = P.restUp;
      // the arc runs on a softened clock (mostly linear, eased at the ends) so take-off and landing never jerk
      const tau = lerp(t, ease.inOutSine(t), .6), crouch = t > 0 ? 0 : -P.rock * .32 * bump((lam - (1 - fl - .2)) / .2, .55);
      const th = t > 0 ? Math.round(P.flips) * TAU * lerp(t, sm5(t), .5) : crouch, after = t > 0 ? 0 : lam, set = P.settle * wob(after, 34, 11);
      let x = lerp(a[0], b[0], tau), y = lerp(a[1], b[1], tau) + P.hop * E.h * 4 * tau * (1 - tau), z = lerp(a[2], b[2], tau);
      y += E.h * .5 * ab(Math.sin(th + up)) + .006 + E.h * .1 * ab(set);
      // card stock flexes against the spin in the air and squashes on landing
      const bendY = P.paper * (2.2 * Math.sin(PI * t) * (t > 0 ? 1 : 0) - 3 * wob(after, 40, 13));
      let o = 1, sc = 1;
      if (J === 0 && t === 0){ const e = sm5(lam / Math.max(.2, (1 - fl) * .85)); o = e; y += (1 - e) * .5; sc = .85 + .15 * e; }
      if (J === n - 1){ o = 1 - sm5((t - .1) / .8); sc = 1 - .15 * sm5(t); }
      const yaw = Math.atan2(side, run), J1 = J + tau;
      return {m: M(T(x, y, z), RY(yaw), RX(-PI / 2 + up + th + set * .25), S(sc, sc, 1)), bendY, o, b: 1 - P.farDim * (1 - J1 / Math.max(1, n - 1))};
    }},

  // Double Doors: a corridor of photo door pairs in depth. The camera's view glides forward one doorway at a time on a
  // long, eased dolly; as a pair reaches you its doors swing open toward you, flexing a little and parting outward, and
  // dissolve as you pass through, while the next pair resolves out of the distance. Liquid-glass rims with dispersion on the doors (card glass).
  {...NEW, id: 'double-doors', name: 'Double Doors', n: 6, aspect: .62, cardH: 1.18, step: true, perCard: 2,
    desc: 'Two photo doors swing open toward you and reveal the next pair behind them.',
    style: {cardGlass: {on: true, width: .26, refraction: .75, dispersion: 1}},
    params: [G('Layout'), range('seam', 'Seam', 0, .2, .05), range('depthD', 'Door spacing', .3, 1.6, .85),
      G('Motion'), range('swing', 'Swing', 50, 95, 84, 1, {unit: '°'}), range('lag', 'Right door lag', -1, 1, .3), range('part', 'Slide apart', 0, 1, .35),
      range('zoom', 'Zoom through', 0, 1, .6, .01, {hint: 'how far the opening doors sweep toward you'}), range('doorCurve', 'Door flex', 0, 1, .4),
      G('Look'), range('doorShade', 'Door shade', 0, 1, .35), range('backShade', 'Behind shade', 0, .7, .3), range('farFade', 'Distance fade', 0, 1, .6), off('farBlur', 'Distance blur', 1)],
    fill: (P, E) => ({count: 2 * E.n}),
    layout(i, P, E){
      const n = E.n, pr = i >> 1, side = i & 1 ? 1 : -1, im = (2 * pr + (side > 0 ? 1 : 0)) % n, W = E.w, gs = P.seam * W * .5;
      // u: doorways passed so far, eased with a hold at each closed pair; d: this pair's distance ahead (0 = at the doorway)
      const u = stepU(E.p, n, E.hold * .5, sm5), d = wrap(pr - u + 1, n) - 1;
      const lg = (side > 0 ? Math.max(0, P.lag) : Math.max(0, -P.lag)) * .14, dd = d + lg;
      const open = sm5(-dd / .9), th = open * P.swing * D2R;
      const z = -d * P.depthD + P.zoom * .55 * open * open, xo = side * open * P.part * W * .55;
      // long, eased dissolves at both ends of the corridor, never a hard cut
      const farEnd = Math.min(2.6, n - 1.05), farStart = Math.min(1.1, farEnd - .9);
      const o = (1 - sm5((-d - .3) / .65)) * (1 - sm5((d - farStart) / (farEnd - farStart))) * (1 - P.farFade * .5 * sm5(d / 2));
      const m = M(T(side * (W + gs) + xo, 0, z), RY(side * th), T(-side * W / 2, 0, 0));
      if (o < .004) return {o: 0, s: 0, img: im};
      return {m, o, bend: P.doorCurve * 1.8 * Math.sin(PI * open), img: im, zBias: 2 - d,
        b: 1 - P.backShade * sm5(d / 1.6) - P.doorShade * .5 * Math.sin(th), blur: P.farBlur * sm5(d / 2) * .6};
    }},

  // Starburst: rays of photos bloom out from the centre on a long ease with a soft swell past their mark, turn as a
  // ring, then gather back in after a little outward breath. Cards curl along their ray while they travel (curl follows
  // speed), flatten at rest, and tip toward you mid-flight for depth.
  {...NEW, id: 'starburst', name: 'Starburst', n: 12, aspect: .62, cardH: .23, dur: 11, fov: 30,
    desc: 'Photos burst out from the centre in rays, then pull back in.',
    params: [G('Layout'), whole('rays', 'Rays', 6, 20, 12), whole('rings', 'Rings', 1, 4, 3), range('reach', 'Reach', .6, 1.4, 1, .01, {unit: '×'}), range('growth', 'Outer size', 0, 1, .35),
      range('ringTwist', 'Ring offset', 0, 1, 0),
      G('Motion'), range('sweep', 'Sweep', 0, 1, .4, .01, {hint: 'rays fire one after another round the circle'}), range('ringDelay', 'Ring delay', 0, .08, .045), range('kick', 'Overshoot', 0, 3, 1.4),
      whole('twirl', 'Turns', -2, 2, 1, {unit: '×'}), {key: 'twirlMode', label: 'Rings turn', type: 'seg', options: {counter: 'Counter', same: 'Same way'}, def: 'counter'}, range('pop', 'Pop out', 0, 1.5, .6),
      G('Look'), range('curl', 'Curl', 0, 1, .55), range('coreDim', 'Core shade', 0, .7, .25)],
    camera: (P, E) => ({eye: [0, 0, E.D * 1.2], target: [0, 0, 0]}),
    fill: (P, E) => ({count: Math.round(P.rays) * Math.round(P.rings)}),
    layout(i, P, E){
      const R = Math.round(P.rays), Rg = Math.round(P.rings), j = Math.floor(i / R), k = i % R, sw = P.sweep * .15 * k / R;
      const span = (Rg - 1) * P.ringDelay + P.sweep * .15, sc = Math.min(1, .18 / Math.max(1e-3, span));
      const dOut = (j * P.ringDelay + sw) * sc, dIn = ((Rg - 1 - j) * P.ringDelay + sw) * sc;
      // out on a long smootherstep with a swell past the mark; in after a small outward breath; all with zero end speeds
      const ext = p => { const to = (p - dOut) / .32, ti = (p - .56 - dIn) / .24;
        return (sm5(to) + P.kick * .1 * bump(to, .62)) * (1 - sm5(ti) + P.kick * .05 * bump(ti, .3)); };
      const x = ext(E.p), vel = (ext(E.p + .003) - ext(E.p - .003)) / .006;
      const dir = String(P.twirlMode) === 'same' || j % 2 === 0 ? 1 : -1, rot = dir * TAU * Math.round(P.twirl) * sm5((E.p - .12) / .66);
      const a = (k + (j % 2) * P.ringTwist * .5) / R * TAU + rot, rOut = (.36 + j * .3) * P.reach, rIn = .08 + j * .06;
      const r = lerp(rIn, rOut, x), e1 = clamp01(x), s = lerp(.45, 1 + P.growth * j * .3, Math.max(0, x) ** .7), lift = Math.sin(PI * e1);
      return {m: M(T(0, 0, P.pop * .5 * lift + j * .004), RZ(a - PI / 2), T(0, r, 0), RX(-P.pop * .5 * lift), S(s, s, 1)),
        bendY: -P.curl * Math.tanh(vel * .35) * 2.2 / s, b: 1 - P.coreDim * (1 - e1), zBias: -j};
    }},

  // Opening Crawl: photos rise up a vertical sheet facing you, then roll back over a soft crest like paper over a
  // drum (each card bending to the curve as it crosses), and recede up the tilted plane into the distance.
  {...NEW, id: 'opening-crawl', name: 'Opening Crawl', n: 8, aspect: 1.35, cardH: .5, dur: 26, fov: 34,
    desc: 'Photos scroll up a tilted plane and recede into the distance.',
    params: [G('Layout'), {key: 'cols', label: 'Columns', type: 'seg', options: {'1': 'One', '2': 'Two'}, def: '1'}, P_GAP(.14), range('lay', 'Lay back', 50, 84, 72, 1, {unit: '°'}),
      range('crest', 'Crest height', -.4, .4, -.12), range('crestLen', 'Crest softness', .3, 2, 1.25), range('reach', 'Length', 6, 22, 14), range('colOffset', 'Column offset', 0, 1, .5),
      G('Motion'), off('tick', 'Tick', 1, {hint: 'the crawl pauses on each photo'}), off('sway', 'Sway', 1),
      G('Look'), range('farFade', 'Distance fade', 0, 1, .7), range('farDim', 'Distance shade', 0, 1, .2), off('farBlur', 'Distance blur', 1)],
    camera: (P, E) => ({eye: [0, .85, E.D], target: [0, .05, 0]}),
    fill(P, E){ const cols = String(P.cols) === '2' ? 2 : 1, pitch = E.h * (1 + P.gap), per = Math.ceil(E.n / cols), rows = per * Math.max(1, Math.ceil(P.reach / pitch / per)); return {cols, rows, pitch, count: rows * cols}; },
    layout(i, P, E){
      const c = i % E.cols, row = Math.floor(i / E.cols), N = E.rows, q = P.tick ? lerp(E.p * N, stepU(E.p, N, .45, ease.inOutCubic), P.tick) : E.p * N;
      const v = wrap(row + q + c * P.colOffset * .5, N), x = (c - (E.cols - 1) / 2) * E.w * (1 + P.gap), u = v / N;
      // arc length along the surface: rows start below the frame and climb toward the crest
      const s0 = -(P.crest + E.vy + E.h * .7), s = s0 + v * E.pitch, at = crawlPath(P.lay * D2R, P.crestLen)(s);
      const sway = P.sway * .3 * Math.sin(s * .45 - TAU * E.p * 2);
      const o = sm5(v / 1.2) * (1 - sm5((v - (N - 2.5)) / 2.2)) * (1 - P.farFade * sm5((u - .2) / .75));
      return {m: M(T(x + sway, P.crest + at.y, at.z), RX(-at.th)), bendY: at.k, o, b: 1 - P.farDim * sm5((u - .1) / .8), blur: P.farBlur * sm5((u - .15) / .75) * .6, img: (row * E.cols + c) % E.n};
    }},
];
