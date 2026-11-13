import { create } from 'zustand';

/**
 * Export progress, kept out of project state — it is transient UI, never
 * saved and never undoable.
 */
export type ExportPhase = 'idle' | 'running' | 'done' | 'error';

interface ExportStore {
  phase: ExportPhase;
  /** 0 → 1 */
  progress: number;
  /** What is being done right now, e.g. "Rendering frame 40 of 300". */
  label: string;
  start: (label?: string) => void;
  update: (progress: number, label?: string) => void;
  finish: () => void;
  fail: (label: string) => void;
  reset: () => void;
}

export const useExport = create<ExportStore>(set => ({
  phase: 'idle',
  progress: 0,
  label: '',

  start: (label = 'Preparing…') => set({ phase: 'running', progress: 0, label }),
  update: (progress, label) =>
    set(s => ({ progress, label: label ?? s.label, phase: 'running' })),
  finish: () => set(s => ({ phase: 'done', progress: 1, label: s.label })),
  fail: label => set({ phase: 'error', label }),
  reset: () => set({ phase: 'idle', progress: 0, label: '' }),
}));
