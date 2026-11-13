import type { MediaItem } from '../state/types';

/**
 * Object URLs for media added in this session.
 *
 * These cannot be persisted — a URL dies with the tab — so anything restored
 * from a saved project has no entry here and renders as "missing" until it is
 * re-added. The IndexedDB media store replaces this in a later milestone.
 */
const urls = new Map<string, string>();

export function putUrl(id: string, url: string): void {
  urls.set(id, url);
}

export function getUrl(id: string): string | undefined {
  return urls.get(id);
}

export function dropUrl(id: string): void {
  const url = urls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(id);
  }
}

/** The thumbnail path for an item, if this session still has it. */
export function thumbFor(item: MediaItem): string | undefined {
  return item.libraryPath ?? getUrl(item.id);
}
