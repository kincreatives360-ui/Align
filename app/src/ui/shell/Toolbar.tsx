import { PlayPauseButton } from './PlayPauseButton';
import { RestartButton } from './RestartButton';
import { FullscreenButton } from './FullscreenButton';
import { AspectSelect } from './AspectSelect';
import { BackgroundColourButton } from './BackgroundColourButton';
import { GuidesButton } from './GuidesButton';
import { ResetLookButton } from './ResetLookButton';

/** The floating control bar above the canvas, in the original's order. */
export function Toolbar() {
  return (
    <div className="toolbar" id="toolbar">
      <PlayPauseButton />
      <RestartButton />
      <FullscreenButton />
      <span className="sep" />
      <AspectSelect />
      <span className="sep" />
      <BackgroundColourButton />
      <GuidesButton />
      <ResetLookButton />
    </div>
  );
}
