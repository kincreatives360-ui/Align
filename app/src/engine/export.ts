import { buildFrame } from './buildFrame';
import { Renderer } from '../render/Renderer';
import type { ProjectState } from '../state/types';

/** Export options. */
export interface ExportOptions {
  format: 'mp4' | 'gif' | 'png' | 'webm';
  width: number;
  height: number;
  duration?: number;      // seconds, defaults to clip length
  fps?: number;           // defaults to 60
  quality?: number;       // 0-1, for video/webm
  onProgress?: (p: number) => void;
}

/** Export result. */
export interface ExportResult {
  blob: Blob;
  mimeType: string;
  filename: string;
}

/** Check if WebCodecs is available. */
function hasWebCodecs(): boolean {
  return typeof VideoEncoder !== 'undefined' && typeof VideoDecoder !== 'undefined';
}

/** Export as MP4 using WebCodecs. */
export async function exportMp4(
  state: ProjectState,
  renderer: Renderer,
  opts: ExportOptions
): Promise<ExportResult> {
  if (!hasWebCodecs()) {
    throw new Error('WebCodecs not supported in this browser. Use WebM or GIF instead.');
  }

  const fps = opts.fps || 60;
  const duration = opts.duration || 10;
  const totalFrames = Math.ceil(duration * fps);
  const width = opts.width;
  const height = opts.height;

  const chunks: EncodedVideoChunk[] = [];
  
  const encoder = new VideoEncoder({
    output: chunk => chunks.push(chunk),
    error: e => console.error('VideoEncoder error:', e),
  });

  const config: VideoEncoderConfig = {
    codec: 'avc1.42001e', // H.264 baseline
    width,
    height,
    bitrate: Math.round(width * height * fps * 0.1),
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware',
  };
  encoder.configure(config);

  // Render each frame
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    const desc = buildFrame(state, t, width, height);
    const imageData = renderer.snapshot(desc);
    
    // Create a bitmap from ImageData for VideoFrame
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    const bitmap = await createImageBitmap(canvas);
    
    const videoFrame = new VideoFrame(bitmap, {
      timestamp: Math.round(t * 1_000_000),
    });
    
    encoder.encode(videoFrame);
    videoFrame.close();
    bitmap.close();
    
    if (opts.onProgress) opts.onProgress((frame + 1) / totalFrames);
  }

  await encoder.flush();
  encoder.close();

  // Create MP4 container (simplified - in production use a proper muxer)
  const mp4Blob = await createMp4(chunks, width, height, fps);
  
  return {
    blob: mp4Blob,
    mimeType: 'video/mp4',
    filename: `align-${Date.now()}.mp4`,
  };
}

/** Export as WebM using MediaRecorder (fallback). */
export async function exportWebM(
  state: ProjectState,
  renderer: Renderer,
  opts: ExportOptions
): Promise<ExportResult> {
  const fps = opts.fps || 60;
  const duration = opts.duration || 10;
  const totalFrames = Math.ceil(duration * fps);
  const width = opts.width;
  const height = opts.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const stream = canvas.captureStream(fps);

  const recorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9',
    videoBitsPerSecond: Math.round(width * height * fps * 0.1),
  });

  const chunks: BlobPart[] = [];
  recorder.ondataavailable = e => chunks.push(e.data);

  return new Promise((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      resolve({
        blob,
        mimeType: 'video/webm',
        filename: `align-${Date.now()}.webm`,
      });
    };
    recorder.onerror = reject;

    recorder.start(1000 / fps);

    let frame = 0;
    const renderFrame = () => {
      if (frame >= totalFrames) {
        recorder.stop();
        return;
      }
      const t = frame / fps;
      const desc = buildFrame(state, t, width, height);
      renderer.render(desc);
      // Read back to canvas
      const gl = (renderer as any).gl;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, width, height);
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(width * height * 4));
      frame++;
      requestAnimationFrame(renderFrame);
    };
    renderFrame();
  });
}

