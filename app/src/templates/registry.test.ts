import { describe, expect, it } from 'vitest';
import { CATEGORIES, TEMPLATES } from './registry';
import { newProject } from '../state/defaults';
import { applyTemplate } from './select';
import { defaults } from './params';
import { mediaPicker } from '../media/mediaSource';
import type { Env, P, Template } from './types';
import type { MediaItem } from '../state/types';

const sourceCategories = {
  signature: [
    ['shelf', 'Record Shelf'],
    ['portal-ring', 'Spiral Portal'],
    ['icon-drum', 'Icon Drum'],
    ['crumple', 'Crumple Strip'],
    ['halo', 'Halo'],
    ['formations', 'Formations'],
    ['film-roll', 'Film Roll'],
    ['glass-row', 'Glass Gallery'],
    ['twist-band', 'Twist Band'],
    ['flip-trio', 'Flip Trio'],
  ],
  transitions: [
    ['flare-duo', 'Flare Duo'],
    ['prism-slider', 'Prism Slider'],
    ['portal', 'Portal'],
    ['slide-push', 'Slide Push'],
    ['cube-turn', 'Cube Turn'],
    ['fold-flip', 'Card Flip'],
    ['rise-up', 'Rise Up'],
    ['swap', 'Swap'],
    ['zoom-blur', 'Zoom Blur'],
    ['hero-strip', 'Hero Strip'],
  ],
  ring: [
    ['spiral', 'Spiral Collection'],
    ['cylinder', 'Cylinder'],
    ['orbit', 'Orbit'],
    ['ring', 'Ring'],
    ['double-ring', 'Double Ring'],
    ['helix', 'Helix'],
    ['sphere', 'Sphere'],
    ['ribbon-loop', 'Ribbon Loop'],
    ['tunnel', 'Tunnel'],
    ['wheel', 'Wheel'],
    ['saturn', 'Saturn'],
    ['turbine', 'Turbine'],
    ['vortex', 'Vortex'],
    ['pinwheel', 'Pinwheel'],
    ['tornado', 'Tornado'],
    ['arches', 'Arch Gates'],
    ['lantern', 'Lantern Rings'],
  ],
  stack: [
    ['stack-shuffle', 'Stack Shuffle'],
    ['fan', 'Fan'],
    ['masonry', 'Masonry'],
    ['tilt-grid', 'Tilt Grid'],
    ['card-drop', 'Card Drop'],
    ['riffle', 'Riffle'],
    ['cascade', 'Cascade'],
    ['tandem', 'Tandem'],
    ['stack-peel', 'Stack Peel'],
    ['grid-wave', 'Grid Wave'],
    ['bento', 'Bento Reveal'],
    ['infinite-grid', 'Infinite Grid'],
    ['iso-wall', 'Isometric Wall'],
    ['frames', 'Frames'],
    ['mosaic-flip', 'Mosaic Flip'],
    ['assemble', 'Assemble'],
    ['deck-dive', 'Deck Dive'],
    ['counter-cols', 'Counter Columns'],
    ['grid-zoom', 'Grid Zoom'],
    ['deal', 'Deal'],
  ],
  carousel: [
    ['glass-carousel', 'Glass Carousel'],
    ['orb-marquee', 'Orb Marquee'],
    ['coverflow', 'Coverflow'],
    ['feed', 'Glass Feed'],
    ['slider', 'Slider'],
    ['arc-wheel', 'Arc Wheel'],
    ['sidestack', 'Sidestack'],
    ['elevator', 'Elevator'],
    ['repeater', 'Image Repeater'],
    ['melt-row', 'Melt Row'],
    ['glass-stream', 'Glass Stream'],
    ['elastic', 'Elastic Scroll'],
    ['paper-roll', 'Paper Roll'],
    ['pleats', 'Pleated Wall'],
    ['crossfire', 'Crossfire'],
    ['silk', 'Silk Ribbon'],
  ],
  '3d': [
    ['cubic', 'Cubic'],
    ['space', 'Space'],
    ['flip-flap', 'Flip-Flap'],
    ['hero-tilt', 'Hero Tilt'],
    ['spin', 'Spin'],
    ['trio', 'Trio'],
    ['rolodex', 'Rolodex'],
    ['golden-zoom', 'Infinite Zoom'],
    ['corridor', 'Gallery Walk'],
    ['drift', 'Floating Gallery'],
    ['page-fan', 'Page Fan'],
  ],
  glass: [
    ['lens-slider', 'Liquid Lens'],
    ['lens-grid', 'Lens Grid'],
    ['magnifier', 'Magnifier'],
    ['prism-frame', 'Prism Frame'],
  ],
  gallery: [
    ['crate', 'Vinyl Crate'],
    ['fisheye', 'Fisheye Wall'],
    ['planetarium', 'Planetarium'],
    ['dock', 'Thumb Dock'],
    ['salon', 'Salon Wall'],
    ['mirror', 'Mirror Floor'],
    ['rack-focus', 'Rack Focus'],
    ['page-turn', 'Page Turn'],
    ['puzzle', 'Sliding Puzzle'],
    ['river', 'Photo River'],
    ['slots', 'Slot Reels'],
    ['aperture', 'Aperture'],
    ['mood-board', 'Mood Board'],
  ],
  kinetic: [
    ['pendulum', 'Pendulum Wave'],
    ['fountain', 'Fountain'],
    ['leaves', 'Falling Leaves'],
    ['murmuration', 'Murmuration'],
    ['serpent', 'Serpent'],
    ['slinky', 'Slinky'],
    ['house', 'House of Cards'],
    ['hourglass', 'Hourglass'],
    ['big-bang', 'Big Bang'],
    ['gears', 'Gears'],
    ['ferris', 'Ferris Wheel'],
    ['cradle', "Newton's Cradle"],
    ['ripples', 'Ripple Rings'],
    ['domino-run', 'Domino Run'],
  ],
  choreo: [
    ['revolving-door', 'Revolving Door'],
    ['ribbon-spread', 'Ribbon Spread'],
    ['twist-tower', 'Twist Tower'],
    ['amphitheatre', 'Amphitheatre'],
    ['clothesline', 'Clothesline'],
    ['barrel-wave', 'Barrel Wave'],
    ['magic-carpet', 'Magic Carpet'],
    ['atom', 'Atom'],
    ['tesseract', 'Tesseract'],
    ['roulette', 'Roulette'],
    ['echo-trail', 'Echo Trail'],
    ['galaxy', 'Galaxy'],
    ['tumble', 'Tumble'],
    ['double-doors', 'Double Doors'],
    ['starburst', 'Starburst'],
    ['opening-crawl', 'Opening Crawl'],
    ['flag', 'Flag'],
    ['runway', 'Runway'],
    ['proximity-wave', 'Proximity Wave'],
    ['proximity-dock', 'Proximity Dock'],
    ['proximity-ring', 'Proximity Ring'],
    ['repel-field', 'Repel Field'],
    ['flicker', 'Flicker'],
    ['bent-marquee', 'Bent Marquee'],
    ['cover-bend', 'Cover Bend'],
    ['sheet-slide', 'Sheet Slide'],
    ['slide', 'Slide'],
    ['pulse-grid', 'Pulse Grid'],
    ['wrap', 'Wrap'],
    ['ring-wave', 'Ring Wave'],
    ['slalom', 'Slalom'],
    ['waterfall', 'Waterfall'],
    ['gymnast-ribbon', 'Gymnast Ribbon'],
    ['sign', 'Sign'],
    ['swatch-fan', 'Swatch Fan'],
    ['spiral-deal', 'Spiral Deal'],
    ['s-wall', 'S-Wall'],
    ['sketch-path', 'Sketch Path'],
    ['immersive', 'Immersive'],
    ['stamp', 'Stamp'],
  ],  sculpture: [
    ['rubik', "Rubik's Cube"],
    ['morph', 'Morph'],
    ['gyroscope', 'Gyroscope'],
    ['knot', 'Torus Knot'],
    ['kaleido', 'Kaleidoscope'],
    ['bloom', 'Bloom'],
    ['braid', 'Braid'],
    ['orrery', 'Orrery'],
    ['sunflower', 'Sunflower'],
    ['exploded', 'Exploded View'],
    ['trivision', 'Tri-Vision'],
  ],
} as const;

