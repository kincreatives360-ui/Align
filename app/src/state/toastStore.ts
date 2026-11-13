import { create } from 'zustand';

let nextId = 0;

export type ToastType = 'default' | 'success' | 'error' | 'warning' | 'info' | 'loading';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
  promise?: Promise<unknown>;
}

interface ToastStore {
  toasts: Toast[];
  show: (message: string, type?: ToastType, ms?: number) => number;
  hide: (id: number) => void;
  promise: <T>(promise: Promise<T>, messages: { loading?: string; success?: string | ((value: T) => string); error?: string | ((error: unknown) => string) }) => Promise<T>;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useToast = create<ToastStore>((set, get) => ({
  toasts: [],

  show: (message, type = 'default', ms = 2600) => {
    if (timer !== null) clearTimeout(timer);
    const id = ++nextId;
    set(state => ({ toasts: [...state.toasts, { id, message, type }] }));
    timer = setTimeout(() => {
      timer = null;
      get().hide(id);
    }, ms);
    return id;
  },

  hide: (id: number) => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) }));
  },

  promise: async <T>(promise: Promise<T>, messages: { loading?: string; success?: string | ((value: T) => string); error?: string | ((error: unknown) => string) }) => {
    const loadingId = get().show(messages.loading ?? 'Loading...', 'loading', 0);
    try {
      const result = await promise;
      get().hide(loadingId);
      const successMsg = typeof messages.success === 'function' ? messages.success(result) : (messages.success ?? 'Success!');
      get().show(successMsg, 'success');
      return result;
    } catch (err) {
      get().hide(loadingId);
      const errorMsg = typeof messages.error === 'function' ? messages.error(err) : (messages.error ?? 'Error!');
      get().show(errorMsg, 'error');
      throw err;
    }
  },
}));

/** Call from anywhere — handlers, effects, the exporter. */
export function toast(message: string, type?: ToastType, ms?: number): number {
  return useToast.getState().show(message, type, ms);
}

/** Toast a promise with loading/success/error states. */
export function toastPromise<T>(
  promise: Promise<T>,
  messages: { loading?: string; success?: string | ((value: T) => string); error?: string | ((error: unknown) => string) }
): Promise<T> {
  return useToast.getState().promise(promise, messages);
}