import { useProject } from '../../state/store';
import { ShuffleIcon } from '../icons/ShuffleIcon';
import { TrashIcon } from '../icons/TrashIcon';

/** How images map onto cards, plus shuffle and clear. */
export function OrderControls() {
  const order = useProject(s => s.state.media.order);
  const count = useProject(s => s.state.media.images.length);

  const setOrder = (next: 'in' | 'shuffle') => {
    useProject.getState().set('media.order', next);
    useProject.getState().commit();
  };

  return (
    <>
      <div className="grp-h">Assignment</div>
      <div className="sg">
        <button
          type="button"
          className={order === 'in' ? 'on' : ''}
          aria-pressed={order === 'in'}
          onClick={() => setOrder('in')}
        >
          In order
        </button>
        <button
          type="button"
          className={order === 'shuffle' ? 'on' : ''}
          aria-pressed={order === 'shuffle'}
          onClick={() => setOrder('shuffle')}
        >
          Shuffle
        </button>
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <button
          type="button"
          className="ib ghost sm"
          style={{ flex: 1 }}
          onClick={() => {
            useProject.getState().set('media.seed', Math.floor(Math.random() * 1e6));
            useProject.getState().commit();
          }}
        >
          <ShuffleIcon /> New shuffle
        </button>
        <button
          type="button"
          className="ib ghost sm"
          disabled={count === 0}
          onClick={() => {
            useProject.getState().mutate(s => ({ ...s, media: { ...s.media, images: [] } }));
            useProject.getState().commit();
          }}
        >
          <TrashIcon /> Clear
        </button>
      </div>
    </>
  );
}
