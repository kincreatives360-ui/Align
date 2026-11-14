import type { ProjectState } from '../state/types';
import { useExport } from '../state/exportStore';
import { Renderer } from '../render/Renderer';
import { buildFrame } from '../engine/buildFrame';
import { syncLabels } from '../engine/layout';
import { clipLength } from '../engine/timing';
import { prepareFrame } from '../media/video';
import { exportVideo, exportGif, exportImage, exportSequence, download, type ExportResult } from '../engine/export';

/**
 * Produce the file for the current export settings.
 *
 * This is the seam between the UI and the encoder (WebCodecs, GIF, PNG
 * sequence — built in a later milestone). Everything the button needs is
 * already here: it sets progress on `useExport` and resolves when done.
 */

interface AppLike {
  prepareFrame?: (T: number) => Promise<void>;
  drawExport: (T: number, W: number, H: number) => void;
  snapshot: (T: number, W: number, H: number, opts?: { transparent?: boolean; opaque?: boolean }) => ImageData;
  canvas: HTMLCanvasElement;
  logos: Map<string, HTMLImageElement>;
  state: ProjectState;
}

function makeAppLike(state: ProjectState, renderer: Renderer, logos: Map<string, HTMLImageElement>): AppLike {
  return {
    prepareFrame: prepareFrame,
    drawExport: (T: number, W: number, H: number) => {
      const desc = buildFrame(state, T, W, H, { resBoost: 1.15 });
      syncLabels({ state, logos, labelCanvas: null, renderer }, W, H, T);
      renderer.render(desc);
    },
    snapshot: (T: number, W: number, H: number, opts = {}) => {
      const bg = state.style.bg;
      const wasTransparent = bg.transparent;
      bg.transparent = opts.opaque ? false : (opts.transparent || wasTransparent);
      const desc = buildFrame(state, T, W, H, { resBoost: 1.15 });
      syncLabels({ state, logos, labelCanvas: null, renderer }, W, H, T);
      const img = renderer.snapshot(desc);
      bg.transparent = wasTransparent;
      return img;
    },
    canvas: renderer.canvas,
    logos,
    state,
  };
}

export async function runExport(state: ProjectState): Promise<void> {
  const store = useExport.getState();
  
  const canvasEl = document.getElementById('canvas') as HTMLCanvasElement;
  if (!canvasEl) {
    store.fail('Canvas not found');
    throw new Error('Canvas not found');
  }
  
  let renderer: Renderer | null = null;
  try {
    renderer = new Renderer(canvasEl);
  } catch (e) {
    store.fail('Failed to create renderer');
    throw e;
  }

  store.start('Preparing frames…');

  try {
    const ex = state.export;
    const kind = ex.kind;
    const frame = state.frame;
    
    // Calculate dimensions
    const aspects: Record<string, [number, number]> = {
      '16:9': [16, 9], '4:3': [4, 3], '4:5': [4, 5], '1:1': [1, 1],
      '9:16': [9, 16], '5:4': [5, 4], '3:4': [3, 4], '2:3': [2, 3],
    };
    const [a, b] = aspects[frame.aspect] || [16, 9];
    const W = kind === 'image' ? Math.round(ex.scale * a / Math.max(a, b)) : ex.res;
    const H = kind === 'image' ? Math.round(ex.scale * b / Math.max(a, b)) : Math.round(ex.res * b / a);
    
    const duration = ex.duration || clipLength(state);
    const fps = ex.fps;
    const quality = ex.quality;
    const format = ex.format;
    
    // We need logos for label rendering - get from mediaSource
    const { elementFor } = await import('../media/mediaSource');
    const logos = new Map<string, HTMLImageElement>();
    for (const item of state.media.images) {
      const el = elementFor(item);
      if (el && item.kind === 'image' && el instanceof HTMLImageElement) logos.set(item.id, el);
    }
    
    const appLike = makeAppLike(state, renderer!, logos);
    const signal = { aborted: false } as AbortSignal;
    
    const onProgress = (p: number) => store.update(p);

    let result: ExportResult;

    switch (kind) {
      case 'video':
        result = await exportVideo(appLike, { format, W, H, fps, quality, duration, onProgress, signal });
        break;
      case 'gif':
        result = await exportGif(appLike, { W, H, fps: ex.gifFps || 25, colors: ex.gifColors || 256, duration, onProgress, signal });
        break;
      case 'image':
        result = await exportImage(appLike, { T: 0, W, H, format: ex.img as 'png' | 'jpeg' | 'webp', transparent: ex.transparent });
        break;
      case 'sequence':
        result = await exportSequence(appLike, { W, H, fps: ex.seqFps || 30, duration, transparent: ex.transparent, onProgress, signal });
        break;
      default:
        throw new Error(`Unknown export kind: ${kind}`);
    }

    const dlResult = await download(result.blob, result.filename);
    if (dlResult === 'declined') {
      store.fail('Save cancelled');
      return;
    }
    store.finish();
  } catch (err) {
    store.fail(err instanceof Error ? err.message : 'Export failed');
    throw err;
  } finally {
    renderer?.dispose();
  }
}

export class ExportNotReady extends Error {
  constructor(kind: string) {
    super(`The ${kind} exporter is not built yet.`);
    this.name = 'ExportNotReady';
  }
}