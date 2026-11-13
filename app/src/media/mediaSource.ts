import type { FaceRef, MediaItem, MediaState } from '../state/types';
import { mulberry } from '../engine/math';
import { getUrl } from './objectUrls';

/**
 * Where the renderer gets pixels from.
 *
 * `ingest.ts` only records an object URL for each file. Nothing ever turned that
 * URL into an <img> or <video> the GPU could use, so uploaded media never made it
 * onto a card. This module does that: it loads each item once, keeps the element,
 * and tells the canvas to redraw when something finishes loading.
 */

interface VideoEl extends HTMLVideoElement {
  _ver?: number;
  _ft?: number;
}

interface Entry {
  el: HTMLImageElement | VideoEl;
  url: string;
  ready: boolean;
}

const cache = new Map<string, Entry>();
let onChange: () => void = () => {};
let wantPlaying = false;

/** The canvas registers here so it redraws when an image finishes loading or a video has a new frame. */
export function setMediaChangeListener(fn: () => void): void {
  onChange = fn;
}

function urlFor(item: MediaItem): string | undefined {
  return item.libraryPath ?? getUrl(item.id);
}

function loadImage(url: string, cors: boolean): Entry {
  const el = new Image();
  const entry: Entry = { el, url, ready: false };
  if (cors) el.crossOrigin = 'anonymous';
  el.decoding = 'async';
  el.onload = () => {
    entry.ready = true;
    onChange();
  };
  el.onerror = () => {
    /* leave `ready` false: the card keeps its placeholder */
  };
  el.src = url;
  return entry;
}

function loadVideo(url: string, cors: boolean): Entry {
  const el = document.createElement('video') as VideoEl;
  const entry: Entry = { el, url, ready: false };
  if (cors) el.crossOrigin = 'anonymous';
  el.muted = true;
  el.loop = true;
  el.playsInline = true;
  el.preload = 'auto';
  el._ver = 0;
  el._ft = 0;

  const bump = () => {
    el._ver = (el._ver ?? 0) + 1;
    el._ft = performance.now();
    onChange();
  };

  el.onloadeddata = () => {
    entry.ready = true;
    // `requestVideoFrameCallback` is missing in older Safari/Firefox, hence the loose type.
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
    onChange();
  };
  el.src = url;
  return entry;
}

/** The loaded element for an item, or null while it is still loading or its URL is gone. */
export function elementFor(item: MediaItem): HTMLImageElement | HTMLVideoElement | null {
  const url = urlFor(item);
  if (!url) return null;

  let entry = cache.get(item.id);
  if (entry && entry.url !== url) {
    disposeEntry(entry);
    cache.delete(item.id);
    entry = undefined;
  }
  if (!entry) {
    const cors = !!item.libraryPath;
    entry = item.kind === 'video' ? loadVideo(url, cors) : loadImage(url, cors);
    cache.set(item.id, entry);
  }
  return entry.ready ? entry.el : null;
}

function disposeEntry(entry: Entry): void {
  if (entry.el instanceof HTMLVideoElement) {
    entry.el.pause();
    entry.el.removeAttribute('src');
    entry.el.load();
  }
}

/** Call when an item is removed for good. */
export function dropMedia(id: string): void {
  const entry = cache.get(id);
  if (entry) disposeEntry(entry);
  cache.delete(id);
}

/** Videos only play while the timeline plays, so a paused project costs nothing. */
export function setVideosPlaying(playing: boolean): void {
  wantPlaying = playing;
  for (const entry of cache.values()) {
    if (!(entry.el instanceof HTMLVideoElement) || !entry.ready) continue;
    if (playing) void entry.el.play().catch(() => {});
    else entry.el.pause();
  }
}

let phCanvas: HTMLCanvasElement | null = null;

/** A stand-in face for cards with no media yet. The renderer paints it as a numbered gradient. */
export function placeholderFace(k: number, aspect: number, res: number): FaceRef {
  phCanvas ??= document.createElement('canvas');
  return { key: `ph:${((k % 12) + 12) % 12}`, aspect, res, kind: 'image', img: phCanvas };
}

/** The face for one card: the real media if it is loaded, otherwise a placeholder. */
export function faceFor(item: MediaItem | undefined, k: number, aspect: number, res: number): FaceRef {
  if (item) {
    const el = elementFor(item);
    if (el) return { key: item.id, aspect, res, kind: item.kind, img: el };
  }
  return placeholderFace(k, aspect, res);
}

/**
 * Which media item card `k` shows. "In order" cycles the list; "shuffle" cycles a
 * permutation that depends only on the seed, so a given seed always looks the same.
 */
export function mediaPicker(media: MediaState): (k: number) => MediaItem | undefined {
  const n = media.images.length;
  if (n === 0) return () => undefined;

  const idx = Array.from({ length: n }, (_, i) => i);
  if (media.order === 'shuffle') {
    const rnd = mulberry((media.seed | 0) || 1);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
  }
  return k => media.images[idx[((k % n) + n) % n]];
}
