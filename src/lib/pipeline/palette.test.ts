import { describe, expect, it } from 'vitest';
import type { Color } from '../types';
import { applyFilter, swapColor } from './palette';
import { makeColor, rgbToLab } from './quantize';

const basePalette = (): Color[] => [
  makeColor(0, rgbToLab(200, 30, 30)), // red
  makeColor(1, rgbToLab(30, 200, 30)), // green
  makeColor(2, rgbToLab(30, 30, 200)), // blue
  makeColor(3, rgbToLab(128, 128, 128)), // gray
  makeColor(4, rgbToLab(240, 240, 100)), // pale yellow
];

const chromaOf = (c: Color) => Math.hypot(c.lab[1], c.lab[2]);
const hueDegOf = (c: Color) => {
  const h = (Math.atan2(c.lab[2], c.lab[1]) * 180) / Math.PI;
  return (h + 360) % 360;
};
const hueDistance = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
};

describe('applyFilter', () => {
  it("'none' returns equal copies, not the same objects", () => {
    const palette = basePalette();
    const result = applyFilter(palette, 'none');
    expect(result).toEqual(palette);
    expect(result[0]).not.toBe(palette[0]);
  });

  it('preserves ids and does not mutate the input', () => {
    const palette = basePalette();
    const before = JSON.stringify(palette);
    for (const filter of ['pastel', 'neon', 'synthwave', 'anaglyph', 'pop-art'] as const) {
      const result = applyFilter(palette, filter);
      expect(result.map((c) => c.id)).toEqual([0, 1, 2, 3, 4]);
    }
    expect(JSON.stringify(palette)).toBe(before);
  });

  it('grayscale removes all chroma', () => {
    for (const c of applyFilter(basePalette(), 'grayscale')) {
      expect(chromaOf(c)).toBeLessThan(1e-9);
    }
  });

  it('pastel lifts lightness and softens chroma', () => {
    const palette = basePalette();
    const result = applyFilter(palette, 'pastel');
    for (let i = 0; i < palette.length; i++) {
      expect(result[i].lab[0]).toBeGreaterThanOrEqual(palette[i].lab[0]);
      expect(chromaOf(result[i])).toBeLessThanOrEqual(chromaOf(palette[i]) + 1e-9);
    }
  });

  it('neon produces strongly saturated colors', () => {
    for (const c of applyFilter(basePalette(), 'neon')) {
      expect(chromaOf(c)).toBeGreaterThanOrEqual(59.9);
      expect(c.lab[0]).toBeGreaterThanOrEqual(44.9);
    }
  });

  it('synthwave pulls every hue near the pink/purple/cyan triad', () => {
    const poles = [330, 285, 190];
    for (const c of applyFilter(basePalette(), 'synthwave')) {
      const hue = hueDegOf(c);
      const nearest = Math.min(...poles.map((p) => hueDistance(hue, p)));
      expect(nearest).toBeLessThanOrEqual(30);
    }
  });

  it('anaglyph reduces the palette to a red/cyan duotone', () => {
    const result = applyFilter(basePalette(), 'anaglyph');
    for (const c of result) {
      const hue = hueDegOf(c);
      const isRed = hueDistance(hue, 40) < 2;
      const isCyan = hueDistance(hue, 196) < 2;
      expect(isRed || isCyan).toBe(true);
    }
    // Dark red stays on the red side, light yellow flips to cyan
    expect(hueDistance(hueDegOf(result[0]), 40)).toBeLessThan(2);
    expect(hueDistance(hueDegOf(result[4]), 196)).toBeLessThan(2);
  });

  it('pop-art snaps hues to the six comic primaries', () => {
    for (const c of applyFilter(basePalette(), 'pop-art')) {
      const hue = hueDegOf(c);
      const snapped = Math.round(hue / 60) * 60;
      expect(hueDistance(hue, snapped)).toBeLessThan(1);
    }
  });

  it('ocean pulls hues toward blue-teal', () => {
    for (const c of applyFilter(basePalette(), 'ocean')) {
      expect(hueDistance(hueDegOf(c), 230)).toBeLessThanOrEqual(55);
    }
  });

  it('sunset pulls hues toward warm orange', () => {
    for (const c of applyFilter(basePalette(), 'sunset')) {
      expect(hueDistance(hueDegOf(c), 45)).toBeLessThanOrEqual(65);
    }
  });

  it('high-contrast stretches lightness across the palette', () => {
    const result = applyFilter(basePalette(), 'high-contrast');
    const lightnesses = result.map((c) => c.lab[0]);
    expect(Math.min(...lightnesses)).toBeLessThanOrEqual(6);
    expect(Math.max(...lightnesses)).toBeGreaterThanOrEqual(94);
  });
});

describe('swapColor', () => {
  it('replaces the matching color and recomputes lab', () => {
    const result = swapColor(basePalette(), 2, '#ff8800');
    expect(result[2].hex).toBe('#ff8800');
    expect(result[2].rgb).toEqual([255, 136, 0]);
    expect(result[2].lab[0]).toBeGreaterThan(50);
    expect(result[0].hex).toBe(basePalette()[0].hex);
  });

  it('accepts hex without a leading #', () => {
    const result = swapColor(basePalette(), 0, '00ff00');
    expect(result[0].hex).toBe('#00ff00');
  });

  it('ignores invalid hex values', () => {
    const palette = basePalette();
    expect(swapColor(palette, 0, '#zzzzzz')).toBe(palette);
  });
});
