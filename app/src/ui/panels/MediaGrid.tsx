import { useProject } from '../../state/store';
import { MediaItemCard } from './MediaItemCard';
import { useDragReorder } from '../../hooks/useDragReorder';

/** The 3-up grid of everything that has been added. */
export function MediaGrid() {
  const images = useProject(s => s.state.media.images);
  const set = useProject(s => s.set);
  const commit = useProject(s => s.commit);

  const { dragProps, dropProps } = useDragReorder(
    images,
    (from, to) => {
      const next = [...images];
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      set('media.images', next);
      commit();
    }
  );

  if (images.length === 0) {
    return <p className="hint">No images yet. Add some to fill the cards.</p>;
  }

  return (
    <>
      <div className="grp-h">{images.length} item{images.length === 1 ? '' : 's'}</div>
      <div className="media-grid" {...dropProps}>
        {images.map((item, index) => (
          <MediaItemCard
            key={item.id}
            item={item}
            index={index}
            dragProps={dragProps(index)}
          />
        ))}
      </div>
    </>
  );
}
