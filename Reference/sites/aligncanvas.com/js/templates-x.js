// Gallery, kinetic and sculpture templates. Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p so the loop is seamless.
import { TAU, clamp01, sstep, wrap, ease, mat4, lerp } from './math.js';
import { rel, stepU, stepSpeed, ab, wrapFade, fillSlots, stripFill, M, T, RX, RY, RZ, S, aim, fibo, frame3,
  P_EASE, P_GAP, P_RADIUS, P_SPREAD } from './kit.js';

export const X_CATEGORIES = [['gallery', 'Infinite Gallery'], ['kinetic', 'Kinetic'], ['sculpture', 'Sculpture']];

const PI = Math.PI;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const turns = (key = 'turns', label = 'Turns', def = 1) => whole(key, label, -3, 3, def, {unit: '×', hint: 'whole turns per loop, so it stays seamless'});
const cyc = (key, label, min, max, def) => whole(key, label, min, max, def, {unit: '×', hint: 'whole cycles per loop, so it stays seamless'});
const off = (key, label, max, def = 0, step = .01) => range(key, label, 0, max, def, step, {off: true});
const grp = group => ({group});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
// smooth 0 → 1 → 0 over the loop: rest, act, rest
const pulse = (p, a, b, c, d) => sstep(a, b, p) - sstep(c, d, p);
// a seeded random sequence that doesn't depend on the media seed
const rng = seed => { let s = (seed * 2654435761) >>> 0; return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
const NEW = {isNew: true, set: 'photos', frame: '5:4'};
const SALON = [[[.75, 1.3]], [[1.4, .62], [1, .58]], [[1.5, .86]], [[1, .4], [1, .4], [1, .4]], [[.8, .8], [1.3, .5]], [[.7, 1.05]]];

/* ===================== Infinite Gallery ===================== */
const GALLERY = [
  {...NEW, id: 'crate', name: 'Vinyl Crate', cat: 'gallery', n: 40, aspect: .8, cardH: .36, dur: 36,
    desc: 'A ring of photos standing edge-on like records in a crate, turning slowly under a high camera.',
    params: [grp('Layout'), P_RADIUS(1), range('oval', 'Oval', -.5, .5, 0), range('tilt', 'View angle', 0, 1.4, .72), range('lean', 'Lean', -1, 1, .18),
      grp('Motion'), cyc('revs', 'Turns', -2, 2, 1), off('pull', 'Pull-out', .6), range('wobble', 'Wobble', 0, .4, .06), cyc('wobSp', 'Wobble speed', 0, 4, 2),
      grp('Look'), range('backShade', 'Back shade', 0, .6, .2), off('fog', 'Depth blur', 1)],
    layout(i, P, E){
      const R = .9 * P.radius, a = (i / E.n + E.p * Math.round(P.revs)) * TAU, c = Math.cos(a);
      const y = P.wobble * Math.sin(a * 3 + E.p * TAU * Math.round(P.wobSp)) + P.pull * Math.pow(Math.max(0, c), 12);
      return {m: M(RX(P.tilt), T(R * (1 + P.oval) * Math.sin(a), y, R * (1 - P.oval) * c), RY(a + PI / 2 + P.lean)), b: 1 - P.backShade + P.backShade * c, blur: P.fog * (.5 - .5 * c)};
    }},

  {...NEW, id: 'fisheye', name: 'Fisheye Wall', cat: 'gallery', n: 24, aspect: .8, cardH: .6, dur: 60,
    desc: 'An endless wall of photos drifting diagonally under a fisheye lens; the edges bow away.',
    params: [grp('Layout'), range('bulge', 'Bulge', 0, 1, .78), P_GAP(.16), off('brick', 'Brick offset', 1), off('flatten', 'Face camera', 1),
      grp('Motion'), whole('driftX', 'Drift X', -2, 2, 1, {unit: '×', hint: 'whole wall widths per loop, so every photo comes back to its place'}), whole('driftY', 'Drift Y', -2, 2, 1, {unit: '×'}),
      off('breath', 'Lens breathe', 1), off('swirl', 'Lens swirl', 1),
      grp('Look'), range('edgeShade', 'Edge shade', 0, 1, .3), off('edgeBlur', 'Edge blur', 1)],
    fill(P, E){
      const Rs = lerp(7, 1.3, P.bulge), gx = E.w * (1 + P.gap), gy = E.h * (1 + P.gap);
      // enough columns and rows to reach the sphere's horizon, or the frame edge if that comes first
      const ax = Math.min(1.5, (E.vx + E.w) / Rs * 1.15) + .35, ay = Math.min(1.5, (E.vy + E.h) / Rs * 1.15) + .35;
      const cols = Math.min(24, 2 * Math.ceil(ax * Rs / gx) + 1), rows = Math.min(20, 2 * Math.ceil(ay * Rs / gy) + 1);
      return {Rs, cols, rows, gx, gy, count: cols * rows};
    },
    layout(i, P, E){
      const c = i % E.cols, r = Math.floor(i / E.cols), k = 1 + P.breath * .4 * (.5 - .5 * Math.cos(TAU * E.p));
      const ux = wrap(c + (r % 2) * P.brick * .5 + E.p * P.driftX * E.cols, E.cols) - E.cols / 2 + .5, uy = wrap(r + E.p * P.driftY * E.rows, E.rows) - E.rows / 2 + .5;
      let th = ux * E.gx / E.Rs * k, ph = uy * E.gy / E.Rs * k;
      if (P.swirl){ const g = P.swirl * Math.hypot(th, ph), c = Math.cos(g), sn = Math.sin(g); [th, ph] = [th * c - ph * sn, th * sn + ph * c]; }
      const cp = Math.cos(ph), Rs = E.Rs;
      const nx = Math.sin(th) * cp, ny = Math.sin(ph), nz = Math.cos(th) * cp, psi = Math.acos(Math.max(-1, Math.min(1, nz))), A = aim(nx, ny, nz);
      const o = clamp01((1.5 - psi) * 3) * clamp01((E.cols / 2 - ab(ux)) * 2) * clamp01((E.rows / 2 - ab(uy)) * 2);
      return {x: Rs * nx, y: Rs * ny, z: Rs * (nz - 1), rx: A.rx * (1 - P.flatten), ry: A.ry * (1 - P.flatten), o, b: 1 - P.edgeShade * (1 - nz), blur: P.edgeBlur * clamp01(psi / 1.3), img: r * E.cols + c};
    }},

  {...NEW, id: 'planetarium', name: 'Planetarium', cat: 'gallery', n: 80, aspect: .8, cardH: 1.2, dur: 40, fov: 72,
    desc: 'Stand inside a slowly turning sphere of photos; a soft spotlight follows your gaze.',
    params: [grp('Layout'), range('radius', 'Radius', 2, 6, 3.2), range('jitter', 'Scatter', 0, 1, .45), off('band', 'Band', 1), range('axis', 'Axis tilt', -.6, 1.2, .32),
      grp('Motion'), turns('whirl', 'Turns', 1), range('swell', 'Breathe', 0, .3, .04), off('nod', 'Nod', .6),
      grp('Look'), range('focus', 'Spotlight', .3, 4, 1.5), range('aimX', 'Spotlight pan', -.8, .8, 0), range('dreamy', 'Haze', 0, 1, .35)],
    camera: () => ({eye: [0, 0, 0], target: [0, 0, -1]}),
    layout(i, P, E){
      const y0 = (1 - 2 * (i + .5) / E.n) * (1 - P.band * .85), r0 = Math.sqrt(Math.max(0, 1 - y0 * y0)), g = i * 2.399963229728653;
      let x = Math.cos(g) * r0, y = y0, z = Math.sin(g) * r0;
      x += (E.rnd(i, 1) - .5) * .5 * P.jitter; y += (E.rnd(i, 2) - .5) * .5 * P.jitter; z += (E.rnd(i, 3) - .5) * .5 * P.jitter;
      const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
      const a = E.p * TAU * P.whirl, ca = Math.cos(a), sa = Math.sin(a), tl = P.axis + P.nod * Math.sin(E.p * TAU), ct = Math.cos(tl), st = Math.sin(tl);
      [x, z] = [x * ca + z * sa, -x * sa + z * ca]; [y, z] = [y * ct - z * st, y * st + z * ct];
      const R = P.radius * (1 + P.swell * Math.sin(TAU * (2 * E.p + E.rnd(i, 4)))), c = -z * Math.cos(P.aimX) + x * Math.sin(P.aimX);
      return {x: x * R, y: y * R, z: z * R, ...aim(-x, -y, -z), o: Math.pow(sstep(-.2, 1, c), P.focus), b: .75 + .25 * Math.max(0, c), blur: (1 - Math.max(0, c)) * P.dreamy};
    }},

  {...NEW, id: 'dock', name: 'Thumb Dock', cat: 'gallery', n: 8, aspect: .8, step: true, perCard: 2.2,
    desc: 'A full-bleed hero with a dock of thumbnails; the dock scrolls and each thumb becomes the hero.',
    params: [grp('Layout'), seg('orient', 'Dock', {v: 'Vertical', h: 'Horizontal'}, 'v'), range('thumb', 'Thumb size', .5, 2, 1), range('side', 'Dock position', -1, 1, 0), P_GAP(.18),
      grp('Motion'), range('zoom', 'Hero zoom', 0, .25, .07), range('pan', 'Hero pan', -1, 1, 0), off('slideIn', 'Slide in', 1), range('pop', 'Active pop', 0, .6, .28),
      grp('Look'), range('heroTone', 'Hero brightness', .5, 1.2, .96), off('falloff', 'Thumb falloff', 1)],
    fill: (P, E) => ({count: 2 * E.n}),
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), k = Math.floor(u), f = u - k;
      if (i < n){
        // heroes cover the frame; the next one fades in on top while the current one keeps drifting closer
        const cur = wrap(k, n), nxt = wrap(k + 1, n), live = i === cur ? 1 : i === nxt ? 2 : 0;
        const age = live === 1 ? 1 + f : f, s = 1 + P.zoom * age * .5;
        return {x: P.pan * (s - 1) * E.asp + (live === 2 ? (1 - f) * P.slideIn * 2 * E.asp : 0), h: 2.04, aspect: E.asp, s, o: live === 1 ? 1 : live === 2 ? f : 0, zBias: live === 2 ? 2 : live, b: P.heroTone};
      }
      const j = i - n, r = rel(j, u, n), th = .24 * P.thumb, pitch = th * (1 + P.gap), near = 1 - Math.min(1, ab(r)), H = P.orient === 'h';
      return {x: H ? r * pitch : P.side * (E.asp - th), y: H ? P.side * (1 - th) : -r * pitch, z: .05, h: th, aspect: 1, s: 1 + P.pop * near,
        o: wrapFade(r, n) * (1 - P.falloff * Math.min(1, ab(r) / 3)), zBias: 10 + near, img: j};
    }},

  {...NEW, id: 'salon', name: 'Salon Wall', cat: 'gallery', n: 17, aspect: .8, cardH: .8, dur: 34,
    mods: {poseRy: -16},
    desc: 'A salon-style hang of mixed sizes gliding past, like walking a crowded gallery wall.',
    params: [grp('Layout'), P_GAP(.1), range('contrast', 'Size contrast', 0, 1.5, 1), range('stagger', 'Stagger', 0, 1, .5), range('depth', 'Depth', 0, .5, .12), off('crooked', 'Crooked', .3),
      grp('Motion'), cyc('passes', 'Walk speed', 1, 3, 1), off('swing', 'Swing', .15), off('approach', 'Approach', 1),
      grp('Look'), off('edgeDim', 'Edge dim', 1), off('edgeBlur', 'Edge blur', 1)],
    fill(P, E){
      // columns follow a repeating pattern: one tall, a stacked pair, one wide, three small
      const pat = SALON.map(col => col.map(([a, h]) => [a, Math.pow(h, P.contrast)]));
      const g = P.gap * E.h, cards = [];
      let x = 0, pi = 0;
      while (cards.length < E.n){
        const col = pat[pi++ % pat.length], wCol = Math.max(...col.map(([a, h]) => a * h)) * E.h, hCol = col.reduce((s, [, h]) => s + h * E.h, 0) + g * (col.length - 1);
        let y = hCol / 2, dy = (E.rnd(pi, 5) - .5) * P.stagger * .3;
        for (const [a, h] of col){ if (cards.length >= E.n) break; const hh = h * E.h; cards.push({x: x + wCol / 2, y: y - hh / 2 + dy, h: hh, a}); y -= hh + g; }
        x += wCol + g * 1.6;
      }
      const copies = Math.max(1, Math.min(8, Math.ceil((2 * E.vx + 2 * E.w) / x))) + 1;
      return {salon: cards, Lx: x, copies, count: E.n * copies};
    },
    layout(i, P, E){
      const k = i % E.n, c = E.salon[k], L = E.Lx * E.copies, x = wrap(c.x + Math.floor(i / E.n) * E.Lx - E.p * E.Lx * Math.round(P.passes), L) - L / 2, q = Math.min(1, ab(x) / E.asp);
      return {x, y: c.y, z: (E.rnd(k, 6) - .5) * P.depth + P.approach * .5 * (1 - q) * (1 - q), rz: (E.rnd(k, 7) - .5) * P.crooked + P.swing * Math.sin(TAU * (2 * E.p + E.rnd(k, 8))),
        h: c.h, aspect: c.a, o: clamp01((L / 2 - ab(x)) / (E.w * .8)), b: 1 - P.edgeDim * q, blur: P.edgeBlur * q * q};
    }},

  {...NEW, id: 'mirror', name: 'Mirror Floor', cat: 'gallery', n: 10, aspect: .8, cardH: .7, dur: 22,
    desc: 'Photos walk along a glossy floor, each with its reflection, on a gentle arc.',
    params: [grp('Layout'), P_GAP(.14), range('floor', 'Floor height', -.9, 0, -.42), range('arc', 'Arc', 0, 1, .35),
      grp('Motion'), range('hop', 'Hop', 0, .3, .06), whole('hops', 'Hops per card', 1, 3, 1), off('tip', 'Tip', .4),
      grp('Look'), range('reflect', 'Reflection', 0, .8, .32), range('rGap', 'Reflection gap', 0, .3, .01), range('rBlur', 'Reflection blur', 0, 1, .15), off('edgeDim', 'Edge dim', 1)],
    fill(P, E){ const F = stripFill(E, E.vx, E.w * (1 + P.gap)); return {m: F.m, count: 2 * F.m}; },
    layout(i, P, E){
      const j = i % E.m, refl = i >= E.m, r = rel(j, E.p * E.n, E.m), x = r * E.w * (1 + P.gap), hn = Math.round(P.hops);
      const floor = P.floor, y = floor + E.h / 2 + P.hop * ab(Math.sin(PI * r * hn)), z = -P.arc * x * x * .35, ry = -P.arc * x * .3, rz = P.tip * Math.sin(TAU * r * hn);
      const o = wrapFade(r, E.m), b = 1 - P.edgeDim * Math.min(1, ab(x) / E.asp);
      if (!refl) return {x, y, z, ry, rz, o, b};
      return {m: M(T(x, 2 * floor - y - P.rGap, z), RY(ry), RZ(-rz), S(1, -1, 1)), o: o * P.reflect, b: .85 * b, blur: P.rBlur, zBias: -1};
    }},

  {...NEW, id: 'rack-focus', name: 'Rack Focus', cat: 'gallery', n: 18, aspect: .8, cardH: .72, dur: 26,
    desc: 'Drift through a deep field of photos; each one snaps into focus as it passes the focal plane.',
    params: [grp('Layout'), range('depth', 'Depth', 4, 16, 10), P_SPREAD(1), off('tunnel', 'Tunnel', 1), range('crooked', 'Crooked', 0, 1.2, .12),
      grp('Motion'), range('spiral', 'Spiral', -2, 2, 0, .01, {unit: ' turns'}), off('pull', 'Focus pull', 3),
      grp('Look'), range('focal', 'Focus distance', -3, 1.5, -.4), range('blur', 'Blur', 0, 1.5, .8), off('dimOOF', 'Out-of-focus dim', .8), range('fadeIn', 'Fade in', .02, .5, .14)],
    layout(i, P, E){
      const s = wrap(i / E.n + E.p, 1), z = lerp(-P.depth, 2, s), vis = (E.D - z) / E.D, ax = E.asp * vis * .62 * P.spread, ay = vis * .58 * P.spread;
      let x = (E.rnd(i, 1) - .5) * 2 * ax, y = (E.rnd(i, 2) - .5) * 2 * ay;
      if (P.tunnel){ const g = E.rnd(i, 4) * TAU, k = .75 + .25 * E.rnd(i, 5); x = lerp(x, Math.cos(g) * ax * k, P.tunnel); y = lerp(y, Math.sin(g) * ay * k, P.tunnel); }
      if (P.spiral){ const g = P.spiral * TAU * s, c = Math.cos(g), sn = Math.sin(g); [x, y] = [x * c - y * sn, x * sn + y * c]; }
      const bl = clamp01(ab(z - P.focal - P.pull * Math.sin(E.p * TAU)) * .22 * P.blur);
      return {x, y, z, rz: (E.rnd(i, 3) - .5) * P.crooked, blur: bl, b: 1 - P.dimOOF * bl, o: sstep(0, P.fadeIn, s) * (1 - sstep(.86, 1, s))};
    }},

  {...NEW, id: 'page-turn', name: 'Page Turn', cat: 'gallery', n: 8, aspect: .8, step: true, perCard: 1.5, cardH: .95,
    mods: {poseRx: 24, poseRy: -12},
    desc: 'A photo book: each page curls over the spine to reveal the next spread.',
    params: [grp('Form'), off('openV', 'Book open', .6), off('gutter', 'Gutter', .3), range('lift', 'Lift', 0, .6, .35), range('curl', 'Curl', 0, 2, .9),
      grp('Motion'), off('flutter', 'Flutter', 1), off('swing', 'Swing out', 1),
      grp('Look'), range('pageShade', 'Page shade', 0, .6, .04), range('backTone', 'Back page tone', .5, 1.2, 1)],
    fill: (P, E) => ({count: 2 * E.n}),
    layout(i, P, E){
      const n = Math.max(4, E.n), j = i % E.n, back = i >= E.n, half = n / 2, u = stepU(E.p, E.n, E.hold, E.ez), s = wrap(u - j, E.n), oa = P.openV;
      let th, z, zb, tp = 0;
      if (s < 1){ th = oa + (PI - 2 * oa) * s; z = 0; zb = 6; tp = s; }
      else if (s < half){ th = PI - oa; z = (half - s) * .004; zb = 3 - s / n; }
      else if (s < half + 1){ th = PI - oa + (PI + 2 * oa) * (s - half); z = -.02; zb = -2; }
      else { th = oa; z = (s - half) * .004; zb = 1 + s / n; }
      const bend = Math.sin(th) * P.curl + P.flutter * Math.sin(TAU * tp) * .8;
      const m = M(T(0, Math.sin(PI * tp) * P.lift * .3, z), RY(-th), RX(-P.swing * .5 * Math.sin(PI * tp)), T(E.w / 2 + P.gutter, 0, 0));
      // two cards back to back make a page: the front is the right-hand page, the back shows on the left
      const front = Math.cos(th) > 0 || th > PI * 1.5;
      if (!back) return {m, bend, zBias: zb + (front ? .5 : 0), b: 1 - P.pageShade + P.pageShade * Math.cos(th), img: j};
      return {m: M(m, T(0, 0, -.003), RY(PI)), bend: -bend, zBias: zb + (front ? 0 : .5), b: P.backTone, img: wrap(j + Math.floor(E.n / 2), E.n)};
    }},

  {...NEW, id: 'puzzle', name: 'Sliding Puzzle', cat: 'gallery', n: 24, fixedN: true, aspect: 1, cardH: .42, dur: 20,
    desc: 'A sliding tile puzzle that shuffles itself, then slides every tile back home.',
    params: [grp('Layout'), whole('grid', 'Grid', 3, 6, 4), P_GAP(.06), off('loose', 'Loose tiles', 1),
      grp('Motion'), whole('moves', 'Moves', 4, 30, 12), whole('shuffle', 'Shuffle', 1, 50, 7), range('pause', 'Pause', 0, .8, .35), P_EASE, range('liftT', 'Lift', 0, .4, .06), off('tip', 'Tip', .8),
      grp('Look'), off('restDim', 'Rest dim', .6)],
    fill(P, E){
      const G = Math.round(P.grid), N = G * G, R = rng(P.shuffle * 31 + G), K = Math.round(P.moves);
      // a random walk of the empty cell, then the same walk backwards, so the board ends solved
      let e = N - 1, prev = -1; const walk = [];
      for (let k = 0; k < K; k++){
        const nb = [e - G, e + G, e % G ? e - 1 : -1, e % G < G - 1 ? e + 1 : -1].filter(c => c >= 0 && c < N && c !== prev);
        const c = nb[Math.floor(R() * nb.length)]; walk.push(c); prev = e; e = c;
      }
      const steps = walk.concat(walk.slice(0, -1).reverse(), [N - 1]);
      const cell = Array.from({length: N - 1}, (_, t) => t), at = Array.from({length: N}, (_, c) => c < N - 1 ? c : -1);
      const U = E.p * steps.length, done = Math.floor(U), f = E.ez(clamp01((U - done - P.pause) / Math.max(.05, 1 - P.pause)));
      let empty = N - 1, moving = -1, from = -1, to = -1;
      for (let k = 0; k <= done && k < steps.length; k++){
        const c = steps[k], t = at[c];
        if (k === done){ moving = t; from = c; to = empty; break; }
        at[empty] = t; cell[t] = empty; at[c] = -1; empty = c;
      }
      return {G, cell, moving, from, to, f, count: N - 1};
    },
    layout(i, P, E){
      const G = E.G, pitch = 1.86 / G, pos = c => [(c % G - (G - 1) / 2) * pitch, ((G - 1) / 2 - Math.floor(c / G)) * pitch];
      let [x, y] = pos(E.cell[i]), z = 0, rx = 0, ry = 0;
      if (i === E.moving){ const [x0, y0] = pos(E.from), [x1, y1] = pos(E.to), k = Math.sin(PI * E.f); x = lerp(x0, x1, E.f); y = lerp(y0, y1, E.f); z = P.liftT * k; ry = P.tip * k * Math.sign(x1 - x0); rx = -P.tip * k * Math.sign(y1 - y0); }
      return {x, y, z, rx, ry, rz: (E.rnd(i, 1) - .5) * P.loose * .4, h: pitch * (1 - P.gap), aspect: 1, zBias: i === E.moving ? 2 : 0, b: i === E.moving ? 1 : 1 - P.restDim, img: i};
    }},

  {...NEW, id: 'river', name: 'Photo River', cat: 'gallery', n: 26, aspect: .8, cardH: .55, dur: 28, fov: 40,
    desc: 'Photos float down a winding river toward you, turning slowly on the current.',
    params: [grp('Layout'), range('meander', 'Meander', 0, 1.5, 1), range('bends', 'Bends', .5, 3, 1.35), range('width', 'River width', 0, 1.5, .9), range('far', 'Distance', 4, 20, 10), range('tiltUp', 'Tilt up', 0, 1.3, .32),
      grp('Motion'), whole('twirl', 'Twirl', -3, 3, 1, {unit: '×'}), range('bob', 'Bob', 0, .1, .025), off('rock', 'Rock', .5),
      grp('Look'), off('haze', 'Distance haze', 1), off('farDim', 'Distance dim', .8)],
    camera: (P, E) => ({eye: [0, 1.7, E.D * .95], target: [0, -.35, -1.2]}),
    layout(i, P, E){
      const s = wrap(i / E.n + E.p, 1), z = lerp(-P.far, 2.2, s), x = P.meander * Math.sin(s * TAU * P.bends + .7) * (1.2 - s * .5) + (E.rnd(i, 1) - .5) * P.width;
      const w = TAU * (2 * E.p + E.rnd(i, 2)), y = -.5 + P.bob * Math.sin(w);
      return {m: M(T(x, y, z), RX(-PI / 2 + P.tiltUp), RY(P.rock * Math.cos(w)), RZ(E.rnd(i, 3) * TAU + P.twirl * E.p * TAU * (i % 2 ? 1 : -1))),
        o: sstep(0, .2, s) * (1 - sstep(.9, 1, s)), b: 1 - P.farDim * (1 - s), blur: P.haze * (1 - s) * (1 - s)};
    }},

  {...NEW, id: 'slots', name: 'Slot Reels', cat: 'gallery', n: 17, aspect: 1, cardH: .5, dur: 9,
    desc: 'Reels of photos spin up, stop one after another with a bounce, and spin again.',
    params: [grp('Layout'), whole('reels', 'Reels', 1, 6, 3), P_GAP(.12), range('reelR', 'Reel radius', .8, 1.6, 1),
      grp('Motion'), seg('spins', 'Spins per loop', {1: '1', 2: '2', 4: '4'}, '2'), whole('laps', 'Laps', 1, 4, 2), range('stagger', 'Stop delay', 0, .2, .08), range('bounce', 'Bounce', 0, 2, 1),
      grp('Look'), range('drumShade', 'Drum shade', 0, 1, .45), range('mblur', 'Motion blur', 0, 3, 1.2), off('winner', 'Winner pop', .3)],
    fill: (P, E) => ({count: Math.round(P.reels) * 8}),
    layout(i, P, E){
      const R = Math.round(P.reels), reel = Math.floor(i / 8), k = i % 8, Sp = Number(P.spins), adv = 8 / Sp + 8 * Math.round(P.laps);
      const q = E.p * Sp, j = Math.floor(q), f = q - j, st = .06 + reel * P.stagger, len = .72 - (R - 1) * P.stagger * .2;
      const g = f < st ? 0 : f > st + len ? 1 : (() => { const t = (f - st) / len, c1 = 1.70158 * P.bounce, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); })();
      const turn = (j * adv + g * adv) / 8 * TAU, a = k / 8 * TAU - turn, rad = E.h * 1.04 * P.reelR / (2 * Math.tan(PI / 8)), ca = Math.cos(a);
      const sp = f > st && f < st + len ? (1 - (f - st) / len) : 0, won = f < st ? 1 - sstep(st - .04, st, f) : sstep(st + len, st + len + .06, f);
      return {x: (reel - (R - 1) / 2) * E.w * (1 + P.gap), y: rad * Math.sin(a), z: rad * ca - rad, rx: -a, s: 1 + P.winner * won * Math.pow(Math.max(0, ca), 6),
        o: clamp01((ca + .1) * 3), b: 1 - P.drumShade + P.drumShade * Math.max(0, ca), blur: Math.min(.8, sp * P.mblur), img: reel * 8 + k};
    }},

  {...NEW, id: 'aperture', name: 'Aperture', cat: 'gallery', n: 7, aspect: .8, step: true, perCard: 2.4, cardH: 1.5,
    desc: 'Photo blades close like a camera iris, and open on the next image.',
    params: [grp('Layout'), whole('blades', 'Blades', 5, 12, 8), range('blade', 'Blade length', .8, 2.2, 1.5), range('bladeW', 'Blade width', .3, 1.2, .62), range('open', 'Open width', 1.2, 2.6, 2.05), range('closed', 'Closed size', 0, .8, .26),
      grp('Motion'), range('twist', 'Twist', 0, 1.5, .7), range('roll', 'Blade roll', 0, 1.5, .4), cyc('irisTurn', 'Iris turns', -2, 2, 0),
      grp('Look'), range('bladeTone', 'Blade tone', .3, 1.2, .9), off('heroDim', 'Hero dim', 1)],
    fill: (P, E) => ({count: E.n + Math.round(P.blades)}),
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), k = Math.floor(u), f = u - k, c = Math.sin(PI * f);
      if (i < n){ const show = f < .5 ? wrap(k, n) : wrap(k + 1, n); return {o: i === show ? 1 : 0, s: 1.02 - .04 * c, zBias: 0, b: 1 - P.heroDim * c}; }
      const B = Math.round(P.blades), b = i - n, ph = b / B * TAU + P.twist * c + Math.round(P.irisTurn) * E.p * TAU, r = lerp(P.open, P.closed, c);
      return {x: r * Math.cos(ph), y: r * Math.sin(ph), z: .05 + b * .002, rz: ph + PI / 2 + c * P.roll, h: P.bladeW, w: P.blade, aspect: P.blade / P.bladeW, b: P.bladeTone, zBias: 5 + b * .01, img: n + b};
    }},
];

