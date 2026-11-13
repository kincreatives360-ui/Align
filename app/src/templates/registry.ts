import type { CategoryId, Template, CardPose, Env, P } from './types';
import {
  carouselLayout,
  stackShuffleLayout,
  ringLayout,
  gridLayout,
  perspectiveLayout,
  perspectiveCamera,
  glassCarouselLayout,
  glassCarouselCamera,
  orbMarqueeLayout,
  orbMarqueeFill,
  coverflowLayout,
  coverflowFill,
  feedLayout,
  feedFill,
  liquidLensLayout,
  liquidLensFill,
  spiralLayout,
  cylinderLayout,
  cylinderCamera,
  orbitLayout,
  orbitCamera,
  fanLayout,
  masonryLayout,
  masonryFill,
  tiltGridLayout,
  tiltGridFill,
  slidePushLayout,
  slidePushFill,
  cubeTurnLayout,
  cubeTurnCamera,
  cardFlipLayout,
  riseUpLayout,
  swapLayout,
  zoomBlurLayout,
  sliderLayout,
  sliderFill,
  arcWheelLayout,
  sidestackLayout,
  elevatorLayout,
  elevatorFill,
  imageRepeaterLayout,
  imageRepeaterFill,
  meltRowLayout,
  meltRowFill,
  glassStreamLayout,
  glassStreamFill,
} from './layouts';

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

// Real templates from reference
export const CAROUSEL_CLASSIC: Template = {
  id: 'carousel-classic',
  name: 'Classic carousel',
  cat: 'classic',
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
  cat: 'grid',
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
  cat: 'classic',
  desc: 'Dramatic 3D perspective with custom camera.',
  n: 6,
  aspect: 1.5,
  frame: '16:9',
  dur: 10,
  layout: perspectiveLayout,
  camera: perspectiveCamera,
};

// Transitions
export const FLARE_DUO: Template = {
  id: 'flare-duo',
  name: 'Flare Duo',
  cat: 'transitions',
  kind: 'flare',
  n: 8,
  aspect: 1.8,
  frame: '4:3',
  desc: 'The glass card hand-off: the old card is pushed off by a flaring edge.',
  layout: placeholderLayout, // Special flare template handled separately
};

export const PRISM_SLIDER: Template = {
  id: 'prism-slider',
  name: 'Prism Slider',
  cat: 'transitions',
  n: 7,
  aspect: 0.8,
  step: true,
  cardH: 1.1,
  perCard: 1.8,
  frame: '5:4',
  fov: 32,
  desc: 'Cards sit on the faces of a turning prism; the neighbours fold away into glass edges.',
  layout: placeholderLayout,
};

export const PORTAL: Template = {
  id: 'portal',
  name: 'Portal',
  cat: 'transitions',
  n: 7,
  aspect: 0.8,
  step: true,
  cardH: 1.25,
  perCard: 1.6,
  frame: '5:4',
  desc: 'Fly through the images one after another.',
  layout: placeholderLayout,
};

export const SLIDE_PUSH: Template = {
  id: 'slide-push',
  name: 'Slide Push',
  cat: 'transitions',
  n: 8,
  aspect: 0.8,
  step: true,
  cardH: 1.3,
  perCard: 1.6,
  frame: '16:9',
  desc: 'Each image pushes the last one off the frame, with a motion blur.',
  layout: slidePushLayout,
  fill: slidePushFill,
};

export const CUBE_TURN: Template = {
  id: 'cube-turn',
  name: 'Cube Turn',
  cat: 'transitions',
  n: 4,
  fixedN: true,
  aspect: 1,
  step: true,
  cardH: 1.15,
  perCard: 1.8,
  frame: '5:4',
  desc: 'Images on the faces of a cube that turns a quarter at a time.',
  layout: cubeTurnLayout,
  camera: cubeTurnCamera,
};

export const CARD_FLIP: Template = {
  id: 'fold-flip',
  name: 'Card Flip',
  cat: 'transitions',
  n: 6,
  aspect: 0.8,
  step: true,
  cardH: 1.35,
  perCard: 1.5,
  frame: '5:4',
  desc: 'Each card flips over to reveal the next image.',
  layout: cardFlipLayout,
};