const APP_ONLY_TEMPLATE_IDS = [
  'carousel-classic',
  'grid-classic',
  'perspective-classic',
  'ring-classic',
  'stack-classic',
] as const;

function galleryEnv(n: number, vx = 5.5, vy = 1): Env {
  return { p: 0.3, n, asp: 1, w: 0.8, h: 0.8, vx, vy, D: 2, mb: n, m: n, rnd: () => 0.5, ez: value => value, hold: 0.5 };
}

function galleryTemplate(id: string): Template {
  return TEMPLATES.find(template => template.id === id)!;
}

describe('template categories', () => {
  it.each(Object.entries(sourceCategories))('registers every %s source template exactly once with its source name and layout', (category, expected) => {
    const sourceIds = new Set<string>(expected.map(([id]) => id));
    const templates = TEMPLATES.filter(template => template.cat === category && sourceIds.has(template.id));
    expect(templates.map(({ id, name }) => [id, name])).toEqual(expected);
    expect(templates.every(template => typeof template.layout === 'function')).toBe(true);
    for (const [id] of expected) {
      expect(TEMPLATES.filter(template => template.id === id)).toHaveLength(1);
    }
  });

  it('bounds gallery fill counts and preserves generated-slot media mapping', () => {
    const fisheye = galleryTemplate('fisheye');
    const fishFill = fisheye.fill!(defaults(fisheye), galleryEnv(fisheye.n, 1_000_000, 1_000_000)) as Record<string, number>;
    expect(fishFill.cols).toBeLessThanOrEqual(24);
    expect(fishFill.rows).toBeLessThanOrEqual(20);
    expect(fishFill.count).toBe(fishFill.cols * fishFill.rows);
    expect(fishFill.count).toBeLessThanOrEqual(480);
    const fishLayoutEnv = { ...galleryEnv(fisheye.n), ...fisheye.fill!(defaults(fisheye), galleryEnv(fisheye.n)) } as Env;
    expect(fisheye.layout(0, defaults(fisheye), fishLayoutEnv).img).toBe(0);
    expect(fisheye.layout(fishFill.cols + 1, defaults(fisheye), fishLayoutEnv).img).toBe(fishFill.cols + 1);

    const mirror = galleryTemplate('mirror');
    const mirrorParams = defaults(mirror) as P;
    const mirrorEnv = galleryEnv(mirror.n, 1_000_000);
    const mirrorFill = mirror.fill!(mirrorParams, mirrorEnv) as Record<string, number>;
    expect(mirrorFill.m).toBeLessThanOrEqual(240);
    expect(mirrorFill.count).toBe(2 * mirrorFill.m);
    expect(mirrorFill.count).toBeLessThanOrEqual(480);
    const mirrorLayoutEnv = { ...mirrorEnv, ...mirrorFill } as Env;
    const original = mirror.layout(3, mirrorParams, mirrorLayoutEnv);
    const reflection = mirror.layout(mirrorFill.m + 3, mirrorParams, mirrorLayoutEnv);
    expect(original.img ?? 3 % mirror.n).toBe(reflection.img ?? (mirrorFill.m + 3) % mirror.n);

    const salon = galleryTemplate('salon');
    const salonFill = salon.fill!(defaults(salon), galleryEnv(salon.n, 1_000_000)) as { count: number };
    expect(salonFill.count).toBeLessThanOrEqual(salon.n * 9);

    const dock = galleryTemplate('dock');
    const dockParams = defaults(dock) as P;
    const dockFill = dock.fill!(dockParams, galleryEnv(dock.n)) as { count: number };
    expect(dockFill.count).toBe(2 * dock.n);
    expect(dock.layout(dock.n + 5, dockParams, galleryEnv(dock.n)).img).toBe(5);

    const pages = galleryTemplate('page-turn');
    const pageParams = defaults(pages) as P;
    expect(pages.layout(3, pageParams, galleryEnv(pages.n)).img).toBe(3);
    expect(pages.layout(pages.n + 3, pageParams, galleryEnv(pages.n)).img).toBe(7);

    const reels = galleryTemplate('slots');
    const reelParams = { ...defaults(reels), reels: 6 } as P;
    const reelFill = reels.fill!(reelParams, galleryEnv(reels.n)) as { count: number };
    expect(reelFill.count).toBe(48);
    const puzzle = galleryTemplate('puzzle');
    const puzzleFill = puzzle.fill!({ ...defaults(puzzle), grid: 6 } as P, galleryEnv(puzzle.n)) as { count: number };
    expect(puzzleFill.count).toBe(35);
    const aperture = galleryTemplate('aperture');
    const apertureParams = { ...defaults(aperture), blades: 12 } as P;
    const apertureFill = aperture.fill!(apertureParams, galleryEnv(aperture.n)) as { count: number };
    expect(apertureFill.count).toBe(aperture.n + 12);
    expect(aperture.layout(apertureFill.count - 1, apertureParams, galleryEnv(aperture.n)).img).toBe(aperture.n + 11);
    const images: MediaItem[] = ['a', 'b', 'c'].map(id => ({ id, kind: 'image', name: id, width: 10, height: 10 }));
    const pick = mediaPicker({ order: 'in', seed: 1, images });
    expect(Array.from({ length: reelFill.count }, (_, i) => pick(reels.layout(i, reelParams, galleryEnv(reels.n)).img ?? i % reels.n)?.id))
      .toEqual(Array.from({ length: reelFill.count }, (_, i) => images[i % images.length].id));

    const moodBoard = galleryTemplate('mood-board');
    const moodFill = moodBoard.fill!(defaults(moodBoard), galleryEnv(moodBoard.n, 1_000_000)) as { m: number; count: number };
    expect(moodFill.count).toBeLessThanOrEqual(240);
    expect(moodFill.count).toBe(moodFill.m);
  });

  it('keeps source gallery timing, fill, and fixed-card defaults', () => {
    const values = (id: string) => defaults(galleryTemplate(id));
    expect(['dock', 'page-turn', 'aperture'].map(id => {
      const { step, perCard } = galleryTemplate(id);
      return [id, step, perCard];
    })).toEqual([['dock', true, 2.2], ['page-turn', true, 1.5], ['aperture', true, 2.4]]);
    expect(values('puzzle')).toMatchObject({ grid: 4, moves: 12, shuffle: 7, ease: 'inOutQuint' });
    expect(galleryTemplate('puzzle').fixedN).toBe(true);
    expect(values('fisheye')).toMatchObject({ bulge: 0.78, gap: 0.16, driftX: 1, driftY: 1 });
  });

  it('keeps archived stack timing and parameter defaults', () => {
    const template = (id: string) => TEMPLATES.find(candidate => candidate.id === id)!;
    const values = (id: string) => defaults(template(id));

    expect(['card-drop', 'tandem', 'stack-peel', 'deck-dive'].map(id => {
      const { step, perCard } = template(id);
      return [id, step, perCard];
    })).toEqual([
      ['card-drop', true, 1.1],
      ['tandem', true, 1.4],
      ['stack-peel', true, 1.3],
      ['deck-dive', true, 1.5],
    ]);
    expect(values('card-drop')).toMatchObject({ mess: 0.5, height: 2.6, land: 'outBack' });
    expect(values('stack-peel')).toMatchObject({ shown: 6, peelH: 1.05, dim: 0.08 });
    expect(values('masonry')).toMatchObject({ cols: 3, gap: 0.07, flow: 'alt', oddSpeed: 1 });
    expect(values('grid-zoom')).toMatchObject({ cols: 4, fill: 0.94, ease: 'inOutQuint' });
    expect(values('deal')).toMatchObject({ deckPos: 'bl', flipAmt: 1, poseRx: 24 });
  });

  it('keeps archived Kinetic timing, controls, defaults, and bounded fill behavior', () => {
    const kinetic = TEMPLATES.filter(template => template.cat === 'kinetic');
    const byId = (id: string) => kinetic.find(template => template.id === id)!;
    const values = (id: string) => defaults(byId(id));

    expect(kinetic.map(({ id, name, n, aspect, cardH, dur, step, perCard, fixedN }) => [id, name, n, aspect, cardH, dur, step, perCard, fixedN])).toEqual([
      ['pendulum', 'Pendulum Wave', 12, 0.8, 0.3, 60, undefined, undefined, undefined],
      ['fountain', 'Fountain', 30, 0.8, 0.3, 9, undefined, undefined, undefined],
      ['leaves', 'Falling Leaves', 22, 0.8, 0.34, 16, undefined, undefined, undefined],
      ['murmuration', 'Murmuration', 64, 0.8, 0.14, 24, undefined, undefined, undefined],
      ['serpent', 'Serpent', 18, 0.8, 0.34, 14, undefined, undefined, undefined],
      ['slinky', 'Slinky', 8, 0.8, 0.7, undefined, true, 0.8, undefined],
      ['house', 'House of Cards', 15, 0.7, 0.48, 14, undefined, undefined, true],
      ['hourglass', 'Hourglass', 56, 0.8, 0.2, 16, undefined, undefined, undefined],
      ['big-bang', 'Big Bang', 40, 0.8, 0.36, 12, undefined, undefined, undefined],
      ['gears', 'Gears', 24, 0.55, 0.26, 16, undefined, undefined, true],
      ['ferris', 'Ferris Wheel', 12, 0.8, 0.32, 30, undefined, undefined, undefined],
      ['cradle', "Newton's Cradle", 5, 1, 0.36, 3.2, undefined, undefined, undefined],
      ['ripples', 'Ripple Rings', 17, 0.8, 0.26, 14, undefined, undefined, undefined],
      ['domino-run', 'Domino Run', 18, 0.64, 0.5, 8, undefined, undefined, undefined],
    ]);

    expect(values('pendulum')).toMatchObject({ pivot: 0.6, length: 0.6, lenRamp: 0, gap: 0.12, base: 14, stepN: 1, amp: 0.62, phase: 0, swingShade: 0.15, mblur: 0, poseRy: -52, poseRx: 10 });
    expect(values('fountain')).toMatchObject({ height: 1, spread: 1, depthF: 1.6, drag: 0, bursts: 2, volley: 0, whirl: 1.2, flip: 0, grow: 0.35, mblur: 0 });
    expect(values('leaves')).toMatchObject({ depth: 2.4, spread: 1, wind: 0, nearSp: 2, sway: 0.45, swings: 2, flip: 0.6, twirl: 0, depthDim: 0.15, dof: 0 });
    expect(values('murmuration')).toMatchObject({ flock: 0.8, flockH: 0.6, stretch: 1, jit: 0.1, roam: 0.45, loops: 1, breath: 0.2, flap: 0.4, sizeMix: 0.4, depthShade: 0 });
    expect(values('serpent')).toMatchObject({ reach: 0.85, rise: 0.58, coils: 3, spacing: 1, taper: 0.55, laps: 1, undulate: 0, bank: 0.6, tailFade: 0, tailShade: 0 });
    expect(values('slinky')).toMatchObject({ arch: 0.8, apart: 1, depth: 0.07, fan: 0.03, arcZ: 0.25, flips: 1, tumble: 0, pop: 0, stackShade: 0.05, mblur: 0 });
    expect(values('house')).toMatchObject({ lean: 0.3, tentGap: 0.05, build: 0.6, dropH: 1.2, spinIn: 0.6, toss: 1, scatter: 1, gravity: 3.4, levelShade: 0, crashBlur: 0, poseRx: 12 });
    expect(values('hourglass')).toMatchObject({ bulb: 1.05, neck: 0.05, neckLen: 0.06, round: 1, tilt: 0.3, flow: 1, swirl: 2, tumble: 0, backShade: 0.25, sizeFall: 0.6 });
    expect(values('big-bang')).toMatchObject({ radius: 0.95, flatten: 0, shell: 0.4, blast: 0.2, burstSpread: 0.05, hang: 0.4, whirl: 1, wild: 0.5, flash: 0, cloudBlur: 0 });
    expect(values('gears')).toMatchObject({ ratio: '16', pitchK: 1.22, mesh: 0.92, meshPh: 0, layer: 0, tilt: 0.25, turns: 1, tick: 0, smallTone: 0.92, toothShade: 0 });
    expect(values('ferris')).toMatchObject({ radius: 1, hub: 0.1, arm: 0.56, rides: 1, sway: 0.14, swayN: 4, lag: 0, depth: 0.3, nightShade: 0.15, topPop: 0 });
    expect(values('cradle')).toMatchObject({ pivotY: 0.95, length: 0.95, spacing: 1.01, movers: 1, amp: 0.5, beats: 1, kick: 0, swivel: 0, mblur: 0, restShade: 0 });
    expect(values('ripples')).toMatchObject({ rings: 5, per: 16, reach: 1.25, align: 0, tilt: 0.95, waves: 1, twist: 0.5, swell: 0, grow: 0.7, fadeAt: 0.85 });
    expect(values('domino-run')).toMatchObject({ sway: 0.6, bends: 1, length: 3.6, messy: 0, wave: 0.5, topple: 1, fallTime: 1, riseTime: 1, fallShade: 0, farBlur: 0, poseRx: 12 });

    const house = byId('house');
    const houseFill = house.fill!(values('house'), galleryEnv(house.n)) as { count: number; spots: unknown[] };
    expect(houseFill.count).toBe(house.n);
    expect(houseFill.spots).toHaveLength(house.n);

    const ripples = byId('ripples');
    const ripplesMax = ripples.fill!({ ...values('ripples'), rings: 8, per: 24 }, galleryEnv(ripples.n)) as { count: number };
    expect(ripplesMax.count).toBe(192);
    expect(ripplesMax.count).toBeLessThanOrEqual(240);
  });

  it('keeps archived Sculpture timing, controls, and defaults', () => {
    const sculpture = TEMPLATES.filter(template => template.cat === 'sculpture');
    const byId = (id: string) => sculpture.find(template => template.id === id)!;
    const values = (id: string) => defaults(byId(id));

    expect(sculpture.map(({ id, name, n, aspect, cardH, dur, fixedN }) => [id, name, n, aspect, cardH, dur, fixedN])).toEqual([
      ['rubik', "Rubik's Cube", 54, 1, 0.3, 16, true],
      ['morph', 'Morph', 48, 0.8, 0.22, 18, true],
      ['gyroscope', 'Gyroscope', 36, 0.8, 0.26, 20, undefined],
      ['knot', 'Torus Knot', 64, 1.2, 0.16, 26, undefined],
      ['kaleido', 'Kaleidoscope', 17, 0.8, 0.3, 20, undefined],
      ['bloom', 'Bloom', 25, 0.55, 0.82, 12, true],
      ['braid', 'Braid', 18, 0.8, 0.32, 24, undefined],
      ['orrery', 'Orrery', 22, 0.8, 0.62, 24, true],
      ['sunflower', 'Sunflower', 90, 0.8, 0.19, 24, undefined],
      ['exploded', 'Exploded View', 6, 0.8, 1, 10, undefined],
      ['trivision', 'Tri-Vision', 21, 0.28, 1.15, 9, undefined],
    ]);
    expect(values('rubik')).toMatchObject({ moves: 6, shuffle: 4, gap: 0.08, view: 0.5, pause: 0.3, whirl: 1, turnPop: 0, faceShade: 0, turnBlur: 0 });
    expect(values('morph')).toMatchObject({ shape: 1, scatter: 0, helix: 0.52, wallCurve: 0, shapeHold: 0.5, stagger: 0.25, whirl: 1, tumble: 0, burst: 0, backShade: 0 });
    expect(values('gyroscope')).toMatchObject({ radius: 1, gap: 0.18, axis: 0.35, hug: 1, inner: 2, outer: 1, run: 1, nutate: 0, ringTone: 0.08, backShade: 0 });
    expect(values('knot')).toMatchObject({ pq: 3, winds: 2, tube: 0.3, radius: 0.84, puff: 1.3, whirl: 0, glide: 1, breath: 0, depthShade: 0.22, dof: 0 });
    expect(values('kaleido')).toMatchObject({ folds: 6, rings: 3, ringStep: 0.34, depth: 0.2, whirl: 1, counter: true, breathe: 0.22, breaths: 2, rock: 0.3, ringShade: 0 });
    expect(values('bloom')).toMatchObject({ open: 0.92, cup: 0.3, petalGrow: 0.22, layerOff: 0.32, heart: 0.42, whirl: 1, cycles: 1, delay: 0, flutter: 0, budShade: 0.2, poseRx: -20 });
    expect(values('braid')).toMatchObject({ amp: 0.42, wave: 2.8, depth: 0.5, gap: 0.05, twist: 0, slide: 1, drift: 0, ripple: 0, underShade: 0, underBlur: 0 });
    expect(values('orrery')).toMatchObject({ tilt: 1, spread: 1, ecc: 0, incline: 0, sun: 1, pace: 1, rhythm: 'kepler', bob: 0, orbitShade: 0.15, farBlur: 0 });
    expect(values('sunflower')).toMatchObject({ spread: 1, diverge: 0, facing: 'out', cup: 0, grow: 0.55, whirl: 1, pulse: 0.25, waveSp: 2, waveRings: 1.1, glow: 0 });
    expect(values('exploded')).toMatchObject({ spread: 1, slide: 0.18, tilt: 0.95, twist: 0.72, fan: 0, apart: 0.24, delay: 0, whirl: 0, layerShade: 0.15, dof: 0 });
    expect(values('trivision')).toMatchObject({ slats: 7, gap: 0.04, curve: 0, wave: 0.045, from: 'l', pause: 0.2, pop: 0, faceShade: 0.3, turnBlur: 0 });

    expect(byId('kaleido').fill!(values('kaleido'), galleryEnv(17))).toMatchObject({ count: 18 });
    expect(byId('trivision').fill!(values('trivision'), galleryEnv(21))).toMatchObject({ count: 21 });
  });

  it('matches all 166 archived IDs, keeps app-only entries, and exposes every category', () => {
    const archivedIds = Object.values(sourceCategories).flatMap(category => category.map(([id]) => id));
    const catalogIds = TEMPLATES.map(template => template.id);
    const appOnlyIds = new Set<string>(APP_ONLY_TEMPLATE_IDS);

    expect(archivedIds).toHaveLength(166);
    expect(new Set(archivedIds).size).toBe(166);
    expect(catalogIds).toHaveLength(171);
    expect(new Set(catalogIds).size).toBe(171);
    expect(catalogIds.filter(id => !appOnlyIds.has(id)).sort()).toEqual([...archivedIds].sort());
    expect(CATEGORIES).toHaveLength(11);
    expect(new Set(TEMPLATES.map(template => template.cat))).toEqual(new Set(CATEGORIES.map(category => category.id)));

    for (const id of APP_ONLY_TEMPLATE_IDS) {
      expect(TEMPLATES.filter(template => template.id === id)).toHaveLength(1);
    }

    for (const template of TEMPLATES) {
      expect(applyTemplate(newProject(), template).templateId).toBe(template.id);
    }
  });

  it('uses the canonical catalog categories and keeps app-only templates in the registry', () => {
    expect(CATEGORIES).toEqual([
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
    ]);

    const categoryIds = new Set(CATEGORIES.map(category => category.id));

    expect(TEMPLATES.every(template => categoryIds.has(template.cat))).toBe(true);
    expect(new Set(TEMPLATES.map(template => template.id)).size).toBe(TEMPLATES.length);

    for (const id of APP_ONLY_TEMPLATE_IDS) {
      expect(TEMPLATES.some(template => template.id === id)).toBe(true);
    }
  });
});
