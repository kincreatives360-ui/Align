import { useEffect, useRef } from 'react';

/**
 * The WebGL surface.
 *
 * React owns the element and nothing else: the drawing loop reads the stores
 * imperatively, so no React re-render ever touches a pixel. The context is
 * created once and torn down on unmount, and losing the context (which the
 * reference implementation never handled) shows a message instead of a black
 * rectangle.
 *
 * Milestone 2 fills in the actual renderer.
 */
export function StageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const onLost = (e: Event) => {
      e.preventDefault();
      canvas.dataset.lost = '1';
    };
    const onRestored = () => {
      delete canvas.dataset.lost;
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, []);

  return <canvas ref={canvasRef} id="canvas" />;
}