export const RISE_UP: Template = {
  id: 'rise-up',
  name: 'Rise Up',
  cat: 'transitions',
  n: 6,
  aspect: 0.8,
  step: true,
  cardH: 1.3,
  perCard: 1.5,
  frame: '5:4',
  desc: 'The next image rises from below as the current one drifts back.',
  layout: riseUpLayout,
};

export const SWAP: Template = {
  id: 'swap',
  name: 'Swap',
  cat: 'transitions',
  n: 5,
  aspect: 0.8,
  step: true,
  cardH: 1.25,
  perCard: 1.4,
  frame: '5:4',
  desc: 'The front card swings out to the side and slides to the back.',
  layout: swapLayout,
};

export const ZOOM_BLUR: Template = {
  id: 'zoom-blur',
  name: 'Zoom Blur',
  cat: 'transitions',
  n: 7,
  aspect: 0.8,
  step: true,
  cardH: 1.2,
  perCard: 1.5,
  frame: '5:4',
  desc: 'The current image rushes toward you and dissolves into the next.',
  layout: zoomBlurLayout,
};

// Carousel & Slider
export const GLASS_CAROUSEL: Template = {
  id: 'glass-carousel',
  name: 'Glass Carousel',
  cat: 'carousel',
  n: 12,
  aspect: 0.8,
  cardH: 1.3,
  dur: 30,
  frame: '5:4',
  resBoost: 2,
  fov: 58,
  desc: 'A ring of curved cards wrapped around the camera, melting into liquid-glass edges.',
  layout: glassCarouselLayout,
  camera: glassCarouselCamera,
};

export const ORB_MARQUEE: Template = {
  id: 'orb-marquee',
  name: 'Orb Marquee',
  cat: 'carousel',
  n: 12,
  aspect: 1,
  cardH: 0.46,
  dur: 16,
  frame: '5:4',
  desc: 'A row of round images gliding through stretching glass.',
  layout: orbMarqueeLayout,
  fill: orbMarqueeFill,
};

export const COVERFLOW: Template = {
  id: 'coverflow',
  name: 'Coverflow',
  cat: 'carousel',
  n: 11,
  aspect: 0.8,
  step: true,
  cardH: 1.15,
  perCard: 1.5,
  frame: '16:9',
  desc: 'The classic album-wall flip, softened by glass at the sides.',
  layout: coverflowLayout,
  fill: coverflowFill,
};

export const FEED: Template = {
  id: 'feed',
  name: 'Glass Feed',
  cat: 'carousel',
  n: 9,
  aspect: 0.8,
  cardH: 0.95,
  dur: 18,
  frame: '9:16',
  desc: 'A vertical feed that melts into the top and bottom of the frame.',
  layout: feedLayout,
  fill: feedFill,
};

export const LIQUID_LENS: Template = {
  id: 'lens-slider',
  name: 'Liquid Lens',
  cat: 'glass',
  n: 14,
  aspect: 0.8,
  cardH: 0.9,
  dur: 20,
  frame: '16:9',
  desc: 'A drop of real glass gliding over a row of images.',
  layout: liquidLensLayout,
  fill: liquidLensFill,
};

export const SLIDER: Template = {
  id: 'slider',
  name: 'Slider',
  cat: 'carousel',
  n: 9,
  aspect: 0.8,
  step: true,
  cardH: 1.15,
  perCard: 1.3,
  frame: '16:9',
  desc: 'A classic stepped slider with smaller, softer neighbours.',
  layout: sliderLayout,
  fill: sliderFill,
};

export const ARC_WHEEL: Template = {
  id: 'arc-wheel',
  name: 'Arc Wheel',
  cat: 'carousel',
  n: 14,
  aspect: 0.8,
  cardH: 0.78,
  dur: 22,
  frame: '16:9',
  desc: 'Images roll along the rim of a giant wheel.',
  layout: arcWheelLayout,
};

