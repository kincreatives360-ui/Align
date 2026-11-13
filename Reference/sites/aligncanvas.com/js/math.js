// Small math kit: scalars, easing, deterministic noise and 4x4 matrices (column-major, like GLSL).

export const TAU = Math.PI * 2;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const clamp01 = v => Math.max(0, Math.min(1, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const fract = v => v - Math.floor(v);
export const sstep = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };
export const smoother = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * t * (t * (t * 6 - 15) + 10); };
export const wrap = (v, n) => ((v % n) + n) % n;
// signed distance between two phases on a loop of length n, in (-n/2, n/2]
export const loopDelta = (a, b, n) => { let d = wrap(a - b, n); if (d > n / 2) d -= n; return d; };

export const ease = {
  linear: t => t,
  inSine: t => 1 - Math.cos((t * Math.PI) / 2),
  outSine: t => Math.sin((t * Math.PI) / 2),
  inOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  inOutQuart: t => t < .5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2,
  inOutQuint: t => t < .5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  outExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  inOutExpo: t => t === 0 ? 0 : t === 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2,
  outBack: t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutBack: t => { const c = 1.70158 * 1.525; return t < .5 ? (Math.pow(2 * t, 2) * ((c + 1) * 2 * t - c)) / 2 : (Math.pow(2 * t - 2, 2) * ((c + 1) * (t * 2 - 2) + c) + 2) / 2; },
  outElastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (TAU / 3)) + 1,
};
export const EASE_NAMES = {
  inOutCubic: 'Smooth', inOutQuint: 'Snappy', inOutExpo: 'Expo', inOutSine: 'Gentle', outBack: 'Overshoot', outElastic: 'Elastic', linear: 'Linear',
};

// deterministic hash → [0,1)
export function hash(a, b = 0, c = 0){
  let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
export function mulberry(seed){
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ---------- mat4 ---------- */
export const mat4 = {
  identity(){ const m = new Float32Array(16); m[0] = m[5] = m[10] = m[15] = 1; return m; },
  perspective(fovY, aspect, near, far){
    const f = 1 / Math.tan(fovY / 2), nf = 1 / (near - far), m = new Float32Array(16);
    m[0] = f / aspect; m[5] = f; m[10] = (far + near) * nf; m[11] = -1; m[14] = 2 * far * near * nf;
    return m;
  },
  mul(a, b){
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++){
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
    }
    return o;
  },
  translation(x, y, z){ const m = mat4.identity(); m[12] = x; m[13] = y; m[14] = z; return m; },
  scaling(x, y, z){ const m = mat4.identity(); m[0] = x; m[5] = y; m[10] = z; return m; },
  rotX(a){ const m = mat4.identity(), c = Math.cos(a), s = Math.sin(a); m[5] = c; m[6] = s; m[9] = -s; m[10] = c; return m; },
  rotY(a){ const m = mat4.identity(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[2] = -s; m[8] = s; m[10] = c; return m; },
  rotZ(a){ const m = mat4.identity(), c = Math.cos(a), s = Math.sin(a); m[0] = c; m[1] = s; m[4] = -s; m[5] = c; return m; },
  // model = T · Ry · Rx · Rz · S  (yaw, then pitch, then roll)
  model(x, y, z, rx, ry, rz, sx, sy){
    let m = mat4.translation(x, y, z);
    if (ry) m = mat4.mul(m, mat4.rotY(ry));
    if (rx) m = mat4.mul(m, mat4.rotX(rx));
    if (rz) m = mat4.mul(m, mat4.rotZ(rz));
    if (sx !== 1 || sy !== 1) m = mat4.mul(m, mat4.scaling(sx, sy, 1));
    return m;
  },
  transform(m, x, y, z){
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w, (m[2] * x + m[6] * y + m[10] * z + m[14]) / w];
  },
};

const v3 = {
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
};
export function lookAt(eye, target, up = [0, 1, 0]){
  const z = v3.norm(v3.sub(eye, target)), x = v3.norm(v3.cross(up, z)), y = v3.cross(z, x), m = new Float32Array(16);
  m[0] = x[0]; m[4] = x[1]; m[8] = x[2]; m[12] = -v3.dot(x, eye);
  m[1] = y[0]; m[5] = y[1]; m[9] = y[2]; m[13] = -v3.dot(y, eye);
  m[2] = z[0]; m[6] = z[1]; m[10] = z[2]; m[14] = -v3.dot(z, eye);
  m[15] = 1; return m;
}

export function hexToRgb(h){
  h = (h || '#000').replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
export const rgbToHex = c => '#' + c.map(v => Math.round(clamp01(v) * 255).toString(16).padStart(2, '0')).join('');
export const luminance = c => .299 * c[0] + .587 * c[1] + .114 * c[2];
export const mixRgb = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
