import { describe, expect, it } from 'vitest';
import {
  compactPalette,
  deltaE,
  hexToRgb,
  labToRgb,
  makeColor,
  quantize,
  quantizeToPalette,
  rgbToLab,
} from './quantize';

function buildImage(
  width: number,
  height: number,
  picker: (x: number, y: number) => [number, number, number],
): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = picker(x, y);
      const i = (y * width + x) * 4;
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('rgbToLab / labToRgb', () => {
  it('converts white to L=100 with neutral a/b', () => {
    const [l, a, b] = rgbToLab(255, 255, 255);
    expect(l).toBeCloseTo(100, 1);
    expect(Math.abs(a)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
  });

  it('converts black to the LAB origin', () => {
    const [l, a, b] = rgbToLab(0, 0, 0);
    expect(l).toBeCloseTo(0, 1);
    expect(Math.abs(a)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
  });

  it('matches the reference LAB value for pure red', () => {
    const [l, a, b] = rgbToLab(255, 0, 0);
    expect(l).toBeCloseTo(53.24, 1);
    expect(a).toBeCloseTo(80.09, 1);
    expect(b).toBeCloseTo(67.2, 1);
  });

  it('round-trips RGB values within +/-2 per channel', () => {
    const colors: [number, number, number][] = [
      [12, 200, 34],
      [128, 128, 128],
      [240, 10, 250],
      [1, 2, 3],
    ];
    for (const [r, g, b] of colors) {
      const [rr, rg, rb] = labToRgb(rgbToLab(r, g, b));
      expect(Math.abs(rr - r)).toBeLessThanOrEqual(2);
      expect(Math.abs(rg - g)).toBeLessThanOrEqual(2);
      expect(Math.abs(rb - b)).toBeLessThanOrEqual(2);
    }
  });
});

describe('quantize', () => {
  const red: [number, number, number] = [200, 30, 30];
  const blue: [number, number, number] = [30, 30, 200];

  it('separates a two-color image into two clusters', () => {
    const width = 16;
    const height = 16;
    const pixels = buildImage(width, height, (x) => (x < width / 2 ? red : blue));
    const { labelMap, palette } = quantize(pixels, width, height, { k: 2, sampleStride: 1 });

    expect(palette).toHaveLength(2);

    const leftLabel = labelMap[0];
    const rightLabel = labelMap[width - 1];
    expect(leftLabel).not.toBe(rightLabel);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        expect(labelMap[y * width + x]).toBe(x < width / 2 ? leftLabel : rightLabel);
      }
    }

    expect(deltaE(palette[leftLabel].lab, rgbToLab(...red))).toBeLessThan(8);
    expect(deltaE(palette[rightLabel].lab, rgbToLab(...blue))).toBeLessThan(8);
  });

  it('collapses a uniform image to a single palette entry even with k=5', () => {
    const pixels = buildImage(8, 8, () => [250, 250, 250]);
    const { labelMap, palette } = quantize(pixels, 8, 8, { k: 5, sampleStride: 1 });
    expect(palette).toHaveLength(1);
    expect([...labelMap].every((l) => l === 0)).toBe(true);
  });

  it('orders the palette by usage, most common color first', () => {
    const width = 16;
    const height = 16;
    // 12 red columns vs 4 blue columns
    const pixels = buildImage(width, height, (x) => (x < 12 ? red : blue));
    const { palette } = quantize(pixels, width, height, { k: 2, sampleStride: 1 });
    const dRed = deltaE(palette[0].lab, rgbToLab(...red));
    const dBlue = deltaE(palette[0].lab, rgbToLab(...blue));
    expect(dRed).toBeLessThan(dBlue);
  });

  it('handles k larger than the number of pixels', () => {
    const pixels = buildImage(2, 1, (x) => (x === 0 ? red : blue));
    const { palette } = quantize(pixels, 2, 1, { k: 5, sampleStride: 1 });
    expect(palette.length).toBeLessThanOrEqual(2);
    expect(palette.length).toBeGreaterThan(0);
  });

  it('produces identical results for identical inputs (deterministic)', () => {
    const pixels = buildImage(12, 12, (x, y) => [(x * 20) % 255, (y * 20) % 255, 120]);
    const a = quantize(pixels, 12, 12, { k: 4, sampleStride: 1 });
    const b = quantize(pixels, 12, 12, { k: 4, sampleStride: 1 });
    expect([...a.labelMap]).toEqual([...b.labelMap]);
    expect(a.palette.map((c) => c.hex)).toEqual(b.palette.map((c) => c.hex));
  });
});