export const SIDESTACK: Template = {
  id: 'sidestack',
  name: 'Sidestack',
  cat: 'carousel',
  n: 7,
  aspect: 0.8,
  step: true,
  cardH: 1.2,
  perCard: 1.4,
  frame: '5:4',
  desc: 'A deck fanned in depth; the front card slides away to the left.',
  layout: sidestackLayout,
};

export const ELEVATOR: Template = {
  id: 'elevator',
  name: 'Elevator',
  cat: 'carousel',
  n: 18,
  aspect: 0.8,
  cardH: 0.82,
  dur: 24,
  frame: '16:9',
  desc: 'Slanted columns ride up and down past each other.',
  layout: elevatorLayout,
  fill: elevatorFill,
};

export const IMAGE_REPEATER: Template = {
  id: 'repeater',
  name: 'Image Repeater',
  cat: 'carousel',
  n: 24,
  aspect: 0.8,
  cardH: 0.55,
  dur: 26,
  frame: '16:9',
  desc: 'Rows of images scroll in alternating directions.',
  layout: imageRepeaterLayout,
  fill: imageRepeaterFill,
};

export const MELT_ROW: Template = {
  id: 'melt-row',
  name: 'Melt Row',
  cat: 'carousel',
  n: 12,
  aspect: 0.8,
  cardH: 1,
  dur: 22,
  frame: '16:9',
  desc: 'One row of images melting into deep glass at both sides.',
  layout: meltRowLayout,
  fill: meltRowFill,
};

export const GLASS_STREAM: Template = {
  id: 'glass-stream',
  name: 'Glass Stream',
  cat: 'carousel',
  n: 15,
  aspect: 0.8,
  cardH: 0.62,
  dur: 24,
  frame: '9:16',
  desc: 'Three columns stream in opposite directions through glass at the top and bottom.',
  layout: glassStreamLayout,
  fill: glassStreamFill,
};

// Ring & Orbit
export const SPIRAL: Template = {
  id: 'spiral',
  name: 'Spiral Collection',
  cat: 'ring',
  n: 28,
  aspect: 1.6,
  cardH: 0.27,
  dur: 24,
  fov: 36,
  frame: '16:9',
  desc: 'A twisting ring of curled cards.',
  layout: spiralLayout,
};

export const CYLINDER: Template = {
  id: 'cylinder',
  name: 'Cylinder',
  cat: 'ring',
  n: 14,
  aspect: 0.72,
  cardH: 1,
  dur: 26,
  frame: '5:4',
  desc: 'A turning wall of curved panels.',
  layout: cylinderLayout,
  camera: cylinderCamera,
};

export const ORBIT: Template = {
  id: 'orbit',
  name: 'Orbit',
  cat: 'ring',
  n: 8,
  aspect: 0.8,
  cardH: 0.85,
  dur: 20,
  frame: '5:4',
  desc: 'Images orbit in depth with a soft focus pull.',
  layout: orbitLayout,
  camera: orbitCamera,
};

// Stack & Grid
export const STACK_SHUFFLE: Template = {
  id: 'stack-shuffle',
  name: 'Stack Shuffle',
  cat: 'stack',
  n: 7,
  aspect: 0.8,
  step: true,
  cardH: 1.25,
  perCard: 1.4,
  frame: '5:4',
  desc: 'The top card slides out and tucks in behind the deck.',
  layout: stackShuffleLayout,
};

export const FAN: Template = {
  id: 'fan',
  name: 'Fan',
  cat: 'stack',
  n: 7,
  aspect: 0.72,
  cardH: 1.05,
  dur: 7,
  frame: '16:9',
  desc: 'A hand of cards that opens and closes.',
  layout: fanLayout,
};

export const MASONRY: Template = {
  id: 'masonry',
  name: 'Masonry',
  cat: 'stack',
  n: 18,
  aspect: 0.8,
  cardH: 0.62,
  dur: 26,
  frame: '4:5',
  desc: 'Columns drift in opposite directions and melt into the top and bottom.',
  layout: masonryLayout,
  fill: masonryFill,
};

