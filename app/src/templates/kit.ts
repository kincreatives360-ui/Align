import { clamp01, wrap, TAU, ease, mat4 } from '../engine/math';
import type { ParamValue } from '../state/types';

export { TAU, ease, wrap, clamp01 };

/** Safely extract a number from ParamValue. */
export function num(v: ParamValue | undefined, def = 0): number {
  return typeof v === 'number' ? v : def;
}

/** Safely extract a string from ParamValue. */
export function str(v: ParamValue | undefined, def = ''): string {
  return typeof v === 'string' ? v : def;
}

/** Safely extract a boolean from ParamValue. */
export function bool(v: ParamValue | undefined, def = false): boolean {
  return typeof v === 'boolean' ? v : def;
}

/** Relative index that wraps and centers around 0. */
export function rel(i: number, u: number, n: number): number {
  let r = wrap(i - u, n);
  if (r > n / 2) r -= n;
  return r;
}

/** Continuous position that holds on each card, then eases to the next. */
export function stepU(p: number, n: number, hold: number, ez: (t: number) => number): number {
  const c = p * n;
  const k = Math.floor(c);
  const f = c - k;
  return k + ez(clamp01((f - hold) / Math.max(1e-3, 1 - hold)));
}

/** Speed of the stepped motion. */
export function stepSpeed(p: number, n: number, hold: number, ez: (t: number) => number): number {
  return Math.abs(stepU(p + 0.002, n, hold, ez) - stepU(p - 0.002, n, hold, ez)) / 0.004 / n;
}

/** Cards fade out just before they wrap round. */
export function wrapFade(r: number, n: number): number {
  return clamp01((n / 2 - Math.abs(r)) * 1.5);
}

/** Frame fill helpers. */
export function fillSlots(v: number, pitch: number, base: number, lanes = 1, cap = 240): number {
  const k = Math.ceil((2 * v / Math.max(0.02, pitch) + 3) / base);
  return base * Math.max(1, Math.min(k, Math.floor(cap / (base * lanes))));
}

export function stripFill(E: any, v: number, pitch: number): { m: number; count: number } {
  const m = fillSlots(v + Math.max(E.w, E.h), pitch, E.n);
  return { m, count: m };
}

export function laneFill(E: any, v: number, pitch: number, lanes: number): { m: number; mb: number; count: number } {
  const mb = Math.ceil(E.n / lanes);
  const m = fillSlots(v + Math.max(E.w, E.h), pitch, mb, lanes);
  return { m, mb, count: m * lanes };
}

export const FILL_X = (P: any, E: any) => stripFill(E, E.vx, E.w * (1 + (P.gap ?? 0)));
export const FILL_Y = (P: any, E: any) => stripFill(E, E.vy, E.h * (1 + (P.gap ?? 0)));

/** Matrix multiply chain. */
export function M(...ms: Float32Array[]): Float32Array {
  return ms.reduce((a, b) => mat4.mul(a, b));
}

export function T(x: number, y: number, z: number): Float32Array {
  return mat4.translation(x, y, z);
}

export function RX(rad: number): Float32Array {
  return mat4.rotX(rad);
}

export function RY(rad: number): Float32Array {
  return mat4.rotY(rad);
}

export function RZ(rad: number): Float32Array {
  return mat4.rotZ(rad);
}

/** Scale a matrix along its three axes. */
export function S(x: number, y: number, z: number): Float32Array {
  return mat4.scaling(x, y, z);
}

/** Rotations that turn a card's +Z face toward the given direction. */
export function aim(fx: number, fy: number, fz: number): { rx: number; ry: number } {
  return {
    ry: Math.atan2(fx, fz),
    rx: -Math.asin(Math.max(-1, Math.min(1, fy / (Math.hypot(fx, fy, fz) || 1)))),
  };
}

/** An even spread of directions over a sphere. */
export function fibo(i: number, n: number): [number, number, number] {
  const y = 1 - 2 * (i + 0.5) / n;
  const r = Math.sqrt(Math.max(0, 1 - y * y));
  const a = i * 2.399963229728653;
  return [Math.cos(a) * r, y, Math.sin(a) * r];
}

