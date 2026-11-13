// Choreography, batch A (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a door or a table is implied only by how the cards move and where they sit.
import { TAU, clamp01, sstep, smoother, ease, lerp } from './math.js';
import { ab, M, T, RX, RY, frame3 } from './kit.js';

const PI = Math.PI, D2R = PI / 180;
const range = (key, label, min, max, def, step = .01, extra = {}) => ({key, label, type: 'range', min, max, step, def, ...extra});
const whole = (key, label, min, max, def, extra = {}) => range(key, label, min, max, def, 1, extra);
const off = (key, label, max, extra = {}) => range(key, label, 0, max, 0, .01, {off: true, ...extra});
const seg = (key, label, options, def) => ({key, label, type: 'seg', options, def});
const G = group => ({group});
const NEW = {cat: 'choreo', isNew: true, set: 'photos', frame: '5:4'};

// 0 before a, 1 after b, eased between
const win = (p, a, b, ez = ease.inOutCubic) => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
// a smooth start that springs past the end and settles: zero speed at both ends, overshoot set by k (0 = none)
const springIn = (t, k) => { if (t <= 0) return 0; if (t >= 1) return 1; const s = t * t * (3 - 2 * t), c = 1.70158 * k; return 1 + (c + 1) * (s - 1) ** 3 + c * (s - 1) ** 2; };
// small vector kit
const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
// where a card bent to curvature k along its width must sit so its inner edge (x = -w/2) lands on the origin
const edgeAnchor = (k, w) => ab(k) < 1e-4 ? [w / 2, 0] : [Math.sin(k * w / 2) / k, -(Math.cos(k * w / 2) - 1) / k];

// Revolving Door: the door's turn in wings (whole numbers per loop). It never stops dead: the speed dips smoothly to
// (pause = 1) or toward zero as each wing reaches its rest angle, and picks up again, a sine-shaped velocity
const doorTurn = (p, W, pause) => { const t = p * W; return t - pause * Math.sin(TAU * t) / TAU; };
const doorSpeed = (p, W, pause) => 1 - pause * Math.cos(TAU * p * W);

// Ribbon Spread: how far the deck has been spread along the ribbon (0 gathered, 1 spread), long eased in and out
const ribbonH = (p, P) => { const st = P.spreadTime; return win(p, .02, .04 + .2 * st, ease.inOutQuart) - win(p, .96 - .16 * st, .985, ease.inOutQuart); };

// Twist Tower: how wound the tower is (1 at the loop start, unwinds, rewinds with a springy settle)
const towerWind = (p, P) => (1 - win(p, .07, .24, ease.inOutSine)) + springIn(clamp01((p - .8) / .17), P.overTwist);

