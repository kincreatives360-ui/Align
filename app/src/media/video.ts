import type { MediaItem } from '../state/types';
import { getUrl } from './objectUrls';

/**
 * Video management - hidden looping holders, poster frames, exact seek.
 *
 * Videos are kept as <video> elements so we can seek precisely and get
 * poster frames for thumbnails. They live in a pool keyed by media id.
 */

interface VideoEl extends HTMLVideoElement {
  _ver?: number;
  _ft?: number;
  ready?: boolean;
}

interface PoolEntry {
  el: VideoEl;
  item: MediaItem;
  ready: boolean;
  url: string;
  poster?: HTMLCanvasElement;
  seekQueue?: Promise<void>;
}

const pool = new Map<string, PoolEntry>();
let wantPlaying = false;

/** Get or create a video element for an item. */
export function getVideo(item: MediaItem): VideoEl | null {
  if (item.kind !== 'video') return null;

  let entry = pool.get(item.id);
  if (entry) {
    if (entry.url !== item.id) {
      // URL changed, replace
      pool.delete(item.id);
      entry = undefined;
    }
  }
  if (!entry) {
    const url = item.libraryPath ?? getUrl(item.id);
    if (!url) return null;
    const el = document.createElement('video') as VideoEl;
    el.muted = true;
    el.loop = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el._ver = 0;
    el._ft = 0;
    el.src = url;

    entry = { el, item, ready: false, url };
    pool.set(item.id, entry);

    const bump = () => {
      el._ver = (el._ver ?? 0) + 1;
      el._ft = performance.now();
    };

    el.onloadeddata = () => {
      entry!.ready = true;
      const rvfc = el as unknown as { requestVideoFrameCallback?: (cb: () => void) => number };
      if (typeof rvfc.requestVideoFrameCallback === 'function') {
        const tick = () => {
          bump();
          rvfc.requestVideoFrameCallback!(tick);
        };
        rvfc.requestVideoFrameCallback(tick);
      } else {
        el.ontimeupdate = bump;
      }
      el.onseeked = bump;
      if (wantPlaying) void el.play().catch(() => {});
    };

    entry = { el, item, ready: true, url };
    pool.set(item.id, entry);
  }

  return entry!.el;
}

/** Set global play/pause state for all videos. */
export function setVideosPlaying(playing: boolean): void {
  wantPlaying = playing;
  for (const entry of pool.values()) {
    if (!entry.ready) continue;
    if (playing) void entry.el.play().catch(() => {});
    else entry.el.pause();
  }
}

/** Seek a video to an exact time. Returns a promise that resolves when seeked. */
export function seekVideo(item: MediaItem, time: number): Promise<void> {
  const entry = pool.get(item.id);
  if (!entry || !entry.ready) return Promise.reject(new Error('Video not ready'));
  const seek = () => new Promise<void>((resolve, reject) => {
    const originalOnSeeked = entry.el.onseeked;
    let timeout: ReturnType<typeof setTimeout>;
    const onSeeked = () => {
      clearTimeout(timeout);
      if (entry.el.onseeked === onSeeked) entry.el.onseeked = originalOnSeeked;
      if (typeof originalOnSeeked === 'function') originalOnSeeked.call(entry.el, new Event('seeked'));
      resolve();
    };
    entry.el.onseeked = onSeeked;
    timeout = setTimeout(() => {
      if (entry.el.onseeked === onSeeked) entry.el.onseeked = originalOnSeeked;
      reject(new Error('Seek timeout'));
    }, 5000);
    try {
      entry.el.currentTime = time;
    } catch (error) {
      clearTimeout(timeout);
      if (entry.el.onseeked === onSeeked) entry.el.onseeked = originalOnSeeked;
      reject(error);
    }
  });
  const request = entry.seekQueue ? entry.seekQueue.then(seek) : seek();
  entry.seekQueue = request.catch(() => undefined);
  return request;
}

/** Get a poster frame (first frame) as a canvas. */
export function getPoster(item: MediaItem): HTMLCanvasElement | undefined {
  const entry = pool.get(item.id);
  if (!entry || !entry.ready) return undefined;
  if (entry.poster) return entry.poster;

  const canvas = document.createElement('canvas');
  canvas.width = entry.el.videoWidth;
  canvas.height = entry.el.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;
  ctx.drawImage(entry.el, 0, 0);
  entry.poster = canvas;
  return canvas;
}

/** Dispose a video and its resources. */
export function disposeVideo(item: MediaItem): void {
  const entry = pool.get(item.id);
  if (entry) {
    entry.el.pause();
    entry.el.removeAttribute('src');
    entry.el.load();
    if (entry.poster) {
      entry.poster.width = 1;
      entry.poster.height = 1;
    }
    pool.delete(item.id);
  }
}

/** Dispose all videos. */
export function disposeAllVideos(): void {
  for (const [, entry] of pool) {
    entry.el.pause();
    entry.el.removeAttribute('src');
    entry.el.load();
    if (entry.poster) {
      entry.poster.width = 1;
      entry.poster.height = 1;
    }
  }
  pool.clear();
}

/** The video time for composition time T: the clip loops over the video's own length. */
export function videoTime(v: HTMLVideoElement, T: number): number {
  const d = v.duration || 1;
  return Math.min(d - 1e-3, ((T % d) + d) % d);
}

/** Sync all playing videos to the composition clock (preview). */
export function syncVideos(T: number): void {
  for (const entry of pool.values()) {
    if (!entry.ready || !entry.el.duration) continue;
    const want = videoTime(entry.el, T);
    const d = entry.el.duration;
    if (wantPlaying && !entry.el.paused && !document.hidden) {
      if (entry.el.paused) entry.el.play().catch(() => {});
      let diff = entry.el.currentTime - want;
      diff -= d * Math.round(diff / d);
      if (Math.abs(diff) > 0.2 && !entry.el.seeking) entry.el.currentTime = want;
    } else {
      if (!entry.el.paused) entry.el.pause();
      if (Math.abs(entry.el.currentTime - want) > 0.004 && !entry.el.seeking) entry.el.currentTime = want;
    }
  }
}

/** Before each export frame, seek every video to its time for T and wait for that frame. */
export async function prepareFrame(T: number): Promise<void> {
  const vs = Array.from(pool.values()).filter(e => e.ready);
  if (!vs.length) return;
  await Promise.all(vs.map(entry => seekVideo(entry.item, videoTime(entry.el, T)).then(() => {
    entry.el._ver = (entry.el._ver ?? 0) + 1;
  })));
}

/** Ensure all videos required by the current composition are ready before export. */
export async function ensureVideosReady(items: MediaItem[]): Promise<void> {
  const required = items.filter(i => i.kind === 'video');
  if (!required.length) return;
  await Promise.all(required.map(item => {
    return new Promise<void>((resolve, _reject) => {
      const entry = pool.get(item.id);
      if (entry && entry.ready) return resolve();
      if (entry) {
        // Wait for loadeddata
        const checkReady = () => {
          if (entry.ready) resolve();
          else setTimeout(checkReady, 50);
        };
        checkReady();
      } else {
        // Video not in pool yet, try to load it
        getVideo(item);
        const checkReady = () => {
          const e = pool.get(item.id);
          if (e && e.ready) resolve();
          else setTimeout(checkReady, 50);
        };
        checkReady();
      }
    });
  }));
}