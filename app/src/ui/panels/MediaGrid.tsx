import { useProject } from '../../state/store';
import { MediaItemCard } from './MediaItemCard';

/** The 3-up grid of everything that has been added. */
export function MediaGrid() {
  const images = useProject(s => s.state.media.images);

  if (images.length === 0) {
    return <p className="hint">No images yet. Add some to fill the cards.</p>;
  }

  return (
    <>
      <div className="grp-h">{images.length} item{images.length === 1 ? '' : 's'}</div>
      <div className="media-grid">
        {images.map((item, index) => (
          <MediaItemCard key={item.id} item={item} index={index} />
        ))}
      </div>
    </>
  );
}
