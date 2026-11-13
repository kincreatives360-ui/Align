import { create } from 'zustand';
import type { ProjectState } from './types';
import { newProject } from './defaults';
import { setPath } from './path';
import { History } from './history';
import { scheduleSave } from './persistence';
import { register } from './mediaRegistry';

/**
 * The project store.
 *
 * Two methods, and the split between them is what makes undo feel right:
 *
 *   set(path, value)   — continuous change. Called 200× during a slider drag.
 *                        Never pushes an undo snapshot.
 *   commit()           — end of a gesture. Pushes exactly ONE snapshot.
 *
 * Never call `commit()` from inside `set()`.
 */
interface ProjectStore {
  state: ProjectState;

  /** Continuous change — during a drag or while typing. No undo push. */
  set: (path: string, value: unknown) => void;

  /** Apply an arbitrary updater without pushing undo. Pair with `commit()`. */
  mutate: (fn: (state: ProjectState) => ProjectState) => void;

  /** End of a gesture: push exactly one snapshot and save. */
  commit: () => void;

  /** Structural change (new media, new template): push + save + bump `rev`. */
  replace: (state: ProjectState) => void;

  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  /** Bumped on every change — cheap "did it change" check for React. */
  rev: number;

  /** The render loop's signal that a new frame is needed. */
  dirty: boolean;
  markDirty: () => void;
  clearDirty: () => void;

  /** Reset to a fresh project (used by "New project"). */
  reset: () => void;
}

const history = new History();

/** Coalesce the save request — 400ms of quiet before anything is written. */
function persist(state: ProjectState): void {
  scheduleSave(state);
}

export const useProject = create<ProjectStore>((set, get) => ({
  state: newProject(),

  set: (path, value) => {
    const cur = get().state;
    const next = setPath(cur, path, value);
    if (next === cur) return;
    set({ state: next, rev: get().rev + 1, dirty: true });
    persist(next);
  },

  mutate: fn => {
    const cur = get().state;
    const next = fn(cur);
    if (next === cur) return;
    set({ state: next, rev: get().rev + 1, dirty: true });
    persist(next);
  },

  commit: () => {
    const { state } = get();
    history.push(state);
    set({ canUndo: history.canUndo, canRedo: history.canRedo });
    persist(state);
  },

  replace: next => {
    set({ state: next, rev: get().rev + 1, dirty: true, canUndo: history.canUndo, canRedo: history.canRedo });
    persist(next);
  },

  undo: () => {
    const { state } = get();
    const prev = history.withLock(() => history.step(-1, state));
    if (!prev) return;
    set({ state: prev, rev: get().rev + 1, dirty: true, canUndo: history.canUndo, canRedo: history.canRedo });
    persist(prev);
  },

  redo: () => {
    const { state } = get();
    const next = history.withLock(() => history.step(1, state));
    if (!next) return;
    set({ state: next, rev: get().rev + 1, dirty: true, canUndo: history.canUndo, canRedo: history.canRedo });
    persist(next);
  },

  canUndo: false,
  canRedo: false,
  rev: 0,
  dirty: true,
  markDirty: () => {
    if (!get().dirty) set({ dirty: true });
  },
  clearDirty: () => {
    if (get().dirty) set({ dirty: false });
  },

  reset: () => {
    const fresh = newProject();
    history.reset();
    history.push(fresh);
    set({
      state: fresh,
      rev: get().rev + 1,
      dirty: true,
      canUndo: false,
      canRedo: false,
    });
    persist(fresh);
  },
}));

/** Seed the undo stack with the starting state once at boot. */
export function seedHistory(): void {
  history.push(useProject.getState().state);
  useProject.setState({ canUndo: false, canRedo: false });
}

/**
 * Keep the media registry in step with the project automatically, whatever
 * path changed it — set, mutate, undo, redo or a file open. Snapshots store
 * only ids, so this is what makes an id resolvable again later.
 */
useProject.subscribe(state => {
  const images = state.state.media.images;
  if (images.length > 0) register(images);
});

/** Exposed for tests. */
export function _history(): History {
  return history;
}
