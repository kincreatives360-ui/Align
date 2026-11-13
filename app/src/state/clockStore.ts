import { create } from 'zustand';
import { useProject } from './store';

/**
 * The playhead.
 *
 * Time is deliberately *not* part of `ProjectState`: it is not project data,
 * it must never be saved to a file, and it must never appear in an undo
 * snapshot. Keeping it here also means dragging the scrubber does not touch
 * the undo stack at all.
 */
interface ClockStore {
  /** Current playhead position in seconds. */
  t: number;
  playing: boolean;

  advance: (dt: number) => void;
  seek: (t: number) => void;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  restart: () => void;
}

function markDirty() {
  useProject.getState().markDirty();
}

export const useClock = create<ClockStore>((set, get) => ({
  t: 0,
  playing: false,

  advance: dt => {
    set({ t: get().t + dt });
    markDirty();
  },
  seek: t => {
    set({ t: Math.max(0, t) });
    markDirty();
  },
  toggle: () => {
    set({ playing: !get().playing });
    markDirty();
  },
  play: () => {
    set({ playing: true });
    markDirty();
  },
  pause: () => {
    set({ playing: false });
    markDirty();
  },
  restart: () => {
    set({ t: 0 });
    markDirty();
  },
}));
