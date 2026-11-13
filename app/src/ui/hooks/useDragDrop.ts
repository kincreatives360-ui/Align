import { useEffect } from 'react';
import { useDrop } from '../../state/dropStore';
import { addFiles } from '../../media/ingest';
import { toast } from '../../state/toastStore';

const hasFiles = (e: DragEvent) =>
  Array.from(e.dataTransfer?.items ?? []).some(i => i.kind === 'file');

/**
 * Window-wide drag-and-drop and paste-to-import.
 *
 * `useDrop` keeps a depth count rather than a boolean, because moving between
 * child elements fires `dragleave` on one and `dragenter` on the next — a
 * plain flag would flicker the veil off mid-drag.
 */
export function useDragDrop(): void {
  useEffect(() => {
    const onEnter = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      useDrop.getState().enter();
    };

    const onLeave = () => useDrop.getState().leave();

    const onOver = (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };

    const onDrop = (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      useDrop.getState().reset();
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) void addFiles(files);
    };

    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (!files.length) return;
      void addFiles(files).then(n => {
        if (n > 0) toast(`Pasted ${n} file${n === 1 ? '' : 's'}`);
      });
    };

    // Safety net: if a drag is abandoned (Escape, window blur) the counter
    // would otherwise be left above zero and the veil would never clear.
    const reset = () => useDrop.getState().reset();

    window.addEventListener('dragenter', onEnter);
    window.addEventListener('dragleave', onLeave);
    window.addEventListener('dragover', onOver);
    window.addEventListener('drop', onDrop);
    window.addEventListener('dragend', reset);
    window.addEventListener('blur', reset);
    window.addEventListener('paste', onPaste);

    return () => {
      window.removeEventListener('dragenter', onEnter);
      window.removeEventListener('dragleave', onLeave);
      window.removeEventListener('dragover', onOver);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('dragend', reset);
      window.removeEventListener('blur', reset);
      window.removeEventListener('paste', onPaste);
      reset();
    };
  }, []);
}
