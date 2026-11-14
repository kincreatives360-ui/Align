// Exports. Video and sequences render every frame at an exact timestamp, so the output is frame-perfect
// at any fps regardless of how long each frame takes to draw.

const CDN = {
  mp4: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm',
  webm: 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.3/+esm',
  gif: 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm',
  zip: 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm',
};

const libs: Record<string, Promise<any>> = {};

async function lib(k: string): Promise<any> {
  if (!libs[k]) libs[k] = import(CDN[k as keyof typeof CDN]);
  return libs[k];
}

export const QUALITY = { low: .05, medium: .09, high: .14, max: .22 };

export const canEncode = (): boolean => 'VideoEncoder' in window && 'VideoFrame' in window;

export const bitrateFor = (W: number, H: number, fps: number, q: string): number =>
  Math.min(150e6, Math.max(2e6, W * H * fps * (QUALITY[q as keyof typeof QUALITY] || .14)));

async function pickConfig(format: string, W: number, H: number, fps: number, bitrate: number): Promise<VideoEncoderConfig | null> {
  const list = format === 'webm'
    ? ['vp09.00.51.08', 'vp09.00.41.08', 'vp09.00.31.08', 'vp8']
    : ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.64002a', 'avc1.640028', 'avc1.4d0034', 'avc1.42003e', 'avc1.42001f'];
  for (const codec of list) {
    const c: VideoEncoderConfig = { codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality' };
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) return c; } catch (e) {}
  }
  return null;
}

const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

export interface ExportVideoOptions {
  format: 'mp4' | 'webm';
  W: number;
  H: number;
  fps: number;
  quality: string;
  duration: number;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ExportGifOptions {
  W: number;
  H: number;
  fps: number;
  colors: number;
  duration: number;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ExportImageOptions {
  T: number;
  W: number;
  H: number;
  format: 'png' | 'jpeg' | 'webp';
  transparent: boolean;
}

export interface ExportSequenceOptions {
  W: number;
  H: number;
  fps: number;
  duration: number;
  transparent: boolean;
  onProgress?: (p: number) => void;
  signal?: AbortSignal;
}

export interface ExportResult {
  blob: Blob;
  mimeType: string;
  filename: string;
}

export interface AppLike {
  prepareFrame?: (T: number) => Promise<void>;
  drawExport: (T: number, W: number, H: number) => void;
  snapshot: (T: number, W: number, H: number, opts?: { transparent?: boolean; opaque?: boolean }) => ImageData;
  canvas: HTMLCanvasElement;
}

function imageToBlob(img: ImageData, type: string, q = .95): Promise<Blob> {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d')!;
  if (type === 'image/jpeg') {
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height);
    const t = document.createElement('canvas'); t.width = img.width; t.height = img.height;
    t.getContext('2d')!.putImageData(img, 0, 0); x.drawImage(t, 0, 0);
  } else x.putImageData(img, 0, 0);
  return new Promise(r => c.toBlob(b => r(b!), type, q));
}

function makeResult(blob: Blob, mimeType: string, filename: string): ExportResult {
  return { blob, mimeType, filename };
}

export async function exportVideo(
  app: AppLike,
  { format, W, H, fps, quality, duration, onProgress, signal }: ExportVideoOptions
): Promise<ExportResult> {
  if (!canEncode()) throw new Error('This browser has no WebCodecs video encoder. Use Chrome, Edge or a recent Safari.');
  const bitrate = bitrateFor(W, H, fps, quality);
  const config = await pickConfig(format, W, H, fps, bitrate);
  if (!config) throw new Error(`${format.toUpperCase()} at ${W}×${H} isn't supported by this browser's encoder. Try a lower resolution or the other format.`);
  const M = await lib(format === 'webm' ? 'webm' : 'mp4');
  const muxer = format === 'webm'
    ? new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: config.codec.startsWith('vp8') ? 'V_VP8' : 'V_VP9', width: W, height: H, frameRate: fps } })
    : new M.Muxer({ target: new M.ArrayBufferTarget(), video: { codec: 'avc', width: W, height: H, frameRate: fps }, fastStart: 'in-memory' });
  let failure: Error | null = null;
  const enc = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: e => { failure = e; }
  });
  enc.configure(config);
  const N = Math.max(1, Math.round(duration * fps));
  const prep = app.prepareFrame ?? (() => Promise.resolve());
  for (let i = 0; i < N; i++) {
    if (signal?.aborted) { enc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
    if (failure) throw failure;
    await prep(i / fps);
    app.drawExport(i / fps, W, H);
    const vf = new VideoFrame(app.canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
    if (i % 4 === 0) { onProgress?.(i / N); await tick(); }
  }
  await enc.flush();
  if (failure) throw failure;
  muxer.finalize();
  onProgress?.(1);
  return makeResult(new Blob([muxer.target.buffer], { type: format === 'webm' ? 'video/webm' : 'video/mp4' }), format === 'webm' ? 'video/webm' : 'video/mp4', `align-${Date.now()}.${format}`);
}

export async function exportGif(
  app: AppLike,
  { W, H, fps, colors, duration, onProgress, signal }: ExportGifOptions
): Promise<ExportResult> {
  const { GIFEncoder, quantize, applyPalette } = await lib('gif');
  const gif = GIFEncoder();
  const N = Math.max(1, Math.round(duration * fps)), delay = Math.round(1000 / fps);
  const prep = app.prepareFrame ?? (() => Promise.resolve());
  for (let i = 0; i < N; i++) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    await prep(i / fps);
    const img = app.snapshot(i / fps, W, H, { opaque: true });
    const palette = quantize(img.data, colors, { format: 'rgb565' });
    gif.writeFrame(applyPalette(img.data, palette, 'rgb565'), W, H, { palette, delay });
    if (i % 2 === 0) { onProgress?.(i / N); await tick(); }
  }
  gif.finish();
  onProgress?.(1);
  return makeResult(new Blob([gif.bytes()], { type: 'image/gif' }), 'image/gif', `align-${Date.now()}.gif`);
}