describe('hexToRgb', () => {
  it('parses hex with and without a leading #', () => {
    expect(hexToRgb('#ff8800')).toEqual([255, 136, 0]);
    expect(hexToRgb('00ff00')).toEqual([0, 255, 0]);
  });

  it('rejects invalid values', () => {
    expect(hexToRgb('#zzzzzz')).toBeNull();
    expect(hexToRgb('#fff')).toBeNull();
    expect(hexToRgb('')).toBeNull();
  });
});

describe('quantizeToPalette', () => {
  it('maps every pixel to the nearest of the fixed colors', () => {
    const width = 8;
    const height = 8;
    // Left half dark red-ish, right half light blue-ish
    const pixels = buildImage(width, height, (x) => (x < 4 ? [180, 40, 40] : [80, 110, 220]));
    const fixed: [number, number, number][] = [
      [255, 0, 0],
      [0, 0, 255],
      [0, 255, 0], // never nearest -> must be dropped
    ];
    const { labelMap, palette } = quantizeToPalette(pixels, width, height, fixed);
    expect(palette).toHaveLength(2);
    // Exact user colors are kept, not re-averaged
    const hexes = palette.map((c) => c.hex).sort();
    expect(hexes).toEqual(['#0000ff', '#ff0000']);
    const leftLabel = labelMap[0];
    const rightLabel = labelMap[width - 1];
    expect(leftLabel).not.toBe(rightLabel);
    expect(palette[leftLabel].hex).toBe('#ff0000');
    expect(palette[rightLabel].hex).toBe('#0000ff');
  });

  it('keeps label indices consistent with the compacted palette', () => {
    const pixels = buildImage(4, 1, () => [10, 10, 10]);
    const { labelMap, palette } = quantizeToPalette(pixels, 4, 1, [
      [255, 255, 255],
      [0, 0, 0],
    ]);
    expect(palette).toHaveLength(1);
    expect(palette[0].hex).toBe('#000000');
    expect([...labelMap]).toEqual([0, 0, 0, 0]);
  });
});

describe('compactPalette', () => {
  it('drops unused colors and remaps the label map', () => {
    const palette = [makeColor(0, [10, 0, 0]), makeColor(1, [50, 0, 0]), makeColor(2, [90, 0, 0])];
    const labelMap = new Int32Array([1, 1, 1, 1]);
    const compacted = compactPalette(labelMap, palette);
    expect(compacted).toHaveLength(1);
    expect(compacted[0].id).toBe(0);
    expect(compacted[0].lab[0]).toBeCloseTo(50, 5);
    expect([...labelMap]).toEqual([0, 0, 0, 0]);
  });

  it('reorders by usage and keeps ids consistent with indices', () => {
    const palette = [makeColor(0, [10, 0, 0]), makeColor(1, [50, 0, 0])];
    const labelMap = new Int32Array([1, 1, 1, 0]);
    const compacted = compactPalette(labelMap, palette);
    expect(compacted[0].lab[0]).toBeCloseTo(50, 5);
    expect(compacted.map((c) => c.id)).toEqual([0, 1]);
    expect([...labelMap]).toEqual([0, 0, 0, 1]);
  });

  it('returns the palette unchanged when everything is used in order', () => {
    const palette = [makeColor(0, [10, 0, 0]), makeColor(1, [50, 0, 0])];
    const labelMap = new Int32Array([0, 0, 1, 1]);
    expect(compactPalette(labelMap, palette)).toBe(palette);
  });
});
