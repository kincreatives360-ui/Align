import { Toolbar } from './Toolbar';
import { Viewport } from './Viewport';
import { Timeline } from './Timeline';
import { SurpriseButton } from './SurpriseButton';

/** The centre column: floating toolbar, canvas area, floating timeline. */
export function Stage() {
  return (
    <main className="stage">
      <Toolbar />
      <Viewport />
      <Timeline />
      <SurpriseButton />
    </main>
  );
}
