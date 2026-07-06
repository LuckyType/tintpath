import type { Color, LaserMode, OutlinePath, Region } from '../types';
import { grayscaleForLab } from './laser';

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2));

/** Convert an outline (closed ring, start point not repeated) to a path `d`. */
export function pathToD(points: { x: number; y: number }[]): string {
  if (points.length === 0) return '';
  let d = `M ${fmt(points[0].x)} ${fmt(points[0].y)}`;
  for (let i = 1; i < points.length; i++) {
    d += ` L ${fmt(points[i].x)} ${fmt(points[i].y)}`;
  }
  return `${d} Z`;
}

export interface SvgExportParams {
  outlines: OutlinePath[];
  regions: Region[];
  palette: Color[];
  width: number;
  height: number;
  mode: LaserMode;
  strokeWidth?: number;
}

/**
 * Vector export for laser engraving.
 * - outline: all contours in one group, stroke only
 * - layer-per-color: one <g> per palette color for multi-pass engraving
 * - grayscale: filled regions, gray value from LAB luminance, for PWM power
 */
export function generateSvg(params: SvgExportParams): string {
  const { outlines, regions, palette, width, height, mode, strokeWidth = 1 } = params;
  const colorOf = new Map<number, number>();
  for (const r of regions) colorOf.set(r.id, r.colorId);

  const open =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${fmt(width)} ${fmt(height)}" ` +
    `width="${fmt(width)}" height="${fmt(height)}">`;

  if (mode === 'grayscale') {
    // Outlines arrive largest-first, so enclosed regions paint on top
    const paths = outlines
      .filter((o) => o.points.length >= 3)
      .map((o) => {
        const colorId = colorOf.get(o.regionId);
        const lab = colorId !== undefined ? palette[colorId]?.lab : undefined;
        const g = grayscaleForLab(lab ? lab[0] : 100);
        return `<path d="${pathToD(o.points)}" fill="rgb(${g},${g},${g})" stroke="none"/>`;
      })
      .join('\n');
    return `${open}\n<rect width="${fmt(width)}" height="${fmt(height)}" fill="#ffffff"/>\n${paths}\n</svg>`;
  }

  if (mode === 'layer-per-color') {
    const byColor = new Map<number, OutlinePath[]>();
    for (const o of outlines) {
      const colorId = colorOf.get(o.regionId);
      if (colorId === undefined) continue;
      const list = byColor.get(colorId) ?? [];
      list.push(o);
      byColor.set(colorId, list);
    }
    const groups = [...byColor.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([colorId, paths]) => {
        const hex = palette[colorId]?.hex ?? '#000000';
        const body = paths
          .filter((o) => o.points.length >= 2)
          .map((o) => `<path d="${pathToD(o.points)}"/>`)
          .join('\n');
        return (
          `<g id="color-${colorId + 1}" data-color="${hex}" fill="none" ` +
          `stroke="#000000" stroke-width="${fmt(strokeWidth)}">\n${body}\n</g>`
        );
      })
      .join('\n');
    return `${open}\n${groups}\n</svg>`;
  }

  const body = outlines
    .filter((o) => o.points.length >= 2)
    .map((o) => `<path d="${pathToD(o.points)}"/>`)
    .join('\n');
  return (
    `${open}\n<g fill="none" stroke="#000000" stroke-width="${fmt(strokeWidth)}">` +
    `\n${body}\n</g>\n</svg>`
  );
}
