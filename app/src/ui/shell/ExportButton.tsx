import { useUi } from '../../state/uiStore';
import { DownloadIcon } from '../icons/DownloadIcon';

/** Jumps to the Export inspector on the right. */
export function ExportButton() {
  return (
    <button
      className="btn-primary"
      onClick={() => useUi.getState().setRightTab('export')}
    >
      <DownloadIcon />
      <span>Export</span>
    </button>
  );
}
