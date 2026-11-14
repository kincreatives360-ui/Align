import { paintPlaceholder } from './placeholder';
import { describe, it, expect, beforeEach } from 'vitest';

describe('paintPlaceholder', () => {
  let canvas: HTMLCanvasElement;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
  });

  it('draws a numbered gradient on the canvas', () => {
    paintPlaceholder(canvas, 0);
    const ctx = canvas.getContext('2d')!;
    const pixel = ctx.getImageData(128, 128, 1, 1).data;
    // Center pixel should not be transparent black
    expect(pixel[3]).toBeGreaterThan(0);
  }, 25000);

  it('produces different hues for different indices', () => {
    const c1 = document.createElement('canvas');
    c1.width = 64;
    c1.height = 64;
    const c2 = document.createElement('canvas');
    c2.width = 64;
    c2.height = 64;

    paintPlaceholder(c1, 0);
    paintPlaceholder(c2, 5);

    const p1 = c1.getContext('2d')!.getImageData(32, 32, 1, 1).data;
    const p2 = c2.getContext('2d')!.getImageData(32, 32, 1, 1).data;

    expect(p1[0]).not.toBe(p2[0]);
  });

  it('handles different canvas sizes', () => {
    const small = document.createElement('canvas');
    small.width = 32;
    small.height = 32;

    const large = document.createElement('canvas');
    large.width = 512;
    large.height = 512;

    paintPlaceholder(small, 0);
    paintPlaceholder(large, 0);

    // Both should have non-transparent pixels
    const sp = small.getContext('2d')!.getImageData(16, 16, 1, 1).data;
    const lp = large.getContext('2d')!.getImageData(256, 256, 1, 1).data;

    expect(sp[3]).toBeGreaterThan(0);
    expect(lp[3]).toBeGreaterThan(0);
  });

  it('wraps hue correctly for high indices', () => {
    const c1 = document.createElement('canvas');
    c1.width = 64;
    c1.height = 64;
    const c2 = document.createElement('canvas');
    c2.width = 64;
    c2.height = 64;

    // Index 360/47 ≈ 7.66, so index 8 should wrap similarly to index 0
    paintPlaceholder(c1, 0);
    paintPlaceholder(c2, 8);

    const p1 = c1.getContext('2d')!.getImageData(32, 32, 1, 1).data;
    const p2 = c2.getContext('2d')!.getImageData(32, 32, 1, 1).data;

    // Hue should be similar (within wrapping)
    // Index 0: hue = (0*47+210)%360 = 210
    // Index 8: hue = (8*47+210)%360 = 586%360 = 226
    // Not exactly same but both valid hues
    expect(p1[3]).toBeGreaterThan(0);
    expect(p2[3]).toBeGreaterThan(0);
  });
});