/** Timing utilities for the timeline and export panel.
 * These are pure functions derived from the reference `main.js` / `ui.js` logic.
 * No WebGL, no project state mutation.
 */
import type { ProjectState } from '../state/types';
import { byId } from '../templates/registry';

/** Get the clip duration in seconds. */
export function clipLength(state: ProjectState): number {
  const t = byId(state.templateId);
  if (!t) return 10;
  const d = durationRef(t, state.params);
  return Math.max(0.5, d);
}

/** Get clip info: { loop, clip, rate, loops } — same shape as the reference. */
export function clipInfo(state: ProjectState): { loop: number; clip: number; rate: number; loops: number } {
  const t = byId(state.templateId);
  if (!t) return { loop: 10, clip: 10, rate: 1, loops: 1 };
  const d = durationRef(t, state.params);
  const loop = Math.max(1, Math.round(d));
  const clip = Math.max(0.5, d);
  const rate = loop / clip;
  const loops = Math.max(1, Math.round(clip / loop));
  return { loop, clip, rate, loops };
}

/** Return the template's base duration in seconds. */
function durationRef(t: { dur?: number; step?: boolean; perCard?: number; fixedN?: boolean; n: number }, P: Record<string, any>): number {
  if (!t) return 10;
  if (t.step) {
    const n = t.fixedN ? t.n : (P.count as number ?? t.n);
    const per = t.perCard ?? 1.4;
    return per * n;
  }
  return t.dur ?? 10;
}

/** Wrap `t` into [0, clipLength). */
export function wrapTime(t: number, len: number): number {
  return ((t % len) + len) % len;
}

/** Format `t` as mm:ss.t with the clip length `len` for display. */
export function formatTime(t: number, _len: number): string {
  const minutes = Math.floor(t / 60);
  const seconds = t % 60;
  return `${minutes}:${seconds.toFixed(1)}`;
}