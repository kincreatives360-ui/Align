import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

const PAD_X = 56; // .view horizontal padding, 28px a side
const PAD_Y = 140; // .view vertical padding, 70px top and bottom

export interface Box {
  width: number;
  height: number;
}

/**
 * Work out the largest box of the given aspect ratio that fits inside the
 * measured element.
 *
 * Doing this with a ResizeObserver rather than CSS keeps the box exact for
 * every aspect ratio — including tall ones like 9:16, where a plain
 * `aspect-ratio` would overflow.
 */
export function useFitBox(ratio: number): [RefObject<HTMLDivElement | null>, Box] {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<Box>({ width: 640, height: 360 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      const rect = el.getBoundingClientRect();
      const availW = Math.max(1, rect.width - PAD_X);
      const availH = Math.max(1, rect.height - PAD_Y);

      let width = availW;
      let height = width / ratio;
      if (height > availH) {
        height = availH;
        width = height * ratio;
      }

      const w = Math.max(1, Math.round(width));
      const h = Math.max(1, Math.round(height));
      setBox(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ratio]);

  return [ref, box];
}
