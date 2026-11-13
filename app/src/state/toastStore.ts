import { create } from 'zustand';

let nextId = 0;

interface ToastStore {
  /** The message currently on screen, or null. */
  message: string | null;
  id: number;
  show: (message: string, ms?: number) => void;
  hide: () => void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastStore>((set, get) => ({
  message: null,
  id: 0,

  show: (message, ms = 2600) => {
    if (timer !== null) clearTimeout(timer);
    set({ message, id: ++nextId });
    timer = setTimeout(() => {
      timer = null;
      get().hide();
    }, ms);
  },

  hide: () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    set({ message: null });
  },
}));

/** Call from anywhere — handlers, effects, the exporter. */
export function toast(message: string, ms?: number): void {
  useToast.getState().show(message, ms);
}
