import { create } from 'zustand';

/** Which dialog, if any, is on screen. Nothing else belongs here. */
export type ModalId = 'shortcuts' | 'confirm' | null;

interface ModalStore {
  modal: ModalId;
  /** Payload for 'confirm' — the question and the button labels. */
  confirm: ConfirmPayload | null;
  open: (id: ModalId) => void;
  askConfirm: (payload: ConfirmPayload) => void;
  close: () => void;
}

export interface ConfirmPayload {
  title: string;
  body?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export const useModal = create<ModalStore>(set => ({
  modal: null,
  confirm: null,
  open: modal => set({ modal }),
  askConfirm: confirm => set({ modal: 'confirm', confirm }),
  close: () => set({ modal: null, confirm: null }),
}));
