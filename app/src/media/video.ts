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
  return new Promise((resolve, reject) => {
    const originalOnSeeked = entry.el.onseeked;
    entry.el.onseeked = () => {
      entry.el.onseeked = originalOnSeeked;
      if (typeof originalOnSeeked === 'function') {
        originalOnSeeked.call(entry.el, new Event('seeked'));
      }
      resolve();
    };
    entry.el.currentTime = time;
    // Timeout fallback
    setTimeout(() => {
      entry.el.onseeked = originalOnSeeked;
      reject(new Error('Seek timeout'));
    }, 5000);
  });
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