import type { ProjectState } from './types';
import { SCHEMA_VERSION } from './types';
import { newProject, BASE_STYLE } from './defaults';

/**
 * Bring a saved project up to the current schema.
 *
 * Old drafts are always recoverable — we would rather show a slightly odd
 * project than refuse to open someone's work. Anything unrecognised falls
 * back to the default for that field.
 */

type Draft = Omit<Partial<ProjectState>, 'v'> & { v?: number };

function mergeStyle(unknown: unknown): ProjectState['style'] {
  const base = structuredClone(BASE_STYLE);
  if (unknown === null || typeof unknown !== 'object') return base;
  const incoming = unknown as Record<string, Record<string, unknown>>;

  for (const [group, values] of Object.entries(incoming)) {
    const target = base as unknown as Record<string, Record<string, unknown>>;
    if (!(group in target) || typeof values !== 'object' || values === null) continue;
    for (const [key, value] of Object.entries(values)) {
      if (key in target[group]) target[group][key] = value;
    }
  }
  return base;
}

/** Upgrade a draft of any known version to `SCHEMA_VERSION`. */
export function migrate(draft: unknown): ProjectState {
  const fresh = newProject();
  if (draft === null || typeof draft !== 'object') return fresh;

  const d = draft as Draft;
  const oldVersion = d.v ?? 0;

  if (oldVersion > SCHEMA_VERSION) {
    // A newer file than we understand: use it anyway, keeping what we can.
    return { ...fresh, ...d, v: SCHEMA_VERSION, style: mergeStyle(d.style) };
  }

  // For version 1 projects, reset fx to new defaults to avoid black screen
  // (exposure default changed from 0 to 1, and other fx defaults were updated)
  const style = oldVersion === 1
    ? { ...d.style, fx: { grain: 0, vignette: 0, bloom: 0, chroma: 0, contrast: 1, saturation: 1, exposure: 1 } }
    : d.style;

  return {
    ...fresh,
    ...d,
    v: SCHEMA_VERSION,
    style: mergeStyle(style),
    frame: { ...fresh.frame, ...(d.frame ?? {}) },
    export: { ...fresh.export, ...(d.export ?? {}) },
    media: { ...fresh.media, ...(d.media ?? {}), images: d.media?.images ?? [] },
    params: d.params ?? {},
  };
}