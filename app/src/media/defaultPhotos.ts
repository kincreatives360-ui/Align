import type { MediaItem } from '../state/types';
import { register } from '../state/mediaRegistry';

/**
 * Default photos from the reference aligncanvas.com site.
 * These are copied to public/media/photos/ and can be used as starting images.
 */
export const DEFAULT_PHOTOS: MediaItem[] = [
  { id: 'photo-01', kind: 'image', name: 'photo-01.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-01.jpg' },
  { id: 'photo-02', kind: 'image', name: 'photo-02.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-02.jpg' },
  { id: 'photo-03', kind: 'image', name: 'photo-03.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-03.jpg' },
  { id: 'photo-04', kind: 'image', name: 'photo-04.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-04.jpg' },
  { id: 'photo-05', kind: 'image', name: 'photo-05.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-05.jpg' },
  { id: 'photo-06', kind: 'image', name: 'photo-06.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-06.jpg' },
  { id: 'photo-07', kind: 'image', name: 'photo-07.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-07.jpg' },
  { id: 'photo-08', kind: 'image', name: 'photo-08.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-08.jpg' },
  { id: 'photo-09', kind: 'image', name: 'photo-09.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-09.jpg' },
  { id: 'photo-10', kind: 'image', name: 'photo-10.jpg', width: 1920, height: 1280, libraryPath: '/media/photos/photo-10.jpg' },
];

/** Register all default photos in the media registry. */
export function registerDefaultPhotos(): void {
  register(DEFAULT_PHOTOS);
}

/** Get the list of default photo IDs. */
export function getDefaultPhotoIds(): string[] {
  return DEFAULT_PHOTOS.map(p => p.id);
}