import type { ProjectState } from './types';
import { putProject } from '../media/store';

const DRAFT_KEY = 'ac-draft';
const SAVE_DELAY = 400;
const PROJECT_SAVE_DELAY = 1200;

let timer: ReturnType<typeof setTimeout> | null = null;
let projectTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Debounced write of the working draft to localStorage.
 *
 * This is a crash-recovery net, not a document format: it saves the current
 * state every time the user stops touching things for 400ms.
 */
export function scheduleSave(state: ProjectState): void {
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(state));
      reportSave('saved');
    } catch {
      reportSave('error');
    }
  }, SAVE_DELAY);
}

/**
 * Debounced write of the project to IndexedDB.
 *
 * Runs at 1200ms delay. This is the proper project autosave.
 */
export function scheduleProjectSave(state: ProjectState): void {
  if (projectTimer !== null) clearTimeout(projectTimer);
  projectTimer = setTimeout(async () => {
    projectTimer = null;
    try {
      const project: any = {
        id: 'current',
        name: state.name,
        data: JSON.stringify(state),
        updatedAt: Date.now(),
      };
      await putProject(project);
      reportSave('saved');
    } catch {
      reportSave('error');
    }
  }, PROJECT_SAVE_DELAY);
}

/* ------------------------------------------------------------------ */
/* Save status, so the header can say "Saved" / "Saving…" / "Failed"    */
/* ------------------------------------------------------------------ */

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

let status: SaveStatus = 'idle';
const listeners = new Set<(s: SaveStatus) => void>();

function reportSave(s: SaveStatus): void {
  status = s;
  for (const fn of listeners) fn(s);
}

export function onSaveStatus(fn: (s: SaveStatus) => void): () => void {
  listeners.add(fn);
  fn(status);
  return () => {
    listeners.delete(fn);
  };
}

export function getSaveStatus(): SaveStatus {
  return status;
}

/** Read the draft written on a previous visit, if there is one. */
export function loadDraft(): ProjectState | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ProjectState;
  } catch {
    return null;
  }
}

export function clearDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* storage unavailable — nothing to clear */
  }
}
