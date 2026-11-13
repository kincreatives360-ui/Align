import { useToast } from '../../state/toastStore';

/** The small transient message at the bottom of the screen. */
export function Toast() {
  const message = useToast(s => s.message);
  const id = useToast(s => s.id);

  return (
    <div className={`toast${message ? ' on' : ''}`} id="toast" role="status" key={id}>
      {message}
    </div>
  );
}
