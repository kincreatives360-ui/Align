import type { MediaItem } from '../../state/types';
import { useProject } from '../../state/store';
import { thumbFor } from '../../media/objectUrls';
import { CloseIcon } from '../icons/CloseIcon';
import { VideoPlayIcon } from '../icons/VideoPlayIcon';

interface Props {
  item: MediaItem;
  index: number;
}

export function MediaItemCard({ item, index }: Props) {
  const remove = () => {
    useProject.getState().mutate(s => ({
      ...s,
      media: { ...s.media, images: s.media.images.filter(m => m.id !== item.id) },
    }));
    useProject.getState().commit();
  };

  const thumb = thumbFor(item);

  return (
    <div
      className={`mitem${thumb ? '' : ' missing'}`}
      title={`${index + 1}. ${item.name}`}
    >
      {thumb ? (
        <img src={thumb} alt="" />
      ) : (
        <span className="miss">{item.name}</span>
      )}

      {item.kind === 'video' && (
        <span className="mbadge">
          <VideoPlayIcon />
        </span>
      )}

      <button type="button" aria-label={`Remove ${item.name}`} onClick={remove}>
        <CloseIcon />
      </button>
    </div>
  );
}
