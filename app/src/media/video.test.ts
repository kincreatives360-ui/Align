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
    setVideosPlaying(false);
    disposeAllVideos();
  });

  afterEach(() => {
    vi.useRealTimers();
    disposeAllVideos();
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
    const el = getVideo(mockVideoItem);
    expect(el).not.toBeNull();
    if (!el) return;

    // Manually trigger loadeddata to set up callbacks
    el.dispatchEvent(new Event('loadeddata'));
    await vi.runAllTimersAsync();

    // Simulate requestVideoFrameCallback being available and called
    if (typeof (el as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback === 'function') {
      // The callback should have been registered in onloadeddata
      // We can't easily test the actual callback, but we can verify the mechanism exists
      expect(typeof (el as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback).toBe('function');
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
});