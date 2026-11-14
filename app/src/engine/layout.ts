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

/* ------------------------------------------------------------------ */
/* Labels, title, logo rendering                                      */
/* ------------------------------------------------------------------ */

import type { ProjectState } from '../state/types';
import { Renderer } from '../render/Renderer';
import { hexToRgb } from './math';

let labelKey = '';

interface SyncLabelsApp {
  state: ProjectState;
  logos: Map<string, HTMLImageElement>;
  labelCanvas: HTMLCanvasElement | null;
  renderer: Renderer;
}

function luminance(rgb: number[]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

export function syncLabels(app: SyncLabelsApp, W: number, H: number, _T = 0): void {
  const st = app.state;
  const L = st.style.labels;
  const Ti = st.style.title;
  const Lg = st.style.logo;
  const logo = Lg.on && Lg.id ? app.logos?.get(Lg.id) : null;
  
  if (!L.on && !Ti.on && !logo) {
    if (labelKey) {
      app.renderer.setLabels(null);
      labelKey = '';
    }
    return;
  }
  
  // Simple animation progress (0 to 1)
  const kind = st.style.anim?.kind || 'rise';
  const v = [1, 1, 1];
  
  const bgColor = st.style.bg.c[0];
  const bgMode = st.style.bg.mode;
  const key = JSON.stringify([L, Ti, Lg, !!logo, v, kind, W, H, bgColor, bgMode]);
  
  if (key === labelKey) return;
  labelKey = key;
  
  if (!app.labelCanvas) app.labelCanvas = document.createElement('canvas');
  const c = app.labelCanvas;
  if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
  
  const x = c.getContext('2d')!;
  const u = Math.min(W, H);
  x.clearRect(0, 0, W, H);
  
  const enter = (a: number, cx: number, cy: number, dir = 1) => {
    if (a >= 1) return;
    x.globalAlpha *= kind === 'type' ? Math.min(1, a * 3) : a;
    if (kind === 'rise') x.translate(0, (1 - a) * u * 0.045 * dir);
    if (kind === 'slide') x.translate((1 - a) * -u * 0.06, 0);
    if (kind === 'pop') { const s = 0.82 + 0.18 * a; x.translate(cx, cy); x.scale(s, s); x.translate(-cx, -cy); }
  };
  
  const typed = (s: string, a: number) => kind === 'type' && a < 1 ? s.slice(0, Math.round(s.length * a)) : s;
  
  if (logo && v[0] > 0) {
    const lw = u * (Lg.size || 0.14);
    const lh = lw * (logo.height || 1) / (logo.width || 1);
    const m = u * 0.045;
    const pos = Lg.pos || 'br';
    const lx = pos === 'center' ? (W - lw) / 2 : pos.endsWith('l') ? m : W - m - lw;
    const ly = pos === 'center' ? (H - lh) / 2 : pos.startsWith('t') ? m : H - m - lh;
    x.save();
    x.globalAlpha = Lg.opacity ?? 1;
    enter(v[0], lx + lw / 2, ly + lh / 2, pos.startsWith('t') ? -1 : 1);
    x.drawImage(logo, lx, ly, lw, lh);
    x.restore();
  }
  
  const dark = luminance(hexToRgb(bgColor)) < 0.5 && !st.style.bg.transparent;
  const ink = L.color && L.color !== 'auto' ? L.color : dark ? 'rgba(255,255,255,.62)' : 'rgba(25,25,28,.78)';
  
  if (Ti.on && Ti.text && v[1] > 0) {
    x.save();
    x.fillStyle = Ti.color || '#ffffff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const tf = u * 0.075 * (Ti.size || 1);
    const ty = H * (Ti.y ?? 0.5);
    x.font = `${Ti.weight || 400} ${tf}px "${Ti.font || 'Inter'}"`;
    if ('letterSpacing' in x) (x as any).letterSpacing = (-tf * 0.02) + 'px';
    enter(v[1], W / 2, ty);
    x.fillText(typed(Ti.text, v[1]), W / 2, ty);
    x.restore();
  }
  
  if (L.on && v[2] > 0) {
    const m = Math.round(u * 0.035);
    const fs = Math.max(9, u * 0.019 * (L.size || 1));
    x.save();
    x.fillStyle = ink;
    x.textBaseline = 'middle';
    enter(v[2], W / 2, H / 2);
    let lx = m;
    const ty = m + fs * 0.6;
    const by = H - m - fs * 0.6;
    
    if (L.mark) {
      const r = fs * 0.8;
      x.beginPath();
      x.arc(lx + r, ty, r, 0, Math.PI * 2);
      x.fill();
      x.save();
      x.globalCompositeOperation = 'destination-out';
      x.beginPath();
      x.moveTo(lx + r * 0.5, ty + r * 0.45);
      x.lineTo(lx + r * 1.5, ty + r * 0.45);
      x.lineTo(lx + r, ty - r * 0.5);
      x.closePath();
      x.fill();
      x.restore();
      lx += r * 2 + fs * 0.5;
    }
    
    const head = L.font || 'Inter';
    const mono = L.font || 'JetBrains Mono';
    x.font = `600 ${fs}px "${head}"`;
    x.textAlign = 'left';
    x.fillText(typed((L.tl || '').toUpperCase(), v[2]), lx, ty);
    
    x.font = `400 ${fs}px "${mono}"`;
    if ('letterSpacing' in x) (x as any).letterSpacing = (fs * 0.06) + 'px';
    x.textAlign = 'right';
    x.fillText(typed((L.tr || '').toUpperCase(), v[2]), W - m, ty);
    
    x.textAlign = 'left';
    x.fillText(typed((L.bl || '').toUpperCase(), v[2]), m, by);
    
    x.textAlign = 'right';
    x.fillText(typed((L.br || '').toUpperCase(), v[2]), W - m, by);
    x.restore();
  }
  
  app.renderer.setLabels(c);
}

export const resetLabels = () => { labelKey = ''; }