import type { MediaItem } from '../state/types';
import { useProject } from '../state/store';
import { register } from '../state/mediaRegistry';
import { putUrl } from './objectUrls';

const IMAGE = /^image\//;
const VIDEO = /^video\//;
const nextId = () => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Read a file's pixel size without decoding the whole thing into the page. */
async function measure(file: File, kind: 'image' | 'video'): Promise<{ w: number; h: number; duration?: number }> {
  const url = URL.createObjectURL(file);
  try {
    if (kind === 'image') {
      const img = new Image();
      img.src = url;
      await img.decode();
      return { w: img.naturalWidth, h: img.naturalHeight };
    }

    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Could not read video'));
    });
    return { w: video.videoWidth, h: video.videoHeight, duration: video.duration };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function classify(file: File): 'image' | 'video' | null {
  if (IMAGE.test(file.type)) return 'image';
  if (VIDEO.test(file.type)) return 'video';
  return null;
}

/**
 * Turn dropped or picked files into media items and append them in order.
 * Anything we cannot read is skipped with a toast rather than breaking the
 * whole batch.
 */
export async function addFiles(files: Iterable<File>): Promise<number> {
  const accepted: MediaItem[] = [];

  for (const file of files) {
    const kind = classify(file);
    if (!kind) continue;

    try {
      const { w, h, duration } = await measure(file, kind);
      const id = nextId();
      putUrl(id, URL.createObjectURL(file));

      const item: MediaItem = {
        id,
        kind,
        name: file.name,
        width: w,
        height: h,
      };
      if (duration !== undefined && Number.isFinite(duration)) item.duration = duration;
      accepted.push(item);
    } catch {
      /* unreadable file — skip it and keep going */
    }
  }

  if (accepted.length === 0) return 0;

  register(accepted);

  useProject.getState().mutate(s => ({
    ...s,
    media: { ...s.media, images: [...s.media.images, ...accepted] },
  }));
  useProject.getState().commit();

  return accepted.length;
}
