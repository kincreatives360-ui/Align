// Media helpers: decoding uploads, video elements and their clock, posters, and the AlignCanvas library.
export const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|ogv|avi|3gp)$/i;
export const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|bmp|svg|heic|heif|tiff?)$/i;

export const kindOf = (f: File): 'video' | 'image' | null =>
  f.type?.startsWith('video/') || (!f.type && VIDEO_EXT.test(f.name)) ? 'video'
  : f.type?.startsWith('image/') || (!f.type && IMAGE_EXT.test(f.name)) ? 'image' : null;

export const isVideo = (el: HTMLElement | null): el is HTMLVideoElement => el?.tagName === 'VIDEO';

export const fmtDur = (s: number): string => {
  s = Math.max(0, Math.round(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => im.naturalWidth ? res(im) : rej(new Error('empty image'));
    im.onerror = () => rej(new Error('cannot decode image'));
    im.src = url;
  });
}

interface VideoEl extends HTMLVideoElement {
  _ver: number;
  _ft: number;
}

let hold: HTMLDivElement | null = null;
const holder = (): HTMLDivElement => hold || (hold = document.body.appendChild(Object.assign(document.createElement('div'), {
  style: 'position:fixed;left:0;top:0;width:2px;height:2px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1', ariaHidden: 'true'
})));

export function loadVideo(url: string, timeout = 15000): Promise<HTMLVideoElement> {
  return new Promise((res, rej) => {
    const v = document.createElement('video') as VideoEl;
    Object.assign(v, { muted: true, defaultMuted: true, loop: true, playsInline: true, preload: 'auto', crossOrigin: 'anonymous' });
    v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
    const done = (ok: boolean) => { clearTimeout(t); v.onloadeddata = v.onerror = null; if (ok) res(v); else { v.removeAttribute('src'); v.load(); v.remove(); rej(new Error('cannot decode video')); } };
    const t = setTimeout(() => done(false), timeout);
    v.onloadeddata = () => done(v.videoWidth > 0 && isFinite(v.duration) && v.duration > 0);
    v.onerror = () => done(false);
    v.src = url;
    holder().append(v);
    v._ver = 0; v._ft = 0;
    if ('requestVideoFrameCallback' in v) { const f = () => { v._ver++; v._ft = performance.now(); v.requestVideoFrameCallback(f); }; v.requestVideoFrameCallback(f); }
    v.addEventListener('seeked', () => v._ver++);
  });
}

export function dropVideo(v: HTMLVideoElement): void {
  if (!isVideo(v)) return; v.pause(); v.removeAttribute('src'); v.load(); v.remove();
}

export function seekVideo(v: HTMLVideoElement, t: number): Promise<void> {
  v.pause();
  if (Math.abs(v.currentTime - t) < 1e-4 && !v.seeking && v.readyState >= 2) return Promise.resolve();
  return new Promise(res => {
    const fin = () => { clearTimeout(to); v.removeEventListener('seeked', fin); res(); };
    const to = setTimeout(fin, 4000);
    v.addEventListener('seeked', fin);
    v.currentTime = t;
  });
}

export const videoTime = (v: HTMLVideoElement, T: number): number => {
  const d = v.duration || 1; return Math.min(d - 1e-3, ((T % d) + d) % d);
};

export async function poster(v: HTMLVideoElement, max = 480): Promise<HTMLCanvasElement> {
  const d = v.duration || 0, t = Math.min(.5, d * .25);
  if (t > 0) await seekVideo(v, t);
  const s = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
  const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(v.videoWidth * s)); c.height = Math.max(2, Math.round(v.videoHeight * s));
  c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height);
  return c;
}

export const toBlob = (c: HTMLCanvasElement, type = 'image/jpeg', q = .85): Promise<Blob | null> =>
  new Promise(r => c.toBlob(r, type, q));

export function downscale(file: File, max = 2400): Promise<Blob> {
  return new Promise(res => {
    const url = URL.createObjectURL(file), im = new Image();
    im.onload = () => {
      URL.revokeObjectURL(url);
      const s = Math.min(1, max / Math.max(im.width, im.height));
      if (s === 1 && file.size < 2.5e6) { res(file); return; }
      const c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s);
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => res(b || file), file.type === 'image/png' ? 'image/png' : 'image/jpeg', .92);
    };
    im.onerror = () => { URL.revokeObjectURL(url); res(file); };
    im.src = url;
  });
}

export const blobToDataURL = (b: Blob): Promise<string> =>
  new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(b); });

export const dataURLToBlob = async (u: string): Promise<Blob> => (await fetch(u)).blob();

/* ---------- the AlignCanvas library: media/library/manifest.json ---------- */
const LIB = new URL('../media/library/', import.meta.url);

export const libUrl = (p: string): string => new URL(p, LIB).href;

let libP: Promise<LibraryItem[]> | null = null;

export interface LibraryItem {
  src: string;
  thumb?: string;
  name?: string;
  tags?: string[];
  w?: number;
  h?: number;
  kind?: 'image' | 'video';
}

export const library = (): Promise<LibraryItem[]> => libP || (libP = fetch(libUrl('manifest.json'), { cache: 'no-cache' })
  .then(r => r.ok ? r.json() : { items: [] })
  .then(j => (Array.isArray(j?.items) ? j.items : []).filter((i: any): i is { src: string; thumb?: string; name?: string; tags?: string[]; w?: number; h?: number; kind?: 'image' | 'video' } => i && typeof i.src === 'string').map((i: any) => ({
    ...i, name: i.name || i.src.replace(/^.*\//, '').replace(/\.\w+$/, ''), tags: Array.isArray(i.tags) ? i.tags : [],
    kind: i.kind || (VIDEO_EXT.test(i.src) ? 'video' : 'image')
  })))
  .catch(() => []));