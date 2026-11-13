import { useUi } from '../../state/uiStore';
import { BigTab } from './BigTab';
import { CompareIcon } from '../icons/CompareIcon';
import { SlidersIcon } from '../icons/SlidersIcon';
import { TemplateBrowser } from './TemplateBrowser';
import { ControlsPanel } from './ControlsPanel';

/** The Motion section: pick a template, or fine-tune the one you have. */
export function MotionPanel() {
  const tab = useUi(s => s.leftTab);

  return (
    <>
      <div className="lp-head">
        <BigTab
          id="templates"
          label="Templates"
          Icon={CompareIcon}
          active={tab === 'templates'}
        />
        <BigTab
          id="controls"
          label="Controls"
          Icon={SlidersIcon}
          active={tab === 'controls'}
        />
      </div>

      {tab === 'templates' ? <TemplateBrowser /> : <ControlsPanel />}
    </>
  );
}