/* ===================== Kinetic ===================== */
const KINETIC = [
  {...NEW, id: 'pendulum', name: 'Pendulum Wave', cat: 'kinetic', n: 12, aspect: .8, cardH: .3, dur: 60,
    mods: {poseRy: -52, poseRx: 10},
    desc: 'A row of hanging photos, each swinging a little faster than the last, weaving waves in and out of sync.',
    params: [grp('Layout'), range('pivot', 'Pivot height', -.2, 1.2, .6), range('length', 'String', .3, 1.4, .6), range('lenRamp', 'String ramp', -.6, .6, 0), P_GAP(.12),
      grp('Motion'), whole('base', 'Base swings', 4, 30, 14, {hint: 'whole swings per loop for the slowest card'}), cyc('stepN', 'Speed step', 1, 3, 1), range('amp', 'Swing', .1, 1.2, .62), off('phase', 'Phase spread', 1),
      grp('Look'), range('swingShade', 'Swing shade', 0, .6, .15), off('mblur', 'Motion blur', 1)],
    layout(i, P, E){
      const w = TAU * ((Math.round(P.base) + i * Math.round(P.stepN)) * E.p + i / E.n * P.phase), th = P.amp * Math.cos(w), x = (i - (E.n - 1) / 2) * E.w * (1 + P.gap);
      const L = P.length * (1 + P.lenRamp * (E.n > 1 ? i / (E.n - 1) * 2 - 1 : 0));
      return {m: M(T(x, P.pivot, 0), RX(th), T(0, -L, 0)), b: 1 - P.swingShade + P.swingShade * Math.cos(th), blur: P.mblur * .6 * ab(Math.sin(w))};
    }},

  {...NEW, id: 'fountain', name: 'Fountain', cat: 'kinetic', n: 30, aspect: .8, cardH: .3, dur: 9,
    desc: 'Photos burst up from below the frame in tumbling arcs and rain back down.',
    params: [grp('Layout'), range('height', 'Height', .4, 1.6, 1), P_SPREAD(1), range('depthF', 'Depth', 0, 4, 1.6), off('drag', 'Air drag', 1),
      grp('Motion'), whole('bursts', 'Arcs per loop', 1, 4, 2), off('volley', 'Volley', 1), range('whirl', 'Tumble', 0, 3, 1.2), whole('flip', 'Flips', 0, 3, 0, {unit: ' turns'}),
      grp('Look'), range('grow', 'Launch grow', 0, .8, .35), off('mblur', 'Motion blur', 1)],
    layout(i, P, E){
      const s = wrap(E.p * Math.round(P.bursts) + i / E.n * (1 - P.volley * .85), 1), base = -E.vy - E.h * .8;
      const peak = (2 * E.vy + E.h) * P.height * (.72 + .28 * E.rnd(i, 1)), dir = (E.rnd(i, 2) - .5) * 2, sx = lerp(s, 1 - (1 - s) * (1 - s), P.drag);
      const x = dir * E.vx * .95 * P.spread * sx, y = base + 4 * peak * s * (1 - s), z = (E.rnd(i, 3) - .5) * P.depthF;
      return {x, y, z, rz: dir * P.whirl * TAU * s * .5, rx: (E.rnd(i, 4) - .5) * P.whirl * TAU * s, ry: Math.round(P.flip) * TAU * s * (E.rnd(i, 5) < .5 ? -1 : 1),
        s: 1 - P.grow + P.grow * sstep(0, .25, s), blur: P.mblur * .6 * ab(1 - 2 * s)};
    }},

  {...NEW, id: 'leaves', name: 'Falling Leaves', cat: 'kinetic', n: 22, aspect: .8, cardH: .34, dur: 16,
    desc: 'Photos drift down like leaves, swaying, turning and tipping as they fall.',
    params: [grp('Layout'), range('depth', 'Depth', 0, 4, 2.4), P_SPREAD(1), range('wind', 'Wind', -1, 1, 0),
      grp('Motion'), whole('nearSp', 'Near layer speed', 1, 3, 2, {unit: '×'}), range('sway', 'Sway', 0, 1, .45), whole('swings', 'Swings per fall', 1, 4, 2), range('flip', 'Flutter', 0, 1.5, .6), whole('twirl', 'Spin', 0, 2, 0, {unit: ' turns'}),
      grp('Look'), range('depthDim', 'Depth dim', 0, .6, .15), off('dof', 'Depth blur', 1)],
    layout(i, P, E){
      const layer = E.rnd(i, 1), z = lerp(-P.depth, .7, layer), vis = (E.D * E.vy - z) / E.D, sp = layer > .5 ? Math.round(P.nearSp) : 1;
      const s = wrap(i / E.n * sp + E.p * sp, 1), w = TAU * (Math.round(P.swings) * s + E.rnd(i, 2));
      const x = (E.rnd(i, 3) - .5) * 2 * (E.vx / E.vy) * vis * .85 * P.spread + P.sway * Math.sin(w) * .5 + P.wind * (s - .5) * 1.2 * (E.vx / E.vy) * vis, y = (.5 - s) * 2 * (vis + E.h);
      return {x, y, z, rz: -P.sway * Math.cos(w) * .7 + Math.round(P.twirl) * TAU * s * (E.rnd(i, 4) < .5 ? -1 : 1), ry: P.flip * Math.sin(w * .5 + i), rx: P.flip * .4 * Math.cos(w),
        b: 1 - P.depthDim + P.depthDim * layer, blur: P.dof * (1 - layer) * .7};
    }},

  {...NEW, id: 'murmuration', name: 'Murmuration', cat: 'kinetic', n: 64, aspect: .8, cardH: .14, dur: 24,
    desc: 'A flock of tiny photos wheels across the frame like starlings, stretching and folding as it turns.',
    params: [grp('Form'), range('size', 'Flock size', .3, 1.5, .8, .01, {key: 'flock'}), range('flockH', 'Flock height', .1, 1.5, .6), range('stretch', 'Stretch', 0, 2, 1), range('jit', 'Swarm jitter', 0, .4, .1),
      grp('Motion'), range('roam', 'Roam', 0, 1.2, .45), cyc('loops', 'Path loops', 1, 3, 1), range('breath', 'Breathe', 0, .5, .2), range('flap', 'Flutter', 0, 1, .4),
      grp('Look'), range('sizeMix', 'Size mix', 0, 1, .4), off('depthShade', 'Depth shade', .6)],
    layout(i, P, E){
      const t = E.p * TAU, tl = t * Math.round(P.loops), C = [P.roam * Math.sin(tl), P.roam * .5 * Math.sin(2 * tl + .6), P.roam * .8 * Math.sin(tl + 1.3)];
      const V = [Math.cos(tl), Math.cos(2 * tl + .6), .8 * Math.cos(tl + 1.3)], vl = Math.hypot(...V) || 1;
      const R = P.flock * (.55 + P.breath * Math.sin(2 * t)), d = fibo(i, E.n), q = E.rnd(i, 1) * TAU;
      let o = [d[0] * R + P.jit * Math.sin(3 * t + q), d[1] * R * P.flockH + P.jit * Math.cos(2 * t + q), d[2] * R + P.jit * Math.sin(4 * t + q * 2)];
      const along = (o[0] * V[0] + o[1] * V[1] + o[2] * V[2]) / vl * P.stretch * .6;
      o = o.map((v, k) => v + V[k] / vl * along);
      const z = C[2] + o[2];
      return {x: C[0] + o[0], y: C[1] + o[1], z, rz: Math.atan2(V[1], V[0]) * .5, ry: P.flap * Math.sin(TAU * 6 * E.p + q), s: 1 - P.sizeMix / 2 + P.sizeMix * E.rnd(i, 2), b: 1 - P.depthShade * clamp01(.5 - z * .6)};
    }},

  {...NEW, id: 'serpent', name: 'Serpent', cat: 'kinetic', n: 18, aspect: .8, cardH: .34, dur: 14,
    desc: 'A chain of photos slithers through space, each one following the one in front.',
    params: [grp('Form'), range('reach', 'Reach', .4, 1.4, .85), range('rise', 'Height', 0, 1.5, .58), whole('coils', 'Coils', 1, 5, 3), range('spacing', 'Spacing', .4, 2.5, 1), range('taper', 'Taper', 0, .9, .55),
      grp('Motion'), cyc('laps', 'Laps', 1, 3, 1), off('undulate', 'Undulate', .3), range('bank', 'Bank', 0, 1.5, .6),
      grp('Look'), off('tailFade', 'Tail fade', 1), off('tailShade', 'Tail shade', .7)],
    layout(i, P, E){
      const C = Math.round(P.coils), path = u => { const a = u * TAU; return [P.reach * 1.05 * Math.sin(a), P.reach * P.rise * Math.sin(2 * a + .5), P.reach * .9 * Math.sin(C * a)]; };
      const u = E.p * Math.round(P.laps) - i * .028 * P.spacing, [x, y, z] = path(u), [x2, y2, z2] = path(u + .002), tx = x2 - x, ty = y2 - y, tz = z2 - z;
      const f = i / Math.max(1, E.n - 1), yu = y + P.undulate * Math.sin(TAU * 3 * E.p - i * .7);
      return {m: frame3(x, yu, z, [tx, ty * P.bank, tz], [-tz * .5, 0, 1]), s: 1 - P.taper * f, o: clamp01((E.n - i) / 2.5) * (1 - P.tailFade * f), b: 1 - P.tailShade * f, zBias: -i * .01};
    }},

  {...NEW, id: 'slinky', name: 'Slinky', cat: 'kinetic', n: 8, aspect: .8, step: true, perCard: .8, cardH: .7,
    desc: 'Photos flip one by one over an arch from one stack to the other, then all the way back.',
    params: [grp('Form'), range('arch', 'Arch', .3, 1.4, .8), range('apart', 'Distance', .5, 1.5, 1), range('depth', 'Stack depth', 0, .2, .07), range('fan', 'Stack fan', 0, .15, .03), range('arcZ', 'Arc depth', -1, 1, .25),
      grp('Motion'), whole('flips', 'Flips', 1, 3, 1), off('tumble', 'Tumble', 1.5), off('pop', 'Flight pop', .5),
      grp('Look'), range('stackShade', 'Stack shade', 0, .15, .05), off('mblur', 'Motion blur', 1)],
    layout(i, P, E){
      const n = E.n, U = stepU(E.p, 2 * n, E.hold, E.ez), j0 = i, j1 = 2 * n - 1 - i, X = .72 * P.apart, F = 2 * Math.round(P.flips) - 1;
      const stack = (side, k) => ({x: side * X + k * P.fan * side, y: -.12 - k * .025, z: -k * P.depth, b: 1 - Math.min(.35, k * P.stackShade)});
      const fly = (e, from) => { const c = Math.sin(PI * e); return {x: lerp(from * X, -from * X, e), y: -.12 + P.arch * c, z: P.arcZ * c, ry: PI * e * F, rz: P.tumble * c * from, s: 1 + P.pop * c, blur: P.mblur * .6 * c, zBias: 20}; };
      if (U < j0) return {...stack(-1, i - U)};
      if (U < j0 + 1) return {...fly(U - j0, -1)};
      if (U < j1) return {...stack(1, Math.max(0, U < n ? U - i - 1 : j1 - U)), ry: PI};
      if (U < j1 + 1) return {...fly(U - j1, 1), ry: PI + PI * (U - j1) * F};
      return {...stack(-1, U - j1 - 1)};
    }},

  {...NEW, id: 'house', name: 'House of Cards', cat: 'kinetic', n: 15, fixedN: true, aspect: .7, cardH: .48, dur: 14,
    mods: {poseRx: 12},
    desc: 'Photos fly in one by one to build a house of cards, hold for a breath, then it all collapses.',
    params: [grp('Form'), range('lean', 'Lean', .15, .5, .3), range('tentGap', 'Tent spacing', 0, .3, .05),
      grp('Motion'), range('build', 'Build time', .4, .75, .6), range('dropH', 'Drop height', .4, 2.4, 1.2), range('spinIn', 'Spin in', 0, 3, .6), range('toss', 'Toss', 0, 2, 1), range('scatter', 'Collapse', .3, 2, 1), range('gravity', 'Gravity', 2.5, 6, 3.4),
      grp('Look'), off('levelShade', 'Level shade', .5), off('crashBlur', 'Collapse blur', 1)],
    fill(P, E){
      const h = E.h, ln = P.lean, tw = 2 * h * Math.sin(ln) + P.tentGap, lh = h * Math.cos(ln), spots = [];
      let base = -.82;
      for (let l = 0; l < 3; l++){
        const tents = 3 - l;
        for (let t = 0; t < tents; t++){ const cx = (t - (tents - 1) / 2) * tw; spots.push({x: cx - h / 2 * Math.sin(ln), y: base + lh / 2, rz: -ln}, {x: cx + h / 2 * Math.sin(ln), y: base + lh / 2, rz: ln}); }
        for (let t = 0; t < tents - 1; t++) spots.push({x: (t - (tents - 2) / 2) * tw, y: base + lh + .01, rx: -PI / 2});
        base += lh + .015;
      }
      return {spots, count: spots.length};
    },
    layout(i, P, E){
      const sp = E.spots[i], N = E.spots.length, b = P.build, t0 = i / N * b * .92, e = ease.outCubic(clamp01((E.p - t0) / .1));
      const fromX = (E.rnd(i, 1) - .5) * 3, fromY = E.vy + P.dropH, bt = 1 - P.levelShade * clamp01((.4 - sp.y) / 1.2);
      if (E.p < .8){
        return {x: lerp(fromX, sp.x, e), y: lerp(fromY, sp.y, e), z: lerp(.8, 0, e), rx: lerp(1.2, sp.rx || 0, e), rz: lerp((E.rnd(i, 2) - .5) * 3 * P.toss, sp.rz || 0, e), ry: lerp(P.spinIn, 0, e), b: bt};
      }
      const q = (E.p - .8) / .2, d = (E.rnd(i, 3) - .5) * 2 * P.scatter;
      return {x: sp.x + d * q * 1.2, y: sp.y - P.gravity * q * q - .3 * q, z: (E.rnd(i, 4) - .3) * q, rx: (sp.rx || 0) + d * q * 2, rz: (sp.rz || 0) + d * q * 3, b: bt, blur: P.crashBlur * q * .8};
    }},

  {...NEW, id: 'hourglass', name: 'Hourglass', cat: 'kinetic', n: 56, aspect: .8, cardH: .2, dur: 16,
    desc: 'Photos swirl down through the neck of an hourglass and spread into the lower bulb.',
    params: [grp('Form'), range('bulb', 'Bulb width', .5, 1.6, 1.05), range('neck', 'Neck', .02, .3, .05), range('neckLen', 'Neck length', 0, .4, .06), range('round', 'Bulb roundness', .4, 2, 1), range('tilt', 'View angle', 0, .8, .3),
      grp('Motion'), cyc('flow', 'Flow speed', 1, 3, 1), whole('swirl', 'Swirl', -4, 4, 2, {unit: '×'}), whole('tumble', 'Tumble', 0, 3, 0, {unit: ' turns'}),
      grp('Look'), range('backShade', 'Back shade', 0, .6, .25), range('sizeFall', 'Size falloff', 0, 1, .6)],
    layout(i, P, E){
      const s = wrap(i / E.n + E.p * Math.round(P.flow), 1), top = (E.vy + E.h + P.bulb * Math.sin(P.tilt)) / Math.cos(P.tilt), a0 = E.rnd(i, 1) * TAU, nl = P.neckLen;
      let y, r;
      if (s < .46){ const q = s / .46; y = lerp(top, nl, q); r = lerp(P.bulb, P.neck, Math.pow(q, .7 * P.round)); }
      else if (s < .54){ const q = (s - .46) / .08; y = lerp(nl, -nl, q); r = P.neck; }
      else { const q = (s - .54) / .46; y = lerp(-nl, -top, q); r = lerp(P.neck, P.bulb, Math.pow(q, .55 * P.round)); }
      const a = a0 + s * TAU * P.swirl, x = r * Math.cos(a), z = r * Math.sin(a), [X, Y, Z] = [x, y * Math.cos(P.tilt) - z * Math.sin(P.tilt), y * Math.sin(P.tilt) + z * Math.cos(P.tilt)];
      return {x: X, y: Y, z: Z, rz: a * .15, ry: Math.round(P.tumble) * TAU * s, s: 1 - P.sizeFall + P.sizeFall * r / Math.max(P.bulb, .1), b: 1 - P.backShade + P.backShade * (z / Math.max(r, .01) * .5 + .5)};
    }},

  {...NEW, id: 'big-bang', name: 'Big Bang', cat: 'kinetic', n: 40, aspect: .8, cardH: .36, dur: 12,
    desc: 'A tight deck explodes into a spinning cloud of photos, then implodes back into the deck.',
    params: [grp('Form'), P_RADIUS(.95), off('flatten', 'Flatten', .9), range('shell', 'Shell thickness', 0, 1, .4),
      grp('Motion'), range('blast', 'Blast time', .08, .4, .2), range('burstSpread', 'Burst spread', 0, .3, .05), range('hang', 'Hang time', .2, .6, .4), range('whirl', 'Whirl', 0, 3, 1), range('wild', 'Chaos', 0, 1, .5),
      grp('Look'), off('flash', 'Flash', 1), off('cloudBlur', 'Cloud blur', 1)],
    layout(i, P, E){
      const t0 = .06 + E.rnd(i, 1) * P.burstSpread, h0 = .3 + P.hang, out = ease.outExpo(clamp01((E.p - t0) / P.blast)), back = ease.inOutCubic(clamp01((E.p - h0) / .26)), w = out * (1 - back);
      const d = fibo(i, E.n), dy = d[1] * (1 - P.flatten), R = P.radius * (1 - P.shell / 2 + P.shell * E.rnd(i, 2)), ang = TAU * P.whirl * sstep(t0, h0 + .26, E.p);
      const ca = Math.cos(ang), sa = Math.sin(ang), sx = d[0] * ca + d[2] * sa, sz = -d[0] * sa + d[2] * ca, A = aim(sx, dy, sz);
      const spin = (E.rnd(i, 3) - .5) * TAU * P.wild;
      return {x: lerp((E.rnd(i, 4) - .5) * .02, sx * R, w), y: lerp(i * .004 - .08, dy * R * .85, w), z: lerp(-i * .012, sz * R, w), ry: A.ry * w, rx: A.rx * w, rz: lerp((E.rnd(i, 5) - .5) * .08, spin, w),
        b: 1 + P.flash * Math.sin(PI * out) * (1 - back), blur: P.cloudBlur * w * .7 * E.rnd(i, 6)};
    }},

  {...NEW, id: 'gears', name: 'Gears', cat: 'kinetic', n: 24, fixedN: true, aspect: .55, cardH: .26, dur: 16,
    desc: 'Two meshing gears with photos for teeth, turning against each other.',
    params: [grp('Form'), seg('ratio', 'Ratio', {12: '1 : 1', 16: '2 : 1', 18: '3 : 1'}, '16'), range('pitchK', 'Tooth spacing', .9, 1.6, 1.22), range('mesh', 'Mesh', .6, 1.3, .92), range('meshPh', 'Mesh offset', -1, 1, 0), off('layer', 'Layer depth', .6), range('tilt', 'Tilt', 0, 1, .25),
      grp('Motion'), whole('turns', 'Turns', 1, 3, 1, {unit: '×'}), off('tick', 'Tick', 1),
      grp('Look'), range('smallTone', 'Small gear tone', .5, 1.2, .92), off('toothShade', 'Tooth shade', .5)],
    layout(i, P, E){
      const N1 = Number(P.ratio) || 16, N2 = 24 - N1, big = i < N1, N = big ? N1 : N2, k = big ? i : i - N1, pitch = E.w * P.pitchK, R = N * pitch / TAU;
      const R1 = N1 * pitch / TAU, R2 = N2 * pitch / TAU, d = R1 + R2 + E.h * P.mesh, cx = big ? -d * R2 / (R1 + R2) : d * R1 / (R1 + R2);
      const u = E.p * Math.round(P.turns) * N1, ku = Math.floor(u), fu = u - ku, a1 = TAU / N1 * (ku + lerp(fu, sstep(.55, 1, fu), P.tick));
      const a = big ? a1 + k / N * TAU : -N1 / N2 * a1 + k / N * TAU + PI + PI / N2 * (1 + P.meshPh);
      return {m: M(RX(P.tilt), T(cx + (R + E.h / 2) * Math.cos(a), (R + E.h / 2) * Math.sin(a), big ? 0 : P.layer), RZ(a - PI / 2)), b: (big ? 1 : P.smallTone) * (1 - P.toothShade * (.5 - .5 * Math.sin(a)))};
    }},

  {...NEW, id: 'ferris', name: 'Ferris Wheel', cat: 'kinetic', n: 12, aspect: .8, cardH: .32, dur: 30,
    desc: 'Photos ride a big wheel like gondolas, staying upright and swaying as they go round.',
    params: [grp('Form'), P_RADIUS(1), range('hub', 'Hub height', -.5, .6, .1), range('arm', 'Arm length', .3, 1.2, .56),
      grp('Motion'), cyc('rides', 'Turns', 1, 3, 1), range('sway', 'Sway', 0, .5, .14), cyc('swayN', 'Sway speed', 1, 8, 4), off('lag', 'Sway lag', 1), range('depth', 'Wheel rock', 0, 1, .3),
      grp('Look'), range('nightShade', 'Shade', 0, .6, .15), off('topPop', 'Top pop', .4)],
    layout(i, P, E){
      const R = .82 * P.radius, a = i / E.n * TAU + E.p * TAU * Math.round(P.rides), px = R * Math.sin(a), py = P.hub + R * Math.cos(a), ca = Math.cos(a);
      const sw = P.sway * Math.sin(2 * a + E.p * TAU * Math.round(P.swayN) + i * P.lag * PI);
      return {m: M(RY(P.depth * .5 * Math.sin(E.p * TAU)), T(px, py, 0), RZ(sw), T(0, -E.h * P.arm, 0)), s: 1 + P.topPop * Math.pow(Math.max(0, ca), 4), b: 1 - P.nightShade + P.nightShade * ca};
    }},

  {...NEW, id: 'cradle', name: "Newton's Cradle", cat: 'kinetic', n: 5, aspect: 1, cardH: .36, dur: 3.2,
    desc: 'Hanging photos click back and forth like a Newton’s cradle.',
    params: [grp('Form'), range('pivotY', 'Pivot height', .4, 1.4, .95), range('length', 'String', .5, 1.4, .95), range('spacing', 'Spacing', .9, 1.5, 1.01), whole('movers', 'Movers', 1, 2, 1, {hint: 'how many photos swing out on each side'}),
      grp('Motion'), range('amp', 'Swing', .2, 1.1, .5), whole('beats', 'Swings per loop', 1, 4, 1), off('kick', 'Kick', .15), off('swivel', 'Swivel', 1),
      grp('Look'), off('mblur', 'Motion blur', 1), off('restShade', 'Rest shade', .4)],
    layout(i, P, E){
      const n = E.n, ph = wrap(E.p * Math.round(P.beats), 1), x = (i - (n - 1) / 2) * E.w * P.spacing, mv = Math.max(1, Math.min(Math.round(P.movers), Math.floor(n / 2)));
      const left = n === 1 || i < mv, right = n === 1 || i >= n - mv, sp = P.mblur * .5 * ab(Math.cos(TAU * ph));
      let th = 0, bl = 0;
      if (left && ph < .5){ th = -P.amp * Math.sin(TAU * ph); bl = sp; }
      if (right && ph >= .5){ th = P.amp * Math.sin(TAU * (ph - .5)); bl = sp; }
      if (n === 1) th = P.amp * Math.sin(TAU * ph);
      if (!left && !right && P.kick){ const g = v => Math.exp(-v * v / .0006); th = P.kick * (g(ph - .5) - g(ph) - g(ph - 1)); }
      return {m: M(T(x, P.pivotY, 0), RZ(th), T(0, -P.length, 0), RY(P.swivel * th * 1.5)), b: left || right ? 1 : 1 - P.restShade, blur: bl};
    }},

  {...NEW, id: 'ripples', name: 'Ripple Rings', cat: 'kinetic', n: 17, aspect: .8, cardH: .26, dur: 14,
    desc: 'Rings of photos spread out from the centre like ripples on water, a new ring every beat.',
    params: [grp('Form'), whole('rings', 'Rings', 2, 8, 5), whole('per', 'Per ring', 4, 24, 16), range('reach', 'Reach', .6, 1.6, 1.25), off('align', 'Point outward', 1), range('tilt', 'Water angle', 0, 1.3, .95),
      grp('Motion'), cyc('waves', 'Waves', 1, 3, 1), range('twist', 'Twist', -2, 2, .5), off('swell', 'Swell', .3),
      grp('Look'), range('grow', 'Grow', 0, 1.2, .7), range('fadeAt', 'Fade start', .3, .95, .85)],
    fill: (P, E) => ({count: Math.round(P.rings) * Math.round(P.per)}),
    layout(i, P, E){
      const Rn = Math.round(P.rings), C = Math.round(P.per), j = Math.floor(i / C), k = i % C, q = wrap(j / Rn + E.p * Math.round(P.waves), 1);
      const Rmax = P.reach * Math.hypot(E.vx, E.vy) / Math.max(.35, Math.cos(P.tilt) + .2), r = q * Rmax, a = k / C * TAU + j * .37 + P.twist * q * TAU * .25;
      // rings lie on a plane that tips back from facing you (0) toward a water surface
      const px = r * Math.cos(a), pz = r * Math.sin(a), hz = P.swell * .5 * Math.sin(TAU * 2 * q);
      // each photo lies flat on the water, lined up along its ring
      return {m: M(T(px, pz * Math.cos(P.tilt), -pz * Math.sin(P.tilt)), RX(-P.tilt), T(0, 0, hz), RZ(a + PI / 2 * (1 - P.align))), s: sstep(0, .12, q) * (.55 + P.grow * q), o: 1 - sstep(P.fadeAt, 1, q), img: j * C + k};
    }},
];

