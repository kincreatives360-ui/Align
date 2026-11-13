import { PlusIcon } from '../icons/PlusIcon';

/**
 * The "drop files here" tile. It opens the file picker when clicked; the
 * global drag handlers cover dropping onto the window.
 */
export function MediaDropzone() {
  const openPicker = () => document.getElementById('fileImgs')?.click();

  return (
    <button type="button" className="dropzone" onClick={openPicker}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
        <PlusIcon />
        <span>Add images or videos</span>
      </div>
      <div className="hint" style={{ marginTop: 6 }}>
        Drop files anywhere, or click to choose
      </div>
    </button>
  );
}
