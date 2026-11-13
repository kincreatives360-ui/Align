import { useEffect, useRef } from 'react';
import { Renderer } from '../../render/Renderer';
import { buildFrame } from '../../engine/buildFrame';
import { useProject } from '../../state/store';
import { useClock } from '../../state/clockStore';

/**
 * The WebGL surface.
 *
 * React owns the element and nothing else: the drawing loop reads the stores
 * imperatively, so no React re-render ever touches a pixel. The context is
 * created once and torn down on unmount, and losing the context (which the
 * reference implementation never handled) shows a message instead of a black
 * rectangle.
 */
export function StageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<Renderer | null>(null);
  const sizeRef = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onLost = (e: Event) => {
      e.preventDefault();
      canvas.dataset.lost = '1';
    };
    const onRestored = () => {
      delete canvas.dataset.lost;
      // Recreate renderer on context restore
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = new Renderer(canvas);
        // Force resize on restore
        sizeRef.current = { width: 0, height: 0 };
      }
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    // Create renderer
    rendererRef.current = new Renderer(canvas);

    let raf = 0;
    let last = performance.now();

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));
      const dpr = window.devicePixelRatio || 1;
      
      // Only resize if size actually changed
      if (sizeRef.current.width !== width || sizeRef.current.height !== height) {
        sizeRef.current = { width, height };
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      resizeCanvas();

      const store = useProject.getState();
      if (store.dirty) {
        const state = store.state;
        const clock = useClock.getState();
        if (clock.playing) clock.advance(dt);

        const width = sizeRef.current.width;
        const height = sizeRef.current.height;
        if (width > 0 && height > 0) {
          const desc = buildFrame(state, clock.t, width, height);
          rendererRef.current!.render(desc);
        }
        store.clearDirty();
      }
      raf = requestAnimationFrame(loop);
    };

    // Initial resize
    resizeCanvas();
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current = null;
      }
    };
  }, []);

  return <canvas ref={canvasRef} id="canvas" />;
}