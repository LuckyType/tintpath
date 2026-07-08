import { describe, expect, it } from 'vitest';
import { type Point, simplifyClosed, simplifyContour, simplifyPath } from './simplify';

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

describe('simplifyContour', () => {
  const key = (p: Point) => `${p.x},${p.y}`;

  it('simplifies a shared staircase run identically for both directions', () => {
    // A staircase run between two junctions, as region A (forward) and
    // region B (reversed) would each trace it.
    const staircase: Point[] = [];
    for (let i = 0; i <= 6; i++) {
      staircase.push({ x: i, y: i });
      if (i < 6) staircase.push({ x: i + 1, y: i });
    }
    const junctions = new Set([key(staircase[0]), key(staircase[staircase.length - 1])]);
    const isJunction = (p: Point) => junctions.has(key(p));

    // Build two closed contours sharing that run in opposite directions
    const contourA: Point[] = [...staircase, { x: 7, y: 0 }];
    const contourB: Point[] = [...[...staircase].reverse(), { x: -1, y: 6 }];
    const simplifiedA = simplifyContour(contourA, 1.4, isJunction);
    const simplifiedB = simplifyContour(contourB, 1.4, isJunction);

    const runA = simplifiedA.filter((p) => p.x >= 0 && p.x <= 7 && p.y >= p.x - 1);
    // Extract the shared run vertices from both results and compare as sets
    const setA = new Set(simplifiedA.map(key));
    const setB = new Set(simplifiedB.map(key));
    setA.delete('7,0');
    setB.delete('-1,6');
    expect([...setA].sort()).toEqual([...setB].sort());
    expect(runA.length).toBeGreaterThan(0);
  });

  it('keeps junction vertices even when collinear', () => {
    const contour: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 }, // junction on a straight edge
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const isJunction = (p: Point) => p.x === 5 && p.y === 0;
    const simplified = simplifyContour(contour, 1, isJunction);
    expect(simplified).toContainEqual({ x: 5, y: 0 });
  });

  it('falls back to closed simplification without junctions', () => {
    const contour: Point[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const simplified = simplifyContour(contour, 1, () => false);
    expect(simplified).toEqual(simplifyClosed(contour, 1));
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
