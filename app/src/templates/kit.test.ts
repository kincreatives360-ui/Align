import { aim, fibo, frame3, S } from './kit';

describe('archived layout helpers', () => {
  it('aims a card toward the positive Z direction', () => {
    expect(aim(0, 0, 1)).toEqual({ rx: -0, ry: 0 });
  });

  it('returns the first Fibonacci direction for a single point', () => {
    expect(fibo(0, 1)).toEqual([1, 0, 0]);
  });

  it('builds an orthogonal frame from width and facing directions', () => {
    const matrix = frame3(4, 5, 6, [2, 0, 0], [1, 2, 0]);
    const x = [matrix[0], matrix[1], matrix[2]];
    const y = [matrix[4], matrix[5], matrix[6]];
    const z = [matrix[8], matrix[9], matrix[10]];
    const dot = (a: number[], b: number[]) => a.reduce((sum, value, i) => sum + value * b[i], 0);

    expect(dot(x, y)).toBeCloseTo(0);
    expect(dot(x, z)).toBeCloseTo(0);
    expect(dot(y, z)).toBeCloseTo(0);
    expect([matrix[12], matrix[13], matrix[14], matrix[15]]).toEqual([4, 5, 6, 1]);
  });

  it('scales all three axes with the archived column-major matrix layout', () => {
    expect(Array.from(S(2, 3, 4))).toEqual([
      2, 0, 0, 0,
      0, 3, 0, 0,
      0, 0, 4, 0,
      0, 0, 0, 1,
    ]);
  });
});
