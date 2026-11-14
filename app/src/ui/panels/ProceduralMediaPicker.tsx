import { useProject } from '../../state/store';
import { MEDIA_SETS } from '../../engine/faces';

/** Picker for procedural media sets (logos, wordmarks, gradients, etc.) */
export function ProceduralMediaPicker() {
  const set = useProject(s => s.state.media.set);
  const onSet = useProject(s => s.set);
  const commit = useProject(s => s.commit);

  const mediaSets = Object.entries(MEDIA_SETS).map(([key, value]) => ({
    id: key,
    name: value.name,
    count: value.count,
    aspect: value.aspect,
  }));

  return (
    <section className="media-sets">
      <div className="grp-h">Procedural media</div>
      <p className="hint">Choose a built-in set, or pick "Auto" to use your uploaded media.</p>
      <div className="media-set-grid" role="listbox" aria-label="Procedural media sets">
        <button
          type="button"
          role="option"
          aria-selected={set === 'auto'}
          className={`media-set-card ${set === 'auto' ? 'on' : ''}`}
          onClick={() => { onSet('media.set', 'auto'); commit(); }}
        >
          <div className="media-set-thumb auto" />
          <div className="media-set-label">
            <span className="media-set-name">Auto</span>
            <span className="media-set-count">Your uploads</span>
          </div>
        </button>
        {mediaSets.map(ms => (
          <button
            key={ms.id}
            type="button"
            role="option"
            aria-selected={set === ms.id}
            className={`media-set-card ${set === ms.id ? 'on' : ''}`}
            onClick={() => { onSet('media.set', ms.id); commit(); }}
          >
            <div className="media-set-thumb" style={{ aspectRatio: ms.aspect }} />
            <div className="media-set-label">
              <span className="media-set-name">{ms.name}</span>
              <span className="media-set-count">{ms.count} items</span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}