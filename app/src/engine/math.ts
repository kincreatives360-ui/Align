/**
 * Math utilities ported from the reference math.js
 * Pure functions, no WebGL, no state.
 */

export const TAU = Math.PI * 2;
export const D2R = Math.PI / 180;

export function wrap(v: number, max: number): number {
  return ((v % max) + max) % max;
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Deterministic hash from integer seeds. */
export function hash(...seeds: number[]): number {
  let h = 0;
  for (const s of seeds) {
    h = (h + (s | 0)) | 0;
    h = (h + ((h << 10) >>> 0)) | 0;
    h ^= (h >>> 6);
  }
  h = (h + ((h << 3) >>> 0)) | 0;
  h ^= (h >>> 11);
  h = (h + ((h << 15) >>> 0)) | 0;
  return (h >>> 0) / 4294967296;
}

/** Mulberry32 PRNG for seeded randomness. */
export function mulberry(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** Easing curves. */
export const ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 + --t * t * t,
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  inQuart: (t: number) => t * t * t * t,
  outQuart: (t: number) => 1 - --t * t * t * t,
  inOutQuart: (t: number) => (t < 0.5 ? 8 * t * t * t * t : 1 - 8 * --t * t * t * t),
  inQuint: (t: number) => t * t * t * t * t,
  outQuint: (t: number) => 1 + --t * t * t * t * t,
  inOutQuint: (t: number) =>
    t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * --t * t * t * t * t,
  inSine: (t: number) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t: number) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))),
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t: number) =>
    t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  inCirc: (t: number) => 1 - Math.sqrt(1 - t * t),
  outCirc: (t: number) => Math.sqrt(1 - --t * t),
  inOutCirc: (t: number) =>
    t < 0.5
      ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
      : (Math.sqrt(1 - (-2 * t + 2) ** 2) + 1) / 2,
  inBack: (t: number) => t * t * (2.70158 * t - 1.70158),
  outBack: (t: number) => 1 + --t * t * (2.70158 * t + 1.70158),
  inOutBack: (t: number) =>
    t < 0.5
      ? (t * t * (7 * t - 2.5)) * 2
      : (t * t * (7 * t - 4.5) + 1) * 2,
};

/** Convert hex colour to [r, g, b] in 0..1. */
export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return [r, g, b];
}

/** Luminance of an RGB triplet. */
export function luminance(rgb: [number, number, number]): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

/** 4x4 column-major matrix helpers. */
export const mat4 = {
  identity(): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  mul(a: Float32Array, b: Float32Array): Float32Array {
    const out = new Float32Array(16);
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) {
          sum += a[k * 4 + i] * b[j * 4 + k];
        }
        out[j * 4 + i] = sum;
      }
    }
    return out;
  },

  translation(x: number, y: number, z: number): Float32Array {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      x, y, z, 1,
    ]);
  },

  scaling(x: number, y: number, z: number): Float32Array {
    return new Float32Array([
      x, 0, 0, 0,
      0, y, 0, 0,
      0, 0, z, 0,
      0, 0, 0, 1,
    ]);
  },

  rotX(rad: number): Float32Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      1, 0, 0, 0,
      0, c, s, 0,
      0, -s, c, 0,
      0, 0, 0, 1,
    ]);
  },

  rotY(rad: number): Float32Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      c, 0, -s, 0,
      0, 1, 0, 0,
      s, 0, c, 0,
      0, 0, 0, 1,
    ]);
  },

  rotZ(rad: number): Float32Array {
    const c = Math.cos(rad);
    const s = Math.sin(rad);
    return new Float32Array([
      c, s, 0, 0,
      -s, c, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1,
    ]);
  },

  model(
    x: number,
    y: number,
    z: number,
    rx: number,
    ry: number,
    rz: number,
    sx: number,
    sy: number
  ): Float32Array {
    const m = mat4.identity();
    mat4.mulInPlace(m, mat4.translation(x, y, z));
    if (rx) mat4.mulInPlace(m, mat4.rotX(rx));
    if (ry) mat4.mulInPlace(m, mat4.rotY(ry));
    if (rz) mat4.mulInPlace(m, mat4.rotZ(rz));
    if (sx !== 1 || sy !== 1) mat4.mulInPlace(m, mat4.scaling(sx, sy, 1));
    return m;
  },

  mulInPlace(a: Float32Array, b: Float32Array): void {
    const out = mat4.mul(a, b);
    a.set(out);
  },

  transform(m: Float32Array, x: number, y: number, z: number): Float32Array {
    return new Float32Array([
      m[0] * x + m[4] * y + m[8] * z + m[12],
      m[1] * x + m[5] * y + m[9] * z + m[13],
      m[2] * x + m[6] * y + m[10] * z + m[14],
      m[3] * x + m[7] * y + m[11] * z + m[15],
    ]);
  },

  perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1 / Math.tan(fov / 2);
    const out = new Float32Array(16);
    out[0] = f / aspect;
    out[5] = f;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
  },

  lookAt(
    eye: [number, number, number],
    target: [number, number, number],
    up: [number, number, number] = [0, 1, 0]
  ): Float32Array {
    const f = [
      target[0] - eye[0],
      target[1] - eye[1],
      target[2] - eye[2],
    ];
    const fl = Math.hypot(f[0], f[1], f[2]);
    const fx = f[0] / fl;
    const fy = f[1] / fl;
    const fz = f[2] / fl;

    // right = forward x up. This was written as up x forward, which points LEFT,
    // so the whole scene rendered mirrored (backwards text, back faces showing).
    const s = [
      fy * up[2] - fz * up[1],
      fz * up[0] - fx * up[2],
      fx * up[1] - fy * up[0],
    ];
    const sl = Math.hypot(s[0], s[1], s[2]);
    const sx = s[0] / sl;
    const sy = s[1] / sl;
    const sz = s[2] / sl;

    // true up = right x forward
    const u = [
      sy * fz - sz * fy,
      sz * fx - sx * fz,
      sx * fy - sy * fx,
    ];

    return new Float32Array([
      sx, u[0], -fx, 0,
      sy, u[1], -fy, 0,
      sz, u[2], -fz, 0,
      -(sx * eye[0] + sy * eye[1] + sz * eye[2]),
      -(u[0] * eye[0] + u[1] * eye[1] + u[2] * eye[2]),
      fx * eye[0] + fy * eye[1] + fz * eye[2],
      1,
    ]);
  },
};

export type Vec3 = [number, number, number];

/** Standalone lookAt function for convenience. */
export function lookAt(
  eye: Vec3,
  target: Vec3,
  up: Vec3 = [0, 1, 0]
): Float32Array {
  return mat4.lookAt(eye, target, up);
}