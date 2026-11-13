import type { CategoryId, Template, CardPose, Env, P } from './types';

/**
 * The template catalogue.
 *
 * Milestone 4 fills `TEMPLATES` with the full set; until then `byId` falls
 * back to one internal placeholder so the app always has a valid template to
 * point at, whatever a draft file happens to contain.
 */

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'classic', label: 'Classic' },
  { id: 'stack', label: 'Stack' },
  { id: 'ring', label: 'Ring' },
  { id: 'grid', label: 'Grid' },
  { id: 'glass', label: 'Liquid glass' },
  { id: 'blur', label: 'Blur' },
  { id: 'bold', label: 'Bold' },
  { id: 'minimal', label: 'Minimal' },
];

/** A gentle horizontal drift — enough to prove the pipeline end to end. */
const placeholderLayout = (i: number, _params: P, env: Env): CardPose => {
  const spread = Math.min(env.n, 7);
  const offset = i - (spread - 1) / 2;
  const phase = (env.p + i / Math.max(1, env.n)) % 1;
  const x = (offset + Math.sin(phase * Math.PI * 2) * 0.35) * (env.w + 0.12);
  return {
    x,
    y: Math.sin(phase * Math.PI * 2 + i) * 0.05,
    z: -Math.abs(offset) * 0.12,
    ry: offset * -0.18,
  };
};

export const PLACEHOLDER_TEMPLATE: Template = {
  id: 'carousel-classic',
  name: 'Classic carousel',
  cat: 'classic',
  desc: 'A calm horizontal drift through your images.',
  n: 6,
  aspect: 1.5,
  frame: '16:9',
  dur: 10,
  layout: placeholderLayout,
};

/** All templates, in display order. */
export const TEMPLATES: Template[] = [];

const BY_ID = new Map<string, Template>([
  [PLACEHOLDER_TEMPLATE.id, PLACEHOLDER_TEMPLATE],
]);

/** Look up a template; unknown ids resolve to the placeholder, never to undefined. */
export function byId(id: string): Template {
  return BY_ID.get(id) ?? PLACEHOLDER_TEMPLATE;
}

/** Count of templates in one category. */
export function countIn(cat: CategoryId): number {
  return TEMPLATES.filter(t => t.cat === cat).length;
}