/* ===================== Sculpture ===================== */
// Rubik's cube: 54 stickers, each tracked as a matrix plus the integer cubie it sits on
const FACES = [[[1, 0, 0], RY(PI / 2)], [[-1, 0, 0], RY(-PI / 2)], [[0, 1, 0], RX(-PI / 2)], [[0, -1, 0], RX(PI / 2)], [[0, 0, 1], mat4.identity()], [[0, 0, -1], RY(PI)]];
const AXIS_ROT = [RX, RY, RZ];
function rubikState(P, E){
  const c = E.h * 1.02, st = [];
  for (const [f, R] of FACES){
    const ax = f.findIndex(v => v), u = (ax + 1) % 3, v = (ax + 2) % 3;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++){
      const q = [0, 0, 0]; q[ax] = f[ax]; q[u] = a; q[v] = b;
      const pos = q.map((x, k) => (k === ax ? x * 1.5 : x) * c);
      st.push({m: M(T(...pos), R), q});
    }
  }
  const R = rng(P.shuffle * 17 + 3), K = Math.round(P.moves), moves = [];
  for (let k = 0; k < K; k++){ let ax, ly; do { ax = Math.floor(R() * 3); ly = Math.floor(R() * 3) - 1; } while (moves.length && moves[moves.length - 1].ax === ax && moves[moves.length - 1].ly === ly); moves.push({ax, ly, d: R() < .5 ? 1 : -1}); }
  const all = moves.concat(moves.slice().reverse().map(m => ({...m, d: -m.d})));
  const U = E.p * all.length, done = Math.floor(U), f = E.ez(clamp01((U - done - P.pause) / Math.max(.05, 1 - P.pause)));
  const turn = (s, mv, amt) => { s.m = mat4.mul(AXIS_ROT[mv.ax](mv.d * amt * PI / 2), s.m); };
  for (let k = 0; k < done; k++){
    const mv = all[k];
    for (const s of st) if (s.q[mv.ax] === mv.ly){ turn(s, mv, 1); rotQ(s.q, mv); }
  }
  // the layer turning right now is marked, so the layout can lift or blur it
  if (done < all.length){ const mv = all[done]; for (const s of st) if (s.q[mv.ax] === mv.ly){ turn(s, mv, f); s.mv = mv; } st.f = f; }
  return st;
}
// rotate a cubie coordinate a quarter turn, matching the matrix rotation
function rotQ(q, mv){
  const m = AXIS_ROT[mv.ax](mv.d * PI / 2), [x, y, z] = q;
  const r = [m[0] * x + m[4] * y + m[8] * z, m[1] * x + m[5] * y + m[9] * z, m[2] * x + m[6] * y + m[10] * z].map(Math.round);
  q[0] = r[0]; q[1] = r[1]; q[2] = r[2];
}

