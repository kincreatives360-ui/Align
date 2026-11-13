import { useModal } from '../../state/modalStore';

/** A yes/no question: "Delete all media?", "Start a new project?" and so on. */
export function ConfirmModal() {
  const payload = useModal(s => s.confirm);
  const close = () => useModal.getState().close();

  if (!payload) return null;

  const confirm = () => {
    close();
    payload.onConfirm();
  };

  return (
    <>
      <h3>{payload.title}</h3>
      {payload.body && <p className="mp">{payload.body}</p>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button className="ib" onClick={close}>
          Cancel
        </button>
        <button className="btn-primary danger" onClick={confirm}>
          {payload.confirmLabel ?? 'Confirm'}
        </button>
      </div>
    </>
  );
}
