import { useState } from 'react';
import { useProject } from '../../state/store';
import { useExport } from '../../state/exportStore';
import { runExport } from '../../export/run';
import { DownloadIcon } from '../icons/DownloadIcon';
import { toast } from '../../state/toastStore';

/** The big Export button, plus the progress bar while a job is running. */
export function ExportRunButton() {
  const state = useProject(s => s.state);
  const phase = useExport(s => s.phase);
  const progress = useExport(s => s.progress);
  const label = useExport(s => s.label);
  const [busy, setBusy] = useState(false);

  const running = phase === 'running' || busy;

  const go = async () => {
    if (running) return;
    setBusy(true);
    try {
      await runExport(state);
      toast('Export finished');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
      useExport.getState().reset();
    }
  };

  return (
    <>
      <button className="btn-primary exp-big" disabled={running} onClick={go}>
        <DownloadIcon />
        {running ? 'Exporting…' : 'Export'}
      </button>

      {running && (
        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
      {label && <div className="hint">{label}</div>}
    </>
  );
}
