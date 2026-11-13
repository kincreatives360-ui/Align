import { useRef } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { useClock } from '../../state/clockStore';
import { useProject } from '../../state/store';
import { clipLength, wrapTime } from '../../engine/timing';

/**
 * The track, fill and playhead.
 *
 * Scrubbing pauses playback for the duration of the drag and restores it
 * afterwards, and it writes straight to the clock — never to project state —
 * so moving the playhead creates no undo step.
 */
export function TimelineScrubber() {
  const rootRef = useRef<HTMLDivElement>(null);
  const time = useClock(s => s.t);
  const project = useProject(s => s.state);
  const rev = useProject(s => s.rev);

  const len = clipLength(project);
  const wrapped = wrapTime(time, len);
  const fraction = len > 0 ? wrapped / len : 0;
  void rev; // re-read when the project changes so the length stays correct

  const seekFrom = (clientX: number) => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const frac = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    useClock.getState().seek(frac * clipLength(useProject.getState().state) * 0.9999);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const el = rootRef.current;
    if (!el) return;
    el.setPointerCapture(e.pointerId);

    const wasPlaying = useClock.getState().playing;
    useClock.getState().pause();
    seekFrom(e.clientX);

    const move = (ev: PointerEvent) => seekFrom(ev.clientX);
    const up = () => {
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      if (wasPlaying) useClock.getState().play();
    };

    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  };

  return (
    <div
      ref={rootRef}
      className="scrub"
      role="slider"
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={Math.round(len * 10) / 10}
      aria-valuenow={Math.round(wrapped * 10) / 10}
      onPointerDown={onPointerDown}
    >
      <div className="tr" />
      <div className="fi" style={{ width: `${fraction * 100}%` }} />
      <div className="hd" style={{ left: `${fraction * 100}%` }} />
    </div>
  );
}
