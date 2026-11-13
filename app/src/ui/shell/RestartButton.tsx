import { useClock } from '../../state/clockStore';
import { RestartIcon } from '../icons/RestartIcon';

/** Jump back to the start of the timeline. */
export function RestartButton() {
  return (
    <button
      className="ib"
      title="Restart"
      aria-label="Restart"
      onClick={() => useClock.getState().restart()}
    >
      <RestartIcon />
    </button>
  );
}