export const TILT_GRID: Template = {
  id: 'tilt-grid',
  name: 'Tilt Grid',
  cat: 'stack',
  n: 30,
  aspect: 0.8,
  cardH: 0.6,
  dur: 24,
  frame: '4:5',
  desc: 'An endless tilted wall of images, edged in glass.',
  layout: tiltGridLayout,
  fill: tiltGridFill,
};

/** All templates, in display order. */
export const TEMPLATES: Template[] = [
  // Classic
  CAROUSEL_CLASSIC,
  STACK_CLASSIC,
  RING_CLASSIC,
  GRID_CLASSIC,
  PERSPECTIVE_CLASSIC,
  // Transitions
  FLARE_DUO,
  PRISM_SLIDER,
  PORTAL,
  SLIDE_PUSH,
  CUBE_TURN,
  CARD_FLIP,
  RISE_UP,
  SWAP,
  ZOOM_BLUR,
  // Carousel & Slider
  GLASS_CAROUSEL,
  ORB_MARQUEE,
  COVERFLOW,
  FEED,
  LIQUID_LENS,
  SLIDER,
  ARC_WHEEL,
  SIDESTACK,
  ELEVATOR,
  IMAGE_REPEATER,
  MELT_ROW,
  GLASS_STREAM,
  // Ring & Orbit
  SPIRAL,
  CYLINDER,
  ORBIT,
  // Stack & Grid
  STACK_SHUFFLE,
  FAN,
  MASONRY,
  TILT_GRID,
];

const BY_ID = new Map<string, Template>([
  [PLACEHOLDER_TEMPLATE.id, PLACEHOLDER_TEMPLATE],
  [CAROUSEL_CLASSIC.id, CAROUSEL_CLASSIC],
  [STACK_CLASSIC.id, STACK_CLASSIC],
  [RING_CLASSIC.id, RING_CLASSIC],
  [GRID_CLASSIC.id, GRID_CLASSIC],
  [PERSPECTIVE_CLASSIC.id, PERSPECTIVE_CLASSIC],
  [FLARE_DUO.id, FLARE_DUO],
  [PRISM_SLIDER.id, PRISM_SLIDER],
  [PORTAL.id, PORTAL],
  [SLIDE_PUSH.id, SLIDE_PUSH],
  [CUBE_TURN.id, CUBE_TURN],
  [CARD_FLIP.id, CARD_FLIP],
  [RISE_UP.id, RISE_UP],
  [SWAP.id, SWAP],
  [ZOOM_BLUR.id, ZOOM_BLUR],
  [GLASS_CAROUSEL.id, GLASS_CAROUSEL],
  [ORB_MARQUEE.id, ORB_MARQUEE],
  [COVERFLOW.id, COVERFLOW],
  [FEED.id, FEED],
  [LIQUID_LENS.id, LIQUID_LENS],
  [SLIDER.id, SLIDER],
  [ARC_WHEEL.id, ARC_WHEEL],
  [SIDESTACK.id, SIDESTACK],
  [ELEVATOR.id, ELEVATOR],
  [IMAGE_REPEATER.id, IMAGE_REPEATER],
  [MELT_ROW.id, MELT_ROW],
  [GLASS_STREAM.id, GLASS_STREAM],
  [SPIRAL.id, SPIRAL],
  [CYLINDER.id, CYLINDER],
  [ORBIT.id, ORBIT],
  [STACK_SHUFFLE.id, STACK_SHUFFLE],
  [FAN.id, FAN],
  [MASONRY.id, MASONRY],
  [TILT_GRID.id, TILT_GRID],
]);

/** Look up a template; unknown ids resolve to the placeholder, never to undefined. */
export function byId(id: string): Template {
  return BY_ID.get(id) ?? PLACEHOLDER_TEMPLATE;
}

/** Count of templates in one category. */
export function countIn(cat: CategoryId): number {
  return TEMPLATES.filter(t => t.cat === cat).length;
}
