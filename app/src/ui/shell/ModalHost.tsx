import { useModal } from '../../state/modalStore';
import { ShortcutsModal } from './ShortcutsModal';
import { ConfirmModal } from './ConfirmModal';

/**
 * Renders whichever dialog is open. The backdrop itself closes it, matching
 * the reference behaviour.
 */
export function ModalHost() {
  const which = useModal(s => s.modal);
  const close = () => useModal.getState().close();

  return (
    <div
      className={`modal${which ? ' on' : ''}`}
      id="modal"
      role="presentation"
      onMouseDown={e => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="box" id="modalBox" role="dialog" aria-modal="true">
        {which === 'shortcuts' && <ShortcutsModal />}
        {which === 'confirm' && <ConfirmModal />}
      </div>
    </div>
  );
}
