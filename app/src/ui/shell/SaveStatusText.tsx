import { useSaveStatus } from '../hooks/useSaveStatus';

const LABEL: Record<string, string> = {
  idle: '',
  saving: 'Saving…',
  saved: 'Saved',
  error: "Couldn't save",
};

/** The small "Saved / Saving…" note beside the project name. */
export function SaveStatusText() {
  const status = useSaveStatus();
  const text = LABEL[status];

  return (
    <span
      className={`savest${status === 'saved' ? ' named' : ''}${status === 'error' ? ' err' : ''}`}
      aria-live="polite"
    >
      {text}
    </span>
  );
}
