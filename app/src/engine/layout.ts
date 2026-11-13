import type { CardPose, Env, P } from '../templates/types';
import { mat4, TAU, D2R, clamp01, ease } from './math';

/**
 * Layout utilities for computing per-card poses.
 * Ported from the reference engine.js layout logic.
 */

/** Get numeric value from ParamValue. */
function num(v: any, def = 0): number {
  return typeof v === 'number' ? v : def;
}

/** Compute the group matrix for pose/transform/pan. */
export function groupMatrix(P: P, p: number): Float32Array | null {
  const pan = Math.round(num(P.panSpeed)) * p * TAU;
  const x = num(P.offX) + (num(P.panX) ? num(P.panX) * Math.sin(pan) : 0);
  const z = num(P.offZ) + (num(P.panZ) ? num(P.panZ) * Math.sin(pan + Math.PI / 2) - num(P.panZ) : 0);

  const ry = num(P.poseRy) * D2R + (num(P.spin) ? Math.round(num(P.spin)) * p * TAU : 0);
  const rx = num(P.poseRx) * D2R;
  const rz = num(P.poseRz) * D2R;
  const s = num(P.scale, 1);

  if (!x && !num(P.offY) && !z && !rx && !ry && !rz && s === 1) return null;

  const m = mat4.model(x, num(P.offY), z, rx, ry, rz, 1, 1);
  return s === 1 ? m : mat4.mul(m, mat4.scaling(s, s, s));
}

/** Compute bend values for a card. */
export function bendFor(P: P, L: CardPose, p: number, k: number): { bend: number; bendY: number } {
  const flex = num(P.flex) ? num(P.flex) * Math.sin(TAU * (Math.round(num(P.flexSpeed)) * p + k * (num(P.flexOffset, 0.25)))) : 0;
  const extra = num(P.bend) + flex;
  const ax = typeof P.bendAxis === 'string' && P.bendAxis ? P.bendAxis : 'h';
  return {
    bend: (num(L.bend) || 0) + (ax === 'v' ? 0 : extra),
    bendY: (num(L.bendY) || 0) + (ax === 'h' ? 0 : extra),
  };
}

/** Animation in order. */
export function animOrder(P: P, n: number, E: Env): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (String(P.animOrder) === 'center') return idx.map(i => Math.abs(i - (n - 1) / 2));
  if (String(P.animOrder) === 'random') {
    const r = idx.map(i => E.rnd(i, 21));
    const sorted = idx.slice().sort((a, b) => r[a] - r[b]);
    const slot: number[] = [];
    sorted.forEach((i, k) => { slot[i] = k; });
    return slot;
  }
  return idx;
}

/**
 * Apply animation-in effects to a card.
 * Returns { o0, blur0, ay, dz, local, sc0 }
 */
export function applyAnimIn(
  P: P,
  k: number,
  Tc: number,
  n: number,
  E: Env,
  o0: number,
  blur0: number,
  sc0: number
): { o0: number; blur0: number; ay: number; dz: number; local: Float32Array | null; sc0: number } {
  if (!num(P.animIn)) return { o0, blur0, ay: 0, dz: 0, local: null, sc0 };

  const anim = animOrder(P, n, E);
  const aEase = ease[(String(P.animEase) as keyof typeof ease) || 'outQuint'] || ease.outQuint;
  const e = aEase(clamp01((Tc - anim[k % n] * num(P.animStagger)) / Math.max(0.01, num(P.animDur))));
  const q = 1 - e;
  const st2 = String(P.animStyle);

  let local: Float32Array | null = null;
  let ay = 0;
  let dz = 0;

  if (st2 === 'fade') o0 *= e;
  else if (st2 === 'rise') ay = -q * 1.1;
  else if (st2 === 'fall') ay = q * 1.6;
  else if (st2 === 'fly') dz += -q * 5;
  else if (st2 === 'scale') sc0 *= 0.35 + 0.65 * e;
  else if (st2 === 'spin') {
    local = mat4.rotY(q * Math.PI);
    sc0 *= 0.7 + 0.3 * e;
  }
  else if (st2 === 'pop') o0 *= clamp01(e * 2.2);
  blur0 += q * 0.5;

  return { o0, blur0, ay, dz, local, sc0 };
}

