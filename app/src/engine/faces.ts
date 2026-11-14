/** Aspect ratios that don't match get letterboxed. */
const CANVAS_POOL: Map<string, HTMLCanvasElement> = new Map();

/** Get a pooled canvas for the given size, creating if needed. */
function getCanvas(w: number, h: number): HTMLCanvasElement {
  const key = `${w}x${h}`;
  let canvas = CANVAS_POOL.get(key);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    CANVAS_POOL.set(key, canvas);
  }
  canvas.width = w;
  canvas.height = h;
  return canvas;
}

/** Draw an image/video into a texture canvas at the target aspect/resolution. */
export function renderFace(
  source: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement,
  targetAspect: number,
  targetRes: number,
  fit: 'cover' | 'contain' = 'cover'
): { canvas: HTMLCanvasElement; aspect: number; width: number; height: number } {
  const srcW = 'videoWidth' in source ? source.videoWidth : source.width;
  const srcH = 'videoHeight' in source ? source.videoHeight : source.height;
  const srcAspect = srcW / srcH;

  let drawW: number, drawH: number, offsetX = 0, offsetY = 0;

  if (fit === 'cover') {
    if (srcAspect > targetAspect) {
      drawH = targetRes;
      drawW = Math.round(targetRes * srcAspect);
      offsetX = -(drawW - Math.round(targetRes * targetAspect)) / 2;
    } else {
      drawW = Math.round(targetRes * targetAspect);
      drawH = targetRes;
      offsetY = -(drawH - targetRes) / 2;
    }
  } else {
    if (srcAspect > targetAspect) {
      drawW = Math.round(targetRes * targetAspect);
      drawH = Math.round(drawW / srcAspect);
      offsetY = (targetRes - drawH) / 2;
    } else {
      drawH = targetRes;
      drawW = Math.round(drawH * srcAspect);
      offsetX = (Math.round(targetRes * targetAspect) - drawW) / 2;
    }
  }

  const canvas = getCanvas(Math.max(1, drawW), Math.max(1, drawH));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, srcW, srcH, offsetX, offsetY, drawW, drawH);

  return { canvas, aspect: canvas.width / canvas.height, width: canvas.width, height: canvas.height };
}

/** Generate mip levels for a face. Returns [level0, level1, level2, level3]. */
export function faceLayers(
  face: { canvas: HTMLCanvasElement; aspect: number }
): HTMLCanvasElement[] {
  const { canvas } = face;
  const layers: HTMLCanvasElement[] = [canvas];

  let current = canvas;
  for (let i = 1; i < 4; i++) {
    const w = Math.max(1, current.width >> 1);
    const h = Math.max(1, current.height >> 1);
    const next = getCanvas(w, h);
    const ctx = next.getContext('2d')!;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(current, 0, 0, w, h);
    layers.push(next);
    current = next;
  }

  return layers;
}

/** Get the long-edge resolution for a card. */
export function quantRes(px: number): number {
  const RES_STEPS = [192, 256, 384, 512, 768, 1024, 1536, 2048, 3072];
  return RES_STEPS.find(r => r >= px) || 3072;
}

/** Media order (in-order or shuffled). */
export function orderFor(images: string[], seed: number, order: 'in-order' | 'shuffle'): number[] {
  const idx = Array.from({ length: images.length }, (_, i) => i);
  if (order === 'shuffle') {
    let t = seed >>> 0;
    const rand = () => {
      t = (t + 0x6d2b79f5) >>> 0;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
  }
  return idx;
}

/** Map media index to card index based on order. */
export function mapMediaToCard(mediaIdx: number, order: number[]): number {
  const idx = order.indexOf(mediaIdx);
  return idx >= 0 ? idx : mediaIdx % order.length;
}

/* ============================================================================
 * Procedural Media Sets (ported from reference faces.js)
 * ============================================================================ */

import { mulberry, hexToRgb } from './math';

const rgba = (hex: string, a: number): string => {
  const c = hexToRgb(hex);
  return `rgba(${c[0] * 255 | 0},${c[1] * 255 | 0},${c[2] * 255 | 0},${a})`;
};

const poly = (ctx: CanvasRenderingContext2D, pts: [number, number][]): void => {
  ctx.beginPath();
  pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]));
  ctx.closePath();
};

const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void => {
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x, y, w, h, r) : ctx.rect(x, y, w, h);
};

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement, w: number, h: number): void {
  const iw = 'videoWidth' in img ? img.videoWidth : 'naturalWidth' in img ? img.naturalWidth : img.width;
  const ih = 'videoHeight' in img ? img.videoHeight : 'naturalHeight' in img ? img.naturalHeight : img.height;
  const s = Math.max(w / iw, h / ih), dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function grain(ctx: CanvasRenderingContext2D, w: number, h: number, amt: number, seed: number): void {
  const R = mulberry(seed), n = Math.round(w * h / 90);
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = R() > .5 ? `rgba(255,255,255,${amt * R()})` : `rgba(0,0,0,${amt * R()})`;
    ctx.fillRect(R() * w, R() * h, 1.5, 1.5);
  }
  ctx.restore();
}