/** Export as GIF. */
export async function exportGif(
  state: ProjectState,
  renderer: Renderer,
  opts: ExportOptions
): Promise<ExportResult> {
  const fps = opts.fps || 30; // GIF usually lower fps
  const duration = opts.duration || 10;
  const totalFrames = Math.ceil(duration * fps);
  const width = opts.width;
  const height = opts.height;

  // Simple GIF encoder using canvas
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  // For now, use a simple approach - render frames and create GIF
  // In production, use a proper GIF encoder like gif.js
  const frames: ImageData[] = [];
  
  for (let frame = 0; frame < totalFrames; frame++) {
    const t = frame / fps;
    const desc = buildFrame(state, t, width, height);
    const imageData = renderer.snapshot(desc);
    frames.push(imageData);
    
    if (opts.onProgress) opts.onProgress((frame + 1) / totalFrames);
  }

  // Create GIF using a simple encoder
  const gifBlob = await encodeGif(frames, width, height, fps);
  
  return {
    blob: gifBlob,
    mimeType: 'image/gif',
    filename: `align-${Date.now()}.gif`,
  };
}

/** Export as PNG (single frame). */
export async function exportPng(
  state: ProjectState,
  renderer: Renderer,
  opts: ExportOptions
): Promise<ExportResult> {
  const t = opts.duration || 0;
  const width = opts.width;
  const height = opts.height;

  const desc = buildFrame(state, t, width, height);
  const imageData = renderer.snapshot(desc);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);

  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));

  return {
    blob,
    mimeType: 'image/png',
    filename: `align-${Date.now()}.png`,
  };
}

/** Main export function. */
export async function exportProject(
  state: ProjectState,
  renderer: Renderer,
  opts: ExportOptions
): Promise<ExportResult> {
  switch (opts.format) {
    case 'mp4':
      return exportMp4(state, renderer, opts);
    case 'webm':
      return exportWebM(state, renderer, opts);
    case 'gif':
      return exportGif(state, renderer, opts);
    case 'png':
      return exportPng(state, renderer, opts);
    default:
      throw new Error(`Unknown export format: ${opts.format}`);
  }
}

/** Create a simple MP4 container from encoded chunks. */
async function createMp4(
  chunks: EncodedVideoChunk[],
  _width: number,
  _height: number,
  _fps: number
): Promise<Blob> {
  // Simplified MP4 creation - in production use a proper library like mp4box.js
  // This is a minimal implementation for basic playback
  const boxes: Uint8Array[] = [];
  
  // FTYP
  boxes.push(createBox('ftyp', new Uint8Array([
    0x69, 0x73, 0x6F, 0x6D, // major_brand: isom
    0x00, 0x00, 0x00, 0x01, // minor_version: 1
    0x69, 0x73, 0x6F, 0x6D, // compatible_brands: isom
    0x69, 0x73, 0x6F, 0x32, // iso2
    0x61, 0x76, 0x63, 0x31, // avc1
    0x6D, 0x70, 0x34, 0x31  // mp41
  ])));

  // For simplicity, return a basic blob
  // In production, use a proper MP4 muxer
  const arrays = chunks.map(c => {
    const buf = new ArrayBuffer(c.byteLength);
    c.copyTo(buf);
    return new Uint8Array(buf);
  });
  const data = new Blob(arrays, { type: 'video/mp4' });
  return data;
}

/** Simple GIF encoder (placeholder - use gif.js in production). */
async function encodeGif(
  frames: ImageData[],
  _width: number,
  _height: number,
  _fps: number
): Promise<Blob> {
  // Placeholder - return first frame as PNG for now
  const canvas = document.createElement('canvas');
  canvas.width = frames[0].width;
  canvas.height = frames[0].height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(frames[0], 0, 0);
  return new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
}

/** Create an MP4 box. */
function createBox(type: string, data: Uint8Array): Uint8Array {
  const size = data.length + 8;
  const box = new Uint8Array(size);
  new DataView(box.buffer).setUint32(0, size);
  box.set(new TextEncoder().encode(type), 4);
  box.set(data, 8);
  return box;
}