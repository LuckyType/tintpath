import { describe, expect, it } from 'vitest';
import { simplifyClosed, simplifyPath } from './simplify';

describe('simplifyPath', () => {
  it('collapses collinear points to the two endpoints', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ];
    expect(simplifyPath(points, 0.5)).toEqual([
      { x: 0, y: 0 },
      { x: 3, y: 0 },
    ]);
  });

  it('keeps corners that exceed epsilon', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 5, y: 5 },
    ];
    expect(simplifyPath(points, 0.5)).toEqual(points);
  });

  it('removes small zigzag noise below epsilon but keeps larger features', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 2, y: 0.2 },
      { x: 4, y: -0.2 },
      { x: 6, y: 4 },
      { x: 8, y: 0 },
    ];
    const simplified = simplifyPath(points, 1);
    expect(simplified).toContainEqual({ x: 6, y: 4 });
    expect(simplified).not.toContainEqual({ x: 2, y: 0.2 });
  });

  it('returns short paths unchanged', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ];
    expect(simplifyPath(points, 10)).toEqual(points);
    expect(simplifyPath([], 1)).toEqual([]);
  });

  it('does not mutate the input', () => {
    const points = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];
    const copy = points.map((p) => ({ ...p }));
    simplifyPath(points, 1);
    expect(points).toEqual(copy);
  });
});

describe('simplifyClosed', () => {
  it('keeps all four corners of a square ring', () => {
    // Square outline with intermediate edge points, start not repeated
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
      { x: 5, y: 10 },
      { x: 0, y: 10 },
      { x: 0, y: 5 },
    ];
    const simplified = simplifyClosed(points, 0.5);
    expect(simplified).toContainEqual({ x: 0, y: 0 });
    expect(simplified).toContainEqual({ x: 10, y: 0 });
    expect(simplified).toContainEqual({ x: 10, y: 10 });
    expect(simplified).toContainEqual({ x: 0, y: 10 });
    expect(simplified).toHaveLength(4);
  });

  it('leaves tiny rings unchanged', () => {
    const triangle = [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ];
    expect(simplifyClosed(triangle, 2)).toEqual(triangle);
  });
});