function blob(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, a = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba(col, a)); g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

const fit = (ctx: CanvasRenderingContext2D, text: string, weight: number, family: string, maxW: number, size: number): number => {
  let s = size; ctx.font = `${weight} ${s}px "${family}"`;
  const w = ctx.measureText(text).width; if (w > maxW) { s *= maxW / w; ctx.font = `${weight} ${s}px "${family}"`; }
  return s;
};

/* ---------- logo marks (generic geometric shapes, no real brands) ---------- */

function mark(ctx: CanvasRenderingContext2D, kind: string, cx: number, cy: number, s: number, col: string, col2?: string): void {
  ctx.save();
  const g = ctx.createLinearGradient(cx - s, cy - s, cx + s, cy + s);
  g.addColorStop(0, col); g.addColorStop(1, col2 || col);
  ctx.fillStyle = g; ctx.strokeStyle = g; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const r = s;
  switch (kind) {
    case 'burst':
      ctx.lineWidth = r * .16;
      for (let i = 0; i < 12; i++) {
        const a = i / 12 * Math.PI * 2;
        ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * r * .22, cy + Math.sin(a) * r * .22);
        ctx.lineTo(cx + Math.cos(a) * r * .9, cy + Math.sin(a) * r * .9); ctx.stroke();
      }
      break;
    case 'diamond':
      poly(ctx, [[cx, cy - r], [cx + r * .85, cy], [cx, cy + r], [cx - r * .85, cy]]); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      poly(ctx, [[cx, cy - r * .45], [cx + r * .38, cy], [cx, cy + r * .45], [cx - r * .38, cy]]); ctx.fill();
      break;
    case 'ring':
      ctx.lineWidth = r * .3; ctx.beginPath(); ctx.arc(cx, cy, r * .68, -Math.PI * .3, Math.PI * 1.45); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + r * .45, cy - r * .5, r * .17, 0, 7); ctx.fill();
      break;
    case 'bars':
      for (let i = 0; i < 4; i++) {
        const h = r * (.8 + i * .35);
        rr(ctx, cx - r + i * r * .52, cy + r - h, r * .34, h, r * .12); ctx.fill();
      }
      break;
    case 'spiral':
      ctx.lineWidth = r * .16; ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const t = i / 120, a = t * Math.PI * 5, rad = r * (.1 + .85 * t);
        const x = cx + Math.cos(a) * rad, y = cy + Math.sin(a) * rad; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke(); break;
    case 'chevron':
      ctx.lineWidth = r * .28;
      [-0.45, 0.2].forEach(o => {
        ctx.beginPath(); ctx.moveTo(cx - r * .75, cy + o * r - r * .35);
        ctx.lineTo(cx, cy + o * r + r * .3); ctx.lineTo(cx + r * .75, cy + o * r - r * .35); ctx.stroke();
      });
      break;
    case 'star':
      ctx.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI * 2 - Math.PI / 2, rad = i % 2 ? r * .38 : r;
        ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      }
      ctx.closePath(); ctx.fill(); break;
    case 'knot':
      ctx.lineWidth = r * .2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); ctx.ellipse(cx, cy, r * .9, r * .36, k * Math.PI / 3, 0, 7); ctx.stroke();
      }
      break;
    case 'dots':
      for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
        ctx.beginPath(); ctx.arc(cx + x * r * .62, cy + y * r * .62, r * (x === 0 && y === 0 ? .3 : .2), 0, 7); ctx.fill();
      }
      break;
    case 'wave':
      ctx.lineWidth = r * .2;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath(); for (let i = 0; i <= 40; i++) {
          const t = i / 40, x = cx - r + t * 2 * r, y = cy + (k - 1) * r * .55 + Math.sin(t * Math.PI * 2) * r * .2;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        } ctx.stroke();
      }
      break;
    case 'cube':
      poly(ctx, [[cx, cy - r], [cx + r * .87, cy - r / 2], [cx, cy], [cx - r * .87, cy - r / 2]]); ctx.globalAlpha = .6; ctx.fill(); ctx.globalAlpha = 1;
      poly(ctx, [[cx - r * .87, cy - r / 2], [cx, cy], [cx, cy + r], [cx - r * .87, cy + r / 2]]); ctx.globalAlpha = .82; ctx.fill(); ctx.globalAlpha = 1;
      poly(ctx, [[cx, cy], [cx + r * .87, cy - r / 2], [cx + r * .87, cy + r / 2], [cx, cy + r]]); ctx.fill();
      break;
    case 'petal':
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(i * Math.PI / 2);
        ctx.beginPath(); ctx.ellipse(0, -r * .48, r * .3, r * .5, 0, 0, 7); ctx.fill(); ctx.restore();
      }
      break;
    case 'arc':
      ctx.lineWidth = r * .24;
      ctx.beginPath(); ctx.arc(cx, cy, r * .8, Math.PI * .25, Math.PI * 1.75); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx + r * .12, cy, r * .38, Math.PI * .3, Math.PI * 1.7); ctx.stroke();
      break;
    case 'grid':
      for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) {
        rr(ctx, cx - r * .9 + x * r * .98, cy - r * .9 + y * r * .98, r * .82, r * .82, (x + y) % 2 ? r * .41 : r * .14); ctx.fill();
      }
      break;
    case 'bolt':
      poly(ctx, [[cx + r * .15, cy - r], [cx - r * .6, cy + r * .15], [cx - r * .05, cy + r * .15], [cx - r * .2, cy + r], [cx + r * .6, cy - r * .2], [cx + r * .05, cy - r * .2]]); ctx.fill();
      break;
    case 'eye':
      ctx.beginPath(); ctx.moveTo(cx - r, cy); ctx.quadraticCurveTo(cx, cy - r * 1.1, cx + r, cy);
      ctx.quadraticCurveTo(cx, cy + r * 1.1, cx - r, cy); ctx.fill();
      ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(cx, cy, r * .34, 0, 7); ctx.fill();
      break;
  }
  ctx.restore();
}

