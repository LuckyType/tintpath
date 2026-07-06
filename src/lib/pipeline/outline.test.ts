import { describe, expect, it } from 'vitest';
import {
  extractOutlines,
  findRegions,
  mergeSmallRegions,
  reduceNoiseFilter,
  traceContour,
} from './outline';
import { makeColor } from './quantize';

describe('findRegions', () => {
  it('finds two half-image regions with correct stats', () => {
    // 4x4: left two columns label 0, right two columns label 1
    const labelMap = new Int32Array([0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1]);
    const { regionMap, regions } = findRegions(labelMap, 4, 4);

    expect(regions).toHaveLength(2);
    const [left, right] = regions;
    expect(left.colorId).toBe(0);
    expect(right.colorId).toBe(1);
    expect(left.area).toBe(8);
    expect(right.area).toBe(8);
    expect(left.centroid).toEqual({ x: 0.5, y: 1.5 });
    expect(right.centroid).toEqual({ x: 2.5, y: 1.5 });
    expect(left.seed).toEqual({ x: 0, y: 0 });
    expect(right.seed).toEqual({ x: 2, y: 0 });
    expect(regionMap[0]).toBe(left.id);
    expect(regionMap[3]).toBe(right.id);
  });

  it('separates disconnected areas of the same color', () => {
    // 3x3: middle column label 1, outer columns label 0 (disconnected)
    const labelMap = new Int32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]);
    const { regions } = findRegions(labelMap, 3, 3);
    expect(regions).toHaveLength(3);
    expect(regions.filter((r) => r.colorId === 0)).toHaveLength(2);
    expect(regions.filter((r) => r.colorId === 1)).toHaveLength(1);
  });
});

describe('mergeSmallRegions', () => {
  it('merges a single-pixel region into its surrounding region', () => {
    const size = 5;
    const labelMap = new Int32Array(size * size).fill(0);
    labelMap[2 * size + 2] = 1;
    const palette = [makeColor(0, [10, 0, 0]), makeColor(1, [90, 0, 0])];
    const merged = mergeSmallRegions(labelMap, size, size, palette, 5);
    expect([...merged].every((l) => l === 0)).toBe(true);
  });

  it('merges into the neighbor with the most similar color', () => {
    // 5x1 row: [black, black, light-gray, white, white]
    const labelMap = new Int32Array([0, 0, 2, 1, 1]);
    const palette = [makeColor(0, [0, 0, 0]), makeColor(1, [100, 0, 0]), makeColor(2, [90, 0, 0])];
    const merged = mergeSmallRegions(labelMap, 5, 1, palette, 2);
    // light-gray (L=90) is far closer to white (L=100) than to black (L=0)
    expect(merged[2]).toBe(1);
    expect([...merged]).toEqual([0, 0, 1, 1, 1]);
  });

  it('leaves maps without small regions untouched', () => {
    const labelMap = new Int32Array([0, 0, 1, 1]);
    const palette = [makeColor(0, [10, 0, 0]), makeColor(1, [90, 0, 0])];
    const merged = mergeSmallRegions(labelMap, 4, 1, palette, 2);
    expect([...merged]).toEqual([0, 0, 1, 1]);
  });
});

describe('reduceNoiseFilter', () => {
  it('absorbs single-pixel artifacts into the dominant neighborhood label', () => {
    const labelMap = new Int32Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const filtered = reduceNoiseFilter(labelMap, 3, 3);
    expect(filtered[4]).toBe(0);
  });

  it('keeps homogeneous areas unchanged', () => {
    const labelMap = new Int32Array([0, 0, 1, 1, 0, 0, 1, 1]);
    const filtered = reduceNoiseFilter(labelMap, 4, 2);
    expect([...filtered]).toEqual([...labelMap]);
  });
});

describe('traceContour', () => {
  it('walks the perimeter of a solid 3x3 block clockwise', () => {
    const labelMap = new Int32Array(9).fill(0);
    const { regionMap } = findRegions(labelMap, 3, 3);
    const contour = traceContour(regionMap, 3, 3, 0, 0, 0, 100);

    expect(contour).toHaveLength(8);
    expect(contour[0]).toEqual({ x: 0, y: 0 });
    const keys = new Set(contour.map((p) => `${p.x},${p.y}`));
    expect(keys.size).toBe(8);
    expect(keys.has('1,1')).toBe(false); // interior pixel is not on the contour
    expect(keys.has('2,2')).toBe(true);
  });

  it('returns a single point for a 1-pixel region', () => {
    const labelMap = new Int32Array([0, 1, 0, 0]);
    const { regionMap, regions } = findRegions(labelMap, 4, 1);
    const single = regions.find((r) => r.colorId === 1);
    expect(single).toBeDefined();
    if (!single) return;
    const contour = traceContour(regionMap, 4, 1, single.id, single.seed.x, single.seed.y, 100);
    expect(contour).toEqual([{ x: 1, y: 0 }]);
  });
});

describe('extractOutlines', () => {
  it('produces one closed outline per region', () => {
    const labelMap = new Int32Array([0, 0, 1, 1, 0, 0, 1, 1]);
    const { regionMap, regions } = findRegions(labelMap, 4, 2);
    const outlines = extractOutlines(regionMap, 4, 2, regions);
    expect(outlines).toHaveLength(2);
    expect(outlines.map((o) => o.regionId).sort()).toEqual(regions.map((r) => r.id).sort());
    for (const outline of outlines) {
      expect(outline.points.length).toBeGreaterThanOrEqual(4);
    }
  });
});
