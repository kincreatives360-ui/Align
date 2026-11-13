import { openDB, type IDBPDatabase } from 'idb';

const DB_NAME = 'align-media';
const DB_VERSION = 1;

const MEDIA_STORE = 'media';
const PROJECT_STORE = 'projects';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db: IDBPDatabase) {
        if (!db.objectStoreNames.contains(MEDIA_STORE)) {
          db.createObjectStore(MEDIA_STORE, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(PROJECT_STORE)) {
          db.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Media store - IndexedDB for by-reference storage.
 * Media files are stored as Blobs in IndexedDB; object URLs are created on demand.
 */

export interface StoredMediaItem {
  id: string;
  kind: 'image' | 'video';
  name: string;
  width: number;
  height: number;
  duration?: number;
  blob: Blob;
  createdAt: number;
}

export interface StoredProject {
  id: string;
  name: string;
  data: string; // JSON string of ProjectState
  thumbnail?: Blob;
  createdAt: number;
  updatedAt: number;
}

/** Put a media item into the store. */
export async function putMedia(item: StoredMediaItem): Promise<void> {
  const db = await getDb();
  await db.put(MEDIA_STORE, item);
}

/** Get a media item by id. */
export async function getMedia(id: string): Promise<StoredMediaItem | undefined> {
  const db = await getDb();
  return db.get(MEDIA_STORE, id);
}

/** Get all media items. */
export async function getAllMedia(): Promise<StoredMediaItem[]> {
  const db = await getDb();
  return db.getAll(MEDIA_STORE);
}

/** Delete a media item. */
export async function deleteMedia(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(MEDIA_STORE, id);
}

/** Put a project into the store. */
export async function putProject(project: StoredProject): Promise<void> {
  const db = await getDb();
  await db.put(PROJECT_STORE, project);
}

/** Get a project by id. */
export async function getProject(id: string): Promise<StoredProject | undefined> {
  const db = await getDb();
  return db.get(PROJECT_STORE, id);
}

/** Get all projects. */
export async function getAllProjects(): Promise<StoredProject[]> {
  const db = await getDb();
  return db.getAll(PROJECT_STORE);
}

/** Delete a project. */
export async function deleteProject(id: string): Promise<void> {
  const db = await getDb();
  await db.delete(PROJECT_STORE, id);
}

/** Create an object URL for a stored media item. */
export function createObjectUrl(item: StoredMediaItem): string {
  return URL.createObjectURL(item.blob);
}

/** Revoke an object URL. */
export function revokeObjectUrl(url: string): void {
  URL.revokeObjectURL(url);
}