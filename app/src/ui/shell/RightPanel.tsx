import { useUi } from '../../state/uiStore';
import { VisualPanel } from '../panels/VisualPanel';
import { ExportPanel } from '../panels/ExportPanel';
import { PanelTabs } from './PanelTabs';

/** The right-hand inspector: the look, and export. */
export function RightPanel() {
  const tab = useUi(s => s.rightTab);

  return (
    <aside className="panel rp" id="right">
      <PanelTabs
        tabs={[
          { id: 'visual', label: 'Visual' },
          { id: 'export', label: 'Export' },
        ]}
        value={tab}
        onChange={id => useUi.getState().setRightTab(id as 'visual' | 'export')}
      />
      {tab === 'visual' ? <VisualPanel /> : <ExportPanel />}
    </aside>
  );
}
