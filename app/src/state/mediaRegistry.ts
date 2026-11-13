import type { MediaItem } from './types';

/**
 * Every media item seen during this session, by id.
 *
 * History snapshots deliberately store only media *ids* — that is what keeps
 * an undo step a few kilobytes. Something therefore has to be able to turn an
 * id back into a real item, including for a list the item was removed from.
 * That is this registry: it lives outside the project (never saved, never
 * undoable itself) and lives for the session.
 */
const byId = new Map<string, MediaItem>();

export function register(items: readonly MediaItem[]): void {
  for (const item of items) byId.set(item.id, item);
}

/** Resolve ids to items, dropping any id this session has never seen. */
export function resolve(ids: readonly string[]): MediaItem[] {
  const out: MediaItem[] = [];
  for (const id of ids) {
    const item = byId.get(id);
    if (item) out.push(item);
  }
  return out;
}

export function forget(id: string): void {
  byId.delete(id);
}

export function known(id: string): boolean {
  return byId.has(id);
}
