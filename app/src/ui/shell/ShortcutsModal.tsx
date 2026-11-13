import { useUi } from '../../state/uiStore';
import { CloseIcon } from '../icons/CloseIcon';

const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ['Space'], action: 'Play / Pause' },
  { keys: ['←', '→'], action: 'Step frame' },
  { keys: ['Shift + ←', 'Shift + →'], action: 'Step 10 frames' },
  { keys: ['Home'], action: 'Restart' },
  { keys: ['G'], action: 'Toggle guides' },
  { keys: ['F'], action: 'Fullscreen' },
  { keys: ['T'], action: 'Cycle theme' },
  { keys: ['R'], action: 'Surprise me' },
  { keys: ['?'], action: 'Show shortcuts' },
  { keys: ['Esc'], action: 'Close modal' },
  { keys: ['Ctrl + Z'], action: 'Undo' },
  { keys: ['Ctrl + Shift + Z'], action: 'Redo' },
  { keys: ['Ctrl + E'], action: 'Export panel' },
];

export function ShortcutsModal() {
  const { modal, closeModal } = useUi();

  if (modal !== 'shortcuts') return null;

  return (
    <div className="modal-backdrop" onClick={closeModal}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="modal-head">
          <h3>Keyboard Shortcuts</h3>
          <button className="ib ghost" onClick={closeModal} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div className="modal-body">
          <table className="shortcuts-table">
            <tbody>
              {SHORTCUTS.map((s, i) => (
                <tr key={i}>
                  <td className="keys">
                    {s.keys.map((k, j) => (
                      <kbd key={j}>{k}</kbd>
                    ))}
                  </td>
                  <td>{s.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}