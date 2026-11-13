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
      // Source is wider - crop sides
      drawH = targetRes;
      drawW = Math.round(targetRes * srcAspect);
      offsetX = -(drawW - Math.round(targetRes * targetAspect)) / 2;
    } else {
      // Source is taller - crop top/bottom
      drawW = Math.round(targetRes * targetAspect);
      drawH = targetRes;
      offsetY = -(drawH - targetRes) / 2;
    }
  } else {
    // contain - fit entirely, letterbox
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
    // Deterministic Fisher-Yates shuffle
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