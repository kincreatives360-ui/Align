import { describe, expect, it } from 'vitest';
import { buildFrame } from './buildFrame';
import { newProject } from '../state/defaults';
import { TEMPLATES } from '../templates/registry';
import { mediaPicker } from '../media/mediaSource';
import type { MediaItem, ProjectState } from '../state/types';

const item = (id: string): MediaItem => ({ id, kind: 'image', name: id, width: 10, height: 10 });

function stateFor(templateId: string): ProjectState {
  return { ...newProject(), templateId };
}

describe('buildFrame', () => {
  it('draws visible cards for a brand-new project (default params are {})', () => {
    const d = buildFrame(newProject(), 0, 800, 450);
    expect(d.cards.length).toBeGreaterThan(0);
    // The old `Number(P.fade) ?? 1` made every opacity NaN, so nothing was ever drawn.
    expect(d.cards.some(c => c.opacity > 0.002)).toBe(true);
    for (const c of d.cards) expect(Number.isNaN(c.opacity)).toBe(false);
  });

  it.each(TEMPLATES.map(t => [t.id]))('template %s yields finite, drawable cards', id => {
    for (const t of [0, 1.7, 4.2]) {
      const d = buildFrame(stateFor(id), t, 640, 360);
      expect(d.cards.length).toBeGreaterThan(0);
      expect(d.cards.some(c => c.opacity > 0.002)).toBe(true);
      for (const c of d.cards) {
        expect(Number.isFinite(c.opacity)).toBe(true);
        expect(Number.isFinite(c.blur)).toBe(true);
        expect(Array.from(c.m).every(Number.isFinite)).toBe(true);
        expect(c.edgeCol.every(Number.isFinite)).toBe(true);
        expect(c.face.aspect).toBeGreaterThan(0);
      }
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
