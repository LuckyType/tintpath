import type { Color } from '../types';

/**
 * Map LAB luminance (0-100) to an 8-bit gray value. Dark colors stay dark, so
 * darker areas receive more laser power when the driver maps black to "burn".
 */
export function grayscaleForLab(l: number): number {
  return Math.max(0, Math.min(255, Math.round(l * 2.55)));
}

/** Rasterize the label map as grayscale (LAB luminance) RGBA pixels. */
export function renderGrayscalePixels(
  labelMap: Int32Array,
  palette: Color[],
  width: number,
  height: number,
): Uint8ClampedArray<ArrayBuffer> {
  const grays = palette.map((c) => grayscaleForLab(c.lab[0]));
  const out = new Uint8ClampedArray(width * height * 4);
  for (let p = 0; p < labelMap.length; p++) {
    const g = grays[labelMap[p]] ?? 255;
    const i = p * 4;
    out[i] = g;
    out[i + 1] = g;
    out[i + 2] = g;
    out[i + 3] = 255;
  }
  return out;
}
