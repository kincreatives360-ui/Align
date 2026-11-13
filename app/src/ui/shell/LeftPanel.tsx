import { useUi } from '../../state/uiStore';
import { MotionPanel } from '../panels/MotionPanel';
import { MediaPanel } from '../panels/MediaPanel';
import { TextPanel } from '../panels/TextPanel';
import { ProjectPanel } from '../panels/ProjectPanel';

/**
 * The left column. Which panel shows is pure UI state — it is never saved
 * into the project.
 */
export function LeftPanel() {
  const rail = useUi(s => s.rail);

  return (
    <aside className="panel lp" id="left">
      {rail === 'motion' && <MotionPanel />}
      {rail === 'media' && <MediaPanel />}
      {rail === 'text' && <TextPanel />}
      {rail === 'project' && <ProjectPanel />}
    </aside>
  );
}
