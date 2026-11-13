import { useProject } from '../../state/store';
import { ExportKindRow } from './ExportKindRow';
import { ExportVideoSettings } from './ExportVideoSettings';
import { ExportImageSettings } from './ExportImageSettings';
import { ExportGifSettings } from './ExportGifSettings';
import { ExportSequenceSettings } from './ExportSequenceSettings';
import { ExportSummary } from './ExportSummary';
import { ExportRunButton } from './ExportRunButton';

/** Everything about making a file. */
export function ExportPanel() {
  const kind = useProject(s => s.state.export.kind);

  return (
    <>
      <div className="xh">Export</div>
      <ExportKindRow />

      {kind === 'video' && <ExportVideoSettings />}
      {kind === 'image' && <ExportImageSettings />}
      {kind === 'gif' && <ExportGifSettings />}
      {kind === 'sequence' && <ExportSequenceSettings />}

      <ExportSummary />
      <ExportRunButton />
    </>
  );
}
