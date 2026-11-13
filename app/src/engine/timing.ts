/** Timing utilities for the timeline and export panel.
 * These are pure functions derived from the reference `main.js` / `ui.js` logic.
 * No WebGL, no project state mutation.
 */
import type { ProjectState } from '../state/types';
import { byId } from '../templates/registry';

/** Safe number with fallback: Number(x) ?? def doesn't work because Number(undefined) is NaN.
 * Also handles null/undefined/empty string -> NaN so it falls back. */
export function numOr(v: unknown, def: number): number {
  if (v === null || v === undefined || v === '') return def;
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
}

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
export function durationRef(t: { dur?: number; step?: boolean; perCard?: number; fixedN?: boolean; n: number }, P: Record<string, any>): number {
  if (!t) return 10;
  if (t.step) {
    const n = t.fixedN ? t.n : (numOr(P.count, t.n) || t.n);
    const per = numOr(t.perCard, 1.4);
    return per * n;
  }
  return numOr(t.dur, 10);
}

/** Wrap `t` into [0, clipLength). */
export function wrapTime(t: number, len: number): number {
  if (len <= 0) return 0;
  return ((t % len) + len) % len;
}

/** Format `t` as mm:ss.t with the clip length `len` for display. */
export function formatTime(t: number, _len: number): string {
  // Clamp to avoid 0:60.0 edge case
  const clamped = Math.min(t, _len - 0.05);
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  const formattedSeconds = seconds.toFixed(1).padStart(4, '0');
  // Handle edge case where seconds rounds to 60.0
  if (formattedSeconds === '60.0') {
    return `${minutes + 1}:00.0`;
  }
  return `${minutes}:${formattedSeconds}`;
}