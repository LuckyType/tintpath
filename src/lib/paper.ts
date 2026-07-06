import type { Orientation, PaperFormat } from './types';

/** Portrait dimensions in mm. */
export const PAPER_SIZES: { id: string; width: number; height: number }[] = [
  { id: 'A4', width: 210, height: 297 },
  { id: 'A3', width: 297, height: 420 },
  { id: 'A2', width: 420, height: 594 },
  { id: 'A1', width: 594, height: 841 },
  { id: 'Letter', width: 215.9, height: 279.4 },
  { id: 'Tabloid', width: 279.4, height: 431.8 },
  { id: 'Square', width: 300, height: 300 },
];

export function makePaperFormat(name: string, dpi = 300): PaperFormat {
  const spec = PAPER_SIZES.find((s) => s.id === name) ?? PAPER_SIZES[0];
  return { name: spec.id, width: spec.width, height: spec.height, unit: 'mm', dpi };
}

export function customPaperFormat(width: number, height: number, dpi = 300): PaperFormat {
  return {
    name: 'Custom',
    width: Math.max(10, Math.min(2000, width)),
    height: Math.max(10, Math.min(2000, height)),
    unit: 'mm',
    dpi,
  };
}

/** Oriented paper dimensions in mm. */
export function paperDims(
  format: PaperFormat,
  orientation: Orientation,
): { width: number; height: number } {
  const portrait = format.width <= format.height;
  const flip = (orientation === 'landscape') === portrait;
  return flip
    ? { width: format.height, height: format.width }
    : { width: format.width, height: format.height };
}

export function paperAspect(format: PaperFormat, orientation: Orientation): number {
  const { width, height } = paperDims(format, orientation);
  return width / height;
}

const MM_PER_INCH = 25.4;
const MAX_EXPORT_PIXELS = 12000;

/** Oriented paper dimensions in pixels at the format's DPI (capped). */
export function paperPixels(
  format: PaperFormat,
  orientation: Orientation,
): { width: number; height: number } {
  const { width, height } = paperDims(format, orientation);
  let w = Math.round((width / MM_PER_INCH) * format.dpi);
  let h = Math.round((height / MM_PER_INCH) * format.dpi);
  const largest = Math.max(w, h);
  if (largest > MAX_EXPORT_PIXELS) {
    const s = MAX_EXPORT_PIXELS / largest;
    w = Math.round(w * s);
    h = Math.round(h * s);
  }
  return { width: w, height: h };
}