const SCULPTURE = [
  {...NEW, id: 'rubik', name: "Rubik's Cube", cat: 'sculpture', n: 54, fixedN: true, aspect: 1, cardH: .3, dur: 16,
    desc: 'A cube of 54 photo stickers that scrambles itself layer by layer, then solves itself.',
    params: [grp('Layout'), whole('moves', 'Moves', 2, 16, 6), whole('shuffle', 'Shuffle', 1, 50, 4), P_GAP(.08), range('view', 'View tilt', -.5, 1.2, .5),
      grp('Motion'), range('pause', 'Pause', 0, .8, .3), P_EASE, turns('whirl', 'Turns', 1), off('turnPop', 'Turn pop', .5),
      grp('Look'), off('faceShade', 'Face shade', .6), off('turnBlur', 'Turn blur', 1)],
    fill: (P, E) => ({cube: rubikState(P, E), count: 54}),
    layout(i, P, E){
      const G = M(RX(P.view), RY(.7 + TAU * E.p * P.whirl)), c = E.cube[i], mv = c.mv, lift = mv ? Math.sin(PI * E.cube.f) : 0;
      let L = c.m;
      if (mv && P.turnPop){ const o = [0, 0, 0]; o[mv.ax] = mv.ly * P.turnPop * lift * E.h; L = M(T(...o), L); }
      const m = M(G, L, S(1 - P.gap, 1 - P.gap, 1));
      return {m, aspect: 1, b: .96 * (1 - P.faceShade * (1 - Math.max(0, m[10]))), blur: P.turnBlur * .6 * lift};
    }},

  {...NEW, id: 'morph', name: 'Morph', cat: 'sculpture', n: 48, fixedN: true, aspect: .8, cardH: .22, dur: 18,
    desc: 'Forty-eight photos flow from a sphere into a cube, a flat wall and a double helix, and back.',
    params: [grp('Form'), range('size', 'Size', .6, 1.5, 1, .01, {key: 'shape'}), off('scatter', 'Scatter', .4), range('helix', 'Helix twist', .2, 1, .52), off('wallCurve', 'Wall curve', 1),
      grp('Motion'), range('hold', 'Hold shape', .2, .8, .5, .01, {key: 'shapeHold'}), range('stagger', 'Ripple', 0, .5, .25), turns('whirl', 'Turns', 1), off('tumble', 'Tumble', 1), off('burst', 'Burst', 1),
      grp('Look'), off('backShade', 'Back shade', .6)],
    layout(i, P, E){
      const sz = P.shape, shapes = [
        () => { const d = fibo(i, 48); return [d.map(v => v * .95 * sz), d]; },
        () => { const f = Math.floor(i / 8), c = i % 8, idx = c < 4 ? c : c + 1, a = idx % 3 - 1, b = Math.floor(idx / 3) - 1, F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]][f];
          const ax = F.findIndex(v => v), u = (ax + 1) % 3, v = (ax + 2) % 3, q = [0, 0, 0]; q[ax] = F[ax] * .62; q[u] = a * .4; q[v] = b * .4; return [q.map(x => x * sz), F]; },
        () => { const x = (i % 8 - 3.5) * .3 * sz; return [[x, (Math.floor(i / 8) - 2.5) * .34 * sz, -P.wallCurve * x * x * .8], [P.wallCurve * 1.6 * x, 0, 1]]; },
        () => { const k = Math.floor(i / 2), a = k * P.helix + (i % 2) * PI; return [[Math.cos(a) * .62 * sz, (k - 11.5) * .07 * sz, Math.sin(a) * .62 * sz], [Math.cos(a), 0, Math.sin(a)]]; },
      ];
      const seg = E.p * 4, k = Math.floor(seg), f = seg - k, st = (i / 48) * P.stagger;
      const e = ease.inOutCubic(clamp01((f - P.shapeHold - st * (1 - P.shapeHold)) / Math.max(.05, (1 - P.shapeHold) * (1 - P.stagger))));
      const [p0, n0] = shapes[k % 4](), [p1, n1] = shapes[(k + 1) % 4](), A0 = aim(...n0), A1 = aim(...n1);
      let dy = A1.ry - A0.ry; if (dy > PI) dy -= TAU; if (dy < -PI) dy += TAU;
      const ga = TAU * E.p * P.whirl, G = RY(ga), bu = 1 + P.burst * .6 * Math.sin(PI * e), pos = p0.map((v, c) => (lerp(v, p1[c], e) + (E.rnd(i, 1 + c) - .5) * P.scatter) * bu);
      const wz = -pos[0] * Math.sin(ga) + pos[2] * Math.cos(ga);
      return {m: M(G, T(...pos), RY(A0.ry + dy * e), RX(lerp(A0.rx, A1.rx, e)), RZ(P.tumble * PI * Math.sin(PI * e))), zBias: 0, b: 1 - P.backShade * clamp01(.5 - wz / (1.3 * sz))};
    }},

  {...NEW, id: 'gyroscope', name: 'Gyroscope', cat: 'sculpture', n: 36, aspect: .8, cardH: .26, dur: 20,
    desc: 'Three nested rings of photos spinning on different axes, like a gyroscope in motion.',
    params: [grp('Form'), P_RADIUS(1), range('gap', 'Ring gap', .05, .4, .18), range('axis', 'Axis tilt', -.5, 1.2, .35), range('hug', 'Ring curve', 0, 2, 1),
      grp('Motion'), whole('inner', 'Inner speed', -3, 3, 2, {unit: '×'}), whole('outer', 'Outer speed', -3, 3, 1, {unit: '×'}), whole('run', 'Card run', -3, 3, 1, {unit: '×'}), off('nutate', 'Nutation', .4),
      grp('Look'), range('ringTone', 'Ring contrast', 0, .2, .08), off('backShade', 'Back shade', .6)],
    layout(i, P, E){
      const ring = i % 3, per = Math.ceil(E.n / 3), j = Math.floor(i / 3), t = E.p * TAU, a = j / per * TAU + t * Math.round(P.run) * (ring === 1 ? -1 : 1);
      const R = (1.02 - ring * P.gap) * P.radius, tl = RX(P.axis + P.nutate * Math.sin(2 * t));
      const Q = ring === 0 ? M(tl, RY(t * P.outer))
        : ring === 1 ? M(tl, RY(t * P.outer), RZ(PI / 2), RX(t * P.inner))
        : M(tl, RY(t * P.outer), RX(PI / 2 + t * P.inner), RZ(t * P.outer));
      const m = M(Q, RY(a), T(0, 0, R));
      return {m, bend: -.6 * P.hug / R, b: (.8 + ring * P.ringTone) * (1 - P.backShade * clamp01(.5 - m[14] / (2 * R)))};
    }},

  {...NEW, id: 'knot', name: 'Torus Knot', cat: 'sculpture', n: 64, aspect: 1.2, cardH: .16, dur: 26,
    desc: 'Photos glide along a trefoil knot that loops through itself, scaled like a dragon.',
    params: [grp('Form'), whole('pq', 'Knot', 2, 5, 3, {hint: 'loops around the tube'}), whole('winds', 'Winds', 1, 4, 2, {hint: 'times round the centre'}), range('tube', 'Tube', .1, .6, .3), P_RADIUS(.84), range('puff', 'Tube height', .5, 2.5, 1.3),
      grp('Motion'), turns('whirl', 'Turns', 0), whole('glide', 'Glide', -3, 3, 1, {unit: '×'}), off('breath', 'Breathe', .6),
      grp('Look'), range('depthShade', 'Depth shade', 0, .6, .22), off('dof', 'Depth blur', 1)],
    layout(i, P, E){
      const q = Math.round(P.pq), w = Math.round(P.winds), u = i / E.n + E.p * Math.round(P.glide), R = .72 * P.radius, r = P.tube * (1 + P.breath * Math.sin(TAU * (3 * u - 2 * E.p)));
      const path = u => { const a = u * TAU; return [(R + r * Math.cos(q * a)) * Math.cos(w * a), (R + r * Math.cos(q * a)) * Math.sin(w * a), r * Math.sin(q * a) * P.puff]; };
      const P0 = path(u), P1 = path(u + .001), a = u * TAU, C = [R * Math.cos(w * a), R * Math.sin(w * a), 0];
      const t = [P1[0] - P0[0], P1[1] - P0[1], P1[2] - P0[2]], nrm = [P0[0] - C[0], P0[1] - C[1], P0[2] - C[2] + .3], lit = clamp01(.5 + P0[2]);
      const G = M(RX(.42), RY(TAU * E.p * P.whirl));
      return {m: M(G, frame3(...P0, t, nrm)), b: 1 - P.depthShade + P.depthShade * lit, blur: P.dof * (1 - lit) * .8};
    }},

  {...NEW, id: 'kaleido', name: 'Kaleidoscope', cat: 'sculpture', n: 17, aspect: .8, cardH: .3, dur: 20,
    desc: 'A turning mandala: rings of the same photo repeated in symmetry, breathing in and out.',
    params: [grp('Form'), whole('folds', 'Folds', 3, 12, 6), whole('rings', 'Rings', 1, 5, 3), range('ringStep', 'Ring spacing', .15, .6, .34), range('depth', 'Depth', 0, .6, .2),
      grp('Motion'), turns('whirl', 'Turns', 1), {key: 'counter', label: 'Counter-rotate', type: 'toggle', def: true}, range('breathe', 'Breathe', 0, .5, .22), cyc('breaths', 'Breaths', 1, 4, 2), range('rock', 'Rock', 0, 1, .3),
      grp('Look'), off('ringShade', 'Ring shade', .6)],
    fill: (P, E) => ({count: Math.round(P.folds) * Math.round(P.rings)}),
    layout(i, P, E){
      const F = Math.round(P.folds), Rg = Math.round(P.rings), j = Math.floor(i / F), k = i % F, t = E.p * TAU;
      const r = (.22 + P.ringStep * j) * (1 + P.breathe * Math.sin(Math.round(P.breaths) * t + j * 1.3)), a = k / F * TAU + j * PI / F + t * P.whirl * (P.counter && j % 2 ? -1 : 1);
      return {x: r * Math.cos(a), y: r * Math.sin(a), z: -j * P.depth + P.depth * .5 * Math.sin(t + j), rz: a + PI / 2 + (j % 2 ? PI : 0) + Math.sin(2 * t + j) * P.rock, s: .75 + .3 * j,
        b: 1 - P.ringShade * j / Math.max(1, Rg - 1), img: j * 5 + 1};
    }},

  {...NEW, id: 'bloom', name: 'Bloom', cat: 'sculpture', n: 25, fixedN: true, aspect: .55, cardH: .82, dur: 12,
    mods: {poseRx: -20},
    style: {card: {radius: .5}},
    desc: 'Photo petals open into a flower, turn, and fold back into a bud.',
    params: [grp('Form'), range('open', 'Open', .2, 1, .92), range('cup', 'Cup', 0, 1, .3), range('petalGrow', 'Petal growth', 0, .4, .22), range('layerOff', 'Layer offset', 0, 1, .32), range('heart', 'Heart size', .15, .8, .42),
      grp('Motion'), turns('whirl', 'Turns', 1), whole('cycles', 'Blooms per loop', 1, 3, 1), off('delay', 'Layer delay', .3), off('flutter', 'Flutter', .4),
      grp('Look'), range('budShade', 'Bud shade', 0, .5, .2)],
    layout(i, P, E){
      if (i === 24) return {h: E.h * P.heart, aspect: 1, z: .02, zBias: 3, img: 7};
      const L = i < 6 ? 0 : i < 14 ? 1 : 2, per = [6, 8, 10][L], k = i - [0, 6, 14][L], t = E.p * TAU;
      const open = (.5 - .5 * Math.cos((t - L * P.delay * TAU) * Math.round(P.cycles))) * P.open, phi = k / per * TAU + L * P.layerOff + t * P.whirl;
      const beta = lerp(1.45 - L * .12, (.1 + L * .12) * P.cup * 2 - .05 * L, open) + P.flutter * open * Math.sin(2 * t + k * 1.7 + L), h = E.h * (.72 + P.petalGrow * L);
      return {m: M(RZ(phi), RX(beta), T(0, h * .52, -L * .004)), h, aspect: .55, b: 1 - P.budShade + P.budShade * open, img: L * 4 + 1};
    }},

  {...NEW, id: 'braid', name: 'Braid', cat: 'sculpture', n: 18, aspect: .8, cardH: .32, dur: 24,
    desc: 'Three strands of photos plait over and under each other as the braid slides by.',
    params: [grp('Form'), range('amp', 'Width', .1, .8, .42), range('wave', 'Wavelength', 1, 6, 2.8), range('depth', 'Depth', 0, 1, .5), P_GAP(.05), off('twist', 'Twist', 1.2),
      grp('Motion'), cyc('slide', 'Slide speed', 1, 3, 1), whole('drift', 'Weave drift', -2, 2, 0, {unit: '×', hint: 'whole cycles per loop, so it stays seamless'}), off('ripple', 'Ripple', .6),
      grp('Look'), off('underShade', 'Under shade', .6), off('underBlur', 'Under blur', 1)],
    fill(P, E){ const mb = Math.ceil(E.n / 3), m = fillSlots(E.vx + E.w, E.w * (1 + P.gap), mb, 3); return {m, mb, count: 3 * m}; },
    layout(i, P, E){
      const s = i % 3, k = Math.floor(i / 3), r = rel(k, E.p * E.mb * Math.round(P.slide), E.m), x = r * E.w * (1 + P.gap), ph = x / P.wave * TAU + s * TAU / 3 + E.p * TAU * Math.round(P.drift);
      const A = P.amp * (1 + P.ripple * Math.sin(x * 1.3 - E.p * TAU)), y = A * Math.sin(ph), z = P.depth * .5 * Math.sin(2 * ph), dy = A * Math.cos(ph) * TAU / P.wave, dz = P.depth * Math.cos(2 * ph) * TAU / P.wave;
      const rr = P.twist * Math.cos(ph), under = .5 - .5 * Math.sin(2 * ph);
      return {m: frame3(x, y, z, [1, dy, dz], [0, -Math.sin(rr), Math.cos(rr)]), o: wrapFade(r, E.m), b: 1 - P.underShade * under, blur: P.underBlur * under * .6, img: (k % E.mb) * 3 + s};
    }},

  {...NEW, id: 'orrery', name: 'Orrery', cat: 'sculpture', n: 22, fixedN: true, aspect: .8, cardH: .62, dur: 24,
    desc: 'A clockwork solar system: one hero photo in the middle, rings of photos orbiting at their own pace.',
    params: [grp('Form'), range('tilt', 'Tilt', .2, 1.45, 1), P_SPREAD(1), off('ecc', 'Ellipse', .5), off('incline', 'Orbit incline', .6), range('sun', 'Sun size', .5, 1.6, 1),
      grp('Motion'), whole('pace', 'Pace', 1, 3, 1, {unit: '×'}), seg('rhythm', 'Rhythm', {kepler: 'Kepler', locked: 'Locked', outward: 'Outward'}, 'kepler'), off('bob', 'Bob', .2),
      grp('Look'), range('orbitShade', 'Orbit shade', 0, .5, .15), off('farBlur', 'Far blur', 1)],
    layout(i, P, E){
      if (i === 0) return {zBias: 0, s: P.sun};
      const orbits = [3, 4, 6, 8], sp = (P.rhythm === 'locked' ? [1, 1, 1, 1] : P.rhythm === 'outward' ? [1, 2, 3, 4] : [4, 3, 2, 1]).map(v => v * Math.round(P.pace)), rad = [.62, .92, 1.22, 1.52];
      let j = i - 1, o = 0; while (j >= orbits[o]){ j -= orbits[o]; o++; }
      const a = j / orbits[o] * TAU + E.p * TAU * sp[o], r = rad[o] * P.spread * .84, tl = P.tilt + P.incline * (o - 1.5) * .5;
      const px = r * (1 + P.ecc) * Math.cos(a), pz = r * (1 - P.ecc) * Math.sin(a), z = -pz * Math.sin(tl);
      return {x: px, y: pz * Math.cos(tl) + P.bob * Math.sin(2 * E.p * TAU + o * 1.7 + j), z, h: E.h * [.42, .38, .34, .3][o], b: 1 - P.orbitShade + P.orbitShade * Math.sin(a), blur: P.farBlur * clamp01(-z * .8)};
    }},

  {...NEW, id: 'sunflower', name: 'Sunflower', cat: 'sculpture', n: 90, aspect: .8, cardH: .19, dur: 24,
    desc: 'Photos packed in a sunflower spiral, turning while waves pulse out from the centre.',
    params: [grp('Form'), P_SPREAD(1), range('diverge', 'Divergence', -4, 4, 0, .05, {unit: '°', hint: 'offset from the golden angle'}), seg('facing', 'Card angle', {out: 'Radial', up: 'Upright'}, 'out'), range('cup', 'Cup', -1, 1, 0), range('grow', 'Grow', 0, 1, .55),
      grp('Motion'), turns('whirl', 'Turns', 1), range('pulse', 'Pulse', 0, .6, .25), cyc('waveSp', 'Wave speed', 1, 4, 2), range('waveRings', 'Wave rings', .3, 3, 1.1),
      grp('Look'), off('glow', 'Wave glow', .5)],
    layout(i, P, E){
      const Rm = 1.08 * P.spread, r = Rm * Math.sqrt((i + .5) / E.n), a = i * (2.399963229728653 + P.diverge * PI / 180) + E.p * TAU * P.whirl;
      const w = Math.sin(TAU * (r * P.waveRings - Math.round(P.waveSp) * E.p)), q = r / Rm;
      return {x: r * Math.cos(a), y: r * Math.sin(a), z: P.pulse * w + P.cup * q * q * .6, rz: P.facing === 'up' ? 0 : a - PI / 2, s: (1 - P.grow * .6 + P.grow * .9 * q) * (1 + .18 * w * P.pulse * 2), b: 1 + P.glow * w};
    }},

  {...NEW, id: 'exploded', name: 'Exploded View', cat: 'sculpture', n: 6, aspect: .8, cardH: 1, dur: 10,
    desc: 'A stack of photos seen from above that pulls apart into floating layers, then snaps back together.',
    params: [grp('Form'), P_SPREAD(1), range('slide', 'Slide', 0, .6, .18), range('tilt', 'Tilt', .3, 1.3, .95), range('twist', 'Twist', 0, 1.5, .72), off('fan', 'Fan', 1),
      grp('Motion'), range('apart', 'Hold apart', 0, .5, .24), off('delay', 'Layer delay', .15), whole('whirl', 'Turns', 0, 2, 0, {unit: ' turns'}),
      grp('Look'), range('layerShade', 'Layer shade', 0, .5, .15), off('dof', 'Depth blur', 1)],
    layout(i, P, E){
      const fr = i / Math.max(1, E.n - 1), hb = P.apart / 2, e = ease.inOutCubic(pulse(E.p - (E.n > 1 ? fr - .5 : 0) * P.delay, .08, .5 - hb, .5 + hb, .92)), c = i - (E.n - 1) / 2, gap = lerp(.025, .42 * P.spread, e);
      return {m: M(RX(-P.tilt), RZ(P.twist + Math.round(P.whirl) * TAU * E.p), T((E.rnd(i, 1) - .5) * P.slide * e, (E.rnd(i, 2) - .5) * P.slide * e * .6, c * gap), RZ(c * P.fan * .25 * e)),
        b: 1 - P.layerShade + P.layerShade * fr, blur: P.dof * e * (1 - fr) * .6};
    }},

  {...NEW, id: 'trivision', name: 'Tri-Vision', cat: 'sculpture', n: 21, aspect: .28, cardH: 1.15, dur: 9,
    desc: 'A row of turning prisms like a tri-vision billboard; each turn reveals a new set of photos.',
    params: [grp('Layout'), whole('slats', 'Prisms', 3, 12, 7), P_GAP(.04), off('curve', 'Billboard curve', 1),
      grp('Motion'), range('wave', 'Stagger', 0, .1, .045), seg('from', 'Wave from', {l: 'Left', c: 'Centre', r: 'Right'}, 'l'), range('pause', 'Pause', 0, .5, .2), P_EASE, off('pop', 'Pop out', .4),
      grp('Look'), range('faceShade', 'Face shade', 0, .6, .3), off('turnBlur', 'Turn blur', 1)],
    fill: (P, E) => ({count: Math.round(P.slats) * 3}),
    layout(i, P, E){
      const K = Math.round(P.slats), j = i % K, face = Math.floor(i / K), u = E.p * 3, k = Math.floor(u), f = u - k;
      const st = (P.from === 'r' ? K - 1 - j : P.from === 'c' ? ab(j - (K - 1) / 2) : j) * P.wave, win = Math.max(.1, 1 - (K - 1) * P.wave - P.pause - .05), e = E.ez(clamp01((f - st - P.pause) / win)), th = (k + e) * TAU / 3;
      const ap = E.w / (2 * Math.tan(PI / 3)), x = (j - (K - 1) / 2) * E.w * (1 + P.gap), ce = Math.sin(PI * e);
      const ang = th + face * TAU / 3;
      return {m: M(T(x, 0, -P.curve * .3 * x * x + P.pop * ce), RY(Math.atan(P.curve * .6 * x)), T(0, 0, -ap), RY(-ang), T(0, 0, ap)), b: 1 - P.faceShade + P.faceShade * Math.max(0, Math.cos(ang)), blur: P.turnBlur * .6 * ce, img: face * K + j};
    }},
];

export const X_TEMPLATES = [...GALLERY, ...KINETIC, ...SCULPTURE];
