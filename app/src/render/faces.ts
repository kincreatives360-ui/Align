import type { FaceRef } from '../state/types';

/**
 * Card faces: turning an image, a video frame or a placeholder into the
 * canvases the renderer uploads as textures.
 *
 * Each card face is four textures. Texture 0 is the sharp image; textures 1 to 3
 * are progressively blurrier copies that the card shader blends between for
 * depth of field and glass refraction (see `lay()` in card.glsl.ts).
 *
 * This file was missing from the project. Renderer.ts had comments pointing at
 * it ("needs faces.ts"), which is why uploaded media never appeared.
 */

/** Blur radius of each layer, as a fraction of the layer's long edge. */
const BLUR = [0.008, 0.025, 0.07];

/** Pixel size of a face canvas whose long edge is `res`. */
export function faceSize(aspect: number, res: number): { w: number; h: number } {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const r = Math.max(2, Math.round(res));
  return a >= 1
    ? { w: r, h: Math.max(2, Math.round(r / a)) }
    : { w: Math.max(2, Math.round(r * a)), h: r };
}

function naturalSize(img: FaceRef['img']): { w: number; h: number } {
  if (typeof HTMLVideoElement !== 'undefined' && img instanceof HTMLVideoElement) {
    return { w: img.videoWidth, h: img.videoHeight };
  }
  if (typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement) {
    return { w: img.naturalWidth, h: img.naturalHeight };
  }
  return { w: (img as HTMLCanvasElement).width, h: (img as HTMLCanvasElement).height };
}

/** Placeholder cards (no media yet) use keys like `ph:3`. */
export function isPlaceholder(key: string): boolean {
  return key.startsWith('ph:');
}

function paintPlaceholder(g: CanvasRenderingContext2D, w: number, h: number, index: number): void {
  const hue = (index * 47 + 210) % 360;
  const grad = g.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, `hsl(${hue} 55% 54%)`);
  grad.addColorStop(1, `hsl(${(hue + 40) % 360} 60% 26%)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);

  g.fillStyle = 'rgba(255,255,255,0.22)';
  g.font = `600 ${Math.round(Math.min(w, h) * 0.42)}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(index + 1), w / 2, h / 2);
}

/**
 * Paint `src` onto `canvas`, cropped to fill it (like CSS `object-fit: cover`).
 * Called once for stills and again for every new video frame.
 */
export function paintFace(canvas: HTMLCanvasElement, src: FaceRef): void {
  const g = canvas.getContext('2d');
  if (!g) return;
  const w = canvas.width;
  const h = canvas.height;

  // Opaque base so transparent PNGs do not upload as black-with-alpha garbage.
  g.fillStyle = '#111';
  g.fillRect(0, 0, w, h);

  if (isPlaceholder(src.key)) {
    paintPlaceholder(g, w, h, Number(src.key.slice(3)) || 0);
    return;
  }

  const { w: sw, h: sh } = naturalSize(src.img);
  if (!sw || !sh) return;

  const targetAspect = w / h;
  const srcAspect = sw / sh;
  let sx = 0;
  let sy = 0;
  let cw = sw;
  let ch = sh;
  if (srcAspect > targetAspect) {
    cw = sh * targetAspect;
    sx = (sw - cw) / 2;
  } else {
    ch = sw / targetAspect;
    sy = (sh - ch) / 2;
  }
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(src.img, sx, sy, cw, ch, 0, 0, w, h);
}

let filterSupport: boolean | null = null;
function supportsFilter(): boolean {
  if (filterSupport === null) {
    const g = document.createElement('canvas').getContext('2d');
    filterSupport = !!g && 'filter' in g;
  }
  return filterSupport;
}

/**
 * The three blurred copies of a painted face, at half resolution (they are
 * blurry anyway, so the memory is better spent elsewhere).
 */
export function faceLayers(base: HTMLCanvasElement): HTMLCanvasElement[] {
  const w = Math.max(16, base.width >> 1);
  const h = Math.max(16, base.height >> 1);
  const long = Math.max(w, h);
  const filter = supportsFilter();

  return BLUR.map(fraction => {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const g = c.getContext('2d');
    if (!g) return c;
    const r = fraction * long;
    g.imageSmoothingQuality = 'high';

    if (filter) {
      // Draw slightly oversized so the blur does not fade to transparent at the edges.
      const pad = Math.ceil(r * 2);
      g.filter = `blur(${r.toFixed(2)}px)`;
      g.drawImage(base, -pad, -pad, w + pad * 2, h + pad * 2);
      g.filter = 'none';
    } else {
      // Safari fallback: shrink then stretch back up.
      const k = Math.max(2, Math.round(r));
      const small = document.createElement('canvas');
      small.width = Math.max(2, Math.round(w / k));
      small.height = Math.max(2, Math.round(h / k));
      const sg = small.getContext('2d');
      if (sg) {
        sg.imageSmoothingQuality = 'high';
        sg.drawImage(base, 0, 0, small.width, small.height);
        g.drawImage(small, 0, 0, w, h);
      }
    }
    return c;
  });
}
