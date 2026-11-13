import { useState, useCallback, useRef, type DragEvent } from 'react';

interface UseDragReorderReturn {
  dragProps: (index: number) => {
    draggable: boolean;
    onDragStart: (e: DragEvent<HTMLDivElement>) => void;
    onDragEnd: () => void;
  };
  dropProps: {
    onDragOver: (e: DragEvent<HTMLDivElement>) => void;
    onDrop: (e: DragEvent<HTMLDivElement>) => void;
  };
}

/**
 * HTML5 drag-and-drop reordering for a grid.
 * Returns props to spread on the container and each item.
 */
export function useDragReorder<T>(
  _items: T[],
  onReorder: (fromIndex: number, toIndex: number) => void
): UseDragReorderReturn {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const dropTargetRef = useRef<number | null>(null);

  const dragProps = useCallback(
    (index: number) => ({
      draggable: true,
      onDragStart: (e: DragEvent<HTMLDivElement>) => {
        setDraggedIndex(index);
        e.dataTransfer.effectAllowed = 'move';
        // Required for Firefox
        e.dataTransfer.setData('text/plain', String(index));
        e.currentTarget.style.opacity = '0.4';
      },
      onDragEnd: () => {
        setDraggedIndex(null);
        dropTargetRef.current = null;
        // Reset opacity will be handled by React re-render
      },
    }),
    []
  );

  const dropProps = {
    onDragOver: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault(); // Required to allow dropping
      e.dataTransfer.dropEffect = 'move';

      // Find which item we're over
      const target = e.target as HTMLElement;
      const itemElement = target.closest('.mitem') as HTMLDivElement | null;
      if (itemElement) {
        const index = Number(itemElement.dataset.index);
        if (Number.isFinite(index) && index !== draggedIndex) {
          dropTargetRef.current = index;
        }
      }
    },
    onDrop: (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      if (draggedIndex !== null && dropTargetRef.current !== null) {
        onReorder(draggedIndex, dropTargetRef.current);
      }
      setDraggedIndex(null);
      dropTargetRef.current = null;
    },
  };

  return { dragProps, dropProps };
}