/* ---------- demo sets ---------- */
const LOGO_TILES: [string, string, string][] = [
  ['#111111', 'burst', '#ffffff'], ['#ff6a1a', 'star', '#ffffff'], ['#2f5bff', 'dots', '#ffffff'], ['#ffffff', 'knot', '#111111'],
  ['#1fbf8f', 'wave', '#ffffff'], ['#0d0d0f', 'diamond', '#ffffff'], ['#7b61ff', 'chevron', '#ffffff'], ['#f5f0e6', 'spiral', '#ff4d2e'],
  ['#ff3d6e', 'petal', '#ffffff'], ['#121826', 'bolt', '#ffd23f'], ['#ffd23f', 'ring', '#111111'], ['#ffffff', 'grid', '#2f5bff'],
  ['#0b3d2e', 'arc', '#9ff2c8'], ['#ff8a3d', 'cube', '#ffffff'], ['#e9e7ff', 'eye', '#5b3df0'], ['#191919', 'bars', '#ff6a1a'],
];

const WORDMARKS: { t: string; f: string; w: number; c: string; bg: string[]; st: string; m?: string; mc?: string }[] = [
  { t: 'lumen', f: 'Poppins', w: 500, c: '#151515', bg: ['#fbfaf7', '#fde3ec', '#dfe8ff'], st: 'pastel' },
  { t: 'Northcap', f: 'Poppins', w: 600, c: '#ffffff', bg: ['#1b1614', '#ff7a45', '#e2483b'], st: 'streaks', m: 'bars' },
  { t: 'Monoform', f: 'Space Mono', w: 700, c: '#0c0c0c', bg: ['#f3f3f3'], st: 'solid' },
  { t: 'Wavelength', f: 'DM Sans', w: 700, c: '#ffffff', bg: ['#2a3be8', '#3156ff', '#5fd0ff'], st: 'gradient', m: 'arc' },
  { t: 'stackup', f: 'Outfit', w: 600, c: '#2a1a7a', bg: ['#f4f3f8', '#ece9f8', '#f7f7fb'], st: 'pastel', m: 'cube', mc: '#7b5cff' },
  { t: 'VERDANT', f: 'Space Grotesk', w: 500, c: '#eaf7ef', bg: ['#0f2a22', '#2c5a49', '#173d31'], st: 'glow', m: 'ring', mc: '#8ff0b5' },
  { t: 'Halcyon', f: 'Sora', w: 600, c: '#ffffff', bg: ['#110e3d', '#2b3cf0', '#1a1670'], st: 'glow', m: 'chevron' },
  { t: 'Rosewater', f: 'Manrope', w: 800, c: '#1d1416', bg: ['#ffffff', '#fde7e4', '#f2a1a1'], st: 'gradient', m: 'petal', mc: '#c25bff' },
];

const GRADIENTS: [string, string, string, string][] = [
  ['#ff5f6d', '#ffc371', '#7b2ff7', '#1b1b2f'], ['#00c6ff', '#0072ff', '#a1ffce', '#0b1026'], ['#f6d365', '#fda085', '#ff6fd8', '#2d0b3a'],
  ['#43e97b', '#38f9d7', '#2b5876', '#08110f'], ['#fa709a', '#fee140', '#6a11cb', '#120a1f'], ['#c471f5', '#fa71cd', '#30cfd0', '#140c24'],
  ['#ff9a8b', '#ff6a88', '#ff99ac', '#2a1220'], ['#5ee7df', '#b490ca', '#ffd1ff', '#101820'], ['#ffecd2', '#fcb69f', '#ff7e5f', '#2b1a12'],
  ['#d4fc79', '#96e6a1', '#3ca55c', '#0e1a10'], ['#a18cd1', '#fbc2eb', '#6ee2f5', '#120f22'], ['#fddb92', '#d1fdff', '#f093fb', '#16131c'],
];

