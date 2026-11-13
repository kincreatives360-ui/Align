import { useUi } from '../../state/uiStore';
import { GridIcon } from '../icons/GridIcon';

/** Thirds grid over the canvas. Preview only — never exported. */
export function GuidesButton() {
  const on = useUi(s => s.guides);

  return (
    <button
      className={`ib${on ? ' on' : ''}`}
      title="Guides (G)"
      aria-label="Guides"
      aria-pressed={on}
      onClick={() => useUi.getState().toggleGuides()}
    >
      <GridIcon />
    </button>
  );
}
