import { useClock } from '../../state/clockStore';
import { useProject } from '../../state/store';
import { clipLength, formatTime, wrapTime } from '../../engine/timing';

/** `0:03.4 / 0:10.0` — the mono readout at the right of the timeline. */
export function TimelineTimeReadout() {
  const time = useClock(s => s.t);
  const project = useProject(s => s.state);

  const len = clipLength(project);

  return (
    <div className="time">{formatTime(wrapTime(time, len), len)}</div>
  );
}
