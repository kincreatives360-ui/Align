import { useClock } from '../../state/clockStore';
import { PlayIcon } from '../icons/PlayIcon';
import { PauseIcon } from '../icons/PauseIcon';

/** Play / pause for the canvas toolbar. */
export function PlayPauseButton() {
  const playing = useClock(s => s.playing);
  const toggle = () => useClock.getState().toggle();

  return (
    <button
      className="ib"
      title="Play / pause (Space)"
      aria-label={playing ? 'Pause' : 'Play'}
      onClick={toggle}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}
