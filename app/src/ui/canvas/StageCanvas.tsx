import { useEffect, useRef, useState } from 'react';
import { Renderer } from '../../render/Renderer';
import { buildFrame } from '../../engine/buildFrame';
import { useProject } from '../../state/store';
import { useClock } from '../../state/clockStore';
import { setMediaChangeListener, setVideosPlaying } from '../../media/mediaSource';

/** Cap the backing store at 2x so a 3x phone does not render 9 pixels per CSS pixel. */
const MAX_DPR = 2;

const overlayStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
  textAlign: 'center',
  font: '500 13px/1.5 Inter, system-ui, sans-serif',
  color: 'var(--text, #ddd)',
  background: 'rgba(0,0,0,0.55)',
};

/**
 * The WebGL surface.
 *
 * React owns the element and nothing else: the drawing loop reads the stores
 * imperatively, so no React re-render ever touches a pixel.
 *
 * What the loop does each animation frame:
 *   1. If the clock is playing, advance it. (The old loop did this only when the
 *      project was "dirty", and nothing marked it dirty during playback, so Play
 *      did nothing.)
 *   2. Size the backing store in DEVICE pixels. (The old loop used CSS pixels for
 *      the render size on a dpr-sized canvas, so retina screens showed the image
 *      in one corner.)
 *   3. Draw if anything changed: project edit, playhead moved (play, scrub, arrow
 *      keys), canvas resized, context restored, or a media file finished loading.
 */
export function StageCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let renderer: Renderer | null = null;
    let contextLost = false;
    let force = true;
    let lastT = Number.NaN;
    let reported = false;
    let raf = 0;
    let last = performance.now();

    const create = () => {
      try {
        renderer = new Renderer(canvas);
        setError(null);
      } catch (e) {
        renderer = null;
        setError(e instanceof Error ? e.message : 'WebGL could not start.');
      }
    };

    const onLost = (e: Event) => {
      e.preventDefault(); // required, or the browser never fires "restored"
      contextLost = true;
      setLost(true);
    };

    const onRestored = () => {
      contextLost = false;
      setLost(false);
      renderer?.abandon(); // its GPU objects died with the old context
      create();
      force = true; // nothing else would trigger a redraw
      reported = false;
    };

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);

    create();

    // A loading image or a new video frame needs a redraw even if nothing else changed.
    setMediaChangeListener(() => {
      force = true;
    });
    setVideosPlaying(useClock.getState().playing);
    const unsubClock = useClock.subscribe((s, prev) => {
      if (s.playing !== prev.playing) setVideosPlaying(s.playing);
    });

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);

      const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
      last = now;

      if (useClock.getState().playing) useClock.getState().advance(dt);
      const t = useClock.getState().t;

      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      const pw = Math.max(1, Math.round(rect.width * dpr));
      const ph = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== pw || canvas.height !== ph) {
        canvas.width = pw; // resizing clears the buffer...
        canvas.height = ph;
        force = true; // ...so we must draw again
      }

      if (!renderer || contextLost) return;

      const store = useProject.getState();
      if (!(store.dirty || force || t !== lastT)) return;

      try {
        // buildFrame needs CSS pixels for layout; then we set device pixels on the descriptor
        const cssW = Math.max(1, Math.round(rect.width));
        const cssH = Math.max(1, Math.round(rect.height));
        const desc = buildFrame(store.state, t, cssW, cssH);
        desc.W = pw;
        desc.H = ph;
        renderer.render(desc);
      } catch (err) {
        if (!reported) {
          reported = true;
          console.error('Align: frame failed to render', err);
        }
      }
      lastT = t;
      force = false;
      store.clearDirty();
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      unsubClock();
      setMediaChangeListener(() => {});
      renderer?.dispose();
      renderer = null;
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} id="canvas" data-lost={lost ? '1' : undefined} />
      {(error || lost) && (
        <div style={overlayStyle} role="status">
          {error ? `The preview can't start: ${error}` : 'The graphics context was lost. Restoring…'}
        </div>
      )}
    </>
  );
}
