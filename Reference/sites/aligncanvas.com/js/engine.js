// Turns the project state + a time into a frame description the renderer can draw.
import { TAU, wrap, clamp01, ease, hash, mulberry, hexToRgb, luminance, lookAt, mat4 } from './math.js';
const D2R = Math.PI / 180;
import { byId, duration } from './templates.js';
import { MEDIA_SETS, BLUR_FRACS } from './faces.js';
import { flareState, flareRect, flareUniforms, flareDuration } from './flare.js';

export const ASPECTS = {'16:9': [16, 9], '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5], '5:4': [5, 4], '4:3': [4, 3], '3:4': [3, 4], '21:9': [21, 9], '2:3': [2, 3]};
export const BG_MODES = {solid: 0, linear: 1, radial: 2, mesh: 3, aurora: 4, grid: 5, dots: 6, holo: 7, spotlight: 8, plasma: 9};
const MIXED = ['scenery', 'ui', 'gradients', 'posters', 'shapes', 'logos'];
// up to 3072 px, so full-frame cards stay sharp in 4K exports
const RES_STEPS = [192, 256, 384, 512, 768, 1024, 1536, 2048, 3072];
const quantRes = px => RES_STEPS.find(r => r >= px) || 3072;

export function sizeFor(aspect, short){
  const [a, b] = ASPECTS[aspect] || [16, 9];
  const even = v => Math.max(2, Math.round(v / 2) * 2);
  return a >= b ? [even(short * a / b), even(short)] : [even(short), even(short * b / a)];
}
export function cardAspect(state, t){
  const a = state.style.card.aspect;
  if (!a || a === 'auto') return t.aspect;
  const [x, y] = a.split(':').map(Number); return x / y;
}
export function loopLength(state){
  const t = byId(state.template), P = state.params;
  const d = t.kind === 'flare' ? flareDuration(P, P.count) : duration(t, P);
  return d / Math.max(.05, P.speed || 1);
}
// The clip: how long the export (and the preview timeline) runs. With a seamless loop, the motion is
// sped up or slowed down a little so a whole number of loops fits the chosen duration exactly.
export function clipInfo(state){
  const loop = loopLength(state), ex = state.export, clip = Math.max(.5, ex.duration || loop);
  if (!ex.seamless) return {loop, clip, rate: 1, loops: clip / loop};
  const loops = Math.max(1, Math.round(clip / loop));
  return {loop, clip, rate: loops * loop / clip, loops};
}
export const clipLength = state => clipInfo(state).clip;
// the media item shown on card i
export function mediaItems(app, t){
  const st = app.state, imgs = st.media.images.filter(m => app.images.get(m.id));
  // uploads and library picks: images, or videos that play on the card (a poster canvas stands in for
  // a video in thumbnails, under its own key)
  if (imgs.length) return imgs.map(m => { const el = app.images.get(m.id), vid = el.tagName === 'VIDEO';
    return {kind: vid ? 'video' : 'image', img: el, key: 'img:' + m.id + (vid ? '#v' : '')}; });
  // only the bundled photos are used as built-in media
  const set = 'photos';
  if (set === 'mixed'){
    const out = [];
    for (let k = 0; k < 24; k++){ const s = MIXED[k % MIXED.length], idx = Math.floor(k / MIXED.length); out.push({kind: 'set', set: s, index: idx, key: s + ':' + idx}); }
    return out;
  }
  const S = MEDIA_SETS[set] || MEDIA_SETS.logos;
  return Array.from({length: S.count}, (_, i) => ({kind: 'set', set, index: i, key: set + ':' + i}));
}
function orderFor(st, n){
  const idx = Array.from({length: n}, (_, i) => i);
  if (st.media.order === 'scatter'){ const R = mulberry(st.media.seed || 1); for (let i = n - 1; i > 0; i--){ const j = Math.floor(R() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } }
  return idx;
}
const itemFor = (items, order, i) => items[order[i % order.length] % items.length];

function bgDesc(st, p){
  const b = st.bg;
  return {mode: BG_MODES[b.mode] ?? 0, c: b.c.map(hexToRgb), phase: p, cycles: Math.max(1, Math.round(b.cycles || 1)), scale: b.scale ?? 1, angle: b.angle ?? .6, amt: b.amt ?? 1, transparent: !!b.transparent};
}
function lensCenter(L, p){
  let x = L.x, y = L.y;
  if (L.motion === 'drift'){ x += Math.sin(p * TAU) * .12; y += Math.cos(p * TAU) * .06; }
  if (L.motion === 'sweep') x = .5 + Math.sin(p * TAU) * .3;
  if (L.motion === 'orbit'){ x = .5 + Math.cos(p * TAU) * .22; y = .5 + Math.sin(p * TAU) * .18; }
  return [x, 1 - y];
}
function postDesc(st, p, T, thumb){
  const g = st.glass, L = st.lens, fx = st.fx;
  const edges = !g.on ? [0, 0, 0, 0] : g.mode === 'all' ? [g.amount, g.amount, g.amount, g.amount] : [g.top, g.bottom, g.left, g.right];
  const shape = L.shape === 'circle' ? [L.w, L.w, 1] : L.shape === 'square' ? [L.w, L.h, .35] : [L.w, L.h, 1];
  return {
    labels: !thumb && (st.labels.on || st.title?.on || st.logo?.on), seed: Math.floor(T * 60) % 997,
    u: {
      uEdge: edges, uEW: g.width, uER: g.refraction, uED: g.dispersion, uES: g.soften, uEF: g.feather, uEH: g.highlight, uEB: g.bulge ?? .35, uEX: g.stretch ?? 0,
      uEdgeTint: st.bg.transparent ? [1, 1, 1] : hexToRgb(st.bg.c[0]),
      uECurve: {i: {panel: 0, lens: 1, wave: 2}[g.curve] ?? 0},
      uLensOn: L.on ? 1 : 0, uLensMode: {i: L.mode === 'hole' ? 1 : 0}, uLensC: lensCenter(L, p), uLensS: [shape[0] / 2, shape[1] / 2], uLensR: shape[2],
      uLensRef: L.refraction, uLensFrost: L.frost, uLensDisp: L.dispersion, uLensBevel: L.bevel, uLensHi: L.highlight, uLensMag: L.magnify,
      uLensShadow: L.shadow, uLensTint: hexToRgb(L.tint), uLensTintA: L.tintA,
      uGrain: fx.grain, uVig: fx.vignette, uBloom: fx.bloom, uChroma: fx.chroma, uContrast: fx.contrast, uSat: fx.saturation, uExposure: fx.exposure,
      uEdgeBlur: st.blur.on ? st.blur.edge : 0,
    },
  };
}

export function buildFrame(app, T, W, H, opts = {}){
  const st = app.state, style = st.style, t = byId(st.template), P = st.params, R = app.renderer;
  const items = mediaItems(app, t), aspect = cardAspect(st, t);
  const desc = {W, H, bg: null, camera: null, cards: [], shadow: null, flare: null, post: null};
  // T is clip time; the motion runs at the seamless-loop rate on top of the template speed
  const Tc = T; T = T * (opts.rate ?? clipInfo(st).rate);
  const T2 = T * (P.speed || 1);
  if (t.kind === 'flare'){
    const n = Math.max(2, P.count), dur = flareDuration(P, n), p = wrap(T2 / dur, 1);
    desc.bg = bgDesc(style, p);
    const fs = flareState(P, n, T2), order = orderFor(st, n), rect = flareRect(P, W, H, aspect);
    const res = opts.thumb ? 192 : quantRes(rect.cw * (opts.resBoost || 1));
    const A = itemFor(items, order, fs.a), B = itemFor(items, order, fs.b);
    desc.flare = {a: R.face(A, A.key, aspect, res), b: R.face(B, B.key, aspect, res), u: flareUniforms(P, fs.m, W, H, rect, style, BLUR_FRACS)};
    desc.post = postDesc(style, p, T, opts.thumb);
    return desc;
  }
  const n = t.fixedN ? t.n : Math.max(1, Math.round(P.count));
  let p = wrap(T2 / duration(t, P), 1);
  if (String(P.dir) === '-1') p = wrap(1 - p, 1);
  // Easing > Stepped: any continuous template can hold on each step, then ease to the next
  if (!t.step && P.motion === 'stepped'){ const k = Math.round(P.steps) || n, hold = P.hold ?? .5, ez = ease[P.ease] || ease.inOutQuint, c = p * k, f = c - Math.floor(c);
    p = wrap((Math.floor(c) + ez(clamp01((f - hold) / Math.max(1e-3, 1 - hold)))) / k, 1); }
  desc.bg = bgDesc(style, p);
  // a template may set its own lens; the Camera panel's perspective adjusts relative to it
  const cam = style.camera, baseFov = t.fov || 30;
  const fov = Math.min(110, baseFov * (cam.fov || 30) / 30) * Math.PI / 180, D = 1 / Math.tan(fov / 2);
  const h = (t.cardH || .8) * (P.size || 1), w = h * aspect;
  const seed = st.media.seed || 1;
  const E = {p, n, asp: W / H, w, h, D, rnd: (i, k) => hash(i + 1, k + 7, seed), ez: ease[P.ease] || ease.inOutQuint, hold: P.hold ?? .5};
  const c0 = t.camera ? t.camera(P, E) : {};
  // a narrower frame than the template was designed for zooms out to keep the whole composition in view
  const [da, db] = ASPECTS[t.frame] || [16, 9], designAsp = da / db, fit = E.asp < designAsp ? Math.pow(designAsp / E.asp, .8) : 1;
  let eye = (c0.eye || [0, 0, D]).slice(), target = c0.target || [0, 0, 0];
  // global camera: zoom, orbit, tilt and an optional slow drift
  const rel = [eye[0] - target[0], eye[1] - target[1], eye[2] - target[2]];
  const orbit = (cam.orbit || 0) + Math.sin(p * TAU) * (cam.drift || 0), tilt = (cam.tilt || 0) + Math.cos(p * TAU) * (cam.drift || 0) * .4;
  let [x, y, z] = rel.map(v => v * (cam.zoom || 1) * fit);
  const cy = Math.cos(tilt), sy = Math.sin(tilt); [y, z] = [y * cy + z * sy, -y * sy + z * cy];
  const co = Math.cos(orbit), so = Math.sin(orbit); [x, z] = [x * co + z * so, -x * so + z * co];
  eye = [target[0] + x, target[1] + y, target[2] + z];
  desc.camera = {fov, eye, target};
  // visible half-size of the frame at z = 0 in layout units (before Pose/Transform), so strips and
  // grids can keep enough cards to run past the frame edges however small the group is scaled
  const gs = Math.abs(P.scale ?? 1) || 1, Dz = Math.hypot(x, y, z) || D;
  const turn = 1 + 1.5 * Math.max(...[P.poseRx, P.poseRy, P.poseRz, (cam.orbit || 0) / D2R, (cam.tilt || 0) / D2R].map(a => Math.abs(Math.sin((a || 0) * D2R))));
  const far = Math.max(1, (Dz - (P.offZ || 0) + 2 * Math.abs(P.panZ || 0)) / Dz) * turn * Dz / D;
  E.vy = (far + Math.abs(P.offY || 0)) / gs;
  E.vx = (far * E.asp + Math.abs(P.offX || 0) + Math.abs(P.panX || 0)) / gs;
  E.m = n;
  let N = n;
  if (t.fill){ const F = t.fill(P, E); Object.assign(E, F); N = F.count; }
  const focusDist = Math.hypot(x, y, z) + (style.blur.focus || 0);
  const order = orderFor(st, n);
  const res = opts.thumb ? 192 : quantRes(Math.max(w, h) * H / 2 * (t.resBoost || 1.3) * (opts.resBoost || 1));
  const sc = style.card, sh = style.shade;
  const G = groupMatrix(P, p), anim = P.animIn ? animOrder(P, n, E) : null, aEase = ease[P.animEase] || ease.outQuint;
  for (let i = 0; i < N; i++){
    const L = t.layout(i, P, E) || {};
    const ai = L.aspect || aspect;
    const hi = L.h || h, wi = L.w || hi * ai;
    // k is the card's identity: fill slots repeat whole sets of images, so per-card phases follow
    // the image, not the slot, and a card that wraps round matches the one it replaces
    const k = L.img ?? i % n, item = itemFor(items, order, k);
    let M0 = L.m || mat4.model(L.x || 0, L.y || 0, L.z || 0, L.rx || 0, L.ry || 0, L.rz || 0, 1, 1);
    let sc0 = L.s ?? 1, o0 = (L.o ?? 1) * (P.fade ?? 1), blur0 = L.blur || 0;
    const px = M0[12], py = M0[13], pz = M0[14];
    // displacement: per-card depth offset, a travelling wave across the layout, and animation in
    let dz = 0, ay = 0, wave = null;
    if (P.dispZ) dz += P.dispZ * Math.sin(TAU * (Math.round(P.dispSpeed) * p + k * P.dispOffset));
    if (P.dispY) ay += P.dispY * Math.sin(TAU * (Math.round(P.dispSpeed) * p + k * P.dispOffset + .25));
    if (P.waveDepth){
      const ripple = P.waveStyle === 'ripple', u = ripple ? Math.hypot(px, py) : P.waveDir === 'v' ? py : px;
      const k = P.waveFreq * Math.PI, arg = u * k - TAU * Math.round(P.waveSpeed) * p, A = P.waveDepth * .5;
      dz += A * Math.sin(arg);
      const slope = Math.atan(A * k * Math.cos(arg)) * .8;
      if (ripple){ const d = Math.hypot(px, py) || 1; wave = mat4.mul(mat4.rotY(-slope * px / d), mat4.rotX(slope * py / d)); }
      else wave = P.waveDir === 'v' ? mat4.rotX(slope) : mat4.rotY(-slope);
    }
    let local = null;
    if (anim){
      const e = aEase(clamp01((Tc - anim[k % n] * P.animStagger) / Math.max(.01, P.animDur))), q = 1 - e, st2 = P.animStyle;
      o0 *= st2 === 'fade' ? e : clamp01(e * 2.2); blur0 += q * .5;
      if (st2 === 'rise') ay = -q * 1.1; else if (st2 === 'fall') ay = q * 1.6;
      else if (st2 === 'fly') dz += -q * 5; else if (st2 === 'scale') sc0 *= .35 + .65 * e;
      else if (st2 === 'spin'){ local = mat4.rotY(q * Math.PI); sc0 *= .7 + .3 * e; }
    }
    const tx = (P.tiltX || 0) + (P.tiltRand ? (E.rnd(k, 11) - .5) * 2 * P.tiltRand : 0) + (P.tiltSway ? Math.sin(TAU * Math.round(P.swaySpeed) * p + k * 1.3) * P.tiltSway : 0);
    const ty = (P.tiltY || 0) + (P.tiltRand ? (E.rnd(k, 12) - .5) * 2 * P.tiltRand : 0) + (P.tiltSway ? Math.cos(TAU * Math.round(P.swaySpeed) * p + k * 1.3) * P.tiltSway * .6 : 0);
    const tz = (P.tiltZ || 0) + (P.tiltRand ? (E.rnd(k, 13) - .5) * 2 * P.tiltRand : 0);
    // Shape: ramp and stagger move each card along its own up and facing directions, so on a ring
    // stagger depth pushes cards in and out of the ring, and on a flat strip it pushes them in depth
    const odd = k % 2 ? 1 : -1, sY = (P.ramp ? P.ramp * (n > 1 ? k / (n - 1) - .5 : 0) * hi * 2 : 0) + (P.staggerY ? odd * P.staggerY * hi * .5 : 0), sZ = P.staggerZ ? odd * P.staggerZ * .5 : 0;
    if (sY || sZ) M0 = mat4.mul(M0, mat4.translation(0, sY, sZ));
    const spin = P.cardSpin ? Math.round(P.cardSpin) * p * TAU + (P.spinOffset || 0) * k * TAU : 0;
    if (tx || ty || tz || spin) M0 = mat4.mul(M0, mat4.model(0, 0, 0, tx * D2R, ty * D2R + spin, tz * D2R, 1, 1));
    if (local) M0 = mat4.mul(M0, local);
    if (sc0 !== 1) M0 = mat4.mul(M0, mat4.scaling(sc0, sc0, 1));
    // wave tilt pivots each card about its own centre, in world space
    if (wave) M0 = mat4.mul(mat4.translation(px, py, pz), mat4.mul(wave, mat4.mul(mat4.translation(-px, -py, -pz), M0)));
    if (dz || ay) M0 = mat4.mul(mat4.translation(0, ay, dz), M0);
    const m = G ? mat4.mul(G, M0) : M0;
    const cx = m[12], cy = m[13], cz = m[14];
    const dist = Math.hypot(eye[0] - cx, eye[1] - cy, eye[2] - cz);
    const dBlur = style.blur.on ? style.blur.depth * Math.abs(dist - focusDist) * .45 : 0;
    desc.cards.push({
      m, x: cx, y: cy, z: cz, rx: 0, ry: 0, rz: 0, sx: 1, sy: 1,
      w: wi, h: hi, ...bendFor(P, L, p, k), zBias: L.zBias || 0,
      thick: (P.thick || 0) * Math.min(wi, hi), edgeCol: hexToRgb(P.edgeCol || '#ffffff'),
      face: R.face(item, item.key, ai, res),
      radius: sc.radius * Math.min(wi, hi), opacity: o0 * sc.opacity, blur: clamp01(blur0 + dBlur),
      shade: sh.on ? sh.amount : 0, border: sc.border,
      glare: ((L.glare || 0) + (sh.on && sh.sweep ? .35 : 0)) * (sh.on ? sh.glare : 0), glareP: L.glareP ?? (wrap(p, 1) * 2.8 - .8),
      backMix: sc.back === 'solid' ? 0 : 1, backCol: hexToRgb(sc.backColor), bright: (L.b ?? 1) * sc.brightness,
      tint: hexToRgb(sc.tint), tintA: sc.tintA,
      glassW: style.cardGlass.on ? style.cardGlass.width : 0, glassR: style.cardGlass.refraction, glassD: style.cardGlass.dispersion,
      crumple: L.crumple || 0, crSeed: L.crSeed ?? (k * .6180339 % 1),
    });
  }
  const s = style.shadow;
  desc.shadow = {on: s.on, alpha: s.alpha, soft: s.soft, offset: s.offset, color: hexToRgb(s.color)};
  desc.post = postDesc(style, p, T, opts.thumb);
  return desc;
}

// Bend: the template's own curve stays across the width; the Bend controls add to it on the chosen
// axis, plus an optional flex that bends each card back and forth over the loop
function bendFor(P, L, p, k){
  const flex = P.flex ? P.flex * Math.sin(TAU * (Math.round(P.flexSpeed) * p + k * (P.flexOffset ?? .25))) : 0;
  const extra = (P.bend || 0) + flex, ax = P.bendAxis || 'h';
  return {bend: (L.bend || 0) + (ax === 'v' ? 0 : extra), bendY: (L.bendY || 0) + (ax === 'h' ? 0 : extra)};
}
// Pose, Transform and Pan: one matrix for the whole composition (null when nothing is set)
function groupMatrix(P, p){
  const pan = Math.round(P.panSpeed) * p * TAU, x = (P.offX || 0) + (P.panX ? P.panX * Math.sin(pan) : 0), z = (P.offZ || 0) + (P.panZ ? P.panZ * Math.sin(pan + Math.PI / 2) - P.panZ : 0);
  const ry = (P.poseRy || 0) * D2R + (P.spin ? Math.round(P.spin) * p * TAU : 0), rx = (P.poseRx || 0) * D2R, rz = (P.poseRz || 0) * D2R, s = P.scale ?? 1;
  if (!x && !P.offY && !z && !rx && !ry && !rz && s === 1) return null;
  const m = mat4.model(x, P.offY || 0, z, rx, ry, rz, 1, 1);
  return s === 1 ? m : mat4.mul(m, mat4.scaling(s, s, s));
}
// Animation in: the order each card arrives in, as a slot number
function animOrder(P, n, E){
  const idx = Array.from({length: n}, (_, i) => i);
  if (P.animOrder === 'center') return idx.map(i => Math.abs(i - (n - 1) / 2));
  if (P.animOrder === 'random'){ const r = idx.map(i => E.rnd(i, 21)), sorted = idx.slice().sort((a, b) => r[a] - r[b]), slot = []; sorted.forEach((i, k) => slot[i] = k); return slot; }
  return idx;
}

/* ---------- text and logo overlay: centred title, corner labels, your logo ---------- */
// With style.anim on, each element animates in over the clip's first moments and out over its last, so the
// first and last frames match and the loop stays seamless. Elements start one after another: logo, title, labels.
const easeOut = t => t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3);
export const ANIMS = {fade: 'Fade', rise: 'Rise', pop: 'Pop', type: 'Type', slide: 'Slide'};
function animAt(st, T){
  const A = st.style.anim;
  if (!A?.on) return null;
  const len = clipLength(st), t = ((T % len) + len) % len, sp = A.speed || 1;
  const din = Math.min(.9, len * .18) / sp, dout = Math.min(.6, len * .12) / sp, gap = Math.min(.18, len * .03) / sp;
  return k => Math.min(easeOut((t - k * gap) / din), easeOut((len - t - (2 - k) * gap * .5) / dout));
}
let labelKey = '';
export function syncLabels(app, W, H, T = 0){
  const st = app.state, L = st.style.labels, Ti = st.style.title || {}, Lg = st.style.logo || {};
  const logo = Lg.on && Lg.id ? app.logos?.get(Lg.id) : null;
  if (!L.on && !Ti.on && !logo){ if (labelKey){ app.renderer.setLabels(null); labelKey = ''; } return; }
  const an = animAt(st, T), kind = st.style.anim?.kind || 'rise';
  const v = an ? [0, 1, 2].map(k => Math.round(an(k) * 400) / 400) : [1, 1, 1];
  const key = JSON.stringify([L, Ti, Lg, !!logo, v, kind, W, H, st.style.bg.c[0], st.style.bg.mode]);
  if (key === labelKey) return;
  labelKey = key;
  const c = app.labelCanvas || (app.labelCanvas = document.createElement('canvas'));
  if (c.width !== W || c.height !== H){ c.width = W; c.height = H; }
  const x = c.getContext('2d'), u = Math.min(W, H);
  x.clearRect(0, 0, W, H);
  // one element's animation: v = 0 hidden, 1 settled; (cx, cy) is the point it pops or scales around
  const enter = (a, cx, cy, dir = 1) => {
    if (a >= 1) return;
    x.globalAlpha *= kind === 'type' ? Math.min(1, a * 3) : a;
    if (kind === 'rise') x.translate(0, (1 - a) * u * .045 * dir);
    if (kind === 'slide') x.translate((1 - a) * -u * .06, 0);
    if (kind === 'pop'){ const s = .82 + .18 * a; x.translate(cx, cy); x.scale(s, s); x.translate(-cx, -cy); }
  };
  // typewriter: the share of the text shown so far
  const typed = (s, a) => kind === 'type' && a < 1 ? s.slice(0, Math.round(s.length * a)) : s;
  if (logo && v[0] > 0){
    const lw = u * (Lg.size || .14), lh = lw * (logo.height || 1) / (logo.width || 1), m = u * .045;
    const pos = Lg.pos || 'br', lx = pos === 'center' ? (W - lw) / 2 : pos.endsWith('l') ? m : W - m - lw;
    const ly = pos === 'center' ? (H - lh) / 2 : pos.startsWith('t') ? m : H - m - lh;
    x.save(); x.globalAlpha = Lg.opacity ?? 1; enter(v[0], lx + lw / 2, ly + lh / 2, pos.startsWith('t') ? -1 : 1); x.drawImage(logo, lx, ly, lw, lh); x.restore();
  }
  const dark = luminance(hexToRgb(st.style.bg.c[0])) < .5 && !st.style.bg.transparent;
  const ink = L.color && L.color !== 'auto' ? L.color : dark ? 'rgba(255,255,255,.62)' : 'rgba(25,25,28,.78)';
  // centred title, drawn over the cards
  if (Ti.on && Ti.text && v[1] > 0){
    x.save(); x.fillStyle = Ti.color || '#ffffff'; x.textAlign = 'center'; x.textBaseline = 'middle';
    const tf = u * .075 * (Ti.size || 1), ty = H * (Ti.y ?? .5);
    x.font = `${Ti.weight || 400} ${tf}px "${Ti.font || 'Inter'}"`; if ('letterSpacing' in x) x.letterSpacing = (-tf * .02) + 'px';
    enter(v[1], W / 2, ty); x.fillText(typed(Ti.text, v[1]), W / 2, ty); x.restore();
  }
  if (L.on && v[2] > 0){
    const m = Math.round(u * .035), fs = Math.max(9, u * .019 * (L.size || 1));
    x.save(); x.fillStyle = ink; x.textBaseline = 'middle'; enter(v[2], W / 2, H / 2);
    let lx = m; const ty = m + fs * .6, by = H - m - fs * .6;
    if (L.mark){ const r = fs * .8; x.beginPath(); x.arc(lx + r, ty, r, 0, TAU); x.fill(); x.save(); x.globalCompositeOperation = 'destination-out';
      x.beginPath(); x.moveTo(lx + r * .5, ty + r * .45); x.lineTo(lx + r * 1.5, ty + r * .45); x.lineTo(lx + r, ty - r * .5); x.closePath(); x.fill(); x.restore(); lx += r * 2 + fs * .5; }
    const head = L.font || 'Inter', mono = L.font || 'JetBrains Mono';
    x.font = `600 ${fs}px "${head}"`; x.textAlign = 'left'; x.fillText(typed((L.tl || '').toUpperCase(), v[2]), lx, ty);
    x.font = `400 ${fs}px "${mono}"`; if ('letterSpacing' in x) x.letterSpacing = (fs * .06) + 'px';
    x.textAlign = 'right'; x.fillText(typed((L.tr || '').toUpperCase(), v[2]), W - m, ty);
    x.textAlign = 'left'; x.fillText(typed((L.bl || '').toUpperCase(), v[2]), m, by);
    x.textAlign = 'right'; x.fillText(typed((L.br || '').toUpperCase(), v[2]), W - m, by);
    x.restore();
  }
  app.renderer.setLabels(c);
}
export const resetLabels = () => { labelKey = ''; };
