import { useModal } from '../../state/modalStore';

const ROWS: [string, string][] = [
  ['Space', 'Play / pause'],
  ['← / →', 'Step one frame'],
  ['Shift + ← / →', 'Step ten frames'],
  ['Home', 'Jump to the start'],
  ['G', 'Toggle guides'],
  ['F', 'Fullscreen'],
  ['R', 'Surprise me'],
  ['Ctrl / ⌘ + Z', 'Undo'],
  ['Ctrl / ⌘ + Shift + Z', 'Redo'],
  ['Ctrl / ⌘ + E', 'Open Export'],
  ['Esc', 'Close dialog'],
];

export function ShortcutsModal() {
  const close = () => useModal.getState().close();

  return (
    <>
      <h3>Keyboard shortcuts</h3>
      <div className="kbd">
        {ROWS.map(([keys, what]) => (
          <span key={keys} style={{ display: 'contents' }}>
            <kbd>{keys}</kbd>
            <span>{what}</span>
          </span>
        ))}
      </div>
      <button className="btn-primary" onClick={close}>
        Got it
      </button>
    </>
  );
}
