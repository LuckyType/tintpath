import { describe, expect, it } from 'vitest';
import { makeColor } from '../pipeline/quantize';
import { layoutLegend } from './pdf';

const palette = (n: number) =>
  Array.from({ length: n }, (_, i) => makeColor(i, [50 + (i % 5), 0, 0]));

describe('layoutLegend', () => {
  const A4 = { width: 210, height: 297 };
  const margin = 15;

  it('fits 30 colors on a single A4 page', () => {
    const layout = layoutLegend(palette(30), A4.width, A4.height, margin);
    expect(layout.pageCount).toBe(1);
    expect(layout.entries).toHaveLength(30);
    expect(layout.entries.every((e) => e.page === 0)).toBe(true);
  });

  it('numbers entries sequentially starting at 1', () => {
    const layout = layoutLegend(palette(10), A4.width, A4.height, margin);
    expect(layout.entries.map((e) => e.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('keeps every entry inside the printable area', () => {
    const layout = layoutLegend(palette(200), A4.width, A4.height, margin);
    for (const entry of layout.entries) {
      expect(entry.x).toBeGreaterThanOrEqual(margin);
      expect(entry.x + layout.columnWidth).toBeLessThanOrEqual(
        A4.width - margin + layout.columnWidth,
      );
      expect(entry.y).toBeGreaterThanOrEqual(margin);
      expect(entry.y).toBeLessThanOrEqual(A4.height - margin);
    }
  });

  it('breaks onto additional pages when a page is full', () => {
    const layout = layoutLegend(palette(200), A4.width, A4.height, margin);
    expect(layout.pageCount).toBeGreaterThan(1);
    const lastEntry = layout.entries[layout.entries.length - 1];
    expect(lastEntry.page).toBe(layout.pageCount - 1);
    // Page indices are contiguous starting at 0
    const pages = new Set(layout.entries.map((e) => e.page));
    expect(pages.size).toBe(layout.pageCount);
  });

  it('flows entries top-to-bottom within a column', () => {
    const layout = layoutLegend(palette(5), A4.width, A4.height, margin);
    for (let i = 1; i < 5; i++) {
      expect(layout.entries[i].y).toBeGreaterThan(layout.entries[i - 1].y);
      expect(layout.entries[i].x).toBe(layout.entries[0].x);
    }
  });

  it('handles an empty palette', () => {
    const layout = layoutLegend([], A4.width, A4.height, margin);
    expect(layout.pageCount).toBe(1);
    expect(layout.entries).toHaveLength(0);
  });
});
