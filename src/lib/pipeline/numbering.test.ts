import { describe, expect, it } from 'vitest';
import { computePlacements, fontSizeForArea } from './numbering';
import { findRegions } from './outline';

describe('fontSizeForArea', () => {
  it('grows with area and stays within clamps', () => {
    expect(fontSizeForArea(4)).toBe(8);
    expect(fontSizeForArea(1_000_000)).toBe(28);
    expect(fontSizeForArea(2500)).toBeGreaterThan(fontSizeForArea(400));
  });
});

describe('computePlacements', () => {
  it('places the number strictly inside a convex region, away from its border', () => {
    const labelMap = new Int32Array(16).fill(0); // 4x4 single region
    const { regionMap, regions } = findRegions(labelMap, 4, 4);
    const [placement] = computePlacements(regionMap, 4, 4, regions);
    expect(placement.number).toBe(1); // colorId 0 -> number 1
    // Pole of inaccessibility: one of the four interior pixels
    expect(placement.x).toBeGreaterThanOrEqual(1);
    expect(placement.x).toBeLessThanOrEqual(2);
    expect(placement.y).toBeGreaterThanOrEqual(1);
    expect(placement.y).toBeLessThanOrEqual(2);
    expect(regionMap[placement.y * 4 + placement.x]).toBe(placement.regionId);
  });

  it('keeps the anchor inside the region even when no interior pixel exists', () => {
    // Ring: 3x3 all label 0 except the center pixel (label 1).
    const labelMap = new Int32Array([0, 0, 0, 0, 1, 0, 0, 0, 0]);
    const { regionMap, regions } = findRegions(labelMap, 3, 3);
    const placements = computePlacements(regionMap, 3, 3, regions);
    for (const placement of placements) {
      expect(regionMap[placement.y * 3 + placement.x]).toBe(placement.regionId);
    }
  });

  it('avoids drawn lines: anchor of an enclosed region sits at its center', () => {
    // 7x7: 1px frame of color 0 around a 5x5 inner block of color 1
    const size = 7;
    const labelMap = new Int32Array(size * size).fill(0);
    for (let y = 1; y <= 5; y++) {
      for (let x = 1; x <= 5; x++) labelMap[y * size + x] = 1;
    }
    const { regionMap, regions } = findRegions(labelMap, size, size);
    const inner = regions.find((r) => r.colorId === 1);
    expect(inner).toBeDefined();
    if (!inner) return;
    const placements = computePlacements(regionMap, size, size, regions);
    const placement = placements.find((p) => p.regionId === inner.id);
    expect(placement).toBeDefined();
    if (!placement) return;
    // The pixel farthest from the surrounding outline is the exact center
    expect({ x: placement.x, y: placement.y }).toEqual({ x: 3, y: 3 });
    // None of its 4-neighbors touch another region (i.e. not on a line)
    const p = placement.y * size + placement.x;
    expect(regionMap[p - 1]).toBe(inner.id);
    expect(regionMap[p + 1]).toBe(inner.id);
    expect(regionMap[p - size]).toBe(inner.id);
    expect(regionMap[p + size]).toBe(inner.id);
  });

  it('caps the font size by the region clearance so digits fit between lines', () => {
    // 5x1 strip: every pixel touches the border -> minimum font size
    const strip = new Int32Array(5).fill(0);
    const stripRegions = findRegions(strip, 5, 1);
    const [stripPlacement] = computePlacements(stripRegions.regionMap, 5, 1, stripRegions.regions);
    expect(stripPlacement.fontSize).toBe(6);

    // 20x20 block: plenty of clearance -> larger than the minimum
    const block = new Int32Array(400).fill(0);
    const blockRegions = findRegions(block, 20, 20);
    const [blockPlacement] = computePlacements(
      blockRegions.regionMap,
      20,
      20,
      blockRegions.regions,
    );
    expect(blockPlacement.fontSize).toBeGreaterThan(stripPlacement.fontSize);
  });

  it('numbers regions by their palette color, not their region id', () => {
    const labelMap = new Int32Array([1, 1, 0, 0]); // color 1 left, color 0 right
    const { regionMap, regions } = findRegions(labelMap, 4, 1);
    const placements = computePlacements(regionMap, 4, 1, regions);
    const left = placements.find((p) => p.x <= 1);
    const right = placements.find((p) => p.x >= 2);
    expect(left?.number).toBe(2);
    expect(right?.number).toBe(1);
  });
});
