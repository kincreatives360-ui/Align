import { useEffect } from 'react';
import { useProject } from '../../state/store';
import { useClock } from '../../state/clockStore';
import { useUi } from '../../state/uiStore';
import { useModal } from '../../state/modalStore';

const isTyping = (target: EventTarget | null) => {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
};

const FRAME = 1 / 60;

/** Every keyboard shortcut in the app, in one place. */
export function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const typing = isTyping(e.target);

      // Undo / redo work even while typing — that is what people expect.
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) useProject.getState().redo();
        else useProject.getState().undo();
        return;
      }

      if (e.key === 'Escape') {
        useModal.getState().close();
        return;
      }

      if (mod && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        useUi.getState().setRightTab('export');
        return;
      }

      if (e.key === '?') {
        e.preventDefault();
        useUi.getState().setModal('shortcuts');
        return;
      }

      if (typing || mod) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          useClock.getState().toggle();
          break;
        case 'ArrowRight':
          e.preventDefault();
          useClock.getState().seek(useClock.getState().t + (e.shiftKey ? FRAME * 10 : FRAME));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          useClock.getState().seek(useClock.getState().t - (e.shiftKey ? FRAME * 10 : FRAME));
          break;
        case 'Home':
          e.preventDefault();
          useClock.getState().restart();
          break;
        case 'g':
        case 'G':
          useUi.getState().toggleGuides();
          break;
        case 'f':
        case 'F': {
          const stage = document.querySelector('.stage');
          if (document.fullscreenElement) void document.exitFullscreen();
          else void stage?.requestFullscreen();
          break;
        }
        case 't':
        case 'T': {
          const theme = useProject.getState().state.theme;
          const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';
          useProject.getState().set('theme', next);
          useProject.getState().commit();
          break;
        }
        case 'r':
        case 'R':
          document.getElementById('surprise')?.click();
          break;
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}