import { describe, expect, it } from 'vitest';
import { makeColor } from '../pipeline/quantize';
import type { OutlinePath, Region } from '../types';
import { generateSvg, pathToD } from './svg';

const region = (id: number, colorId: number, area = 10): Region => ({
  id,
  colorId,
  area,
  centroid: { x: 0, y: 0 },
  bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
  seed: { x: 0, y: 0 },
});

const square: OutlinePath = {
  regionId: 0,
  points: [
    { x: 0, y: 0 },
    { x: 9, y: 0 },
    { x: 9, y: 9 },
    { x: 0, y: 9 },
  ],
};

const smallSquare: OutlinePath = {
  regionId: 1,
  points: [
    { x: 2, y: 2 },
    { x: 4, y: 2 },
    { x: 4, y: 4 },
    { x: 2, y: 4 },
  ],
};

describe('pathToD', () => {
  it('generates a closed path string', () => {
    expect(pathToD(square.points)).toBe('M 0 0 L 9 0 L 9 9 L 0 9 Z');
  });

  it('rounds fractional coordinates to two decimals', () => {
    expect(pathToD([{ x: 1.2345, y: 2 }])).toBe('M 1.23 2 Z');
  });

  it('handles empty paths', () => {
    expect(pathToD([])).toBe('');
  });
});

describe('generateSvg', () => {
  const palette = [makeColor(0, [100, 0, 0]), makeColor(1, [0, 0, 0])];
  const regions = [region(0, 0, 100), region(1, 1, 9)];

  it('outline mode: stroke-only paths in a single group', () => {
    const svg = generateSvg({
      outlines: [square, smallSquare],
      regions,
      palette,
      width: 10,
      height: 10,
      mode: 'outline',
    });
    expect(svg).toContain('viewBox="0 0 10 10"');
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="#000000"');
    expect(svg).toContain('<path d="M 0 0 L 9 0 L 9 9 L 0 9 Z"/>');
    expect(svg.match(/<path /g)).toHaveLength(2);
    expect(svg.match(/<g /g)).toHaveLength(1);
  });

  it('layer-per-color mode: one group per color with data-color', () => {
    const svg = generateSvg({
      outlines: [square, smallSquare],
      regions,
      palette,
      width: 10,
      height: 10,
      mode: 'layer-per-color',
    });
    expect(svg).toContain(`<g id="color-1" data-color="${palette[0].hex}"`);
    expect(svg).toContain(`<g id="color-2" data-color="${palette[1].hex}"`);
    expect(svg.match(/<g /g)).toHaveLength(2);
  });

  it('grayscale mode: filled paths with LAB-luminance gray values', () => {
    const svg = generateSvg({
      outlines: [square, smallSquare],
      regions,
      palette,
      width: 10,
      height: 10,
      mode: 'grayscale',
    });
    expect(svg).toContain('fill="rgb(255,255,255)"'); // L=100 -> white
    expect(svg).toContain('fill="rgb(0,0,0)"'); // L=0 -> black
    expect(svg).not.toContain('stroke="#000000"');
    // Larger region must be painted before the smaller (enclosed) one
    expect(svg.indexOf('rgb(255,255,255)')).toBeLessThan(svg.indexOf('rgb(0,0,0)'));
  });

  it('produces a valid empty SVG for zero regions', () => {
    const svg = generateSvg({
      outlines: [],
      regions: [],
      palette: [],
      width: 10,
      height: 20,
      mode: 'outline',
    });
    expect(svg).toContain('viewBox="0 0 10 20"');
    expect(svg).not.toContain('<path');
  });
});