export async function exportImage(
  app: AppLike,
  { T, W, H, format, transparent }: ExportImageOptions
): Promise<ExportResult> {
  const type = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[format] || 'image/png';
  await app.prepareFrame?.(T);
  const img = app.snapshot(T, W, H, { transparent: transparent && format !== 'jpeg' });
  const blob = await imageToBlob(img, type);
  return makeResult(blob, type, `align-${Date.now()}.${format}`);
}

export async function copyImage(
  app: AppLike,
  { T, W, H }: { T: number; W: number; H: number }
): Promise<void> {
  const result = await exportImage(app, { T, W, H, format: 'png', transparent: true });
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': result.blob })]);
}

export async function exportSequence(
  app: AppLike,
  { W, H, fps, duration, transparent, onProgress, signal }: ExportSequenceOptions
): Promise<ExportResult> {
  const { zipSync } = await lib('zip');
  const files: Record<string, [Uint8Array, { level: number }]> = {};
  const N = Math.max(1, Math.round(duration * fps));
  const prep = app.prepareFrame ?? (() => Promise.resolve());
  for (let i = 0; i < N; i++) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    await prep(i / fps);
    const blob = await imageToBlob(app.snapshot(i / fps, W, H, { transparent }), 'image/png');
    files[`frame_${String(i).padStart(5, '0')}.png`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }];
    if (i % 2 === 0) { onProgress?.(i / N); await tick(); }
  }
  onProgress?.(1);
  return makeResult(new Blob([zipSync(files)], { type: 'application/zip' }), 'application/zip', `align-frames-${Date.now()}.zip`);
}

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<{ save: (opts: { filename: string; data: Blob }) => Promise<void> } | null> };
  }
}

let savesP: Promise<any> | null = null;
const saves = (): Promise<any> => savesP || (savesP = window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null));

export async function download(blob: Blob, name: string): Promise<'saved' | 'declined'> {
  const d = await saves();
  if (d) {
    try { await d.save({ filename: name, data: blob }); return 'saved'; }
    catch (e: any) { if (e?.code === 'declined') return 'declined'; if (e?.code === 'too_large') throw new Error('That file is too big to save here. Try a lower resolution.'); throw new Error(e?.message || 'Saving isn\'t available in this view.'); }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}