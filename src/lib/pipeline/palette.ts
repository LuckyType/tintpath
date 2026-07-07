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
const deg = (d: number) => (d * Math.PI) / 180;
const TAU = Math.PI * 2;

/** Blend hue `h` toward `target` by `t` (0..1) along the shortest arc. */
function blendHue(h: number, target: number, t: number): number {
  let delta = ((target - h + Math.PI) % TAU) - Math.PI;
  if (delta < -Math.PI) delta += TAU;
  return h + delta * t;
}

/** Snap hue to the nearest of a fixed set of pole hues (radians). */
function nearestHue(h: number, poles: number[]): number {
  let best = poles[0];
  let bestDist = Number.POSITIVE_INFINITY;
  for (const pole of poles) {
    let delta = Math.abs(((pole - h + Math.PI) % TAU) - Math.PI);
    if (delta > Math.PI) delta = TAU - delta;
    if (delta < bestDist) {
      bestDist = delta;
      best = pole;
    }
  }
  return best;
}

// Approximate LCh hues of reference colors (from sRGB): red ~40deg, cyan ~196deg
const HUE_RED = deg(40);
const HUE_CYAN = deg(196);
const SYNTHWAVE_POLES = [deg(330), deg(285), deg(190)]; // hot pink, purple, cyan
const POP_ART_POLES = [0, deg(60), deg(120), deg(180), deg(240), deg(300)];

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
        const sepiaHue = deg(70);
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
      case 'neon': {
        // Electric: mid-to-bright lightness, chroma cranked far up
        const lifted = 45 + (l / 100) * 40;
        const vivid = Math.min(120, Math.max(60, chroma * 2.2));
        return makeColor(c.id, lchToLab([clampL(lifted), vivid, h]));
      }
      case 'synthwave': {
        // Everything gravitates to the pink/purple/cyan retrowave triad
        const pole = nearestHue(h, SYNTHWAVE_POLES);
        const hue = blendHue(h, pole, 0.75);
        const vivid = Math.min(110, chroma * 1.6 + 25);
        return makeColor(c.id, lchToLab([clampL(l * 0.85 + 8), vivid, hue]));
      }
      case 'anaglyph': {
        // Retro 3D duotone: dark colors go red, light colors go cyan
        const hue = l < 55 ? HUE_RED : HUE_CYAN;
        return makeColor(c.id, lchToLab([l, 30 + l * 0.4, hue]));
      }
      case 'pop-art': {
        // Snap hues to six comic-book primaries, boost saturation hard
        const hue = nearestHue(h, POP_ART_POLES);
        const vivid = Math.min(115, chroma * 1.8 + 30);
        const punchyL = l < 50 ? l * 0.85 : Math.min(95, l * 1.1);
        return makeColor(c.id, lchToLab([clampL(punchyL), vivid, hue]));
      }
      case 'ocean': {
        // Pull every hue into the blue-teal band
        const hue = blendHue(h, deg(230), 0.7);
        return makeColor(c.id, lchToLab([l, chroma * 0.9 + 10, hue]));
      }
      case 'sunset': {
        // Warm golden-hour cast
        const hue = blendHue(h, deg(45), 0.65);
        return makeColor(c.id, lchToLab([l, chroma * 1.1 + 12, hue]));
      }
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
