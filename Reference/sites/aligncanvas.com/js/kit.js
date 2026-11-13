// Shared building blocks for template layouts (templates.js and templates-x.js).
import { clamp01, wrap, mat4 } from './math.js';

export const rel = (i, u, n) => { let r = wrap(i - u, n); if (r > n / 2) r -= n; return r; };
// continuous position that holds on each card, then eases to the next
export const stepU = (p, n, hold, ez) => { const c = p * n, k = Math.floor(c), f = c - k; return k + ez(clamp01((f - hold) / Math.max(1e-3, 1 - hold))); };
export const stepSpeed = (p, n, hold, ez) => Math.abs(stepU(p + .002, n, hold, ez) - stepU(p - .002, n, hold, ez)) / .004 / n;
export const ab = Math.abs, sgn = v => v < 0 ? -1 : 1;
// rotate a point around the origin by rx (around X) then ry (around Y)
export function tiltPt(x, y, z, rx, ry){
  const cy = Math.cos(rx), sy = Math.sin(rx), y1 = y * cy - z * sy, z1 = y * sy + z * cy, cx = Math.cos(ry), sx = Math.sin(ry);
  return [x * cx + z1 * sx, y1, -x * sx + z1 * cx];
}
// cards fade out just before they wrap round, so no frame ever shows one jumping across
export const wrapFade = (r, n) => clamp01((n / 2 - ab(r)) * 1.5);
// frame fill: strips and grids keep enough slots to run past both frame edges at any scale (E.vx/E.vy
// is the visible half-size). Slots come in whole sets of `base` images, so the loop stays seamless.
export const fillSlots = (v, pitch, base, lanes = 1, cap = 240) => { const k = Math.ceil((2 * v / Math.max(.02, pitch) + 3) / base); return base * Math.max(1, Math.min(k, Math.floor(cap / (base * lanes)))); };
export const stripFill = (E, v, pitch) => { const m = fillSlots(v + Math.max(E.w, E.h), pitch, E.n); return {m, count: m}; };
export const laneFill = (E, v, pitch, lanes) => { const mb = Math.ceil(E.n / lanes), m = fillSlots(v + Math.max(E.w, E.h), pitch, mb, lanes); return {m, mb, count: m * lanes}; };
export const FILL_X = (P, E) => stripFill(E, E.vx, E.w * (1 + P.gap)), FILL_Y = (P, E) => stripFill(E, E.vy, E.h * (1 + P.gap));
export const M = (...ms) => ms.reduce((a, b) => mat4.mul(a, b));
export const T = (x, y, z) => mat4.translation(x, y, z);
export const RX = mat4.rotX, RY = mat4.rotY, RZ = mat4.rotZ, S = mat4.scaling;
// the (rx, ry) that turn a card's face (+z) toward direction f
export const aim = (fx, fy, fz) => ({ry: Math.atan2(fx, fz), rx: -Math.asin(Math.max(-1, Math.min(1, fy / (Math.hypot(fx, fy, fz) || 1))))});
// an even spread of n directions over a sphere
export const fibo = (i, n) => { const y = 1 - 2 * (i + .5) / n, r = Math.sqrt(Math.max(0, 1 - y * y)), a = i * 2.399963229728653; return [Math.cos(a) * r, y, Math.sin(a) * r]; };
// a card matrix from its centre, its width direction X and (roughly) its facing direction Z
export function frame3(px, py, pz, X, Z){
  let l = Math.hypot(X[0], X[1], X[2]) || 1; const x0 = X[0] / l, x1 = X[1] / l, x2 = X[2] / l;
  const d = Z[0] * x0 + Z[1] * x1 + Z[2] * x2; let z0 = Z[0] - d * x0, z1 = Z[1] - d * x1, z2 = Z[2] - d * x2;
  l = Math.hypot(z0, z1, z2) || 1; z0 /= l; z1 /= l; z2 /= l;
  const m = new Float32Array(16);
  m[0] = x0; m[1] = x1; m[2] = x2; m[4] = z1 * x2 - z2 * x1; m[5] = z2 * x0 - z0 * x2; m[6] = z0 * x1 - z1 * x0;
  m[8] = z0; m[9] = z1; m[10] = z2; m[12] = px; m[13] = py; m[14] = pz; m[15] = 1;
  return m;
}

export const P_HOLD = {key: 'hold', label: 'Hold', type: 'range', min: 0, max: .9, step: .01, def: .5};
export const P_EASE = {key: 'ease', label: 'Easing', type: 'select', options: {inOutQuint: 'Snappy', inOutCubic: 'Smooth', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', inOutBack: 'Anticipate', linear: 'Linear'}, def: 'inOutQuint'};
export const P_GAP = (def = .12) => ({key: 'gap', label: 'Gap', type: 'range', min: 0, max: .8, step: .01, def});
export const P_TILT = (def = .35, label = 'Camera tilt') => ({key: 'tilt', label, type: 'range', min: -1, max: 1.2, step: .01, def});
export const P_RADIUS = (def = 1) => ({key: 'radius', label: 'Radius', type: 'range', min: .4, max: 2.5, step: .01, def});
export const P_CURVE = (def = 1) => ({key: 'curve', label: 'Card curve', type: 'range', min: 0, max: 2, step: .01, def});
export const P_COLS = (def = 3, max = 6) => ({key: 'cols', label: 'Columns', type: 'range', min: 1, max, step: 1, def});
export const P_SPREAD = (def = 1) => ({key: 'spread', label: 'Spread', type: 'range', min: .2, max: 2, step: .01, def});