/** Build a card matrix from its centre, width direction X, and facing direction Z. */
export function frame3(
  px: number,
  py: number,
  pz: number,
  X: [number, number, number],
  Z: [number, number, number],
): Float32Array {
  let l = Math.hypot(X[0], X[1], X[2]) || 1;
  const x0 = X[0] / l;
  const x1 = X[1] / l;
  const x2 = X[2] / l;
  const d = Z[0] * x0 + Z[1] * x1 + Z[2] * x2;
  let z0 = Z[0] - d * x0;
  let z1 = Z[1] - d * x1;
  let z2 = Z[2] - d * x2;
  l = Math.hypot(z0, z1, z2) || 1;
  z0 /= l;
  z1 /= l;
  z2 /= l;
  const m = new Float32Array(16);
  m[0] = x0;
  m[1] = x1;
  m[2] = x2;
  m[4] = z1 * x2 - z2 * x1;
  m[5] = z2 * x0 - z0 * x2;
  m[6] = z0 * x1 - z1 * x0;
  m[8] = z0;
  m[9] = z1;
  m[10] = z2;
  m[12] = px;
  m[13] = py;
  m[14] = pz;
  m[15] = 1;
  return m;
}

/** Parameter helpers. */
export const P_HOLD = { key: 'hold', label: 'Hold', type: 'range', min: 0, max: 0.9, step: 0.01, def: 0.5 };
export const P_EASE = {
  key: 'ease',
  label: 'Easing',
  type: 'select',
  options: {
    inOutQuint: 'Snappy',
    inOutCubic: 'Smooth',
    inOutExpo: 'Expo',
    inOutSine: 'Gentle',
    outBack: 'Overshoot',
    inOutBack: 'Anticipate',
    linear: 'Linear',
  },
  def: 'inOutQuint',
};
export const P_GAP = (def = 0.12) => ({ key: 'gap', label: 'Gap', type: 'range', min: 0, max: 0.8, step: 0.01, def });
export const P_TILT = (def = 0.35, label = 'Camera tilt') => ({ key: 'tilt', label, type: 'range', min: -1, max: 1.2, step: 0.01, def });
export const P_RADIUS = (def = 1) => ({ key: 'radius', label: 'Radius', type: 'range', min: 0.4, max: 2.5, step: 0.01, def });
export const P_CURVE = (def = 1) => ({ key: 'curve', label: 'Card curve', type: 'range', min: 0, max: 2, step: 0.01, def });
export const P_COLS = (def = 3, max = 6) => ({ key: 'cols', label: 'Columns', type: 'range', min: 1, max, step: 1, def });
export const P_SPREAD = (def = 1) => ({ key: 'spread', label: 'Spread', type: 'range', min: 0.2, max: 2, step: 0.01, def });

/** Helper: abs, sgn, lerp. */
export const ab = Math.abs;
export const sgn = (v: number) => (v < 0 ? -1 : 1);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tilt a point around X then Y. */
export function tiltPt(x: number, y: number, z: number, rx: number, ry: number): [number, number, number] {
  const cy = Math.cos(rx), sy = Math.sin(rx);
  const y1 = y * cy - z * sy;
  const z1 = y * sy + z * cy;
  const cx = Math.cos(ry), sx = Math.sin(ry);
  return [x * cx + z1 * sx, y1, -x * sx + z1 * cx];
}

/** Tilt a point around X then Y (reference version: ry then rx). */
export function tiltPtRef(x: number, y: number, z: number, rx: number, ry: number): [number, number, number] {
  const cy = Math.cos(rx), sy = Math.sin(rx);
  const y1 = y * cy - z * sy;
  const z1 = y * sy + z * cy;
  const cx = Math.cos(ry), sx = Math.sin(ry);
  return [x * cx + z1 * sx, y1, -x * sx + z1 * cx];
}