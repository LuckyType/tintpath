import type { Color, PaletteFilter } from '../types';
import { makeColor, rgbToLab } from './quantize';

function labToLch(lab: [number, number, number]): [number, number, number] {
  const [l, a, b] = lab;
  return [l, Math.sqrt(a * a + b * b), Math.atan2(b, a)];
}

function lchToLab(lch: [number, number, number]): [number, number, number] {
  const [l, c, h] = lch;
  return [l, c * Math.cos(h), c * Math.sin(h)];
}

const clampL = (l: number) => Math.max(0, Math.min(100, l));

/**
 * Apply a preset filter to a palette. Filters always derive from the palette
 * passed in (typically the base palette), so they never compound.
 */
export function applyFilter(palette: Color[], filter: PaletteFilter): Color[] {
  if (filter === 'none') return palette.map((c) => ({ ...c }));

  if (filter === 'high-contrast') {
    let minL = 100;
    let maxL = 0;
    for (const c of palette) {
      if (c.lab[0] < minL) minL = c.lab[0];
      if (c.lab[0] > maxL) maxL = c.lab[0];
    }
    const range = Math.max(1e-6, maxL - minL);
    return palette.map((c) => {
      const [l, chroma, h] = labToLch(c.lab);
      const stretched = 5 + ((l - minL) / range) * 90;
      return makeColor(c.id, lchToLab([clampL(stretched), chroma + 15, h]));
    });
  }

  return palette.map((c) => {
    const [l, chroma, h] = labToLch(c.lab);
    switch (filter) {
      case 'pastel':
        return makeColor(c.id, lchToLab([clampL(l + 15), Math.max(0, chroma - 10), h]));
      case 'vintage': {
        // Pull hue toward sepia (~70 deg), mute chroma, lift shadows slightly
        const sepiaHue = (70 * Math.PI) / 180;
        const blended = lchToLab([clampL(l * 0.9 + 8), chroma * 0.45, h]);
        const sepia = lchToLab([clampL(l * 0.9 + 8), 22, sepiaHue]);
        return makeColor(c.id, [
          blended[0],
          blended[1] * 0.5 + sepia[1] * 0.5,
          blended[2] * 0.5 + sepia[2] * 0.5,
        ]);
      }
      case 'grayscale':
        return makeColor(c.id, [l, 0, 0]);
      default:
        return { ...c };
    }
  });
}

/** Replace one palette color with a user-picked hex value. */
export function swapColor(palette: Color[], colorId: number, hex: string): Color[] {
  const normalized = hex.startsWith('#') ? hex : `#${hex}`;
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return palette;
  return palette.map((c) =>
    c.id === colorId
      ? {
          id: c.id,
          rgb: [r, g, b] as [number, number, number],
          lab: rgbToLab(r, g, b),
          hex: normalized.toLowerCase(),
        }
      : c,
  );
}
