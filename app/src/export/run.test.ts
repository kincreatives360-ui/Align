import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newProject } from '../state/defaults';
import { useExport } from '../state/exportStore';
import { runExport } from './run';

const fakeRenderer = vi.hoisted(() => ({
  canvas: null as HTMLCanvasElement | null,
  render: vi.fn(),
  dispose: vi.fn(),
  snapshot: vi.fn(),
}));

vi.mock('../render/Renderer', () => ({
  Renderer: class {
    canvas: HTMLCanvasElement;

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      fakeRenderer.canvas = canvas;
    }

    render = fakeRenderer.render;
    dispose = fakeRenderer.dispose;
    snapshot = fakeRenderer.snapshot;
  },
}));

vi.mock('../engine/buildFrame', () => ({
  buildFrame: vi.fn(() => ({ W: 720, H: 576 })),
}));

vi.mock('../engine/layout', () => ({
  syncLabels: vi.fn(),
}));

vi.mock('../engine/export', () => ({
  exportVideo: vi.fn(async (
    app: { drawExport: (time: number, width: number, height: number) => void },
    options: { W: number; H: number },
  ) => {
    app.drawExport(0, options.W, options.H);
    return { blob: new Blob(), filename: 'test.mp4', mimeType: 'video/mp4' };
  }),
  exportGif: vi.fn(),
  exportImage: vi.fn(),
  exportSequence: vi.fn(),
  download: vi.fn(async () => 'saved'),
}));

describe('runExport', () => {
  beforeEach(() => {
    useExport.getState().reset();
    fakeRenderer.canvas = null;
    fakeRenderer.render.mockClear();
    fakeRenderer.dispose.mockClear();
  });

  it('renders video frames on an export-sized canvas without resizing the preview', async () => {
    const preview = document.createElement('canvas');
    preview.id = 'canvas';
    preview.width = 640;
    preview.height = 360;
    document.body.append(preview);

    const state = newProject();
    state.export.res = 720;

    await runExport(state);

    expect(fakeRenderer.canvas).not.toBe(preview);
    expect(fakeRenderer.canvas?.width).toBe(720);
    expect(fakeRenderer.canvas?.height).toBe(576);
    expect(preview.width).toBe(640);
    expect(preview.height).toBe(360);
  });
});
