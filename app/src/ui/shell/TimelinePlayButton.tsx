import { useClock } from '../../state/clockStore';
import { PlayIcon } from '../icons/PlayIcon';
import { PauseIcon } from '../icons/PauseIcon';

/** Play / pause on the timeline itself. */
export function TimelinePlayButton() {
  const playing = useClock(s => s.playing);

  return (
    <button
      className="ib ghost"
      aria-label={playing ? 'Pause' : 'Play'}
      onClick={() => useClock.getState().toggle()}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </button>
  );
}
