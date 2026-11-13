import { TimelinePlayButton } from './TimelinePlayButton';
import { TimelineScrubber } from './TimelineScrubber';
import { TimelineTimeReadout } from './TimelineTimeReadout';

/** The floating scrub bar under the canvas. */
export function Timeline() {
  return (
    <div className="timeline" id="timeline">
      <TimelinePlayButton />
      <TimelineScrubber />
      <TimelineTimeReadout />
    </div>
  );
}
