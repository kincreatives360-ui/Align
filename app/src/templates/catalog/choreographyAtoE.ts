import type { Env, Template, CardPose } from '../types';
import { adaptReferenceControls } from '../referenceControls';
import type { ReferenceControl, ReferenceRangeControl, ReferenceSegmentControl } from '../referenceControls';
import { ab, clamp01, ease, fillSlots, frame3 as makeFrame3, lerp, M, P_GAP, rel, RZ, RX, RY, S, stepU, TAU, T, wrap, wrapFade } from '../kit';

const PI = Math.PI;
const D2R = PI / 180;
const sstep = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const smoother = (a: number, b: number, v: number): number => { const t = clamp01((v - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
type ChoreoParams = Record<string, any>;
type ChoreoEnv = Env & Record<string, any>;
type Vec = [number, number, number];
type ChoreoRaw = Omit<Template, 'params' | 'layout' | 'fill' | 'camera'> & {
  params?: unknown[];
  layout: (i: number, P: ChoreoParams, E: ChoreoEnv) => CardPose;
  fill?: (P: ChoreoParams, E: ChoreoEnv) => Record<string, unknown>;
  camera?: (P: ChoreoParams, E: ChoreoEnv) => { eye: number[]; target: number[] };
};
const range = (key: string, label: string, min: number, max: number, def: number, step = 0.01, extra: Partial<ReferenceRangeControl> = {}): ReferenceRangeControl => ({ key, label, type: 'range', min, max, step, def, ...extra });
const whole = (key: string, label: string, min: number, max: number, def: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, min, max, def, 1, extra);
const off = (key: string, label: string, max: number, extra: Partial<ReferenceRangeControl> = {}) => range(key, label, 0, max, 0, 0.01, { off: true, ...extra });
const seg = (key: string, label: string, options: Record<string, string>, def: string): ReferenceSegmentControl => ({ key, label, type: 'seg', options, def });
const G = (group: string): ReferenceControl => ({ group });
const NEW: Pick<Template, 'cat' | 'frame' | 'isNew'> = { cat: 'choreo', isNew: true, frame: '5:4' };
const frame3 = (x: number, y: number, z: number, X: number[], Z: number[]) => makeFrame3(x, y, z, X as Vec, Z as Vec);
const normalizeChoreo = (templates: ChoreoRaw[]): Template[] => templates.map(template => ({ ...template, params: adaptReferenceControls((template.params ?? []) as ReferenceControl[]), camera: template.camera as Template['camera'] } as Template));

const CHOREO_A_TEMPLATES: Template[] = normalizeChoreo((() => {
// Choreography, batch A (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a door or a table is implied only by how the cards move and where they sit.


// 0 before a, 1 after b, eased between
const win: (...args: any[]) => any = (p, a, b, ez = ease.inOutCubic) => ez(clamp01((p - a) / Math.max(1e-4, b - a)));
// a smooth start that springs past the end and settles: zero speed at both ends, overshoot set by k (0 = none)
const springIn: (...args: any[]) => any = (t, k) => { if (t <= 0) return 0; if (t >= 1) return 1; const s = t * t * (3 - 2 * t), c = 1.70158 * k; return 1 + (c + 1) * (s - 1) ** 3 + c * (s - 1) ** 2; };
// small vector kit
const add: (...args: any[]) => any = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
// where a card bent to curvature k along its width must sit so its inner edge (x = -w/2) lands on the origin
const edgeAnchor: (...args: any[]) => any = (k, w) => ab(k) < 1e-4 ? [w / 2, 0] : [Math.sin(k * w / 2) / k, -(Math.cos(k * w / 2) - 1) / k];

// Revolving Door: the door's turn in wings (whole numbers per loop). It never stops dead: the speed dips smoothly to
// (pause = 1) or toward zero as each wing reaches its rest angle, and picks up again, a sine-shaped velocity
const doorTurn: (...args: any[]) => any = (p, W, pause) => { const t = p * W; return t - pause * Math.sin(TAU * t) / TAU; };
const doorSpeed: (...args: any[]) => any = (p, W, pause) => 1 - pause * Math.cos(TAU * p * W);

// Ribbon Spread: how far the deck has been spread along the ribbon (0 gathered, 1 spread), long eased in and out
const ribbonH: (...args: any[]) => any = (p, P) => { const st = P.spreadTime; return win(p, .02, .04 + .2 * st, ease.inOutQuart) - win(p, .96 - .16 * st, .985, ease.inOutQuart); };

// Twist Tower: how wound the tower is (1 at the loop start, unwinds, rewinds with a springy settle)
const towerWind: (...args: any[]) => any = (p, P) => (1 - win(p, .07, .24, ease.inOutSine)) + springIn(clamp01((p - .8) / .17), P.overTwist);

const templates: ChoreoRaw[] = [
  /* 1. Revolving Door: curved wings hinged on one upright axis; the door glides round a wing at a time */
  {...NEW, id: 'revolving-door', name: 'Revolving Door', n: 8, aspect: .8, cardH: .92, dur: 12, fov: 38,
    desc: 'Four photos are the wings of a revolving door; each one sweeps past the lens as the door turns.',
    params: [G('Layout'), whole('wings', 'Wings', 3, 6, 4), seg('sides', 'Photos on', {two: 'Both sides', one: 'One side'}, 'two'), range('hub', 'Hub gap', 0, .3, .04),
      range('wingCurve', 'Wing curve', 0, 1.6, .75, .01, {hint: 'the wings bow like curved glass'}), range('camHigh', 'Camera height', -.5, 1, .32), range('camSide', 'Camera side', -1, 1, 0),
      range('camDist', 'Camera distance', .7, 1.6, 1, .01, {unit: '×'}),
      G('Motion'), range('pause', 'Pause', 0, 1, .82, .01, {hint: 'how far the door slows as each wing comes round'}), range('rest', 'Rest angle', -45, 45, -16, 1, {unit: '°'}),
      range('flexW', 'Wing flex', 0, 1, .45, .01, {hint: 'wings bow further while the door turns fast'}), off('bob', 'Float', 1),
      G('Look'), range('turnDim', 'Turned shade', 0, 1, .4), range('farBlur', 'Far blur', 0, 1, .25)],
    fill: (P, _E) => { const W = Math.round(P.wings), two = P.sides !== 'one'; return {W, two, count: W * (two ? 2 : 1)}; },
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
  return templates;
})());

const CHOREO_B_TEMPLATES: Template[] = normalizeChoreo((() => {
// Choreography, batch B (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: tiers, lines, waves and carpets are implied by where the cards sit and
// how they move, never drawn.

const cycles = (key: string, label: string, min: number, max: number, def: number) => whole(key, label, min, max, def, {unit: '×', hint: 'whole cycles per loop, so it stays seamless'});
const smooth = (t: number) => smoother(0, 1, t);

/* ---------- Barrel Wave: the wave's cross-section ---------- */
// The sheet is symmetric about its trough: walking out from the middle toward either edge, the tangent turns by c
// radians in all — slowly at first, then faster — so both sides ramp up into walls and curl over toward each other,
// closing into a tube from the left and the right at once. half(s) returns [lateral, height, tangent angle] at arc
// length s ≥ 0 from the trough; the other side is its mirror.
function curlPt(s: any, Ls: any, c: any, pw: any): any {
  const N = Math.max(2, Math.ceil(s / Ls * 28)), ds = s / N; let u = 0, y = 0;
  for (let j = 0; j < N; j++){ const ph = c * Math.pow((j + .5) * ds / Ls, pw); u += Math.cos(ph) * ds; y += Math.sin(ph) * ds; }
  return [u, y, c * Math.pow(s / Ls, pw)];
}
// When closed the sheet is a true circle (radius R = Ls/π, its centre at height R), so the two lips meet over the
// top instead of each rolling into its own scroll; cMax is the turn that leaves a slim gap between them.
let barrelMemo: { key: string; v: { R: number; Ls: number; pS: number; cMax: number } | null } = {key: '', v: null};
function barrelCentre(P: ChoreoParams, E: ChoreoEnv): any {
  const rows = Math.round(P.rows), pS = E.h * (1 + P.gap), Ls = rows / 2 * pS, key = [rows, pS].join('|');
  if (barrelMemo.key === key) return barrelMemo.v;
  const gap = pS * .1; let lo = PI * .5, hi = PI;
  for (let k = 0; k < 40; k++){ const m = (lo + hi) / 2; if (Ls * Math.sin(m) / m > gap / 2) lo = m; else hi = m; }
  barrelMemo = {key, v: {R: Ls / PI, Ls, pS, cMax: lo}};
  return barrelMemo.v;
}

const templates: ChoreoRaw[] = [
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
      const tiers = Math.round(P.tiers), R0 = 2.5 * P.stage, dth = E.w * (1 + P.gap) / R0, K = Math.round(2 * P.span * D2R / dth) + 4, R: number[] = [], S: number[] = [], Y: number[] = [];
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
      const ph = s * 1.5 - TAU * Math.round(P.gusts) * E.p, pz = (a: number, sh: number) => Math.pow(.5 + .5 * Math.cos(a), sh);
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
    fill: (P, _E) => ({count: Math.round(P.cols) * Math.round(P.rows)}),
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
      const W = Math.round(P.ripples), hAt = (a: number, b: number) => { const back = clamp01((Lv / 2 - b) / Lv); return P.ripple * .17 * (.35 + .65 * back) * Math.sin(kw * b + TAU * W * E.p) + P.ripple * .05 * Math.sin(2.1 * a + TAU * E.p + b); };
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
  return templates;
})());

const CHOREO_C_TEMPLATES: Template[] = normalizeChoreo((() => {
// Choreography, batch C (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p. The photos are the only objects: orbits,
// cubes, wheels and spiral arms are implied by how the cards move and where they sit.

// quintic smootherstep: zero velocity and zero acceleration at both ends, for long silky eases
const sm5 = (t: number) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const clampAbs = (v: number, m: number) => Math.max(-m, Math.min(m, v));
const norm = (v: number[]) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const dot = (a: number[], b: number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
// curvature vector of a sampled path (points a step h apart): where the path is turning, scaled by 1/radius
function curvature(p0: number[], p1: number[], p2: number[], h: number): any {
  const v = [(p2[0] - p0[0]) / (2 * h), (p2[1] - p0[1]) / (2 * h), (p2[2] - p0[2]) / (2 * h)];
  const a = [(p2[0] - 2 * p1[0] + p0[0]) / (h * h), (p2[1] - 2 * p1[1] + p0[1]) / (h * h), (p2[2] - 2 * p1[2] + p0[2]) / (h * h)];
  const vv = dot(v, v) || 1e-9, t = norm(v), at = dot(a, t);
  return {t, k: [(a[0] - at * t[0]) / vv, (a[1] - at * t[1]) / vv, (a[2] - at * t[2]) / vv]};
}
// camera raised by `tilt` radians and swung round by `yaw`, looking at the target
const orbitCam = (E: ChoreoEnv, tilt: number, yaw = 0, dist = 1, ty = 0): { eye: Vec; target: Vec } => ({eye: [Math.sin(yaw) * Math.cos(tilt) * E.D * dist, ty + Math.sin(tilt) * E.D * dist, Math.cos(yaw) * Math.cos(tilt) * E.D * dist], target: [0, ty, 0]});

/* ---------- Roulette spin profile ---------- */
// share of a spin covered by time q: velocity q^1.2 (1-q)^2.6 — a quick, soft start and a long, long glide to rest,
// with zero speed at both ends so spins never start or stop with a jolt
const SPIN = (() => { const N = 1024, c = [0]; let s = 0;
  for (let k = 1; k <= N; k++){ const q = (k - .5) / N; s += Math.pow(q, 1.2) * Math.pow(1 - q, 2.6); c.push(s); }
  return c.map(v => v / s); })();
const spinShare = (q: number) => { const x = clamp01(q) * 1024, k = Math.min(1023, Math.floor(x)); return lerp(SPIN[k], SPIN[k + 1], x - k); };

const templates: ChoreoRaw[] = [
  // Atom: a centre photo with photos racing round tilted orbits. Orbit cards are curved strips that wrap along their
  // orbit (bent to its curvature, turned partly along it), so each orbit reads as a ring of curved screens. The whole
  // atom precesses and the camera drifts, so the rings keep crossing in depth.
  {...NEW, id: 'atom', name: 'Atom', n: 12, aspect: 1.5, cardH: .13, dur: 16, fov: 30,
    desc: 'Photos race along tilted orbits that cross around a glowing centre card.',
    params: [G('Layout'), whole('orbits', 'Orbits', 2, 4, 3), whole('perOrbit', 'Cards per orbit', 6, 24, 13), range('radius', 'Radius', .5, 1.2, .84),
      range('orbitTilt', 'Orbit tilt', .3, 1.5, 1.18), range('heroSize', 'Centre size', 1, 7, 4.2, .01, {unit: '×'}),
      G('Motion'), whole('laps', 'Laps', 1, 3, 1, {unit: '×'}), range('surge', 'Surge', 0, 1, .35, .01, {hint: 'cards ease through the turns and race across the front'}),
      whole('precess', 'Precess', 0, 2, 1, {unit: ' turns'}), seg('orbitDir', 'Direction', {same: 'Same', alt: 'Alternate'}, 'alt'), range('heroBreath', 'Centre breathe', 0, 1, .4),
      range('camDrift', 'Camera drift', 0, 1, .5),
      G('Look'), range('wrapAmt', 'Wrap', 0, 1, .7, .01, {hint: 'how far the cards turn along their orbit'}), range('curve', 'Curve', 0, 3, 1.8),
      range('depthScale', 'Depth scale', 0, 1, .55), range('depthShade', 'Depth shade', 0, .6, .28), off('farBlur', 'Far blur', 1)],
    fill: (P, _E) => ({count: 1 + Math.round(P.orbits) * Math.round(P.perOrbit)}),
    camera: (P, E) => orbitCam(E, .1 + .1 * P.camDrift * Math.sin(TAU * E.p), .22 * P.camDrift * Math.sin(TAU * E.p + .8)),
    layout(i, P, E){
      const yaw = .22 * P.camDrift * Math.sin(TAU * E.p + .8), tilt = .1 + .1 * P.camDrift * Math.sin(TAU * E.p);
      if (i === 0) return {s: P.heroSize * (1 + .04 * P.heroBreath * Math.sin(TAU * 2 * E.p)), ry: yaw + .08 * P.heroBreath * Math.sin(TAU * E.p), rx: -tilt + .05 * P.heroBreath * Math.cos(TAU * E.p), img: 0};
      const no = Math.round(P.orbits), per = Math.round(P.perOrbit), e = i - 1, k = Math.floor(e / per), sl = e % per;
      const R = P.radius * (1 + .08 * (k - (no - 1) / 2)), beta = k * PI / no + TAU * Math.round(P.precess) * E.p + .25, dir = P.orbitDir === 'alt' && k % 2 ? -1 : 1;
      const ct = Math.cos(P.orbitTilt), st = Math.sin(P.orbitTilt), cb = Math.cos(beta), sb = Math.sin(beta);
      const at = (f: number) => { const cx = R * Math.cos(f), cy = R * Math.sin(f) * ct, cz = R * Math.sin(f) * st; return [cx * cb - cy * sb, cx * sb + cy * cb, cz]; };
      // phase along the orbit; surge slows the cards through the sides and speeds them across the front and back
      const ph = TAU * (dir * Math.round(P.laps) * E.p + sl / per + k * .5 / per), f = ph - P.surge * .45 * Math.sin(2 * ph);
      const pos = at(f), tan = norm(at(f + .01 * dir).map((v, q) => v - at(f - .01 * dir)[q])), rad = norm(pos);
      const cam = orbitCam(E, tilt, yaw).eye, toCam = norm([cam[0] - pos[0], cam[1] - pos[1], cam[2] - pos[2]]);
      // facing: the camera, turned toward the orbit's outward normal by Wrap (never so far the back could show)
      const Z = norm([toCam[0] + P.wrapAmt * rad[0], toCam[1] + P.wrapAmt * rad[1], toCam[2] + P.wrapAmt * rad[2]]);
      const zn = pos[2] / R, depth = clamp01(.5 - zn * .5), sc = 1 + P.depthScale * .5 * zn;
      return {m: M(frame3(pos[0], pos[1], pos[2], tan, Z), S(sc, sc, 1)), bend: clampAbs(P.curve * dot(Z, rad) / R / sc, 6),
        b: 1 - P.depthShade * depth, blur: P.farBlur * depth * .6, img: 1 + e % Math.max(1, E.n - 1)};
    }},

  // Tesseract: a cube of photos turns inside a larger cube; they swap sizes, passing through each other. Mid-pass both
  // cubes swell toward spheres (their faces bow outward with real curvature) and settle flat again as they part.
  {...NEW, id: 'tesseract', name: 'Tesseract', n: 12, fixedN: true, aspect: 1, cardH: .6, dur: 16, fov: 30,
    desc: 'A cube of photos turns inside a larger cube, the two passing through each other.',
    params: [G('Layout'), range('outer', 'Outer size', .3, .8, .52), range('innerRatio', 'Inner size', .25, .65, .42, .01, {unit: '×'}), range('panel', 'Face fill', .5, 1, .86),
      range('skew', 'Cube offset', 0, 1, .55, .01, {hint: 'how differently the two cubes are tipped'}), range('camLift', 'Camera height', -.4, .8, .32),
      G('Motion'), whole('swaps', 'Swaps', 1, 2, 1, {unit: '×', hint: 'times per loop the cubes trade places and back'}), whole('turns', 'Turns', 1, 3, 1, {unit: '×'}),
      range('pause', 'Pause', 0, .7, .22), range('morph', 'Sphere morph', 0, 1, .55, .01, {hint: 'faces bow outward as the cubes pass through each other'}), range('camDrift', 'Camera drift', 0, 1, .5),
      G('Look'), range('pillow', 'Pillow', 0, .5, .04), range('ghost', 'Outer glass', 0, .8, .2, .01, {hint: 'the outer cube turns a little see-through'}), range('backFade', 'Far faces', 0, 1, .8), range('depthShade', 'Depth shade', 0, .6, .25)],
    camera: (P, E) => orbitCam(E, P.camLift + .06 * P.camDrift * Math.sin(TAU * E.p), .3 * P.camDrift * Math.sin(TAU * E.p)),
    layout(i, P, E){
      const cube = i < 6 ? 0 : 1, f = i % 6, u = stepU(E.p, 2 * Math.round(P.swaps), P.pause, t => t), lam = sm5(u - Math.floor(u)) + Math.floor(u);
      const mix = cube ? (1 - Math.cos(PI * lam)) / 2 : (1 + Math.cos(PI * lam)) / 2, pass = Math.sin(PI * mix);
      const big = P.outer, small = big * P.innerRatio, a = lerp(small, big, mix);
      // both cubes turn at a steady rate the whole loop; a slow nod keeps the motion from feeling mechanical
      const spin = TAU * Math.round(P.turns) * E.p, nod = .12 * Math.sin(TAU * E.p);
      const R = cube ? M(RY(-spin + .7), RZ(.55 * P.skew + nod), RX(-.4 * P.skew)) : M(RY(spin + .2), RX(.35 - nod));
      const FACE = [RY(0), RY(PI), RY(PI / 2), RY(-PI / 2), RX(-PI / 2), RX(PI / 2)];
      const swell = 1 + .12 * pass * P.morph, side = 2 * a * P.panel * swell, m = M(R, FACE[f], T(0, 0, a * (1 + .05 * pass * P.morph)));
      const cam = orbitCam(E, P.camLift + .06 * P.camDrift * Math.sin(TAU * E.p), .3 * P.camDrift * Math.sin(TAU * E.p)).eye;
      const fz = m[8] * (cam[0] - m[12]) + m[9] * (cam[1] - m[13]) + m[10] * (cam[2] - m[14]);
      const facing = sstep(-.2, .25, fz / Math.hypot(cam[0] - m[12], cam[1] - m[13], cam[2] - m[14]));
      const bow = (P.pillow + P.morph * .85 * pass) / a;
      return {m, w: side, h: side, bend: bow, bendY: bow, img: i, o: (1 - P.ghost * mix) * lerp(1 - P.backFade, 1, facing), b: 1 - P.depthShade * (1 - facing)};
    }},

  // Roulette: cards lie on a tilted wheel. Each spin: a soft wind-back, a quick but smooth launch, a long glide down
  // to rest and a gentle rock as it settles; the card that lands at the front lifts off the wheel and turns to face
  // you. Every spin advances the wheel by whole turns plus a share of slots, so the loop is a whole number of turns.
  {...NEW, id: 'roulette', name: 'Roulette', n: 12, aspect: .8, cardH: .34, dur: 15, fov: 30,
    desc: 'Photos ride a spinning wheel that slows, wobbles and lands on a winner.',
    params: [G('Layout'), range('radius', 'Radius', .5, 1.2, .78), range('wheelTilt', 'Wheel tilt', .4, 1.4, 1.02), range('camLift', 'Camera height', -.3, .6, .08),
      range('dish', 'Dish', 0, 1, .35, .01, {hint: 'cards lean up toward you like the sides of a bowl'}),
      G('Motion'), whole('spins', 'Spins', 1, 4, 3, {unit: '×', hint: 'landings per loop'}), whole('kick', 'Turns per spin', 1, 4, 1), range('windup', 'Wind-up', 0, 1, .5),
      range('wobble', 'Wobble', 0, 1, .6), range('rest', 'Rest', .2, .6, .36), range('liftAmt', 'Winner lift', 0, 1.5, 1),
      G('Look'), range('loserDim', 'Others dim', 0, .6, .28), range('spinBlur', 'Spin blur', 0, 1, .35)],
    camera: (P, E) => orbitCam(E, P.camLift, 0, 1, -.14),
    layout(i, P, E){
      const n = E.n, Sp = Math.round(P.spins), K = Math.round(P.kick), slot = TAU / n;
      const wheel = (p: number) => {
        const c = wrap(p, 1) * Sp, s = Math.floor(c), t = c - s, adv = Math.floor((s + 1) * n / Sp) - Math.floor(s * n / Sp);
        const base = s * K * TAU + Math.floor(s * n / Sp) * slot, q = clamp01((t - P.rest) / (1 - P.rest)), total = K * TAU + adv * slot;
        // wind-back and rock both start and end with zero speed, so they blend into the glide
        const wu = -P.windup * .035 * Math.sin(PI * clamp01(q / .24)) ** 2;
        const wq = clamp01((q - .72) / .28), rock = P.wobble * .4 * slot * Math.sin(TAU * wq) * Math.sin(PI * wq) ** 2 * (1 - wq) / total;
        return {ang: base + total * (spinShare(q) + wu + rock), t};
      };
      const W = wheel(E.p), rr = W.t / P.rest, env = rr < 1 ? sm5(rr / .35) * (1 - sm5((rr - .68) / .3)) : 0;
      const psi = i * slot - W.ang, d = Math.atan2(Math.sin(psi), Math.cos(psi)), sel = sm5(1 - ab(d) / (slot * .55)), lw = env * sel * P.liftAmt;
      const ct = Math.cos(P.wheelTilt), st = Math.sin(P.wheelTilt), tilt = (v: number[]) => [v[0], v[1] * ct - v[2] * st, v[1] * st + v[2] * ct];
      // each card lies on the wheel, leaning up by Dish toward the outside like the wall of a bowl
      const out = [Math.sin(psi), 0, Math.cos(psi)], dl = P.dish * .55;
      const pos = tilt([P.radius * out[0], 0, P.radius * out[2]]), X0 = tilt([Math.cos(psi), 0, -Math.sin(psi)]);
      const Z0 = tilt([-out[0] * Math.sin(dl), Math.cos(dl), -out[2] * Math.sin(dl)]);
      const X = [lerp(X0[0], 1, lw), lerp(X0[1], 0, lw), lerp(X0[2], 0, lw)], Z = [lerp(Z0[0], 0, lw), lerp(Z0[1], .1, lw), lerp(Z0[2], 1, lw)];
      const loopAdvance = (Sp * K + 1) * TAU, angleDelta = wheel(E.p + .002).ang - wheel(E.p - .002).ang;
      const sp = ab(angleDelta + Math.round(-angleDelta / loopAdvance) * loopAdvance) / .004 / loopAdvance, sc = 1 + .45 * lw;
      return {m: M(T(pos[0], pos[1] + lw * .45, pos[2] + lw * .55), frame3(0, 0, 0, X, Z), S(sc, sc, 1)),
        b: 1 - P.loserDim * env * (1 - sel), blur: P.spinBlur * sstep(.4, 1.6, sp) * .5, zBias: lw * 3};
    }},

  // Echo Trail: one hero card follows a closed 3D curve; copies at earlier moments trail behind it, smaller and
  // fainter. Every card curves with the path (bent to its turn in depth) and banks into it. The hero flips edge-on to
  // change photo, and the echoes replay that flip as they pass the same spot.
  {...NEW, id: 'echo-trail', name: 'Echo Trail', n: 8, aspect: .8, cardH: .6, dur: 16, fov: 30,
    desc: 'A photo sweeps along a curve, leaving a fading trail of echoes behind it.',
    params: [G('Layout'), seg('path', 'Path', {eight: 'Figure 8', orbit: 'Orbit', knot: 'Knot'}, 'eight'), range('pathW', 'Width', .4, 1.4, .82), range('pathH', 'Height', .2, 1, .5),
      range('pathDepth', 'Depth', 0, 2, 1.1),
      G('Motion'), whole('laps', 'Laps', 1, 3, 2, {unit: '×'}), whole('echoes', 'Echoes', 3, 24, 14), range('lag', 'Echo spacing', .004, .04, .01),
      range('flip', 'Flip time', .1, .6, .34, .01, {hint: 'how long the photo change takes'}), range('lean', 'Lean', 0, 1, .55),
      G('Look'), range('curl', 'Curve', 0, 2, 1, .01, {hint: 'cards bend with the turns of the path'}), range('echoFade', 'Echo fade', .3, 3, 1.4), range('shrink', 'Echo shrink', 0, .8, .4), range('echoBlur', 'Echo blur', 0, 1, .3)],
    fill: (P, _E) => ({count: Math.round(P.echoes) + 1}),
    layout(i, P, E){
      const m = Math.round(P.echoes), j = i, n = E.n, tau = wrap(E.p - j * P.lag, 1), L = Math.round(P.laps), path = P.path;
      const nw = Math.min(1, Math.sqrt(E.asp / 1.25));
      const at = (tt: number) => { const s = TAU * L * tt;
        if (path === 'orbit') return [nw * P.pathW * Math.sin(s), P.pathH * .35 * Math.sin(2 * s), P.pathDepth * Math.cos(s)];
        if (path === 'knot') return [nw * P.pathW * Math.sin(2 * s), P.pathH * Math.sin(3 * s), P.pathDepth * .7 * Math.cos(s)];
        return [nw * P.pathW * Math.sin(s), P.pathH * Math.sin(2 * s), P.pathDepth * .5 * Math.cos(s)]; };
      const h = .0025, p1 = at(tau), {t, k} = curvature(at(tau - h), p1, at(tau + h), h);
      // photo changes: n per loop, each through an edge-on flip centred on the change
      const fpos = tau * n + .5, kk = Math.round(fpos), dd = fpos - kk, half = P.flip / 2;
      let ry = 0;
      if (ab(dd) < half){ const ang = PI * sm5((dd + half) / (2 * half)); ry = ang > PI / 2 ? ang - PI : ang; }
      const age = j / m, sc = 1 - P.shrink * age;
      // bend toward the centre of the turn in depth: edges fold back when the path swings round behind
      const bend = clampAbs(-P.curl * k[2] * .8, 2.4) / sc * Math.cos(ry), lean = P.lean * .5 * t[0] * sm5(ab(dd) / Math.max(1e-4, half));
      return {x: p1[0], y: p1[1], z: p1[2], ry: ry + lean, rz: -P.lean * .3 * t[1], bend, img: wrap(Math.floor(fpos), n),
        s: sc, o: Math.pow(1 - j / (m + 1), P.echoFade), blur: P.echoBlur * age * .7, b: 1 - .18 * age, zBias: -j * .05};
    }},

  // Galaxy: curved photo panels stand in the spiral arms like screens set along a winding road, each bent to the
  // arm's curve and turned toward you. The arms are logarithmic spirals and the panels sit at equal steps of log-radius,
  // each sized to its own step, so the arm is self-similar: every panel has the same clear gap to its neighbours from
  // the rim to the core, and none ever covers another. They flow inward as the galaxy turns, the core winding tighter
  // so the centre turns faster than the rim.
  {...NEW, id: 'galaxy', name: 'Galaxy', n: 12, aspect: 1.3, cardH: .23, dur: 30, fov: 30,
    desc: 'Tiny photos swirl in the spiral arms of a galaxy, the centre turning faster than the rim.',
    params: [G('Layout'), seg('arms', 'Arms', {2: 'Two', 3: 'Three', 4: 'Four'}, '2'), whole('perArm', 'Cards per arm', 8, 30, 14), range('galSize', 'Size', .6, 1.8, 1.25),
      range('wind', 'Wind', .3, 3, 2), range('cardFill', 'Card size', .4, .9, .8, .01, {hint: 'share of each step along the arm a photo fills; the rest is gap'}), range('warp', 'Disc warp', 0, 1, .3), range('galTilt', 'Camera tilt', 0, 1.2, .9),
      G('Motion'), whole('turns', 'Turns', 1, 3, 1, {unit: '×'}), whole('flow', 'Inflow', 1, 3, 1, {unit: '×', hint: 'times each card falls from rim to core per loop'}), range('coreSpin', 'Core spin', 0, 1, .5, .01, {hint: 'the core winds tighter, so it turns faster than the rim'}),
      G('Look'), range('curve', 'Curve', 0, 2, 1, .01, {hint: 'cards bend along the arm'}), range('lookUp', 'Face camera', 0, 1, .6),
      range('rimFade', 'Rim fade', 0, 1, .5), off('farBlur', 'Far blur', 1)],
    fill: (P, _E) => { const a = +P.arms; return {count: a * Math.min(Math.round(P.perArm), Math.floor(120 / a))}; },
    camera: (P, E) => orbitCam(E, P.galTilt, 0, 1),
    layout(i, P, E){
      const A = +P.arms, per = Math.min(Math.round(P.perArm), Math.floor(120 / A)), arm = i % A, kq = Math.floor(i / A);
      const LM = Math.log(10), dl = LM / per, rMax = P.galSize * Math.min(1, Math.sqrt(E.asp / 1.25)), base = arm * TAU / A + TAU * Math.round(P.turns) * E.p;
      // slot position along the arm (0 at the rim, per at the core), whole slots per loop so it is seamless
      const u = wrap(kq + per * Math.round(P.flow) * E.p, per), l0 = Math.min(u, per - .02) * dl;
      const thAt = (l: number) => base + P.wind * (l + P.coreSpin * l * l / (2 * LM));
      const at = (l: number) => { const r = rMax * Math.exp(-l), th = thAt(l); return [r * Math.cos(th), 0, r * Math.sin(th)]; };
      const h = dl * .05, p = at(l0), {t, k} = curvature(at(l0 - h), p, at(l0 + h), h), r = rMax * Math.exp(-l0);
      // one step along the arm, and the gap to the next turn of the arms outward; the photo fits inside both
      const wE = P.wind * (1 + P.coreSpin * l0 / LM), step = r * dl * Math.sqrt(1 + wE * wE), across = r * (Math.exp(TAU / (A * wE)) - 1);
      const cw = Math.min(P.cardFill * step, across * .55 * E.w / E.h), sc = cw / E.w;
      const y = P.warp * .12 * r * Math.sin(2 * (thAt(l0) - base) + 1), cam = orbitCam(E, P.galTilt).eye;
      // stand each panel along the arm, its face turned to the camera's side (it swaps sides only when edge-on)
      const nrm = [-t[2], 0, t[0]], cx = cam[0] - p[0], cz = cam[2] - p[2], ch = Math.hypot(cx, cz) || 1, fd = (nrm[0] * cx + nrm[2] * cz) / ch, sg = fd < 0 ? -1 : 1;
      const Z = [nrm[0] * sg, 0, nrm[2] * sg], ry = Math.atan2(Z[0], Z[2]), rx = -P.lookUp * Math.atan2(cam[1] - y, ch);
      const bend = clampAbs(-P.curve * (k[0] * Z[0] + k[2] * Z[2]) * sc, 1.6 / E.w) * sstep(.04, .3, ab(fd));
      const o = sstep(0, .3 + 1.6 * P.rimFade, u) * (1 - sstep(per - 2.6, per - .3, u)) * sstep(0, .08, ab(fd));
      return {m: M(T(p[0], y, p[2]), RY(ry), RX(rx), S(sc, sc, 1)), bend, o, img: i % E.n,
        blur: P.farBlur * clamp01(-p[2] / rMax * .5 + .5) * .6, b: .9 + .1 * (1 - l0 / LM)};
    }},
  ];
  return templates;
})());

const CHOREO_D_TEMPLATES: Template[] = normalizeChoreo((() => {
// Choreography, batch D (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: stairs, doorways and the crawl's curved plane are implied by how the cards move.

// quintic smootherstep: zero velocity and acceleration at both ends, for long silky eases
const sm5 = (t: number) => { t = clamp01(t); return t * t * t * (t * (t * 6 - 15) + 10); };
// a little damped wobble that starts at 0 (follow-through after an impact); t in loop-fraction units since the impact
const wob: (...args: any[]) => any = (t, freq = 30, damp = 10) => t <= 0 ? 0 : Math.exp(-t * damp) * Math.sin(t * freq);
// a bump that rises and falls back with zero speed at both ends, peaking at `at` of the way through
const bump: (...args: any[]) => any = (t, at = .5) => { t = clamp01(t); return Math.sin(PI * Math.pow(t, Math.log(.5) / Math.log(at))) ** 3; };
// small keyed cache for tables that only change when the params do
function memo(cache: Map<string, any>, key: string, make: () => any): any { let v = cache.get(key); if (!v){ if (cache.size > 16) cache.clear(); v = make(); cache.set(key, v); } return v; }

/* ---------- Opening Crawl surface ---------- */
// The crawl runs up a vertical sheet, then rolls back over a soft crest onto the receding plane. The lean angle grows
// with a smootherstep over the crest, so the curvature (the cards' bendY) rises and falls smoothly, never kinks.
const CRAWL = new Map();
function crawlPath(lay: number, Lc: number): (s: number) => any {
  return memo(CRAWL, lay + ',' + Lc, () => {
    const N = 240, ys = [0], zs = [0];
    let y = 0, z = 0;
    for (let k = 1; k <= N; k++){ const th = lay * sm5((k - .5) / N), ds = Lc / N; y += Math.cos(th) * ds; z -= Math.sin(th) * ds; ys.push(y); zs.push(z); }
    return (s: number) => {
      if (s <= 0) return {y: s, z: 0, th: 0, k: 0};
      if (s >= Lc) return {y: ys[N] + Math.cos(lay) * (s - Lc), z: zs[N] - Math.sin(lay) * (s - Lc), th: lay, k: 0};
      const x = s / Lc * N, q = Math.min(N - 1, Math.floor(x)), f = x - q, u = s / Lc;
      return {y: lerp(ys[q], ys[q + 1], f), z: lerp(zs[q], zs[q + 1], f), th: lay * sm5(u), k: lay * 30 * u * u * (1 - u) * (1 - u) / Lc};
    };
  });
}

const templates: ChoreoRaw[] = [
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
    camera: (P, _E) => ({eye: [0, 2.2 + P.view, 5], target: [0, -.12, -.1]}),
    layout(i, P, E){
      const n = E.n, fl = P.airTime, w = E.p * n + i + P.cascade * .2 * i / n, j = Math.floor(w), lam = w - j, J = wrap(j, n);
      const run = E.h * P.run, rise = E.h * P.rise, side = E.w * P.side;
      const st = (q: number) => [(q - (n - 1) / 2) * side, ((n - 1) / 2 - q) * rise - .1, (q - (n - 1) / 2) * run];
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
    fill: (_P, E) => ({count: 2 * E.n}),
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
    camera: (_P, E) => ({eye: [0, 0, E.D * 1.2], target: [0, 0, 0]}),
    fill: (P, _E) => ({count: Math.round(P.rays) * Math.round(P.rings)}),
    layout(i, P, E){
      const R = Math.round(P.rays), Rg = Math.round(P.rings), j = Math.floor(i / R), k = i % R, sw = P.sweep * .15 * k / R;
      const span = (Rg - 1) * P.ringDelay + P.sweep * .15, sc = Math.min(1, .18 / Math.max(1e-3, span));
      const dOut = (j * P.ringDelay + sw) * sc, dIn = ((Rg - 1 - j) * P.ringDelay + sw) * sc;
      // out on a long smootherstep with a swell past the mark; in after a small outward breath; all with zero end speeds
      const ext = (p: number) => { const to = (p - dOut) / .32, ti = (p - .56 - dIn) / .24;
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
    camera: (_P, E) => ({eye: [0, .85, E.D], target: [0, .05, 0]}),
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
  return templates;
})());

const CHOREO_E_TEMPLATES: Template[] = normalizeChoreo((() => {
// Choreography, batch E (see tools/choreo-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.

const FLAT = RX(-PI / 2);   // a card lying face up, the top of the photo pointing away from the camera

const templates: ChoreoRaw[] = [
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
    camera: (P, _E) => ({eye: [0, P.camH, 1.7], target: [0, P.camH * .25 - .22, -2.2]}),
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
  return templates;
})());

const CHOREO_F_TEMPLATES: Template[] = normalizeChoreo((() => {
// Choreography, batch F (see tools/choreo2-briefs.md). Same contract as templates.js: layout(i, P, E) places card i
// for the loop phase E.p in [0,1), and every value is periodic in E.p.
// The photos are the only objects: a lens, a sphere, a cylinder or a table are implied only by how the cards move.


// 0 before a, 1 after b, eased between
// soft bell: 1 at d = 0, falling smoothly to ~0 by d = r (zero slope at both ends, so nothing ever kinks)
const bell: (...args: any[]) => any = (d, r) => { const t = clamp01(Math.abs(d) / Math.max(1e-4, r)); return 1 - t * t * t * (t * (t * 6 - 15) + 10); };
const gauss: (...args: any[]) => any = (d, r) => Math.exp(-((d / Math.max(1e-4, r)) ** 2));
// error function (Abramowitz–Stegun 7.1.26), for the dock's integrated magnification
const erf = (x: number) => { const s = x < 0 ? -1 : 1; x = Math.abs(x); const t = 1 / (1 + .3275911 * x);
  return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - .284496736) * t + .254829592) * t * Math.exp(-x * x)); };
// Proximity Wave: the lens wanders a closed Lissajous loop (whole frequencies, so it is seamless)
const lensAt = (p: number, P: ChoreoParams, ax: number, ay: number): [number, number] => [ax * Math.sin(TAU * p + .3), ay * Math.sin(TAU * Math.round(P.lensLoops) * p + 1.1)];
// Proximity Dock: where the focus is along the row (a slow glide back and forth, sine so the speed never jumps)
const dockFocus = (p: number, P: ChoreoParams, A: number) => A * Math.sin(TAU * p) * (1 + .12 * Math.sin(TAU * 2 * p) * P.wander);
// Flicker: continuous position through the pile: each beat riffles `per` cards, decelerating into a hold
const templates: ChoreoRaw[] = [
  /* 1. Proximity Wave: a wall of photos; an invisible lens drifts over it and each card it nears lifts, swells and
     turns toward it, while its neighbours lean back and slide aside a little to make room */
  {...NEW, id: 'proximity-wave', name: 'Proximity Wave', n: 10, aspect: .8, cardH: .4, dur: 14, fov: 30,
    desc: 'An invisible lens drifts across a wall of photos; the ones it passes rise toward you and swell.',
    params: [G('Layout'), range('pitch', 'Spacing', 1, 1.6, 1.14, .01, {unit: '×'}), range('reach', 'Lens size', .3, 1.4, .7), range('camTilt', 'Camera tilt', -30, 30, 10, 1, {unit: '°'}),
      G('Motion'), range('lift', 'Lift', 0, 1.2, .8), range('swell', 'Swell', 0, 1.2, .75), range('lean', 'Lean to lens', 0, 1, .55), range('room', 'Make room', 0, 1, .5),
      whole('lensLoops', 'Lens path', 1, 3, 2, {hint: 'how many loops the lens draws up and down per cycle'}),
      G('Look'), range('cup', 'Card curve', 0, 1.5, .7), range('dimRest', 'Rest shade', 0, .5, .16), off('restBlur', 'Rest blur', 1)],
    fill(P, E){ const px = E.w * P.pitch, py = E.h * P.pitch, cols = Math.min(13, 2 * Math.ceil(E.vx / px * .92) + 1), rows = Math.min(9, 2 * Math.ceil(E.vy / py * .92) + 1);
      return {cols, rows, px, py, count: cols * rows}; },
    camera(P, E){ const a = P.camTilt * D2R, d = E.D * 1.04; return {eye: [0, -Math.sin(a) * d, Math.cos(a) * d], target: [0, 0, 0]}; },
    layout(i, P, E){
      const c = i % E.cols, r = Math.floor(i / E.cols), x0 = (c - (E.cols - 1) / 2) * E.px, y0 = ((E.rows - 1) / 2 - r) * E.py;
      const [lx, ly] = lensAt(E.p, P, Math.min(E.vx * .62, (E.cols - 1) / 2 * E.px * .8), Math.min(E.vy * .5, (E.rows - 1) / 2 * E.py * .7));
      const R = P.reach, dx = x0 - lx, dy = y0 - ly, d = Math.hypot(dx, dy), k = bell(d, R * 1.6), g = gauss(d, R * .55);
      // neighbours slide out from the lens, strongest on the ring just outside it, none under it or far away
      const push = P.room * .12 * R * Math.sin(PI * clamp01(d / (R * 1.6))) * (1 - g * .6), ux = d > 1e-4 ? dx / d : 0, uy = d > 1e-4 ? dy / d : 0;
      const x = x0 + ux * push, y = y0 + uy * push, z = P.lift * .5 * g - .04 * P.room * (k - g);
      // turn toward the lens: the face tilts its far side up toward where the lens is (falls off over the bell)
      const lean = P.lean * .55 * k * (1 - g * .5);
      return {x, y, z, ry: -Math.atan(dx / R) * lean, rx: Math.atan(dy / R) * lean, s: 1 + P.swell * .6 * g,
        bend: P.cup * .9 * g, bendY: P.cup * .4 * g, zBias: g * .02, b: 1 - P.dimRest * (1 - k), blur: P.restBlur * (1 - k) * .35, img: i % E.n};
    }},

  /* 2. Proximity Dock: one row, magnified like a dock under a gliding focus. The magnification is integrated along
     the row, so cards spread apart exactly as much as their neighbours grow and never overlap; the swell is a smooth
     bump in depth and every card tilts and bends to sit on it */
  {...NEW, id: 'proximity-dock', name: 'Proximity Dock', n: 9, aspect: .8, cardH: .36, dur: 12, fov: 30,
    desc: 'A row of curved photos magnifies like a dock as a focus glides back and forth.',
    params: [G('Layout'), range('gap', 'Gap', 0, .5, .12), range('base', 'Baseline', -.8, .4, -.42), range('camHigh', 'Camera height', -.4, 1, .2), range('camYaw', 'Camera angle', -30, 30, 0, 1, {unit: '°'}),
      G('Motion'), range('mag', 'Magnify', 0, 2.5, 1.25, .01, {unit: '×'}), range('width', 'Swell width', .2, 1.2, .6), range('glide', 'Glide', .2, 1, .78, .01, {hint: 'how far along the row the focus travels'}),
      range('wander', 'Wander', 0, 1, .4),
      G('Look'), range('swellZ', 'Swell depth', 0, 1, .55), range('curve', 'Card curve', 0, 2, 1), range('dimRest', 'Rest shade', 0, .5, .12)],
    fill(P, E){ const pitch = E.w * (1 + P.gap), half = E.vx + E.w * (P.mag + 1); return {pitch, count: 2 * Math.ceil(half / pitch) + 1}; },
    camera(P, E){ const a = P.camYaw * D2R, d = E.D * 1.02; return {eye: [Math.sin(a) * d, P.camHigh * .9 + P.base * .4, Math.cos(a) * d], target: [0, P.base * .4 + .02, 0]}; },
    layout(i, P, E){
      const N = E.count, pitch = E.pitch, b = (i - (N - 1) / 2) * pitch, sig = P.width * .9;
      const f = dockFocus(E.p, P, P.glide * Math.min(E.vx * .78, (N - 1) / 2 * pitch * .6));
      // position: the row's own length grows by the magnification it passes over
      const m = P.mag * gauss(b - f, sig), x = b + P.mag * sig * Math.sqrt(PI) / 2 * erf((b - f) / sig);
      const s = 1 + m;
      // the swell as a depth bump z(x): tilt to its slope, bend to its curvature (convex on top)
      const A = P.swellZ * .35, g = gauss(b - f, sig), slope = -2 * (b - f) / (sig * sig) * A * g, curv = A * g * (4 * (b - f) ** 2 / sig ** 4 - 2 / sig ** 2);
      return {x, y: P.base + (s - 1) * E.h / 2, z: A * g, s, ry: -Math.atan(slope) * .8, bend: P.curve * (.25 - curv * .5) / s, zBias: g * .02,
        b: 1 - P.dimRest * (1 - g), img: ((i - Math.floor(N / 2)) % E.n + E.n) % E.n};
    }},

  ];
  return templates;
})());

export const CHOREOGRAPHY_A_TO_E_TEMPLATES: Template[] = [
  ...CHOREO_A_TEMPLATES,
  ...CHOREO_B_TEMPLATES,
  ...CHOREO_C_TEMPLATES,
  ...CHOREO_D_TEMPLATES,
  ...CHOREO_E_TEMPLATES,
  ...CHOREO_F_TEMPLATES,
];
