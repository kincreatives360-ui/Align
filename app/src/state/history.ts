import type { ProjectState } from './types';
import { resolve as resolveMedia } from './mediaRegistry';

/** How many undo steps we keep. 80 is enough to outlive any normal session. */
const MAX_DEPTH = 80;

/**
 * Undo/redo as a stack of JSON snapshots.
 *
 * Snapshots store media as bare ids — a snapshot of a project with fifty
 * images is a few kilobytes rather than several megabytes.
 */
export class History {
  private stack: string[] = [];
  private index = -1;
  /** Set while a snapshot is being applied, so it cannot re-push itself. */
  private locked = false;

  /** A snapshot is just ids for media; the live objects are re-resolved on step. */
  private snapshot(state: ProjectState): string {
    return JSON.stringify({
      ...state,
      media: { ...state.media, images: state.media.images.map(m => m.id) },
    });
  }

  push(state: ProjectState): void {
    if (this.locked) return;
    const snap = this.snapshot(state);
    if (this.stack[this.index] === snap) return; // no duplicate consecutive states
    this.stack = this.stack.slice(0, this.index + 1); // clear the redo tail
    this.stack.push(snap);
    if (this.stack.length > MAX_DEPTH) this.stack.shift();
    this.index = this.stack.length - 1;
  }

  /** Move by `delta` (-1 = undo, +1 = redo) and return the state, or null. */
  step(delta: number, current: ProjectState): ProjectState | null {
    const j = this.index + delta;
    if (j < 0 || j >= this.stack.length) return null;
    this.index = j;

    // On disk a snapshot stores media as bare ids; it is typed that way here
    // so the re-resolution below is honest about what it starts from.
    const raw = JSON.parse(this.stack[j]) as Omit<ProjectState, 'media'> & {
      media: Omit<ProjectState['media'], 'images'> & { images: string[] };
    };

    const live = current.media.images;
    const resolved = raw.media.images
      .map(id => live.find(m => m.id === id) ?? resolveMedia([id])[0])
      .filter((m): m is NonNullable<typeof m> => m !== undefined);

    const { media, ...rest } = raw;
    return {
      ...rest,
      media: { ...media, images: resolved },
    };
  }

  /** Call around applying a snapshot so the apply itself pushes nothing. */
  withLock<T>(fn: () => T): T {
    this.locked = true;
    try {
      return fn();
    } finally {
      this.locked = false;
    }
  }

  reset(): void {
    this.stack = [];
    this.index = -1;
  }

  seed(state: ProjectState): void {
    this.reset();
    this.push(state);
  }

  get canUndo(): boolean {
    return this.index > 0;
  }

  get canRedo(): boolean {
    return this.index >= 0 && this.index < this.stack.length - 1;
  }
}
