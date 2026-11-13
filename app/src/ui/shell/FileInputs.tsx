import { useRef } from 'react';
import { addFiles } from '../../media/ingest';
import { toast } from '../../state/toastStore';

/**
 * The two hidden file pickers the rest of the UI points at:
 * `#fileImgs` for media, `#fileProj` for a saved project.
 */
export function FileInputs() {
  const imagesRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={imagesRef}
        type="file"
        id="fileImgs"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={async e => {
          const files = e.target.files;
          e.target.value = '';
          if (!files?.length) return;
          const added = await addFiles(files);
          if (added === 0) toast('Those files could not be read');
          else toast(`Added ${added} file${added === 1 ? '' : 's'}`);
        }}
      />
      <input
        type="file"
        id="fileProj"
        accept=".json,application/json"
        hidden
        onChange={async e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const { openProject } = await import('../../state/projectFiles');
          openProject(file);
        }}
      />
    </>
  );
}
