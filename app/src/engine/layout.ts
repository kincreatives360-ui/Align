import type { CardPose, Env, P } from '../templates/types';
import { mat4, wrap, clamp01, ease, D2R, TAU, hexToRgb } from './math';
import { deterministicRnd } from './random';

/**
 * Layout utilities for computing per-card poses.
 * Ported from the reference engine.js layout logic.
 */

/** Compute the group matrix for pose/transform/pan. */
export function groupMatrix(P: P, p: number): Float32Array | null {
  const pan = Math.round(P.panSpeed || 0) * p * TAU;
  const x = (P.offX || 0) + (P.panX ? P.panX * Math.sin(pan) : 0);
  const z = (P.offZ || 0) + (P.panZ ? P.panZ * Math.sin(pan + Math.PI / 2) - P.panZ : 0);

  const ry = (P.poseRy || 0) * D2R + (P.spin ? Math.round(P.spin) * p * TAU : 0);
  const rx = (P.poseRx || 0) * D2R;
  const rz = (P.poseRz || 0) * D2R;
  const s = P.scale ?? 1;

  if (!x && !P.offY && !z && !rx && !ry && !rz && s === 1) return null;

  const m = mat4.model(x, P.offY || 0, z, rx, ry, rz, 1, 1);
  return s === 1 ? m : mat4.mul(m, mat4.scaling(s, s, s));
}

/** Compute bend values for a card. */
export function bendFor(P: P, L: CardPose, p: number, k: number): { bend: number; bendY: number } {
  const flex = P.flex ? P.flex * Math.sin(TAU * (Math.round(P.flexSpeed || 0) * p + k * (P.flexOffset ?? 0.25))) : 0;
  const extra = (P.bend || 0) + flex;
  const ax = P.bendAxis || 'h';
  return {
    bend: (L.bend || 0) + (ax === 'v' ? 0 : extra),
    bendY: (L.bendY || 0) + (ax === 'h' ? 0 : extra),
  };
}

/** Animation in order. */
export function animOrder(P: P, n: number, E: Env): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  if (P.animOrder === 'center') return idx.map(i => Math.abs(i - (n - 1) / 2));
  if (P.animOrder === 'random') {
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
  if (!P.animIn) return { o0, blur0, ay: 0, dz: 0, local: null, sc0 };

  const anim = animOrder(P, n, E);
  const aEase = ease[P.animEase as keyof typeof ease] || ease.outQuint;
  const e = aEase(clamp01((Tc - anim[k % n] * (P.animStagger || 0)) / Math.max(0.01, P.animDur || 1)));
  const q = 1 - e;
  const st2 = P.animStyle;

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
  const tx = (P.tiltX || 0) +
    (P.tiltRand ? (E.rnd(k, 11) - 0.5) * 2 * P.tiltRand : 0) +
    (P.tiltSway ? Math.sin(TAU * Math.round(P.swaySpeed || 0) * p + k * 1.3) * P.tiltSway : 0);

  const ty = (P.tiltY || 0) +
    (P.tiltRand ? (E.rnd(k, 12) - 0.5) * 2 * P.tiltRand : 0) +
    (P.tiltSway ? Math.cos(TAU * Math.round(P.swaySpeed || 0) * p + k * 1.3) * P.tiltSway * 0.6 : 0);

  const tz = (P.tiltZ || 0) +
    (P.tiltRand ? (E.rnd(k, 13) - 0.5) * 2 * P.tiltRand : 0);

  return { tx, ty, tz };
}

/** Apply shape (ramp, stagger). */
export function applyShape(P: P, k: number, n: number, h: number): { sY: number; sZ: number } {
  const odd = k % 2 ? 1 : -1;
  const sY = (P.ramp ? P.ramp * (n > 1 ? k / (n - 1) - 0.5 : 0) * h * 2 : 0) +
    (P.staggerY ? odd * P.staggerY * h * 0.5 : 0);
  const sZ = P.staggerZ ? odd * P.staggerZ * 0.5 : 0;
  return { sY, sZ };
}

/** Apply card spin. */
export function applySpin(P: P, k: number, p: number): number {
  return P.cardSpin ? Math.round(P.cardSpin) * p * TAU + (P.spinOffset || 0) * k * TAU : 0;
}

/** Apply wave displacement. */
export function applyWave(P: P, px: number, py: number, p: number, k: number): { dz: number; ay: number; wave: Float32Array | null } {
  if (!P.waveDepth) return { dz: 0, ay: 0, wave: null };

  const ripple = P.waveStyle === 'ripple';
  const u = ripple ? Math.hypot(px, py) : P.waveDir === 'v' ? py : px;
  const kf = (P.waveFreq || 1) * Math.PI;
  const arg = u * kf - TAU * Math.round(P.waveSpeed || 0) * p;
  const A = (P.waveDepth || 0) * 0.5;
  const dz = A * Math.sin(arg);
  const slope = Math.atan(A * kf * Math.cos(arg)) * 0.8;

  let wave: Float32Array | null = null;
  if (ripple) {
    const d = Math.hypot(px, py) || 1;
    wave = mat4.mul(mat4.rotY(-slope * px / d), mat4.rotX(slope * py / d));
  } else {
    wave = P.waveDir === 'v' ? mat4.rotX(slope) : mat4.rotY(-slope);
  }

  const ay = ripple ? 0 : (P.waveDir === 'v' ? slope : 0);
  return { dz, ay, wave };
}

/** Apply displacement (dispZ, dispY). */
export function applyDisplacement(P: P, p: number, k: number): { dz: number; ay: number } {
  let dz = 0;
  let ay = 0;
  if (P.dispZ) dz += P.dispZ * Math.sin(TAU * (Math.round(P.dispSpeed || 0) * p + k * (P.dispOffset || 0)));
  if (P.dispY) ay += P.dispY * Math.sin(TAU * (Math.round(P.dispSpeed || 0) * p + k * (P.dispOffset || 0) + 0.25));
  return { dz, ay };
}