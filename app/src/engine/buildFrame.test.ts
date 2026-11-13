import { describe, expect, it } from 'vitest';
import { buildFrame } from './buildFrame';
import { newProject } from '../state/defaults';
import { TEMPLATES } from '../templates/registry';
import { applyTemplate } from '../templates/select';
import { COUNT_CONTROL, defaults } from '../templates/params';
import { mediaPicker } from '../media/mediaSource';
import type { MediaItem, ProjectState } from '../state/types';
import type { Env, P } from '../templates/types';
import { glassCarouselCamera, glassCarouselLayout, glassStreamFill, glassStreamLayout, riseUpLayout, slidePushFill, swapLayout, wheelLayout, zoomBlurLayout } from '../templates/layouts';

const item = (id: string): MediaItem => ({ id, kind: 'image', name: id, width: 10, height: 10 });

function stateFor(templateId: string): ProjectState {
  return { ...newProject(), templateId };
}

function layoutEnv(n: number): Env {
  return {
    p: 0.3,
    n,
    asp: 1,
    w: 1,
    h: 1,
    vx: 5.5,
    vy: 1,
    D: 2,
    mb: n,
    m: n,
    rnd: () => 0.5,
    ez: value => value,
    hold: 0.5,
  };
}

describe('buildFrame', () => {
  it('draws visible cards for a brand-new project (default params are {})', () => {
    const d = buildFrame(newProject(), 0, 800, 450);
    expect(d.cards.length).toBeGreaterThan(0);
    // The old `Number(P.fade) ?? 1` made every opacity NaN, so nothing was ever drawn.
    expect(d.cards.some(c => c.opacity > 0.002)).toBe(true);
    for (const c of d.cards) expect(Number.isNaN(c.opacity)).toBe(false);
  });

  it.each(TEMPLATES.filter(t => t.kind !== 'flare').map(t => [t.id]))('template %s yields finite, drawable cards', id => {
    for (const t of [0, 1.7, 4.2]) {
      const d = buildFrame(stateFor(id), t, 640, 360);
      expect(d.cards.length).toBeGreaterThan(0);
      if (!((id === 'bento' || id === 'sketch-path') && t === 0)) expect(d.cards.some(c => c.opacity > 0.002)).toBe(true);
      for (const c of d.cards) {
        expect(Number.isFinite(c.opacity)).toBe(true);
        expect(Number.isFinite(c.blur)).toBe(true);
        expect(Array.from(c.m).every(Number.isFinite)).toBe(true);
        expect(c.edgeCol.every(Number.isFinite)).toBe(true);
        expect(c.face.aspect).toBeGreaterThan(0);
      }
    }
  });

  it.each(TEMPLATES.filter(template => template.kind !== 'flare').map(template => [template.id, template]))(
    'builds finite placeholder frames for %s at default and supported count boundaries',
    (_id, template) => {
      const counts = template.fixedN
        ? [template.n]
        : [...new Set([template.n, COUNT_CONTROL.min, COUNT_CONTROL.max])];

      for (const count of counts) {
        const state = applyTemplate(stateFor(template.id), template);
        if (!template.fixedN && count !== template.n) state.params = { count };
        const activeCount = template.fixedN ? template.n : count;
        const loopDuration = template.step
          ? (template.perCard ?? 1.4) * activeCount
          : (template.dur ?? 10);

        for (const time of [0, loopDuration]) {
          const frame = buildFrame(state, time, 640, 360, { rate: 1 });

          expect(frame.cards.length).toBeGreaterThan(0);
          expect(frame.cards.every(card => card.face.key.startsWith('ph:'))).toBe(true);
          expect(frame.cards.every(card => Number.isFinite(card.opacity) && Number.isFinite(card.blur))).toBe(true);
          expect(frame.cards.every(card => Array.from(card.m).every(Number.isFinite))).toBe(true);
          expect(frame.cards.every(card => card.edgeCol.every(Number.isFinite))).toBe(true);
          expect(frame.cards.every(card => Number.isFinite(card.w) && card.w > 0 && Number.isFinite(card.h) && card.h > 0)).toBe(true);
          expect(frame.cards.every(card => Number.isFinite(card.face.aspect) && card.face.aspect > 0)).toBe(true);
          expect(frame.camera.eye.every(Number.isFinite)).toBe(true);
          expect(frame.camera.target.every(Number.isFinite)).toBe(true);
        }
      }
    },
  );

  it.each(TEMPLATES.filter(template => template.cat === 'signature' || template.cat === 'transitions' || template.cat === 'carousel' || template.cat === 'ring' || template.cat === 'stack').map(template => [template.id, template]))(
    'builds finite frames for %s at phase zero and one loop duration',
    (_id, template) => {
      const loopDuration = template.step ? (template.perCard ?? 1.4) * template.n : (template.dur ?? 10);
      for (const time of [0, template.step ? (template.perCard ?? 1.4) * 0.75 : loopDuration * 0.37, loopDuration]) {
        const frame = buildFrame(stateFor(template.id), time, 640, 360, { rate: 1 });
        if (template.kind === 'flare') {
          expect(frame.flare).not.toBeNull();
          expect(Number.isFinite(frame.flare?.u.uW)).toBe(true);
          continue;
        }
        expect(frame.cards.length).toBeGreaterThan(0);
        for (const card of frame.cards) {
          expect(Number.isFinite(card.opacity)).toBe(true);
          expect(Number.isFinite(card.blur)).toBe(true);
          expect(Array.from(card.m).every(Number.isFinite)).toBe(true);
        }
      }
    },
  );

  it.each(TEMPLATES.filter(template => template.cat === '3d' || template.cat === 'glass').map(template => [template.id, template]))(
    'builds a finite source-style frame for %s',
    (_id, template) => {
      const state = applyTemplate(stateFor(template.id), template);
      const frame = buildFrame(state, 0.5, 640, 360);

      expect(frame.cards.length).toBeGreaterThan(0);
      expect(frame.cards.every(card => Number.isFinite(card.opacity) && Array.from(card.m).every(Number.isFinite))).toBe(true);
      expect(frame.camera.eye.every(Number.isFinite)).toBe(true);
      expect(frame.post).not.toBeNull();
    },
  );

  it.each(TEMPLATES.filter(template => template.cat === 'gallery').map(template => [template.id, template]))(
    'builds a finite source-style gallery frame for %s',
    (_id, template) => {
      const state = applyTemplate(stateFor(template.id), template);
      const frame = buildFrame(state, 0.5, 640, 360);

      expect(frame.cards.length).toBeGreaterThan(0);
      expect(frame.cards.every(card => Number.isFinite(card.opacity) && Number.isFinite(card.blur) && Array.from(card.m).every(Number.isFinite))).toBe(true);
      expect(frame.camera.eye.every(Number.isFinite)).toBe(true);
      expect(frame.camera.target.every(Number.isFinite)).toBe(true);
    },
  );

  it.each(TEMPLATES.filter(template => template.cat === 'kinetic').map(template => [template.id, template]))(
    'builds finite source-style Kinetic frames for %s at the loop boundary',
    (_id, template) => {
      const loopDuration = template.step ? (template.perCard ?? 1.4) * template.n : (template.dur ?? 10);
      for (const time of [0, loopDuration * 0.37, loopDuration]) {
        const frame = buildFrame(applyTemplate(stateFor(template.id), template), time, 640, 360);
        expect(frame.cards.length).toBeGreaterThan(0);
        expect(frame.cards.every(card => Number.isFinite(card.opacity) && Number.isFinite(card.blur) && Array.from(card.m).every(Number.isFinite))).toBe(true);
        expect(frame.camera.eye.every(Number.isFinite)).toBe(true);
        expect(frame.camera.target.every(Number.isFinite)).toBe(true);
      }
    },
  );

  it.each(TEMPLATES.filter(template => template.cat === 'sculpture').map(template => [template.id, template]))(
    'builds finite source-style Sculpture frames for %s at the loop boundary',
    (_id, template) => {
      const loopDuration = template.dur ?? 10;
      for (const time of [0, loopDuration * 0.37, loopDuration]) {
        const frame = buildFrame(applyTemplate(stateFor(template.id), template), time, 640, 360);
        expect(frame.cards.length).toBeGreaterThan(0);
        expect(frame.cards.every(card => Number.isFinite(card.opacity) && Number.isFinite(card.blur) && Array.from(card.m).every(Number.isFinite))).toBe(true);
        expect(frame.cards.every(card => card.w > 0 && card.h > 0 && card.face.aspect > 0)).toBe(true);
      }
    },
  );

  it.each([
    'revolving-door',
    'ribbon-spread',
    'twist-tower',
    'amphitheatre',
    'clothesline',
    'barrel-wave',
    'magic-carpet',
    'atom',
    'tesseract',
    'roulette',
    'echo-trail',
    'galaxy',
    'tumble',
    'double-doors',
    'starburst',
    'opening-crawl',
    'flag',
    'runway',
    'proximity-wave',
    'proximity-dock',
    'proximity-ring',
    'repel-field',
    'flicker',
    'bent-marquee',
    'cover-bend',
    'sheet-slide',
    'slide',
    'pulse-grid',
    'wrap',
    'ring-wave',
    'slalom',
    'waterfall',
    'gymnast-ribbon',
    'sign',
    'swatch-fan',
    'spiral-deal',
    's-wall',
    'sketch-path',
    'immersive',
    'stamp',
  ])(
    'builds finite source-style Choreography frames for %s throughout the loop',
    id => {
      const template = TEMPLATES.find(candidate => candidate.id === id);
      expect(template).toBeDefined();
      const loopDuration = template!.step ? (template!.perCard ?? 1.4) * template!.n : (template!.dur ?? 10);
      for (const time of [0, loopDuration * 0.37, loopDuration]) {
        const state = applyTemplate(stateFor(id), template!);
        const frame = buildFrame(state, time, 640, 360);

        expect(frame.cards.length).toBeGreaterThan(0);
        expect(frame.cards.every(card => Number.isFinite(card.opacity) && Number.isFinite(card.blur) && Array.from(card.m).every(Number.isFinite))).toBe(true);
        expect(frame.camera.eye.every(Number.isFinite)).toBe(true);
        expect(frame.camera.target.every(Number.isFinite)).toBe(true);
      }
    },
  );
  it.each([
    'proximity-ring', 'repel-field', 'flicker', 'bent-marquee', 'cover-bend',
    'sheet-slide', 'slide', 'pulse-grid', 'wrap', 'ring-wave', 'slalom', 'waterfall',
    'gymnast-ribbon', 'sign', 'swatch-fan', 'spiral-deal', 's-wall', 'sketch-path',
    'immersive', 'stamp',
  ])('returns to the same choreography pose after one loop for %s', id => {
    const template = TEMPLATES.find(candidate => candidate.id === id)!;
    const loopDuration = template.step ? (template.perCard ?? 1.4) * template.n : (template.dur ?? 10);
    const state = applyTemplate(stateFor(id), template);
    const start = buildFrame(state, 0, 640, 360, { rate: 1 });
    const end = buildFrame(state, loopDuration, 640, 360, { rate: 1 });

    expect(end.cards).toHaveLength(start.cards.length);
    for (let i = 0; i < start.cards.length; i++) {
      for (let j = 0; j < start.cards[i].m.length; j++) expect(end.cards[i].m[j]).toBeCloseTo(start.cards[i].m[j], 4);
      expect(end.cards[i].opacity).toBeCloseTo(start.cards[i].opacity, 4);
      expect(end.cards[i].blur).toBeCloseTo(start.cards[i].blur, 4);
    }
    end.camera.eye.forEach((value, i) => expect(value).toBeCloseTo(start.camera.eye[i], 4));
    end.camera.target.forEach((value, i) => expect(value).toBeCloseTo(start.camera.target[i], 4));
  });

  it('preserves Sculpture matrix poses, per-card bending, and generated layouts in the shared frame pipeline', () => {
    const rubik = buildFrame(applyTemplate(stateFor('rubik'), TEMPLATES.find(template => template.id === 'rubik')!), 0.5, 640, 360);
    expect(rubik.cards).toHaveLength(54);
    expect(rubik.cards.some(card => card.m[12] !== 0 || card.m[13] !== 0 || card.m[14] !== 0)).toBe(true);

    const gyroscope = buildFrame(stateFor('gyroscope'), 0, 640, 360);
    expect(gyroscope.cards[0].bend).toBeCloseTo(-0.6 / 1.02);

    const kaleido = stateFor('kaleido');
    kaleido.params = { folds: 12, rings: 5 };
    expect(buildFrame(kaleido, 0.5, 640, 360).cards).toHaveLength(60);

    const braid = buildFrame(stateFor('braid'), 0.5, 640, 360);
    expect(braid.cards.length).toBeGreaterThan(18);
    expect(braid.cards.every(card => Number.isFinite(card.m[12]) && Number.isFinite(card.m[13]) && Number.isFinite(card.m[14]))).toBe(true);
  });

  it('uses archived stepped easing on the Rolodex drum', () => {
    const template = TEMPLATES.find(candidate => candidate.id === 'rolodex')!;
    const env = { ...layoutEnv(template.n), p: 0.16, hold: 0.5, ez: (value: number) => value };
    const pose = template.layout(0, defaults(template), env);
    const radius = env.h * (1 + 0.05) / (2 * Math.tan(Math.PI / template.n));

    expect(pose.m?.[13]).toBeCloseTo(radius * Math.sin(-1.2 * 2 * Math.PI / template.n));
  });

  it('carries source page bending, edge glass, and liquid lens defaults into frame descriptors', () => {
    const pageFan = TEMPLATES.find(template => template.id === 'page-fan')!;
    const prismFrame = TEMPLATES.find(template => template.id === 'prism-frame')!;
    const liquidLens = TEMPLATES.find(template => template.id === 'lens-slider')!;

    const bent = buildFrame(applyTemplate(stateFor(pageFan.id), pageFan), 0, 640, 360);
    expect(bent.cards[0].bend).toBeCloseTo(0.18);

    const glass = buildFrame(applyTemplate(stateFor(prismFrame.id), prismFrame), 0, 640, 360);
    expect(glass.post?.u.uEdge).toEqual([1, 1, 1, 1]);
    expect(glass.post?.u.uEW).toBeCloseTo(0.16);
    expect(glass.post?.u.uECurve).toEqual({ i: 1 });

    const lens = buildFrame(applyTemplate(stateFor(liquidLens.id), liquidLens), 0, 640, 360);
    expect(lens.post?.u.uLensOn).toBe(1);
    expect(lens.post?.u.uLensRef).toBeCloseTo(0.55);
    expect(lens.post?.u.uLensC).toHaveLength(2);
  });

  it('uses Glass Carousel radius and gap controls in its ring and camera', () => {
    const env = { ...layoutEnv(12), p: 0, w: 0.8 };
    const baseParams = { radius: 1, gap: 0.2 } as P;
    const widerRingParams = { ...baseParams, gap: 0.8 };
    const largerRingParams = { ...baseParams, radius: 2 };
    const basePose = glassCarouselLayout(0, baseParams, env);
    const widerGapPose = glassCarouselLayout(0, widerRingParams, env);
    const largerRadiusPose = glassCarouselLayout(0, largerRingParams, env);
    const baseCamera = glassCarouselCamera(baseParams, env);
    const widerGapCamera = glassCarouselCamera(widerRingParams, env);
    const largerRadiusCamera = glassCarouselCamera(largerRingParams, env);

    expect(basePose.m?.[14]).toBeCloseTo(-1.833, 2);
    expect(widerGapPose.m?.[14]).toBeCloseTo(-2.75, 2);
    expect(largerRadiusPose.m?.[14]).toBeCloseTo(-3.667, 2);
    expect(baseCamera.eye[2]).toBeCloseTo(0.22, 2);
    expect(widerGapCamera.eye[2]).toBeCloseTo(0.33, 2);
    expect(largerRadiusCamera.eye[2]).toBeCloseTo(0.44, 2);
  });

  it('matches the archived Glass Stream lane fill, spacing, and media mapping', () => {
    const env = { ...layoutEnv(15), p: 0, w: 0.8, h: 1, vx: 5.5, vy: 1, D: 2, mb: 5, m: 10 };
    const fill = glassStreamFill({ cols: 3, gap: 0.08 } as P, env);

    expect(fill).toEqual({ m: 10, mb: 5, count: 30 });
    const first = glassStreamLayout(0, { cols: 3, gap: 0.08 } as P, { ...env, ...fill });
    const nextRow = glassStreamLayout(3, { cols: 3, gap: 0.08 } as P, { ...env, ...fill });
    expect(first.x).toBeCloseTo(-0.864);
    expect(first.y).toBe(0);
    expect(first.img).toBe(0);
    expect(nextRow.y).toBeCloseTo(1.08);
    expect(nextRow.img).toBe(3);
  });

  it('matches archived transition fill and card positioning', () => {
    const env = layoutEnv(8);
    expect(slidePushFill({ gap: 0.08 } as P, env).count).toBe(16);

    const steppedEnv = { ...env, n: 6, m: 6 };
    expect(riseUpLayout(0, { from: 'below' } as P, steppedEnv).y).toBeCloseTo(-10.56);
    expect(zoomBlurLayout(0, {} as P, steppedEnv).s).toBeCloseTo(-0.32);

    const swap = swapLayout(0, {} as P, { ...env, n: 5, m: 5 });
    expect(swap.x).toBeCloseTo(0.36);
  });

  it('runs stack throw, swing-out, and peel transitions at the loop boundary', () => {
    const paramsById: Record<string, P> = {
      'stack-shuffle': { throwX: 1.05, spread: 1 } as P,
      tandem: { swingW: 0.55, offsetX: 0.18 } as P,
      'stack-peel': { peelSide: 1, peelH: 1.05, rise: 0.1, stepZ: 0.2, shrink: 0.04, dim: 0.08 } as P,
    };

    for (const id of Object.keys(paramsById)) {
      const template = TEMPLATES.find(candidate => candidate.id === id)!;
      const n = template.n;
      const env = { ...layoutEnv(n), p: (n - 0.25) / n, hold: 0.5 };
      const pose = template.layout(n - 1, paramsById[id], env);

      if (id === 'stack-shuffle') {
        expect(pose.x).toBeCloseTo((n - 1) * 0.07 / 2 + 1.05);
      } else if (id === 'tandem') {
        expect(pose.x).toBeCloseTo(-0.55);
        expect(pose.o).toBeCloseTo(0.5);
      } else {
        expect(pose.x).toBeCloseTo(1);
        expect(pose.y).toBeCloseTo(0.3 + 1.05);
      }
    }
  });

  it('fills the archived stack walls beyond their source card counts', () => {
    for (const id of ['masonry', 'tilt-grid', 'infinite-grid', 'iso-wall', 'counter-cols']) {
      const frame = buildFrame(stateFor(id), 0.5, 640, 360);
      const template = TEMPLATES.find(candidate => candidate.id === id)!;
      expect(frame.cards.length).toBeGreaterThan(template.n);
      expect(frame.cards.some(card => card.opacity > 0.002)).toBe(true);
      expect(frame.cards.every(card => Number.isFinite(card.opacity) && Array.from(card.m).every(Number.isFinite))).toBe(true);
    }
  });

  it('is deterministic for the same time', () => {
    const a = buildFrame(newProject(), 2.5, 800, 450);
    const b = buildFrame(newProject(), 2.5, 800, 450);
    expect(Array.from(a.cards[0].m)).toEqual(Array.from(b.cards[0].m));
  });

  it('gives cards a placeholder face when no media is loaded', () => {
    const d = buildFrame(newProject(), 0, 800, 450);
    expect(d.cards.every(c => c.face.key.startsWith('ph:'))).toBe(true);
  });

  it('builds valid Flare Duo transition faces and timing defaults', () => {
    const d = buildFrame(stateFor('flare-duo'), 0.5, 640, 480);

    expect(d.flare?.a?.key).toBe('ph:0');
    expect(d.flare?.b?.key).toBe('ph:1');
    expect(Number.isFinite(d.flare?.u.uW)).toBe(true);
    expect(d.flare?.u.uLv).toHaveLength(3);
  });

  it('uses the template camera as the base for global camera controls', () => {
    const state = stateFor('perspective-classic');
    state.style.camera.zoom = 2;

    const d = buildFrame(state, 0, 640, 360);

    expect(d.camera.eye).toEqual([0, 3, 6]);
    expect(d.camera.target).toEqual([0, 0, 0]);
  });

  it.each(['cylinder', 'orbit', 'ring', 'double-ring', 'ribbon-loop'])('uses the archived custom camera for %s through buildFrame', id => {
    const frame = buildFrame(stateFor(id), 0, 640, 360);
    expect(frame.camera.target).toEqual([0, 0, 0]);
    expect(frame.camera.eye[1]).toBeGreaterThan(0);
    expect(frame.cards.length).toBeGreaterThan(0);
  });

  it('matches Wheel radius pulse from the archived layout', () => {
    const env = { ...layoutEnv(12), p: 0 };
    const params = { radius: 1, pulse: 0.5, laps: 0, tilt: 0.35 } as P;
    const base = wheelLayout(0, params, env);
    const pulsed = wheelLayout(0, params, { ...env, p: 0.125 });

    expect(base.m?.[13]).toBeCloseTo(0.7 * Math.cos(0.35));
    expect(pulsed.m?.[13]).toBeCloseTo(1.05 * Math.cos(0.35));
  });

  it('keeps ring fill counts and Lantern media mapping on the shared frame path', () => {
    const lantern = buildFrame(stateFor('lantern'), 0, 640, 360);
    const arches = buildFrame(stateFor('arches'), 0, 640, 360);

    expect(lantern.cards).toHaveLength(48);
    expect(lantern.cards[12].face.key).toBe('ph:3');
    expect(arches.cards.length).toBeGreaterThan(14);
    expect(arches.cards.length % 5).toBe(0);
  });

  it('keeps ring card-facing modes in the frame transform path', () => {
    const outward = stateFor('ring');
    const cameraFacing = stateFor('ring');
    outward.params.face = 'out';
    cameraFacing.params.face = 'cam';

    const outwardFrame = buildFrame(outward, 0, 640, 360);
    const cameraFrame = buildFrame(cameraFacing, 0, 640, 360);

    expect(outwardFrame.cards[3].m).not.toEqual(cameraFrame.cards[3].m);
    expect(outwardFrame.cards[3].face).toEqual(cameraFrame.cards[3].face);
  });
});

describe('mediaPicker', () => {
  const images = ['a', 'b', 'c', 'd'].map(item);

  it('cycles in order', () => {
    const pick = mediaPicker({ order: 'in', seed: 1, images });
    expect([0, 1, 2, 3, 4, 5].map(k => pick(k)?.id)).toEqual(['a', 'b', 'c', 'd', 'a', 'b']);
  });

  it('shuffles the same way for the same seed, differently for another', () => {
    const ids = (seed: number) => {
      const pick = mediaPicker({ order: 'shuffle', seed, images });
      return [0, 1, 2, 3].map(k => pick(k)?.id).join('');
    };
    expect(ids(7)).toBe(ids(7));
    expect(ids(7).split('').sort().join('')).toBe('abcd'); // still a permutation
    expect(new Set([1, 2, 3, 4, 5, 6].map(ids)).size).toBeGreaterThan(1);
  });

  it('returns undefined when there is no media', () => {
    expect(mediaPicker({ order: 'in', seed: 1, images: [] })(0)).toBeUndefined();
  });
});
