import { getVideo, seekVideo, disposeAllVideos, setVideosPlaying } from './video';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { MediaItem } from '../state/types';

// Mock MediaItem with a valid URL
const mockVideoItem: MediaItem = {
  id: 'test-video-1',
  kind: 'video',
  name: 'test.mp4',
  width: 1920,
  height: 1080,
  libraryPath: 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAA4hmdGF0', // minimal MP4
};

describe('video frame sync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    setVideosPlaying(false);
    disposeAllVideos();
  });

  afterEach(() => {
    vi.useRealTimers();
    disposeAllVideos();
    vi.restoreAllMocks();
  });

  it('increments _ver on seeked event', async () => {
    const el = getVideo(mockVideoItem);
    expect(el).not.toBeNull();
    if (!el) return;

    // Manually trigger loadeddata to set up callbacks
    el.dispatchEvent(new Event('loadeddata'));
    await vi.runAllTimersAsync();

    const initialVer = el._ver ?? 0;

    // Trigger seek
    const seekPromise = seekVideo(mockVideoItem, 1.5);

    // Simulate seeked event
    el.dispatchEvent(new Event('seeked'));

    await seekPromise;

    expect(el._ver).toBeGreaterThan(initialVer);
  });

  it('increments _ver via requestVideoFrameCallback when available', async () => {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'requestVideoFrameCallback');
    const callbacks: Array<() => void> = [];
    Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', {
      configurable: true,
      value: vi.fn((callback: () => void) => {
        callbacks.push(callback);
        return callbacks.length;
      }),
    });
    try {
      const el = getVideo(mockVideoItem);
      expect(el).not.toBeNull();
      if (!el) return;

      el.dispatchEvent(new Event('loadeddata'));
      const initialVer = el._ver ?? 0;
      expect(callbacks).toHaveLength(1);

      callbacks[0]();

      expect(el._ver).toBe(initialVer + 1);
      expect(callbacks).toHaveLength(2);
    } finally {
      if (descriptor) Object.defineProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback', descriptor);
      else Reflect.deleteProperty(HTMLVideoElement.prototype, 'requestVideoFrameCallback');
    }
  });

  it('bumps _ver on timeupdate when rVFC not available', async () => {
    const el = getVideo(mockVideoItem);
    expect(el).not.toBeNull();
    if (!el) return;

    // Manually trigger loadeddata to set up callbacks
    el.dispatchEvent(new Event('loadeddata'));
    await vi.runAllTimersAsync();

    const initialVer = el._ver ?? 0;

    // Simulate timeupdate event
    el.dispatchEvent(new Event('timeupdate'));
    await vi.runAllTimersAsync();

    expect(el._ver).toBeGreaterThan(initialVer);
  });

  it('serializes overlapping seeks and lets each request restore its handler', async () => {
    const el = getVideo(mockVideoItem);
    expect(el).not.toBeNull();
    if (!el) return;
    el.dispatchEvent(new Event('loadeddata'));
    const originalOnSeeked = el.onseeked;

    const first = seekVideo(mockVideoItem, 1);
    await Promise.resolve();
    expect(el.currentTime).toBe(1);
    const second = seekVideo(mockVideoItem, 2);

    el.dispatchEvent(new Event('seeked'));
    await first;
    await Promise.resolve();
    expect(el.currentTime).toBe(2);
    expect(el.onseeked).not.toBe(originalOnSeeked);

    el.dispatchEvent(new Event('seeked'));
    await second;
    expect(el.onseeked).toBe(originalOnSeeked);
    expect(vi.getTimerCount()).toBe(0);
  });
});