const SCENERY: { sky: string[]; sun: string; hills: string[] }[] = [
  { sky: ['#ffb38a', '#ff7b89', '#7a5cff'], sun: '#fff2c8', hills: ['#5b3a8a', '#3f2a6b', '#24194a'] },
  { sky: ['#a8e0ff', '#5fb1ff', '#2f6bff'], sun: '#ffffff', hills: ['#6aa9ff', '#3b78e6', '#1d47b3'] },
  { sky: ['#ffe0a8', '#ffb36b', '#ff6a3d'], sun: '#fff7e0', hills: ['#c2553a', '#8f3b2a', '#55231a'] },
  { sky: ['#1b1f3b', '#3a2c6b', '#e46ea8'], sun: '#ffd1e8', hills: ['#2a2350', '#1a1638', '#0d0b1f'] },
  { sky: ['#d5f5e3', '#9be3c4', '#3fbf9b'], sun: '#ffffff', hills: ['#3aa585', '#25806a', '#145244'] },
  { sky: ['#ffd9e0', '#ffb3c1', '#f27aa0'], sun: '#fffafc', hills: ['#e0849c', '#b8607e', '#7f3f5c'] },
  { sky: ['#0b132b', '#1c2541', '#5bc0be'], sun: '#e0fbfc', hills: ['#1c2541', '#121a30', '#0a0f1e'] },
  { sky: ['#f7f3e3', '#e8d8b8', '#c9a96e'], sun: '#fffaf0', hills: ['#a8874f', '#7d6338', '#4f3f24'] },
  { sky: ['#e0c3fc', '#8ec5fc', '#4a6cf7'], sun: '#ffffff', hills: ['#6a7cf0', '#4655c9', '#2a3591'] },
  { sky: ['#ff9966', '#ff5e62', '#2b1055'], sun: '#ffe9c7', hills: ['#3d1a5e', '#2a1144', '#160a26'] },
];

const UI_THEMES: { bg: string; fg: string; mute: string; acc: string; name: string }[] = [
  { bg: '#ffffff', fg: '#111317', mute: '#e9ecf2', acc: '#2f5bff', name: 'Dashboard' },
  { bg: '#0f1115', fg: '#f2f3f5', mute: '#1d2129', acc: '#7c5cff', name: 'Analytics' },
  { bg: '#f6f2ea', fg: '#1d1a16', mute: '#e7dfd1', acc: '#ff6a1a', name: 'Commerce' },
  { bg: '#0b1d17', fg: '#e8fff4', mute: '#123329', acc: '#2fe39b', name: 'Finance' },
  { bg: '#fff6f8', fg: '#2a1420', mute: '#f8dfe7', acc: '#ff3d6e', name: 'Social' },
  { bg: '#101827', fg: '#e6edf7', mute: '#1b263b', acc: '#38bdf8', name: 'Weather' },
  { bg: '#fbfbfd', fg: '#15151a', mute: '#ececf3', acc: '#111111', name: 'Notes' },
  { bg: '#1a1022', fg: '#f6eaff', mute: '#2a1b37', acc: '#ff8a3d', name: 'Music' },
  { bg: '#eef6ff', fg: '#0c1b33', mute: '#d9e8fb', acc: '#1f6feb', name: 'Travel' },
  { bg: '#121212', fg: '#fafafa', mute: '#222222', acc: '#e5ff3d', name: 'Fitness' },
];

const POSTERS: [string, string, string, string][] = [
  ['#ff4d2e', '#111111', 'FORM', 'Unbounded'], ['#111111', '#f2f0ea', '01', 'Syne'], ['#2f5bff', '#ffffff', 'Motion', 'Instrument Serif'],
  ['#f2f0ea', '#111111', 'Grid', 'Space Grotesk'], ['#ffd23f', '#111111', 'ZOOM', 'Unbounded'], ['#1fbf8f', '#0b1d17', 'Flow', 'Syne'],
  ['#7b61ff', '#ffffff', '24', 'Space Grotesk'], ['#ff3d6e', '#ffffff', 'Echo', 'Instrument Serif'], ['#0d0d0f', '#ff6a1a', 'LOOP', 'Unbounded'],
  ['#e9e7ff', '#2a1a7a', 'Soft', 'Syne'], ['#ff8a3d', '#1d1a16', '72°', 'Space Grotesk'], ['#121826', '#9ff2c8', 'Wave', 'Instrument Serif'],
];

const PAY_CARDS: [string, string, string][] = [
  ['#16161a', '#3a3a44', '#d9d9e0'], ['#2f5bff', '#7aa2ff', '#ffffff'], ['#ff6a1a', '#ffb36b', '#ffffff'], ['#e9e7ff', '#c9c2ff', '#2a1a7a'],
  ['#0b3d2e', '#1fbf8f', '#e8fff4'], ['#c0c0c8', '#f4f4f8', '#16161a'], ['#7b2ff7', '#ff5f6d', '#ffffff'], ['#111111', '#c9a96e', '#f7e7c6'],
];

const SHAPES: [string, string][] = [
  ['#f2f0ea', '#ff6a1a'], ['#111111', '#7b61ff'], ['#2f5bff', '#ffd23f'], ['#ffe0ea', '#ff3d6e'], ['#0b1d17', '#2fe39b'], ['#e9ecf2', '#2f5bff'],
  ['#1a1022', '#ff8a3d'], ['#fff6e0', '#1fbf8f'], ['#121826', '#38bdf8'], ['#f6f2ea', '#111111'], ['#2a1a7a', '#fbc2eb'], ['#ff8a3d', '#ffffff'],
];

