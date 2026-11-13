import { describe, expect, it } from 'vitest';
import { formatTime, wrapTime, numOr, durationRef } from './timing';

describe('numOr', () => {
  it('falls back for missing or non-numeric values (Number(undefined) ?? x is NaN, not x)', () => {
    expect(numOr(undefined, 1)).toBe(1);
    expect(numOr(null, 1)).toBe(1);
    expect(numOr('', 1)).toBe(1);
    expect(numOr('abc', 1)).toBe(1);
  });
  it('keeps real numbers, including zero', () => {
    expect(numOr(0, 1)).toBe(0);
    expect(numOr('0.5', 1)).toBe(0.5);
  });
});

describe('durationRef', () => {
  it('uses dur for continuous templates', () => {
    expect(durationRef({ dur: 12, n: 6 }, {})).toBe(12);
    expect(durationRef({ n: 6 }, {})).toBe(10);
  });
  it('never returns NaN for stepped templates with no count param', () => {
    const d = durationRef({ step: true, perCard: 2, n: 5 }, {});
    expect(d).toBe(10);
    expect(Number.isNaN(d)).toBe(false);
  });
});

describe('wrapTime / formatTime', () => {
  it('wraps into the clip', () => {
    expect(wrapTime(12, 10)).toBe(2);
    expect(wrapTime(-1, 10)).toBe(9);
    expect(wrapTime(5, 0)).toBe(0);
  });
  it('pads seconds and never prints 60', () => {
    expect(formatTime(5.3, 10)).toBe('0:05.3');
    expect(formatTime(59.96, 60)).toBe('1:00.0');
    expect(formatTime(65, 100)).toBe('1:05.0');
  });
});
