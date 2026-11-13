import { create } from 'zustand';

/**
 * Whether the full-screen "drop your images" veil is showing.
 * A counter, not a boolean, because dragenter/dragleave nest.
 */
interface DropStore {
  depth: number;
  enter: () => void;
  leave: () => void;
  reset: () => void;
}

export const useDrop = create<DropStore>(set => ({
  depth: 0,
  enter: () => set(s => ({ depth: s.depth + 1 })),
  leave: () => set(s => ({ depth: Math.max(0, s.depth - 1) })),
  reset: () => set({ depth: 0 }),
}));

export const isDropVisible = (depth: number) => depth > 0;