function drawLogo(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const [bg, m, mc] = LOGO_TILES[i % LOGO_TILES.length];
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, 'rgba(255,255,255,.10)'); g.addColorStop(1, 'rgba(0,0,0,.10)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  mark(ctx, m, w / 2, h / 2, Math.min(w, h) * .26, mc);
}

function drawWordmark(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const s = WORDMARKS[i % WORDMARKS.length], [c1, c2 = c1, c3 = c2] = s.bg;
  ctx.fillStyle = c1; ctx.fillRect(0, 0, w, h);
  if (s.st === 'pastel') {
    blob(ctx, w * .15, h * .25, w * .75, c2, .85); blob(ctx, w * .85, h * .35, w * .8, c3, .85); blob(ctx, w * .5, h * .5, w * .45, c1, .7);
  } else if (s.st === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, c1); g.addColorStop(.6, c2); g.addColorStop(1, c3); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); blob(ctx, w * .9, h * 1.05, w * .5, c3, .9);
  } else if (s.st === 'glow') {
    blob(ctx, w * .68, h * .3, w * .62, c2, 1); blob(ctx, w * .15, h, w * .4, c3, .6);
  } else if (s.st === 'streaks') {
    const R = mulberry(7); ctx.globalCompositeOperation = 'lighter';
    for (let k = 0; k < 80; k++) {
      const x = Math.pow(R(), .55) * w, sw = (.002 + R() * R() * .02) * w, st = Math.pow(x / w, 2.2) * (.25 + R() * .75), c = R() > .5 ? c2 : c3;
      const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgba(c, st * .9)); g.addColorStop(1, rgba(c, st * .08)); ctx.fillStyle = g; ctx.fillRect(x, 0, sw, h);
    }
    ctx.globalCompositeOperation = 'source-over'; blob(ctx, w * .25, h * .55, w * .55, c1, .85);
  }
  const fs = h * (w / h > 1.4 ? .2 : .14);
  const size = fit(ctx, s.t, s.w, s.f, w * (s.m ? .62 : .78), fs);
  const tw = ctx.measureText(s.t).width, ms = s.m ? size * .95 : 0, gap = s.m ? ms * .32 : 0;
  const x0 = (w - tw - ms - gap) / 2;
  if (s.m) mark(ctx, s.m, x0 + ms / 2, h / 2, ms / 2, s.mc || s.c);
  ctx.fillStyle = s.c; ctx.textBaseline = 'middle'; ctx.fillText(s.t, x0 + ms + gap, h / 2 + size * .04);
}

function drawGradient(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const [a, b, c, base] = GRADIENTS[i % GRADIENTS.length], R = mulberry(i * 31 + 5);
  ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
  [a, b, c, a].forEach((col, _) => blob(ctx, w * (.15 + R() * .7), h * (.15 + R() * .7), Math.max(w, h) * (.45 + R() * .35), col, .95));
  grain(ctx, w, h, .09, i + 1);
  ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = `500 ${Math.min(w, h) * .05}px "JetBrains Mono"`; ctx.textBaseline = 'top';
  ctx.fillText(`N°${String(i + 1).padStart(2, '0')}`, w * .07, h * .07);
}

function drawScenery(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const s = SCENERY[i % SCENERY.length], R = mulberry(i * 17 + 3);
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, s.sky[2]); g.addColorStop(.55, s.sky[1]); g.addColorStop(1, s.sky[0]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  const sy = h * (.32 + R() * .15), sx = w * (.3 + R() * .4), sr = Math.min(w, h) * .12;
  blob(ctx, sx, sy, sr * 3.4, s.sun, .55); ctx.fillStyle = s.sun; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, 7); ctx.fill();
  s.hills.forEach((col, k) => {
    ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, h);
    const base = h * (.6 + k * .12), amp = h * (.12 - k * .025), f = 1.5 + R() * 2, ph = R() * 6;
    for (let x = 0; x <= w; x += w / 60) ctx.lineTo(x, base - Math.abs(Math.sin(x / w * f * Math.PI + ph)) * amp - Math.sin(x / w * 9 + ph) * amp * .15);
    ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  });
  grain(ctx, w, h, .05, i + 9);
}

