// Exports. Video and sequences render every frame at an exact timestamp, so the output is frame-perfect
// at any fps regardless of how long each frame takes to draw.
const CDN = {
  mp4: 'https://cdn.jsdelivr.net/npm/mp4-muxer@5.1.3/+esm',
  webm: 'https://cdn.jsdelivr.net/npm/webm-muxer@5.0.3/+esm',
  gif: 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/+esm',
  zip: 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/+esm',
};
const libs = {};
const lib = async k => libs[k] || (libs[k] = await import(CDN[k]));

export const QUALITY = {low: .05, medium: .09, high: .14, max: .22};
export const canEncode = () => 'VideoEncoder' in window && 'VideoFrame' in window;
export const bitrateFor = (W, H, fps, q) => Math.min(150e6, Math.max(2e6, W * H * fps * (QUALITY[q] || .14)));

async function pickConfig(format, W, H, fps, bitrate){
  const list = format === 'webm' ? ['vp09.00.51.08', 'vp09.00.41.08', 'vp09.00.31.08', 'vp8']
    : ['avc1.640034', 'avc1.640033', 'avc1.640032', 'avc1.64002a', 'avc1.640028', 'avc1.4d0034', 'avc1.42003e', 'avc1.42001f'];
  for (const codec of list){
    const c = {codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality'};
    try { if ((await VideoEncoder.isConfigSupported(c)).supported) return c; } catch (e){}
  }
  return null;
}
const tick = () => new Promise(r => setTimeout(r, 0));

/* app.drawExport(T, W, H) renders one frame into app.canvas at W×H. Before every frame, `await app.prepareFrame(T)`
   seeks each video in use to its time for T and waits for that frame, so video exports stay frame-exact. */
const prep = (app, T) => app.prepareFrame?.(T);
export async function exportVideo(app, {format = 'mp4', W, H, fps = 60, quality = 'high', duration, onProgress, signal}){
  if (!canEncode()) throw new Error('This browser has no WebCodecs video encoder. Use Chrome, Edge or a recent Safari.');
  const bitrate = bitrateFor(W, H, fps, quality);
  const config = await pickConfig(format, W, H, fps, bitrate);
  if (!config) throw new Error(`${format.toUpperCase()} at ${W}×${H} isn't supported by this browser's encoder. Try a lower resolution or the other format.`);
  const M = await lib(format === 'webm' ? 'webm' : 'mp4');
  const muxer = format === 'webm'
    ? new M.Muxer({target: new M.ArrayBufferTarget(), video: {codec: config.codec.startsWith('vp8') ? 'V_VP8' : 'V_VP9', width: W, height: H, frameRate: fps}})
    : new M.Muxer({target: new M.ArrayBufferTarget(), video: {codec: 'avc', width: W, height: H, frameRate: fps}, fastStart: 'in-memory'});
  let failure = null;
  const enc = new VideoEncoder({output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: e => failure = e});
  enc.configure(config);
  const N = Math.max(1, Math.round(duration * fps));
  for (let i = 0; i < N; i++){
    if (signal?.aborted){ enc.close(); throw new DOMException('Export cancelled', 'AbortError'); }
    if (failure) throw failure;
    await prep(app, i / fps);
    app.drawExport(i / fps, W, H);
    const vf = new VideoFrame(app.canvas, {timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps)});
    enc.encode(vf, {keyFrame: i % (fps * 2) === 0});
    vf.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
    if (i % 4 === 0){ onProgress?.(i / N); await tick(); }
  }
  await enc.flush();
  if (failure) throw failure;
  muxer.finalize();
  onProgress?.(1);
  return new Blob([muxer.target.buffer], {type: format === 'webm' ? 'video/webm' : 'video/mp4'});
}

export async function exportGif(app, {W, H, fps = 25, colors = 256, duration, onProgress, signal}){
  const {GIFEncoder, quantize, applyPalette} = await lib('gif');
  const gif = GIFEncoder();
  const N = Math.max(1, Math.round(duration * fps)), delay = Math.round(1000 / fps);
  for (let i = 0; i < N; i++){
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    await prep(app, i / fps);
    const img = app.snapshot(i / fps, W, H, {opaque: true});
    const palette = quantize(img.data, colors, {format: 'rgb565'});
    gif.writeFrame(applyPalette(img.data, palette, 'rgb565'), W, H, {palette, delay});
    if (i % 2 === 0){ onProgress?.(i / N); await tick(); }
  }
  gif.finish();
  onProgress?.(1);
  return new Blob([gif.bytes()], {type: 'image/gif'});
}

function imageToBlob(img, type, q = .95){
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  if (type === 'image/jpeg'){ x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); const t = document.createElement('canvas'); t.width = img.width; t.height = img.height; t.getContext('2d').putImageData(img, 0, 0); x.drawImage(t, 0, 0); }
  else x.putImageData(img, 0, 0);
  return new Promise(r => c.toBlob(r, type, q));
}
export async function exportImage(app, {T, W, H, format = 'png', transparent = false}){
  const type = {png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp'}[format] || 'image/png';
  await prep(app, T);
  const img = app.snapshot(T, W, H, {transparent: transparent && format !== 'jpeg'});
  return imageToBlob(img, type);
}
export async function copyImage(app, {T, W, H}){
  const blob = await exportImage(app, {T, W, H, format: 'png'});
  await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
}
export async function exportSequence(app, {W, H, fps = 30, duration, transparent = false, onProgress, signal}){
  const {zipSync} = await lib('zip');
  const files = {}, N = Math.max(1, Math.round(duration * fps));
  for (let i = 0; i < N; i++){
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    await prep(app, i / fps);
    const blob = await imageToBlob(app.snapshot(i / fps, W, H, {transparent}), 'image/png');
    files[`frame_${String(i).padStart(5, '0')}.png`] = [new Uint8Array(await blob.arrayBuffer()), {level: 0}];
    if (i % 2 === 0){ onProgress?.(i / N); await tick(); }
  }
  onProgress?.(1);
  return new Blob([zipSync(files)], {type: 'application/zip'});
}
// Inside a claude.ai artifact the viewer approves each save; on a normal website it's a plain download.
let savesP = null;
const saves = () => savesP || (savesP = window.claude?.use ? window.claude.use('downloads').catch(() => null) : Promise.resolve(null));
export async function download(blob, name){
  const d = await saves();
  if (d){
    try { await d.save({filename: name, data: blob}); return 'saved'; }
    catch (e){ if (e?.code === 'declined') return 'declined'; if (e?.code === 'too_large') throw new Error('That file is too big to save here. Try a lower resolution.'); throw new Error(e?.message || 'Saving isn’t available in this view.'); }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'saved';
}
