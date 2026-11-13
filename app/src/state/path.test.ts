import { describe, expect, it } from 'vitest';
import { getPath, hasPath, setPath } from './path';

describe('getPath', () => {
  const state = { style: { glass: { width: 0.18 } }, params: { gap: 4 } };

  it('reads a nested value', () => {
    expect(getPath(state, 'style.glass.width')).toBe(0.18);
  });

  it('reads an array element by index', () => {
    expect(getPath({ list: ['a', 'b'] }, 'list.1')).toBe('b');
  });

  it('returns undefined for a missing branch', () => {
    expect(getPath(state, 'style.nope.deeper')).toBeUndefined();
  });
});

describe('hasPath', () => {
  it('is true when every segment exists', () => {
    expect(hasPath({ a: { b: 0 } }, 'a.b')).toBe(true);
  });

  it('is false when a segment is missing', () => {
    expect(hasPath({ a: {} }, 'a.b')).toBe(false);
  });
});

describe('setPath', () => {
  it('does not mutate the original object', () => {
    const original = { style: { glass: { width: 0.18 } } };
    const next = setPath(original, 'style.glass.width', 0.5);

    expect(original.style.glass.width).toBe(0.18);
    expect(next.style.glass.width).toBe(0.5);
  });

  it('shares untouched branches with the original', () => {
    const original = { a: { kept: 1 }, b: { moved: 2 } };
    const next = setPath(original, 'b.moved', 3);

    expect(next.a).toBe(original.a);
    expect(next.b).not.toBe(original.b);
  });

  it('clones arrays rather than mutating them', () => {
    const original = { colors: ['#111111', '#222222'] };
    const next = setPath(original, 'colors.0', '#ffffff');

    expect(original.colors[0]).toBe('#111111');
    expect(next.colors[0]).toBe('#ffffff');
  });

  it('creates missing intermediate objects', () => {
    const next = setPath({}, 'a.b.c', 1);
    expect(getPath(next, 'a.b.c')).toBe(1);
  });
});
