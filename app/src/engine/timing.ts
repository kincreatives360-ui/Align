/** Timing utilities for the timeline and export panel.
 * These are pure functions derived from the reference `main.js` / `ui.js` logic.
 * No WebGL, no project state mutation.
 */
import type { ProjectState } from '../state/types';
import { byId } from '../templates/registry';

/** A finite number, or `fallback`. `Number(undefined) ?? x` is NaN, never x, so we check explicitly. */
export function numOr(v: unknown, fallback: number): number {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

type TimedTemplate = { dur?: number; step?: boolean; perCard?: number; fixedN?: boolean; n: number };

/** The template's base duration in seconds (one full loop). Shared by the timeline and the frame builder. */
export function durationRef(t: TimedTemplate, P: Record<string, unknown>): number {
  if (t.step) {
    const n = t.fixedN ? t.n : numOr(P.count, t.n) || t.n;
    const per = t.perCard ?? 1.4;
    return per * n;
  }
  return t.dur ?? 10;
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

/** Wrap `t` into [0, clipLength). */
export function wrapTime(t: number, len: number): number {
  if (!(len > 0)) return 0;
  return ((t % len) + len) % len;
}

/** Format `t` as m:ss.t, e.g. 0:05.3. Rounds first so 59.96 reads 1:00.0, never 0:60.0. */
export function formatTime(t: number, _len: number): string {
  const tenths = Math.max(0, Math.round(t * 10));
  const minutes = Math.floor(tenths / 600);
  const seconds = (tenths % 600) / 10;
  return `${minutes}:${seconds.toFixed(1).padStart(4, '0')}`;
}
