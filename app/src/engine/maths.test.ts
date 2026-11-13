import { describe, expect, it } from 'vitest';
import { mat4, lookAt } from './math';

describe('lookAt', () => {
  it('keeps +x on the right and +y up when looking down -z (no mirroring)', () => {
    const view = lookAt([0, 0, 5], [0, 0, 0], [0, 1, 0]);
    const right = mat4.transform(view, 1, 0, 0);
    const up = mat4.transform(view, 0, 1, 0);
    expect(right[0]).toBeCloseTo(1); // world +x -> view +x
    expect(up[1]).toBeCloseTo(1); // world +y -> view +y
    expect(mat4.transform(view, 0, 0, 0)[2]).toBeCloseTo(-5); // origin is 5 in front of the eye
  });

  it('is a proper rotation (determinant +1), never a reflection', () => {
    const v = lookAt([2, 1, 4], [0, 0.3, 0], [0, 1, 0]);
    const det =
      v[0] * (v[5] * v[10] - v[9] * v[6]) -
      v[4] * (v[1] * v[10] - v[9] * v[2]) +
      v[8] * (v[1] * v[6] - v[5] * v[2]);
    expect(det).toBeCloseTo(1);
  });
});
