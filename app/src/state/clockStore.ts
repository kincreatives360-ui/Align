import { create } from 'zustand';

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

export const useClock = create<ClockStore>((set, get) => ({
  t: 0,
  playing: false,

  advance: dt => set({ t: get().t + dt }),
  seek: t => set({ t: Math.max(0, t) }),
  toggle: () => set({ playing: !get().playing }),
  play: () => set({ playing: true }),
  pause: () => set({ playing: false }),
  restart: () => set({ t: 0 }),
}));
