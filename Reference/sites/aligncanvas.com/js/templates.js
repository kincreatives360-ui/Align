// The template library. Each template places its cards in 3D for a loop phase p in [0,1), so every
// animation loops seamlessly. World units: the frame is 2 tall at z = 0; x spans ±aspect.
//
// layout(i, P, E) returns {x,y,z, rx,ry,rz, s, o, blur, b, glare, zBias, bend, aspect?, w?, h?} or {m: matrix, ...}
//   P = this template's parameters, E = {p, n, asp, w, h, D, rnd(i,k), ez, hold}
// camera(P, E) may return {eye, target}; a template's own field of view is `fov` (degrees).
import { TAU, clamp01, sstep, wrap, ease, mat4, lerp } from './math.js';

export const CATEGORIES = [
  ...Y_CATEGORIES, ['transitions', 'Transitions'], ['carousel', 'Carousel & Slider'], ['ring', 'Ring & Orbit'], ['stack', 'Stack & Grid'],
  ['3d', '3D Showcase'], ['glass', 'Liquid Glass'], ...X_CATEGORIES, ...Z_CATEGORIES,
];

/* ---------- helpers (shared with templates-x.js) ---------- */
import { rel, stepU, stepSpeed, ab, sgn, tiltPt, wrapFade, fillSlots, stripFill, laneFill, FILL_X, FILL_Y, M, T, RX, RY, RZ,
  P_HOLD, P_EASE, P_GAP, P_TILT, P_RADIUS, P_CURVE, P_COLS, P_SPREAD } from './kit.js';
import { X_CATEGORIES, X_TEMPLATES } from './templates-x.js';
import { Y_CATEGORIES, Y_TEMPLATES } from './templates-y.js';
import { Z_CATEGORIES, Z_TEMPLATES } from './templates-z.js';

/* ---------- looks ---------- */
const SOFT = '#f4f4f4', WARM = '#f4f4f4';
// every template starts on the same plain #F4F4F4 background; colour is the user's choice in the Visual panel
const BG = () => ({});
// Surface-style glass rims: the image smears toward the edges with rainbow dispersion
const GLASS = (edges, o = {}) => ({glass: {on: true, mode: 'per', top: 0, bottom: 0, left: 0, right: 0, width: .28, refraction: .62, curve: 'panel', dispersion: .7, soften: .45, feather: 0, highlight: .32, bulge: .4, ...edges, ...o}});
const LR = (o) => GLASS({left: 1, right: 1}, o);

