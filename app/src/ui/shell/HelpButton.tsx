import { useModal } from '../../state/modalStore';

export function HelpButton() {
  return (
    <button
      className="ib ghost"
      title="Shortcuts"
      aria-label="Keyboard shortcuts"
      onClick={() => useModal.getState().open('shortcuts')}
    >
      ?
    </button>
  );
}
