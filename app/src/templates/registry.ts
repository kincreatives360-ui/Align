import type { CategoryId, Template, CardPose, Env, P } from './types';
import { SIGNATURE_TEMPLATES } from './catalog/signature';
import { TRANSITION_TEMPLATES } from './catalog/transitions';
import { CAROUSEL_TEMPLATES } from './catalog/carousel';
import { RING_TEMPLATES } from './catalog/ring';
import { STACK_TEMPLATES } from './catalog/stack';
import { SHOWCASE3D_TEMPLATES } from './catalog/showcase3d';
import { GLASS_TEMPLATES } from './catalog/glass';
import { GALLERY_TEMPLATES } from './catalog/gallery';
import { KINETIC_TEMPLATES } from './catalog/kinetic';
import { SCULPTURE_TEMPLATES } from './catalog/sculpture';
import { CHOREOGRAPHY_A_TO_E_TEMPLATES } from './catalog/choreographyAtoE';
import { CHOREOGRAPHY_F_TO_J_TEMPLATES } from './catalog/choreographyFtoJ';

export const LIQUID_LENS: Template = GLASS_TEMPLATES[0];
import {
  carouselLayout,
  stackShuffleLayout,
  ringLayout,
  gridLayout,
  perspectiveLayout,
  perspectiveCamera,
} from './layouts';

/** The app catalogue, including source-port modules and app-only templates. */

export const CATEGORIES: { id: CategoryId; label: string }[] = [
  { id: 'signature', label: 'Signature' },
  { id: 'transitions', label: 'Transitions' },
  { id: 'carousel', label: 'Carousel & Slider' },
  { id: 'ring', label: 'Ring & Orbit' },
  { id: 'stack', label: 'Stack & Grid' },
  { id: '3d', label: '3D Showcase' },
  { id: 'glass', label: 'Liquid Glass' },
  { id: 'gallery', label: 'Infinite Gallery' },
  { id: 'kinetic', label: 'Kinetic' },
  { id: 'sculpture', label: 'Sculpture' },
  { id: 'choreo', label: 'Choreography' },
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
  id: 'placeholder',
  name: 'Placeholder',
  cat: 'carousel',
  desc: 'A calm horizontal drift through your images.',
  n: 6,
  aspect: 1.5,
  frame: '16:9',
  dur: 10,
  layout: placeholderLayout,
};

// Real templates from reference
export const CAROUSEL_CLASSIC: Template = {
  id: 'carousel-classic',
  name: 'Classic carousel',
  cat: 'carousel',
  desc: 'A calm horizontal drift through your images.',
  n: 6,
  aspect: 1.5,
  frame: '16:9',
  dur: 10,
  layout: carouselLayout,
};

export const STACK_CLASSIC: Template = {
  id: 'stack-classic',
  name: 'Classic stack',
  cat: 'stack',
  desc: 'Cards flip one at a time in a vertical stack.',
  n: 5,
  aspect: 0.75,
  frame: '9:16',
  step: true,
  perCard: 1.4,
  layout: stackShuffleLayout,
};

export const RING_CLASSIC: Template = {
  id: 'ring-classic',
  name: 'Classic ring',
  cat: 'ring',
  desc: 'Cards orbit in an endless circle.',
  n: 8,
  aspect: 1,
  frame: '1:1',
  dur: 10,
  layout: ringLayout,
};

export const GRID_CLASSIC: Template = {
  id: 'grid-classic',
  name: 'Classic grid',
  cat: 'stack',
  desc: 'A responsive grid of cards.',
  n: 9,
  aspect: 1,
  frame: '1:1',
  dur: 10,
  layout: gridLayout,
};

export const PERSPECTIVE_CLASSIC: Template = {
  id: 'perspective-classic',
  name: 'Perspective view',
  cat: '3d',
  desc: 'Dramatic 3D perspective with custom camera.',
  n: 6,
  aspect: 1.5,
  frame: '16:9',
  dur: 10,
  layout: perspectiveLayout,
  camera: perspectiveCamera,
};



/** All templates, in display order. */
export const TEMPLATES: Template[] = [
  // Classic
  CAROUSEL_CLASSIC,
  STACK_CLASSIC,
  RING_CLASSIC,
  GRID_CLASSIC,
  PERSPECTIVE_CLASSIC,
  ...SIGNATURE_TEMPLATES,
  ...TRANSITION_TEMPLATES,
  // Carousel & Slider
  ...CAROUSEL_TEMPLATES,
  // Ring & Orbit
  ...RING_TEMPLATES,
  // Stack & Grid
  ...STACK_TEMPLATES,
  ...SHOWCASE3D_TEMPLATES,
  ...GLASS_TEMPLATES,
  ...GALLERY_TEMPLATES,
  ...KINETIC_TEMPLATES,
  ...SCULPTURE_TEMPLATES,
  ...CHOREOGRAPHY_A_TO_E_TEMPLATES,
  ...CHOREOGRAPHY_F_TO_J_TEMPLATES,
];

const BY_ID = new Map<string, Template>([
  [PLACEHOLDER_TEMPLATE.id, PLACEHOLDER_TEMPLATE],
  ...TEMPLATES.map(template => [template.id, template] as const),
]);

/** Look up a template; unknown ids resolve to the placeholder, never to undefined. */
export function byId(id: string): Template {
  return BY_ID.get(id) ?? PLACEHOLDER_TEMPLATE;
}

/** Count of templates in one category. */
export function countIn(cat: CategoryId): number {
  return TEMPLATES.filter(t => t.cat === cat).length;
}