function drawUI(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const t = UI_THEMES[i % UI_THEMES.length], R = mulberry(i * 13 + 1), u = Math.min(w, h) / 20, portrait = h > w;
  ctx.fillStyle = t.bg; ctx.fillRect(0, 0, w, h);
  const pad = u * 1.2;
  ctx.fillStyle = t.fg; ctx.font = `700 ${u * 1.1}px "Inter"`; ctx.textBaseline = 'top';
  ctx.fillText(t.name, pad, pad);
  ctx.fillStyle = t.mute; rr(ctx, w - pad - u * 1.6, pad - u * .1, u * 1.6, u * 1.6, u * .8); ctx.fill();
  let y = pad + u * 2.6;
  const hc = ctx.createLinearGradient(pad, y, w - pad, y + u * 5); hc.addColorStop(0, t.acc); hc.addColorStop(1, rgba(t.acc, .65));
  ctx.fillStyle = hc; rr(ctx, pad, y, w - pad * 2, u * 5, u * .8); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.95)'; ctx.font = `700 ${u * 1.9}px "Inter"`; ctx.fillText(['$24,890', '1.2M', '98%', '72°', '4,215'][i % 5], pad + u, y + u * 1.1);
  ctx.font = `500 ${u * .7}px "Inter"`; ctx.globalAlpha = .8; ctx.fillText('This month', pad + u, y + u * 3.4); ctx.globalAlpha = 1;
  y += u * 6;
  const ch = portrait ? u * 5 : u * 4, cw = portrait ? w - pad * 2 : (w - pad * 3) * .55;
  ctx.fillStyle = t.mute; rr(ctx, pad, y, cw, ch, u * .7); ctx.fill();
  ctx.strokeStyle = t.acc; ctx.lineWidth = u * .22; ctx.beginPath();
  for (let k = 0; k <= 12; k++) { const x = pad + u * .6 + k / 12 * (cw - u * 1.2), yy = y + ch * .75 - (Math.sin(k * .9 + i) * .5 + .5) * ch * .5 - k * ch * .015; k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); }
  ctx.stroke();
  if (!portrait) {
    const bx = pad * 2 + cw, bw = w - bx - pad;
    ctx.fillStyle = t.mute; rr(ctx, bx, y, bw, ch, u * .7); ctx.fill();
    for (let k = 0; k < 6; k++) { const bh = ch * (.25 + R() * .55); ctx.fillStyle = k === 3 ? t.acc : rgba(t.fg, .25); rr(ctx, bx + u * .6 + k * (bw - u * 1.2) / 6, y + ch - u * .5 - bh, (bw - u * 1.2) / 6 * .6, bh, u * .2); ctx.fill(); }
  }
  y += ch + u;
  while (y + u * 2 < h - pad) {
    ctx.fillStyle = t.mute; rr(ctx, pad, y, u * 1.8, u * 1.8, u * .5); ctx.fill();
    ctx.fillStyle = rgba(t.fg, .85); rr(ctx, pad + u * 2.4, y + u * .25, (w - pad * 2) * (.3 + R() * .25), u * .55, u * .27); ctx.fill();
    ctx.fillStyle = rgba(t.fg, .3); rr(ctx, pad + u * 2.4, y + u * 1.05, (w - pad * 2) * (.2 + R() * .2), u * .45, u * .22); ctx.fill();
    ctx.fillStyle = t.acc; rr(ctx, w - pad - u * 2.6, y + u * .45, u * 2.6, u * .9, u * .45); ctx.fill();
    y += u * 2.5;
  }
}

function drawPoster(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const [bg, fg, word, fam] = POSTERS[i % POSTERS.length], R = mulberry(i * 7 + 2);
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = .9; ctx.fillStyle = fg;
  const k = i % 4;
  if (k === 0) { ctx.beginPath(); ctx.arc(w * .7, h * .32, Math.min(w, h) * .26, 0, 7); ctx.fill(); }
  if (k === 1) { for (let s = 0; s < 6; s++) { ctx.fillRect(0, h * (.1 + s * .07), w * (.3 + R() * .6), h * .025); } }
  if (k === 2) { ctx.lineWidth = Math.min(w, h) * .02; ctx.strokeStyle = fg; for (let s = 0; s < 5; s++) { ctx.beginPath(); ctx.arc(w * .5, h * .35, Math.min(w, h) * (.08 + s * .06), 0, 7); ctx.stroke(); } }
  if (k === 3) { poly(ctx, [[w * .15, h * .55], [w * .5, h * .1], [w * .85, h * .55]]); ctx.fill(); }
  ctx.restore();
  ctx.fillStyle = fg; ctx.textBaseline = 'alphabetic';
  const size = fit(ctx, word, fam === 'Instrument Serif' ? 400 : 700, fam, w * .86, h * .26);
  ctx.fillText(word, w * .07, h * .9);
  ctx.font = `500 ${Math.min(w, h) * .035}px "JetBrains Mono"`; ctx.globalAlpha = .75;
  ctx.fillText(`VOL.${String(i + 1).padStart(2, '0')} — 2026`, w * .07, h * .9 - size * 1.02);
  ctx.globalAlpha = 1;
}