export const CHOREO_A = [
  /* 1. Revolving Door: curved wings hinged on one upright axis; the door glides round a wing at a time */
  {...NEW, id: 'revolving-door', name: 'Revolving Door', n: 8, aspect: .8, cardH: .92, dur: 12, fov: 38,
    desc: 'Four photos are the wings of a revolving door; each one sweeps past the lens as the door turns.',
    params: [G('Layout'), whole('wings', 'Wings', 3, 6, 4), seg('sides', 'Photos on', {two: 'Both sides', one: 'One side'}, 'two'), range('hub', 'Hub gap', 0, .3, .04),
      range('wingCurve', 'Wing curve', 0, 1.6, .75, .01, {hint: 'the wings bow like curved glass'}), range('camHigh', 'Camera height', -.5, 1, .32), range('camSide', 'Camera side', -1, 1, 0),
      range('camDist', 'Camera distance', .7, 1.6, 1, .01, {unit: '×'}),
      G('Motion'), range('pause', 'Pause', 0, 1, .82, .01, {hint: 'how far the door slows as each wing comes round'}), range('rest', 'Rest angle', -45, 45, -16, 1, {unit: '°'}),
      range('flexW', 'Wing flex', 0, 1, .45, .01, {hint: 'wings bow further while the door turns fast'}), off('bob', 'Float', 1),
      G('Look'), range('turnDim', 'Turned shade', 0, 1, .4), range('farBlur', 'Far blur', 0, 1, .25)],
    fill: (P, E) => { const W = Math.round(P.wings), two = P.sides !== 'one'; return {W, two, count: W * (two ? 2 : 1)}; },
    camera(P, E){
      const R = P.hub + E.w, d = (R * 2.35 + .55) * P.camDist, el = P.camHigh * .45, az = P.camSide * .6;
      return {eye: [d * Math.cos(el) * Math.sin(az), d * Math.sin(el), d * Math.cos(el) * Math.cos(az)], target: [0, -.02, 0]};
    },
    layout(i, P, E){
      const W = E.W, wing = E.two ? i >> 1 : i, back = E.two && i % 2;
      const a = (wing + doorTurn(E.p, W, P.pause)) / W * TAU + P.rest * D2R, sp = doorSpeed(E.p, W, P.pause);
      // the wing bows to a set curve, a little further while it moves fast (follow-through), back as it slows
      const k = (P.wingCurve + P.flexW * .5 * (sp - 1)) / E.w, [ax, az] = edgeAnchor(k, E.w), r = P.hub + ax;
      // the back photo is a second card back to back with the opposite curve, so a wing never shows a mirrored photo
      const y = P.bob * .04 * Math.sin(TAU * E.p);
      const m = back ? M(T(0, y, 0), RY(a), T(r, 0, az - .003), RY(PI)) : M(T(0, y, 0), RY(a), T(r, 0, az + .003));
      // brightness: a photo turned away from the camera falls into shade; far wings soften a touch
      const nz = (back ? -1 : 1) * Math.cos(a - P.camSide * .6), far = clamp01(Math.sin(a) * 1.2);
      return {m, bend: back ? -k : k, b: 1 - P.turnDim * (1 - Math.max(0, nz)) * .75, blur: P.farBlur * far * .5, img: i};
    }},

  /* 2. Ribbon Spread: a deck is spread into a ribbon on an unseen table, turned over by a wave, turned back, gathered */
  {...NEW, id: 'ribbon-spread', name: 'Ribbon Spread', n: 14, aspect: .72, cardH: .62, dur: 16, fov: 30,
    style: {card: {back: 'solid', backColor: '#1d1d22'}},
    desc: 'A deck spreads across the table in a long ribbon, then a turnover wave flips every card.',
    params: [G('Layout'), range('ribbon', 'Length', .5, 1.4, 1, .01, {unit: '×'}), range('arc', 'Arc', -1, 1, .35), range('camLow', 'Camera height', .2, 1.2, .72),
      range('camTurn', 'Camera angle', -40, 40, -10, 1, {unit: '°'}), seg('backs', 'Card backs', {photos: 'Photos', plain: 'Plain'}, 'photos'), off('messy', 'Messy', 1),
      G('Motion'), range('waveSpan', 'Wave length', .3, 1.6, 1, .01, {unit: '×', hint: 'how long the turnover takes to run down the ribbon'}), range('flipTime', 'Flip time', .5, 2.5, 1.6, .01, {unit: '×'}),
      range('cardCurl', 'Card curl', 0, 1.5, .55, .01, {hint: 'cards curl as they are turned, and flatten as they land'}), range('hop', 'Hop', 0, 1, .3), range('spreadTime', 'Spread time', .6, 1.4, 1, .01, {unit: '×'}),
      range('camDrift', 'Camera drift', 0, 1, .5),
      G('Look'), range('flipShade', 'Flip shade', 0, .6, .2), off('farBlur', 'Distance blur', 1)],
    camera(P, E){
      // the camera eases back as the ribbon spreads and drifts round it a little, for parallax
      const h = ribbonH(E.p, P), d = lerp(1.7, 3.9, h) * Math.min(1, E.asp / 1.25) ** .25, el = P.camLow;
      const yw = P.camTurn * D2R + P.camDrift * .14 * Math.sin(TAU * E.p);
      return {eye: [d * Math.cos(el) * Math.sin(yw), -.4 + d * Math.sin(el), d * Math.cos(el) * Math.cos(yw)], target: [0, -.42, .05]};
    },
    fill: (P, E) => ({count: E.n * (P.backs === 'plain' ? 1 : 2)}),
    layout(i, P, E){
      // cards n..2n-1 are the backs of cards 0..n-1: a second photo, so the turnover reveals a new ribbon
      const n = E.n, bk = i >= n, c = i % n, si = n > 1 ? c / (n - 1) : 0, p = E.p;
      // the deck slides right and leaves one card behind at a time; later it sweeps them back up
      const h = ribbonH(p, P), s = Math.min(h, si);
      const L = 2 * P.ribbon * Math.min(1.4, Math.max(.75, E.asp)) / 1.25, A = P.arc * 1.3, t = s - h / 2;
      let x, z, tx = 1, tz = 0;
      if (ab(A) < 1e-3){ x = t * L; z = 0; }
      else { const R = L / A, g = t * A; x = R * Math.sin(g); z = R * (1 - Math.cos(g)) - R * (1 - Math.cos(A / 2)) * .5; tx = Math.cos(g); tz = Math.sin(g); }
      // the turnover: a wave runs left to right turning the cards over, then right to left turning them back
      const span = .15 * P.waveSpan, fd = .07 * P.flipTime;
      const f1 = clamp01((p - .3 - si * span) / fd), f2 = clamp01((p - .58 - (1 - si) * span) / fd);
      const th = PI * (smoother(0, 1, f1) - smoother(0, 1, f2));
      const sn = Math.sin(th), cn = Math.cos(th), mz = P.messy * (E.rnd(c, 3) - .5) * .25 * sstep(0, .02, si - s + .02);
      // tangent along the ribbon (with a little mess), up, and the card's width/facing directions mid-turn
      const ta = [tx * Math.cos(mz) - tz * Math.sin(mz), 0, tz * Math.cos(mz) + tx * Math.sin(mz)], up = [0, 1, 0];
      const X = add([ta[0] * cn, 0, ta[2] * cn], up, -sn), Z = add([0, cn, 0], ta, sn);
      // layers: later cards lie on top; once turned over the order reverses, as it would on a real table
      const layer = lerp(c, n - 1 - c, th / PI) * .006 + .004, y = -.4 + layer + sn * (E.w / 2 + .01) + P.hop * E.w * .45 * sn * sn;
      // a card being turned curls along its width (most at the middle of the turn) and lands flat
      const curl = P.cardCurl * 1.4 * sn * (f1 > 0 && f1 < 1 ? 1 : f2 > 0 && f2 < 1 ? -1 : 0) / E.w;
      let m = frame3(x, y, z, X, Z);
      m = bk ? M(m, T(0, 0, -.0025), RY(PI)) : M(m, T(0, 0, .0005));
      return {m, bend: bk ? -curl : curl, b: 1 - P.flipShade * sn, blur: P.farBlur * clamp01(-z / 2) * .5, img: bk ? (c + Math.ceil(n / 2)) % n : c};
    }},

  /* 3. Twist Tower: floors float down into a twisting tower, it winds, holds, unwinds and lifts away top first */
  {...NEW, id: 'twist-tower', name: 'Twist Tower', n: 12, aspect: 1, cardH: .74, dur: 16, fov: 30,
    desc: 'Photos stack one by one into a twisting tower, hold, then unwind back down.',
    params: [G('Layout'), range('floorGap', 'Floor height', .04, .3, .1), range('twist', 'Twist', 0, 1, .55), range('camHigh', 'Camera height', 0, 1.3, .55), off('taper', 'Taper', .6),
      G('Motion'), whole('spinTurns', 'Turns', -2, 2, 1, {unit: '×', hint: 'whole turns of the tower per loop'}), range('dropH', 'Drop height', .3, 2, 1), range('overTwist', 'Twist overshoot', 0, 1.2, .45),
      range('sway', 'Sway', 0, 1, .45, .01, {hint: 'a slow wave of twist rolls up the tower'}), range('flutterT', 'Float curl', 0, 1.5, .7, .01, {hint: 'floors curl like paper as they float'}),
      range('buildTime', 'Build time', .6, 1.3, 1, .01, {unit: '×'}),
      G('Look'), range('floorShade', 'Lower shade', 0, .6, .26), off('baseBlur', 'Base blur', 1)],
    camera(P, E){
      const n = E.n, Ht = (n - 1) * P.floorGap, yc = -.42 + Ht * .5, d = 2.1 + Ht * 1.1 + E.w * 1.15, el = P.camHigh, az = .22 * Math.sin(TAU * E.p);
      return {eye: [d * Math.cos(el) * Math.sin(az), yc + d * Math.sin(el), d * Math.cos(el) * Math.cos(az)], target: [0, yc - .04, 0]};
    },
    layout(i, P, E){
      const n = E.n, p = E.p, bt = P.buildTime, y0 = -.42 + i * P.floorGap, top = (n - 1 - i) / Math.max(1, n - 1), up = i / Math.max(1, n - 1);
      const tw = towerWind(p, P);
      // leaving, top first: each floor lifts, drifts outward and turns, fading and growing as it goes
      const ls = .2 + top * .12, lv = i === 0 || p >= .405 ? 0 : clamp01((p - ls) / .09), le = ease.inOutSine(lv);
      // arriving, bottom first: each floor floats down from above, slowing to rest on the floor below
      const as = .41 + (i - 1) / Math.max(1, n - 2) * .3 * bt, at = i === 0 || p < .405 ? 1 : clamp01((p - as) / .12), ae = 1 - (1 - at) ** 3;
      const dirA = E.rnd(i, 4) * TAU, out = le * .35;
      const y = y0 + (le * le * 1.3 + (1 - ae) * 1.15) * P.dropH;
      const o = (1 - smoother(.25, 1, lv)) * smoother(0, .4, at);
      const ry = i * P.twist * .3 * tw + P.sway * .22 * Math.sin(TAU * p - up * 2.4) + p * TAU * Math.round(P.spinTurns) + (1 - ae) * 1.3 + le * .9;
      // curl follows the vertical motion: rising floors bow down at the edges, falling ones lift at the edges
      const vel = lv > 0 && lv < 1 ? Math.sin(PI * lv) : at < 1 ? -3 * (1 - at) ** 2 * .6 : 0, k = P.flutterT * .9 * vel / E.w;
      const s = (1 - P.taper * up) * (1 + .12 * le) * lerp(.9, 1, ae);
      return {m: M(T(Math.cos(dirA) * out, y, Math.sin(dirA) * out), RY(ry), RX(-PI / 2)), bend: k, bendY: k * .7, s, o,
        b: 1 - P.floorShade * top, blur: P.baseBlur * top * .4 + .25 * le, zBias: i};
    }},
];