export const TEMPLATES = [
  /* ===================== Transitions ===================== */
  {id: 'flare-duo', name: 'Flare Duo', cat: 'transitions', kind: 'flare', n: 8, set: 'photos', aspect: 1.8, frame: '4:3',
    desc: 'The glass card hand-off: the old card is pushed off by a flaring edge.',
    style: {shadow: {on: true, alpha: .3}, labels: {on: true}}},
  {id: 'prism-slider', name: 'Prism Slider', cat: 'transitions', n: 7, set: 'photos', aspect: .8, step: true, cardH: 1.1, perCard: 1.8, frame: '5:4', fov: 32,
    desc: 'Cards sit on the faces of a turning prism; the neighbours fold away into glass edges.',
    style: {...BG(WARM), ...LR({width: .2, refraction: .7, bulge: .25})},
    params: [{group: 'Layout'}, P_GAP(.06), {key: 'prismDepth', label: 'Prism depth', type: 'range', min: .3, max: 2.5, step: .01, def: 1, unit: '×'},
      {key: 'axisTilt', label: 'Axis tilt', type: 'range', min: -.6, max: .6, step: .01, def: 0}, {key: 'sideSpread', label: 'Side spread', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'lean', label: 'Lean in turn', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'turnLift', label: 'Lift in turn', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'reach', label: 'Visible faces', type: 'range', min: -.5, max: 1, step: .01, def: .05}, {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'sideBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'pop', label: 'Front scale', type: 'range', min: 0, max: .3, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const n = E.n, a0 = TAU / n, apo = E.w * (1 + P.gap) / (2 * Math.tan(Math.PI / n)) * P.prismDepth;
      const u = stepU(E.p, n, E.hold, E.ez), r = rel(i, u, n), a = r * a0, k = Math.min(1, ab(r)), tw = Math.sin(Math.PI * (u - Math.floor(u)));
      return {m: M(T(r * E.w * P.sideSpread, tw * P.turnLift * E.h * .25, 0), RX(P.axisTilt + tw * P.lean * .35), T(0, 0, -apo), RY(a), T(0, 0, apo)), o: clamp01((Math.cos(a) + P.reach) * 6),
        s: 1 + P.pop * (1 - k), b: 1 - P.sideShade * k * .6, blur: P.sideBlur * k};
    }},
  {id: 'portal', name: 'Portal', cat: 'transitions', n: 7, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.25, perCard: 1.6,
    desc: 'Fly through the images one after another.',
    style: {...BG('#0c0c0e', 'radial', {c: ['#0b0b0d', '#1d1f26', '#000000', '#000000']}), blur: {on: true, depth: .4}},
    params: [{group: 'Layout'}, {key: 'depth', label: 'Depth', type: 'range', min: .6, max: 4, step: .01, def: 1.8}, {key: 'drift', label: 'Lateral drift', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'curl', label: 'Spiral', type: 'range', min: 0, max: 2, step: .01, def: 0, off: true}, {key: 'twist', label: 'Twist', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'exitTurn', label: 'Exit turn', type: 'range', min: -1.5, max: 1.5, step: .01, def: 0}, {key: 'exitGrow', label: 'Exit scale', type: 'range', min: 0, max: 2, step: .01, def: 0, off: true},
      {key: 'exitFade', label: 'Exit fade', type: 'range', min: .6, max: 4, step: .01, def: 1.6},
      {group: 'Look'}, {key: 'queue', label: 'Queue length', type: 'range', min: .5, max: 5, step: .01, def: 2.2}, {key: 'depthBlur', label: 'Depth blur', type: 'range', min: 0, max: 2.5, step: .01, def: 1, unit: '×'},
      {key: 'depthDim', label: 'Depth shade', type: 'range', min: 0, max: 1.8, step: .01, def: 1, unit: '×'}],
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = wrap(i - u + 1, E.n) - 1, c = r * P.curl;
      const o = r < 0 ? clamp01(1 + r * P.exitFade) : clamp01(1 - (r - P.queue) / 1.2);
      return {x: r * P.drift * E.w * .5 + Math.sin(c) * r * .35, y: (1 - Math.cos(c)) * r * .35, z: -r * P.depth, rz: r * P.twist, ry: r < 0 ? -r * P.exitTurn : 0, s: r < 0 ? 1 - r * P.exitGrow : 1,
        o, blur: clamp01(ab(r) * .45 * P.depthBlur), b: r < 0 ? 1 : 1 - Math.min(.5, r * .15) * P.depthDim};
    }},

  /* ===================== Carousel & Slider ===================== */
  {id: 'glass-carousel', name: 'Glass Carousel', cat: 'carousel', n: 12, set: 'photos', aspect: .8, cardH: 1.3, dur: 30, frame: '5:4', resBoost: 2, fov: 58,
    desc: 'A ring of curved cards wrapped around the camera, melting into liquid-glass edges.',
    style: {...BG(SOFT), ...LR({width: .3, refraction: .8, bulge: .8, dispersion: .95, highlight: .25})},
    params: [{group: 'Layout'}, P_RADIUS(1), P_GAP(.2), P_CURVE(1), {key: 'ellipse', label: 'Ellipse', type: 'range', min: .6, max: 1.6, step: .01, def: 1, unit: '×'},
      {key: 'camH', label: 'Camera height', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'rimWave', label: 'Rim wave', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}, {key: 'bob', label: 'Bob', type: 'range', min: 0, max: .3, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Front scale', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}, {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'sideBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    camera: (P, E) => { const R = carouselR(P, E); return {eye: [0, P.camH, R * .12], target: [0, 0, -R]}; },
    layout(i, P, E){
      const R = carouselR(P, E), a = (i / E.n - E.p) * TAU, c = Math.cos(a), m = M(RY(-a), T(0, 0, -R));
      // facing the centre of the ring, curved to follow it
      return {m: M(T(m[12] * (P.ellipse - 1), P.rimWave * Math.sin(2 * a) + P.bob * Math.sin(TAU * (2 * E.p + i * .37)), 0), m), bend: -P.curve / R,
        s: 1 + P.pop * Math.max(0, c) ** 4, b: 1 - P.sideShade * (1 - c) * .5, blur: P.sideBlur * (1 - c) * .5};
    }},
  {id: 'orb-marquee', name: 'Orb Marquee', cat: 'carousel', n: 12, set: 'photos', aspect: 1, cardH: .46, dur: 16, frame: '5:4',
    desc: 'A row of round images gliding through stretching glass.',
    style: {...BG(WARM), card: {radius: .5}, ...LR({width: .1, refraction: .12, stretch: 2.6, bulge: .1, dispersion: .8, soften: .08, highlight: .12, curve: 'wave'})},
    params: [{group: 'Layout'}, P_GAP(.3), {key: 'arc', label: 'Arc', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'dish', label: 'Depth curve', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'sizeVar', label: 'Size rhythm', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'wave', label: 'Wave', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'roll', label: 'Roll', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Centre scale', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true},
      {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: FILL_X,
    layout(i, P, E){
      const r = rel(i, E.p * E.n, E.m), x = r * E.w * (1 + P.gap), e = clamp01(ab(x) / E.vx), g = Math.max(0, 1 - ab(x) / (E.w * (1 + P.gap) * 1.5));
      return {x, y: -P.arc * .15 * x * x + P.wave * E.h * .5 * Math.sin(r * TAU / 4), z: -P.dish * .15 * x * x, ry: Math.atan(.3 * P.dish * x), rz: Math.atan(-.3 * P.arc * x) - P.roll * x / (E.h * .5),
        s: (1 - P.sizeVar * E.rnd(i % E.n, 5)) * (1 + P.pop * g * g), o: wrapFade(r, E.m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e};
    }},
  {id: 'coverflow', name: 'Coverflow', cat: 'carousel', n: 11, set: 'photos', aspect: .8, step: true, cardH: 1.15, perCard: 1.5,
    desc: 'The classic album-wall flip, softened by glass at the sides.',
    style: {...BG(SOFT), ...LR({width: .22, refraction: .55})},
    params: [{group: 'Layout'}, {key: 'angle', label: 'Side angle', type: 'range', min: 0, max: 1.4, step: .01, def: .95}, P_GAP(.3),
      {key: 'sideOffset', label: 'Side offset', type: 'range', min: .3, max: 1.2, step: .01, def: .66}, {key: 'sideDepth', label: 'Side depth', type: 'range', min: 0, max: 2.5, step: .01, def: .9},
      {key: 'stackDepth', label: 'Stack depth', type: 'range', min: 0, max: .4, step: .01, def: .05}, {key: 'sideScale', label: 'Side scale', type: 'range', min: .6, max: 1.2, step: .01, def: 1, unit: '×'},
      {group: 'Motion'}, {key: 'lean', label: 'Lean in move', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'hop', label: 'Hop', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'sideBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => stripFill(E, E.vx, E.w * Math.max(.05, P.gap)),
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = rel(i, u, E.m), a = Math.min(1, ab(r)), b2 = Math.max(0, ab(r) - 1), tw = Math.sin(Math.PI * (u - Math.floor(u)));
      return {x: sgn(r) * (E.w * P.sideOffset * a + E.w * P.gap * b2), y: P.hop * tw * (1 - a) * E.h * .2, z: -a * P.sideDepth - b2 * P.stackDepth, ry: -sgn(r) * a * P.angle + P.lean * tw * .4,
        s: lerp(1, P.sideScale, a), o: wrapFade(r, E.m), b: 1 - P.sideShade * a, blur: P.sideBlur * a};
    }},
  {id: 'feed', name: 'Glass Feed', cat: 'carousel', n: 9, set: 'photos', aspect: .8, cardH: .95, dur: 18, frame: '9:16',
    desc: 'A vertical feed that melts into the top and bottom of the frame.',
    style: {...BG(WARM), ...GLASS({top: 1, bottom: 1}, {width: .22, refraction: .7, bulge: .3})},
    params: [{group: 'Layout'}, P_GAP(.08), {key: 'lieBack', label: 'Lay back', type: 'range', min: 0, max: 1.1, step: .01, def: 0, off: true},
      {key: 'drum', label: 'Drum curve', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'scatterZ', label: 'Depth scatter', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'snake', label: 'Snake', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Centre scale', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true},
      {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => stripFill(E, E.vy / Math.max(.3, Math.cos(P.lieBack)), E.h * (1 + P.gap)),
    layout(i, P, E){
      const r = rel(i, E.p * E.n, E.m), y = -r * E.h * (1 + P.gap), c = .15 * P.drum, e = clamp01(ab(y) / E.vy), g = Math.max(0, 1 - ab(y) / (E.h * (1 + P.gap) * 1.5));
      return {m: M(RX(-P.lieBack), T(P.snake * E.w * .4 * Math.sin(r * TAU / 4), y, -c * y * y - P.scatterZ * E.rnd(i % E.n, 6)), RX(Math.atan(-2 * c * y))),
        s: 1 + P.pop * g * g, o: wrapFade(r, E.m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e};
    }},
  {id: 'lens-slider', name: 'Liquid Lens', cat: 'glass', n: 14, set: 'photos', aspect: .8, cardH: .9, dur: 20,
    desc: 'A drop of real glass gliding over a row of images.',
    style: {...BG(SOFT), lens: {on: true, mode: 'glass', shape: 'pill', w: 1.05, h: .46, refraction: .55, dispersion: .6, bevel: .6, frost: 0, magnify: .02, highlight: .9, shadow: .45, motion: 'sweep', tintA: .03}},
    params: [{group: 'Layout'}, P_GAP(.1), {key: 'arc', label: 'Arc', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'edgeTurn', label: 'Edge turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'sizeVar', label: 'Size rhythm', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'wave', label: 'Wave', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'breathe', label: 'Breathe', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Centre scale', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true},
      {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: FILL_X,
    layout(i, P, E){
      const r = rel(i, E.p * E.n, E.m), x = r * E.w * (1 + P.gap), k = i % E.n, e = clamp01(ab(x) / E.vx), g = Math.max(0, 1 - ab(x) / (E.w * (1 + P.gap) * 1.5));
      return {x, y: -P.arc * .15 * x * x + P.wave * E.h * .4 * Math.sin(r * TAU / 4), rz: Math.atan(-.3 * P.arc * x), ry: -P.edgeTurn * .8 * Math.max(-1, Math.min(1, x / E.asp)),
        s: (1 - P.sizeVar * E.rnd(k, 5)) * (1 + P.pop * g * g) * (1 + P.breathe * .12 * Math.sin(TAU * (2 * E.p + k * .37))), o: wrapFade(r, E.m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e};
    }},

  /* ===================== Ring & Orbit ===================== */
  {id: 'spiral', name: 'Spiral Collection', cat: 'ring', n: 28, set: 'photos', aspect: 1.6, cardH: .27, dur: 24, fov: 36,
    desc: 'A twisting ring of curled cards.',
    style: {...BG('#d9d9db'), ...GLASS({top: 1, bottom: 1}, {width: .2, refraction: .55, bulge: .25})},
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'twist', label: 'Twists', type: 'range', min: 0, max: 3, step: .5, def: 1.5}, P_CURVE(1.6),
      {key: 'ellipse', label: 'Ellipse', type: 'range', min: .4, max: 1.6, step: .01, def: 1, unit: '×'}, {key: 'lean', label: 'Ring lean', type: 'range', min: -.8, max: 1.2, step: .01, def: .32},
      {group: 'Motion'}, {key: 'tumble', label: 'Tumble', type: 'range', min: 0, max: 3, step: .01, def: 1, unit: '×'},
      {key: 'curlRate', label: 'Curl speed', type: 'range', min: 0, max: 4, step: 1, def: 2, unit: '×', hint: 'whole cycles per loop, so it stays seamless'},
      {key: 'ringTurns', label: 'Ring turns', type: 'range', min: 0, max: 3, step: 1, def: 1, unit: ' turns'},
      {group: 'Look'}, {key: 'backShade', label: 'Back shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'edgeFade', label: 'Edge-on fade', type: 'range', min: 0, max: .9, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const R = .9 * P.radius, ph = E.p * TAU, a = (i / E.n) * TAU + ph * Math.round(P.ringTurns);
      // each card pitches around its own radius, so the ring twists: some face you, some turn edge-on
      const pitch = (i / E.n) * TAU * P.twist + ph * Math.round(P.curlRate);
      const m = M(RX(P.lean + Math.sin(ph) * .12 * P.tumble), RY(Math.cos(ph) * .3 * P.tumble), T(R * Math.cos(a), R * P.ellipse * Math.sin(a), 0), RZ(a), RX(pitch));
      return {m, bend: P.curve * 1.4, b: 1 - P.backShade * clamp01(.5 - m[14] / (2 * R)), o: 1 - P.edgeFade * (1 - ab(m[10]))};
    }},
  {id: 'cylinder', name: 'Cylinder', cat: 'ring', n: 14, set: 'photos', aspect: .72, cardH: 1, dur: 26,
    desc: 'A turning wall of curved panels.',
    style: {...BG(SOFT), ...LR({width: .24, refraction: .6})},
    params: [{group: 'Layout'}, P_RADIUS(1), P_GAP(.05), {key: 'ellipse', label: 'Ellipse', type: 'range', min: .6, max: 1.6, step: .01, def: 1, unit: '×'},
      {key: 'facing', label: 'Card facing', type: 'seg', options: {out: 'Outward', cam: 'Camera'}, def: 'out'}, P_TILT(.06),
      {group: 'Motion'}, {key: 'rimWave', label: 'Rim wave', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'surge', label: 'Surge', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Front scale', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}, {key: 'backShade', label: 'Back shade', type: 'range', min: 0, max: .9, step: .01, def: .45},
      {key: 'backFade', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    camera: (P, E) => { const R = ringR(P, E); return {eye: [0, R * P.tilt * 2, R + E.D * 1.05]}; },
    layout(i, P, E){
      const R = ringR(P, E), a = i / E.n * TAU - E.p * TAU + P.surge * .6 * Math.sin(E.p * TAU), c = Math.cos(a), cam = P.facing === 'cam';
      return {x: R * Math.sin(a) * P.ellipse, y: P.rimWave * E.h * .25 * Math.sin(2 * a), z: R * c, ry: cam ? 0 : a, bend: cam ? 0 : 1 / R,
        s: 1 + P.pop * Math.max(0, c) ** 4, b: 1 - P.backShade + P.backShade * Math.max(0, c), o: 1 - P.backFade * Math.max(0, -c)};
    }},
  {id: 'orbit', name: 'Orbit', cat: 'ring', n: 8, set: 'photos', aspect: .8, cardH: .85, dur: 20,
    desc: 'Images orbit in depth with a soft focus pull.',
    style: {...BG(WARM), blur: {on: true, depth: .22}},
    params: [{group: 'Layout'}, {key: 'rx', label: 'Width', type: 'range', min: .5, max: 3, step: .01, def: 1.9}, {key: 'rz', label: 'Depth', type: 'range', min: .3, max: 3, step: .01, def: 1.5}, P_TILT(.16),
      {key: 'incline', label: 'Incline', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'facing', label: 'Card facing', type: 'seg', options: {cam: 'Camera', out: 'Outward'}, def: 'cam'},
      {group: 'Motion'}, {key: 'bob', label: 'Bob', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'surge', label: 'Front rush', type: 'range', min: -.6, max: .6, step: .01, def: 0},
      {group: 'Look'}, {key: 'pop', label: 'Front scale', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}, {key: 'backShade', label: 'Back shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true},
      {key: 'backFade', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    camera: (P, E) => ({eye: [0, P.tilt * 3, E.D + .6]}),
    layout(i, P, E){
      const a0 = i / E.n * TAU + E.p * TAU, a = a0 + P.surge * Math.sin(a0), c = Math.cos(a);
      return {x: P.rx * Math.sin(a), y: P.incline * P.rz * .4 * c + P.bob * .25 * Math.sin(3 * a), z: P.rz * c - .4, ry: P.facing === 'out' ? a : 0,
        s: 1 + P.pop * Math.max(0, c) ** 3, b: 1 - P.backShade * (1 - c) * .5, o: 1 - P.backFade * Math.max(0, -c)};
    }},

  /* ===================== Stack & Grid ===================== */
  {id: 'stack-shuffle', name: 'Stack Shuffle', cat: 'stack', n: 7, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.25, perCard: 1.4,
    desc: 'The top card slides out and tucks in behind the deck.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'deckDepth', label: 'Deck depth', type: 'range', min: .05, max: .6, step: .01, def: .22}, {key: 'shrink', label: 'Shrink', type: 'range', min: 0, max: .12, step: .005, def: .05},
      {key: 'fanAngle', label: 'Fan', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'scatter', label: 'Scatter', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'throwX', label: 'Throw distance', type: 'range', min: .5, max: 2, step: .01, def: 1.05}, {key: 'throwSpin', label: 'Throw turn', type: 'range', min: -.6, max: .6, step: .01, def: .12},
      {key: 'throwLift', label: 'Throw lift', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'deckShade', label: 'Deck shade', type: 'range', min: 0, max: .2, step: .005, def: .1}, {key: 'deckBlur', label: 'Deck blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), r = wrap(i - u, n), j1 = (E.rnd(i, 3) - .5) * P.scatter, j2 = (E.rnd(i, 4) - .5) * P.scatter;
      const slot = rr => ({x: rr * E.w * .07 * P.spread + j1 * E.w * .15, y: rr * E.h * .04 * P.spread + j2 * E.h * .1, z: -rr * P.deckDepth, s: 1 - rr * P.shrink, b: 1 - rr * P.deckShade,
        rz: rr * P.fanAngle * .06 + j2 * .25, blur: rr * P.deckBlur * .15});
      if (r > n - 1){ const q = n - r, s0 = slot(0), s1 = slot(n - 1), w = Math.sin(q * Math.PI);
        return {x: lerp(s0.x, s1.x, q) + w * E.w * P.throwX, y: lerp(s0.y, s1.y, q) + w * E.h * .5 * P.throwLift, z: lerp(s0.z, s1.z, q), s: lerp(s0.s, s1.s, q), rz: lerp(s0.rz, s1.rz, q) + w * P.throwSpin,
          b: lerp(1, s1.b, q), blur: lerp(s0.blur, s1.blur, q), zBias: q < .5 ? 2 : 0, o: lerp(1, clamp01(5.5 - (n - 1)), sstep(.5, 1, q))}; }
      return {...slot(r), o: clamp01(5.5 - r)};
    }},
  {id: 'fan', name: 'Fan', cat: 'stack', n: 7, set: 'photos', aspect: .72, cardH: 1.05, dur: 7,
    desc: 'A hand of cards that opens and closes.',
    style: BG(WARM),
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'pivot', label: 'Pivot', type: 'range', min: .5, max: 4, step: .01, def: 1.9}, {key: 'fanLean', label: 'Lean', type: 'range', min: -.8, max: .8, step: .01, def: 0},
      {key: 'layering', label: 'Layer depth', type: 'range', min: 0, max: .15, step: .001, def: .012},
      {group: 'Motion'}, {key: 'minOpen', label: 'Closed spread', type: 'range', min: 0, max: 1, step: .01, def: .2, percent: true},
      {key: 'beats', label: 'Beats', type: 'range', min: 1, max: 4, step: 1, def: 1, unit: '×', hint: 'whole cycles per loop, so it stays seamless'},
      {key: 'cascade', label: 'Cascade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'cardTurn', label: 'Card turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'outerShade', label: 'Outer shade', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}, {key: 'outerBlur', label: 'Outer blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const c = (E.n - 1) / 2, d = i - c, e = c ? ab(d) / c : 0, open = .5 - .5 * Math.cos(TAU * (Math.round(P.beats) * E.p - P.cascade * .5 * i / E.n));
      const a = d * .24 * P.spread * (P.minOpen + (1 - P.minOpen) * open) + P.fanLean, R = P.pivot;
      return {x: Math.sin(a) * R, y: Math.cos(a) * R - R - .1, rz: -a, ry: d * P.cardTurn * .15 * open, z: i * P.layering, b: 1 - P.outerShade * e, blur: P.outerBlur * e};
    }},
  {id: 'masonry', name: 'Masonry', cat: 'stack', n: 18, set: 'photos', aspect: .8, cardH: .62, dur: 26, frame: '4:5',
    desc: 'Columns drift in opposite directions and melt into the top and bottom.',
    style: {...BG(SOFT), ...GLASS({top: 1, bottom: 1}, {width: .2, refraction: .65, bulge: .3})},
    params: [{group: 'Layout'}, P_COLS(3, 5), P_GAP(.07), {key: 'colSpace', label: 'Column spacing', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true},
      {key: 'colOffset', label: 'Column offset', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'barrel', label: 'Barrel', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'colDepth', label: 'Column depth', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'flow', label: 'Flow', type: 'seg', options: {alt: 'Alternate', same: 'Same way'}, def: 'alt'},
      {key: 'oddSpeed', label: 'Fast columns', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×', hint: 'whole cycles per loop, so it stays seamless'},
      {group: 'Look'}, {key: 'edgeFade', label: 'Edge fade', type: 'range', min: .2, max: 3, step: .01, def: .8}, {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, E.vy * (1 + P.colDepth / E.D), E.w * 1.12 * (1 + P.gap), Math.round(P.cols)),
    layout(i, P, E){
      const cols = Math.round(P.cols), m = E.m, mb = E.mb, col = i % cols, row = Math.floor(i / cols), odd = col % 2;
      const asp = [.8, 1.25, .7, 1][(row % mb + col) % 4], h = E.w / asp;
      let cum = 0, total0 = 0;
      for (let k = 0; k < mb; k++){ const hh = E.w / [.8, 1.25, .7, 1][(k + col) % 4] * (1 + P.gap); if (k < row % mb) cum += hh; total0 += hh; }
      const total = total0 * m / mb; cum += Math.floor(row / mb) * total0;
      const dir = (odd && P.flow !== 'same' ? -1 : 1) * (odd ? Math.round(P.oddSpeed) : 1), y = wrap(cum + h / 2 + E.p * total0 * dir + col * P.colOffset * E.w * 1.2, total) - total / 2;
      const x = (col - (cols - 1) / 2) * E.w * (1 + P.gap * 1.5 + P.colSpace), e = clamp01(ab(y) / E.vy);
      return {x, y, z: -P.barrel * .25 * x * x - (odd ? P.colDepth : 0), ry: Math.atan(.5 * P.barrel * x), w: E.w, h, aspect: asp,
        o: clamp01((total / 2 - ab(y)) / (h * P.edgeFade)), blur: P.edgeBlur * e * e, img: (row % mb) * cols + col};
    }},
  {id: 'tilt-grid', name: 'Tilt Grid', cat: 'stack', n: 30, set: 'photos', aspect: .8, cardH: .6, dur: 24,
    desc: 'An endless tilted wall of images, edged in glass.',
    style: {...BG(SOFT), ...GLASS({top: .7, bottom: 1, left: .8, right: .8}, {width: .18, refraction: .55, bulge: .2})},
    params: [{group: 'Layout'}, P_COLS(6, 8), P_TILT(.85, 'Tilt'), P_GAP(.12), {key: 'gridTurn', label: 'Rotation', type: 'range', min: -.6, max: .6, step: .01, def: .18},
      {key: 'brick', label: 'Row offset', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'faceCam', label: 'Face camera', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'flow', label: 'Columns', type: 'seg', options: {same: 'Together', alt: 'Alternate'}, def: 'same'},
      {key: 'centreLift', label: 'Lift at centre', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'farShade', label: 'Far shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'farBlur', label: 'Far blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, E.vy / Math.max(.25, Math.cos(P.tilt)) + E.vx * Math.max(.2, ab(Math.sin(P.gridTurn))), E.h * (1 + P.gap), Math.round(P.cols)),
    layout(i, P, E){
      const cols = Math.round(P.cols), rows = E.m, c = i % cols, r = Math.floor(i / cols), dir = P.flow === 'alt' && c % 2 ? -1 : 1;
      const gx = E.w * (1 + P.gap), gy = E.h * (1 + P.gap), ur = wrap(r + E.p * E.mb * dir, rows);
      const x = (c - (cols - 1) / 2) * gx + (r % 2) * P.brick * gx * .5, y = (ur - (rows - 1) / 2) * gy, f = clamp01(.5 + y / (E.vy * 3));
      const lift = P.centreLift * .5 * Math.max(0, 1 - Math.hypot(x, y) / (gx * 2.5));
      return {m: M(RX(-P.tilt), RZ(P.gridTurn), T(x, y, lift), RX(P.faceCam * P.tilt)), o: clamp01(ur * 1.2) * clamp01((rows - ur) * 1.2 - .2), b: 1 - P.farShade * f, blur: P.farBlur * f * f, img: (r % E.mb) * cols + c};
    }},

  /* ===================== more transitions ===================== */
  {id: 'slide-push', name: 'Slide Push', cat: 'transitions', n: 8, set: 'photos', aspect: .8, step: true, cardH: 1.3, perCard: 1.6,
    desc: 'Each image pushes the last one off the frame, with a motion blur.',
    style: {...BG(WARM), ...LR({width: .18, refraction: .6})},
    params: [{group: 'Layout'}, P_GAP(.08), {key: 'shrink', label: 'Side shrink', type: 'range', min: 0, max: .4, step: .01, def: .1},
      {key: 'sideZ', label: 'Side depth', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true}, {key: 'sideTurn', label: 'Side turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'pushTilt', label: 'Push tilt', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'stretch', label: 'Stretch', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'hop', label: 'Hop', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'sideBlur', label: 'Motion blur', type: 'range', min: 0, max: 1, step: .01, def: .6}, {key: 'restBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}],
    fill: FILL_X,
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = rel(i, u, E.m), v = stepSpeed(E.p, E.n, E.hold, E.ez), k = Math.min(1, ab(r)), tw = Math.sin(Math.PI * (u - Math.floor(u)));
      const L = {x: r * E.w * (1 + P.gap), y: P.hop * tw * E.h * .15, z: -P.sideZ * k, ry: -sgn(r) * P.sideTurn * k, rz: P.pushTilt * tw * .15, s: 1 - P.shrink * k, o: wrapFade(r, E.m),
        blur: Math.min(1, v * .08) * P.sideBlur + P.restBlur * k, b: 1 - P.sideShade * k};
      if (P.stretch){ L.w = E.w * (1 + P.stretch * tw * .3); L.h = E.h * (1 - P.stretch * tw * .08); }
      return L;
    }},
  {id: 'cube-turn', name: 'Cube Turn', cat: 'transitions', n: 4, fixedN: true, set: 'photos', frame: '5:4', aspect: 1, step: true, cardH: 1.15, perCard: 1.8,
    desc: 'Images on the faces of a cube that turns a quarter at a time.',
    style: BG('#101012', 'radial', {c: ['#0b0b0d', '#24262d', '#000000', '#000000']}),
    params: [{group: 'Layout'}, {key: 'axis', label: 'Turn axis', type: 'seg', options: {y: 'Sideways', x: 'Vertical'}, def: 'y'}, {key: 'pivot', label: 'Pivot depth', type: 'range', min: .5, max: 2, step: .01, def: 1, unit: '×'},
      {key: 'camH', label: 'Camera height', type: 'range', min: -1.5, max: 1.5, step: .01, def: .55}, {key: 'camDist', label: 'Camera distance', type: 'range', min: .7, max: 2, step: .01, def: 1.05, unit: '×'},
      {group: 'Motion'}, {key: 'push', label: 'Push back', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true}, {key: 'tumble', label: 'Tumble', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: .9, step: .01, def: .45}, {key: 'sideBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    camera: (P, E) => ({eye: [0, P.camH, E.D * P.camDist]}),
    layout(i, P, E){
      const u = stepU(E.p, 4, E.hold, E.ez), a = (i - u) * TAU / 4, vx = P.axis === 'x', hw = (vx ? E.h : E.w) / 2 * P.pivot, c = Math.cos(a), tw = Math.sin(Math.PI * (u - Math.floor(u)));
      return {m: M(T(0, 0, -hw - P.push * tw * .6), vx ? RY(P.tumble * tw * .4) : RX(P.tumble * tw * .4), vx ? RX(-a) : RY(a), T(0, 0, hw)), o: c > -.05 ? 1 : 0,
        b: 1 - P.sideShade + P.sideShade * Math.max(0, c), blur: P.sideBlur * (1 - c) * .5};
    }},
  {id: 'fold-flip', name: 'Card Flip', cat: 'transitions', n: 6, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.35, perCard: 1.5,
    desc: 'Each card flips over to reveal the next image.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, {key: 'axis', label: 'Axis', type: 'seg', options: {y: 'Vertical', x: 'Horizontal'}, def: 'y'}, {key: 'axisAngle', label: 'Axis angle', type: 'range', min: -.8, max: .8, step: .01, def: 0},
      {key: 'lift', label: 'Lift', type: 'range', min: 0, max: 1.5, step: .01, def: .45},
      {group: 'Motion'}, {key: 'extraSpins', label: 'Extra spins', type: 'range', min: 0, max: 2, step: 1, def: 0, unit: ' turns'}, {key: 'sway', label: 'Sway', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'toss', label: 'Toss', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'shrink', label: 'Shrink in flip', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'turnShade', label: 'Turn shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'turnBlur', label: 'Turn blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), k = Math.floor(u), t = u - k, cur = wrap(k, E.n), nxt = wrap(k + 1, E.n), sp = 1 + 2 * Math.round(P.extraSpins);
      let ang = 0, o = 0;
      if (i === cur){ ang = t * Math.PI * sp; o = t < .5 ? 1 : 0; } else if (i === nxt){ ang = t * Math.PI * sp - Math.PI; o = t >= .5 ? 1 : 0; }
      const w = Math.sin(t * Math.PI);
      return {m: M(T(P.sway * w * E.w * .4, P.toss * w * E.h * .3, w * P.lift), RZ(P.axisAngle), P.axis === 'x' ? RX(-ang) : RY(ang), RZ(-P.axisAngle)), o,
        s: 1 - P.shrink * w * .35, b: 1 - P.turnShade * ab(Math.sin(ang)) * .6, blur: P.turnBlur * w};
    }},
  {id: 'rise-up', name: 'Rise Up', cat: 'transitions', n: 6, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.3, perCard: 1.5,
    desc: 'The next image rises from below as the current one drifts back.',
    style: {...BG(WARM), blur: {on: true, depth: .2}},
    params: [{group: 'Layout'}, {key: 'from', label: 'Enter from', type: 'seg', options: {below: 'Below', above: 'Above', left: 'Left', right: 'Right'}, def: 'below'},
      {key: 'entryDist', label: 'Entry distance', type: 'range', min: 1, max: 4, step: .01, def: 2.4}, {key: 'entryTilt', label: 'Entry tilt', type: 'range', min: -1, max: 1.6, step: .01, def: .9},
      {key: 'exitDepth', label: 'Exit depth', type: 'range', min: 0, max: 3, step: .01, def: 1.1},
      {group: 'Motion'}, {key: 'exitDrift', label: 'Exit drift', type: 'range', min: -1, max: 1.5, step: .01, def: .6}, {key: 'exitTilt', label: 'Exit tilt', type: 'range', min: -1, max: 1, step: .01, def: .25},
      {key: 'entryShrink', label: 'Entry shrink', type: 'range', min: 0, max: .5, step: .01, def: .1},
      {group: 'Look'}, {key: 'entryBlur', label: 'Entry blur', type: 'range', min: 0, max: 1, step: .01, def: .5}, {key: 'exitBlur', label: 'Exit blur', type: 'range', min: 0, max: 1, step: .01, def: .6},
      {key: 'exitDim', label: 'Exit shade', type: 'range', min: 0, max: .9, step: .01, def: .3}],
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = wrap(i - u + 1, E.n) - 1, d = {above: [0, 1], left: [-1, 0], right: [1, 0]}[P.from] || [0, -1], dx = d[0], dy = d[1];
      if (r > 0) return {x: dx * r * P.entryDist, y: dy * r * P.entryDist, rx: -dy * r * P.entryTilt, ry: dx * r * P.entryTilt, z: -r * .4, s: 1 - P.entryShrink * r, o: r < 1 ? 1 : 0, blur: r * P.entryBlur};
      return {x: dx * r * P.exitDrift, y: dy * r * P.exitDrift, z: r * P.exitDepth, rx: -dy * r * P.exitTilt, ry: dx * r * P.exitTilt, o: clamp01(1 + r * 1.3), blur: -r * P.exitBlur, b: 1 + r * P.exitDim};
    }},
  {id: 'swap', name: 'Swap', cat: 'transitions', n: 5, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.25, perCard: 1.4,
    desc: 'The front card swings out to the side and slides to the back.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'deckDepth', label: 'Deck depth', type: 'range', min: .05, max: .6, step: .01, def: .22}, {key: 'shrink', label: 'Shrink', type: 'range', min: 0, max: .12, step: .005, def: .05},
      {key: 'fanAngle', label: 'Fan', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'swingX', label: 'Swing distance', type: 'range', min: .4, max: 2, step: .01, def: .95}, {key: 'swingTurn', label: 'Swing roll', type: 'range', min: -.6, max: .6, step: .01, def: .18},
      {key: 'swingYaw', label: 'Swing turn', type: 'range', min: -1.2, max: 1.2, step: .01, def: 0}, {key: 'swingLift', label: 'Swing lift', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'deckShade', label: 'Deck shade', type: 'range', min: 0, max: .2, step: .005, def: .1}, {key: 'deckBlur', label: 'Deck blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), r = wrap(i - u, n);
      const slot = rr => ({x: rr * E.w * .09 * P.spread, y: rr * E.h * .035 * P.spread, z: -rr * P.deckDepth, s: 1 - rr * P.shrink, b: 1 - rr * P.deckShade, rz: rr * P.fanAngle * .06, blur: rr * P.deckBlur * .15});
      if (r > n - 1){ const q = n - r, s0 = slot(0), s1 = slot(n - 1), w = Math.sin(q * Math.PI);
        return {x: lerp(s0.x, s1.x, q) - w * E.w * P.swingX, y: lerp(s0.y, s1.y, q) + w * E.h * .5 * P.swingLift, z: lerp(s0.z, s1.z, q), s: lerp(s0.s, s1.s, q), rz: lerp(s0.rz, s1.rz, q) - w * P.swingTurn,
          ry: w * P.swingYaw, b: lerp(1, s1.b, q), blur: lerp(s0.blur, s1.blur, q), zBias: q < .5 ? 2 : 0}; }
      return {...slot(r), o: r < 4.5 ? 1 : clamp01(5.5 - r)};
    }},
  {id: 'zoom-blur', name: 'Zoom Blur', cat: 'transitions', n: 7, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.2, perCard: 1.5,
    desc: 'The current image rushes toward you and dissolves into the next.',
    style: BG('#0d0d0f', 'radial', {c: ['#0c0c0e', '#22242b', '#000000', '#000000']}),
    params: [{group: 'Layout'}, {key: 'exitZoom', label: 'Exit zoom', type: 'range', min: 0, max: 3, step: .01, def: .7}, {key: 'entryZoom', label: 'Entry zoom', type: 'range', min: -.5, max: .6, step: .01, def: .3},
      {group: 'Motion'}, {key: 'exitTwist', label: 'Exit twist', type: 'range', min: -1.5, max: 1.5, step: .01, def: 0}, {key: 'entryTwist', label: 'Entry twist', type: 'range', min: -1.5, max: 1.5, step: .01, def: 0},
      {key: 'exitPush', label: 'Exit push', type: 'range', min: 0, max: 2, step: .01, def: 0, off: true}, {key: 'exitFade', label: 'Exit fade', type: 'range', min: .6, max: 3, step: .01, def: 1.4},
      {key: 'entryFade', label: 'Entry fade', type: 'range', min: .6, max: 3, step: .01, def: 1.2},
      {group: 'Look'}, {key: 'exitBlur', label: 'Exit blur', type: 'range', min: 0, max: 3, step: .01, def: 1.2}, {key: 'entryBlur', label: 'Entry blur', type: 'range', min: 0, max: 2, step: .01, def: 1}],
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = wrap(i - u + 1, E.n) - 1;
      if (r <= 0) return {s: 1 - r * P.exitZoom, z: -r * P.exitPush, rz: -r * P.exitTwist, o: clamp01(1 + r * P.exitFade), blur: clamp01(-r * P.exitBlur), zBias: 1};
      return {s: 1 - r * P.entryZoom, rz: r * P.entryTwist, o: clamp01(1 - r * P.entryFade), blur: clamp01(r * P.entryBlur)};
    }},

  /* ===================== more carousels ===================== */
  {id: 'slider', name: 'Slider', cat: 'carousel', n: 9, set: 'photos', aspect: .8, step: true, cardH: 1.15, perCard: 1.3,
    desc: 'A classic stepped slider with smaller, softer neighbours.',
    style: {...BG(WARM), ...LR({width: .16, refraction: .5})},
    params: [{group: 'Layout'}, P_GAP(.1), {key: 'sideScale', label: 'Side scale', type: 'range', min: .5, max: 1, step: .01, def: .82},
      {key: 'sideZ', label: 'Side depth', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true}, {key: 'sideTurn', label: 'Side rotation', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'lift', label: 'Active lift', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'slideArc', label: 'Slide arc', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'sideRoll', label: 'Side roll', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'pop', label: 'Active scale', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}, {key: 'sideBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: .25}, {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: .8, step: .01, def: .15}],
    fill: (P, E) => stripFill(E, E.vx, E.w * (1 + P.gap) * (1 - (1 - P.sideScale) * .5)),
    layout(i, P, E){
      const u = stepU(E.p, E.n, E.hold, E.ez), r = rel(i, u, E.m), k = Math.min(1, ab(r)), ac = Math.min(ab(r), 3);
      return {x: r * E.w * (1 + P.gap) * (1 - (1 - P.sideScale) * .5), y: P.lift * E.h * .12 * (1 - k) - P.slideArc * E.h * .12 * ac * ac, z: -P.sideZ * k, ry: -sgn(r) * P.sideTurn * k,
        rz: -sgn(r) * P.sideRoll * .15 * k + Math.atan(-P.slideArc * .25 * Math.max(-3, Math.min(3, r))), s: lerp(1, P.sideScale, k) * (1 + P.pop * (1 - k)), o: wrapFade(r, E.m), blur: k * P.sideBlur, b: 1 - P.sideShade * k};
    }},
  {id: 'arc-wheel', name: 'Arc Wheel', cat: 'carousel', n: 14, set: 'photos', aspect: .8, cardH: .78, dur: 22,
    desc: 'Images roll along the rim of a giant wheel.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, P_RADIUS(1.2), P_GAP(.14), {key: 'visArc', label: 'Visible arc', type: 'range', min: .3, max: 1.9, step: .01, def: 1.9},
      {key: 'rimY', label: 'Wheel height', type: 'range', min: -1, max: 1.5, step: .01, def: .35}, {key: 'upright', label: 'Stay upright', type: 'range', min: 0, max: 1, step: .01, def: 0, percent: true},
      {key: 'tiltBack', label: 'Tilt back', type: 'range', min: 0, max: 1.2, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'bob', label: 'Bob', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'crest', label: 'Crest scale', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'sideShade', label: 'Side shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'sideBlur', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const R = 3.2 * P.radius, step = E.w * (1 + P.gap) / R, r = rel(i, E.p * E.n, E.n), a = r * step, f = Math.min(1, ab(a) / 1.2);
      const y = R * Math.cos(a) - R + P.rimY + P.bob * E.h * .12 * Math.sin(TAU * (2 * E.p + i * .37));
      return {m: M(RX(-P.tiltBack), T(R * Math.sin(a), y, 0), RZ(-a * (1 - P.upright))), s: 1 + P.crest * Math.max(0, 1 - ab(a) / step),
        o: clamp01((P.visArc - ab(a)) * 3) * wrapFade(r, E.n), b: 1 - P.sideShade * f, blur: P.sideBlur * f};
    }},
  {id: 'sidestack', name: 'Sidestack', cat: 'carousel', n: 7, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.2, perCard: 1.4,
    desc: 'A deck fanned in depth; the front card slides away to the left.',
    style: BG(WARM),
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'deckAngle', label: 'Deck angle', type: 'range', min: -1, max: 1.4, step: .01, def: .55}, {key: 'deckDepth', label: 'Deck depth', type: 'range', min: .1, max: 1, step: .01, def: .45},
      {key: 'deckX', label: 'Deck offset', type: 'range', min: -.5, max: 1.2, step: .01, def: .5}, {key: 'deckRise', label: 'Deck rise', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'exitDist', label: 'Exit distance', type: 'range', min: .5, max: 2.5, step: .01, def: 1.1}, {key: 'exitTurn', label: 'Exit turn', type: 'range', min: -1, max: 1.5, step: .01, def: .4},
      {key: 'exitNear', label: 'Exit toward camera', type: 'range', min: 0, max: 1.5, step: .01, def: .6},
      {group: 'Look'}, {key: 'deckShade', label: 'Deck shade', type: 'range', min: 0, max: .2, step: .005, def: .1}, {key: 'deckBlur', label: 'Deck blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), r = wrap(i - u, n);
      if (r > n - 1){ const q = n - r; return {x: -E.w * P.deckX - q * E.w * P.exitDist, z: q * P.exitNear, ry: -P.deckAngle - q * P.exitTurn, o: 1 - q, zBias: 3}; }
      const o = r > n - 2 ? clamp01((n - 1 - r) * 2) : 1;
      return {x: -E.w * P.deckX + r * E.w * .34 * P.spread, y: r * E.h * .1 * P.deckRise, z: -r * P.deckDepth, ry: -P.deckAngle, o: o * clamp01(5.5 - r), b: 1 - r * P.deckShade, blur: r * P.deckBlur * .15};
    }},
  {id: 'elevator', name: 'Elevator', cat: 'carousel', n: 18, set: 'photos', aspect: .8, cardH: .82, dur: 24,
    desc: 'Slanted columns ride up and down past each other.',
    style: BG('#111214', 'solid', {c: ['#101113', '#1d1f24', '#ffffff', '#ffffff']}),
    params: [{group: 'Layout'}, P_COLS(3), P_GAP(.1), {key: 'slant', label: 'Slant', type: 'range', min: -.6, max: .6, step: .01, def: -.14},
      {key: 'colSpace', label: 'Column spacing', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'colOffset', label: 'Column offset', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'colDepth', label: 'Column depth', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'flow', label: 'Flow', type: 'seg', options: {alt: 'Alternate', same: 'Same way'}, def: 'alt'},
      {key: 'oddSpeed', label: 'Fast columns', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×', hint: 'whole cycles per loop, so it stays seamless'},
      {group: 'Look'}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, (E.vy + E.vx * ab(Math.sin(P.slant))) * (1 + P.colDepth / E.D), E.h * (1 + P.gap), Math.max(1, Math.round(P.cols))),
    layout(i, P, E){
      const cols = Math.max(1, Math.round(P.cols)), m = E.m, col = i % cols, row = Math.floor(i / cols), odd = col % 2;
      const dir = (odd && P.flow !== 'same' ? -1 : 1) * (odd ? Math.round(P.oddSpeed) : 1), r = rel(row, E.p * E.mb * dir, m);
      const x = (col - (cols - 1) / 2) * E.w * (1 + P.gap + P.colSpace), y = (r + odd * P.colOffset) * E.h * (1 + P.gap), c = Math.cos(P.slant), s = Math.sin(P.slant), e = clamp01(ab(y) / E.vy);
      return {x: x * c - y * s, y: x * s + y * c, z: odd ? -P.colDepth : 0, rz: P.slant, o: wrapFade(r, m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e, img: (row % E.mb) * cols + col};
    }},
  {id: 'repeater', name: 'Image Repeater', cat: 'carousel', n: 24, set: 'photos', aspect: .8, cardH: .55, dur: 26,
    desc: 'Rows of images scroll in alternating directions.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, {key: 'rows', label: 'Rows', type: 'range', min: 1, max: 5, step: 1, def: 3}, P_GAP(.12), {key: 'rowSpace', label: 'Row spacing', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'rowOffset', label: 'Row offset', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'rowDepth', label: 'Row depth', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true},
      {key: 'slant', label: 'Slant', type: 'range', min: -.5, max: .5, step: .01, def: 0},
      {group: 'Motion'}, {key: 'flow', label: 'Flow', type: 'seg', options: {alt: 'Alternate', same: 'Same way'}, def: 'alt'},
      {key: 'altSpeed', label: 'Fast rows', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×', hint: 'whole cycles per loop, so it stays seamless'},
      {group: 'Look'}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, (E.vx + E.vy * ab(Math.sin(P.slant))) * (1 + P.rowDepth * 2 / E.D), E.w * (1 + P.gap), Math.max(1, Math.round(P.rows))),
    layout(i, P, E){
      const rows = Math.max(1, Math.round(P.rows)), m = E.m, row = i % rows, col = Math.floor(i / rows), odd = row % 2, mid = (rows - 1) / 2;
      const r = rel(col, E.p * E.mb * (odd && P.flow !== 'same' ? -1 : 1) * (odd ? Math.round(P.altSpeed) : 1), m);
      const x = (r + odd * P.rowOffset) * E.w * (1 + P.gap), y = (row - mid) * E.h * (1 + P.gap * 1.2 + P.rowSpace), c = Math.cos(P.slant), s = Math.sin(P.slant), e = clamp01(ab(x) / E.vx);
      return {x: x * c - y * s, y: x * s + y * c, z: -P.rowDepth * ab(row - mid), rz: P.slant, o: wrapFade(r, m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e, img: (col % E.mb) * rows + row};
    }},
  {id: 'melt-row', name: 'Melt Row', cat: 'carousel', n: 12, set: 'photos', aspect: .8, cardH: 1, dur: 22,
    desc: 'One row of images melting into deep glass at both sides.',
    style: {...BG(SOFT), ...LR({width: .34, refraction: 1, bulge: .6, dispersion: .9})},
    params: [{group: 'Layout'}, P_GAP(.1), {key: 'dish', label: 'Curve away', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'arc', label: 'Arc', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'sizeVar', label: 'Size rhythm', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'wave', label: 'Wave', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'bob', label: 'Bob', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Centre scale', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true},
      {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: FILL_X,
    layout(i, P, E){
      const r = rel(i, E.p * E.n, E.m), x = r * E.w * (1 + P.gap), k = i % E.n, e = clamp01(ab(x) / E.vx), g = Math.max(0, 1 - ab(x) / (E.w * (1 + P.gap) * 1.5));
      return {x, y: -P.arc * .15 * x * x + P.wave * E.h * .4 * Math.sin(r * TAU / 4) + P.bob * E.h * .1 * Math.sin(TAU * (2 * E.p + k * .37)), z: -P.dish * .15 * x * x,
        ry: Math.atan(.3 * P.dish * x), rz: Math.atan(-.3 * P.arc * x), s: (1 - P.sizeVar * E.rnd(k, 5)) * (1 + P.pop * g * g), o: wrapFade(r, E.m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e};
    }},
  {id: 'glass-stream', name: 'Glass Stream', cat: 'carousel', n: 15, set: 'photos', aspect: .8, cardH: .62, dur: 24, frame: '9:16',
    desc: 'Three columns stream in opposite directions through glass at the top and bottom.',
    style: {...BG(WARM), ...GLASS({top: 1, bottom: 1}, {width: .2, refraction: .75, bulge: .35})},
    params: [{group: 'Layout'}, P_COLS(3, 4), P_GAP(.08), {key: 'colSpace', label: 'Column spacing', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'colOffset', label: 'Column offset', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'colTurn', label: 'Column turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'flow', label: 'Flow', type: 'seg', options: {alt: 'Alternate', same: 'Same way'}, def: 'alt'},
      {key: 'oddSpeed', label: 'Fast columns', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×', hint: 'whole cycles per loop, so it stays seamless'},
      {group: 'Look'}, {key: 'pop', label: 'Centre scale', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}, {key: 'edgeShade', label: 'Edge shade', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true},
      {key: 'edgeBlur', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, E.vy, E.h * (1 + P.gap), Math.round(P.cols)),
    layout(i, P, E){
      const cols = Math.round(P.cols), m = E.m, col = i % cols, row = Math.floor(i / cols), odd = col % 2, cc = (cols - 1) / 2;
      const r = rel(row, E.p * E.mb * (odd && P.flow !== 'same' ? -1 : 1) * (odd ? Math.round(P.oddSpeed) : 1), m);
      const y = (r + odd * P.colOffset) * E.h * (1 + P.gap), e = clamp01(ab(y) / E.vy), g = Math.max(0, 1 - ab(y) / (E.h * (1 + P.gap) * 1.5));
      return {x: (col - cc) * E.w * (1 + P.gap + P.colSpace), y, ry: cc ? -P.colTurn * .6 * (col - cc) / cc : 0, s: 1 + P.pop * g * g, o: wrapFade(r, m), b: 1 - P.edgeShade * e, blur: P.edgeBlur * e * e, img: (row % E.mb) * cols + col};
    }},

  /* ===================== more rings ===================== */
  {id: 'ring', name: 'Ring', cat: 'ring', n: 12, set: 'photos', aspect: .8, cardH: .68, dur: 18, frame: '5:4',
    desc: 'A tilted ring of curved cards with liquid-glass sides.',
    style: {...BG(SOFT), ...LR({width: .26, refraction: .7, bulge: .4})},
    params: [{group: 'Layout'}, P_RADIUS(1), P_TILT(.6), P_GAP(.14), {key: 'squash', label: 'Ellipse', type: 'range', min: .4, max: 1.6, step: .01, def: 1, unit: '×'},
      {key: 'face', label: 'Cards face', type: 'seg', options: {out: 'Outward', in: 'Inward', cam: 'Camera'}, def: 'out'},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'wob', label: 'Wave', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true, hint: 'two crests the cards ride over'},
      {group: 'Look'}, {key: 'curl', label: 'Card curve', type: 'range', min: 0, max: 2, step: .01, def: 1, unit: '×'},
      {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'fadeBack', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'pop', label: 'Front pop', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}],
    camera: (P, E) => { const R = ringR(P, E), d = R + E.D * 1.15; return {eye: [0, d * P.tilt * .7, d]}; },
    layout(i, P, E){
      const R = ringR(P, E), a = i / E.n * TAU + E.p * TAU * Math.round(P.laps), c = Math.cos(a), f = String(P.face);
      return {x: R * Math.sin(a), z: R * c * P.squash, y: P.wob * Math.sin(a * 2) * E.h, ry: f === 'cam' ? 0 : f === 'in' ? a + Math.PI : a, bend: f === 'cam' ? 0 : (f === 'in' ? -P.curl : P.curl) / R,
        b: 1 - P.dim * (1 - c) / 2, o: 1 - P.fadeBack * (1 - c) / 2, s: 1 + P.pop * Math.pow(Math.max(0, c), 4)};
    }},
  {id: 'double-ring', name: 'Double Ring', cat: 'ring', n: 20, set: 'photos', frame: '5:4', aspect: .8, cardH: .72, dur: 22,
    desc: 'Two rings turning against each other.',
    style: BG('#f6f6f8', 'radial', {c: ['#eef0f3', '#ffffff', '#e8ebf3', '#ffffff']}),
    params: [{group: 'Layout'}, P_RADIUS(1.1), P_TILT(.35), {key: 'sep', label: 'Separation', type: 'range', min: 0, max: 1.5, step: .01, def: .62},
      {key: 'squash', label: 'Ellipse', type: 'range', min: .4, max: 1.6, step: .01, def: 1, unit: '×'}, {key: 'lean', label: 'Ring lean', type: 'range', min: -.6, max: .6, step: .01, def: 0, hint: 'tips the two rings apart'},
      {key: 'face', label: 'Cards face', type: 'seg', options: {out: 'Outward', in: 'Inward', cam: 'Camera'}, def: 'out'},
      {group: 'Motion'}, {key: 'topTurns', label: 'Top ring turns', type: 'range', min: -3, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'botTurns', label: 'Bottom ring turns', type: 'range', min: -3, max: 3, step: 1, def: -1, unit: ' turns'},
      {key: 'offs', label: 'Bottom ring offset', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true, hint: 'shifts the bottom ring by part of a card'},
      {group: 'Look'}, {key: 'curl', label: 'Card curve', type: 'range', min: 0, max: 2, step: .01, def: 1, unit: '×'}, {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    camera: (P, E) => ({eye: [0, P.tilt * 3.2, 3.2 * P.radius + E.D]}),
    layout(i, P, E){
      const half = Math.ceil(E.n / 2), ring = i % 2, k = Math.floor(i / 2), R = 1.5 * P.radius, sg = ring ? -1 : 1, f = String(P.face);
      const a = (k + ring * P.offs) / half * TAU + Math.round(ring ? P.botTurns : P.topTurns) * E.p * TAU, c = Math.cos(a);
      const [x, y, z] = tiltPt(R * Math.sin(a), 0, R * c * P.squash, sg * P.lean, 0);
      return {x, z, y: y + sg * E.h * P.sep, rx: sg * P.lean, ry: f === 'cam' ? 0 : f === 'in' ? a + Math.PI : a, bend: f === 'cam' ? 0 : (f === 'in' ? -P.curl : P.curl) / R, b: 1 - P.dim * (1 - c) / 2};
    }},
  {id: 'helix', name: 'Helix', cat: 'ring', n: 18, set: 'photos', aspect: .8, cardH: .5, dur: 20,
    desc: 'A spiral staircase of images turning in the dark.',
    style: BG('#0b0b0d', 'radial', {c: ['#0b0b0d', '#1d1f26', '#000000', '#000000']}),
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'pitch', label: 'Pitch', type: 'range', min: .05, max: .5, step: .01, def: .16}, {key: 'turns', label: 'Spacing', type: 'range', min: .2, max: 1.2, step: .01, def: .55},
      {key: 'squash', label: 'Ellipse', type: 'range', min: .4, max: 1.6, step: .01, def: 1, unit: '×'}, {key: 'taper', label: 'Taper', type: 'range', min: -1, max: 1, step: .01, def: 0, hint: 'narrows the spiral toward one end'},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'climb', label: 'Climb', type: 'range', min: -2, max: 2, step: 1, def: 0, unit: '×', hint: 'cards ride up or down the spiral'},
      {group: 'Look'}, {key: 'curl', label: 'Card curve', type: 'range', min: 0, max: 2, step: .01, def: 1, unit: '×'}, {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: .5},
      {key: 'fadeBack', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'pop', label: 'Front pop', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const n = E.n, cl = Math.round(P.climb), j = cl ? wrap(i + E.p * n * cl, n) : i, f = (j - (n - 1) / 2) / Math.max(1, n - 1);
      const R = 1.25 * P.radius * (1 + P.taper * f * 1.5), a = j * P.turns + E.p * TAU * Math.round(P.laps), y = (j - (n - 1) / 2) * P.pitch, c = Math.cos(a);
      return {x: R * Math.sin(a), z: R * c * P.squash, y, ry: a, bend: P.curl / R, b: 1 - P.dim + P.dim * Math.max(0, c),
        o: (cl ? wrapFade(j - n / 2, n) : 1) * (1 - P.fadeBack * clamp01(-c)), s: 1 + P.pop * Math.pow(Math.max(0, c), 4)};
    }},
  {id: 'sphere', name: 'Sphere', cat: 'ring', n: 34, set: 'photos', aspect: 1, cardH: .3, dur: 24,
    desc: 'Images tiled over a slowly turning globe.',
    style: BG('#07070a', 'spotlight', {c: ['#07070a', '#3a3f55', '#000000', '#000000']}),
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'axis', label: 'Axis tilt', type: 'range', min: -1, max: 1, step: .01, def: .25}, {key: 'flat', label: 'Squash', type: 'range', min: .4, max: 1.6, step: .01, def: 1, unit: '×'},
      {key: 'face', label: 'Cards face', type: 'seg', options: {out: 'Outward', cam: 'Camera'}, def: 'out'},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'counter', label: 'Counter-turn halves', type: 'toggle', def: false}, {key: 'breathe', label: 'Breathe', type: 'range', min: 0, max: .3, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 1}, {key: 'fadeBack', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'pop', label: 'Front pop', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const R = 1.35 * P.radius * (1 + P.breathe * Math.sin(E.p * TAU * 2)), y = 1 - 2 * (i + .5) / E.n, r = Math.sqrt(1 - y * y), ph = i * 2.39996 + E.p * TAU * Math.round(P.laps) * (P.counter && y < 0 ? -1 : 1);
      const [X, Y, Z] = tiltPt(Math.sin(ph) * r * R, y * R * P.flat, Math.cos(ph) * r * R, P.axis, 0), cam = String(P.face) === 'cam', k = clamp01(Z / R * .5 + .6);
      return {x: X, y: Y, z: Z - .4, ry: cam ? 0 : ph, rx: cam ? 0 : -Math.asin(Math.max(-1, Math.min(1, y))) + P.axis * Math.cos(ph), b: 1 - .6 * P.dim * (1 - k), o: 1 - P.fadeBack * (1 - k), s: 1 + P.pop * Math.pow(k, 4)};
    }},
  {id: 'ribbon-loop', name: 'Ribbon Loop', cat: 'ring', n: 16, set: 'photos', aspect: .8, cardH: .5, dur: 22, frame: '5:4',
    desc: 'A twisted loop of cards banking through the frame.',
    style: {...BG(SOFT), ...LR({width: .24, refraction: .65})},
    params: [{group: 'Layout'}, P_RADIUS(1), P_TILT(.55), {key: 'wide', label: 'Width', type: 'range', min: .4, max: 1.6, step: .01, def: .95}, {key: 'deep', label: 'Depth', type: 'range', min: .2, max: 1.5, step: .01, def: .7},
      {key: 'lobes', label: 'Waves', type: 'range', min: 1, max: 4, step: 1, def: 2, hint: 'rises and dips round the loop'},
      {group: 'Motion'}, {key: 'twist', label: 'Twist', type: 'range', min: 0, max: 1.5, step: .01, def: .7}, {key: 'bank', label: 'Bank', type: 'range', min: 0, max: 1.5, step: .01, def: .55},
      {key: 'laps', label: 'Laps per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: ' turns'},
      {group: 'Look'}, {key: 'curl', label: 'Card curve', type: 'range', min: 0, max: 2, step: .01, def: 0, off: true}, {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'pop', label: 'Front pop', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}],
    camera: (P, E) => ({eye: [0, (E.D + .6) * P.tilt * .7, E.D + .6]}),
    layout(i, P, E){
      const R = .62 * P.radius, th = (i / E.n + E.p * Math.round(P.laps)) * TAU, L = Math.round(P.lobes), sn = Math.sin(th);
      return {x: R * Math.cos(th) * P.wide, y: Math.sin(th * L) * .32 * P.twist, z: R * sn * P.deep, ry: -th + Math.PI / 2, rz: sn * P.bank * P.twist, rx: Math.cos(th * L) * .25 * P.twist,
        bend: P.curl, b: 1 - P.dim * (1 - sn) / 2, s: 1 + P.pop * Math.pow(Math.max(0, sn), 4)};
    }},
  {id: 'tunnel', name: 'Tunnel', cat: 'ring', n: 32, set: 'photos', aspect: .8, cardH: .5, dur: 14,
    desc: 'Fly down a tunnel lined with images.',
    style: {...BG('#050507'), blur: {on: true, depth: .3}},
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'per', label: 'Per ring', type: 'range', min: 4, max: 12, step: 1, def: 8}, {key: 'oval', label: 'Width', type: 'range', min: .5, max: 1.5, step: .01, def: 1, unit: '×'},
      {key: 'len', label: 'Length', type: 'range', min: 6, max: 24, step: .1, def: 12}, {key: 'twistT', label: 'Ring twist', type: 'range', min: 0, max: 1.5, step: .01, def: .4},
      {key: 'face', label: 'Cards', type: 'seg', options: {cam: 'Face you', wall: 'Line the walls'}, def: 'cam'},
      {group: 'Motion'}, {key: 'roll', label: 'Roll', type: 'range', min: -2, max: 2, step: 1, def: 0, unit: ' turns'},
      {key: 'snake', label: 'Snake', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true, hint: 'the far end swings side to side'},
      {group: 'Look'}, {key: 'fog', label: 'Far fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'dim', label: 'Far dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const per = Math.round(P.per), rings = Math.max(1, Math.floor(E.n / per)), ring = Math.floor(i / per) % rings, k = i % per;
      const t = wrap(ring / rings + E.p, 1), a = k / per * TAU + ring * P.twistT + E.p * TAU * Math.round(P.roll), R = 1.35 * P.radius, q = 1 - t;
      const x = Math.cos(a) * R * E.asp * .85 * P.oval + P.snake * q * q * 3 * Math.sin(E.p * TAU), y = Math.sin(a) * R, z = -P.len + t * (P.len + 2.2);
      const o = clamp01(t * 4) * clamp01((1 - t) * 6) * (1 - P.fog * q), b = 1 - P.dim * q;
      if (String(P.face) === 'wall') return {m: M(T(x, y, z), RZ(a + Math.PI / 2), RX(-Math.PI / 2)), o, b};
      return {x, y, z, rz: a + Math.PI / 2, o, b};
    }},
  {id: 'wheel', name: 'Wheel', cat: 'ring', n: 12, set: 'photos', aspect: .8, cardH: .36, dur: 20, frame: '1:1',
    desc: 'Images arranged like the hours of a clock, turning slowly.',
    style: BG(WARM),
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'tilt', label: 'Tilt', type: 'range', min: -1, max: 1, step: .01, def: .35}, {key: 'yaw', label: 'Turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'upright', label: 'Cards', type: 'seg', options: {radial: 'Radial', upright: 'Upright'}, def: 'radial'},
      {key: 'fan', label: 'Fan', type: 'range', min: -1, max: 1, step: .01, def: 0, hint: 'turns every card about its own centre'}, {key: 'lean', label: 'Lean', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: -3, max: 3, step: 1, def: 1, unit: ' turns'}, {key: 'pulse', label: 'Pulse', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Top pop', type: 'range', min: 0, max: .8, step: .01, def: 0, off: true}, {key: 'dim', label: 'Bottom dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const R = .7 * P.radius * (1 + P.pulse * Math.sin(E.p * TAU * 2)), a = i / E.n * TAU + E.p * TAU * Math.round(P.laps), c = Math.cos(a), up = String(P.upright) === 'upright';
      return {m: M(RX(P.tilt), RY(P.yaw), RZ(a), T(0, R, 0), RZ((up ? -a : 0) + P.fan), RX(P.lean)), s: 1 + P.pop * Math.pow(Math.max(0, c), 4), b: 1 - P.dim * (1 - c) / 2};
    }},
  {id: 'saturn', name: 'Saturn', cat: 'ring', n: 15, set: 'photos', frame: '5:4', aspect: .8, cardH: .36, dur: 20,
    desc: 'A hero image with a ring of smaller images orbiting around it.',
    style: {...BG('#0c0c0f', 'radial', {c: ['#0b0b0e', '#262935', '#000000', '#000000']}), blur: {on: true, depth: .25}},
    params: [{group: 'Layout'}, P_RADIUS(1), P_TILT(.42, 'Ring tilt'), {key: 'oval', label: 'Ring shape', type: 'range', min: .5, max: 1.6, step: .01, def: 1, unit: '×'},
      {key: 'rise', label: 'Ring height', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'hero', label: 'Hero size', type: 'range', min: 1.2, max: 4, step: .01, def: 2.6},
      {key: 'face', label: 'Moons face', type: 'seg', options: {cam: 'Camera', out: 'Outward'}, def: 'cam'},
      {group: 'Motion'}, {key: 'laps', label: 'Orbits per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: ' turns'}, {key: 'sway', label: 'Hero sway', type: 'range', min: 0, max: 3, step: .01, def: 1, unit: '×'},
      {group: 'Look'}, {key: 'moon', label: 'Moon size', type: 'range', min: .5, max: 1.6, step: .01, def: 1, unit: '×'}, {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: .3}],
    layout(i, P, E){
      if (i === 0) return {s: P.hero, ry: Math.sin(E.p * TAU) * .15 * P.sway, zBias: 0};
      const a = (i - 1) / (E.n - 1) * TAU + E.p * TAU * Math.round(P.laps), R = 1.7 * P.radius;
      const [x, y, z] = tiltPt(Math.sin(a) * R * P.oval, 0, Math.cos(a) * R, P.tilt, 0);
      return {x, y: y + P.rise, z, ry: String(P.face) === 'out' ? a : a * 0, s: P.moon, b: 1 - P.dim + P.dim * Math.max(0, Math.cos(a))};
    }},

  /* ===================== more stacks & grids ===================== */
  {id: 'card-drop', name: 'Card Drop', cat: 'stack', n: 10, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.05, perCard: 1.1,
    desc: 'Photos drop onto a loose pile, one after another.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, {key: 'mess', label: 'Messiness', type: 'range', min: 0, max: 1, step: .01, def: .5}, {key: 'pile', label: 'Pile depth', type: 'range', min: 0, max: 3, step: .01, def: 1, unit: '×'},
      {key: 'slide', label: 'Push aside', type: 'range', min: -1, max: 1, step: .01, def: 0, hint: 'the card underneath slides away as the next lands'},
      {group: 'Motion'}, {key: 'from', label: 'Drop from', type: 'seg', options: {top: 'Above', left: 'Left', right: 'Right'}, def: 'top'},
      {key: 'height', label: 'Drop height', type: 'range', min: 1, max: 5, step: .01, def: 2.6},
      {key: 'land', label: 'Landing', type: 'select', options: {outBack: 'Bounce', outCubic: 'Soft', outExpo: 'Snap', outElastic: 'Elastic'}, def: 'outBack'},
      {key: 'spinIn', label: 'Spin in', type: 'range', min: -2, max: 2, step: .01, def: .6},
      {group: 'Look'}, {key: 'zoomIn', label: 'Drop scale', type: 'range', min: 0, max: .5, step: .01, def: .1}, {key: 'dim', label: 'Pile dim', type: 'range', min: 0, max: .12, step: .005, def: .04}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, ease.linear), r = wrap(i - u + 1, n) - 1, rz0 = (E.rnd(i, 1) - .5) * .5 * P.mess, x0 = (E.rnd(i, 2) - .5) * .3 * P.mess;
      if (r > 0){ const q = clamp01(1 - r), e = (ease[P.land] || ease.outBack)(q), d = (1 - e) * P.height, fr = String(P.from), sx = fr === 'left' ? -1 : fr === 'right' ? 1 : 0;
        return {y: sx ? 0 : d, x: x0 + sx * d * 1.4, rz: rz0 + (1 - q) * P.spinIn * (sx || 1), o: r < 1 ? 1 : 0, zBias: 3, s: 1 + (1 - q) * P.zoomIn}; }
      const d = -r;
      return {x: x0 + d * P.slide * E.w * .6, y: -d * .012 * P.pile, z: -d * .03 * P.pile, rz: rz0, o: d < 7 ? 1 : clamp01(8 - d), b: 1 - Math.min(.3, d * P.dim)};
    }},
  {id: 'riffle', name: 'Riffle', cat: 'stack', n: 10, set: 'photos', frame: '5:4', aspect: .8, cardH: .85, dur: 6,
    desc: 'The deck splits in two and riffles back together.',
    style: BG(WARM),
    params: [{group: 'Layout'}, {key: 'split', label: 'Split width', type: 'range', min: .2, max: 1.2, step: .01, def: .62}, {key: 'lift', label: 'Stack height', type: 'range', min: 0, max: .04, step: .001, def: .012},
      {key: 'deep', label: 'Stack depth', type: 'range', min: 0, max: .06, step: .001, def: .015}, {key: 'lay', label: 'Deck tilt', type: 'range', min: -1, max: .5, step: .01, def: -.35},
      {group: 'Motion'}, {key: 'riffles', label: 'Riffles per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {key: 'arch', label: 'Arch', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true, hint: 'the halves lift as they split'},
      {key: 'fan', label: 'Fan', type: 'range', min: 0, max: 1, step: .01, def: .2}, {key: 'yaw', label: 'Turn', type: 'range', min: 0, max: 1, step: .01, def: .25},
      {group: 'Look'}, {key: 'dim', label: 'Depth dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const k = Math.pow(Math.sin(E.p * Math.PI * Math.round(P.riffles)), 2), half = i % 2, idx = Math.floor(i / 2), sd = half ? 1 : -1;
      const order = lerp(i, (idx + (half ? 0 : .5)) * 2, k);
      return {x: sd * E.w * P.split * k, y: order * P.lift - .05 + P.arch * k * .4, z: order * P.deep, rz: -sd * P.fan * k, rx: P.lay, ry: -sd * P.yaw * k, b: 1 - P.dim * .6 * (1 - order / Math.max(1, E.n - 1))};
    }},
  {id: 'cascade', name: 'Cascade', cat: 'stack', n: 10, set: 'photos', aspect: .8, cardH: 1, dur: 16,
    desc: 'A staircase of images flowing down and away.',
    style: BG('#eef1ff', 'linear', {c: ['#eef1ff', '#ffeef5', '#ffffff', '#ffffff']}),
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'stepX', label: 'Step across', type: 'range', min: 0, max: 1, step: .01, def: .38}, {key: 'stepY', label: 'Step down', type: 'range', min: -.4, max: .4, step: .01, def: .1},
      {key: 'stepZ', label: 'Step depth', type: 'range', min: 0, max: .6, step: .01, def: .2}, {key: 'turn', label: 'Card turn', type: 'range', min: -1.2, max: 1.2, step: .01, def: -.35},
      {group: 'Motion'}, {key: 'laps', label: 'Passes per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {key: 'sway', label: 'Sway', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true, hint: 'cards swing as they travel'},
      {group: 'Look'}, {key: 'dim', label: 'Depth dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'soft', label: 'Depth blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const r = wrap(i - E.p * E.n * Math.round(P.laps), E.n), c = r - E.n / 2;
      return {x: c * E.w * P.stepX * P.spread, y: -c * E.h * P.stepY * P.spread, z: -r * P.stepZ, ry: P.turn + P.sway * Math.sin(r / E.n * TAU), o: clamp01(r * 1.5) * clamp01((E.n - r) * 1.5),
        b: 1 - P.dim * .7 * r / E.n, blur: P.soft * r / E.n};
    }},
  {id: 'tandem', name: 'Tandem', cat: 'stack', n: 6, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.25, perCard: 1.4,
    desc: 'Two cards trade places, swinging past each other.',
    style: BG('#0f0f12', 'radial', {c: ['#0d0d10', '#23252c', '#000000', '#000000']}),
    params: [{group: 'Layout'}, {key: 'offsetX', label: 'Back offset', type: 'range', min: 0, max: .5, step: .01, def: .18}, {key: 'backZ', label: 'Back depth', type: 'range', min: .2, max: 1.5, step: .01, def: .55},
      {group: 'Motion'}, {key: 'swingW', label: 'Swing width', type: 'range', min: 0, max: 1.2, step: .01, def: .55}, {key: 'swingZ', label: 'Swing depth', type: 'range', min: 0, max: 2, step: .01, def: .9},
      {key: 'turnT', label: 'Swing turn', type: 'range', min: 0, max: 2.5, step: .01, def: 1, unit: '×'}, {key: 'liftT', label: 'Swing lift', type: 'range', min: -.5, max: .5, step: .01, def: 0},
      {key: 'rollT', label: 'Swing roll', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'backB', label: 'Back brightness', type: 'range', min: .2, max: 1, step: .01, def: .65}, {key: 'soft', label: 'Back blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), r = wrap(i - u, n), side = i % 2 ? 1 : -1;
      if (r > n - 1){ const q = n - r, sq = Math.sin(q * Math.PI);
        return {x: -side * sq * E.w * P.swingW, y: sq * P.liftT, z: -q * P.swingZ, ry: side * sq * .5 * P.turnT, rz: -side * sq * P.rollT, o: 1 - q, b: 1 - q * .4, blur: q * P.soft}; }
      if (r <= 1){ const sr = Math.sin(r * Math.PI);
        return {x: side * sr * E.w * P.swingW + r * E.w * P.offsetX, y: sr * P.liftT, z: -r * P.backZ, ry: -side * sr * .45 * P.turnT, rz: side * sr * P.rollT, b: 1 - r * (1 - P.backB), blur: r * P.soft, zBias: r < .5 ? 1 : 0}; }
      return {x: E.w * P.offsetX, z: -P.backZ, o: clamp01(2 - r), b: P.backB, blur: P.soft};
    }},
  {id: 'stack-peel', name: 'Stack Peel', cat: 'stack', n: 7, set: 'photos', frame: '5:4', aspect: .8, step: true, cardH: 1.2, perCard: 1.3,
    desc: 'The top photo peels up and away to the back of the stack.',
    style: BG(WARM),
    params: [{group: 'Layout'}, {key: 'rise', label: 'Step up', type: 'range', min: -.3, max: .3, step: .01, def: .1}, {key: 'stepZ', label: 'Step depth', type: 'range', min: 0, max: .6, step: .01, def: .2},
      {key: 'shrink', label: 'Shrink', type: 'range', min: 0, max: .12, step: .005, def: .04}, {key: 'shown', label: 'Cards shown', type: 'range', min: 2, max: 8, step: 1, def: 6},
      {group: 'Motion'}, {key: 'peelH', label: 'Peel height', type: 'range', min: .3, max: 2, step: .01, def: 1.05}, {key: 'peelRot', label: 'Peel curl', type: 'range', min: -1.5, max: 1.5, step: .01, def: .8},
      {key: 'peelSide', label: 'Peel sideways', type: 'range', min: -1, max: 1, step: .01, def: 0}, {key: 'peelTwist', label: 'Peel twist', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'dim', label: 'Stack dim', type: 'range', min: 0, max: .2, step: .005, def: .08}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), r = wrap(i - u, n), K = Math.round(P.shown);
      const slot = rr => ({y: rr * E.h * P.rise, z: -rr * P.stepZ, s: Math.max(.05, 1 - rr * P.shrink), b: Math.max(0, 1 - rr * P.dim)});
      if (r > n - 1){ const q = n - r, sq = Math.sin(q * Math.PI), a = slot(0), b = slot(n - 1);
        return {x: sq * E.w * P.peelSide, y: lerp(a.y, b.y, q) + sq * E.h * P.peelH, z: lerp(a.z, b.z, q), rx: -sq * P.peelRot, rz: sq * P.peelTwist, s: lerp(a.s, b.s, q), b: lerp(1, b.b, q), zBias: q < .55 ? 2 : 0,
          o: lerp(1, clamp01(K - (n - 1)), sstep(.5, 1, q))}; }
      return {...slot(r), o: clamp01(K - r)};
    }},
  {id: 'grid-wave', name: 'Grid Wave', cat: 'stack', n: 30, set: 'photos', aspect: .8, cardH: .42, dur: 10,
    desc: 'A grid of images rippling like water.',
    style: BG(SOFT),
    params: [{group: 'Layout'}, P_COLS(6, 8), P_GAP(.16), P_TILT(.45), {key: 'rowOff', label: 'Row offset', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {key: 'origin', label: 'Wave from', type: 'seg', options: {center: 'Centre', left: 'Left', top: 'Top', corner: 'Corner'}, def: 'center'},
      {group: 'Motion'}, {key: 'amp', label: 'Wave height', type: 'range', min: 0, max: 1, step: .01, def: .35}, {key: 'freq', label: 'Ripple density', type: 'range', min: .5, max: 5, step: .01, def: 2.2},
      {key: 'waves', label: 'Waves per loop', type: 'range', min: 1, max: 4, step: 1, def: 1, unit: '×'}, {key: 'rock', label: 'Card rock', type: 'range', min: 0, max: 1.5, step: .01, def: .5},
      {group: 'Look'}, {key: 'crest', label: 'Trough shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'pop', label: 'Crest pop', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}],
    camera: (P, E) => ({eye: [0, P.tilt * 3, E.D + .8]}),
    layout(i, P, E){
      const cols = Math.round(P.cols), rows = Math.ceil(E.n / cols), c = i % cols, r = Math.floor(i / cols), og = String(P.origin);
      const x = (c - (cols - 1) / 2 + (r % 2) * P.rowOff) * E.w * (1 + P.gap), y = -(r - (rows - 1) / 2) * E.h * (1 + P.gap);
      let d, ux, uy;
      if (og === 'left'){ d = x + 3; ux = 1; uy = 0; } else if (og === 'top'){ d = 3 - y; ux = 0; uy = -1; } else if (og === 'corner'){ d = (x - y) * Math.SQRT1_2 + 3; ux = Math.SQRT1_2; uy = -Math.SQRT1_2; }
      else { d = Math.hypot(x, y); ux = x / (d + .01); uy = y / (d + .01); }
      const ph = d * P.freq - E.p * TAU * Math.round(P.waves), sp = Math.sin(ph), cp = Math.cos(ph) * P.amp * P.rock;
      return {x, y, z: sp * P.amp, rx: cp * uy, ry: -cp * ux, b: 1 - P.crest * .45 * (1 - sp), s: 1 + P.pop * Math.max(0, sp)};
    }},
  {id: 'bento', name: 'Bento Reveal', cat: 'stack', n: 7, fixedN: true, set: 'photos', aspect: 1, cardH: .5, dur: 7,
    desc: 'A bento grid of photos that builds in, holds, and clears.',
    style: BG('#efeff2'),
    params: [{group: 'Layout'}, P_GAP(.06), {key: 'grid', label: 'Grid size', type: 'range', min: .6, max: 1.1, step: .01, def: 1, unit: '×'}, {key: 'mirror', label: 'Mirror', type: 'toggle', def: false},
      {group: 'Motion'}, {key: 'stagger', label: 'Stagger', type: 'range', min: 0, max: .06, step: .005, def: .04},
      {key: 'order', label: 'Order', type: 'seg', options: {in: 'In order', rev: 'Reverse', rand: 'Random'}, def: 'in'},
      {key: 'from', label: 'Enter from', type: 'seg', options: {below: 'Below', above: 'Above', left: 'Left', right: 'Right'}, def: 'below'},
      {key: 'travel', label: 'Travel', type: 'range', min: 0, max: 1, step: .01, def: .15}, {key: 'outAt', label: 'Clear at', type: 'range', min: .35, max: .56, step: .01, def: .52},
      {group: 'Look'}, {key: 'blurIn', label: 'Blur in', type: 'range', min: 0, max: 1, step: .01, def: .8}, {key: 'scaleIn', label: 'Scale in', type: 'range', min: .5, max: 1.2, step: .01, def: .9}],
    layout(i, P, E){
      const tiles = [[0, 0, 2, 2], [2, 0, 1, 1], [3, 0, 1, 1], [2, 1, 2, 1], [0, 2, 1, 1], [1, 2, 2, 1], [3, 2, 1, 1]];
      const [tx, ty, tw, th] = tiles[i % tiles.length], unit = Math.min(2 * E.asp * .9 / 4, 2 * .88 / 3) * P.grid, g = unit * P.gap;
      const w = tw * unit - g, h = th * unit - g, x = (tx + tw / 2 - 2) * unit * (P.mirror ? -1 : 1), y = -(ty + th / 2 - 1.5) * unit;
      const od = String(P.order), j = od === 'rev' ? E.n - 1 - i : od === 'rand' ? E.rnd(i, 3) * (E.n - 1) : i, fr = String(P.from);
      const d = j * P.stagger, inn = ease.outQuint(clamp01((E.p - d) / .25)), out = ease.inCubic(clamp01((E.p - P.outAt - d) / .2)), e = inn * (1 - out), tr = (1 - e) * P.travel;
      return {x: x + (fr === 'left' ? -tr : fr === 'right' ? tr : 0), y: y - (fr === 'below' ? tr : fr === 'above' ? -tr : 0), w, h, aspect: w / h, s: P.scaleIn + (1 - P.scaleIn) * e, o: e, blur: (1 - e) * P.blurIn};
    }},
  {id: 'infinite-grid', name: 'Infinite Grid', cat: 'stack', n: 36, set: 'photos', aspect: .8, cardH: .6, dur: 24,
    desc: 'An endless grid drifting diagonally under a tilted camera.',
    style: BG('#0e0e10', 'solid', {c: ['#0e0e10', '#1d1f24', '#ffffff', '#ffffff']}),
    params: [{group: 'Layout'}, P_COLS(6, 8), P_TILT(.8, 'Tilt'), P_GAP(.12), {key: 'rowOff', label: 'Row offset', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {key: 'zig', label: 'Column zigzag', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'driftX', label: 'Drift across', type: 'range', min: -2, max: 2, step: 1, def: 1, unit: '×'}, {key: 'driftY', label: 'Drift forward', type: 'range', min: -2, max: 2, step: 1, def: 1, unit: '×'},
      {group: 'Look'}, {key: 'fog', label: 'Distance fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'pop', label: 'Centre pop', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}],
    fill: (P, E) => { const cols0 = Math.round(P.cols), rows0 = Math.ceil(E.n / cols0), mc = fillSlots(E.vx * 1.6 + E.w, E.w * (1 + P.gap), cols0, rows0, 160);
      const m = fillSlots(E.vy / Math.max(.25, Math.cos(P.tilt)) + E.h, E.h * (1 + P.gap), rows0, mc, 640); return {m, mb: rows0, mc, count: m * mc}; },
    layout(i, P, E){
      const cols0 = Math.round(P.cols), cols = E.mc, rows = E.m, c = i % cols, r = Math.floor(i / cols);
      const gx = E.w * (1 + P.gap), gy = E.h * (1 + P.gap), uc = wrap(c + E.p * cols0 * Math.round(P.driftX), cols), ur = wrap(r + E.p * E.mb * Math.round(P.driftY), rows);
      // offsets follow the slot's position, not its parity, so a wrapping row or column never jumps
      const [X, Y, Z] = tiltPt((uc - (cols - 1) / 2 + P.rowOff * (.5 - .5 * Math.cos(ur * Math.PI))) * gx, (ur - (rows - 1) / 2) * gy, P.zig * Math.cos(uc * Math.PI), -P.tilt, 0);
      return {x: X, y: Y, z: Z, rx: -P.tilt, o: clamp01(uc * 1.2) * clamp01((cols - uc) * 1.2 - .2) * clamp01(ur * 1.2) * clamp01((rows - ur) * 1.2 - .2) * (1 - P.fog * clamp01(-Z / 3)),
        s: 1 + P.pop * Math.pow(Math.max(0, 1 - Math.hypot(X, Y) / 1.2), 2), img: (r % E.mb) * cols0 + c % cols0};
    }},
  {id: 'iso-wall', name: 'Isometric Wall', cat: 'stack', n: 30, set: 'photos', aspect: .8, cardH: .7, dur: 24,
    desc: 'An isometric wall of photos, columns sliding past each other.',
    style: BG('#e9ebf0'),
    params: [{group: 'Layout'}, P_COLS(6, 8), P_GAP(.16), {key: 'view', label: 'View angle', type: 'range', min: .3, max: 1.3, step: .01, def: .95}, {key: 'rot', label: 'Rotation', type: 'range', min: -1.5, max: 1.5, step: .01, def: .75},
      {key: 'zig', label: 'Column depth', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'evenDir', label: 'Even columns', type: 'range', min: -2, max: 2, step: 1, def: 1, unit: '×'}, {key: 'oddDir', label: 'Odd columns', type: 'range', min: -2, max: 2, step: 1, def: -1, unit: '×'},
      {group: 'Look'}, {key: 'dim', label: 'Odd column shade', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}, {key: 'fog', label: 'Depth fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, (E.vx + E.vy) * 1.4 * Math.max(1, Math.cos(.95) / Math.max(.25, Math.cos(P.view))), E.h * (1 + P.gap), Math.round(P.cols)),
    layout(i, P, E){
      const cols = Math.round(P.cols), rows = E.m, c = i % cols, r = Math.floor(i / cols), odd = c % 2;
      const ur = wrap(r + E.p * E.mb * Math.round(odd ? P.oddDir : P.evenDir), rows), gx = E.w * (1 + P.gap), gy = E.h * (1 + P.gap);
      const m = M(RX(-P.view), RZ(P.rot), T((c - (cols - 1) / 2) * gx, (ur - (rows - 1) / 2) * gy, odd ? P.zig : -P.zig));
      return {m, o: clamp01(ur * 1.5) * clamp01((rows - ur) * 1.5 - .3) * (1 - P.fog * clamp01(-m[14] / 3)), b: 1 - P.dim * odd, img: (r % E.mb) * cols + c};
    }},
  {id: 'frames', name: 'Frames', cat: 'stack', n: 9, fixedN: true, set: 'photos', aspect: .8, step: true, cardH: .58, perCard: 1.6,
    desc: 'A 3×3 wall where each photo in turn steps forward.',
    style: {...BG(SOFT), blur: {on: true, depth: 0}},
    params: [{group: 'Layout'}, P_GAP(.1), {key: 'go', label: 'Focus moves', type: 'seg', options: {center: 'To centre', place: 'In place'}, def: 'center'},
      {group: 'Motion'}, {key: 'zoom', label: 'Zoom', type: 'range', min: 1.2, max: 3.5, step: .01, def: 2.6},
      {key: 'order', label: 'Order', type: 'seg', options: {mix: 'Shuffle', seq: 'In order', rev: 'Reverse'}, def: 'mix'},
      {key: 'inT', label: 'Zoom time', type: 'range', min: .1, max: .45, step: .01, def: .35}, {key: 'lift', label: 'Lift', type: 'range', min: 0, max: 1.5, step: .01, def: .6},
      {key: 'tiltF', label: 'Focus turn', type: 'range', min: -.6, max: .6, step: .01, def: 0},
      {group: 'Look'}, {key: 'soft', label: 'Background blur', type: 'range', min: 0, max: 1, step: .01, def: .7}, {key: 'dim', label: 'Background dim', type: 'range', min: 0, max: .8, step: .01, def: .35},
      {key: 'shrink', label: 'Background shrink', type: 'range', min: 0, max: .3, step: .01, def: .05}],
    layout(i, P, E){
      const c = i % 3, r = Math.floor(i / 3), x = (c - 1) * E.w * (1 + P.gap), y = -(r - 1) * E.h * (1 + P.gap);
      const cyc = E.p * 9, k = Math.floor(cyc), f = cyc - k, od = String(P.order), focus = od === 'seq' ? k % 9 : od === 'rev' ? 8 - k % 9 : [4, 0, 8, 2, 6, 1, 7, 3, 5][k % 9];
      const e = ease.inOutCubic(sstep(0, P.inT, f)) * (1 - ease.inOutCubic(sstep(.7, 1, f)));
      if (i === focus){ const g = String(P.go) === 'place' ? 1 : 1 - e; return {x: x * g, y: y * g, z: e * P.lift, ry: e * P.tiltF, s: lerp(1, P.zoom, e), zBias: 5}; }
      return {x, y, blur: e * P.soft, b: 1 - P.dim * e, s: 1 - P.shrink * e};
    }},
  {id: 'mosaic-flip', name: 'Mosaic Flip', cat: 'stack', n: 24, set: 'photos', aspect: .8, cardH: .5, dur: 7,
    desc: 'Tiles flip over in a diagonal wave to reveal new photos.',
    style: BG('#0c0c0f', 'radial', {c: ['#0c0c0f', '#22252e', '#000000', '#000000']}),
    params: [{group: 'Layout'}, P_COLS(4, 6), P_GAP(.1), {key: 'rowOff', label: 'Brick offset', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'wave', label: 'Wave delay', type: 'range', min: 0, max: .12, step: .005, def: .05},
      {key: 'pattern', label: 'Wave pattern', type: 'select', options: {diag: 'Diagonal', rows: 'Rows', cols: 'Columns', ripple: 'Ripple', random: 'Random'}, def: 'diag'},
      {key: 'axis', label: 'Flip axis', type: 'seg', options: {y: 'Sideways', x: 'Over the top'}, def: 'y'},
      {key: 'flipT', label: 'Flip time', type: 'range', min: .15, max: .45, step: .01, def: .3}, {key: 'lift', label: 'Flip lift', type: 'range', min: 0, max: .8, step: .01, def: .25},
      {group: 'Look'}, {key: 'shade', label: 'Flip shade', type: 'range', min: 0, max: 1, step: .01, def: .4}],
    layout(i, P, E){
      const tiles = Math.floor(E.n / 2), t = i % tiles, side = Math.floor(i / tiles), cols = Math.round(P.cols), rows = Math.ceil(tiles / cols);
      const c = t % cols, r = Math.floor(t / cols), x = (c - (cols - 1) / 2 + (r % 2) * P.rowOff) * E.w * (1 + P.gap), y = -(r - (rows - 1) / 2) * E.h * (1 + P.gap), pt = String(P.pattern);
      const dl = pt === 'rows' ? r : pt === 'cols' ? c : pt === 'ripple' ? Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) * 1.4 : pt === 'random' ? E.rnd(t, 4) * (cols + rows - 2) : c + r;
      const ph = wrap(E.p - dl * P.wave, 1), th = Math.PI * (ease.inOutCubic(sstep(.05, .05 + P.flipT, ph)) - ease.inOutCubic(sstep(.55, .55 + P.flipT, ph)));
      const a = th + side * Math.PI, vx = String(P.axis) === 'x';
      return {x, y, z: Math.sin(th) * P.lift, ry: vx ? 0 : a, rx: vx ? a : 0, o: Math.cos(a) > 0 ? 1 : 0, b: 1 - P.shade + P.shade * ab(Math.cos(th))};
    }},

  /* ===================== 3D showcase ===================== */
  {id: 'cubic', name: 'Cubic', cat: '3d', n: 6, fixedN: true, set: 'photos', frame: '5:4', aspect: 1, cardH: .95, dur: 10,
    desc: 'Six photos on a cube tumbling in space.',
    style: BG('#0b0b0d', 'radial', {c: ['#0b0b0d', '#1d1f26', '#000000', '#000000']}),
    params: [{group: 'Layout'}, {key: 'tilt', label: 'Tilt', type: 'range', min: -1, max: 1, step: .01, def: .42}, {key: 'gapC', label: 'Explode', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'turns', label: 'Turns per loop', type: 'range', min: -3, max: 3, step: 1, def: 1, unit: ' turns'}, {key: 'roll', label: 'Roll', type: 'range', min: -2, max: 2, step: 1, def: 0, unit: ' turns'},
      {key: 'wobble', label: 'Wobble', type: 'range', min: 0, max: 1, step: .01, def: .45}, {key: 'wobN', label: 'Wobble cycles', type: 'range', min: 1, max: 4, step: 1, def: 1, unit: '×'},
      {key: 'breath', label: 'Breathe', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true, hint: 'the faces part and close twice a loop'},
      {group: 'Look'}, {key: 'shade', label: 'Face shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const hw = E.w / 2 * (1 + P.gapC + P.breath * .6 * (.5 - .5 * Math.cos(E.p * TAU * 2))), faces = [[0, 0], [Math.PI / 2, 0], [Math.PI, 0], [-Math.PI / 2, 0], [0, -Math.PI / 2], [0, Math.PI / 2]];
      const [fy, fx] = faces[i % 6], cube = M(RX(P.tilt + Math.sin(E.p * TAU * Math.round(P.wobN)) * .25 * P.wobble), RY(E.p * TAU * Math.round(P.turns)), RX(E.p * TAU * Math.round(P.roll)));
      const m = M(cube, RY(fy), RX(fx), T(0, 0, hw));
      return {m, b: 1 - P.shade * .6 * (1 - Math.max(0, m[10]))};
    }},
  {id: 'space', name: 'Space', cat: '3d', n: 24, set: 'photos', aspect: .8, cardH: .55, dur: 16,
    desc: 'Photos drift toward you through deep space.',
    style: {...BG('#05060a', 'radial', {c: ['#05060a', '#141a2e', '#000000', '#000000']}), blur: {on: true, depth: .5}},
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'depth', label: 'Depth', type: 'range', min: 4, max: 20, step: .1, def: 11}, {key: 'hole', label: 'Clear centre', type: 'range', min: 0, max: 1.2, step: .01, def: .55},
      {key: 'oval', label: 'Width', type: 'range', min: .5, max: 1.6, step: .01, def: 1, unit: '×'},
      {group: 'Motion'}, {key: 'swirl', label: 'Swirl', type: 'range', min: -2, max: 2, step: 1, def: 0, unit: ' turns'}, {key: 'tumble', label: 'Tumble', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'jitter', label: 'Card angles', type: 'range', min: 0, max: 2.5, step: .01, def: 1, unit: '×'},
      {group: 'Look'}, {key: 'fog', label: 'Far fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'dim', label: 'Far dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const t = wrap(E.p + E.rnd(i, 1), 1), ang = E.rnd(i, 2) * TAU + E.p * TAU * Math.round(P.swirl), rad = (P.hole + E.rnd(i, 3) * 1.4) * P.spread;
      return {x: Math.cos(ang) * rad * E.asp * .8 * P.oval, y: Math.sin(ang) * rad * .8, z: -P.depth + t * (P.depth + 2.2), ry: (E.rnd(i, 4) - .5) * .6 * P.jitter, rx: (E.rnd(i, 5) - .5) * .4 * P.jitter,
        rz: (E.rnd(i, 6) - .5) * 2 * P.tumble * t * Math.PI, o: clamp01(t * 5) * clamp01((1 - t) * 5) * (1 - P.fog * (1 - t)), b: 1 - P.dim * (1 - t)};
    }},
  {id: 'flip-flap', name: 'Flip-Flap', cat: '3d', n: 8, set: 'photos', aspect: .8, cardH: .95, dur: 6,
    desc: 'A row of panels flipping over one after another.',
    style: BG('#ff4d2e', 'solid', {c: ['#e8452a', '#ff6a1a', '#ffffff', '#ffffff']}),
    params: [{group: 'Layout'}, P_GAP(.1), {key: 'arc', label: 'Row arc', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'wave', label: 'Wave delay', type: 'range', min: 0, max: .2, step: .005, def: .08},
      {key: 'from', label: 'Wave from', type: 'seg', options: {left: 'Left', right: 'Right', center: 'Centre'}, def: 'left'},
      {key: 'axis', label: 'Flip axis', type: 'seg', options: {x: 'Over the top', y: 'Sideways'}, def: 'x'},
      {key: 'flipT', label: 'Flip time', type: 'range', min: .15, max: .45, step: .01, def: .35},
      {key: 'feel', label: 'Flip feel', type: 'select', options: {inOutBack: 'Anticipate', inOutCubic: 'Smooth', outBack: 'Overshoot', inOutExpo: 'Snap'}, def: 'inOutBack'},
      {key: 'lift', label: 'Flip lift', type: 'range', min: 0, max: .8, step: .01, def: .3},
      {group: 'Look'}, {key: 'shade', label: 'Flip shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const tiles = Math.floor(E.n / 2), t = i % tiles, side = Math.floor(i / tiles), u = t - (tiles - 1) / 2, x = u * E.w * (1 + P.gap), fr = String(P.from), ez = ease[P.feel] || ease.inOutBack;
      const dl = fr === 'right' ? tiles - 1 - t : fr === 'center' ? ab(u) : t, ph = wrap(E.p - dl * P.wave, 1), th = Math.PI * (ez(sstep(.05, .05 + P.flipT, ph)) - ez(sstep(.55, .55 + P.flipT, ph)));
      const a = -th - side * Math.PI, vy = String(P.axis) === 'y', un = u / Math.max(1, (tiles - 1) / 2);
      return {x, z: Math.sin(th) * P.lift - P.arc * un * un * .8, rx: vy ? 0 : a, ry: (vy ? a : 0) - P.arc * un * .5, o: Math.cos(a) > 0 ? 1 : 0, b: 1 - P.shade + P.shade * ab(Math.cos(th))};
    }},
  {id: 'hero-tilt', name: 'Hero Tilt', cat: '3d', n: 9, set: 'photos', frame: '5:4', aspect: .8, cardH: 1.3, dur: 9,
    desc: 'One hero photo tilting gently, with a blurred ring of others behind it.',
    style: BG('#08090c', 'aurora', {c: ['#06070a', '#3b5bff', '#7b2ff7', '#2fe3c0']}),
    params: [{group: 'Layout'}, {key: 'heroS', label: 'Hero size', type: 'range', min: .6, max: 1.4, step: .01, def: 1, unit: '×'}, {key: 'ringW', label: 'Ring width', type: 'range', min: 1.5, max: 4.5, step: .01, def: 3.1},
      {key: 'ringZ', label: 'Ring distance', type: 'range', min: -5, max: -1, step: .01, def: -2.6}, {key: 'moon', label: 'Ring card size', type: 'range', min: .3, max: 1, step: .01, def: .55},
      {group: 'Motion'}, {key: 'sway', label: 'Hero sway', type: 'range', min: 0, max: 1, step: .01, def: .5}, {key: 'swayN', label: 'Sway cycles', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {key: 'laps', label: 'Ring turns', type: 'range', min: -2, max: 2, step: 1, def: 1, unit: ' turns'}, {key: 'waveR', label: 'Ring wave', type: 'range', min: 0, max: 1, step: .01, def: .35},
      {group: 'Look'}, {key: 'soft', label: 'Ring blur', type: 'range', min: 0, max: 1, step: .01, def: .85}, {key: 'ringB', label: 'Ring brightness', type: 'range', min: .1, max: 1, step: .01, def: .55}],
    layout(i, P, E){
      const sp = E.p * TAU * Math.round(P.swayN);
      if (i === 0) return {rx: Math.sin(sp) * .12 * P.sway, ry: Math.sin(sp + 1) * .3 * P.sway, s: P.heroS, zBias: 9};
      const a = (i - 1) / (E.n - 1) * TAU + E.p * TAU * Math.round(P.laps);
      return {x: Math.sin(a) * P.ringW, y: Math.cos(a * 2) * P.waveR, z: P.ringZ + Math.cos(a) * .6, s: P.moon, blur: P.soft, b: P.ringB, ry: Math.sin(a) * .4};
    }},
  {id: 'spin', name: 'Spin', cat: '3d', n: 2, fixedN: true, set: 'photos', frame: '5:4', aspect: .8, cardH: 1.2, dur: 3.5,
    desc: 'A photo spinning like a coin to reveal another.',
    style: BG('#fff4ea', 'mesh', {c: ['#fff4ea', '#ffd1b3', '#ffe4f1', '#e8e4ff']}),
    params: [{group: 'Layout'}, {key: 'axis', label: 'Spin axis', type: 'seg', options: {y: 'Vertical', x: 'Horizontal'}, def: 'y'}, {key: 'lean', label: 'Axis lean', type: 'range', min: -.6, max: .6, step: .01, def: 0},
      {group: 'Motion'}, {key: 'spins', label: 'Spins', type: 'range', min: 1, max: 4, step: 1, def: 1}, P_EASE, {key: 'hop', label: 'Hop', type: 'range', min: 0, max: .5, step: .01, def: .08},
      {key: 'push', label: 'Push back', type: 'range', min: 0, max: 1.5, step: .01, def: 0, off: true}, {key: 'swing', label: 'Swing', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'zoomS', label: 'Spin zoom', type: 'range', min: -.4, max: .4, step: .01, def: 0}, {key: 'shade', label: 'Edge shade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const th = E.ez(E.p) * TAU * Math.round(P.spins), a = th + i * Math.PI, vx = String(P.axis) === 'x', sp = Math.sin(E.p * Math.PI);
      const L = {ry: vx ? 0 : a, rx: vx ? a : 0, o: Math.cos(a) > 0 ? 1 : 0, x: Math.sin(E.p * TAU) * P.swing * E.w * .5, y: sp * P.hop, z: -sp * P.push, s: 1 + P.zoomS * sp, b: 1 - P.shade * (1 - ab(Math.cos(a)))};
      return P.lean ? {...L, m: M(T(L.x, L.y, L.z), RZ(P.lean), vx ? RX(a) : RY(a))} : L;
    }},
  {id: 'trio', name: 'Trio', cat: '3d', n: 3, fixedN: true, set: 'photos', frame: '5:4', aspect: .8, cardH: 1.25, dur: 8,
    desc: 'Three photos posed in a gentle arc, floating.',
    style: BG('#eef1f7', 'mesh', {c: ['#eef1f7', '#cfd8ff', '#ffd6e7', '#d6fff1']}),
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'deep', label: 'Side depth', type: 'range', min: 0, max: 1.5, step: .01, def: .6}, {key: 'angle', label: 'Side turn', type: 'range', min: -1, max: 1, step: .01, def: .42},
      {key: 'sideS', label: 'Side scale', type: 'range', min: .5, max: 1.1, step: .01, def: .9}, {key: 'drop', label: 'Side drop', type: 'range', min: -.4, max: .4, step: .01, def: 0},
      {group: 'Motion'}, {key: 'float', label: 'Float', type: 'range', min: 0, max: .2, step: .005, def: .04}, {key: 'floatN', label: 'Float cycles', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {key: 'sway', label: 'Sway', type: 'range', min: 0, max: .3, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'sideB', label: 'Side brightness', type: 'range', min: .3, max: 1, step: .01, def: 1}, {key: 'soft', label: 'Side blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const k = [0, -1, 1][i % 3], ph = E.p * TAU * Math.round(P.floatN) + i * 2.1;
      return {x: k * E.w * .95 * P.spread, z: -ab(k) * P.deep, ry: -k * P.angle + Math.sin(ph + 1) * P.sway, y: Math.sin(ph) * P.float - ab(k) * P.drop, s: k ? P.sideS : 1, b: k ? P.sideB : 1, blur: k ? P.soft : 0, zBias: k ? 0 : 3};
    }},
  /* ===================== liquid glass ===================== */
  {id: 'lens-grid', name: 'Lens Grid', cat: 'glass', n: 24, set: 'photos', aspect: .8, cardH: .5, dur: 20,
    desc: 'A round glass lens orbits over a drifting wall of photos.',
    style: {...BG(SOFT), lens: {on: true, mode: 'glass', shape: 'circle', w: .7, refraction: .6, dispersion: .6, bevel: .5, frost: 0, magnify: .05, highlight: .9, shadow: .45, motion: 'orbit', tintA: .03}},
    params: [{group: 'Layout'}, P_COLS(6, 8), P_GAP(.1), {key: 'colOff', label: 'Column offset', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'flow', label: 'Flow', type: 'seg', options: {up: 'Up', down: 'Down', alt: 'Alternate'}, def: 'up'},
      {key: 'laps', label: 'Scroll speed', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'}, {key: 'sway', label: 'Sway', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Centre pop', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}, {key: 'dim', label: 'Edge dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'soft', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: (P, E) => laneFill(E, E.vy, E.h * (1 + P.gap), Math.round(P.cols)),
    layout(i, P, E){
      const cols = Math.round(P.cols), rows = E.m, c = i % cols, r = Math.floor(i / cols), fl = String(P.flow), dr = fl === 'down' || (fl === 'alt' && c % 2) ? -1 : 1;
      const ur = wrap(r + E.p * E.mb * Math.round(P.laps) * dr, rows), gx = E.w * (1 + P.gap), gy = E.h * (1 + P.gap);
      const x = (c - (cols - 1) / 2) * gx + Math.sin(ur / rows * TAU * 2) * P.sway, y = (ur - (rows - 1) / 2 + (c % 2) * P.colOff) * gy, d = Math.hypot(x, y);
      return {x, y, o: clamp01(ur * 1.5) * clamp01((rows - ur) * 1.5 - .3), s: 1 + P.pop * Math.pow(Math.max(0, 1 - d / 1.2), 2), b: 1 - P.dim * clamp01(d / 2), blur: P.soft * clamp01(d / 1.6 - .2), img: (r % E.mb) * cols + c};
    }},
  {id: 'magnifier', name: 'Magnifier', cat: 'glass', n: 9, set: 'photos', aspect: .8, cardH: .9, dur: 20, frame: '9:16',
    desc: 'A vertical feed scrolling under a still drop of glass.',
    style: {...BG(WARM), lens: {on: true, mode: 'glass', shape: 'circle', w: .5, refraction: .7, dispersion: .7, bevel: .65, frost: 0, magnify: .12, highlight: .9, shadow: .5, motion: 'static', tintA: .03}},
    params: [{group: 'Layout'}, P_GAP(.08), {key: 'zig', label: 'Weave', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true, hint: 'cards step left and right as they pass'},
      {key: 'lean', label: 'Lean', type: 'range', min: -.5, max: .5, step: .01, def: 0}, {key: 'drum', label: 'Drum curve', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'laps', label: 'Scroll speed', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'}, {key: 'sway', label: 'Sway', type: 'range', min: 0, max: .3, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'pop', label: 'Centre pop', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}, {key: 'dim', label: 'Edge dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'soft', label: 'Edge blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: FILL_Y,
    layout(i, P, E){
      const r = rel(i, E.p * E.n * Math.round(P.laps), E.m), y = -r * E.h * (1 + P.gap), ay = ab(y);
      return {x: P.zig * Math.cos(r * Math.PI) * E.w * .5 + Math.sin(r * .9 + E.p * TAU) * P.sway, y, z: -P.drum * y * y * .4, rx: -Math.atan(.8 * P.drum * y), rz: P.lean, o: wrapFade(r, E.m),
        s: 1 + P.pop * Math.pow(Math.max(0, 1 - ay / (E.h * 1.2)), 2), b: 1 - P.dim * clamp01(ay / 1.2), blur: P.soft * clamp01(ay / 1.2 - .1)};
    }},
  {id: 'prism-frame', name: 'Prism Frame', cat: 'glass', n: 12, set: 'photos', aspect: .8, cardH: .9, dur: 24,
    desc: 'Photos glide through a frame of glass on all four sides.',
    style: {...BG(SOFT), ...GLASS({top: 1, bottom: 1, left: 1, right: 1}, {width: .16, refraction: .9, curve: 'lens', dispersion: 1, bulge: .2, highlight: .2})},
    params: [{group: 'Layout'}, P_GAP(.12), {key: 'arc', label: 'Curve', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'fan', label: 'Fan', type: 'range', min: -.5, max: .5, step: .01, def: 0},
      {group: 'Motion'}, {key: 'laps', label: 'Scroll speed', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'}, {key: 'waveA', label: 'Wave height', type: 'range', min: 0, max: .5, step: .01, def: .12},
      {key: 'waveD', label: 'Wave density', type: 'range', min: .2, max: 2, step: .01, def: .9}, {key: 'waveN', label: 'Wave cycles', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {group: 'Look'}, {key: 'pop', label: 'Centre pop', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}, {key: 'dim', label: 'Edge dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    fill: FILL_X,
    layout(i, P, E){
      const r = rel(i, E.p * E.n * Math.round(P.laps), E.m), x = r * E.w * (1 + P.gap), ax = ab(x);
      return {x, y: Math.sin(r * P.waveD + E.p * TAU * Math.round(P.waveN)) * P.waveA, z: -P.arc * x * x * .3, ry: -Math.atan(.6 * P.arc * x), rz: -x * P.fan * .3, o: wrapFade(r, E.m),
        s: 1 + P.pop * Math.pow(Math.max(0, 1 - ax / (E.w * 1.5)), 2), b: 1 - P.dim * clamp01(ax / 2)};
    }},
  /* ===================== gallery templates ===================== */
  {id: 'elastic', name: 'Elastic Scroll', cat: 'carousel', n: 10, set: 'photos', aspect: .8, step: true, cardH: .95, perCard: 1.3, frame: '5:4',
    desc: 'A row that stretches, bows and pulls back while it scrolls, then settles flat.',
    params: [{group: 'Layout'}, P_GAP(.12),
      {group: 'Motion'}, {key: 'elastic', label: 'Elasticity', type: 'range', min: 0, max: 2, step: .01, def: 1}, {key: 'lag', label: 'Ripple lag', type: 'range', min: 0, max: .012, step: .0005, def: .0035},
      {key: 'sink', label: 'Push back', type: 'range', min: 0, max: 2, step: .01, def: .7}, {key: 'swing', label: 'Swing', type: 'range', min: -1, max: 1, step: .01, def: .25},
      {key: 'bow', label: 'Bow', type: 'range', min: 0, max: 5, step: .05, def: 2.4}, {key: 'squeeze', label: 'Squeeze', type: 'range', min: 0, max: .4, step: .01, def: .1},
      {key: 'dip', label: 'Dip', type: 'range', min: -.5, max: .5, step: .01, def: 0},
      {group: 'Look'}, {key: 'soft', label: 'Motion blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'dim', label: 'Motion dim', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true}],
    fill: FILL_X,
    layout(i, P, E){
      const n = E.n, r0 = rel(i, stepU(E.p, n, E.hold, E.ez), E.m);
      // cards further along the row react a little later, so the spacing stretches and snaps back
      const pd = E.p - Math.max(-3, Math.min(3, r0)) * P.lag * P.elastic, r = rel(i, stepU(pd, n, E.hold, E.ez), E.m);
      const v = clamp01(stepSpeed(pd, n, E.hold, E.ez) * (1 - E.hold) / 5) * P.elastic;
      return {x: r * E.w * (1 + P.gap), y: -v * P.dip, z: -v * P.sink, ry: -v * P.swing, bend: v * P.bow, s: 1 - v * P.squeeze, blur: v * P.soft, b: 1 - Math.min(1, v) * P.dim, o: wrapFade(r, E.m)};
    }},
  {id: 'paper-roll', name: 'Paper Roll', cat: 'carousel', n: 24, set: 'photos', aspect: .8, cardH: .5, dur: 26, frame: '5:4',
    desc: 'Columns of photos run like paper over rollers at the top and bottom.',
    params: [{group: 'Layout'}, P_COLS(3, 5), P_GAP(.08), {key: 'colSp', label: 'Column spread', type: 'range', min: 0, max: 6, step: .05, def: 2.5},
      {key: 'roll', label: 'Roller', type: 'range', min: .1, max: .8, step: .01, def: .3}, {key: 'offR', label: 'Column offset', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {group: 'Motion'}, {key: 'laps', label: 'Laps per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {key: 'colDir', label: 'Columns run', type: 'seg', options: {same: 'Same way', alt: 'Alternate'}, def: 'same'},
      {group: 'Look'}, {key: 'curl', label: 'Wrap rollers', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true, hint: 'cards bend round the rollers'},
      {key: 'dim', label: 'Back shade', type: 'range', min: 0, max: 1, step: .01, def: .4}, {key: 'fadeBack', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    mods: {poseRy: -24, poseRx: 6},
    layout(i, P, E){
      const cols = Math.round(P.cols), m = Math.ceil(E.n / cols), col = i % cols, row = Math.floor(i / cols), dr = String(P.colDir) === 'alt' && col % 2 ? -1 : 1;
      const R = P.roll, L = m * E.h * (1 + P.gap), Y = Math.max(.05, (L - TAU * R) / 4);
      // the belt: up the front, over the top roller, down the back, round the bottom roller
      let s = wrap(row / m + col * P.offR / m + E.p * Math.round(P.laps) * dr, 1) * L, y, z, th, rl = 0;
      if (s < 2 * Y){ y = -Y + s; z = 0; th = 0; }
      else if ((s -= 2 * Y) < Math.PI * R){ th = s / R; y = Y + R * Math.sin(th); z = -R + R * Math.cos(th); rl = 1; }
      else if ((s -= Math.PI * R) < 2 * Y){ y = Y - s; z = -2 * R; th = Math.PI; }
      else { s -= 2 * Y; th = Math.PI + s / R; y = -Y + R * Math.sin(th); z = -R + R * Math.cos(th); rl = 1; }
      const c = Math.cos(th);
      return {x: (col - (cols - 1) / 2) * E.w * (1 + P.gap * P.colSp), y, z, rx: -th, bendY: rl * P.curl / R, b: 1 - P.dim + P.dim * Math.max(0, c), o: 1 - P.fadeBack * clamp01(-c)};
    }},
  {id: 'rolodex', name: 'Rolodex', cat: '3d', n: 10, set: 'photos', aspect: 1.25, step: true, cardH: .78, perCard: 1.4, frame: '5:4',
    desc: 'Photos on a drum that flips forward one card at a time.',
    params: [{group: 'Layout'}, P_GAP(.05), {key: 'drum', label: 'Drum size', type: 'range', min: .6, max: 2, step: .01, def: 1, unit: '×'}, {key: 'tiltD', label: 'Drum tilt', type: 'range', min: -.6, max: .6, step: .01, def: 0},
      {key: 'twist', label: 'Twist', type: 'range', min: -.6, max: .6, step: .01, def: 0, hint: 'each card turns a little more than the last'},
      {key: 'spiral', label: 'Spiral', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'dim', label: 'Back shade', type: 'range', min: 0, max: 1, step: .01, def: .55}, {key: 'fadeBack', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true},
      {key: 'pop', label: 'Front pop', type: 'range', min: 0, max: .4, step: .01, def: 0, off: true}],
    mods: {poseRy: -20},
    layout(i, P, E){
      const n = E.n, a0 = TAU / n, R = E.h * (1 + P.gap) / (2 * Math.tan(Math.PI / n)) * P.drum;
      const a = rel(i, stepU(E.p, n, E.hold, E.ez), n) * a0, c = Math.cos(a);
      return {m: M(T(Math.sin(a) * P.spiral * E.w, 0, 0), RZ(P.tiltD), T(0, R * Math.sin(a), R * c - R), RX(-a), RY(Math.sin(a) * P.twist)),
        b: 1 - P.dim + P.dim * Math.max(0, c), o: 1 - P.fadeBack * clamp01(-c), s: 1 + P.pop * Math.pow(Math.max(0, c), 6)};
    }},
  {id: 'golden-zoom', name: 'Infinite Zoom', cat: '3d', n: 12, set: 'photos', aspect: .8, cardH: 1.3, dur: 20, frame: '5:4',
    desc: 'An endless zoom through photos nested inside each other.',
    params: [{group: 'Layout'}, {key: 'ratio', label: 'Shrink', type: 'range', min: .5, max: .9, step: .005, def: .7}, {key: 'turn', label: 'Turn', type: 'range', min: -.8, max: .8, step: .01, def: .2}, P_SPREAD(1),
      {key: 'swirl', label: 'Spiral rate', type: 'range', min: 0, max: 5, step: .05, def: 2.2}, {key: 'oval', label: 'Spiral shape', type: 'range', min: .4, max: 2.5, step: .01, def: 1.5},
      {key: 'start', label: 'Zoom start', type: 'range', min: -2.5, max: -.3, step: .01, def: -1.1},
      {group: 'Motion'}, {key: 'laps', label: 'Cards per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'}, {key: 'spinG', label: 'Spin', type: 'range', min: -2, max: 2, step: 1, def: 0, unit: ' turns'},
      {group: 'Look'}, {key: 'dim', label: 'Depth dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'soft', label: 'Depth blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      // frames within frames: each photo sits inside the last, a little smaller and turned, drifting round a spiral
      const q = wrap(i - E.p * E.n * Math.round(P.laps), E.n), s = Math.pow(P.ratio, q + P.start), th = q * P.turn, r = .3 * P.spread * s, k = th * P.swirl;
      return {x: Math.cos(k) * r * 1.2 * (P.oval / 1.5), y: Math.sin(k) * r * .8, rz: th + E.p * TAU * Math.round(P.spinG), s, zBias: q * .05, o: clamp01(q * .9) * clamp01((E.n - q) * 2),
        b: 1 - P.dim * q / E.n, blur: P.soft * q / E.n};
    }},
  {id: 'assemble', name: 'Assemble', cat: 'stack', n: 12, set: 'photos', aspect: .8, cardH: .5, dur: 8, frame: '5:4',
    desc: 'A loose pile of photos flies into a neat grid, holds, then tumbles back.',
    params: [{group: 'Layout'}, P_COLS(4, 6), P_GAP(.1), {key: 'mess', label: 'Messiness', type: 'range', min: 0, max: 1, step: .01, def: .7},
      {key: 'pileS', label: 'Pile scale', type: 'range', min: .6, max: 2, step: .01, def: 1.45}, {key: 'from', label: 'Pile at', type: 'seg', options: {center: 'Centre', below: 'Below', above: 'Above'}, def: 'center'},
      {group: 'Motion'}, {key: 'stagger', label: 'Stagger', type: 'range', min: 0, max: .1, step: .002, def: .08},
      {key: 'order', label: 'Order', type: 'seg', options: {in: 'In order', rev: 'Reverse', center: 'Centre out', rand: 'Random'}, def: 'in'},
      {key: 'lift', label: 'Lift', type: 'range', min: 0, max: 1, step: .01, def: .35}, {key: 'tumble', label: 'Tumble', type: 'range', min: -1, max: 1, step: .01, def: .2},
      {group: 'Look'}, {key: 'soft', label: 'Pile blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'dim', label: 'Pile dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const cols = Math.round(P.cols), rows = Math.ceil(E.n / cols), c = i % cols, r = Math.floor(i / cols), fr = String(P.from), od = String(P.order);
      const gx = (c - (cols - 1) / 2) * E.w * (1 + P.gap), gy = -(r - (rows - 1) / 2) * E.h * (1 + P.gap);
      const px = (E.rnd(i, 1) - .5) * 1.1 * P.mess, py = (E.rnd(i, 2) - .5) * .55 * P.mess + (fr === 'below' ? -1.1 : fr === 'above' ? 1.1 : 0), pr = (E.rnd(i, 3) - .5) * 1.2 * P.mess;
      const j = od === 'rev' ? E.n - 1 - i : od === 'rand' ? E.rnd(i, 4) * (E.n - 1) : od === 'center' ? Math.hypot(c - (cols - 1) / 2, r - (rows - 1) / 2) / Math.max(.5, Math.hypot((cols - 1) / 2, (rows - 1) / 2)) * (E.n - 1) : i;
      const d = j / Math.max(1, E.n - 1) * P.stagger;
      const k = ease.inOutCubic(sstep(.04 + d, .34 + d, E.p)) * (1 - ease.inOutCubic(sstep(.52 + d, .82 + d, E.p)));
      return {x: lerp(px, gx, k), y: lerp(py, gy, k), z: Math.sin(k * Math.PI) * P.lift, rz: lerp(pr, 0, k), rx: Math.sin(k * Math.PI) * P.tumble, s: lerp(P.pileS, 1, k), zBias: (1 - k) * i * .02,
        blur: (1 - k) * P.soft, b: 1 - (1 - k) * P.dim * .6};
    }},
  {id: 'corridor', name: 'Gallery Walk', cat: '3d', n: 32, set: 'photos', aspect: .8, cardH: .5, dur: 20, frame: '5:4', fov: 62,
    desc: 'Walk down a gallery hallway with photos hung on both walls.',
    params: [{group: 'Layout'}, {key: 'width', label: 'Hall width', type: 'range', min: .4, max: 2.5, step: .01, def: .72}, P_GAP(.45), {key: 'rows', label: 'Rows', type: 'range', min: 1, max: 3, step: 1, def: 2},
      {key: 'rowH', label: 'Row spacing', type: 'range', min: .9, max: 2, step: .01, def: 1.22}, {key: 'angle', label: 'Wall angle', type: 'range', min: -.6, max: .6, step: .01, def: 0, hint: 'turns the photos toward you'},
      {key: 'sides', label: 'Walls', type: 'seg', options: {both: 'Both', left: 'Left', right: 'Right'}, def: 'both'},
      {group: 'Motion'}, {key: 'laps', label: 'Walk speed', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'}, {key: 'bob', label: 'Step bob', type: 'range', min: 0, max: .1, step: .005, def: 0, off: true},
      {group: 'Look'}, {key: 'dim', label: 'Far dim', type: 'range', min: 0, max: 1, step: .01, def: .45}, {key: 'fog', label: 'Far fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const rows = Math.round(P.rows), side = i % 2 ? 1 : -1, k = Math.floor(i / 2), row = k % rows, m = Math.max(1, Math.ceil(E.n / 2 / rows)), j = Math.floor(k / rows), sd = String(P.sides);
      const Lz = m * E.w * (1 + P.gap), t = wrap(j / m + E.p * Math.round(P.laps) + (side > 0 ? .5 / m : 0), 1), hide = (sd === 'left' && side > 0) || (sd === 'right' && side < 0);
      return {x: side * P.width, y: (row - (rows - 1) / 2) * E.h * P.rowH + Math.sin(E.p * TAU * 8) * P.bob, z: E.D - .3 - (1 - t) * Lz, ry: -side * (Math.PI / 2 - P.angle),
        o: hide ? 0 : clamp01(t * 5) * clamp01((1 - t) * m * .9) * (1 - P.fog * (1 - t)), b: 1 - P.dim + P.dim * t};
    }},
  {id: 'drift', name: 'Floating Gallery', cat: '3d', n: 15, set: 'photos', aspect: .8, cardH: .56, dur: 24, frame: '5:4',
    desc: 'Photos float upward at three depths, each layer at its own pace.',
    style: {blur: {on: true, depth: .3}},
    params: [{group: 'Layout'}, P_SPREAD(1), {key: 'depth', label: 'Depth', type: 'range', min: 0, max: 3, step: .01, def: 1.5}, {key: 'farS', label: 'Back layer size', type: 'range', min: .5, max: 1.5, step: .01, def: 1, unit: '×'},
      {group: 'Motion'}, {key: 'rate', label: 'Rise speed', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: '×'},
      {key: 'pace', label: 'Layers', type: 'seg', options: {layered: 'Own pace', same: 'Same pace'}, def: 'layered'},
      {key: 'weave', label: 'Weave', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}, {key: 'sway', label: 'Sway', type: 'range', min: 0, max: .6, step: .01, def: .12},
      {key: 'rock', label: 'Rock', type: 'range', min: 0, max: .3, step: .01, def: .05},
      {group: 'Look'}, {key: 'dim', label: 'Back layer dim', type: 'range', min: 0, max: .7, step: .01, def: 0, off: true}, {key: 'soft', label: 'Back layer blur', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const layer = i % 3, k = Math.floor(i / 3), m = Math.max(1, Math.ceil(E.n / 3)), speed = (String(P.pace) === 'same' ? 1 : layer + 1) * Math.round(P.rate), w = [1, .5, 0][layer];
      const z = [-1, -.35, .3][layer] * P.depth, vis = (E.D * E.vy - z) / E.D;
      const t = wrap(k / m + E.rnd(i, 1) * .5 / m + E.p * speed, 1), y = (t - .5) * (2 * vis + E.h * 2.4);
      const x = (((k * 2 + layer) % 5) / 4 - .5 + (E.rnd(i, 2) - .5) * .18) * 2 * (E.vx / E.vy) * vis * .78 * P.spread + Math.sin(t * TAU) * P.weave;
      return {x, y, z, rz: Math.sin(E.p * TAU * speed + i) * P.rock, ry: Math.sin(E.p * TAU + i * 1.7) * P.sway, s: lerp(1, P.farS, w), o: clamp01(Math.min(t, 1 - t) * 14), b: 1 - P.dim * w, blur: P.soft * w};
    }},
  {id: 'hero-strip', name: 'Hero Strip', cat: 'transitions', n: 7, set: 'photos', aspect: .8, step: true, cardH: 1.25, perCard: 1.6, frame: '5:4',
    desc: 'A filmstrip of thumbnails; each one grows into the hero image in turn.',
    params: [{group: 'Layout'}, {key: 'thumb', label: 'Thumb size', type: 'range', min: .1, max: .35, step: .005, def: .21}, P_GAP(.15),
      {key: 'stripPos', label: 'Strip at', type: 'seg', options: {bottom: 'Bottom', top: 'Top'}, def: 'bottom'}, {key: 'heroY', label: 'Hero height', type: 'range', min: -.4, max: .5, step: .01, def: .14},
      {key: 'heroSz', label: 'Hero size', type: 'range', min: .6, max: 1.2, step: .01, def: 1, unit: '×'},
      {group: 'Motion'}, {key: 'arc', label: 'Arc', type: 'range', min: 0, max: .6, step: .01, def: .2}, {key: 'hop', label: 'Hop', type: 'range', min: -.5, max: .5, step: .01, def: 0},
      {key: 'turn', label: 'Turn', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Look'}, {key: 'thumbB', label: 'Thumb brightness', type: 'range', min: .3, max: 1, step: .01, def: 1}],
    layout(i, P, E){
      const n = E.n, u = stepU(E.p, n, E.hold, E.ez), k = Math.floor(u), f = u - k, cur = wrap(k, n), nxt = wrap(k + 1, n);
      const e = i === cur ? 1 - f : i === nxt ? f : 0, ts = P.thumb, top = String(P.stripPos) === 'top', se = Math.sin(e * Math.PI);
      const tx = (i - (n - 1) / 2) * E.w * ts * (1 + P.gap), ty = top ? .96 - E.h * ts / 2 : -.96 + E.h * ts / 2;
      return {x: lerp(tx, 0, e), y: lerp(ty, top ? -P.heroY : P.heroY, e) + se * P.hop, s: lerp(ts, P.heroSz, e), z: se * P.arc, ry: se * P.turn, b: lerp(P.thumbB, 1, e), zBias: i === nxt ? 6 : e * 5};
    }},

  /* ===================== Surface-style carousels ===================== */
  {id: 'turbine', name: 'Turbine', cat: 'ring', n: 30, set: 'photos', aspect: .8, cardH: .6, dur: 24, frame: '5:4',
    desc: 'A spinning ring of photos set like turbine blades.',
    params: [{group: 'Layout'}, P_RADIUS(1), P_TILT(.42, 'Tilt'), {key: 'yaw', label: 'Turn', type: 'range', min: -1, max: 1, step: .01, def: -.18}, {key: 'cone', label: 'Cone', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {key: 'blade', label: 'Blade angle', type: 'range', min: -1.5, max: 1.5, step: .01, def: 1.05}, {key: 'pitchB', label: 'Blade pitch', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: -3, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'flutter', label: 'Flutter', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true, hint: 'blades open and close three times a turn'},
      {group: 'Look'}, P_CURVE(.5), {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}, {key: 'pop', label: 'Front pop', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const R = .6 * P.radius, a = (i / E.n + E.p * Math.round(P.laps)) * TAU;
      const m = M(RX(P.tilt), RY(P.yaw), RZ(a), RY(P.cone), T(R, 0, 0), RZ(Math.PI / 2), RY(P.blade + P.flutter * Math.sin(a * 3)), RX(P.pitchB));
      return {m, bend: P.curve, b: 1 - P.dim * (1 - m[10]) / 2, s: 1 + P.pop * clamp01(m[14] / R)};
    }},
  {id: 'vortex', name: 'Vortex', cat: 'ring', n: 22, set: 'photos', aspect: .8, cardH: .78, dur: 22, frame: '5:4',
    desc: 'Curled photos swirling round a centre like petals.',
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'tilt', label: 'Tilt', type: 'range', min: -1, max: 1, step: .01, def: .2}, {key: 'yaw', label: 'Turn', type: 'range', min: -1, max: 1, step: .01, def: .12},
      {key: 'swirl', label: 'Swirl', type: 'range', min: -1.5, max: 1.5, step: .01, def: .55}, {key: 'lean', label: 'Petal lean', type: 'range', min: -1.5, max: 1.5, step: .01, def: .95},
      {key: 'cone', label: 'Cone', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: -3, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'flutter', label: 'Flutter', type: 'range', min: 0, max: .6, step: .01, def: 0, off: true, hint: 'petals open and close three times a turn'},
      {group: 'Look'}, P_CURVE(1.5), {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      // swept blades round a small eye: each card leans off the radius and curls
      const a = (i / E.n + E.p * Math.round(P.laps)) * TAU;
      const m = M(RX(P.tilt), RY(P.yaw), RZ(a), RY(P.cone), T(.4 * P.radius, 0, 0), RZ(Math.PI / 2 + P.swirl + P.flutter * Math.sin(a * 3)), RY(P.lean));
      return {m, bend: P.curve, b: 1 - P.dim * (1 - m[10]) / 2};
    }},
  {id: 'pinwheel', name: 'Pinwheel', cat: 'ring', n: 6, set: 'photos', aspect: .8, cardH: 1, dur: 14, frame: '5:4',
    desc: 'A few large curled photos turning like a pinwheel in 3D.',
    params: [{group: 'Layout'}, P_RADIUS(1), {key: 'tilt', label: 'Tilt', type: 'range', min: -1, max: 1, step: .01, def: .38}, {key: 'yaw', label: 'Turn', type: 'range', min: -1, max: 1, step: .01, def: -.25},
      {key: 'rake', label: 'Blade rake', type: 'range', min: -1.5, max: 1.5, step: .01, def: .5}, {key: 'twist', label: 'Twist', type: 'range', min: -1.5, max: 1.5, step: .01, def: .7},
      {key: 'cone', label: 'Cone', type: 'range', min: -1, max: 1, step: .01, def: 0},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: -3, max: 3, step: 1, def: 1, unit: ' turns'}, {key: 'rock', label: 'Rock', type: 'range', min: 0, max: .5, step: .01, def: .14},
      {group: 'Look'}, P_CURVE(.8), {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    layout(i, P, E){
      const a = (i / E.n + E.p * Math.round(P.laps)) * TAU, w = Math.sin(E.p * TAU) * P.rock;
      const m = M(RX(P.tilt + w), RY(P.yaw), RZ(a), RY(P.cone), T(.5 * P.radius, 0, 0), RZ(P.rake), RY(P.twist));
      return {m, bend: P.curve, b: 1 - P.dim * (1 - m[10]) / 2};
    }},
  {id: 'tornado', name: 'Tornado', cat: 'ring', n: 72, set: 'photos', aspect: .8, cardH: .16, dur: 20, frame: '5:4',
    desc: 'A cone of small photos spiralling round like a tornado.',
    params: [{group: 'Layout'}, {key: 'perTurn', label: 'Per turn', type: 'range', min: 6, max: 24, step: 1, def: 14}, P_RADIUS(1), {key: 'flare', label: 'Cone', type: 'range', min: 0, max: 2, step: .01, def: 1.25},
      {key: 'height', label: 'Height', type: 'range', min: 1, max: 3, step: .01, def: 1.95}, {key: 'tip', label: 'Tip size', type: 'range', min: .05, max: .6, step: .01, def: .22},
      {group: 'Motion'}, {key: 'laps', label: 'Turns per loop', type: 'range', min: 1, max: 3, step: 1, def: 1, unit: ' turns'},
      {key: 'shear', label: 'Shear', type: 'range', min: -2, max: 2, step: 1, def: 0, hint: 'the top turns faster or slower than the bottom'},
      {key: 'whip', label: 'Whip', type: 'range', min: 0, max: .5, step: .01, def: 0, off: true},
      {group: 'Look'}, {key: 'dim', label: 'Back dim', type: 'range', min: 0, max: 1, step: .01, def: .45}, {key: 'fadeBack', label: 'Back fade', type: 'range', min: 0, max: 1, step: .01, def: 0, off: true}],
    mods: {poseRx: 8},
    layout(i, P, E){
      const f = i / Math.max(1, E.n - 1), H = P.height, slope = P.flare * .62 / H, r = (P.tip + P.flare * .62 * f) * P.radius;
      const a = i / P.perTurn * TAU + E.p * TAU * (Math.round(P.laps) + Math.round(P.shear * (1 - f))), c = Math.cos(a);
      return {x: r * Math.sin(a) + P.whip * Math.sin(E.p * TAU + f * TAU) * (1 - f), z: r * c, y: (.97 - f * 1.95) * H / 1.95, ry: a, rx: -Math.atan(slope), bend: Math.min(3, 1 / r),
        b: 1 - P.dim + P.dim * Math.max(0, c), o: 1 - P.fadeBack * clamp01(-c)};
    }},

  // the 36 gallery, kinetic and sculpture templates
  ...X_TEMPLATES,
  ...Y_TEMPLATES,
  ...Z_TEMPLATES,
];

function ringR(P, E){ return Math.max(.8, E.n * E.w * (1 + (P.gap ?? .1)) / TAU) * P.radius; }
function carouselR(P, E){ return Math.max(1.5, E.n * E.w * (1 + (P.gap ?? .2)) / TAU) * P.radius; }

// parameters every template gets
export const COMMON_PARAMS = [
  {key: 'count', label: 'Cards', type: 'range', min: 1, max: 80, step: 1},
  {key: 'speed', label: 'Speed', type: 'range', min: .1, max: 3, step: .01, def: 1, unit: '×'},
  {key: 'dir', label: 'Direction', type: 'seg', options: {'1': 'Forward', '-1': 'Reverse'}, def: '1'},
];
const deg = (key, label, def = 0, lim = 180) => ({key, label, type: 'range', min: -lim, max: lim, step: 1, def, unit: '°'});
const cyc = (key, label, def = 1) => ({key, label, type: 'range', min: 0, max: 4, step: 1, def, unit: '×', hint: 'whole cycles per loop, so it stays seamless'});
const off = (key, label, max, def = 0, step = .01) => ({key, label, type: 'range', min: 0, max, step, def, off: true});
// Surface-style modifier groups: they work on top of any template's own layout (applied in engine.js)
export const MOD_GROUPS = [
  {id: 'bend', title: 'Bend', params: [{key: 'bend', label: 'Bend', type: 'range', min: -3, max: 3, step: .01, def: 0},
    {key: 'bendAxis', label: 'Bend axis', type: 'seg', options: {h: 'Horizontal', v: 'Vertical', both: 'Both'}, def: 'h'},
    off('flex', 'Flex', 2), cyc('flexSpeed', 'Flex speed'), {key: 'flexOffset', label: 'Flex offset', type: 'range', min: 0, max: 1, step: .01, def: .25}]},
  {id: 'depth', title: '3D card', params: [off('thick', 'Thickness', .3, 0, .005), {key: 'edgeCol', label: 'Edge colour', type: 'color', def: '#ffffff'},
    {key: 'cardSpin', label: 'Card spin', type: 'range', min: -3, max: 3, step: 1, def: 0, unit: ' turns', hint: 'each card turns round its own centre'},
    {key: 'spinOffset', label: 'Spin offset', type: 'range', min: 0, max: 1, step: .01, def: 0}]},
  {id: 'shape', title: 'Shape', params: [{key: 'ramp', label: 'Ramp', type: 'range', min: -2, max: 2, step: .01, def: 0},
    off('staggerY', 'Stagger vertical', 2), off('staggerZ', 'Stagger depth', 2)]},
  {id: 'pose', title: 'Pose', params: [deg('poseRx', 'Rotate X', 0, 90), deg('poseRy', 'Rotate Y', 0, 90), deg('poseRz', 'Rotate Z'),
    {key: 'spin', label: 'Spin', type: 'range', min: -3, max: 3, step: 1, def: 0, unit: ' turns'}]},
  {id: 'tilt', title: 'Card tilt', params: [deg('tiltX', 'Tilt X', 0, 90), deg('tiltY', 'Tilt Y', 0, 90), deg('tiltZ', 'Tilt Z', 0, 90),
    off('tiltRand', 'Random', 60, 0, 1), off('tiltSway', 'Sway', 45, 0, 1), cyc('swaySpeed', 'Sway speed')]},
  {id: 'disp', title: 'Displacement', params: [off('dispZ', 'Displace Z', 2), off('dispY', 'Float', 1), cyc('dispSpeed', 'Speed'), {key: 'dispOffset', label: 'Offset', type: 'range', min: 0, max: 1, step: .01, def: .4},
    {group: 'Wave'}, off('waveDepth', 'Depth', 1.5), {key: 'waveFreq', label: 'Frequency', type: 'range', min: .1, max: 4, step: .01, def: 1}, cyc('waveSpeed', 'Speed'),
    {key: 'waveStyle', label: 'Style', type: 'seg', options: {wave: 'Wave', ripple: 'Ripple'}, def: 'wave'},
    {key: 'waveDir', label: 'Direction', type: 'seg', options: {h: 'Horizontal', v: 'Vertical'}, def: 'h'},
    off('panX', 'Pan X', 2), off('panZ', 'Pan Z', 3), cyc('panSpeed', 'Pan speed')]},
  {id: 'transform', title: 'Transform', params: [{key: 'size', label: 'Card scale', type: 'range', min: .3, max: 2, step: .01, def: 1, unit: '×'},
    {key: 'scale', label: 'Group scale', type: 'range', min: .3, max: 2.5, step: .01, def: 1, unit: '×'},
    {key: 'offX', label: 'Position X', type: 'range', min: -2, max: 2, step: .01, def: 0}, {key: 'offY', label: 'Position Y', type: 'range', min: -2, max: 2, step: .01, def: 0},
    {key: 'offZ', label: 'Position Z', type: 'range', min: -4, max: 2, step: .01, def: 0},
    {key: 'fade', label: 'Opacity', type: 'range', min: 0, max: 1, step: .01, def: 1, percent: true}]},
  {id: 'easing', title: 'Easing', params: [{key: 'motion', label: 'Motion', type: 'seg', options: {continuous: 'Continuous', stepped: 'Stepped'}, def: 'continuous', rebuild: true},
    {key: 'steps', label: 'Steps', type: 'range', min: 0, max: 40, step: 1, def: 0, auto: true}, P_HOLD, P_EASE]},
  {id: 'anim', title: 'Animation in', params: [{key: 'animIn', label: 'Play at start', type: 'toggle', def: false},
    {key: 'animStyle', label: 'Style', type: 'select', options: {fade: 'Fade', rise: 'Rise', fall: 'Drop in', scale: 'Scale up', fly: 'Fly in', spin: 'Spin'}, def: 'rise'},
    {key: 'animDur', label: 'Duration', type: 'range', min: .1, max: 4, step: .05, def: .9, unit: 's'},
    {key: 'animStagger', label: 'Stagger', type: 'range', min: 0, max: .5, step: .01, def: .06, unit: 's'},
    {key: 'animOrder', label: 'Order', type: 'seg', options: {in: 'In order', center: 'Centre out', random: 'Random'}, def: 'in'},
    {key: 'animEase', label: 'Easing', type: 'select', options: {outCubic: 'Smooth', outQuint: 'Snappy', outExpo: 'Expo', outBack: 'Overshoot', inOutCubic: 'Ease in-out'}, def: 'outQuint'}]},
];
export const byId = id => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
export function defaults(t){
  const P = {count: t.n, speed: 1, dir: '1', hold: .5, ease: 'inOutQuint'};
  MOD_GROUPS.forEach(g => g.params.forEach(p => { if (p.key) P[p.key] = p.def; }));
  (t.params || []).forEach(p => { if (p.key) P[p.key] = p.def; });
  Object.assign(P, t.mods || {});
  return P;
}
// the controls panel, as collapsible groups; each group has its own reset
export function controlGroups(t, P = {}){
  const own = (t.params || []).filter(p => p.key !== 'ease');
  const groups = [{id: 'template', title: t.name, params: [...COMMON_PARAMS.filter(p => !(p.key === 'count' && t.fixedN)), ...own]}];
  for (const g of MOD_GROUPS){
    let ps = g.params;
    if (g.id === 'easing') ps = t.step ? [P_HOLD, P_EASE] : P.motion === 'stepped' ? ps : ps.slice(0, 1).concat(t.params?.some(p => p.key === 'ease') ? [P_EASE] : []);
    if (g.id === 'anim' && !P.animIn) ps = ps.slice(0, 1);
    groups.push({...g, params: ps});
  }
  return groups;
}
export function paramsFor(t){ return controlGroups(t).flatMap(g => g.params); }
// loop length in seconds at speed 1
export function duration(t, P){
  if (t.kind === 'flare') return null;
  return t.step ? (t.perCard || 1.4) * (t.fixedN ? t.n : P.count) : (t.dur || 10);
}
