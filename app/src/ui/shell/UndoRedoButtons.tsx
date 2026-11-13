import { useProject } from '../../state/store';
import { UndoIcon } from '../icons/UndoIcon';
import { RedoIcon } from '../icons/RedoIcon';

/** Undo and redo, disabled whenever there is nothing to step to. */
export function UndoRedoButtons() {
  const canUndo = useProject(s => s.canUndo);
  const canRedo = useProject(s => s.canRedo);

  return (
    <>
      <button
        className="ib ghost"
        id="undo"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        aria-label="Undo"
        onClick={() => useProject.getState().undo()}
      >
        <UndoIcon />
      </button>
      <button
        className="ib ghost"
        id="redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        aria-label="Redo"
        onClick={() => useProject.getState().redo()}
      >
        <RedoIcon />
      </button>
    </>
  );
}
