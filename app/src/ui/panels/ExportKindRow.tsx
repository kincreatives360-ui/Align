import { useProject } from '../../state/store';
import type { ExportSettings } from '../../state/types';

const KINDS: { value: ExportSettings['kind']; label: string }[] = [
  { value: 'video', label: 'Video' },
  { value: 'gif', label: 'GIF' },
  { value: 'image', label: 'Still' },
  { value: 'sequence', label: 'Sequence' },
];

/** What kind of file to make. */
export function ExportKindRow() {
  const kind = useProject(s => s.state.export.kind);

  return (
    <div className="sg" role="group" aria-label="Export type">
      {KINDS.map(k => (
        <button
          key={k.value}
          type="button"
          className={kind === k.value ? 'on' : ''}
          aria-pressed={kind === k.value}
          onClick={() => {
            useProject.getState().set('export.kind', k.value);
            useProject.getState().commit();
          }}
        >
          {k.label}
        </button>
      ))}
    </div>
  );
}