function drawPayCard(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const [a, b, fg] = PAY_CARDS[i % PAY_CARDS.length], u = h / 10;
  const g = ctx.createLinearGradient(0, 0, w, h); g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  ctx.save(); ctx.globalAlpha = .18; ctx.strokeStyle = fg; ctx.lineWidth = u * .08;
  for (let k = 0; k < 9; k++) { ctx.beginPath(); ctx.arc(w * 1.05, h * -.1, u * (4 + k * 1.3), 0, 7); ctx.stroke(); }
  ctx.restore();
  const cg = ctx.createLinearGradient(u, u * 3.4, u * 2.6, u * 5.2); cg.addColorStop(0, '#f3d98c'); cg.addColorStop(1, '#b8913f');
  ctx.fillStyle = cg; rr(ctx, u * 1.1, u * 3.5, u * 1.7, u * 1.3, u * .25); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = u * .05; ctx.strokeRect(u * 1.5, u * 3.5, u * .9, u * 1.3);
  ctx.fillStyle = fg; ctx.font = `500 ${u * .95}px "JetBrains Mono"`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('4821  ••••  ••••  ' + (1000 + i * 1371 % 9000), u * 1.1, u * 7);
  ctx.font = `600 ${u * .6}px "Inter"`; ctx.globalAlpha = .85; ctx.fillText('ALEX MORGAN', u * 1.1, u * 8.7); ctx.fillText('09/29', w - u * 3.2, u * 8.7); ctx.globalAlpha = 1;
  ctx.font = `700 ${u * 1}px "Space Grotesk"`; ctx.fillText('aurum', u * 1.1, u * 2);
  ctx.globalAlpha = .9; ctx.beginPath(); ctx.arc(w - u * 2.6, u * 1.7, u * .75, 0, 7); ctx.fill(); ctx.globalAlpha = .55; ctx.beginPath(); ctx.arc(w - u * 1.7, u * 1.7, u * .75, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
}

function drawShape(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const [bg, col] = SHAPES[i % SHAPES.length], m = Math.min(w, h), cx = w / 2, cy = h / 2, k = i % 4;
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
  blob(ctx, cx, cy + m * .32, m * .4, '#000000', .25);
  const sphere = (x: number, y: number, r: number) => { const g = ctx.createRadialGradient(x - r * .35, y - r * .4, r * .05, x, y, r); g.addColorStop(0, '#ffffff'); g.addColorStop(.25, col); g.addColorStop(1, rgba(col, .55)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  if (k === 0) sphere(cx, cy, m * .28);
  if (k === 1) { ctx.lineWidth = m * .12; const g = ctx.createLinearGradient(cx - m * .3, cy, cx + m * .3, cy); g.addColorStop(0, '#ffffff'); g.addColorStop(.5, col); g.addColorStop(1, rgba(col, .5)); ctx.strokeStyle = g; ctx.beginPath(); ctx.ellipse(cx, cy, m * .28, m * .16, -.4, 0, 7); ctx.stroke(); }
  if (k === 2) { sphere(cx - m * .12, cy + m * .05, m * .16); sphere(cx + m * .15, cy - m * .1, m * .11); sphere(cx + m * .05, cy + m * .2, m * .07); }
  if (k === 3) { const g = ctx.createLinearGradient(cx - m * .25, cy - m * .25, cx + m * .25, cy + m * .25); g.addColorStop(0, '#ffffff'); g.addColorStop(.4, col); g.addColorStop(1, rgba(col, .45)); ctx.fillStyle = g; ctx.save(); ctx.translate(cx, cy); ctx.rotate(.5); rr(ctx, -m * .22, -m * .22, m * .44, m * .44, m * .08); ctx.fill(); ctx.restore(); }
}

/* ---------- the bundled photo set: the default media for every template ---------- */
const PHOTO_COUNT = 10;
const photoImgs: (HTMLImageElement | null)[] = [];

export function loadPhotos(): Promise<void> {
  return Promise.all(Array.from({ length: PHOTO_COUNT }, (_, i) => new Promise<void>((resolve, reject) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { photoImgs[i] = im; resolve(); };
    im.onerror = () => reject(new Error(`Failed to load photo-${String(i + 1).padStart(2, '0')}.jpg`));
    im.src = new URL(`../media/photo-${String(i + 1).padStart(2, '0')}.jpg`, import.meta.url).href;
  }))).then(() => {});
}

function drawPhoto(ctx: CanvasRenderingContext2D, i: number, w: number, h: number): void {
  const ok = photoImgs.filter(Boolean) as HTMLImageElement[], im = ok.length ? ok[i % ok.length] : null;
  ctx.fillStyle = '#d9d9de'; ctx.fillRect(0, 0, w, h);
  if (im) drawCover(ctx, im, w, h);
}

/** Procedural media sets available in the editor. */
export const MEDIA_SETS = {
  photos:    { name: 'Photos', count: PHOTO_COUNT, draw: drawPhoto, aspect: .8 },
  logos:     { name: 'Logo tiles', count: LOGO_TILES.length, draw: drawLogo, aspect: 1 },
  wordmarks: { name: 'Wordmarks', count: WORDMARKS.length, draw: drawWordmark, aspect: 1.8 },
  gradients: { name: 'Gradient art', count: GRADIENTS.length, draw: drawGradient, aspect: .75 },
  scenery:   { name: 'Scenery', count: SCENERY.length, draw: drawScenery, aspect: .75 },
  ui:        { name: 'App screens', count: UI_THEMES.length, draw: drawUI, aspect: .5 },
  posters:   { name: 'Posters', count: POSTERS.length, draw: drawPoster, aspect: .75 },
  cards:     { name: 'Payment cards', count: PAY_CARDS.length, draw: drawPayCard, aspect: 1.6 },
  shapes:    { name: '3D shapes', count: SHAPES.length, draw: drawShape, aspect: 1 },
};

export const FONTS_TO_LOAD = [
  '500 20px Inter', '700 20px Inter', '500 20px Poppins', '600 20px Poppins', '700 20px "Space Mono"', '700 20px "DM Sans"', '600 20px Outfit',
  '500 20px "Space Grotesk"', '700 20px "Space Grotesk"', '600 20px Sora', '800 20px Manrope', '700 20px Unbounded', '700 20px Syne', '400 20px "Instrument Serif"', '400 20px "JetBrains Mono"', '500 20px "JetBrains Mono"'
];

/* ---------- face + blur layers ---------- */
const canFilter = (() => { try { const ctx = document.createElement('canvas').getContext('2d'); return !!ctx && 'filter' in ctx; } catch (e) { return false; } })();

export function faceSize(aspect: number, res: number): [number, number] {
  return aspect >= 1 ? [res, Math.max(2, Math.round(res / aspect))] : [Math.max(2, Math.round(res * aspect)), res];
}

export interface FaceItem {
  kind: 'set' | 'image' | 'video';
  set?: string;
  index?: number;
  img?: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement;
}

export function renderFaceItem(item: FaceItem, aspect: number, res: number): HTMLCanvasElement {
  const [w, h] = faceSize(aspect, res);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paintFace(c, item);
  return c;
}

export function paintFace(c: HTMLCanvasElement, item: FaceItem): void {
  const ctx = c.getContext('2d')!; const w = c.width, h = c.height;
  if (item.kind === 'image' || item.kind === 'video') {
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h); if (item.img) drawCover(ctx, item.img, w, h);
  } else if (item.kind === 'set' && item.set && MEDIA_SETS[item.set as keyof typeof MEDIA_SETS]) {
    MEDIA_SETS[item.set as keyof typeof MEDIA_SETS].draw(ctx, item.index!, w, h);
  }
}

export const BLUR_FRACS = [.008, .024, .064];

export function blurLayer(face: HTMLCanvasElement, sigma: number, scale: number): HTMLCanvasElement {
  const w = Math.max(2, Math.round(face.width * scale)), h = Math.max(2, Math.round(face.height * scale));
  const sg = sigma * scale, p = Math.ceil(sg * 3) + 2;
  const pad = document.createElement('canvas'); pad.width = w + 2 * p; pad.height = h + 2 * p;
  const x = pad.getContext('2d')!;
  x.drawImage(face, p, p, w, h);
  x.drawImage(pad, p, p, 1, h, 0, p, p, h); x.drawImage(pad, p + w - 1, p, 1, h, p + w, p, p, h);
  x.drawImage(pad, 0, p, w + 2 * p, 1, 0, 0, w + 2 * p, p); x.drawImage(pad, 0, p + h - 1, w + 2 * p, 1, 0, p + h, w + 2 * p, p);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d')!;
  if (canFilter) { o.filter = `blur(${sg}px)`; o.drawImage(pad, -p, -p); }
  else {
    let src = pad; const k = Math.max(1, sg / 1.5);
    for (let i = 0; i < 3; i++) {
      const t = document.createElement('canvas'); t.width = Math.max(2, src.width / k | 0); t.height = Math.max(2, src.height / k | 0);
      const tx = t.getContext('2d')!; tx.imageSmoothingQuality = 'high'; tx.drawImage(src, 0, 0, t.width, t.height);
      const u = document.createElement('canvas'); u.width = pad.width; u.height = pad.height; const ux = u.getContext('2d')!; ux.imageSmoothingQuality = 'high'; ux.drawImage(t, 0, 0, u.width, u.height); src = u;
    }
    o.drawImage(src, -p, -p);
  }
  return out;
}

export function faceLayersFromCanvas(face: HTMLCanvasElement): HTMLCanvasElement[] {
  const L = Math.max(face.width, face.height);
  return BLUR_FRACS.map((f, i) => blurLayer(face, f * L * .5, 1 / Math.pow(2, i + 1)));
}

export function analyse(face: HTMLCanvasElement): { avg: number[]; accent: number[] } {
  const n = 12, c = document.createElement('canvas'); c.width = n; c.height = n;
  const x = c.getContext('2d', { willReadFrequently: true })!; x.drawImage(face, 0, 0, n, n);
  const d = x.getImageData(0, 0, n, n).data;
  let avg = [0, 0, 0], best = [0, 0, 0], bs = -1;
  for (let i = 0; i < n * n; i++) {
    const r = d[i * 4] / 255, g = d[i * 4 + 1] / 255, b = d[i * 4 + 2] / 255;
    avg[0] += r; avg[1] += g; avg[2] += b;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sc = (mx - mn) * 1.4 + mx * .3;
    if (sc > bs) { bs = sc; best = [r, g, b]; }
  }
  return { avg: avg.map(v => v / (n * n)), accent: best };
}