/** Apply per-card tilt (rx, ry, rz). */
export function applyTilt(P: P, k: number, E: Env, p: number): { tx: number; ty: number; tz: number } {
  const tx = num(P.tiltX) +
    (num(P.tiltRand) ? (E.rnd(k, 11) - 0.5) * 2 * num(P.tiltRand) : 0) +
    (num(P.tiltSway) ? Math.sin(TAU * Math.round(num(P.swaySpeed)) * p + k * 1.3) * num(P.tiltSway) : 0);

  const ty = num(P.tiltY) +
    (num(P.tiltRand) ? (E.rnd(k, 12) - 0.5) * 2 * num(P.tiltRand) : 0) +
    (num(P.tiltSway) ? Math.cos(TAU * Math.round(num(P.swaySpeed)) * p + k * 1.3) * num(P.tiltSway) * 0.6 : 0);

  const tz = num(P.tiltZ) +
    (num(P.tiltRand) ? (E.rnd(k, 13) - 0.5) * 2 * num(P.tiltRand) : 0);

  return { tx, ty, tz };
}

/** Apply shape (ramp, stagger). */
export function applyShape(P: P, k: number, n: number, h: number): { sY: number; sZ: number } {
  const odd = k % 2 ? 1 : -1;
  const sY = (num(P.ramp) ? num(P.ramp) * (n > 1 ? k / (n - 1) - 0.5 : 0) * h * 2 : 0) +
    (num(P.staggerY) ? odd * num(P.staggerY) * h * 0.5 : 0);
  const sZ = num(P.staggerZ) ? odd * num(P.staggerZ) * 0.5 : 0;
  return { sY, sZ };
}

/** Apply card spin. */
export function applySpin(P: P, k: number, p: number): number {
  return num(P.cardSpin) ? Math.round(num(P.cardSpin)) * p * TAU + (num(P.spinOffset) || 0) * k * TAU : 0;
}

/** Apply wave displacement. */
export function applyWave(P: P, px: number, py: number, p: number): { dz: number; ay: number; wave: Float32Array | null } {
  if (!num(P.waveDepth)) return { dz: 0, ay: 0, wave: null };

  const ripple = String(P.waveStyle) === 'ripple';
  const u = ripple ? Math.hypot(px, py) : String(P.waveDir) === 'v' ? py : px;
  const kf = (num(P.waveFreq) || 1) * Math.PI;
  const arg = u * kf - TAU * Math.round(num(P.waveSpeed)) * p;
  const A = num(P.waveDepth) * 0.5;
  const dz = A * Math.sin(arg);
  const slope = Math.atan(A * kf * Math.cos(arg)) * 0.8;

  let wave: Float32Array | null = null;
  if (ripple) {
    const d = Math.hypot(px, py) || 1;
    wave = mat4.mul(mat4.rotY(-slope * px / d), mat4.rotX(slope * py / d));
  } else {
    wave = String(P.waveDir) === 'v' ? mat4.rotX(slope) : mat4.rotY(-slope);
  }

  const ay = ripple ? 0 : (String(P.waveDir) === 'v' ? slope : 0);
  return { dz, ay, wave };
}

/** Apply displacement (dispZ, dispY). */
export function applyDisplacement(P: P, p: number, k: number): { dz: number; ay: number } {
  let dz = 0;
  let ay = 0;
  if (num(P.dispZ)) dz += num(P.dispZ) * Math.sin(TAU * (Math.round(num(P.dispSpeed)) * p + k * (num(P.dispOffset) || 0)));
  if (num(P.dispY)) ay += num(P.dispY) * Math.sin(TAU * (Math.round(num(P.dispSpeed)) * p + k * (num(P.dispOffset) || 0) + 0.25));
  return { dz, ay };
}